import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { LogOut, RefreshCw, Search, FileDown, Trophy, Copy, ExternalLink, Plus, Minus, X, Star, Clock, Users, Award, History } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface WheelUser {
  id: string;
  account_id: string;
  email: string;
  phone: string;
  name: string;
  spins_available: number;
  created_at: string;
  pix_key: string;
  pix_key_type: string;
  auto_payment: boolean;
}

interface Winner {
  user: WheelUser;
  amount: number;
  status: 'pending' | 'sending' | 'sent';
}

interface TodayWinner {
  id: string;
  user_name: string;
  account_id: string;
  amount: number;
  created_at: string;
}

type RaffleStep = 'config' | 'sending' | 'results';

const maskAccountId = (id: string) => {
  if (!id || id.length <= 4) return id;
  return id.slice(0, 4) + '*'.repeat(Math.min(id.length - 4, 8));
};

const formatCurrency = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

const Influencer = () => {
  useSiteSettings();

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Config
  const [slug, setSlug] = useState('');
  const [gorjetaRef, setGorjetaRef] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [dailyLimit, setDailyLimit] = useState(500);
  const [sentToday, setSentToday] = useState(0);
  const [influencerConfig, setInfluencerConfig] = useState<any>({});

  // Users
  const [users, setUsers] = useState<WheelUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Tabs
  const [activeTab, setActiveTab] = useState<'participants' | 'winners' | 'history'>('participants');

  // Today's winners
  const [todayWinners, setTodayWinners] = useState<TodayWinner[]>([]);

  // History
  const [historyWinners, setHistoryWinners] = useState<TodayWinner[]>([]);

  // Timer
  const [timer, setTimer] = useState('');

  // Raffle dialog
  const [showRaffle, setShowRaffle] = useState(false);
  const [raffleStep, setRaffleStep] = useState<RaffleStep>('config');
  const [raffleQty, setRaffleQty] = useState(1);
  const [raffleAmount, setRaffleAmount] = useState(30);
  const [customAmount, setCustomAmount] = useState('30,00');
  const [winners, setWinners] = useState<Winner[]>([]);
  const [sendingIndex, setSendingIndex] = useState(0);

  // Timer effect
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      setTimer(`${h}:${m}:${s}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auth
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) loadData(s.user.id);
      else setLoading(false);
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) loadData(s.user.id);
      else setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadData = async (userId: string) => {
    setLoading(true);
    const { data: cfg } = await (supabase as any)
      .from('wheel_configs')
      .select('slug, config')
      .eq('user_id', userId)
      .maybeSingle();

    if (cfg) {
      setSlug(cfg.slug || '');
      const rawConfig = cfg.config || {};
      setGorjetaRef(rawConfig.gorjetaRef || '');
      setLinkLabel(rawConfig.influencerLabel || rawConfig.gorjetaRef || '');
      setDailyLimit(rawConfig.influencerDailyLimit || 500);
      setInfluencerConfig(rawConfig.influencerPageConfig || {});
    }
    setLoading(false);
    fetchUsers(userId);
    fetchTodayWinners(userId);
    fetchHistory(userId);
  };

  const fetchUsers = async (userId?: string) => {
    const uid = userId || session?.user?.id;
    if (!uid) return;
    setUsersLoading(true);
    const { data } = await (supabase as any)
      .from('wheel_users')
      .select('*')
      .eq('owner_id', uid)
      .order('created_at', { ascending: false });
    setUsers(data || []);
    setUsersLoading(false);
  };

  const fetchTodayWinners = async (userId?: string) => {
    const uid = userId || session?.user?.id;
    if (!uid) return;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data } = await (supabase as any)
      .from('prize_payments')
      .select('id, user_name, account_id, amount, created_at')
      .eq('owner_id', uid)
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: false });
    setTodayWinners(data || []);
    setSentToday((data || []).length);
  };

  const fetchHistory = async (userId?: string) => {
    const uid = userId || session?.user?.id;
    if (!uid) return;
    const { data } = await (supabase as any)
      .from('prize_payments')
      .select('id, user_name, account_id, amount, created_at')
      .eq('owner_id', uid)
      .order('created_at', { ascending: false })
      .limit(200);
    setHistoryWinners(data || []);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
    if (error) toast.error(error.message);
    setLoginLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  const handleRefresh = () => {
    if (!session?.user?.id) return;
    fetchUsers(session.user.id);
    fetchTodayWinners(session.user.id);
    toast.success('Atualizado!');
  };

  const handleResetDayCounter = () => {
    setSentToday(0);
    toast.success('Contador reiniciado!');
  };

  const filteredUsers = users.filter(u => {
    const term = searchTerm.toLowerCase();
    return u.name.toLowerCase().includes(term) || u.account_id.toLowerCase().includes(term);
  });

  const todayWinsForUser = (accountId: string) => {
    return todayWinners.filter(w => w.account_id === accountId).length;
  };

  const handleExportCSV = () => {
    const csv = ['Nome,ID,Email,Telefone,Vitórias Hoje']
      .concat(filteredUsers.map(u => `"${u.name}","${u.account_id}","${u.email}","${u.phone}",${todayWinsForUser(u.account_id)}`))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'participantes.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Raffle logic
  const startRaffle = () => {
    setRaffleStep('config');
    setRaffleQty(1);
    setRaffleAmount(30);
    setCustomAmount('30,00');
    setWinners([]);
    setSendingIndex(0);
    setShowRaffle(true);
  };

  const executeRaffle = async () => {
    if (users.length === 0) { toast.error('Sem participantes'); return; }
    const qty = Math.min(raffleQty, users.length);
    const shuffled = [...users].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, qty).map(u => ({ user: u, amount: raffleAmount, status: 'pending' as const }));
    setWinners(selected);
    setRaffleStep('sending');
    setSendingIndex(0);

    // Send prizes one by one
    for (let i = 0; i < selected.length; i++) {
      setSendingIndex(i);
      setWinners(prev => prev.map((w, idx) => idx === i ? { ...w, status: 'sending' } : w));

      try {
        await (supabase as any).rpc('create_prize_payment', {
          p_owner_id: session.user.id,
          p_account_id: selected[i].user.account_id,
          p_user_name: selected[i].user.name,
          p_user_email: selected[i].user.email,
          p_prize: `Sorteio R$ ${raffleAmount.toFixed(2)}`,
          p_amount: raffleAmount,
          p_force_auto: selected[i].user.auto_payment,
        });
      } catch (err) {
        console.error('Erro ao criar pagamento:', err);
      }

      setWinners(prev => prev.map((w, idx) => idx === i ? { ...w, status: 'sent' } : w));
      await new Promise(r => setTimeout(r, 800));
    }

    setSendingIndex(selected.length);
    setTimeout(() => {
      setRaffleStep('results');
      fetchTodayWinners(session?.user?.id);
    }, 600);
  };

  const closeRaffle = () => {
    setShowRaffle(false);
    setRaffleStep('config');
  };

  const baseUrl = window.location.origin;
  const gorjetaUrl = gorjetaRef ? `${baseUrl}/gorjeta?ref=${gorjetaRef}` : '';
  const prizesRemaining = Math.max(0, dailyLimit - sentToday);
  const progressPercent = dailyLimit > 0 ? Math.round((sentToday / dailyLimit) * 100) : 0;

  const accentColor = influencerConfig.accentColor || '#2dd4bf';
  const bgColor = influencerConfig.bgColor || '#0a0e1a';
  const cardBgColor = influencerConfig.cardBgColor || 'rgba(20, 30, 50, 0.95)';
  const textColor = influencerConfig.textColor || '#ffffff';
  const btnBgColor = influencerConfig.btnBgColor || accentColor;
  const btnTextColor = influencerConfig.btnTextColor || '#000000';

  // Login screen
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: `linear-gradient(135deg, ${bgColor}, #1a0a2e)` }}>
        <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl p-8">
          <h1 className="text-2xl font-bold text-white text-center mb-2">🎯 Influencer</h1>
          <p className="text-sm text-white/50 text-center mb-6">Faça login para acessar o painel</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="email" placeholder="Email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.04] text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/40" />
            <input type="password" placeholder="Senha" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.04] text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/40" />
            <button type="submit" disabled={loginLoading} className="w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50" style={{ background: accentColor, color: btnTextColor }}>
              {loginLoading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: bgColor }}>
        <div className="animate-spin w-8 h-8 border-2 border-t-transparent rounded-full" style={{ borderColor: `${accentColor} transparent ${accentColor} ${accentColor}` }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: bgColor, color: textColor }}>
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl border-b border-white/[0.06]" style={{ background: 'rgba(10, 14, 26, 0.85)' }}>
        <div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-3">
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition">
            <LogOut size={16} /> Sair
          </button>
          <div className="flex items-center gap-2">
            <Star size={14} style={{ color: accentColor }} />
            <span className="text-sm font-bold" style={{ color: accentColor }}>{session?.user?.email?.split('@')[0] || 'Influencer'}</span>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-4 pb-32 space-y-4">
        {/* Title card */}
        <div className="rounded-2xl border border-white/[0.08] p-4" style={{ background: cardBgColor }}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Trophy size={24} style={{ color: accentColor }} />
              <div>
                <h1 className="text-lg font-black tracking-wide uppercase" style={{ color: textColor }}>{linkLabel || gorjetaRef || 'SORTEIO'}</h1>
                <p className="text-xs text-white/40">{prizesRemaining} prêmio(s) restante(s)</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/40">{sentToday}</span>
              <span className="text-xs text-white/30">/{dailyLimit}</span>
              <span className="px-2 py-1 rounded-lg text-xs font-mono font-bold" style={{ background: accentColor, color: btnTextColor }}>{timer}</span>
            </div>
          </div>

          {/* Progress */}
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-white/40">Progresso diário</span>
              <span className="text-[10px] font-bold" style={{ color: accentColor }}>{progressPercent}%</span>
            </div>
            <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progressPercent}%`, background: accentColor }} />
            </div>
          </div>

          <div className="flex justify-end mt-2">
            <button onClick={handleResetDayCounter} className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/60 transition">
              <RefreshCw size={10} /> Reiniciar contador do dia
            </button>
          </div>
        </div>

        {/* Link */}
        {gorjetaUrl && (
          <div className="rounded-xl border border-white/[0.06] p-3 flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <span className="text-[10px] text-white/40 shrink-0">🔗 LINK:</span>
            <input readOnly value={gorjetaUrl} className="flex-1 bg-transparent text-xs text-white/60 font-mono truncate outline-none" />
            <button onClick={() => { navigator.clipboard.writeText(gorjetaUrl); toast.success('Link copiado!'); }} className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold border transition" style={{ borderColor: `${accentColor}33`, color: accentColor }}>
              <Copy size={12} /> Copiar
            </button>
          </div>
        )}

        {/* Refresh + Timer */}
        <div className="flex items-center justify-between">
          <button onClick={handleRefresh} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border transition" style={{ borderColor: `${accentColor}33`, color: accentColor }}>
            <RefreshCw size={14} /> Atualizar
          </button>
          <span className="text-xs text-white/30 font-mono">{timer}</span>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/[0.06]">
          {([
            { key: 'participants' as const, label: 'Participantes', count: users.length, icon: Users },
            { key: 'winners' as const, label: 'Ganhadores Hoje', count: todayWinners.length, icon: Award },
            { key: 'history' as const, label: 'Histórico', icon: History },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium transition-all border-b-2 ${
                activeTab === tab.key
                  ? 'border-current'
                  : 'border-transparent text-white/40 hover:text-white/60'
              }`}
              style={activeTab === tab.key ? { color: accentColor } : undefined}
            >
              <tab.icon size={14} />
              {tab.label}
              {tab.count !== undefined && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={activeTab === tab.key ? { background: `${accentColor}20`, color: accentColor } : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'participants' && (
          <div className="space-y-3">
            {/* Search + CSV */}
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border border-white/[0.08]" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <Search size={14} className="text-white/30" />
                <input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nome ou credencial..."
                  className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30"
                />
              </div>
              <button onClick={handleExportCSV} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.04] transition">
                <FileDown size={14} /> CSV
              </button>
            </div>

            {/* Participants grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {filteredUsers.map(u => {
                const winsToday = todayWinsForUser(u.account_id);
                return (
                  <div key={u.id} className="flex items-center justify-between p-3 rounded-xl border border-white/[0.06] transition hover:border-white/[0.12]" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold truncate" style={{ color: textColor }}>{u.name}</p>
                      <p className="text-[10px] text-white/40">Hoje: {winsToday}/1 vitória(s)</p>
                      <p className="text-[10px] text-white/30 font-mono">{maskAccountId(u.account_id)}</p>
                    </div>
                    <Trophy size={18} style={{ color: `${accentColor}40` }} />
                  </div>
                );
              })}
            </div>

            {usersLoading && (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-t-transparent rounded-full" style={{ borderColor: `${accentColor} transparent ${accentColor} ${accentColor}` }} />
              </div>
            )}

            {!usersLoading && filteredUsers.length === 0 && (
              <p className="text-center text-sm text-white/30 py-8">Nenhum participante encontrado</p>
            )}
          </div>
        )}

        {activeTab === 'winners' && (
          <div className="space-y-2">
            {todayWinners.length === 0 && (
              <p className="text-center text-sm text-white/30 py-8">Nenhum ganhador hoje</p>
            )}
            {todayWinners.map((w, i) => (
              <div key={w.id} className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.06]" style={{ background: i === 0 ? `${accentColor}10` : 'rgba(255,255,255,0.02)' }}>
                <span className="w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold" style={{ background: accentColor, color: btnTextColor }}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold uppercase truncate">{w.user_name}</p>
                  <p className="text-[10px] text-white/30 font-mono">{maskAccountId(w.account_id)} · {new Date(w.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                </div>
                <span className="text-sm font-bold" style={{ color: accentColor }}>{formatCurrency(w.amount)}</span>
              </div>
            ))}
            {todayWinners.length > 0 && (
              <div className="rounded-xl border border-white/[0.06] p-4 text-center" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <p className="text-xs text-white/40">Total distribuído hoje</p>
                <p className="text-lg font-black" style={{ color: accentColor }}>{formatCurrency(todayWinners.reduce((s, w) => s + (w.amount || 0), 0))}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-2">
            {historyWinners.length === 0 && (
              <p className="text-center text-sm text-white/30 py-8">Nenhum histórico encontrado</p>
            )}
            {historyWinners.map((w, i) => (
              <div key={w.id} className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <span className="w-7 h-7 flex items-center justify-center rounded-full text-[10px] font-bold bg-white/[0.06] text-white/40">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold uppercase truncate">{w.user_name}</p>
                  <p className="text-[10px] text-white/30 font-mono">{maskAccountId(w.account_id)} · {new Date(w.created_at).toLocaleString('pt-BR')}</p>
                </div>
                <span className="text-sm font-bold" style={{ color: accentColor }}>{formatCurrency(w.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom sticky button */}
      <div className="fixed bottom-0 left-0 right-0 z-40 p-4" style={{ background: `linear-gradient(to top, ${bgColor}, transparent)` }}>
        <div className="max-w-4xl mx-auto space-y-2">
          <button
            onClick={startRaffle}
            className="w-full py-4 rounded-2xl text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all hover:brightness-110 active:scale-[0.98]"
            style={{ background: accentColor, color: btnTextColor, boxShadow: `0 8px 32px ${accentColor}40` }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            REALIZAR SORTEIO
          </button>
          <p className="text-center text-[10px] text-white/30">Você pode enviar mais <strong style={{ color: accentColor }}>{prizesRemaining}</strong> prêmios hoje</p>
        </div>
      </div>

      {/* Raffle Dialog */}
      <Dialog open={showRaffle} onOpenChange={(open) => { if (!open && raffleStep !== 'sending') closeRaffle(); }}>
        <DialogContent className="max-w-md p-0 border-none bg-transparent shadow-none [&>button]:hidden">
          <div className="rounded-2xl border border-white/[0.1] overflow-hidden" style={{ background: cardBgColor }}>
            {/* Header */}
            <div className="p-5 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🏆</span>
                  <h2 className="text-base font-bold" style={{ color: textColor }}>Sortear Ganhadores</h2>
                </div>
                <p className="text-[11px] text-white/40">{users.length} participante(s) · {prizesRemaining} prêmios restantes</p>
              </div>
              {raffleStep !== 'sending' && (
                <button onClick={closeRaffle} className="p-1 rounded-lg hover:bg-white/[0.06] transition text-white/40 hover:text-white">
                  <X size={18} />
                </button>
              )}
            </div>

            <div className="px-5 pb-5 space-y-4">
              {raffleStep === 'config' && (
                <>
                  {/* Prizes remaining bar */}
                  <div className="rounded-xl border border-white/[0.08] p-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-white/50">Prêmios restantes hoje</span>
                      <span className="text-sm font-bold" style={{ color: accentColor }}>{prizesRemaining}/{dailyLimit}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(prizesRemaining / dailyLimit) * 100}%`, background: accentColor }} />
                    </div>
                  </div>

                  {/* Quantity */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Users size={14} style={{ color: accentColor }} />
                      <span className="text-xs font-bold uppercase tracking-wider text-white/60">Quantas pessoas sortear?</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 rounded-xl border border-white/[0.08] p-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <input
                          type="number"
                          value={raffleQty}
                          onChange={e => setRaffleQty(Math.max(1, Math.min(users.length, parseInt(e.target.value) || 1)))}
                          className="w-full bg-transparent text-center text-2xl font-black outline-none"
                          style={{ color: accentColor }}
                          min={1}
                          max={users.length}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <button onClick={() => setRaffleQty(q => Math.min(users.length, q + 1))} className="w-8 h-8 rounded-lg border border-white/[0.08] flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.06] transition" style={{ borderColor: `${accentColor}33` }}>
                          <Plus size={14} />
                        </button>
                        <button onClick={() => setRaffleQty(q => Math.max(1, q - 1))} className="w-8 h-8 rounded-lg border border-white/[0.08] flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.06] transition" style={{ borderColor: `${accentColor}33` }}>
                          <Minus size={14} />
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] text-white/30 mt-1">Máx. hoje: {users.length}</p>
                  </div>

                  {/* Prize amount */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs">$</span>
                      <span className="text-xs font-bold uppercase tracking-wider text-white/60">Valor do prêmio (R$)</span>
                    </div>
                    <div className="flex gap-2 mb-2">
                      {[10, 20, 30, 50].map(v => (
                        <button
                          key={v}
                          onClick={() => { setRaffleAmount(v); setCustomAmount(v.toFixed(2).replace('.', ',')); }}
                          className="flex-1 py-2 rounded-xl text-xs font-semibold border transition"
                          style={raffleAmount === v
                            ? { background: `${accentColor}15`, borderColor: accentColor, color: accentColor }
                            : { borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }
                          }
                        >
                          R$ {v},00
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={`R$ ${customAmount}`}
                      onChange={e => {
                        const raw = e.target.value.replace(/[^0-9,]/g, '');
                        setCustomAmount(raw);
                        const num = parseFloat(raw.replace(',', '.'));
                        if (!isNaN(num) && num > 0) setRaffleAmount(num);
                      }}
                      className="w-full px-4 py-2.5 rounded-xl text-sm border border-white/[0.08] bg-white/[0.03] text-white outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  {/* Total */}
                  <div className="rounded-xl border border-white/[0.08] p-4 text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <p className="text-xs text-white/40 mb-1">Total a distribuir</p>
                    <p className="text-xl font-black" style={{ color: accentColor }}>{formatCurrency(raffleQty * raffleAmount)}</p>
                  </div>

                  <button
                    onClick={executeRaffle}
                    className="w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all hover:brightness-110"
                    style={{ background: accentColor, color: btnTextColor }}
                  >
                    <Star size={16} /> REALIZAR SORTEIO
                  </button>
                </>
              )}

              {raffleStep === 'sending' && (
                <>
                  <div className="text-center py-2">
                    <p className="text-base font-black" style={{ color: accentColor }}>💰 ENVIANDO PRÊMIOS 💸</p>
                  </div>

                  <div>
                    <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden mb-1">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(winners.filter(w => w.status === 'sent').length / winners.length) * 100}%`, background: `linear-gradient(90deg, ${accentColor}, #3b82f6)` }} />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[10px] text-white/40">Progresso</span>
                      <span className="text-[10px] font-bold text-white/60">{winners.filter(w => w.status === 'sent').length}/{winners.length}</span>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {winners.filter(w => w.status !== 'pending').map((w, i) => (
                      <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl border border-white/[0.06] animate-fade-in" style={{ background: 'rgba(0,180,100,0.08)' }}>
                        <span className="text-sm">💵</span>
                        <span className="text-xs text-white/80 flex-1">{formatCurrency(w.amount)} → {w.user.name}</span>
                        {w.status === 'sent' && <span className="text-sm" style={{ color: '#4ade80' }}>✓</span>}
                        {w.status === 'sending' && <div className="w-3 h-3 border border-t-transparent rounded-full animate-spin" style={{ borderColor: `${accentColor} transparent ${accentColor} ${accentColor}` }} />}
                      </div>
                    ))}
                  </div>

                  <button disabled className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 opacity-80" style={{ background: accentColor, color: btnTextColor }}>
                    <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${btnTextColor} transparent ${btnTextColor} ${btnTextColor}` }} />
                    AGUARDE...
                  </button>
                </>
              )}

              {raffleStep === 'results' && (
                <>
                  <div className="text-center py-4">
                    <div className="text-5xl mb-3 animate-bounce">🏆</div>
                    <p className="text-base font-black" style={{ color: accentColor }}>🎉 Parabéns aos Ganhadores! 🎉</p>
                    <p className="text-xs text-white/50 mt-1">Cada ganhador recebe {formatCurrency(raffleAmount)}</p>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {winners.map((w, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.06]" style={{ background: i === 0 ? `${accentColor}10` : 'rgba(255,255,255,0.02)' }}>
                        <span className="w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold" style={{ background: accentColor, color: btnTextColor }}>{i + 1}º</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold uppercase truncate">{w.user.name}</p>
                          <p className="text-[10px] text-white/30 font-mono">{maskAccountId(w.user.account_id)}</p>
                        </div>
                        <span className="text-sm font-bold" style={{ color: accentColor }}>{formatCurrency(w.amount)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-xl border border-white/[0.06] p-4 text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <p className="text-xs text-white/40 mb-1">Total distribuído</p>
                    <p className="text-xl font-black" style={{ color: accentColor }}>{formatCurrency(winners.length * raffleAmount)}</p>
                  </div>

                  <button
                    onClick={closeRaffle}
                    className="w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-wider transition-all hover:brightness-110"
                    style={{ background: accentColor, color: btnTextColor }}
                  >
                    FECHAR
                  </button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Influencer;
