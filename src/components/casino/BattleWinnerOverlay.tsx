import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, X } from 'lucide-react';
import type { BattleConfig, BattleParticipant } from './battleTypes';

interface Props {
  open: boolean;
  winner: (BattleParticipant & { score?: number }) | null;
  runnersUp: (BattleParticipant & { score?: number })[];
  config: BattleConfig;
  prize?: number;
  onClose: () => void;
}

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BattleWinnerOverlay({ open, winner, runnersUp, config, prize, onClose }: Props) {
  const fired = useRef(false);

  useEffect(() => {
    if (!open) {
      fired.current = false;
      return;
    }
    if (fired.current) return;
    fired.current = true;

    const accent = config.headerAccentColor || '#3DE8D2';
    const colors = [accent, '#FFD700', '#FFFFFF', '#FF6B6B', '#4ECDC4'];

    const end = Date.now() + 2500;
    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 70,
        origin: { x: 0, y: 0.7 },
        colors,
        zIndex: 9999,
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 70,
        origin: { x: 1, y: 0.7 },
        colors,
        zIndex: 9999,
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    // Big initial burst
    confetti({
      particleCount: 180,
      spread: 110,
      startVelocity: 55,
      origin: { y: 0.55 },
      colors,
      zIndex: 9999,
    });
    frame();

    // ESC closes
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, config.headerAccentColor, onClose]);

  if (!open || !winner) return null;

  const accent = config.headerAccentColor || '#3DE8D2';

  return (
    <div
      className="fixed inset-0 z-[9000] flex items-center justify-center p-4 animate-fade-in"
      style={{
        backgroundColor: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        aria-label="Fechar"
        className="absolute top-6 right-6 w-10 h-10 rounded-full inline-flex items-center justify-center transition-opacity hover:opacity-100 opacity-60"
        style={{
          color: config.panelTextColor,
          border: `1px solid ${config.panelBorderColor}`,
          backgroundColor: config.panelBgColor,
        }}
      >
        <X size={18} />
      </button>

      <div
        className="relative w-full max-w-2xl rounded-3xl p-8 lg:p-12 text-center"
        style={{
          backgroundColor: config.panelBgColor,
          border: `2px solid ${accent}`,
          boxShadow: `0 0 60px ${accent}66, inset 0 0 30px ${accent}22`,
          animation: 'battle-winner-pop 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Halo */}
        <div
          aria-hidden
          className="absolute -inset-1 rounded-3xl pointer-events-none"
          style={{
            background: `radial-gradient(circle at 50% 0%, ${accent}33, transparent 60%)`,
          }}
        />

        <div className="relative">
          <div
            className="mx-auto w-20 h-20 lg:w-24 lg:h-24 rounded-full inline-flex items-center justify-center mb-4"
            style={{
              backgroundColor: `${accent}1a`,
              border: `2px solid ${accent}`,
              boxShadow: `0 0 30px ${accent}66`,
              animation: 'battle-trophy-spin 1.2s ease-out',
            }}
          >
            <Trophy size={44} style={{ color: accent }} />
          </div>

          <div
            className="text-xs lg:text-sm font-bold tracking-[0.5em] mb-2"
            style={{ color: accent, textShadow: `0 0 12px ${accent}88` }}
          >
            CAMPEÃO
          </div>

          <h2
            className="text-4xl lg:text-6xl font-black tracking-tight mb-2"
            style={{
              color: config.panelTextColor,
              textShadow: `0 0 24px ${accent}66`,
              animation: 'battle-name-glow 1.6s ease-in-out infinite alternate',
            }}
          >
            {winner.name}
          </h2>

          {winner.game && (
            <div
              className="text-sm lg:text-base opacity-80 mb-6"
              style={{ color: config.panelLabelColor }}
            >
              {winner.game}
            </div>
          )}

          <div
            className="inline-flex items-baseline gap-2 px-6 py-3 rounded-2xl mb-6"
            style={{
              backgroundColor: config.bgColor,
              border: `1px solid ${accent}55`,
              boxShadow: `0 0 18px ${accent}33`,
            }}
          >
            <span
              className="text-xs tracking-[0.3em] font-semibold"
              style={{ color: config.panelLabelColor }}
            >
              {prize !== undefined ? 'PRÊMIO' : 'PONTUAÇÃO'}
            </span>
            <span
              className="text-3xl lg:text-4xl font-extrabold tabular-nums"
              style={{ color: accent, textShadow: `0 0 14px ${accent}88` }}
            >
              R$ {fmtBRL(prize !== undefined ? prize : (winner.score ?? 0))}
            </span>
          </div>

          {runnersUp.length > 0 && (
            <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
              {runnersUp.slice(0, 2).map((p, i) => (
                <div
                  key={p.id}
                  className="rounded-xl p-3 text-left"
                  style={{
                    backgroundColor: config.bgColor,
                    border: `1px solid ${config.panelBorderColor}`,
                  }}
                >
                  <div
                    className="text-[10px] tracking-[0.3em] mb-1"
                    style={{ color: config.panelLabelColor }}
                  >
                    {i === 0 ? '🥈 2º LUGAR' : '🥉 3º LUGAR'}
                  </div>
                  <div
                    className="text-sm font-bold truncate"
                    style={{ color: config.panelTextColor }}
                  >
                    {p.name}
                  </div>
                  <div
                    className="text-xs font-semibold tabular-nums mt-1"
                    style={{ color: accent }}
                  >
                    R$ {fmtBRL(p.score ?? 0)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes battle-winner-pop {
          0%   { transform: scale(0.6) translateY(40px); opacity: 0; }
          60%  { transform: scale(1.04) translateY(-4px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes battle-trophy-spin {
          0%   { transform: rotate(-180deg) scale(0.4); opacity: 0; }
          100% { transform: rotate(0deg) scale(1); opacity: 1; }
        }
        @keyframes battle-name-glow {
          from { filter: brightness(1); }
          to   { filter: brightness(1.15); }
        }
      `}</style>
    </div>
  );
}
