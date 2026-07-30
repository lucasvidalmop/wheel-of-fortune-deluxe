import { useEffect, useRef } from 'react';

interface Props {
  rows: number;
  multipliers: number[];
  /** Caminho da bolinha vindo do servidor: 0 = esquerda, 1 = direita */
  path: number[] | null;
  accent?: string;
  onFinish?: () => void;
}

const W = 1120;
const H = 700;
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

const slotStyle = (m: number, accent: string) => {
  if (m <= 0) return { bg: 'rgba(255,255,255,0.06)', fg: 'rgba(255,255,255,0.4)' };
  if (m < 1) return { bg: hexA(accent, 0.16), fg: 'rgba(255,255,255,0.8)' };
  if (m < 3) return { bg: hexA(accent, 0.34), fg: 'rgba(255,255,255,0.92)' };
  if (m < 8) return { bg: hexA(accent, 0.6), fg: '#06170c' };
  return { bg: accent, fg: '#06170c' };
};


const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

const Plinko = ({ rows, multipliers, path, accent = '#22c55e', onFinish }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>();
  const finishedRef = useRef(false);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const slots = Math.max(2, multipliers.length);
    const topY = 96;
    const bottomY = H - 134;
    const rowH = (bottomY - topY) / Math.max(1, rows);
    const spread = W * 0.9;
    const left = (W - spread) / 2;
    const slotW = spread / slots;
    // espaçamento entre pinos: a última fileira tem rows+1 pinos e deve caber no spread
    const step = spread / (rows + 1);

    /** centro X da bolinha depois de `k` fileiras, tendo ido `r` vezes à direita */
    const ballX = (k: number, r: number) => W / 2 + (2 * r - k) * (step / 2);
    /** X do pino c da fileira row (row tem row+2 pinos) */
    const pinX = (row: number, c: number) => W / 2 + (c - (row + 1) / 2) * step;

    finishedRef.current = false;
    const start = performance.now();
    const hits = new Map<string, number>();
    const trail: { x: number; y: number; t: number }[] = [];

    const steps = path ? Math.min(path.length, rows) : 0;
    const totalRowsMs = steps * ROW_MS;

    const draw = (now: number) => {
      ctx.clearRect(0, 0, W, H);
      const elapsed = now - start;

      // ---- fundo do tabuleiro (limpo, sem brilhos) ----
      ctx.beginPath();
      ctx.roundRect(8, 8, W - 16, H - 16, 24);
      ctx.fillStyle = '#0b0f16';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1;
      ctx.stroke();



      // ---- posição lógica da bolinha ----
      let phase: 'drop' | 'rows' | 'settle' = 'drop';
      let x = W / 2;
      let y = 24;
      let squash = 1;
      let rightsDone = 0;
      let settleT = 0;

      if (path && steps > 0) {
        if (elapsed < DROP_MS) {
          const t = Math.min(1, elapsed / DROP_MS);
          y = 24 + (topY - 24) * (t * t);
          x = W / 2;
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
          y -= Math.sin(frac * Math.PI) * 6;
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
          const bounce = Math.abs(Math.sin(t * Math.PI * 2.5)) * (1 - t) * 30;
          // a bolinha desce para dentro do slot e desaparece
          y = bottomY + 34 - bounce + Math.max(0, (t - 0.55) / 0.45) * 18;
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
          ctx.arc(px, py, 5, 0, Math.PI * 2);
          ctx.fillStyle = flash > 0
            ? hexA(accent, 0.55 + 0.45 * flash)
            : 'rgba(255,255,255,0.35)';
          ctx.fill();
        }
      }

      // fade da bolinha: ela some ao entrar no slot
      const ballAlpha = done ? Math.max(0, 1 - Math.max(0, (settleT - 0.5) / 0.3)) : 1;

      // ---- slots ----
      const SLOT_H = 66;
      multipliers.forEach((m, i) => {
        const sx = left + i * slotW;
        const st = slotStyle(m, accent);
        const isWin = done && i === landedSlot;
        const pop = isWin ? Math.min(1, (elapsed - DROP_MS - totalRowsMs) / 320) : 0;
        const lift = isWin ? Math.sin(pop * Math.PI) * 8 : 0;
        const sy = bottomY + 40 - lift;

        ctx.globalAlpha = done && !isWin ? 0.3 : 1;

        ctx.fillStyle = isWin ? accent : st.bg;
        ctx.beginPath();
        ctx.roundRect(sx + 4, sy, slotW - 8, SLOT_H, 12);
        ctx.fill();

        if (isWin) {
          ctx.strokeStyle = 'rgba(255,255,255,0.9)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(sx + 4, sy, slotW - 8, SLOT_H, 12);
          ctx.stroke();
        }

        ctx.fillStyle = isWin ? '#06170c' : st.fg;
        ctx.font = `800 ${slots > 12 ? 18 : 23}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${m}x`, sx + slotW / 2, sy + SLOT_H / 2 + 1);
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
            ctx.arc(p.x, p.y, 5 + (i / trail.length) * 6, 0, Math.PI * 2);
            ctx.fillStyle = hexA(accent, a);
            ctx.fill();
          });

          ctx.translate(x, y);
          ctx.scale(1 / squash, squash * (0.6 + 0.4 * ballAlpha));
          ctx.beginPath();
          ctx.arc(0, 0, 15, 0, Math.PI * 2);
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
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      className="block w-full h-full object-contain"
      aria-label="Plinko"
    />
  );

};

export default Plinko;
