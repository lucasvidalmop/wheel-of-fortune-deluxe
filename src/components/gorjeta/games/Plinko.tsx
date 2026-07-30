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
const H = 640;
const ROW_MS = 150;

const slotColor = (m: number, accent: string) => {
  if (m <= 0) return 'rgba(255,255,255,0.10)';
  if (m < 1) return 'rgba(255,255,255,0.22)';
  if (m < 3) return `${accent}66`;
  if (m < 8) return `${accent}aa`;
  return accent;
};

const Plinko = ({ rows, multipliers, path, accent = '#22c55e', onFinish }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>();
  const finishedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const slots = Math.max(2, multipliers.length);
    const topY = 60;
    const bottomY = H - 110;
    const rowH = (bottomY - topY) / rows;
    const spread = W * 0.78;
    const left = (W - spread) / 2;

    const xAt = (rights: number) => left + (rights / rows) * spread;

    finishedRef.current = false;
    const start = performance.now();

    const draw = (now: number) => {
      ctx.clearRect(0, 0, W, H);

      // pinos
      for (let r = 0; r < rows; r++) {
        const count = r + 2;
        const y = topY + r * rowH;
        for (let c = 0; c < count; c++) {
          const x = W / 2 + (c - (count - 1) / 2) * (spread / rows);
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.28)';
          ctx.fill();
        }
      }

      // slots
      const slotW = spread / slots;
      multipliers.forEach((m, i) => {
        const x = left + i * slotW;
        ctx.fillStyle = slotColor(m, accent);
        ctx.beginPath();
        ctx.roundRect(x + 3, bottomY + 18, slotW - 6, 52, 10);
        ctx.fill();
        ctx.fillStyle = m > 0 ? '#03130a' : 'rgba(255,255,255,0.55)';
        ctx.font = 'bold 18px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${m}x`, x + slotW / 2, bottomY + 44);
      });

      // bolinha
      if (path && path.length) {
        const elapsed = now - start;
        const totalRows = path.length;
        const idx = Math.min(totalRows, Math.floor(elapsed / ROW_MS));
        const frac = Math.min(1, (elapsed - idx * ROW_MS) / ROW_MS);

        let rights = 0;
        for (let i = 0; i < Math.min(idx, totalRows); i++) rights += path[i];
        const nextRights = idx < totalRows ? rights + path[idx] : rights;

        const x = idx < totalRows ? xAt(rights + (nextRights - rights) * frac) : xAt(rights);
        const yBase = topY + Math.min(idx, totalRows) * rowH;
        const y = idx < totalRows
          ? yBase + frac * rowH - Math.sin(frac * Math.PI) * 8
          : bottomY + 28;

        ctx.beginPath();
        ctx.arc(x, y, 11, 0, Math.PI * 2);
        ctx.fillStyle = accent;
        ctx.shadowColor = accent;
        ctx.shadowBlur = 22;
        ctx.fill();
        ctx.shadowBlur = 0;

        if (idx >= totalRows && !finishedRef.current) {
          finishedRef.current = true;
          onFinish?.();
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [rows, multipliers, path, accent, onFinish]);

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
