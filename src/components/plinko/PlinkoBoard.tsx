import { useEffect, useRef } from 'react';

export interface PlinkoBall {
  id: string;
  label: string;
}

export interface PlinkoLanding {
  id: string;
  slotIndex: number;
  multiplier: number;
}

interface PlinkoBoardProps {
  rows: number;
  multipliers: number[];
  accent: string;
  /** Increment this value to trigger a new drop */
  dropToken: number;
  balls?: PlinkoBall[];
  onLanded?: (landing: PlinkoLanding) => void;
  onAllLanded?: (landings: PlinkoLanding[]) => void;
}

const GRAVITY = 0.00075;
const BOUNCE = 0.42;
const X_STIFF = 0.22;
const STAGGER_MS = 260;
const TRAIL = 14;

interface BallState {
  id: string;
  label: string;
  dirs: number[];
  slotIndex: number;
  x: number;
  targetX: number;
  y: number;
  vy: number;
  row: number;
  startAt: number;
  landed: boolean;
  landedAt: number;
  squash: number;
  trail: { x: number; y: number }[];
  hue: number;

}

interface Spark {
  x: number; y: number; vx: number; vy: number; life: number; size: number;
}

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(full.slice(0, 6) || 'ffcc33', 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const PlinkoBoard = ({
  rows, multipliers, accent, dropToken, balls = [], onLanded, onAllLanded,
}: PlinkoBoardProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const ballsRef = useRef<BallState[]>([]);
  const sparksRef = useRef<Spark[]>([]);
  const pegFlashRef = useRef<Map<string, number>>(new Map());
  const slotFlashRef = useRef<Map<number, number>>(new Map());
  const landingsRef = useRef<PlinkoLanding[]>([]);
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);

  const slots = multipliers.length;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const [ar, ag, ab] = hexToRgb(accent);
    const A = (a: number) => `rgba(${ar},${ag},${ab},${a})`;

    let W = 0, H = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = wrap.clientWidth;
      H = wrap.clientHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const padX = 0.055;
    const topPad = 0.1;
    const binH = 0.11;
    const rowY = (r: number) => topPad + ((r + 1) / (rows + 1.6)) * (1 - topPad - binH);
    const floorY = 1 - binH - 0.012;
    const nx = (x: number) => (padX + x * (1 - padX * 2)) * W;
    const ny = (y: number) => y * H;

    const maxMult = Math.max(...multipliers, 1);
    const minMult = Math.min(...multipliers, 0);

    const pegList: { r: number; x: number }[] = [];
    for (let r = 0; r < rows; r++) {
      const count = r + 2;
      for (let j = 0; j < count; j++) {
        pegList.push({ r, x: 0.5 + (j - (count - 1) / 2) / slots });
      }
    }

    const spawnSparks = (px: number, py: number, count: number, power: number) => {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = (0.4 + Math.random()) * power;
        sparksRef.current.push({
          x: px, y: py,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s - power * 0.6,
          life: 1,
          size: 1 + Math.random() * 2.2,
        });
      }
    };

    const step = (t: number) => {
      let active = false;

      for (const b of ballsRef.current) {
        if (t < b.startAt) { active = true; continue; }
        if (b.landed) continue;
        active = true;

        b.vy += GRAVITY;
        b.y += b.vy;
        b.squash *= 0.86;

        const nextRow = b.row + 1;
        if (nextRow < rows && b.y >= rowY(nextRow)) {
          b.row = nextRow;
          b.y = rowY(nextRow);
          b.vy = -b.vy * BOUNCE;
          b.squash = 1;
          b.targetX = b.x + (b.dirs[nextRow] * 0.5) / slots;
          // flash nearest peg on this row
          const count = nextRow + 2;
          let best = 0, bestD = Infinity;
          for (let j = 0; j < count; j++) {
            const px = 0.5 + (j - (count - 1) / 2) / slots;
            const d = Math.abs(px - b.x);
            if (d < bestD) { bestD = d; best = j; }
          }
          pegFlashRef.current.set(`${nextRow}-${best}`, t);
          spawnSparks(nx(0.5 + (best - (count - 1) / 2) / slots), ny(rowY(nextRow)), 4, 0.9);
        }

        if (b.row >= rows - 1) b.targetX = (b.slotIndex + 0.5) / slots;
        b.x += (b.targetX - b.x) * X_STIFF;

        if (b.y >= floorY) {
          b.y = floorY;
          if (Math.abs(b.vy) > 0.006) {
            b.vy = -b.vy * BOUNCE;
            b.squash = 1;
          } else {
            b.vy = 0;
            b.landed = true;
            slotFlashRef.current.set(b.slotIndex, t);
            spawnSparks(nx(b.x), ny(b.y), 26, 2.4);
            const landing = { id: b.id, slotIndex: b.slotIndex, multiplier: multipliers[b.slotIndex] };
            landingsRef.current.push(landing);
            onLanded?.(landing);
            if (landingsRef.current.length === ballsRef.current.length) {
              onAllLanded?.([...landingsRef.current]);
            }
          }
        }

        b.trail.push({ x: b.x, y: b.y });
        if (b.trail.length > TRAIL) b.trail.shift();
      }

      // sparks
      sparksRef.current = sparksRef.current.filter(s => s.life > 0);
      for (const s of sparksRef.current) {
        s.vy += 0.12;
        s.x += s.vx;
        s.y += s.vy;
        s.life -= 0.035;
      }
      if (sparksRef.current.length > 0) active = true;

      return active;
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, W, H);

      // board glow from top
      const g = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, H * 0.9);
      g.addColorStop(0, A(0.1));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // funnel walls
      ctx.strokeStyle = A(0.16);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(nx(0.5) - 26, ny(topPad * 0.35));
      ctx.lineTo(nx(0.02), ny(1 - binH));
      ctx.moveTo(nx(0.5) + 26, ny(topPad * 0.35));
      ctx.lineTo(nx(0.98), ny(1 - binH));
      ctx.stroke();

      // pegs
      for (const p of pegList) {
        const px = nx(p.x);
        const py = ny(rowY(p.r));
        const count = p.r + 2;
        let j = Math.round((p.x - 0.5) * slots + (count - 1) / 2);
        const flash = pegFlashRef.current.get(`${p.r}-${j}`);
        const heat = flash ? Math.max(0, 1 - (t - flash) / 420) : 0;

        if (heat > 0) {
          const pg = ctx.createRadialGradient(px, py, 0, px, py, 16);
          pg.addColorStop(0, A(0.55 * heat));
          pg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = pg;
          ctx.beginPath();
          ctx.arc(px, py, 16, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(px, py, 3.4 + heat * 1.6, 0, Math.PI * 2);
        ctx.fillStyle = heat > 0 ? A(0.95) : 'rgba(255,255,255,0.42)';
        ctx.fill();
      }

      // bins
      const binTop = ny(1 - binH);
      const binHeightPx = H * binH - 4;
      const binW = (W - 2) / slots;
      for (let i = 0; i < slots; i++) {
        const m = multipliers[i];
        const heatScale = maxMult === minMult ? 1 : (m - minMult) / (maxMult - minMult);
        const flash = slotFlashRef.current.get(i);
        const lit = flash ? Math.max(0, 1 - (t - flash) / 900) : 0;
        const x = 1 + i * binW;
        const y = binTop + 2 - lit * 4;
        const r = 6;
        const h = binHeightPx;
        const w = binW - 3;

        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();

        const bg = ctx.createLinearGradient(x, y, x, y + h);
        bg.addColorStop(0, A(0.1 + heatScale * 0.35 + lit * 0.5));
        bg.addColorStop(1, A(0.04 + heatScale * 0.14 + lit * 0.3));
        ctx.fillStyle = bg;
        ctx.fill();
        ctx.strokeStyle = A(0.25 + heatScale * 0.4 + lit * 0.5);
        ctx.lineWidth = 1;
        ctx.stroke();

        if (lit > 0) {
          ctx.save();
          ctx.shadowColor = A(0.9 * lit);
          ctx.shadowBlur = 24 * lit;
          ctx.stroke();
          ctx.restore();
        }

        ctx.fillStyle = lit > 0.5 ? '#ffffff' : A(0.85);
        ctx.font = `800 ${Math.max(9, Math.min(14, binW * 0.42))}px Barlow, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${m}x`, x + w / 2, y + h / 2);
      }

      // sparks
      for (const s of sparksRef.current) {
        ctx.globalAlpha = Math.max(0, s.life);
        ctx.fillStyle = A(0.9);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // balls
      const showLabels = ballsRef.current.length <= 4;
      for (const b of ballsRef.current) {
        if (t < b.startAt) continue;
        const px = nx(b.x);
        const py = ny(b.y);

        // trail
        for (let i = 0; i < b.trail.length; i++) {
          const p = b.trail[i];
          const a = (i / b.trail.length) * 0.32;
          ctx.globalAlpha = a;
          ctx.fillStyle = A(0.9);
          ctx.beginPath();
          ctx.arc(nx(p.x), ny(p.y), 3 + (i / b.trail.length) * 5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;

        const R = 9;
        const glow = ctx.createRadialGradient(px, py, 0, px, py, R * 3.4);
        glow.addColorStop(0, A(0.5));
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(px, py, R * 3.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.translate(px, py);
        ctx.scale(1 + b.squash * 0.24, 1 - b.squash * 0.28);
        const bg = ctx.createRadialGradient(-R * 0.35, -R * 0.4, 0, 0, 0, R);
        bg.addColorStop(0, '#ffffff');
        bg.addColorStop(0.45, A(1));
        bg.addColorStop(1, A(0.7));
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.arc(0, 0, R, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (showLabels && !b.landed) {
          const label = b.label.length > 14 ? `${b.label.slice(0, 13)}…` : b.label;
          ctx.font = '800 10px Barlow, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const w = ctx.measureText(label).width + 12;
          const ly = Math.max(10, py - R - 12);
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.beginPath();
          ctx.roundRect(px - w / 2, ly - 8, w, 16, 8);
          ctx.fill();
          ctx.fillStyle = A(1);
          ctx.fillText(label.toUpperCase(), px, ly);
        }
      }
    };

    const loop = () => {
      const t = performance.now();
      const active = step(t);
      draw(t);
      if (active || t - lastLandRef.current < 1200) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        runningRef.current = false;
        rafRef.current = null;
      }
    };

    const lastLandRef = { current: performance.now() };

    // start / restart the run
    if (dropToken > 0 && balls.length > 0) {
      const now = performance.now();
      landingsRef.current = [];
      sparksRef.current = [];
      pegFlashRef.current = new Map();
      slotFlashRef.current = new Map();
      lastLandRef.current = now + balls.length * STAGGER_MS + 4000;

      ballsRef.current = balls.map((b, i) => {
        const dirs = Array.from({ length: rows }, () => (Math.random() < 0.5 ? -1 : 1));
        const sum = dirs.reduce((a, c) => a + c, 0);
        const slotIndex = Math.min(slots - 1, Math.max(0, Math.round((rows + sum) / 2)));
        return {
          id: b.id,
          label: b.label,
          dirs,
          slotIndex,
          x: 0.5 + (Math.random() - 0.5) * 0.012,
          targetX: 0.5,
          y: 0.02,
          vy: 0,
          row: -1,
          startAt: now + i * STAGGER_MS,
          landed: false,
          squash: 0,
          trail: [],
          hue: 0,
        };
      });
    }

    runningRef.current = true;
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      ro.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      runningRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropToken, rows, slots, accent, multipliers.join(',')]);

  return (
    <div
      ref={wrapRef}
      className="relative w-full rounded-2xl overflow-hidden border"
      style={{
        aspectRatio: '1 / 1',
        borderColor: `${accent}25`,
        background: 'linear-gradient(180deg, hsl(var(--card)), rgba(0,0,0,0.45))',
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
};

export default PlinkoBoard;
