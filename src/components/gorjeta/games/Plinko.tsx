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
const EQUILATERAL_ROW_RATIO = Math.sqrt(3) / 2;

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const sumRights = (path: number[], limit = path.length) => (
  path.slice(0, Math.max(0, Math.min(limit, path.length))).reduce((acc, n) => acc + (n ? 1 : 0), 0)
);

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
  const pinRows = useMemo(() => Math.max(4, Math.min(16, rows || slots - 1)), [rows, slots]);

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

      // ---- geometria profissional do tabuleiro ----
      // A malha é triangular de verdade: a distância horizontal entre pinos
      // e a distância diagonal usam a proporção de triângulo equilátero.
      const pad = Math.max(10, Math.min(18, Math.min(W, H) * 0.018));
      const availableW = W - pad * 2;
      const availableH = H - pad * 2;
      const rowCount = Math.max(4, pinRows);
      const slotWidthUnits = 0.72;
      const sideGutterUnits = 0.74;
      const topClearanceRows = 1.08;
      const slotClearanceRows = 0.86;
      const slotHeightUnits = 0.34;
      const bottomUnits = 0.22;
      const widthUnits = (slots - 1) + slotWidthUnits + sideGutterUnits * 2;
      const heightUnits = (topClearanceRows + rowCount - 1 + slotClearanceRows) * EQUILATERAL_ROW_RATIO
        + slotHeightUnits
        + bottomUnits;
      const pitch = Math.max(24, Math.min(availableW / widthUnits, availableH / heightUnits));
      const rowGap = pitch * EQUILATERAL_ROW_RATIO;
      const slotW = pitch * slotWidthUnits;
      const slotGap = pitch - slotW;
      const slotH = pitch * slotHeightUnits;
      const bw = widthUnits * pitch;
      const bh = heightUnits * pitch;
      const bx = (W - bw) / 2;
      const by = (H - bh) / 2;
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

      // ---- geometria dos slots e pinos ----
      const cx = bx + bw / 2;
      const slotBottom = by + bh - bottomUnits * pitch;
      const slotY = slotBottom - slotH;
      const firstSlotCenter = cx - ((slots - 1) * pitch) / 2;
      const slotCenter = (i: number) => firstSlotCenter + i * pitch;
      const pinTop = by + topClearanceRows * rowGap;
      const pinR = Math.max(3.6, Math.min(7.2, pitch * 0.072));
      const ballR = Math.max(6, Math.min(12, pitch * 0.14));

      // ---- tubo de lançamento no topo ----
      const tubeW = pitch * 0.92;
      const tubeH = rowGap * 0.72;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx - tubeW / 2, by + pitch * 0.08);
      ctx.lineTo(cx - tubeW / 2, by + tubeH * 0.66);
      ctx.quadraticCurveTo(cx, by + tubeH * 1.32, cx + tubeW / 2, by + tubeH * 0.66);
      ctx.lineTo(cx + tubeW / 2, by + pitch * 0.08);
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2;
      ctx.shadowColor = accentColor;
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.restore();

      // ---- posição da bola ----
      const landedSlot = (() => {
        if (!path || !steps) return -1;
        const rights = sumRights(path, steps);
        const directSlot = steps === slots - 1
          ? rights
          : Math.round((rights / Math.max(1, steps)) * (slots - 1));
        return Math.max(0, Math.min(slots - 1, directSlot));
      })();

      const pathPoint = (stepIndex: number) => {
        const step = Math.max(0, Math.min(stepIndex, steps));
        const rights = path ? sumRights(path, step) : 0;
        const x = cx + (rights - step / 2) * pitch;
        const y = pinTop + step * rowGap;
        const minX = bx + sideGutterUnits * pitch * 0.45 + ballR;
        const maxX = bx + bw - sideGutterUnits * pitch * 0.45 - ballR;
        return { x: Math.max(minX, Math.min(maxX, x)), y };
      };

      let phase: 'wait' | 'drop' | 'rows' | 'settle' = 'wait';
      let ballX = cx;
      let ballY = by + tubeH * 0.6;
      let settleT = 0;

      if (path && steps > 0) {
        const y0 = by + tubeH * 0.68;
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
          ballY = from.y + (to.y - from.y) * eased - Math.sin(frac * Math.PI) * rowGap * 0.16;
          if (frac < 0.15) {
            const rowIdx = Math.min(pinRows - 1, idx);
            const rightsBefore = sumRights(path, idx);
            hits.set(`${rowIdx}:${rightsBefore}`, now);
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
            const [kr, kc] = key.split(':');
            if (Number(kr) === r && Number(kc) === c) {
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
      const postW = Math.max(2.5, slotW * 0.035);
      const postH = slotH * 1.18;
      for (let i = 0; i <= slots; i++) {
        const px = firstSlotCenter - pitch / 2 + i * pitch - postW / 2;
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
        const x = slotCenter(i) - slotW / 2;
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
        roundedRect(ctx, x, y, slotW, slotH, Math.max(4, Math.min(8, slotW * 0.06)));
        ctx.fillStyle = g;
        ctx.globalAlpha = phase === 'settle' && !isWinner ? 0.55 : 1;
        ctx.fill();
        ctx.restore();

        const fontSize = Math.max(10, Math.min(17, slotW * 0.2));
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
