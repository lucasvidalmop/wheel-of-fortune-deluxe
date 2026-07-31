import { useEffect, useRef, useState } from 'react';
import { Trophy } from 'lucide-react';

interface Props {
  names: string[];
  rolling: boolean;
  winner?: { name: string; code: string; position?: number } | null;
  prizeLabel?: string | null;
}

/** Rolagem de nomes com suspense antes da revelação do ganhador. */
const RaffleRollAnimation = ({ names, rolling, winner, prizeLabel }: Props) => {
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
    <div
      className={`relative w-full overflow-hidden rounded-[2rem] border px-6 py-8 text-center transition-all duration-500 sm:px-10 sm:py-10 ${
        winner
          ? 'border-amber-300/50 bg-gradient-to-b from-amber-500/15 via-black/60 to-black/80 shadow-[0_0_120px_-20px_rgba(251,191,36,0.55)]'
          : 'border-white/10 bg-black/40'
      }`}
    >
      {/* halo */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-700"
        style={{
          opacity: winner ? 0.9 : 0.35,
          background: winner
            ? 'radial-gradient(circle at 50% 40%, rgba(251,191,36,0.35), transparent 65%)'
            : 'radial-gradient(circle at 50% 50%, rgba(168,85,247,0.3), transparent 65%)',
        }}
      />
      {/* brilho suave animado */}
      {winner && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-full opacity-60"
          style={{
            background:
              'radial-gradient(ellipse at 50% 0%, rgba(251,191,36,0.28), transparent 60%)',
            animation: 'raffle-pulse 3s ease-in-out infinite',
          }}
        />
      )}

      <div className="relative flex flex-col items-center">
        {winner ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/50 bg-amber-400/15 px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.34em] text-amber-200">
            <Trophy size={14} />
            {winner.position && winner.position > 1 ? `${winner.position}º lugar` : 'Vencedor'}
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2 text-[11px] uppercase tracking-[0.34em] text-white/50">
            {rolling ? 'Sorteando...' : 'Aguardando sorteio'}
          </span>
        )}

        <p
          className={`mt-5 max-w-full break-words font-bold leading-[0.95] transition-all duration-300 ${
            winner
              ? 'bg-gradient-to-b from-white via-amber-100 to-amber-300 bg-clip-text text-transparent text-5xl sm:text-7xl'
              : 'text-white/70 text-3xl sm:text-5xl blur-[0.4px]'
          }`}
          style={{ fontFamily: 'var(--lobby-font-title, "Bebas Neue"), sans-serif', letterSpacing: '0.02em' }}
        >
          {label}
        </p>

        {winner && (
          <>
            <div className="mt-5 inline-flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-5 py-2.5 backdrop-blur">
              <span className="text-[10px] uppercase tracking-[0.28em] text-white/50">Bilhete</span>
              <span className="font-mono text-xl font-bold tracking-[0.18em] text-white sm:text-2xl">
                {winner.code}
              </span>
            </div>
            {prizeLabel && (
              <p className="mt-4 text-sm uppercase tracking-[0.3em] text-amber-200/80">{prizeLabel}</p>
            )}
          </>
        )}
      </div>

      <style>{`@keyframes raffle-pulse { 0%,100% { opacity: .45 } 50% { opacity: .8 } }`}</style>
    </div>
  );
};

export default RaffleRollAnimation;
