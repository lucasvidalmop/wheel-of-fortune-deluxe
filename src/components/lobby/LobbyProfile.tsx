import { LogOut, Mail, IdCard, Coins, Sparkles } from 'lucide-react';
import type { LobbySession } from '@/lib/lobbySession';

interface Props {
  session: LobbySession;
  coins?: number | null;
  onSignOut: () => void;
  onBackToHome: () => void;
}

const Row = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] border border-white/10 px-4 py-3">
    <span className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center" style={{ color: 'var(--lobby-primary, #00d4ff)' }}>
      {icon}
    </span>
    <div className="flex-1 min-w-0">
      <div className="text-[10px] uppercase tracking-[0.22em] text-white/45" style={{ fontFamily: 'var(--lobby-font-body, Barlow), sans-serif' }}>
        {label}
      </div>
      <div className="text-sm text-white font-medium truncate" style={{ fontFamily: 'var(--lobby-font-body, Barlow), sans-serif' }}>
        {value}
      </div>
    </div>
  </div>
);

const LobbyProfile = ({ session, coins, onSignOut, onBackToHome }: Props) => (
  <div className="mx-auto w-full max-w-md px-4 sm:px-6 pt-5 sm:pt-8 pb-8">
    <div className="flex flex-col items-center text-center mb-6">
      <div
        className="h-20 w-20 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-3xl font-bold"
        style={{ fontFamily: 'var(--lobby-font-heading, Bebas Neue), sans-serif', color: 'var(--lobby-primary, #00d4ff)' }}
      >
        {(session.name?.[0] || session.email[0] || '?').toUpperCase()}
      </div>
      <h2
        className="mt-3 text-white text-2xl"
        style={{ fontFamily: 'var(--lobby-font-heading, Bebas Neue), sans-serif', letterSpacing: '0.04em' }}
      >
        {session.name || session.email.split('@')[0]}
      </h2>
      {typeof coins === 'number' && (
        <div
          className="mt-2 inline-flex items-center gap-1.5 text-sm rounded-full bg-white/10 border border-white/15 px-3 py-1.5 font-semibold"
          style={{ fontFamily: 'var(--lobby-font-body, Barlow), sans-serif' }}
        >
          <Coins size={14} style={{ color: 'var(--lobby-primary, #00d4ff)' }} />
          {coins.toLocaleString('pt-BR')} coins
        </div>
      )}
    </div>

    <div className="space-y-2.5">
      <Row icon={<Mail size={16} />} label="E-mail" value={session.email} />
      <Row icon={<IdCard size={16} />} label="ID da conta" value={session.account_id} />
    </div>

    <div className="mt-6 grid grid-cols-2 gap-2.5">
      <button
        type="button"
        onClick={onBackToHome}
        className="lobby-tap rounded-2xl bg-white/[0.06] border border-white/10 hover:bg-white/[0.1] py-3 text-sm font-semibold inline-flex items-center justify-center gap-2"
        style={{ fontFamily: 'var(--lobby-font-body, Barlow), sans-serif' }}
      >
        <Sparkles size={15} /> Promoções
      </button>
      <button
        type="button"
        onClick={onSignOut}
        className="lobby-tap rounded-2xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-200 py-3 text-sm font-semibold inline-flex items-center justify-center gap-2"
        style={{ fontFamily: 'var(--lobby-font-body, Barlow), sans-serif' }}
      >
        <LogOut size={15} /> Sair
      </button>
    </div>
  </div>
);

export default LobbyProfile;
