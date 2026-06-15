import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { setLobbySession } from '@/lib/lobbySession';
import { Loader2, Home } from 'lucide-react';
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
  const [remember, setRemember] = useState(true);
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
    <div className="min-h-screen flex flex-col relative">
      {/* Top-left Lobby pill */}
      <div className="absolute top-5 left-5 z-20">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-black/40 border border-white/10 text-white/80 text-xs font-medium backdrop-blur-md" style={{ fontFamily: fontBody }}>
          <Home size={13} /> Lobby
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[420px] bg-[#0a0a0f]/85 backdrop-blur-xl border border-white/10 rounded-2xl p-7 md:p-9 shadow-2xl">
          {logoUrl && (
            <img src={logoUrl} alt="Logo" className="mx-auto h-16 md:h-20 object-contain mb-5" />
          )}
          <h1
            className="text-3xl md:text-4xl font-bold text-center text-white uppercase tracking-wide leading-tight"
            style={{ fontFamily: fontHead }}
          >
            {title}
          </h1>
          <p className="text-sm text-center text-white/60 mt-1.5" style={{ fontFamily: fontBody }}>
            {subtitle}
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/80 mb-1.5" style={{ fontFamily: fontBody }}>
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="seu@email.com"
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#111319] text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/50 focus:border-[#00d4ff]/30 placeholder:text-white/20 transition"
                style={{ fontFamily: fontBody }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/80 mb-1.5" style={{ fontFamily: fontBody }}>
                ID da Conta
              </label>
              <input
                type="text"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                required
                autoComplete="username"
                placeholder="Digite seu ID"
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#111319] text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/50 focus:border-[#00d4ff]/30 placeholder:text-white/20 transition"
                style={{ fontFamily: fontBody }}
              />
            </div>

            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id="remember"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="lobby-login-checkbox"
              />
              <label
                htmlFor="remember"
                className="text-sm text-white/70 select-none cursor-pointer"
                style={{ fontFamily: fontBody }}
              >
                Lembrar sessão
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#00d4ff] text-[#0a0a0f] font-semibold hover:bg-[#00b8e6] active:scale-[0.98] transition disabled:opacity-60 shadow-lg shadow-[#00d4ff]/20"
              style={{ fontFamily: fontBody }}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="mt-6 text-center" style={{ fontFamily: fontBody }}>
            <p className="text-sm text-white/50">
              Crie sua conta na gorjeta{' '}
              <a
                href={`/gorjeta?return=lobby:${encodeURIComponent(tag)}`}
                className="text-[#00d4ff] hover:text-[#00e5ff] font-semibold underline underline-offset-4 transition"
              >
                Clique aqui
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
