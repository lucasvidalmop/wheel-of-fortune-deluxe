import { useEffect, useRef } from 'react';

interface Props {
  rows: number;
  multipliers: number[];
  /** Caminho da bolinha vindo do servidor: 0 = esquerda, 1 = direita */
  path: number[] | null;
  accent?: string;
  onFinish?: () => void;
}

const W = 720;
const H = 660;
const ROW_MS = 190;
const SETTLE_MS = 520;

const hexA = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(n.slice(0, 2), 16) || 0;
  const g = parseInt(n.slice(2, 4), 16) || 0;
  const b = parseInt(n.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${a})`;
};

const slotStyle = (m: number, accent: string) => {
  if (m <= 0) return { bg: 'rgba(255,255,255,0.07)', fg: 'rgba(255,255,255,0.45)' };
  if (m < 1) return { bg: hexA(accent, 0.22), fg: 'rgba(255,255,255,0.85)' };
  if (m < 3) return { bg: hexA(accent, 0.42), fg: '#04150a' };
  if (m < 8) return { bg: hexA(accent, 0.7), fg: '#04150a' };
  return { bg: accent, fg: '#04150a' };
};

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

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
    const topY = 74;
    const bottomY = H - 118;
    const rowH = (bottomY - topY) / rows;
    const spread = W * 0.8;
    const left = (W - spread) / 2;
    const slotW = spread / slots;
    const step = spread / rows;

    const xAt = (rights: number) => left + (rights / rows) * spread;

    finishedRef.current = false;
    const start = performance.now();
    // pino -> tempo do último toque (para o flash)
    const hits = new Map<string, number>();
    const trail: { x: number; y: number; t: number }[] = [];

    const draw = (now: number) => {
      ctx.clearRect(0, 0, W, H);

      const elapsed = now - start;
      const total = path?.length ?? 0;
      const idx = path ? Math.min(total, Math.floor(elapsed / ROW_MS)) : -1;
      const frac = path ? Math.min(1, (elapsed - idx * ROW_MS) / ROW_MS) : 0;

      let rights = 0;
      if (path) for (let i = 0; i < Math.min(idx, total); i++) rights += path[i];
      const landedSlot = path ? Math.round((rights / rows) * (slots - 1)) : -1;
      const done = path ? idx >= total : false;

      // pinos
      for (let r = 0; r < rows; r++) {
        const count = r + 2;
        const y = topY + r * rowH;
        for (let c = 0; c < count; c++) {
          const x = W / 2 + (c - (count - 1) / 2) * step;
          const hitAt = hits.get(`${r}:${c}`);
          const flash = hitAt ? Math.max(0, 1 - (now - hitAt) / 420) : 0;
          const rad = 3.4 + flash * 3.4;
          if (flash > 0) {
            ctx.beginPath();
            ctx.arc(x, y, rad + 7 * flash, 0, Math.PI * 2);
            ctx.fillStyle = hexA(accent, 0.18 * flash);
            ctx.fill();
          }
          ctx.beginPath();
          ctx.arc(x, y, rad, 0, Math.PI * 2);
          ctx.fillStyle = flash > 0
            ? `rgba(255,255,255,${0.35 + 0.6 * flash})`
            : 'rgba(255,255,255,0.24)';
          ctx.fill();
        }
      }

      // slots
      multipliers.forEach((m, i) => {
        const x = left + i * slotW;
        const st = slotStyle(m, accent);
        const isWin = done && i === landedSlot;
        const pop = isWin ? Math.min(1, (elapsed - total * ROW_MS) / 260) : 0;
        const lift = isWin ? Math.sin(Math.min(1, pop) * Math.PI) * 7 : 0;
        const y = bottomY + 26 - lift;

        if (isWin) {
          ctx.shadowColor = accent;
          ctx.shadowBlur = 26;
        }
        ctx.fillStyle = st.bg;
        ctx.beginPath();
        ctx.roundRect(x + 3, y, slotW - 6, 54, 12);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = st.fg;
        ctx.font = `bold ${slots > 12 ? 15 : 18}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${m}x`, x + slotW / 2, y + 27);
      });

      // bolinha
      if (path && path.length) {
        let x: number;
        let y: number;
        let squash = 1;

        if (!done) {
          const nextRights = rights + path[idx];
          const e = frac * frac; // acelera na queda (gravidade)
          x = xAt(rights) + (xAt(nextRights) - xAt(rights)) * easeOutCubic(frac);
          y = topY + idx * rowH + e * rowH;
          // pequena quicada logo após tocar o pino
          y -= Math.sin(frac * Math.PI) * 5;
          squash = 1 + Math.sin(frac * Math.PI) * 0.12;

          if (frac < 0.06) {
            const count = idx + 2;
            const c = Math.round((x - (W / 2 - ((count - 1) / 2) * step)) / step);
            hits.set(`${idx}:${Math.max(0, Math.min(count - 1, c))}`, now);
          }
        } else {
          const t = Math.min(1, (elapsed - total * ROW_MS) / SETTLE_MS);
          const bounce = Math.abs(Math.sin(t * Math.PI * 2)) * (1 - t) * 22;
          x = left + landedSlot * slotW + slotW / 2;
          y = bottomY + 30 - bounce;
        }

        trail.push({ x, y, t: now });
        while (trail.length && now - trail[0].t > 260) trail.shift();
        trail.forEach((p, i) => {
          const a = (i / trail.length) * 0.32;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4 + (i / trail.length) * 6, 0, Math.PI * 2);
          ctx.fillStyle = hexA(accent, a);
          ctx.fill();
        });

        const grad = ctx.createRadialGradient(x - 4, y - 5, 1, x, y, 13);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.45, accent);
        grad.addColorStop(1, hexA(accent, 0.85));

        ctx.save();
        ctx.translate(x, y);
        ctx.scale(1 / squash, squash);
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.shadowColor = accent;
        ctx.shadowBlur = 26;
        ctx.fill();
        ctx.restore();
        ctx.shadowBlur = 0;

        if (done && !finishedRef.current && elapsed - total * ROW_MS > SETTLE_MS) {
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
      className="w-full h-auto max-w-[720px] mx-auto block"
      aria-label="Plinko"
    />
  );
};

export default Plinko;
