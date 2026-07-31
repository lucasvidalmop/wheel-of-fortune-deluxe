import { useEffect, useMemo, useRef, useState } from 'react';

interface PlinkoBoardProps {
  rows: number;
  multipliers: number[];
  accent: string;
  /** Increment this value to trigger a new ball drop */
  dropToken: number;
  onLanded?: (slotIndex: number, multiplier: number) => void;
  highlightSlot?: number | null;
}

const STEP_MS = 210;

const PlinkoBoard = ({ rows, multipliers, accent, dropToken, onLanded, highlightSlot = null }: PlinkoBoardProps) => {
  const slots = multipliers.length;
  const [ballRow, setBallRow] = useState(-1);
  const [ballX, setBallX] = useState(0.5);
  const [dropping, setDropping] = useState(false);
  const [litSlot, setLitSlot] = useState<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

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

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  useEffect(() => {
    if (dropToken <= 0) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];

    // Random walk: each row nudges the ball left or right
    const dirs: number[] = Array.from({ length: rows }, () => (Math.random() < 0.5 ? -1 : 1));
    const sum = dirs.reduce((a, b) => a + b, 0);
    const slotIndex = Math.min(slots - 1, Math.max(0, Math.round((rows + sum) / 2)));

    setLitSlot(null);
    setDropping(true);
    setBallRow(-1);
    setBallX(0.5);

    let x = 0.5;
    for (let r = 0; r < rows; r++) {
      x += (dirs[r] * 0.5) / slots;
      const targetX = x;
      timers.current.push(setTimeout(() => {
        setBallRow(r);
        setBallX(targetX);
      }, STEP_MS * (r + 1)));
    }

    const landX = (slotIndex + 0.5) / slots;
    timers.current.push(setTimeout(() => {
      setBallRow(rows);
      setBallX(landX);
    }, STEP_MS * (rows + 1)));

    timers.current.push(setTimeout(() => {
      setDropping(false);
      setLitSlot(slotIndex);
      onLanded?.(slotIndex, multipliers[slotIndex]);
    }, STEP_MS * (rows + 2)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropToken]);

  const activeSlot = highlightSlot ?? litSlot;
  const rowHeight = 100 / (rows + 2);

  return (
    <div className="w-full">
      <div
        className="relative w-full rounded-2xl overflow-hidden border"
        style={{
          aspectRatio: '4 / 3',
          borderColor: `${accent}25`,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,0,0,0.25))',
        }}
      >
        {pegs.map((p, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${p.x * 100}%`,
              top: `${(p.row + 1) * rowHeight}%`,
              width: 6,
              height: 6,
              transform: 'translate(-50%, -50%)',
              background: 'rgba(255,255,255,0.35)',
              boxShadow: '0 0 6px rgba(255,255,255,0.15)',
            }}
          />
        ))}

        {dropToken > 0 && (
          <div
            className="absolute rounded-full"
            style={{
              left: `${ballX * 100}%`,
              top: `${(ballRow + 1) * rowHeight}%`,
              width: 16,
              height: 16,
              transform: 'translate(-50%, -50%)',
              background: accent,
              boxShadow: `0 0 18px ${accent}, 0 0 40px ${accent}66`,
              transition: `left ${STEP_MS}ms cubic-bezier(.4,0,.6,1), top ${STEP_MS}ms cubic-bezier(.3,0,.9,1)`,
            }}
          />
        )}

        {/* Slots */}
        <div className="absolute bottom-0 left-0 right-0 flex px-0.5 pb-1 gap-0.5">
          {multipliers.map((m, i) => {
            const isActive = activeSlot === i;
            return (
              <div
                key={i}
                className="flex-1 text-center rounded-md py-1 text-[10px] sm:text-xs font-black transition-all duration-300"
                style={{
                  background: isActive ? accent : `${accent}12`,
                  color: isActive ? '#0b1020' : accent,
                  border: `1px solid ${isActive ? accent : `${accent}30`}`,
                  boxShadow: isActive ? `0 0 22px ${accent}` : 'none',
                  transform: isActive ? 'translateY(-2px) scale(1.06)' : 'none',
                }}
              >
                {m}x
              </div>
            );
          })}
        </div>
      </div>
      {dropping && (
        <p className="mt-2 text-center text-[11px] uppercase tracking-widest text-white/40">Bolinha caindo...</p>
      )}
    </div>
  );
};

export default PlinkoBoard;
