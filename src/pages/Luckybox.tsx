import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Coins, LogOut, Package, Sparkles, X } from 'lucide-react';

interface CasePrize {
  label: string;
  amount?: number;
  image?: string;
  rarity?: string;
  weight?: number;
  count?: number;
}
interface LuckyCase {
  id: string;
  name: string;
  price_tokens: number;
  image_url: string;
  rarity: string;
  prizes: CasePrize[];
}
interface LuckyConfig {
  id: string;
  tag: string;
  tokens_symbol: string;
  page_config: any;
  owner_id: string;
}

const RARITY_COLOR: Record<string, string> = {
  common: '#9CA3AF',
  uncommon: '#22C55E',
  rare: '#3B82F6',
  epic: '#A855F7',
  legendary: '#F59E0B',
  mythic: '#EF4444',
  supreme: '#22D3EE',
};
const rarityColor = (r?: string) => RARITY_COLOR[(r || 'common').toLowerCase()] || '#9CA3AF';

const Luckybox = ({ tag }: { tag?: string }) => {
  const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState<LuckyConfig | null>(null);
  const [cases, setCases] = useState<LuckyCase[]>([]);
  const [disabled, setDisabled] = useState(false);

  // Auth
  const [authedUser, setAuthedUser] = useState<{ id: string; name: string; account_id: string; email: string; tokens_balance: number } | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginAccount, setLoginAccount] = useState('');
  const [logging, setLogging] = useState(false);

  // Opening
  const [openingCase, setOpeningCase] = useState<LuckyCase | null>(null);
  const [reelPrizes, setReelPrizes] = useState<CasePrize[]>([]);
  const [reelOffset, setReelOffset] = useState(0);
  const [reelTransition, setReelTransition] = useState('none');
  const [winner, setWinner] = useState<CasePrize | null>(null);
  const [phase, setPhase] = useState<'idle' | 'spinning' | 'done'>('idle');

  const pc = cfg?.page_config || {};

  // Load page
  useEffect(() => {
    if (!tag) { setLoading(false); return; }
    (async () => {
      const { data, error } = await (supabase as any).rpc('get_luckybox_page_by_tag', { p_tag: tag });
      if (error || !data?.config) {
        if (data?.disabled) setDisabled(true);
        setLoading(false);
        return;
      }
      setCfg(data.config);
      setCases(data.cases || []);
      setLoading(false);
    })();
  }, [tag]);

  // SEO
  useEffect(() => {
    if (!cfg) return;
    const cleanups: (() => void)[] = [];
    const prevTitle = document.title;
    document.title = pc.seoTitle || pc.title || `Luckybox ${cfg.tag}`;
    cleanups.push(() => { document.title = prevTitle; });
    const ensureMeta = (name: string, content: string) => {
      if (!content) return;
      let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      const created = !el;
      if (!el) { el = document.createElement('meta'); el.setAttribute('name', name); document.head.appendChild(el); }
      el.setAttribute('content', content);
      cleanups.push(() => { if (created) el?.remove(); });
    };
    ensureMeta('description', pc.seoDescription || `Abra caixas e ganhe prêmios em ${cfg.tag}`);
    if (pc.seoFaviconUrl) {
      let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
      const had = !!link; const old = link?.href;
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = pc.seoFaviconUrl;
      cleanups.push(() => { if (!had) link?.remove(); else if (link && old) link.href = old; });
    }
    return () => cleanups.forEach(fn => fn());
  }, [cfg]);

  // Restore session
  useEffect(() => {
    if (!cfg) return;
    const key = `luckybox_user_${cfg.tag}`;
    const raw = sessionStorage.getItem(key);
    if (raw) {
      try { setAuthedUser(JSON.parse(raw)); } catch {}
    }
  }, [cfg]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginAccount.trim()) {
      toast.error('Preencha email e ID');
      return;
    }
    setLogging(true);
    try {
      const { data, error } = await (supabase as any).rpc('authenticate_wheel_user', {
        p_email: loginEmail.trim(),
        p_account_id: loginAccount.trim(),
        p_owner_id: cfg!.owner_id,
      });
      if (error) throw error;
      const user = Array.isArray(data) ? data[0] : data;
      if (!user?.id) {
        toast.error('Conta não encontrada');
        return;
      }
      // fetch tokens balance
      const { data: u } = await supabase.from('wheel_users').select('tokens_balance,name,email,account_id').eq('id', user.id).maybeSingle();
      const sess = {
        id: user.id,
        name: u?.name || user.name || '',
        account_id: u?.account_id || loginAccount.trim(),
        email: u?.email || loginEmail.trim(),
        tokens_balance: u?.tokens_balance ?? 0,
      };
      setAuthedUser(sess);
      sessionStorage.setItem(`luckybox_user_${cfg!.tag}`, JSON.stringify(sess));
    } catch (err: any) {
      toast.error(err.message || 'Erro ao entrar');
    }
    setLogging(false);
  };

  const refreshTokens = async () => {
    if (!authedUser) return;
    const { data } = await supabase.from('wheel_users').select('tokens_balance').eq('id', authedUser.id).maybeSingle();
    if (data) {
      const updated = { ...authedUser, tokens_balance: data.tokens_balance ?? 0 };
      setAuthedUser(updated);
      sessionStorage.setItem(`luckybox_user_${cfg!.tag}`, JSON.stringify(updated));
    }
  };

  const buildReel = (prizes: CasePrize[], winnerIndex: number): { reel: CasePrize[]; targetIndex: number } => {
    // Build a long reel of ~60 random prizes + ensure winner sits at a specific index near the end
    const n = 60;
    const reel: CasePrize[] = [];
    for (let i = 0; i < n; i++) {
      reel.push(prizes[Math.floor(Math.random() * prizes.length)]);
    }
    const target = n - 8;
    reel[target] = prizes[winnerIndex];
    return { reel, targetIndex: target };
  };

  const handleOpenCase = async (c: LuckyCase) => {
    if (!authedUser) return;
    if (authedUser.tokens_balance < c.price_tokens) {
      toast.error('Tokens insuficientes');
      return;
    }
    setOpeningCase(c);
    setWinner(null);
    setPhase('spinning');

    try {
      const { data, error } = await (supabase as any).rpc('open_luckybox_case', {
        p_owner_id: cfg!.owner_id,
        p_account_id: authedUser.account_id,
        p_case_id: c.id,
      });
      if (error) throw error;
      if (!data?.success) {
        toast.error(data?.error || 'Erro ao abrir caixa');
        setOpeningCase(null);
        setPhase('idle');
        return;
      }
      const winIndex = data.prize_index ?? 0;
      const prize = c.prizes[winIndex] || data.prize;
      const { reel, targetIndex } = buildReel(c.prizes, winIndex);
      setReelPrizes(reel);
      setReelOffset(0);
      setReelTransition('none');

      // Update tokens
      const updated = { ...authedUser, tokens_balance: data.tokens_balance ?? authedUser.tokens_balance - c.price_tokens };
      setAuthedUser(updated);
      sessionStorage.setItem(`luckybox_user_${cfg!.tag}`, JSON.stringify(updated));

      // Animate
      requestAnimationFrame(() => {
        setTimeout(() => {
          const itemWidth = 168; // px (160 width + 8 gap roughly)
          const containerCenter = 0;
          // jitter so it doesn't always land in dead center
          const jitter = (Math.random() - 0.5) * 80;
          const offset = -(targetIndex * itemWidth) + containerCenter + jitter;
          setReelTransition('transform 6s cubic-bezier(0.05, 0.8, 0.15, 1)');
          setReelOffset(offset);
          setTimeout(() => {
            setWinner(prize);
            setPhase('done');
          }, 6200);
        }, 50);
      });
    } catch (err: any) {
      toast.error(err.message || 'Erro');
      setOpeningCase(null);
      setPhase('idle');
    }
  };

  const closeOpening = () => {
    setOpeningCase(null);
    setWinner(null);
    setPhase('idle');
    setReelOffset(0);
    setReelPrizes([]);
    refreshTokens();
  };

  // Background style
  const bgStyle: React.CSSProperties = useMemo(() => ({
    background: pc.bgImage
      ? undefined
      : pc.bgColor || `radial-gradient(ellipse at top, ${pc.bgGradientFrom || '#1a1230'} 0%, ${pc.bgGradientTo || '#05040a'} 70%)`,
    backgroundImage: pc.bgImage ? `url(${pc.bgImage})` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }), [pc]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-pulse text-muted-foreground">Carregando...</div></div>;
  }

  if (disabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="text-6xl">🔒</div>
          <h1 className="text-xl font-bold">Luckybox indisponível</h1>
          <p className="text-muted-foreground text-sm">Esta funcionalidade não está habilitada para este operador.</p>
        </div>
      </div>
    );
  }

  if (!cfg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="text-6xl">🚫</div>
          <h1 className="text-xl font-bold">Página inválida</h1>
          <p className="text-muted-foreground text-sm">Esta página de Luckybox não existe ou foi desativada.</p>
        </div>
      </div>
    );
  }

  // Login screen
  if (!authedUser) {
    const accent = pc.accentColor || '#22d3ee';
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden text-white" style={bgStyle}>
        <form onSubmit={handleLogin} className="relative z-10 w-full max-w-sm mx-4 rounded-2xl p-6 space-y-5 border border-white/10 bg-black/40 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
          <div className="text-center space-y-2">
            {pc.logoUrl
              ? <img src={pc.logoUrl} alt="logo" className="max-h-20 mx-auto object-contain" />
              : <div className="text-4xl">🎁</div>}
            <h1 className="text-xl font-bold" style={{ color: pc.titleColor || '#fff' }}>{pc.title || 'Luckybox'}</h1>
            <p className="text-sm" style={{ color: pc.subtitleColor || 'rgba(255,255,255,0.7)' }}>
              {pc.subtitle || 'Entre para abrir suas caixas'}
            </p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1 opacity-80">E-mail</label>
              <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-white/20" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 opacity-80">ID da Conta</label>
              <input type="text" value={loginAccount} onChange={e => setLoginAccount(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-white/20" />
            </div>
          </div>
          <button type="submit" disabled={logging} className="w-full py-3 rounded-xl font-bold text-sm transition disabled:opacity-50" style={{ background: accent, color: pc.btnTextColor || '#000' }}>
            {logging ? 'Entrando...' : (pc.loginBtnText || 'Entrar')}
          </button>
        </form>
      </div>
    );
  }

  // Main grid
  const accent = pc.accentColor || '#22d3ee';
  return (
    <div className="min-h-screen text-white" style={bgStyle}>
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-black/40 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {pc.logoUrl
              ? <img src={pc.logoUrl} alt="logo" className="h-9 object-contain" />
              : <div className="text-2xl">🎁</div>}
            <h1 className="text-lg font-bold" style={{ color: pc.titleColor || '#fff' }}>{pc.title || 'Luckybox'}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5">
              <Coins size={16} style={{ color: accent }} />
              <span className="font-bold tabular-nums">{authedUser.tokens_balance}</span>
              <span className="text-xs opacity-70">{cfg.tokens_symbol || 'T'}</span>
            </div>
            <button
              onClick={() => { sessionStorage.removeItem(`luckybox_user_${cfg.tag}`); setAuthedUser(null); }}
              className="p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition"
              title="Sair"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-1">{pc.gridTitle || 'Escolha sua caixa'}</h2>
          <p className="text-sm opacity-70">{pc.gridSubtitle || 'Cada caixa contém prêmios diferentes. Boa sorte!'}</p>
        </div>

        {cases.length === 0 ? (
          <div className="text-center py-16 opacity-60">
            <Package size={48} className="mx-auto mb-3" />
            <p>Nenhuma caixa disponível no momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {cases.map(c => (
              <button
                key={c.id}
                onClick={() => handleOpenCase(c)}
                disabled={authedUser.tokens_balance < c.price_tokens}
                className="group relative rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.02] p-4 transition hover:scale-[1.03] hover:border-white/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{ boxShadow: `inset 0 0 0 1px ${rarityColor(c.rarity)}22` }}
              >
                <div
                  className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition pointer-events-none"
                  style={{ boxShadow: `0 0 30px ${rarityColor(c.rarity)}66`, background: `radial-gradient(circle at center, ${rarityColor(c.rarity)}22, transparent 70%)` }}
                />
                <div className="aspect-square flex items-center justify-center mb-3 relative">
                  {c.image_url
                    ? <img src={c.image_url} alt={c.name} className="max-w-full max-h-full object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]" />
                    : <Package size={64} style={{ color: rarityColor(c.rarity) }} />}
                </div>
                <div className="text-center text-sm font-semibold">{c.name}</div>
                <div className="text-center mt-2 flex items-center justify-center gap-1 text-base font-bold" style={{ color: accent }}>
                  <Coins size={14} />
                  {c.price_tokens} <span className="text-xs opacity-70">{cfg.tokens_symbol || 'T'}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Opening modal */}
      {openingCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="relative w-full max-w-3xl rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-black/40 p-6 shadow-[0_8px_60px_rgba(0,0,0,0.8)]">
            <button onClick={closeOpening} className="absolute top-3 right-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition">
              <X size={18} />
            </button>
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold">{openingCase.name}</h3>
              <p className="text-xs opacity-60 mt-1">
                {phase === 'spinning' ? 'Abrindo caixa...' : phase === 'done' ? 'Você ganhou!' : 'Pronto'}
              </p>
            </div>

            {/* Reel */}
            <div className="relative h-44 overflow-hidden rounded-xl border border-white/10 bg-black/60 mb-6">
              {/* Center marker */}
              <div className="absolute left-1/2 top-0 bottom-0 w-[3px] -translate-x-1/2 z-10" style={{ background: accent, boxShadow: `0 0 16px ${accent}` }} />
              <div className="absolute left-1/2 top-0 -translate-x-1/2 z-10" style={{ borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: `10px solid ${accent}` }} />
              <div className="absolute left-1/2 bottom-0 -translate-x-1/2 z-10" style={{ borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderBottom: `10px solid ${accent}` }} />

              {/* Side fades */}
              <div className="absolute left-0 top-0 bottom-0 w-20 z-10 pointer-events-none" style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.95), transparent)' }} />
              <div className="absolute right-0 top-0 bottom-0 w-20 z-10 pointer-events-none" style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.95), transparent)' }} />

              <div
                className="absolute top-1/2 -translate-y-1/2 flex gap-2 will-change-transform"
                style={{
                  transform: `translateX(calc(50% + ${reelOffset}px))`,
                  transition: reelTransition,
                }}
              >
                {reelPrizes.map((p, i) => (
                  <div
                    key={i}
                    className="w-40 h-36 shrink-0 rounded-xl border flex flex-col items-center justify-between p-2 relative overflow-hidden"
                    style={{
                      borderColor: rarityColor(p.rarity) + '66',
                      background: `linear-gradient(180deg, ${rarityColor(p.rarity)}22 0%, rgba(0,0,0,0.4) 100%)`,
                    }}
                  >
                    <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: rarityColor(p.rarity) }} />
                    <div className="flex-1 w-full flex items-center justify-center min-h-0">
                      {p.image
                        ? <img src={p.image} alt={p.label} className="max-w-full max-h-full object-contain" />
                        : <div className="text-4xl">🎁</div>}
                    </div>
                    <div className="text-xs font-semibold text-center line-clamp-1 w-full pt-1">{p.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Winner reveal */}
            {phase === 'done' && winner && (
              <div className="text-center space-y-3 animate-fade-in">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10" style={{ background: rarityColor(winner.rarity) + '22', color: rarityColor(winner.rarity) }}>
                  <Sparkles size={16} />
                  <span className="text-sm font-bold uppercase tracking-wider">{winner.rarity || 'Prêmio'}</span>
                </div>
                <div className="text-2xl font-bold">{winner.label}</div>
                {(winner.amount || 0) > 0 && (
                  <div className="text-sm opacity-80">Será pago em PIX automaticamente quando aprovado.</div>
                )}
                <div className="flex gap-3 justify-center pt-2">
                  <button onClick={closeOpening} className="px-5 py-2.5 rounded-xl font-semibold border border-white/10 bg-white/5 hover:bg-white/10 transition">
                    Continuar
                  </button>
                  <button
                    onClick={() => { closeOpening(); setTimeout(() => handleOpenCase(openingCase), 100); }}
                    disabled={authedUser.tokens_balance < openingCase.price_tokens}
                    className="px-5 py-2.5 rounded-xl font-semibold transition disabled:opacity-50"
                    style={{ background: accent, color: pc.btnTextColor || '#000' }}
                  >
                    Abrir outra
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Luckybox;
