import { useEffect, useMemo, useRef, useState } from 'react';

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
  /** Balls to drop on the current token */
  balls?: PlinkoBall[];
  onLanded?: (landing: PlinkoLanding) => void;
  onAllLanded?: (landings: PlinkoLanding[]) => void;
}

// physics constants (normalized units, per frame at 60fps)
const GRAVITY = 0.00075;
const BOUNCE = 0.42;
const X_STIFF = 0.22;
const STAGGER_MS = 320;

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
  restY: number;
  squash: number;
}

const PlinkoBoard = ({
  rows, multipliers, accent, dropToken, balls = [], onLanded, onAllLanded,
}: PlinkoBoardProps) => {
  const slots = multipliers.length;
  const [, force] = useState(0);
  const ballsRef = useRef<BallState[]>([]);
  const rafRef = useRef<number | null>(null);
  const litRef = useRef<Map<number, number>>(new Map());
  const landingsRef = useRef<PlinkoLanding[]>([]);

  const pegs = useMemo(() => {
    const out: { row: number; x: number }[] = [];
    for (let r = 0; r < rows; r++) {
      const count = r + 2;
      for (let j = 0; j < count; j++) {
        out.push({ row: r, x: 0.5 + (j - (count - 1) / 2) / slots });
      }
    }
    return out;
  }, [rows, slots]);

  const rowY = (row: number) => (row + 1) / (rows + 2);
  const floorY = (rows + 1.35) / (rows + 2);

  useEffect(() => {
    if (dropToken <= 0 || balls.length === 0) return;
    const now = performance.now();
    landingsRef.current = [];
    litRef.current = new Map();

    ballsRef.current = balls.map((b, i) => {
      const dirs = Array.from({ length: rows }, () => (Math.random() < 0.5 ? -1 : 1));
      const sum = dirs.reduce((a, c) => a + c, 0);
      const slotIndex = Math.min(slots - 1, Math.max(0, Math.round((rows + sum) / 2)));
      return {
        id: b.id,
        label: b.label,
        dirs,
        slotIndex,
        x: 0.5 + (Math.random() - 0.5) * 0.01,
        targetX: 0.5,
        y: 0,
        vy: 0,
        row: -1,
        startAt: now + i * STAGGER_MS,
        landed: false,
        restY: floorY,
        squash: 0,
      };
    });

    const tick = () => {
      const t = performance.now();
      let active = false;

      for (const b of ballsRef.current) {
        if (t < b.startAt) { active = true; continue; }
        if (b.landed) continue;
        active = true;

        b.vy += GRAVITY;
        b.y += b.vy;
        b.squash *= 0.85;

        // peg collisions row by row
        const nextRow = b.row + 1;
        if (nextRow < rows && b.y >= rowY(nextRow)) {
          b.row = nextRow;
          b.y = rowY(nextRow);
          b.vy = -b.vy * BOUNCE;
          b.squash = 1;
          b.targetX = b.x + (b.dirs[nextRow] * 0.5) / slots;
        }

        if (b.row >= rows - 1) {
          b.targetX = (b.slotIndex + 0.5) / slots;
        }

        b.x += (b.targetX - b.x) * X_STIFF;

        if (b.y >= b.restY) {
          b.y = b.restY;
          if (Math.abs(b.vy) > 0.006) {
            b.vy = -b.vy * BOUNCE;
            b.squash = 1;
          } else {
            b.vy = 0;
            b.landed = true;
            const landing = { id: b.id, slotIndex: b.slotIndex, multiplier: multipliers[b.slotIndex] };
            litRef.current.set(b.slotIndex, t);
            landingsRef.current.push(landing);
            onLanded?.(landing);
            if (landingsRef.current.length === ballsRef.current.length) {
              onAllLanded?.([...landingsRef.current]);
            }
          }
        }
      }

      force(v => v + 1);
      rafRef.current = active ? requestAnimationFrame(tick) : null;
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);

    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); rafRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropToken]);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const nowT = performance.now();
  const showLabels = balls.length <= 4;

  return (
    <div className="w-full">
      <div
        className="relative w-full rounded-2xl overflow-hidden border"
        style={{
          aspectRatio: '1 / 1',
          borderColor: `${accent}25`,
          background: `radial-gradient(120% 90% at 50% 0%, ${accent}14, transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,0,0,0.35))`,
        }}
      >
        {pegs.map((p, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${p.x * 100}%`,
              top: `${rowY(p.row) * 100}%`,
              width: 7,
              height: 7,
              transform: 'translate(-50%, -50%)',
              background: 'rgba(255,255,255,0.4)',
              boxShadow: '0 0 6px rgba(255,255,255,0.18)',
            }}
          />
        ))}

        {ballsRef.current.map((b) => {
          if (nowT < b.startAt) return null;
          const sq = b.squash;
          return (
            <div
              key={b.id}
              className="absolute"
              style={{
                left: `${b.x * 100}%`,
                top: `${b.y * 100}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: 5,
              }}
            >
              <div
                className="rounded-full"
                style={{
                  width: 18,
                  height: 18,
                  background: `radial-gradient(circle at 32% 28%, #fff, ${accent})`,
                  boxShadow: `0 0 16px ${accent}, 0 0 36px ${accent}55`,
                  transform: `scale(${1 + sq * 0.25}, ${1 - sq * 0.3})`,
                }}
              />
              {showLabels && (
                <span
                  className="absolute left-1/2 -translate-x-1/2 -top-5 whitespace-nowrap text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded"
                  style={{ background: 'rgba(0,0,0,0.55)', color: accent }}
                >
                  {b.label}
                </span>
              )}
            </div>
          );
        })}

        {/* Slots */}
        <div className="absolute bottom-0 left-0 right-0 flex px-0.5 pb-1 gap-0.5">
          {multipliers.map((m, i) => {
            const lit = litRef.current.get(i);
            const isActive = lit !== undefined && nowT - lit < 1400;
            return (
              <div
                key={i}
                className="flex-1 text-center rounded-md py-1.5 text-[10px] sm:text-xs font-black transition-all duration-200"
                style={{
                  background: isActive ? accent : `${accent}12`,
                  color: isActive ? '#0b1020' : accent,
                  border: `1px solid ${isActive ? accent : `${accent}30`}`,
                  boxShadow: isActive ? `0 0 22px ${accent}` : 'none',
                  transform: isActive ? 'translateY(-3px) scale(1.08)' : 'none',
                }}
              >
                {m}x
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PlinkoBoard;
