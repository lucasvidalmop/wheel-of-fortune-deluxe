import { useEffect, useRef } from 'react';

interface Props {
  rows: number;
  multipliers: number[];
  /** Caminho da bolinha vindo do servidor: 0 = esquerda, 1 = direita */
  path: number[] | null;
  accent?: string;
  onFinish?: () => void;
}

/** tempo de queda do topo até a primeira fileira de pinos */
const DROP_MS = 620;
/** tempo por fileira (mais lento = mais legível na live) */
const ROW_MS = 320;
/** tempo da acomodação no slot vencedor */
const SETTLE_MS = 900;

const hexA = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(n.slice(0, 2), 16) || 0;
  const g = parseInt(n.slice(2, 4), 16) || 0;
  const b = parseInt(n.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${a})`;
};

/** cores dos slots por "força" do multiplicador, no estilo da referência */
const slotStyle = (m: number, accent: string) => {
  if (m <= 0) return { bg: 'rgba(255,255,255,0.045)', fg: 'rgba(255,255,255,0.28)' };
  if (m < 1) return { bg: hexA(accent, 0.14), fg: 'rgba(255,255,255,0.55)' };
  if (m < 3) return { bg: hexA(accent, 0.22), fg: 'rgba(255,255,255,0.82)' };
  if (m < 8) return { bg: hexA(accent, 0.5), fg: '#04150a' };
  return { bg: accent, fg: '#04150a' };
};

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

const Plinko = ({ rows, multipliers, path, accent = '#22c55e', onFinish }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef({ w: 900, h: 560 });
  const rafRef = useRef<number>();
  const finishedRef = useRef(false);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  /** mantém o canvas do tamanho real do container (sem letterbox) */
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const apply = () => {
      const r = wrap.getBoundingClientRect();
      const w = Math.max(320, Math.round(r.width));
      const h = Math.max(320, Math.round(r.height));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      sizeRef.current = { w, h };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const slots = Math.max(2, multipliers.length);

    finishedRef.current = false;
    const start = performance.now();
    const hits = new Map<string, number>();
    const trail: { x: number; y: number; t: number }[] = [];

    const steps = path ? Math.min(path.length, rows) : 0;
    const totalRowsMs = steps * ROW_MS;

    const draw = (now: number) => {
      const { w: W, h: H } = sizeRef.current;
      ctx.clearRect(0, 0, W, H);
      const elapsed = now - start;

      // ---- tabuleiro com proporção fixa, centralizado (nunca esticado) ----
      const AR = Math.min(1.6, Math.max(1.05, slots * 0.13));
      let BH = H;
      let BW = BH * AR;
      if (BW > W) { BW = W; BH = BW / AR; }
      const ox = (W - BW) / 2;
      const oy = (H - BH) / 2;
      const cx = ox + BW / 2;

      const padX = BW * 0.02;
      const spread = BW - padX * 2;
      const left = ox + padX;
      const slotW = spread / slots;
      const slotH = Math.min(slotW * 0.92, BH * 0.15);
      const topY = oy + BH * 0.1;
      const bottomY = oy + BH - slotH - BH * 0.045;
      const rowH = (bottomY - topY) / Math.max(1, rows);
      const step = spread / (rows + 1);
      const pinR = Math.max(2.5, step * 0.1);
      const ballR = Math.max(6, step * 0.32);

      const ballX = (k: number, r: number) => cx + (2 * r - k) * (step / 2);
      const pinX = (row: number, c: number) => cx + (c - (row + 1) / 2) * step;

      // ---- fundo do tabuleiro ----
      ctx.beginPath();
      ctx.roundRect(ox + 0.5, oy + 0.5, BW - 1, BH - 1, Math.min(24, BW * 0.02));
      ctx.fillStyle = '#0b0f16';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // ---- posição lógica da bolinha ----
      let phase: 'drop' | 'rows' | 'settle' = 'drop';
      let x = cx;
      let y = oy + BH * 0.035;
      let squash = 1;
      let rightsDone = 0;
      let settleT = 0;

      if (path && steps > 0) {
        const y0 = oy + BH * 0.035;
        if (elapsed < DROP_MS) {
          const t = Math.min(1, elapsed / DROP_MS);
          y = y0 + (topY - y0) * (t * t);
          x = cx;
        } else if (elapsed < DROP_MS + totalRowsMs) {
          phase = 'rows';
          const e = elapsed - DROP_MS;
          const idx = Math.min(steps - 1, Math.floor(e / ROW_MS));
          const frac = Math.min(1, (e - idx * ROW_MS) / ROW_MS);
          for (let i = 0; i < idx; i++) rightsDone += path[i];
          const fromX = ballX(idx, rightsDone);
          const toX = ballX(idx + 1, rightsDone + path[idx]);
          x = fromX + (toX - fromX) * easeInOut(frac);
          y = topY + idx * rowH + frac * frac * rowH;
          y -= Math.sin(frac * Math.PI) * (rowH * 0.16);
          squash = 1 + Math.sin(frac * Math.PI) * 0.1;

          if (frac < 0.08) {
            const c = Math.round((fromX - pinX(idx, 0)) / step);
            hits.set(`${idx}:${Math.max(0, Math.min(idx + 1, c))}`, now);
          }
        } else {
          phase = 'settle';
          for (let i = 0; i < steps; i++) rightsDone += path[i];
          const t = Math.min(1, (elapsed - DROP_MS - totalRowsMs) / SETTLE_MS);
          settleT = t;
          const landed = Math.max(0, Math.min(slots - 1, Math.round((rightsDone / Math.max(1, steps)) * (slots - 1))));
          const fromX = ballX(steps, rightsDone);
          const toX = left + landed * slotW + slotW / 2;
          x = fromX + (toX - fromX) * easeInOut(Math.min(1, t * 1.8));
          const bounce = Math.abs(Math.sin(t * Math.PI * 2.5)) * (1 - t) * (rowH * 0.5);
          y = bottomY + slotH * 0.4 - bounce + Math.max(0, (t - 0.55) / 0.45) * (slotH * 0.3);
        }
      }

      let rightsTotal = 0;
      if (path) for (let i = 0; i < steps; i++) rightsTotal += path[i];
      const landedSlot = path && steps
        ? Math.max(0, Math.min(slots - 1, Math.round((rightsTotal / steps) * (slots - 1))))
        : -1;
      const done = phase === 'settle';

      // ---- pinos ----
      for (let r = 0; r < rows; r++) {
        const count = r + 2;
        const py = topY + r * rowH;
        for (let c = 0; c < count; c++) {
          const px = pinX(r, c);
          const hitAt = hits.get(`${r}:${c}`);
          const flash = hitAt ? Math.max(0, 1 - (now - hitAt) / 380) : 0;
          ctx.beginPath();
          ctx.arc(px, py, pinR + flash * pinR * 0.4, 0, Math.PI * 2);
          ctx.fillStyle = flash > 0 ? hexA(accent, 0.6 + 0.4 * flash) : 'rgba(255,255,255,0.32)';
          ctx.fill();
        }
      }

      const ballAlpha = done ? Math.max(0, 1 - Math.max(0, (settleT - 0.5) / 0.3)) : 1;

      // ---- slots ----
      const gap = Math.max(3, slotW * 0.06);
      multipliers.forEach((m, i) => {
        const sx = left + i * slotW;
        const st = slotStyle(m, accent);
        const isWin = done && i === landedSlot;
        const pop = isWin ? Math.min(1, (elapsed - DROP_MS - totalRowsMs) / 320) : 0;
        const lift = isWin ? Math.sin(pop * Math.PI) * 8 : 0;
        const sy = bottomY + slotH * 0.15 - lift;

        ctx.globalAlpha = done && !isWin ? 0.3 : 1;
        ctx.fillStyle = isWin ? accent : st.bg;
        ctx.beginPath();
        ctx.roundRect(sx + gap / 2, sy, slotW - gap, slotH, Math.min(14, slotH * 0.24));
        ctx.fill();

        if (isWin) {
          ctx.strokeStyle = 'rgba(255,255,255,0.9)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(sx + gap / 2, sy, slotW - gap, slotH, Math.min(14, slotH * 0.24));
          ctx.stroke();
        }

        const fs = Math.max(12, Math.min(28, slotW * 0.34, slotH * 0.42));
        ctx.fillStyle = isWin ? '#06170c' : st.fg;
        ctx.font = `800 ${fs}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${m}x`, sx + slotW / 2, sy + slotH / 2 + 1);
        ctx.globalAlpha = 1;
      });

      // ---- bolinha ----
      if (path && steps > 0) {
        if (ballAlpha > 0.001) {
          ctx.save();
          ctx.globalAlpha = ballAlpha;

          trail.push({ x, y, t: now });
          while (trail.length && now - trail[0].t > 220) trail.shift();
          trail.forEach((p, i) => {
            const a = (i / trail.length) * 0.14;
            ctx.beginPath();
            ctx.arc(p.x, p.y, ballR * (0.5 + (i / trail.length) * 0.4), 0, Math.PI * 2);
            ctx.fillStyle = hexA(accent, a);
            ctx.fill();
          });

          ctx.translate(x, y);
          ctx.scale(1 / squash, squash * (0.6 + 0.4 * ballAlpha));
          ctx.beginPath();
          ctx.arc(0, 0, ballR, 0, Math.PI * 2);
          ctx.fillStyle = accent;
          ctx.fill();
          ctx.restore();
          ctx.globalAlpha = 1;
        }

        if (done && !finishedRef.current && elapsed - DROP_MS - totalRowsMs > SETTLE_MS) {
          finishedRef.current = true;
          finishRef.current?.();
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [rows, multipliers, path, accent]);

  return (
    <div ref={wrapRef} className="w-full h-full">
      <canvas ref={canvasRef} className="block" aria-label="Plinko" />
    </div>
  );
};

export default Plinko;
