import { useEffect, useMemo, useRef } from 'react';

interface Props {
  rows: number;
  multipliers: number[];
  /** Caminho da bolinha vindo do servidor: 0 = esquerda, 1 = direita */
  path: number[] | null;
  accent?: string;
  onFinish?: () => void;
}

const DROP_MS = 620;
const ROW_MS = 300;
const SETTLE_MS = 700;

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

const roundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
};

/** Escala teal da referência: quanto maior o multiplicador, mais claro/vibrante. */
const slotColors = (m: number, max: number) => {
  if (m <= 0) return { top: '#26292d', bottom: '#1c1f22', text: '#8b9096', glow: 0 };
  const ratio = max > 0 ? Math.min(1, m / max) : 0;
  if (ratio >= 0.9) return { top: '#2ff0ec', bottom: '#16c9c5', text: '#04201f', glow: 22 };
  if (ratio >= 0.45) return { top: '#1cb5b1', bottom: '#128e8b', text: '#03211f', glow: 10 };
  if (ratio >= 0.18) return { top: '#12817e', bottom: '#0d6360', text: '#e9fbfa', glow: 0 };
  if (ratio >= 0.08) return { top: '#0f6a68', bottom: '#0b504e', text: '#dff6f5', glow: 0 };
  return { top: '#0c5250', bottom: '#093d3c', text: '#cfeceb', glow: 0 };
};

const setCanvasSize = (canvas: HTMLCanvasElement, width: number, height: number) => {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
};

const Plinko = ({ rows, multipliers, path, accent, onFinish }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef({ w: 1000, h: 600 });
  const rafRef = useRef<number>();
  const finishedRef = useRef(false);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  const slots = Math.max(3, multipliers.length);
  const maxMult = useMemo(() => Math.max(...multipliers, 1), [multipliers]);
  const pinRows = useMemo(() => Math.max(6, Math.min(14, slots + 1)), [slots]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const apply = () => {
      const rect = wrap.getBoundingClientRect();
      const width = Math.max(320, Math.round(rect.width));
      const height = Math.max(300, Math.round(rect.height || width * 0.6));
      sizeRef.current = { w: width, h: height };
      setCanvasSize(canvas, width, height);
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

    finishedRef.current = false;
    const start = performance.now();
    const hits = new Map<string, number>();
    const steps = path ? Math.min(path.length, rows) : 0;
    const totalRowsMs = Math.max(1, steps) * ROW_MS;
    const accentColor = accent || '#2ff0ec';

    const draw = (now: number) => {
      const { w: W, h: H } = sizeRef.current;
      const elapsed = now - start;
      ctx.clearRect(0, 0, W, H);

      // ---- fundo (fora da moldura) ----
      ctx.fillStyle = '#08090b';
      ctx.fillRect(0, 0, W, H);

      // ---- moldura do tabuleiro ----
      const pad = Math.max(10, W * 0.014);
      const bx = pad;
      const by = pad;
      const bw = W - pad * 2;
      const bh = H - pad * 2;
      const brad = Math.max(14, Math.min(26, bw * 0.02));

      const bg = ctx.createLinearGradient(0, by, 0, by + bh);
      bg.addColorStop(0, '#15181c');
      bg.addColorStop(0.55, '#101317');
      bg.addColorStop(1, '#0a0c0f');
      roundedRect(ctx, bx, by, bw, bh, brad);
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // ---- geometria dos slots ----
      const innerPad = Math.max(12, bw * 0.02);
      const slotGap = Math.max(6, bw * 0.006);
      const slotW = (bw - innerPad * 2 - slotGap * (slots - 1)) / slots;
      const slotH = Math.max(38, Math.min(74, slotW * 0.85));
      const slotX0 = bx + innerPad;
      const slotBottom = by + bh - Math.max(8, bh * 0.02);
      const slotY = slotBottom - slotH;
      const slotCenter = (i: number) => slotX0 + i * (slotW + slotGap) + slotW / 2;

      // ---- geometria dos pinos (pirâmide) ----
      const pitch = (slotW + slotGap) * 0.98;
      const pinTop = by + Math.max(34, bh * 0.11);
      const pinBottom = slotY - Math.max(26, bh * 0.06);
      const rowGap = (pinBottom - pinTop) / Math.max(1, pinRows - 1);
      const pinR = Math.max(4, Math.min(9, pitch * 0.085));
      const ballR = Math.max(7, Math.min(14, pitch * 0.16));
      const cx = bx + bw / 2;

      // ---- tubo de lançamento no topo ----
      const tubeW = pitch * 0.95;
      const tubeH = Math.max(24, bh * 0.075);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx - tubeW / 2, by - tubeH * 0.4);
      ctx.lineTo(cx - tubeW / 2, by + tubeH * 0.25);
      ctx.quadraticCurveTo(cx, by + tubeH * 1.05, cx + tubeW / 2, by + tubeH * 0.25);
      ctx.lineTo(cx + tubeW / 2, by - tubeH * 0.4);
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2;
      ctx.shadowColor = accentColor;
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.restore();

      // ---- posição da bola ----
      const landedSlot = (() => {
        if (!path || !steps) return -1;
        const rights = path.slice(0, steps).reduce((a, n) => a + n, 0);
        return Math.max(0, Math.min(slots - 1, Math.round((rights / Math.max(1, steps)) * (slots - 1))));
      })();

      const pathPoint = (stepIndex: number) => {
        const t = Math.min(1, stepIndex / Math.max(1, steps));
        const laneX = landedSlot >= 0 ? slotCenter(landedSlot) : cx;
        const wave = Math.sin(t * Math.PI * 3.1) * pitch * 0.22 * (1 - t);
        const x = cx + (laneX - cx) * Math.pow(t, 1.3) + wave;
        const y = pinTop + (pinBottom - pinTop) * t;
        const minX = bx + innerPad + ballR;
        const maxX = bx + bw - innerPad - ballR;
        return { x: Math.max(minX, Math.min(maxX, x)), y };
      };

      let phase: 'wait' | 'drop' | 'rows' | 'settle' = 'wait';
      let ballX = cx;
      let ballY = by + tubeH * 0.6;
      let settleT = 0;

      if (path && steps > 0) {
        const y0 = by + tubeH * 0.6;
        if (elapsed < DROP_MS) {
          phase = 'drop';
          const t = Math.min(1, elapsed / DROP_MS);
          ballY = y0 + (pinTop - y0) * (t * t);
        } else if (elapsed < DROP_MS + totalRowsMs) {
          phase = 'rows';
          const e = elapsed - DROP_MS;
          const idx = Math.min(steps - 1, Math.floor((e / totalRowsMs) * steps));
          const frac = Math.min(1, (e - (idx / steps) * totalRowsMs) / (totalRowsMs / steps));
          const from = pathPoint(idx);
          const to = pathPoint(idx + 1);
          const eased = easeInOut(frac);
          ballX = from.x + (to.x - from.x) * eased;
          ballY = from.y + (to.y - from.y) * eased - Math.sin(frac * Math.PI) * rowGap * 0.25;
          if (frac < 0.15) {
            const rowIdx = Math.min(pinRows - 1, Math.round((idx / Math.max(1, steps)) * (pinRows - 1)));
            hits.set(`${rowIdx}:${Math.round(ballX)}`, now);
          }
        } else {
          phase = 'settle';
          settleT = Math.min(1, (elapsed - DROP_MS - totalRowsMs) / SETTLE_MS);
          const from = pathPoint(steps);
          const targetX = slotCenter(Math.max(0, landedSlot));
          ballX = from.x + (targetX - from.x) * easeOut(Math.min(1, settleT * 1.4));
          ballY = from.y + (slotY + slotH * 0.45 - from.y) * easeOut(settleT);
        }
      }

      // ---- pinos ----
      for (let r = 0; r < pinRows; r++) {
        const count = r + 1;
        const y = pinTop + r * rowGap;
        const startX = cx - ((count - 1) * pitch) / 2;
        for (let c = 0; c < count; c++) {
          const x = startX + c * pitch;
          if (x < bx + innerPad * 0.6 || x > bx + bw - innerPad * 0.6) continue;

          let flash = 0;
          hits.forEach((tHit, key) => {
            const [kr, kx] = key.split(':');
            if (Number(kr) === r && Math.abs(Number(kx) - x) < pitch * 0.5) {
              flash = Math.max(flash, Math.max(0, 1 - (now - tHit) / 300));
            }
          });

          const g = ctx.createRadialGradient(x - pinR * 0.35, y - pinR * 0.45, pinR * 0.15, x, y, pinR);
          g.addColorStop(0, '#8b9198');
          g.addColorStop(0.55, '#585e65');
          g.addColorStop(1, '#2c3036');
          ctx.beginPath();
          ctx.arc(x, y, pinR, 0, Math.PI * 2);
          ctx.fillStyle = g;
          ctx.fill();

          if (flash > 0) {
            ctx.save();
            ctx.globalAlpha = flash;
            ctx.beginPath();
            ctx.arc(x, y, pinR * 1.5, 0, Math.PI * 2);
            ctx.fillStyle = accentColor;
            ctx.shadowColor = accentColor;
            ctx.shadowBlur = 12;
            ctx.fill();
            ctx.restore();
          }
        }
      }

      // ---- postes divisores entre slots ----
      const postW = Math.max(4, slotW * 0.075);
      const postH = slotH * 1.16;
      for (let i = 0; i <= slots; i++) {
        const px = i === 0
          ? slotX0 - postW * 0.6
          : slotX0 + i * (slotW + slotGap) - slotGap / 2 - postW / 2;
        const pg = ctx.createLinearGradient(px, slotY - (postH - slotH), px + postW, slotY);
        pg.addColorStop(0, '#5c6167');
        pg.addColorStop(0.5, '#3a3f45');
        pg.addColorStop(1, '#22262b');
        roundedRect(ctx, px, slotBottom - postH, postW, postH, postW / 2);
        ctx.fillStyle = pg;
        ctx.fill();
      }

      // ---- slots ----
      multipliers.forEach((m, i) => {
        const x = slotX0 + i * (slotW + slotGap);
        const isWinner = phase === 'settle' && i === landedSlot;
        const c = slotColors(m, maxMult);
        const pop = isWinner ? Math.sin(Math.min(1, settleT) * Math.PI) * slotH * 0.1 : 0;
        const y = slotY - pop;

        ctx.save();
        if (c.glow > 0 || isWinner) {
          ctx.shadowColor = isWinner ? accentColor : c.top;
          ctx.shadowBlur = isWinner ? 30 : c.glow;
        }
        const g = ctx.createLinearGradient(0, y, 0, y + slotH);
        g.addColorStop(0, isWinner ? '#5cfffb' : c.top);
        g.addColorStop(1, isWinner ? '#1ad6d2' : c.bottom);
        roundedRect(ctx, x, y, slotW, slotH, Math.max(5, slotW * 0.11));
        ctx.fillStyle = g;
        ctx.globalAlpha = phase === 'settle' && !isWinner ? 0.55 : 1;
        ctx.fill();
        ctx.restore();

        const fontSize = Math.max(12, Math.min(24, slotW * 0.3));
        ctx.globalAlpha = phase === 'settle' && !isWinner ? 0.6 : 1;
        ctx.fillStyle = isWinner ? '#04201f' : c.text;
        ctx.font = `800 ${fontSize}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${m}x`, x + slotW / 2, y + slotH / 2 + 1);
        ctx.globalAlpha = 1;
      });

      // ---- bola ----
      if (path && steps > 0) {
        const alpha = phase === 'settle' ? Math.max(0, 1 - Math.max(0, (settleT - 0.75) / 0.2)) : 1;
        if (alpha > 0.001) {
          ctx.save();
          ctx.globalAlpha = alpha;
          const bgr = ctx.createRadialGradient(ballX - ballR * 0.35, ballY - ballR * 0.4, ballR * 0.15, ballX, ballY, ballR);
          bgr.addColorStop(0, '#ffffff');
          bgr.addColorStop(0.4, accentColor);
          bgr.addColorStop(1, accentColor);
          ctx.beginPath();
          ctx.arc(ballX, ballY, ballR, 0, Math.PI * 2);
          ctx.fillStyle = bgr;
          ctx.shadowColor = accentColor;
          ctx.shadowBlur = 18;
          ctx.fill();
          ctx.restore();
        }
        if (phase === 'settle' && !finishedRef.current && settleT >= 1) {
          finishedRef.current = true;
          finishRef.current?.();
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [rows, pinRows, multipliers, slots, maxMult, path, accent]);

  return (
    <div ref={wrapRef} className="h-full min-h-[320px] w-full">
      <canvas ref={canvasRef} className="block h-full w-full" aria-label="Plinko" />
    </div>
  );
};

export default Plinko;
