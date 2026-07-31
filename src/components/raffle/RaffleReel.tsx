import { useEffect, useRef, useState } from 'react';

interface Props {
  names: string[];
  active: boolean;
}

/** Rolo de nomes tipo slot machine: embaralha rápido enquanto `active`. */
const RaffleReel = ({ names, active }: Props) => {
  const [current, setCurrent] = useState(names[0] ?? '—');
  const idx = useRef(0);

  useEffect(() => {
    if (!active || names.length === 0) return;
    let timer: number;
    const tick = () => {
      idx.current = Math.floor(Math.random() * names.length);
      setCurrent(names[idx.current]);
      timer = window.setTimeout(tick, 60);
    };
    tick();
    return () => window.clearTimeout(timer);
  }, [active, names]);

  return (
    <div className="relative h-[1.15em] overflow-hidden">
      <span
        key={current}
        className="block animate-[reel-slide_.09s_ease-out] whitespace-nowrap text-white/85"
      >
        {current}
      </span>
      <style>{`@keyframes reel-slide { from { transform: translateY(45%); opacity: .25 } to { transform: translateY(0); opacity: 1 } }`}</style>
    </div>
  );
};

export default RaffleReel;
