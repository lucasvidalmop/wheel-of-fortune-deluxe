import { useState } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { deviceFingerprint } from '@/lib/raffle';
import { getLobbySession } from '@/lib/lobbySession';

interface Props {
  tag: string;
  signupUrl: string;
  disabled?: boolean;
  onJoined: (r: { publicCode?: string; status?: string; message?: string }) => void;
}

const RaffleJoinForm = ({ tag, signupUrl, disabled, onJoined }: Props) => {
  const session = getLobbySession();
  const [email, setEmail] = useState(session?.email || '');
  const [accountId, setAccountId] = useState(session?.account_id || '');
  const [displayName, setDisplayName] = useState(session?.name || '');
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [needsAccount, setNeedsAccount] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || disabled) return;
    setError(''); setNeedsAccount(false); setLoading(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('join-raffle', {
        body: {
          tag,
          email: email.trim(),
          accountId: accountId.trim(),
          displayName: displayName.trim(),
          accepted,
          fingerprint: deviceFingerprint(),
        },
      });
      const payload: any = data ?? (fnErr as any)?.context?.body ?? null;
      if (payload?.ok) {
        onJoined(payload);
        return;
      }
      if (payload?.needsAccount) setNeedsAccount(true);
      setError(payload?.error || 'Não foi possível concluir a inscrição.');
    } catch {
      setError('Não foi possível concluir a inscrição. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    'w-full rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3.5 text-[15px] text-white placeholder:text-white/35 outline-none focus:border-white/30 focus:bg-white/[0.09]';

  const goSignup = () => {
    const back = window.location.href;
    const url = signupUrl || '/gorjeta';
    const sep = url.includes('?') ? '&' : '?';
    window.location.href = `${url}${sep}return=${encodeURIComponent(back)}`;
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        type="email" inputMode="email" autoComplete="email" required
        value={email} onChange={(e) => setEmail(e.target.value)}
        placeholder="Seu e-mail" className={inputCls}
      />
      <input
        type="text" inputMode="numeric" required maxLength={40}
        value={accountId} onChange={(e) => setAccountId(e.target.value)}
        placeholder="Seu ID da conta" className={inputCls}
      />
      <input
        type="text" maxLength={60}
        value={displayName} onChange={(e) => setDisplayName(e.target.value)}
        placeholder="Nome ou apelido (opcional)" className={inputCls}
      />

      <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[13px] text-white/70">
        <input
          type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--lobby-primary,#00d4ff)]"
        />
        <span>Li e aceito o regulamento deste sorteio.</span>
      </label>

      {error && (
        <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-[13px] text-red-200">
          {error}
        </div>
      )}

      {needsAccount ? (
        <button
          type="button" onClick={goSignup}
          className="w-full rounded-2xl bg-white px-4 py-4 text-[15px] font-bold text-black flex items-center justify-center gap-2 active:scale-[0.99]"
        >
          <UserPlus size={18} /> Criar minha conta
        </button>
      ) : (
        <button
          type="submit" disabled={loading || disabled}
          className="w-full rounded-2xl px-4 py-4 text-[15px] font-bold text-black disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.99]"
          style={{ background: 'linear-gradient(90deg, var(--lobby-primary, #00d4ff), #a855f7)' }}
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : null}
          {loading ? 'Enviando...' : 'Confirmar inscrição'}
        </button>
      )}
    </form>
  );
};

export default RaffleJoinForm;
