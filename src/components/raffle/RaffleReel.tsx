import { useEffect, useRef, useState } from 'react';

interface Props {
  names: string[];
  active: boolean;
  durationMs?: number;
}

/** Rolo tipo urna: acelera, sustenta e desacelera sem revelar o resultado. */
const RaffleReel = ({ names, active, durationMs = 6500 }: Props) => {
  const [visible, setVisible] = useState(() => [names[0] ?? '—', names[1] ?? names[0] ?? '—', names[2] ?? names[0] ?? '—']);
  const idx = useRef(0);

  useEffect(() => {
    if (!active || names.length === 0) return;
    const startedAt = performance.now();
    let timer = 0;
    const tick = () => {
      idx.current = (idx.current + 1 + Math.floor(Math.random() * Math.max(1, names.length - 1))) % names.length;
      const first = names[idx.current];
      const second = names[(idx.current + 1) % names.length];
      const third = names[(idx.current + 2) % names.length];
      setVisible([first, second, third]);

      const progress = Math.min(1, (performance.now() - startedAt) / durationMs);
      const delay = progress < 0.72 ? 70 : 70 + Math.pow((progress - 0.72) / 0.28, 2) * 250;
      timer = window.setTimeout(tick, delay);
    };
    tick();
    return () => window.clearTimeout(timer);
  }, [active, durationMs, names]);

  return (
    <div className="relative mx-auto h-44 w-full max-w-3xl overflow-hidden border-y border-border bg-card/40">
      <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-16 -translate-y-1/2 border-y border-primary/40 bg-primary/[0.05]" />
      <div key={visible[1]} className="animate-[raffle-reel_.14s_ease-out] py-2 text-center">
        {visible.map((name, position) => (
          <p
            key={`${name}-${position}`}
            className={`h-12 truncate px-6 text-3xl sm:text-4xl ${position === 1 ? 'text-primary' : 'text-muted-foreground/35'}`}
          >
            {name}
          </p>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-background to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-background to-transparent" />
      <style>{`@keyframes raffle-reel { from { transform: translateY(-28px); filter: blur(2px); opacity: .35 } to { transform: translateY(0); filter: blur(0); opacity: 1 } }`}</style>
    </div>
  );
};

export default RaffleReel;
