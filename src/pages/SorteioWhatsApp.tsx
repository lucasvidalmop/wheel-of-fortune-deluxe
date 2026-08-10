import { useCallback, useEffect, useState } from 'react';
import { Loader2, MessageCircle, Trophy, Lock, CheckCircle2, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getLobbySession, setLobbySession } from '@/lib/lobbySession';

interface Tier {
  id: string;
  scope: 'individual' | 'group';
  threshold: number;
  rewardType: 'spin' | 'box' | 'coin' | 'cash';
  rewardAmount: number;
  rewardLabel: string;
}

interface Payload {
  found: boolean;
  event?: { name: string; scope: 'individual' | 'group' | 'both'; status: string; groupName: string; faviconUrl?: string };
  tiers?: Tier[];
  me?: { name: string } | null;
  myProgress?: number;
  myUnlocks?: { tierId: string; status: string }[];
  groupProgress?: number;
}

const REWARD_LABEL: Record<string, string> = { spin: 'Giro grátis', box: 'Caixa surpresa', coin: 'Coins', cash: 'Prêmio em dinheiro' };

const SorteioWhatsApp = ({ tag }: { tag: string }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Payload | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginAccountId, setLoginAccountId] = useState('');
  const [logging, setLogging] = useState(false);
  const [loginError, setLoginError] = useState('');

  const load = useCallback(async (email?: string, accountId?: string) => {
    const session = getLobbySession();
    const useEmail = email ?? session?.email;
    const useAccount = accountId ?? session?.account_id;
    const { data: res } = await supabase.functions.invoke('get-whatsapp-activity', {
      body: { tag, email: useEmail, accountId: useAccount },
    });
    setData(res as Payload);
    return res as Payload;
  }, [tag]);

  useEffect(() => {
    (async () => { setLoading(true); await load(); setLoading(false); })();
  }, [load]);

  useEffect(() => {
    if (data?.event?.name) document.title = `${data.event.name} | Progresso WhatsApp`;
    if (data?.event?.faviconUrl) {
      let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = data.event.faviconUrl;
    }
  }, [data?.event?.name, data?.event?.faviconUrl]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!loginEmail.trim() || !loginAccountId.trim()) { setLoginError('Preencha email e ID da conta'); return; }
    setLogging(true);
    try {
      const res = await load(loginEmail.trim(), loginAccountId.trim());
      if (!res?.me) {
        setLoginError('E-mail ou ID da conta não encontrados.');
      } else {
        setLobbySession({
          account_id: loginAccountId.trim(), email: loginEmail.trim(), name: res.me.name,
          lobby_tag: tag, signed_in_at: Date.now(),
        });
      }
    } finally {
      setLogging(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#0a0a0f]">
        <Loader2 className="h-8 w-8 animate-spin text-white/70" />
      </div>
    );
  }

  if (!data?.found || !data.event) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#0a0a0f] px-6 text-center text-white">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Evento não encontrado</h1>
          <p className="text-white/60">Verifique o link e tente novamente.</p>
        </div>
      </div>
    );
  }

  const ev = data.event;
  const individualTiers = (data.tiers || []).filter((t) => t.scope === 'individual');
  const groupTiers = (data.tiers || []).filter((t) => t.scope === 'group');
  const unlockByTier = new Map((data.myUnlocks || []).map((u) => [u.tierId, u.status]));

  const renderTier = (t: Tier, progress: number, barColor: string) => {
    const status = unlockByTier.get(t.id);
    const done = progress >= t.threshold;
    const pct = Math.min(100, Math.round((progress / t.threshold) * 100));
    return (
      <div key={t.id} className={`rounded-2xl border p-4 space-y-3 ${done ? 'border-emerald-500/30 bg-emerald-500/[0.06]' : 'border-white/10 bg-white/[0.03]'}`}>
        <div className="flex items-center gap-3">
          <div className={`shrink-0 h-9 w-9 rounded-full flex items-center justify-center ${done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-white/40'}`}>
            {done ? <CheckCircle2 size={18} /> : <Lock size={16} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{t.rewardLabel || REWARD_LABEL[t.rewardType] || t.rewardType}</p>
            <p className="text-xs text-white/45">{t.threshold} mensagens{t.rewardType === 'cash' ? ` · R$ ${Number(t.rewardAmount).toFixed(2)}` : ''}</p>
          </div>
          {done && (
            <span className="shrink-0 text-[11px] font-semibold px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center gap-1">
              {status === 'pending_approval'
                ? <><Clock size={11} /> Em aprovação</>
                : status === 'granted'
                  ? <><CheckCircle2 size={11} /> Creditado</>
                  : status === 'pending_manual'
                    ? <><Clock size={11} /> Em análise</>
                    : 'Concluído'}
            </span>
          )}
        </div>
        <div className="space-y-1">
          <div className="h-2 w-full rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${pct}%`, background: done ? '#10b981' : barColor }}
            />
          </div>
          <p className="text-[11px] text-white/40 text-right">
            {done ? 'Meta atingida!' : `${Math.min(progress, t.threshold)} / ${t.threshold} mensagens`}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0f] text-white pb-16">
      <div className="mx-auto w-full max-w-xl px-4 pt-8 space-y-5">
        <div className="text-center space-y-1">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
            <MessageCircle size={22} />
          </div>
          <h1 className="text-2xl font-bold mt-2">{ev.name}</h1>
          <p className="text-sm text-white/50">Mande mensagem no grupo e acompanhe seu progresso aqui.</p>
        </div>

        {!data.me ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 space-y-4">
            <h2 className="text-lg font-bold">Ver meu progresso</h2>
            <form onSubmit={handleLogin} className="space-y-3">
              <input
                type="email" placeholder="Seu e-mail" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3.5 text-[15px] text-white placeholder:text-white/35 outline-none focus:border-white/30"
              />
              <input
                type="text" placeholder="Seu ID da conta" value={loginAccountId} onChange={(e) => setLoginAccountId(e.target.value)}
                className="w-full rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3.5 text-[15px] text-white placeholder:text-white/35 outline-none focus:border-white/30"
              />
              {loginError && <p className="text-[13px] text-red-300">{loginError}</p>}
              <button
                type="submit" disabled={logging}
                className="w-full rounded-2xl px-4 py-4 text-[15px] font-bold text-black disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(90deg, #00d4ff, #a855f7)' }}
              >
                {logging ? <Loader2 size={18} className="animate-spin" /> : null}
                {logging ? 'Verificando...' : 'Ver meu progresso'}
              </button>
            </form>
          </div>
        ) : (
          <>
            {(ev.scope === 'individual' || ev.scope === 'both') && (
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white/70">Seu progresso, {data.me.name}</h2>
                  <span className="text-2xl font-bold" style={{ color: '#00d4ff' }}>{data.myProgress || 0}</span>
                </div>
                <div className="space-y-2">
                  {individualTiers.length === 0 && <p className="text-sm text-white/40">Nenhuma meta configurada ainda.</p>}
                  {individualTiers.map((t) => renderTier(t, data.myProgress || 0, '#00d4ff'))}
                </div>
              </div>
            )}

            {(ev.scope === 'group' || ev.scope === 'both') && (
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white/70 flex items-center gap-2"><Trophy size={14} /> Meta do grupo</h2>
                  <span className="text-2xl font-bold" style={{ color: '#a855f7' }}>{data.groupProgress || 0}</span>
                </div>
                <div className="space-y-2">
                  {groupTiers.length === 0 && <p className="text-sm text-white/40">Nenhuma meta coletiva configurada ainda.</p>}
                  {groupTiers.map((t) => renderTier(t, data.groupProgress || 0, '#a855f7'))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SorteioWhatsApp;
