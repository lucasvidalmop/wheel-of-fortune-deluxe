import { Coins, User } from 'lucide-react';
import type { LobbySession } from '@/lib/lobbySession';

interface Props {
  logoUrl?: string;
  session: LobbySession | null;
  coins?: number | null;
  onProfile: () => void;
}

const LobbyHeader = ({ logoUrl, session, coins, onProfile }: Props) => {
  const firstName = session?.name?.split(' ')[0] || session?.email?.split('@')[0] || 'Você';
  const initial = (session?.name?.[0] || session?.email?.[0] || '?').toUpperCase();

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-black/35 border-b border-white/10 pt-safe">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
        {/* Logo */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-9 w-auto object-contain shrink-0" />
          ) : (
            <div
              className="h-9 px-3 rounded-lg bg-white/10 flex items-center font-bold tracking-wider text-sm"
              style={{ fontFamily: 'var(--lobby-font-heading, Bebas Neue), sans-serif', letterSpacing: '0.12em' }}
            >
              GORJETA
            </div>
          )}
          <div className="hidden sm:flex flex-col leading-tight min-w-0">
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/45" style={{ fontFamily: 'var(--lobby-font-body, Barlow), sans-serif' }}>
              Olá
            </span>
            <span className="text-sm font-semibold text-white truncate max-w-[160px]" style={{ fontFamily: 'var(--lobby-font-body, Barlow), sans-serif' }}>
              {firstName}
            </span>
          </div>
        </div>

        {/* Coins */}
        {typeof coins === 'number' && (
          <div
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1.5 text-sm font-semibold"
            style={{ fontFamily: 'var(--lobby-font-body, Barlow), sans-serif' }}
            aria-label="Coins disponíveis"
          >
            <Coins size={15} style={{ color: 'var(--lobby-primary, #00d4ff)' }} />
            <span>{coins.toLocaleString('pt-BR')}</span>
          </div>
        )}

        {/* Profile */}
        <button
          type="button"
          onClick={onProfile}
          aria-label="Abrir perfil"
          className="lobby-tap h-10 w-10 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-sm font-bold hover:bg-white/15"
          style={{ fontFamily: 'var(--lobby-font-body, Barlow), sans-serif' }}
        >
          {initial !== '?' ? initial : <User size={16} />}
        </button>
      </div>
    </header>
  );
};

export default LobbyHeader;
