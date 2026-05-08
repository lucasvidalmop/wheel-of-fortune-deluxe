import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Coins, Eye, LogOut, Package, Sparkles, X } from 'lucide-react';
import ScratchCell from '@/components/casino/ScratchCell';

interface ScratchPrize {
  label: string;
  amount?: number;
  image?: string;
  weight?: number;
}
interface CasePrize {
  label: string;
  amount?: number;
  image?: string;
  rarity?: string;
  weight?: number;
  count?: number;
  scratch?: boolean;
  scratchPrizes?: ScratchPrize[];
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
  coin_name?: string;
  coin_icon_url?: string;
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
  const [authedUser, setAuthedUser] = useState<{ id: string; name: string; account_id: string; email: string; tokens_balance: number; case_grants?: Record<string, number> } | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginAccount, setLoginAccount] = useState('');
  const [logging, setLogging] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [pendingCode, setPendingCode] = useState<string | null>(null);

  // Opening
  const [openingCase, setOpeningCase] = useState<LuckyCase | null>(null);
  const [prizesPreview, setPrizesPreview] = useState<LuckyCase | null>(null);
  
  const [reelPrizes, setReelPrizes] = useState<CasePrize[]>([]);
  const [reelOffset, setReelOffset] = useState(0);
  const [reelTransition, setReelTransition] = useState('none');
  const [winner, setWinner] = useState<CasePrize | null>(null);
  const [phase, setPhase] = useState<'idle' | 'spinning' | 'scratch' | 'done'>('idle');
  const [scratchWinner, setScratchWinner] = useState<ScratchPrize | null>(null);
  const [scratchCells, setScratchCells] = useState<ScratchPrize[]>([]);
  const [scratchedIdx, setScratchedIdx] = useState<Set<number>>(new Set());

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
      // fetch tokens balance + case_grants
      const { data: u } = await (supabase as any).from('wheel_users').select('tokens_balance,name,email,account_id,case_grants').eq('id', user.id).maybeSingle();
      const sess = {
        id: user.id,
        name: u?.name || user.name || '',
        account_id: u?.account_id || loginAccount.trim(),
        email: u?.email || loginEmail.trim(),
        tokens_balance: u?.tokens_balance ?? 0,
        case_grants: (u?.case_grants as Record<string, number>) || {},
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
    const { data } = await (supabase as any).from('wheel_users').select('tokens_balance,case_grants').eq('id', authedUser.id).maybeSingle();
    if (data) {
      const updated = { ...authedUser, tokens_balance: data.tokens_balance ?? 0, case_grants: (data.case_grants as Record<string, number>) || {} };
      setAuthedUser(updated);
      sessionStorage.setItem(`luckybox_user_${cfg!.tag}`, JSON.stringify(updated));
    }
  };

  // Capture ?code= from URL on first load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const c = params.get('code');
    if (c) {
      setPendingCode(c.toUpperCase());
      setRedeemCode(c.toUpperCase());
    }
  }, []);

  const doRedeem = async (codeOverride?: string) => {
    if (!authedUser || !cfg) return;
    const code = (codeOverride ?? redeemCode).trim();
    if (!code) { toast.error('Digite um código'); return; }
    setRedeeming(true);
    try {
      const { data, error } = await (supabase as any).rpc('redeem_luckybox_grant', {
        p_owner_id: cfg.owner_id,
        p_account_id: authedUser.account_id,
        p_email: authedUser.email,
        p_code: code,
      });
      if (error) throw error;
      if (!data?.success) { toast.error(data?.error || 'Falha no resgate'); return; }
      toast.success(`🎁 ${data.quantity}× ${data.case_name} liberada!`);
      setRedeemCode('');
      setPendingCode(null);
      // Clear ?code= from URL without reload
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('code');
        window.history.replaceState({}, '', url.toString());
      } catch {}
      await refreshTokens();
    } catch (e: any) {
      toast.error(e.message || 'Erro');
    } finally {
      setRedeeming(false);
    }
  };

  // Auto-redeem after login if pendingCode present
  useEffect(() => {
    if (authedUser && pendingCode && !redeeming) {
      doRedeem(pendingCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authedUser?.id, pendingCode]);

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
    const grantQty = (authedUser.case_grants?.[c.id] || 0);
    if (grantQty <= 0 && authedUser.tokens_balance < c.price_tokens) {
      toast.error(`${cfg.coin_name || 'Coins'} insuficientes`);
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
          const itemWidth = 168; // px (160 width + 8 gap)
          const cardHalf = 80; // half of card width
          const reelEl = document.getElementById('luckybox-reel-viewport');
          const halfViewport = reelEl ? reelEl.clientWidth / 2 : 0;
          // jitter so it doesn't always land in dead center
          const jitter = (Math.random() - 0.5) * 80;
          const offset = halfViewport - (targetIndex * itemWidth) - cardHalf + jitter;
          setReelTransition('transform 10s cubic-bezier(0.05, 0.8, 0.15, 1)');
          setReelOffset(offset);
          setTimeout(() => {
            setWinner(prize);
            // Mystery scratch prize: build 3x3 grid with the winner sub-prize as 3 matches
            if (prize?.scratch && data.scratch_prize) {
              const sub: ScratchPrize = data.scratch_prize;
              const pool: ScratchPrize[] = (prize.scratchPrizes || []).filter(x => x.label !== sub.label);
              if (pool.length === 0) pool.push({ label: '—', weight: 1 });
              const cells: ScratchPrize[] = [];
              // 3 winner cells
              for (let i = 0; i < 3; i++) cells.push(sub);
              // 6 distractors (use other sub-prizes, randomized; ensure no 3 of any other are equal)
              while (cells.length < 9) {
                cells.push(pool[Math.floor(Math.random() * pool.length)]);
              }
              // shuffle
              for (let i = cells.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [cells[i], cells[j]] = [cells[j], cells[i]];
              }
              setScratchCells(cells);
              setScratchedIdx(new Set());
              setScratchWinner(sub);
              setPhase('scratch');
            } else {
              setPhase('done');
            }
          }, 10200);
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
    setScratchCells([]);
    setScratchedIdx(new Set());
    setScratchWinner(null);
    refreshTokens();
  };

  const handleScratchCell = (idx: number) => {
    setScratchedIdx(prev => {
      const next = new Set(prev);
      next.add(idx);
      return next;
    });
  };

  useEffect(() => {
    if (phase === 'scratch' && scratchedIdx.size >= 9) {
      const t = setTimeout(() => setPhase('done'), 800);
      return () => clearTimeout(t);
    }
  }, [phase, scratchedIdx]);

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
  const coinName = cfg.coin_name || 'Coins';
  const coinIconUrl = cfg.coin_icon_url || '';
  const CoinIcon = ({ size = 16, color }: { size?: number; color?: string }) =>
    coinIconUrl
      ? <img src={coinIconUrl} alt="" style={{ width: size, height: size }} className="object-contain inline-block" />
      : <Coins size={size} style={color ? { color } : undefined} />;
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
              <CoinIcon size={16} color={accent} />
              <span className="font-bold tabular-nums">{authedUser.tokens_balance}</span>
              <span className="text-xs opacity-70">{coinName}</span>
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
        {/* Redeem code */}
        <div className="mb-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <div className="text-sm font-bold flex items-center gap-2">
                🎟️ Resgatar código de presente
              </div>
              <div className="text-xs opacity-70 mt-0.5">
                Recebeu uma caixa por WhatsApp? Digite o código abaixo para liberar.
              </div>
            </div>
            <input
              value={redeemCode}
              onChange={e => setRedeemCode(e.target.value.toUpperCase())}
              onKeyDown={e => { if (e.key === 'Enter') doRedeem(); }}
              placeholder="Ex: A2B4C6D8"
              className="px-3 py-2 rounded-lg border border-white/10 bg-black/40 text-sm font-mono uppercase tracking-wider"
              style={{ minWidth: 180 }}
              maxLength={20}
            />
            <button
              onClick={() => doRedeem()}
              disabled={redeeming || !redeemCode.trim()}
              className="px-4 py-2 rounded-lg font-semibold text-sm transition disabled:opacity-50"
              style={{ background: accent, color: '#000' }}
            >
              {redeeming ? 'Resgatando...' : 'Resgatar'}
            </button>
          </div>
        </div>

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
            {cases.map(c => {
              const grantQty = (authedUser.case_grants?.[c.id] || 0);
              const isFree = grantQty > 0;
              const cantAfford = !isFree && authedUser.tokens_balance < c.price_tokens;
              return (
                <div
                  key={c.id}
                  className="group relative rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.02] p-4 transition hover:border-white/30"
                  style={{ boxShadow: `inset 0 0 0 1px ${rarityColor(c.rarity)}22` }}
                >
                  {isFree && (
                    <div className="absolute -top-2 -right-2 z-20 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-lg"
                      style={{ background: accent, color: '#000' }}>
                      🎁 Grátis ×{grantQty}
                    </div>
                  )}
                  <div
                    className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition pointer-events-none"
                    style={{ boxShadow: `0 0 30px ${rarityColor(c.rarity)}66`, background: `radial-gradient(circle at center, ${rarityColor(c.rarity)}22, transparent 70%)` }}
                  />
                  <button
                    onClick={() => {
                      setOpeningCase(c);
                      setWinner(null);
                      setPhase('idle');
                      const preview: CasePrize[] = [];
                      for (let i = 0; i < 30; i++) preview.push(c.prizes[Math.floor(Math.random() * c.prizes.length)] || { label: '?' });
                      setReelPrizes(preview);
                      setReelOffset(0);
                      setReelTransition('none');
                    }}
                    disabled={cantAfford}
                    className="block w-full disabled:opacity-50 disabled:cursor-not-allowed transition hover:scale-[1.02]"
                  >
                    <div className="aspect-square flex items-center justify-center mb-3 relative">
                      {c.image_url
                        ? <img src={c.image_url} alt={c.name} className="max-w-full max-h-full object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]" />
                        : <Package size={64} style={{ color: rarityColor(c.rarity) }} />}
                    </div>
                    <div className="text-center text-sm font-semibold">{c.name}</div>
                    <div className="text-center mt-2 flex items-center justify-center gap-1.5 text-base font-bold" style={{ color: accent }}>
                      {isFree ? (
                        <span className="text-sm">🎁 Abrir grátis</span>
                      ) : (
                        <>
                          <CoinIcon size={20} color={accent} />
                          <span>{c.price_tokens}</span>
                          <span className="text-xs opacity-70 font-normal">{coinName}</span>
                        </>
                      )}
                    </div>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setPrizesPreview(c); }}
                    className="relative z-10 mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-medium transition"
                  >
                    <Eye size={13} /> Ver prêmios
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Opening modal */}
      {openingCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="relative w-full max-w-3xl rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-black/40 p-6 shadow-[0_8px_60px_rgba(0,0,0,0.8)]">
            {phase !== 'spinning' && (
              <button onClick={closeOpening} className="absolute top-3 right-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition">
                <X size={18} />
              </button>
            )}
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold">{openingCase.name}</h3>
              <p className="text-xs opacity-60 mt-1">
                {phase === 'spinning'
                  ? 'Abrindo caixa...'
                  : phase === 'scratch'
                  ? 'Raspe as 9 áreas — 3 iguais revelam seu prêmio!'
                  : phase === 'done'
                  ? 'Você ganhou!'
                  : `Custo: ${openingCase.price_tokens} ${coinName} · Saldo: ${authedUser.tokens_balance} ${coinName}`}
              </p>
            </div>

            {/* Reel (hidden during scratch) */}
            {phase !== 'scratch' && (
            <div id="luckybox-reel-viewport" className="relative h-44 overflow-hidden rounded-xl border border-white/10 bg-black/60 mb-6">
              {/* Center marker */}
              <div className="absolute left-1/2 top-0 bottom-0 w-[3px] -translate-x-1/2 z-10" style={{ background: accent, boxShadow: `0 0 16px ${accent}` }} />
              <div className="absolute left-1/2 top-0 -translate-x-1/2 z-10" style={{ borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: `10px solid ${accent}` }} />
              <div className="absolute left-1/2 bottom-0 -translate-x-1/2 z-10" style={{ borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderBottom: `10px solid ${accent}` }} />

              {/* Side fades */}
              <div className="absolute left-0 top-0 bottom-0 w-20 z-10 pointer-events-none" style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.95), transparent)' }} />
              <div className="absolute right-0 top-0 bottom-0 w-20 z-10 pointer-events-none" style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.95), transparent)' }} />

              <div
                className="absolute inset-y-0 left-0 flex items-center gap-2 will-change-transform"
                style={{
                  transform: `translateX(${reelOffset}px)`,
                  transition: reelTransition,
                }}
              >
                {reelPrizes.map((p, i) => (
                  <div
                    key={i}
                    className="w-40 h-36 shrink-0 rounded-xl border relative overflow-hidden grid grid-rows-[1fr_auto]"
                    style={{
                      borderColor: rarityColor(p.rarity) + '66',
                      background: `linear-gradient(180deg, ${rarityColor(p.rarity)}22 0%, rgba(0,0,0,0.4) 100%)`,
                    }}
                  >
                    <div className="flex items-center justify-center p-2 min-h-0 overflow-hidden">
                      {p.image
                        ? <img src={p.image} alt={p.label} className="max-h-full max-w-full object-contain" />
                        : <div className="text-4xl leading-none">🎁</div>}
                    </div>
                    <div className="text-[11px] font-semibold text-center line-clamp-1 px-2 py-1.5 border-t border-white/5 bg-black/30">{p.label}</div>
                    <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: rarityColor(p.rarity) }} />
                  </div>
                ))}
              </div>
            </div>
            )}

            {/* Scratch card */}
            {phase === 'scratch' && (
              <div className="mb-6">
                <div className="grid grid-cols-3 gap-2 max-w-sm mx-auto">
                  {scratchCells.map((cell, idx) => {
                    const revealed = scratchedIdx.has(idx);
                    return (
                      <div
                        key={idx}
                        className="aspect-square rounded-xl relative overflow-hidden border border-white/10"
                        style={{
                          background: `linear-gradient(180deg, ${accent}22 0%, rgba(0,0,0,0.4) 100%)`,
                        }}
                      >
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-1">
                          {cell.image
                            ? <img src={cell.image} alt={cell.label} draggable={false} className="max-h-[60%] max-w-[80%] object-contain pointer-events-none select-none" />
                            : <div className="text-3xl">🎁</div>}
                          <div className="text-[10px] font-bold mt-1 text-center line-clamp-1 px-1">{cell.label}</div>
                        </div>
                        <ScratchCell
                          revealed={revealed}
                          accent={accent}
                          onReveal={() => handleScratchCell(idx)}
                        >
                          <></>
                        </ScratchCell>
                      </div>
                    );
                  })}
                </div>
                <div className="text-center mt-4 text-xs opacity-60">
                  {scratchedIdx.size}/9 raspadas — clique em todas as áreas
                </div>
              </div>
            )}

            {/* Idle: ready to spin */}
            {phase === 'idle' && (
              <div className="text-center pt-2">
                <button
                  onClick={() => handleOpenCase(openingCase)}
                  disabled={authedUser.tokens_balance < openingCase.price_tokens}
                  className="px-8 py-3 rounded-xl font-bold text-base transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  style={{ background: accent, color: pc.btnTextColor || '#000', boxShadow: `0 0 24px ${accent}55` }}
                >
                  {authedUser.tokens_balance < openingCase.price_tokens
                    ? `${coinName} insuficientes`
                    : `Sortear · ${openingCase.price_tokens} ${coinName}`}
                </button>
              </div>
            )}

            {/* Winner reveal */}
            {phase === 'done' && winner && (() => {
              const final = scratchWinner || winner;
              const finalAmount = (scratchWinner?.amount ?? winner.amount) || 0;
              return (
              <div className="text-center space-y-3 animate-fade-in">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10" style={{ background: rarityColor(winner.rarity) + '22', color: rarityColor(winner.rarity) }}>
                  <Sparkles size={16} />
                  <span className="text-sm font-bold uppercase tracking-wider">{scratchWinner ? '🎟️ Raspadinha' : (winner.rarity || 'Prêmio')}</span>
                </div>
                {final.image && <img src={final.image} alt={final.label} className="mx-auto max-h-24 object-contain" />}
                <div className="text-2xl font-bold">{final.label}</div>
                {finalAmount > 0 && (
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
              );
            })()}
          </div>
        </div>
      )}

      {/* Prizes preview modal */}
      {prizesPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4" onClick={() => setPrizesPreview(null)}>
          <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-black/60 p-6 shadow-[0_8px_60px_rgba(0,0,0,0.8)]" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPrizesPreview(null)} className="absolute top-3 right-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition">
              <X size={18} />
            </button>
            <div className="text-center mb-5">
              <h3 className="text-xl font-bold">{prizesPreview.name}</h3>
              <p className="text-xs opacity-60 mt-1">{prizesPreview.prizes.length} prêmios possíveis</p>
            </div>
            <div className="overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pr-1">
              {prizesPreview.prizes.map((p, i) => {
                const totalWeight = prizesPreview.prizes.reduce((s, x) => s + (x.weight || 1), 0);
                const chance = ((p.weight || 1) / totalWeight) * 100;
                return (
                  <div
                    key={i}
                    className="rounded-xl border p-3 flex flex-col items-center gap-2 relative overflow-hidden"
                    style={{
                      borderColor: rarityColor(p.rarity) + '66',
                      background: `linear-gradient(180deg, ${rarityColor(p.rarity)}22 0%, rgba(0,0,0,0.4) 100%)`,
                    }}
                  >
                    <div className="h-16 flex items-center justify-center">
                      {p.image
                        ? <img src={p.image} alt={p.label} className="max-h-full max-w-full object-contain" />
                        : <div className="text-3xl">🎁</div>}
                    </div>
                    <div className="text-xs font-semibold text-center line-clamp-2">{p.label}</div>
                    <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: rarityColor(p.rarity) }} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Luckybox;
