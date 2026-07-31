import { useEffect, useMemo, useState } from 'react';

interface Props {
  target?: string | null;
  label?: string;
  compact?: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

const RaffleCountdown = ({ target, label = 'Encerra em', compact }: Props) => {
  const targetMs = useMemo(() => (target ? new Date(target).getTime() : 0), [target]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!targetMs) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [targetMs]);

  if (!targetMs) return null;
  const diff = Math.max(0, targetMs - now);
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);

  const cells = [
    { v: pad(d), l: 'dias' },
    { v: pad(h), l: 'horas' },
    { v: pad(m), l: 'min' },
    { v: pad(s), l: 'seg' },
  ];

  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-[0.28em] text-white/50">{label}</p>
      <div className="flex gap-2">
        {cells.map((c) => (
          <div
            key={c.l}
            className={`flex-1 rounded-2xl border border-white/10 bg-white/[0.05] text-center ${compact ? 'py-2' : 'py-3'}`}
          >
            <div className={`font-bold tabular-nums text-white ${compact ? 'text-xl' : 'text-2xl sm:text-3xl'}`}>
              {c.v}
            </div>
            <div className="text-[9px] uppercase tracking-[0.2em] text-white/45">{c.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RaffleCountdown;
