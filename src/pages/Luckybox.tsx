import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Coins, Eye, LogOut, Package, Sparkles, X, HelpCircle } from 'lucide-react';
import ScratchCell from '@/components/casino/ScratchCell';
import { scheduleCaseTicks, cancelCaseTicks, primeCaseTicks } from '@/lib/caseTickSound';
import AuthNoticeBanner from '@/components/AuthNoticeBanner';

const PRIZE_WIN_SOUND_URL = '/sounds/prize-win.mp3';
let prizeWinAudio: HTMLAudioElement | null = null;
let prizeWinPrimed = false;
const ensurePrizeWinAudio = () => {
  if (prizeWinAudio) return prizeWinAudio;
  if (typeof window === 'undefined') return null;
  prizeWinAudio = new Audio(PRIZE_WIN_SOUND_URL);
  prizeWinAudio.preload = 'auto';
  prizeWinAudio.volume = 0.85;
  try { prizeWinAudio.load(); } catch { /* noop */ }
  return prizeWinAudio;
};
const primePrizeWinSound = () => {
  const a = ensurePrizeWinAudio();
  if (!a || prizeWinPrimed) return;
  prizeWinPrimed = true;
  try {
    a.muted = true;
    const p = a.play();
    if (p && typeof p.then === 'function') {
      p.then(() => { a.pause(); a.currentTime = 0; a.muted = false; })
        .catch(() => { a.muted = false; });
    } else {
      a.pause(); a.currentTime = 0; a.muted = false;
    }
  } catch { /* noop */ }
};
const playPrizeWinSound = () => {
  const a = ensurePrizeWinAudio();
  if (!a) return;
  try {
    a.currentTime = 0;
    a.play().catch(() => {});
  } catch { /* noop */ }
};
ensurePrizeWinAudio();

// Preload a list of image URLs in parallel. Resolves when all complete (or
// after `timeoutMs`), so the reel never starts spinning over blank cards.
const preloadImages = (urls: (string | undefined | null)[], timeoutMs = 2500): Promise<void> => {
  const unique = Array.from(new Set(urls.filter(Boolean) as string[]));
  if (unique.length === 0) return Promise.resolve();
  return new Promise((resolve) => {
    let remaining = unique.length;
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    const tick = () => { remaining--; if (remaining <= 0) finish(); };
    unique.forEach((src) => {
      const img = new Image();
      img.decoding = 'async';
      (img as any).fetchPriority = 'high';
      img.onload = tick;
      img.onerror = tick;
      img.src = src;
    });
    setTimeout(finish, timeoutMs);
  });
};

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
interface CasePoolItem { case_id: string; weight: number }
interface LuckyCase {
  id: string;
  name: string;
  price_tokens: number;
  image_url: string;
  rarity: string;
  prizes: CasePrize[];
  mode?: 'probability' | 'pool' | 'case_pool';
  prize_type?: 'pix' | 'tokens';
  prize_pool?: { quantity?: number; items?: CasePoolItem[] } | any;
  claim_enabled?: boolean;
  claim_opens_at?: string | null;
  claim_closes_at?: string | null;
  claim_quantity?: number;
  claim_recurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
}
interface DrawnCase {
  case_id: string;
  name: string;
  image_url: string;
  rarity: string;
  price_tokens: number;
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
  epic: '#60A5FA',
  legendary: '#A855F7',
  mythic: '#EF4444',
  supreme: '#FACC15',
  mystery: '#EC4899',
};
const rarityColor = (r?: string) => RARITY_COLOR[(r || 'common').toLowerCase()] || '#9CA3AF';
const scratchPrizeKey = (p?: ScratchPrize | null) => `${p?.image || ''}|${p?.label || ''}|${p?.amount ?? ''}`;
const DEFAULT_LUCKYBOX_OPEN_AUDIO_URL = '/sounds/luckybox-open-default.mp3';
const SYNCED_LUCKYBOX_AUDIO_DURATION_MS = 11389;
const SYNCED_LUCKYBOX_AUDIO_STEPS = 37;
const SYNCED_LUCKYBOX_AUDIO_EASING = 'linear(0 0%, 0.0270 0.70%, 0.0541 3.51%, 0.0811 5.88%, 0.1081 7.90%, 0.1351 9.57%, 0.1622 11.06%, 0.1892 13.96%, 0.2162 16.07%, 0.2432 17.38%, 0.2703 18.53%, 0.2973 19.58%, 0.3243 20.81%, 0.3514 22.13%, 0.3784 23.18%, 0.4054 24.41%, 0.4324 25.73%, 0.4595 26.60%, 0.4865 27.92%, 0.5135 33.89%, 0.5405 40.21%, 0.5676 41.97%, 0.5946 43.64%, 0.6216 45.57%, 0.6486 47.32%, 0.6757 49.43%, 0.7027 51.45%, 0.7297 53.73%, 0.7568 56.28%, 0.7838 58.91%, 0.8108 61.55%, 0.8378 64.71%, 0.8649 68.13%, 0.8919 72.00%, 0.9189 76.39%, 0.9459 81.74%, 0.9730 88.06%, 1.0000 97.20%, 1 100%)';

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
  const [showRules, setShowRules] = useState(false);

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
  const [drawnCases, setDrawnCases] = useState<DrawnCase[]>([]);
  const [signupRefCode, setSignupRefCode] = useState<string>('');
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [nowTs, setNowTs] = useState(Date.now());
  const [userClaims, setUserClaims] = useState<Record<string, string>>({});

  const formatCountdown = (ms: number) => {
    if (ms <= 0) return '0s';
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${sec}s`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
  };

  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);


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
      // Fetch a default referral code for this operator so the signup link tracks them
      if (data.config?.owner_id) {
        const { data: refCode } = await (supabase as any)
          .rpc('get_default_referral_code', { p_owner_id: data.config.owner_id });
        if (refCode) setSignupRefCode(refCode);
      }
    })();
  }, [tag]);

  // SEO
  useEffect(() => {
    if (!cfg) return;
    const cleanups: (() => void)[] = [];
    const prevTitle = document.title;
    document.title = pc.seoTitle || pc.title || `Caixa Misteriosa ${cfg.tag}`;
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
      try {
        const parsed = JSON.parse(raw);
        setAuthedUser(parsed);
        if (parsed?.email && parsed?.account_id) {
          fetchUserClaims(cfg.owner_id, parsed.email, parsed.account_id);
        }
      } catch {}
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
      const { data, error } = await (supabase as any).rpc('authenticate_luckybox_user', {
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
      // fetch tokens balance + case_grants via RPC (works for anon users)
      const { data: uData } = await (supabase as any).rpc('get_luckybox_user_state', { p_user_id: user.id });
      const u = uData?.found ? uData : null;
      // Strict validation: email AND account_id must match exactly
      const inputEmail = loginEmail.trim().toLowerCase();
      const inputAccount = loginAccount.trim();
      const dbEmail = (u?.email || user.email || '').trim().toLowerCase();
      const dbAccount = (u?.account_id || user.account_id || '').trim();
      if (dbEmail !== inputEmail || dbAccount !== inputAccount) {
        toast.error('E-mail ou ID da Conta inválidos');
        return;
      }
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
      fetchUserClaims(cfg!.owner_id, sess.email, sess.account_id);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao entrar');
    } finally {
      setLogging(false);
    }
  };

  const refreshTokens = async () => {
    if (!authedUser) return;
    const { data } = await (supabase as any).rpc('get_luckybox_user_state', { p_user_id: authedUser.id });
    if (data?.found) {
      const updated = { ...authedUser, tokens_balance: data.tokens_balance ?? 0, case_grants: (data.case_grants as Record<string, number>) || {} };
      setAuthedUser(updated);
      sessionStorage.setItem(`luckybox_user_${cfg!.tag}`, JSON.stringify(updated));
    }
  };

  const fetchUserClaims = async (ownerId: string, email: string, account: string) => {
    try {
      const { data } = await (supabase as any).rpc('get_user_case_claims', {
        p_owner_id: ownerId,
        p_email: email,
        p_account_id: account,
      });
      setUserClaims((data && typeof data === 'object') ? data as Record<string, string> : {});
    } catch {
      setUserClaims({});
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
      // Collect fraud-prevention metadata (best-effort, never blocks redemption)
      const ua = navigator.userAgent || '';
      const parseUA = (s: string) => {
        let browser = 'Desconhecido', os = 'Desconhecido', device = 'Desktop';
        if (s.includes('Firefox/')) browser = 'Firefox';
        else if (s.includes('Edg/')) browser = 'Edge';
        else if (s.includes('OPR/') || s.includes('Opera')) browser = 'Opera';
        else if (s.includes('Chrome/')) browser = 'Chrome';
        else if (s.includes('Safari/')) browser = 'Safari';
        if (s.includes('Windows')) os = 'Windows';
        else if (s.includes('Mac OS')) os = 'macOS';
        else if (s.includes('Android')) os = 'Android';
        else if (s.includes('iPhone') || s.includes('iPad') || s.includes('iOS')) os = 'iOS';
        else if (s.includes('Linux')) os = 'Linux';
        if (/iPad|Tablet/i.test(s)) device = 'Tablet';
        else if (/Mobile|Android|iPhone/i.test(s)) device = 'Mobile';
        return { browser, os, device };
      };
      const { browser, os, device } = parseUA(ua);
      let ip: string | null = null, city: string | null = null, region: string | null = null, country: string | null = null;
      try {
        const r = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3500) });
        if (r.ok) {
          const j = await r.json();
          ip = j.ip || null; city = j.city || null; region = j.region || null; country = j.country_name || null;
        }
      } catch {}

      const { data, error } = await (supabase as any).rpc('redeem_luckybox_grant', {
        p_owner_id: cfg.owner_id,
        p_account_id: authedUser.account_id,
        p_email: authedUser.email,
        p_code: code,
        p_ip: ip,
        p_user_agent: ua,
        p_city: city,
        p_region: region,
        p_country: country,
        p_device: device,
        p_os: os,
        p_browser: browser,
      });
      if (error) throw error;
      if (!data?.success) { toast.error(data?.error || 'Falha no resgate'); return; }
      toast.success(`🎁 ${data.quantity}× ${data.case_name} liberada!`);
      try {
        supabase.functions.invoke('send-owner-notification', {
          body: {
            ownerId: cfg.owner_id,
            type: 'luckybox_redeemed',
            payload: {
              userName: authedUser.name,
              userEmail: authedUser.email,
              accountId: authedUser.account_id,
              caseName: data.case_name,
              quantity: data.quantity,
              code,
            },
          },
        });
      } catch {}
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

  const buildReel = (prizes: CasePrize[], winnerIndex: number, syncedSteps?: number): { reel: CasePrize[]; targetIndex: number } => {
    // Build a long reel of ~60 random prizes + ensure winner sits at a specific index near the end
    const n = 60;

    // Identify the highest-value prize to create the "almost won the jackpot" suspense
    const prizeValue = (p: CasePrize) => {
      const direct = Number((p as any)?.amount) || 0;
      const subs = Array.isArray((p as any)?.scratchPrizes) ? (p as any).scratchPrizes : [];
      const subMax = subs.reduce((m: number, s: any) => Math.max(m, Number(s?.amount) || 0), 0);
      return Math.max(direct, subMax);
    };
    let bestIdx = 0;
    let bestVal = -Infinity;
    prizes.forEach((p, i) => {
      const v = prizeValue(p);
      if (v > bestVal) { bestVal = v; bestIdx = i; }
    });

    // Weighted pool: prizes appear in the reel proportional to value (good prizes show more often)
    const weights = prizes.map(p => Math.max(1, prizeValue(p)));
    const totalW = weights.reduce((a, b) => a + b, 0);
    const pickWeighted = () => {
      let r = Math.random() * totalW;
      for (let i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r <= 0) return prizes[i];
      }
      return prizes[prizes.length - 1];
    };

    const reel: CasePrize[] = [];
    for (let i = 0; i < n; i++) reel.push(pickWeighted());

    const target = syncedSteps ? Math.min(n - 8, Math.max(8, syncedSteps)) : n - 8;
    reel[target] = prizes[winnerIndex];

    // Place the best prize right next to the winner (suspense neighbors)
    if (prizes.length > 1 && bestIdx !== winnerIndex) {
      if (target - 1 >= 0) reel[target - 1] = prizes[bestIdx];
      if (target + 1 < n) reel[target + 1] = prizes[bestIdx];
    }
    return { reel, targetIndex: target };
  };

  const handleClaimCase = async (c: LuckyCase) => {
    if (!authedUser || !cfg) return;
    setClaimingId(c.id);
    try {
      const { data, error } = await (supabase as any).rpc('claim_luckybox_case', {
        p_owner_id: cfg.owner_id,
        p_email: authedUser.email,
        p_account_id: authedUser.account_id,
        p_case_id: c.id,
      });
      if (error) throw error;
      if (!data?.success) {
        toast.error(data?.error || 'Não foi possível resgatar');
        return;
      }
      const newGrants = (data.case_grants as Record<string, number>) || authedUser.case_grants || {};
      const updated = { ...authedUser, case_grants: newGrants };
      setAuthedUser(updated);
      try { sessionStorage.setItem(`luckybox_user_${cfg.tag}`, JSON.stringify(updated)); } catch {}
      setUserClaims(prev => ({ ...prev, [c.id]: (data.last_claim_at as string) || new Date().toISOString() }));
      toast.success(`🎁 ${data.quantity || 1} caixa(s) resgatada(s)!`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao resgatar');
    } finally {
      setClaimingId(null);
    }
  };

  const handleOpenCase = async (c: LuckyCase) => {
    if (!authedUser) return;
    // Prime audio inside the user gesture so the very first opening plays
    // sounds without delay (browsers block audio until user interacts).
    primeCaseTicks();
    primePrizeWinSound();
    const grantQty = (authedUser.case_grants?.[c.id] || 0);
    if (grantQty <= 0 && authedUser.tokens_balance < c.price_tokens) {
      toast.error(`${cfg.coin_name || 'Coins'} insuficientes`);
      return;
    }
    setOpeningCase(c);
    setWinner(null);
    setDrawnCases([]);
    setPhase('spinning');

    const spinDurationMs = 10000;

    // ===== CASE POOL MODE: opens a "box of boxes" =====
    if (c.mode === 'case_pool') {
      try {
        const { data, error } = await (supabase as any).rpc('open_luckybox_case_pool', {
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
        const drawn: DrawnCase[] = data.drawn || [];
        // Update tokens + grants
        const updated = {
          ...authedUser,
          tokens_balance: data.tokens_balance ?? authedUser.tokens_balance,
          case_grants: (data.case_grants as Record<string, number>) || authedUser.case_grants || {},
        };
        setAuthedUser(updated);
        sessionStorage.setItem(`luckybox_user_${cfg!.tag}`, JSON.stringify(updated));

        // Build a reel of cases (treat each case as a CasePrize-like item)
        const poolItems = (c.prize_pool?.items || []) as CasePoolItem[];
        const poolCases: LuckyCase[] = poolItems
          .map(it => cases.find(x => x.id === it.case_id))
          .filter(Boolean) as LuckyCase[];
        const reelSource: LuckyCase[] = poolCases.length > 0 ? poolCases : (drawn.map(d => ({
          id: d.case_id, name: d.name, image_url: d.image_url, rarity: d.rarity, price_tokens: d.price_tokens, prizes: [],
        })) as any);

        const target = drawn[0];
        const fakePrizes: CasePrize[] = reelSource.map(rc => ({
          label: rc.name, image: rc.image_url, rarity: rc.rarity,
        }));
        const winIdx = Math.max(0, reelSource.findIndex(rc => rc.id === target?.case_id));
        const { reel, targetIndex } = buildReel(fakePrizes, winIdx);
        setReelPrizes(reel);
        setReelOffset(0);
        setReelTransition('none');

        try {
          supabase.functions.invoke('send-owner-notification', {
            body: {
              ownerId: cfg!.owner_id,
              type: 'luckybox_purchased',
              payload: {
                userName: authedUser.name,
                userEmail: authedUser.email,
                accountId: authedUser.account_id,
                caseName: c.name,
                priceTokens: data.used_grant ? 0 : c.price_tokens,
                coinName: cfg?.coin_name || 'Coins',
              },
            },
          });
        } catch {}

        // Wait for all reel images to finish loading so the animation
        // doesn't start over blank cards on slow mobile networks.
        await preloadImages(reel.map(p => p.image));

        requestAnimationFrame(() => {
          setTimeout(() => {
            const itemWidth = 168;
            const cardHalf = 80;
            const reelEl = document.getElementById('luckybox-reel-viewport');
            const halfViewport = reelEl ? reelEl.clientWidth / 2 : 0;
            const jitter = (Math.random() - 0.5) * 80;
            const offset = halfViewport - (targetIndex * itemWidth) - cardHalf + jitter;
            setReelTransition(`transform ${spinDurationMs}ms cubic-bezier(0.16, 0.84, 0.3, 1)`);
            setReelOffset(offset);
            scheduleCaseTicks({
              durationMs: spinDurationMs,
              finalOffset: offset,
              itemWidth,
              cardHalf,
              itemCount: reel.length,
              halfViewport,
            });
            setTimeout(() => {
              playPrizeWinSound();
              setDrawnCases(drawn);
              setWinner({ label: c.name, image: c.image_url, rarity: c.rarity } as any);
              setPhase('done');
            }, spinDurationMs + 200);
          }, 50);
        });
      } catch (err: any) {
        toast.error(err.message || 'Erro');
        setOpeningCase(null);
        setPhase('idle');
      }
      return;
    }

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

      // Update tokens + case_grants
      const updated = {
        ...authedUser,
        tokens_balance: data.tokens_balance ?? (data.used_grant ? authedUser.tokens_balance : authedUser.tokens_balance - c.price_tokens),
        case_grants: (data.case_grants as Record<string, number>) || authedUser.case_grants || {},
      };
      setAuthedUser(updated);
      sessionStorage.setItem(`luckybox_user_${cfg!.tag}`, JSON.stringify(updated));

      // Notify owner: caixa aberta (compra + prêmio em uma única mensagem)
      try {
        const finalPrize: any = (prize?.scratch && data.scratch_prize) ? data.scratch_prize : prize;
        supabase.functions.invoke('send-owner-notification', {
          body: {
            ownerId: cfg!.owner_id,
            type: 'luckybox_opened',
            payload: {
              userName: authedUser.name,
              userEmail: authedUser.email,
              accountId: authedUser.account_id,
              caseName: c.name,
              priceTokens: data.used_grant ? 0 : c.price_tokens,
              coinName: cfg?.coin_name || 'Coins',
              prizeLabel: finalPrize?.label || '',
              prizeAmount: finalPrize?.amount || 0,
            },
          },
        });
      } catch {}

      // Preload reel + scratch images so the animation starts smoothly on mobile.
      await preloadImages([
        ...reel.map(p => p.image),
        ...((prize?.scratchPrizes || []).map((s: any) => s?.image)),
      ]);

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
          setReelTransition(`transform ${spinDurationMs}ms cubic-bezier(0.16, 0.84, 0.3, 1)`);
          setReelOffset(offset);
          scheduleCaseTicks({
            durationMs: spinDurationMs,
            finalOffset: offset,
            itemWidth,
            cardHalf,
            itemCount: reel.length,
            halfViewport,
          });

          setTimeout(() => {
            setWinner(prize);
            // Mystery scratch prize: build 3x3 grid with the winner sub-prize as 3 matches
            if (prize?.scratch && data.scratch_prize) {
              // sound plays when scratch reveals the win
            } else {
              playPrizeWinSound();
            }
            if (prize?.scratch && data.scratch_prize) {
              const sub: ScratchPrize = data.scratch_prize;
              const allPrizes: ScratchPrize[] = (prize.scratchPrizes || []);
              const winnerKey = scratchPrizeKey(sub);
              let pool: ScratchPrize[] = allPrizes.filter(x => scratchPrizeKey(x) !== winnerKey);
              if (pool.length === 0) {
                pool = [
                  { label: '✦', image: '' },
                  { label: '★', image: '' },
                  { label: '✪', image: '' },
                  { label: '❖', image: '' },
                ];
              }
              const cells: ScratchPrize[] = [];
              for (let i = 0; i < 3; i++) cells.push(sub);
              const counts: Record<string, number> = {};
              let safety = 0;
              while (cells.length < 9 && safety++ < 500) {
                const cand = pool[Math.floor(Math.random() * pool.length)];
                const candKey = scratchPrizeKey(cand);
                if (candKey === winnerKey) continue;
                if ((counts[candKey] || 0) >= 2) continue;
                counts[candKey] = (counts[candKey] || 0) + 1;
                cells.push(cand);
              }
              while (cells.length < 9) cells.push({ label: '✦', image: '' });
              const shuffle = (arr: ScratchPrize[]) => {
                for (let i = arr.length - 1; i > 0; i--) {
                  const j = Math.floor(Math.random() * (i + 1));
                  [arr[i], arr[j]] = [arr[j], arr[i]];
                }
              };
              const lines = [
                [0,1,2],[3,4,5],[6,7,8],
                [0,3,6],[1,4,7],[2,5,8],
                [0,4,8],[2,4,6],
              ];
              const winnerAligned = () => {
                const idxs = cells.map((c, i) => scratchPrizeKey(c) === winnerKey ? i : -1).filter(i => i >= 0);
                return lines.some(line => line.every(i => idxs.includes(i)));
              };
              let tries = 0;
              do { shuffle(cells); tries++; } while (winnerAligned() && tries < 50);
              setScratchCells(cells);
              setScratchedIdx(new Set());
              setScratchWinner(sub);
              setPhase('scratch');
            } else {
              setPhase('done');
            }
          }, spinDurationMs + 200);
        }, 50);
      });
    } catch (err: any) {
      toast.error(err.message || 'Erro');
      setOpeningCase(null);
      setPhase('idle');
    }
  };

  const scratchStorageKey = (uid: string) => `luckybox_pending_scratch_${cfg?.tag}_${uid}`;

  const closeOpening = () => {
    if (phase === 'scratch') return; // não permite fechar durante raspadinha
    if (authedUser && cfg) sessionStorage.removeItem(scratchStorageKey(authedUser.id));
    setOpeningCase(null);
    setWinner(null);
    setPhase('idle');
    setReelOffset(0);
    setReelPrizes([]);
    setScratchCells([]);
    setScratchedIdx(new Set());
    setScratchWinner(null);
    setDrawnCases([]);
    refreshTokens();
  };

  const handleScratchCell = (idx: number) => {
    setScratchedIdx(prev => {
      const next = new Set(prev);
      next.add(idx);
      // persist progress
      if (authedUser && cfg && openingCase && scratchWinner) {
        sessionStorage.setItem(scratchStorageKey(authedUser.id), JSON.stringify({
          caseId: openingCase.id,
          cells: scratchCells,
          scratched: Array.from(next),
          winner,
          scratchWinner,
        }));
      }
      return next;
    });
  };

  // Persist scratch state when entering scratch phase
  useEffect(() => {
    if (phase === 'scratch' && authedUser && cfg && openingCase && scratchWinner && scratchCells.length === 9) {
      sessionStorage.setItem(scratchStorageKey(authedUser.id), JSON.stringify({
        caseId: openingCase.id,
        cells: scratchCells,
        scratched: Array.from(scratchedIdx),
        winner,
        scratchWinner,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, scratchCells, scratchWinner]);

  // Restore unfinished scratch on mount/login
  useEffect(() => {
    if (!authedUser || !cfg || cases.length === 0) return;
    if (phase !== 'idle') return;
    const raw = sessionStorage.getItem(scratchStorageKey(authedUser.id));
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      const c = cases.find(x => x.id === data.caseId);
      if (!c || !data.cells || !data.scratchWinner) return;
      setOpeningCase(c);
      setScratchCells(data.cells);
      setScratchedIdx(new Set(data.scratched || []));
      setWinner(data.winner);
      setScratchWinner(data.scratchWinner);
      setPhase('scratch');
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authedUser?.id, cases.length]);

  useEffect(() => {
    if (phase !== 'scratch') return;
    // Auto-finish: if the 3 winning cells are already revealed, no need to scratch the rest
    const winnerKey = scratchPrizeKey(scratchWinner);
    const winnerRevealed = scratchCells.length === 9 && winnerKey
      ? scratchCells.every((c, i) => scratchPrizeKey(c) !== winnerKey || scratchedIdx.has(i))
      : false;
    if (winnerRevealed || scratchedIdx.size >= 9) {
      const t = setTimeout(() => { playPrizeWinSound(); setPhase('done'); }, 800);
      return () => clearTimeout(t);
    }
  }, [phase, scratchedIdx, scratchCells, scratchWinner]);

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
          <h1 className="text-xl font-bold">Caixa Misteriosa indisponível</h1>
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
          <p className="text-muted-foreground text-sm">Esta página de Caixa Misteriosa não existe ou foi desativada.</p>
        </div>
      </div>
    );
  }

  // Login screen
  if (!authedUser) {
    const accent = pc.accentColor || '#22d3ee';
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden text-white" style={bgStyle}>
        <AuthNoticeBanner ownerId={cfg?.owner_id} />
        <form onSubmit={handleLogin} className="relative z-10 w-full max-w-sm mx-4 rounded-2xl p-6 space-y-5 border border-white/10 bg-black/40 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
          <div className="text-center space-y-2">
            {pc.logoUrl
              ? <img src={pc.logoUrl} alt="logo" className="max-h-20 mx-auto object-contain" />
              : <div className="text-4xl">🎁</div>}
            <h1 className="text-xl font-bold" style={{ color: pc.titleColor || '#fff' }}>{pc.title || 'Caixa Misteriosa'}</h1>
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
          <p className="text-center text-xs" style={{ color: pc.subtitleColor || 'rgba(255,255,255,0.7)' }}>
            Não tem conta ainda?{' '}
            <a href={signupRefCode ? `/gorjeta?ref=${signupRefCode}` : '/gorjeta'} className="font-semibold underline-offset-2 hover:underline" style={{ color: accent }}>
              Clique aqui
            </a>
          </p>
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
  const getPreviewPrizes = (caseData: LuckyCase): CasePrize[] => {
    if (caseData.mode !== 'case_pool') return caseData.prizes || [];
    const poolItems = (caseData.prize_pool?.items || []) as CasePoolItem[];
    return poolItems
      .map(item => {
        const pooledCase = cases.find(x => x.id === item.case_id);
        if (!pooledCase) return null;
        return {
          label: pooledCase.name,
          image: pooledCase.image_url,
          rarity: pooledCase.rarity,
          weight: item.weight,
        } as CasePrize;
      })
      .filter(Boolean) as CasePrize[];
  };
  return (
    <div className="min-h-screen text-white" style={bgStyle}>
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-black/40 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {pc.logoUrl
              ? <img src={pc.logoUrl} alt="logo" className="h-9 object-contain" />
              : <div className="text-2xl">🎁</div>}
            <h1 className="text-lg font-bold" style={{ color: pc.titleColor || '#fff' }}>{pc.title || 'Caixa Misteriosa'}</h1>
          </div>
          <div className="flex items-center gap-3">
            {pc.rulesText && (
              <button
                onClick={() => setShowRules(true)}
                className="w-8 h-8 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 transition flex items-center justify-center"
                title={pc.rulesTitle || 'Regras'}
                aria-label="Ver regras"
              >
                <HelpCircle size={16} />
              </button>
            )}
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

      {showRules && pc.rulesText && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setShowRules(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b0f1a] p-5 shadow-2xl"
            style={{ borderColor: (pc.accentColor || '#22d3ee') + '40' }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <HelpCircle size={18} style={{ color: pc.accentColor || '#22d3ee' }} />
                {pc.rulesTitle || 'Regras'}
              </h3>
              <button
                onClick={() => setShowRules(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition"
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </div>
            <div className="text-sm whitespace-pre-wrap opacity-90 leading-relaxed max-h-[60vh] overflow-y-auto">
              {pc.rulesText}
            </div>
          </div>
        </div>
      )}

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
              const cantAfford = !isFree && (c.claim_enabled || authedUser.tokens_balance < c.price_tokens);
              const opensAt = c.claim_opens_at ? new Date(c.claim_opens_at).getTime() : null;
              const closesAt = c.claim_closes_at ? new Date(c.claim_closes_at).getTime() : null;
              const windowOpen = !!c.claim_enabled
                && (opensAt === null || nowTs >= opensAt)
                && (closesAt === null || nowTs <= closesAt);
              const claimUpcoming = !!c.claim_enabled && opensAt !== null && nowTs < opensAt;
              const recurrence = c.claim_recurrence || 'none';
              const intervalMs = recurrence === 'daily' ? 86400000
                : recurrence === 'weekly' ? 604800000
                : recurrence === 'monthly' ? 2592000000
                : 0;
              const lastClaimStr = userClaims[c.id];
              const lastClaimTs = lastClaimStr ? new Date(lastClaimStr).getTime() : null;
              const nextAvailableTs = (lastClaimTs && intervalMs > 0) ? lastClaimTs + intervalMs : null;
              const isLockedByRecurrence = !!(nextAvailableTs && nowTs < nextAvailableTs);
              const alreadyClaimedOnce = !!lastClaimTs && recurrence === 'none';
              const claimOpen = windowOpen && !alreadyClaimedOnce && !isLockedByRecurrence;
              const showClaim = claimOpen;
              const showCountdown = windowOpen && isLockedByRecurrence;
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
                      let previewSource: CasePrize[] = c.prizes;
                      if (c.mode === 'case_pool') {
                        const poolItems = (c.prize_pool?.items || []) as CasePoolItem[];
                        const poolCases = poolItems
                          .map(it => cases.find(x => x.id === it.case_id))
                          .filter(Boolean) as LuckyCase[];
                        previewSource = poolCases.map(rc => ({
                          label: rc.name, image: rc.image_url, rarity: rc.rarity,
                        }));
                      }
                      if (previewSource.length === 0) previewSource = [{ label: '?' }];
                      for (let i = 0; i < 30; i++) preview.push(previewSource[Math.floor(Math.random() * previewSource.length)]);
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
                      ) : c.claim_enabled ? (
                        <span className="text-sm">🎁 Evento</span>
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
                  {showClaim && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleClaimCase(c); }}
                      disabled={claimingId === c.id}
                      className="relative z-10 mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition disabled:opacity-60"
                      style={{ background: accent, color: '#000' }}
                    >
                      {claimingId === c.id ? 'Resgatando...' : `🎁 Resgatar grátis${(c.claim_quantity || 1) > 1 ? ` ×${c.claim_quantity}` : ''}`}
                    </button>
                  )}
                  {claimUpcoming && (
                    <div className="relative z-10 mt-2 w-full text-center px-2 py-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 text-[10px] font-semibold text-amber-200">
                      🎁 Abre em {new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(opensAt!))}
                    </div>
                  )}
                  {showCountdown && (
                    <div className="relative z-10 mt-2 w-full text-center px-2 py-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 text-[10px] font-semibold text-amber-200">
                      ⏳ Próximo resgate em {formatCountdown(nextAvailableTs! - nowTs)}
                    </div>
                  )}
                  {windowOpen && alreadyClaimedOnce && (
                    <div className="relative z-10 mt-2 w-full text-center px-2 py-1.5 rounded-lg border border-white/10 bg-white/5 text-[10px] font-semibold opacity-70">
                      ✓ Resgate já utilizado
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>


      {/* Opening modal */}
      {openingCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 sm:backdrop-blur-md">
          <div className="relative w-full max-w-3xl rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-black/40 p-6 shadow-[0_8px_60px_rgba(0,0,0,0.8)]">
            {phase !== 'spinning' && phase !== 'scratch' && (
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
                id="luckybox-reel-inner"
                className="absolute inset-y-0 left-0 flex items-center gap-2 will-change-transform"
                style={{
                  transform: `translate3d(${reelOffset}px, 0, 0)`,
                  transition: reelTransition,
                  backfaceVisibility: 'hidden',
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
                        ? <img src={p.image} alt={p.label} loading="eager" decoding="async" fetchPriority="high" className="max-h-full max-w-full object-contain" />
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
                            : <div className="text-4xl font-black leading-none" style={{ color: accent }}>{cell.label}</div>}
                          {cell.image && <div className="text-[10px] font-bold mt-1 text-center line-clamp-1 px-1">{cell.label}</div>}
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
                {(() => {
                  const gq = authedUser.case_grants?.[openingCase.id] || 0;
                  const free = gq > 0;
                  const cant = !free && authedUser.tokens_balance < openingCase.price_tokens;
                  return (
                    <button
                      onClick={() => handleOpenCase(openingCase)}
                      disabled={cant}
                      className="px-8 py-3 rounded-xl font-bold text-base transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                      style={{ background: accent, color: pc.btnTextColor || '#000', boxShadow: `0 0 24px ${accent}55` }}
                    >
                      {cant
                        ? `${coinName} insuficientes`
                        : free
                        ? `🎁 Abrir grátis (${gq} restante${gq > 1 ? 's' : ''})`
                        : `Sortear · ${openingCase.price_tokens} ${coinName}`}
                    </button>
                  );
                })()}
              </div>
            )}

            {/* Case-pool reveal: list all drawn cases */}
            {phase === 'done' && drawnCases.length > 0 && (
              <div
                className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in"
                onClick={closeOpening}
              >
                <div
                  className="relative w-full max-w-2xl rounded-3xl border p-6 text-center shadow-[0_20px_80px_rgba(0,0,0,0.9)] max-h-[85vh] overflow-y-auto"
                  style={{
                    borderColor: accent + 'aa',
                    background: `radial-gradient(circle at top, ${accent}22, rgba(10,10,15,0.98) 70%)`,
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <button onClick={closeOpening} className="absolute top-3 right-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition">
                    <X size={18} />
                  </button>
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 mb-4" style={{ background: accent + '22', color: accent }}>
                    <Sparkles size={14} />
                    <span className="text-xs font-bold uppercase tracking-wider">📦 Você ganhou {drawnCases.length} caixa{drawnCases.length > 1 ? 's' : ''}!</span>
                  </div>
                  <div className="flex flex-wrap justify-center gap-3 mb-5">
                    {drawnCases.map((d, i) => (
                      <div
                        key={i}
                        className="rounded-xl border p-3 flex flex-col items-center gap-2 relative overflow-hidden w-36"
                        style={{
                          borderColor: rarityColor(d.rarity) + '88',
                          background: `linear-gradient(180deg, ${rarityColor(d.rarity)}22 0%, rgba(0,0,0,0.5) 100%)`,
                        }}
                      >
                        <div className="h-20 flex items-center justify-center">
                          {d.image_url
                            ? <img src={d.image_url} alt={d.name} className="max-h-full max-w-full object-contain drop-shadow-[0_0_16px_rgba(255,255,255,0.2)]" />
                            : <Package size={36} style={{ color: rarityColor(d.rarity) }} />}
                        </div>
                        <div className="text-xs font-bold text-center line-clamp-2">{d.name}</div>
                        <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: rarityColor(d.rarity) }} />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs opacity-70 mb-4">As caixas foram adicionadas ao seu inventário. Feche para abri-las!</p>
                  <button
                    onClick={closeOpening}
                    className="px-8 py-3 rounded-xl font-bold text-base transition shadow-lg"
                    style={{ background: accent, color: pc.btnTextColor || '#000', boxShadow: `0 0 24px ${accent}66` }}
                  >
                    Continuar
                  </button>
                </div>
              </div>
            )}

            {/* Winner reveal — popup overlay on top of opening modal */}
            {phase === 'done' && winner && drawnCases.length === 0 && (() => {
              const final = scratchWinner || winner;
              const finalAmount = (scratchWinner?.amount ?? winner.amount) || 0;
              return (
                <div
                  className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in"
                  onClick={closeOpening}
                >
                  <div
                    className="relative w-full max-w-md rounded-3xl border p-8 text-center shadow-[0_20px_80px_rgba(0,0,0,0.9)]"
                    style={{
                      borderColor: rarityColor(winner.rarity) + 'aa',
                      background: `radial-gradient(circle at top, ${rarityColor(winner.rarity)}33, rgba(10,10,15,0.98) 70%)`,
                      
                    }}
                    onClick={e => e.stopPropagation()}
                  >
                    <button onClick={closeOpening} className="absolute top-3 right-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition">
                      <X size={18} />
                    </button>

                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 mb-4" style={{ background: rarityColor(winner.rarity) + '22', color: rarityColor(winner.rarity) }}>
                      <Sparkles size={14} />
                      <span className="text-xs font-bold uppercase tracking-wider">{scratchWinner ? '🎟️ Raspadinha' : 'Você ganhou!'}</span>
                    </div>

                    <div className="flex items-center justify-center min-h-[140px] mb-4">
                      {final.image
                        ? <img src={final.image} alt={final.label} className="max-h-32 object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.25)]" />
                        : <div className="text-7xl">🎁</div>}
                    </div>

                    <div className="text-3xl font-bold mb-2">{final.label}</div>

                    {finalAmount > 0 && (
                      <div className="text-sm opacity-80 mb-5">Será pago em PIX automaticamente quando aprovado.</div>
                    )}

                    <button
                      onClick={closeOpening}
                      className="px-8 py-3 rounded-xl font-bold text-base transition shadow-lg"
                      style={{ background: accent, color: pc.btnTextColor || '#000', boxShadow: `0 0 24px ${accent}66` }}
                    >
                      Resgatar
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
              <p className="text-xs opacity-60 mt-1">
                {getPreviewPrizes(prizesPreview).length} {prizesPreview.mode === 'case_pool' ? 'caixas possíveis' : 'prêmios possíveis'}
              </p>
            </div>
            <div className="overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pr-1">
              {getPreviewPrizes(prizesPreview).map((p, i) => {
                const previewPrizes = getPreviewPrizes(prizesPreview);
                const totalWeight = previewPrizes.reduce((s, x) => s + (x.weight || 1), 0);
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
