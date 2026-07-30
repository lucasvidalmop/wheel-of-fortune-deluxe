import { useEffect, useMemo, useRef } from 'react';

interface Props {
  rows: number;
  multipliers: number[];
  /** Caminho da bolinha vindo do servidor: 0 = esquerda, 1 = direita */
  path: number[] | null;
  accent?: string;
  onFinish?: () => void;
}

const DROP_MS = 720;
const ROW_MS = 360;
const SETTLE_MS = 760;

type TokenPalette = {
  board: string;
  boardBorder: string;
  pin: string;
  pinHit: string;
  slotStrong: string;
  slotMid: string;
  slotSoft: string;
  slotEmpty: string;
  textStrong: string;
  textMuted: string;
  ball: string;
};

const cssVar = (name: string, fallback: string) => `hsl(var(${name}, ${fallback}))`;
const cssVarAlpha = (name: string, alpha: number, fallback: string) => `hsl(var(${name}, ${fallback}) / ${alpha})`;

const palette: TokenPalette = {
  board: cssVar('--card', '240 8% 8%'),
  boardBorder: cssVarAlpha('--border', 0.7, '240 6% 20%'),
  pin: cssVarAlpha('--foreground', 0.32, '45 20% 90%'),
  pinHit: cssVar('--accent', '45 80% 55%'),
  slotStrong: cssVar('--primary', '45 100% 50%'),
  slotMid: cssVarAlpha('--accent', 0.56, '45 80% 55%'),
  slotSoft: cssVarAlpha('--accent', 0.28, '45 80% 55%'),
  slotEmpty: cssVarAlpha('--secondary', 0.52, '240 8% 14%'),
  textStrong: cssVar('--primary-foreground', '240 10% 4%'),
  textMuted: cssVarAlpha('--foreground', 0.58, '45 20% 90%'),
  ball: cssVar('--primary', '45 100% 50%'),
};

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

const slotTone = (m: number) => {
  if (m <= 0) return { bg: palette.slotEmpty, fg: palette.textMuted };
  if (m < 1) return { bg: palette.slotSoft, fg: palette.textMuted };
  if (m < 3) return { bg: palette.slotSoft, fg: palette.textMuted };
  if (m < 8) return { bg: palette.slotMid, fg: palette.textStrong };
  return { bg: palette.slotStrong, fg: palette.textStrong };
};

const roundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  const radius = Math.min(r, w / 2, h / 2);
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

const setCanvasSize = (canvas: HTMLCanvasElement, width: number, height: number) => {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
};

const Plinko = ({ rows, multipliers, path, onFinish }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef({ w: 960, h: 620 });
  const rafRef = useRef<number>();
  const finishedRef = useRef(false);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  const slots = Math.max(2, multipliers.length);
  const visibleRows = useMemo(() => Math.max(5, Math.min(rows, 10)), [rows]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const apply = () => {
      const rect = wrap.getBoundingClientRect();
      const width = Math.max(360, Math.round(rect.width));
      const targetHeight = Math.round(width * 0.62);
      const height = Math.max(340, Math.min(Math.round(rect.height || targetHeight), targetHeight));
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
    const animationRows = Math.max(1, steps);
    const totalRowsMs = animationRows * ROW_MS;

    const draw = (now: number) => {
      const { w: W, h: H } = sizeRef.current;
      ctx.clearRect(0, 0, W, H);
      const elapsed = now - start;

      const outerPad = Math.max(16, W * 0.035);
      const boardX = outerPad;
      const boardY = Math.max(10, H * 0.02);
      const boardW = W - outerPad * 2;
      const boardH = H - boardY * 2;
      const radius = Math.max(18, Math.min(26, boardW * 0.025));

      const slotGap = Math.max(7, boardW * 0.012);
      const slotW = (boardW - outerPad * 0.9 - slotGap * (slots - 1)) / slots;
      const slotH = Math.max(46, Math.min(66, slotW * 0.84));
      const slotX0 = boardX + (boardW - (slotW * slots + slotGap * (slots - 1))) / 2;
      const slotY = boardY + boardH - slotH - Math.max(18, boardH * 0.08);

      const pinTop = boardY + Math.max(28, boardH * 0.1);
      const pinBottom = slotY - Math.max(42, boardH * 0.09);
      const rowGap = (pinBottom - pinTop) / Math.max(1, visibleRows - 1);
      const pegStep = (slotW + slotGap) * 0.98;
      const pinR = Math.max(5, Math.min(8, slotW * 0.13));
      const ballR = Math.max(9, Math.min(15, slotW * 0.22));
      const centerX = boardX + boardW / 2;

      const slotCenter = (index: number) => slotX0 + index * (slotW + slotGap) + slotW / 2;
      const landedSlotFromPath = () => {
        if (!path || !steps) return -1;
        const rights = path.slice(0, steps).reduce((a, n) => a + n, 0);
        return Math.max(0, Math.min(slots - 1, Math.round((rights / Math.max(1, steps)) * (slots - 1))));
      };
      const targetSlot = landedSlotFromPath();

      const pathPoint = (stepIndex: number, rightsDone: number) => {
        if (!path || targetSlot < 0) return { x: centerX, y: pinTop };
        const t = stepIndex / Math.max(1, steps);
        const laneX = slotCenter(targetSlot);
        const wave = Math.sin(t * Math.PI * 2.2) * pegStep * 0.16;
        const blend = Math.pow(t, 1.25);
        const rawX = centerX + (laneX - centerX) * blend + wave + (rightsDone - stepIndex / 2) * pegStep * 0.05;
        const maxX = boardX + outerPad + ballR;
        const minX = boardX + boardW - outerPad - ballR;
        const y = pinTop + (pinBottom - pinTop) * t;
        return { x: Math.max(maxX, Math.min(minX, rawX)), y };
      };

      roundedRect(ctx, boardX + 0.5, boardY + 0.5, boardW - 1, boardH - 1, radius);
      ctx.fillStyle = palette.board;
      ctx.fill();
      ctx.strokeStyle = palette.boardBorder;
      ctx.lineWidth = 1;
      ctx.stroke();

      let phase: 'wait' | 'drop' | 'rows' | 'settle' = path && steps > 0 ? 'drop' : 'wait';
      let ballX = centerX;
      let ballY = boardY + boardH * 0.04;
      let rightsDone = 0;
      let settleT = 0;

      if (path && steps > 0) {
        const y0 = boardY + boardH * 0.035;
        if (elapsed < DROP_MS) {
          const t = Math.min(1, elapsed / DROP_MS);
          const eased = t * t;
          ballX = centerX;
          ballY = y0 + (pinTop - y0) * eased;
        } else if (elapsed < DROP_MS + totalRowsMs) {
          phase = 'rows';
          const e = elapsed - DROP_MS;
          const idx = Math.min(steps - 1, Math.floor((e / totalRowsMs) * steps));
          const rowStartMs = (idx / steps) * totalRowsMs;
          const rowDuration = totalRowsMs / steps;
          const frac = Math.min(1, (e - rowStartMs) / rowDuration);
          for (let i = 0; i < idx; i++) rightsDone += path[i];

          const from = pathPoint(idx, rightsDone);
          const to = pathPoint(idx + 1, rightsDone + path[idx]);
          const eased = easeInOut(frac);
          ballX = from.x + (to.x - from.x) * eased;
          ballY = from.y + (to.y - from.y) * eased - Math.sin(frac * Math.PI) * rowGap * 0.22;

          if (frac < 0.12) hits.set(`${Math.min(visibleRows - 1, Math.round((idx / Math.max(1, steps - 1)) * (visibleRows - 1)))}:${targetSlot}`, now);
        } else {
          phase = 'settle';
          settleT = Math.min(1, (elapsed - DROP_MS - totalRowsMs) / SETTLE_MS);
          const from = pathPoint(steps, path.slice(0, steps).reduce((a, n) => a + n, 0));
          const targetX = slotCenter(targetSlot);
          ballX = from.x + (targetX - from.x) * easeOut(Math.min(1, settleT * 1.35));
          const targetY = slotY + slotH * 0.5;
          const fall = easeOut(settleT);
          const bounce = Math.sin(settleT * Math.PI * 2) * (1 - settleT) * rowGap * 0.18;
          ballY = from.y + (targetY - from.y) * fall - bounce;
        }
      }

      for (let r = 0; r < visibleRows; r++) {
        const y = pinTop + r * rowGap;
        const count = Math.min(slots, r + 3);
        const startX = centerX - ((count - 1) * pegStep) / 2;
        for (let c = 0; c < count; c++) {
          const x = startX + c * pegStep;
          if (x < boardX + outerPad || x > boardX + boardW - outerPad) continue;
          const hitAt = hits.get(`${r}:${c}`) || hits.get(`${r}:${targetSlot}`);
          const flash = hitAt ? Math.max(0, 1 - (now - hitAt) / 340) : 0;
          ctx.beginPath();
          ctx.arc(x, y, pinR + flash * 2, 0, Math.PI * 2);
          ctx.fillStyle = flash > 0 ? palette.pinHit : palette.pin;
          ctx.fill();
        }
      }

      multipliers.forEach((m, i) => {
        const x = slotX0 + i * (slotW + slotGap);
        const tone = slotTone(m);
        const isWinner = phase === 'settle' && i === targetSlot;
        const pop = isWinner ? Math.sin(Math.min(1, settleT) * Math.PI) * 5 : 0;

        ctx.globalAlpha = phase === 'settle' && !isWinner ? 0.42 : 1;
        roundedRect(ctx, x, slotY - pop, slotW, slotH, Math.min(14, slotW * 0.24));
        ctx.fillStyle = isWinner ? palette.slotStrong : tone.bg;
        ctx.fill();

        if (isWinner) {
          ctx.strokeStyle = cssVarAlpha('--foreground', 0.72, '45 20% 90%');
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        const fontSize = Math.max(17, Math.min(24, slotW * 0.32));
        ctx.fillStyle = isWinner ? palette.textStrong : tone.fg;
        ctx.font = `800 ${fontSize}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${m}x`, x + slotW / 2, slotY + slotH / 2 - pop + 1);
        ctx.globalAlpha = 1;
      });

      if (path && steps > 0) {
        const ballAlpha = phase === 'settle' ? Math.max(0, 1 - Math.max(0, (settleT - 0.72) / 0.22)) : 1;
        if (ballAlpha > 0.001) {
          ctx.save();
          ctx.globalAlpha = ballAlpha;
          ctx.beginPath();
          ctx.arc(ballX, ballY, ballR, 0, Math.PI * 2);
          ctx.fillStyle = palette.ball;
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
  }, [rows, visibleRows, multipliers, slots, path]);

  return (
    <div ref={wrapRef} className="h-full min-h-[360px] w-full">
      <canvas ref={canvasRef} className="block h-full w-full" aria-label="Plinko" />
    </div>
  );
};

export default Plinko;