import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { setLobbySession } from '@/lib/lobbySession';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface LobbyLoginProps {
  tag: string;
  ownerId?: string;
  logoUrl?: string;
  title?: string;
  subtitle?: string;
  initialEmail?: string;
  onSignedIn: () => void;
}

export default function LobbyLogin({
  tag,
  ownerId,
  logoUrl,
  title = 'Acesse o Lobby',
  subtitle = 'Entre com seu e-mail e ID da conta',
  initialEmail = '',
  onSignedIn,
}: LobbyLoginProps) {
  const [email, setEmail] = useState(initialEmail);
  const [accountId, setAccountId] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !accountId.trim()) {
      toast.error('Preencha e-mail e ID da conta');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc('authenticate_wheel_user', {
        p_email: email.trim(),
        p_account_id: accountId.trim(),
        p_owner_id: ownerId || null,
      });
      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row) {
        toast.error('E-mail ou ID inválidos');
        return;
      }
      setLobbySession({
        wheel_user_id: row.id || row.wheel_user_id,
        account_id: row.account_id || accountId.trim(),
        email: row.email || email.trim(),
        name: row.name,
        owner_id: row.owner_id || ownerId,
        lobby_tag: tag,
        signed_in_at: Date.now(),
      });
      onSignedIn();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao entrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl">
        {logoUrl && (
          <img src={logoUrl} alt="Logo" className="mx-auto h-14 md:h-16 object-contain mb-4" />
        )}
        <h1 className="text-2xl md:text-3xl font-bold text-center text-white">{title}</h1>
        <p className="text-sm text-white/70 text-center mt-1">{subtitle}</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm text-white/80 mb-1">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="block text-sm text-white/80 mb-1">ID da conta</label>
            <input
              type="text"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              required
              autoComplete="username"
              className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-white/60 mb-2">Ainda não tem conta na Gorjeta?</p>
          <a
            href={`/gorjeta?return=lobby:${encodeURIComponent(tag)}`}
            className="inline-block px-5 py-2.5 rounded-xl border border-primary/60 text-primary font-semibold hover:bg-primary/10 transition"
          >
            Clique aqui para se inscrever
          </a>
        </div>
      </div>
    </div>
  );
}
