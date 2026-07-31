import { useEffect, useRef, useState } from 'react';

interface Props {
  names: string[];
  rolling: boolean;
  winner?: { name: string; code: string } | null;
}

/** Rolagem de nomes com suspense antes da revelação do ganhador. */
const RaffleRollAnimation = ({ names, rolling, winner }: Props) => {
  const [current, setCurrent] = useState('—');
  const idx = useRef(0);

  useEffect(() => {
    if (!rolling || names.length === 0) return;
    let delay = 45;
    let timer: number;
    const tick = () => {
      idx.current = (idx.current + 1) % names.length;
      setCurrent(names[idx.current]);
      delay = Math.min(320, delay * 1.045);
      timer = window.setTimeout(tick, delay);
    };
    timer = window.setTimeout(tick, delay);
    return () => window.clearTimeout(timer);
  }, [rolling, names]);

  const label = winner ? winner.name : rolling ? current : '—';

  return (
    <div className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-black/40 px-6 py-10 text-center">
      <div
        className={`absolute inset-0 opacity-40 transition-opacity duration-500 ${winner ? 'opacity-70' : ''}`}
        style={{ background: 'radial-gradient(circle at 50% 50%, rgba(168,85,247,0.35), transparent 65%)' }}
      />
      <p className="relative text-[11px] uppercase tracking-[0.32em] text-white/45">
        {winner ? 'Vencedor' : rolling ? 'Sorteando...' : 'Aguardando'}
      </p>
      <p
        className={`relative mt-3 font-bold text-white transition-all duration-300 ${
          winner ? 'text-4xl sm:text-6xl scale-105' : 'text-3xl sm:text-5xl opacity-80'
        }`}
        style={{ fontFamily: 'var(--lobby-font-title, "Bebas Neue"), sans-serif', letterSpacing: '0.04em' }}
      >
        {label}
      </p>
      {winner && (
        <p className="relative mt-2 text-sm tracking-[0.2em] text-white/55">{winner.code}</p>
      )}
    </div>
  );
};

export default RaffleRollAnimation;
