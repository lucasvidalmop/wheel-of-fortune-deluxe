import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, LogOut, Wallet, X, Check, Clock, Store, Share2 } from 'lucide-react';
import { formatBetDateTime, isBetDateTimeExpired } from '@/lib/betsDateTime';
import AuthNoticeBanner from '@/components/AuthNoticeBanner';
import ShareTicket, { type ShareTicketData } from '@/components/casino/ShareTicket';

interface BetsPageProps { tag: string }

interface OutcomeRow { id: string; event_id: string; label: string; odd: number; position: number; is_winner: boolean }
interface EventRow {
  id: string; title: string; subtitle: string; category: string; category_id: string | null; image_url: string;
  starts_at: string | null; closes_at: string | null; status: 'open'|'closed'|'resolved'|'cancelled';
  payout_mode: 'coins' | 'case'; payout_case_id: string | null; payout_case_qty_per_unit: number;
  min_bet: number; max_bet: number; max_bets_per_user: number; position: number; winning_outcome_id: string | null;
  is_hot?: boolean;
}
interface CategoryRow { id: string; name: string; color: string; icon: string; position: number }
interface CaseRow { id: string; name: string; image_url: string; rarity: string }
interface WagerRow {
  id: string; event_id: string; outcome_id: string; amount_coins: number; odd_snapshot: number;
  payout_mode: 'coins'|'case'; status: 'pending'|'won'|'lost'|'refunded'|'cancelled';
  payout_coins: number; payout_grant_id: string | null; created_at: string; resolved_at: string | null;
}

interface AuthedUser { id: string; name: string; email: string; account_id: string; tokens_balance: number }

const Bets = ({ tag }: BetsPageProps) => {
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState<any | null>(null);
  const [authed, setAuthed] = useState<AuthedUser | null>(null);

  // auth screen
  const [authEmail, setAuthEmail] = useState('');
  const [authAccountId, setAuthAccountId] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // bet slip
  const [slip, setSlip] = useState<{ event: EventRow; outcome: OutcomeRow } | null>(null);
  const [amount, setAmount] = useState('');
  const [placing, setPlacing] = useState(false);

  // my bets
  const [tab, setTab] = useState<'events' | 'mine'>('events');
  const [myWagers, setMyWagers] = useState<WagerRow[]>([]);
  const [myEvents, setMyEvents] = useState<any[]>([]);
  const [shareWager, setShareWager] = useState<ShareTicketData | null>(null);

  // load page
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-bets-page', { body: { tag } });
        if (error) throw error;
        setPage(data);
      } catch (e: any) {
        toast.error('Erro ao carregar página');
      } finally {
        setLoading(false);
      }
    })();
  }, [tag]);

  // restore persisted session
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`bets_user_${tag}`);
      if (raw) setAuthed(JSON.parse(raw));
    } catch {}
  }, [tag]);

  // persist authed user across navigations
  useEffect(() => {
    try {
      if (authed) sessionStorage.setItem(`bets_user_${tag}`, JSON.stringify(authed));
      else sessionStorage.removeItem(`bets_user_${tag}`);
    } catch {}
  }, [authed, tag]);

  // SEO/pixels injection
  useEffect(() => {
    const seo: any = page?.pageConfig?.seo;
    if (!seo || Object.keys(seo).length === 0) return;
    const addMeta = (name: string, content: string, property = false) => {
      if (!content) return;
      const sel = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
      let m = document.querySelector(sel) as HTMLMetaElement | null;
      if (!m) { m = document.createElement('meta'); property ? m.setAttribute('property', name) : m.setAttribute('name', name); document.head.appendChild(m); }
      m.setAttribute('content', content);
    };
    if (seo.pageTitle) document.title = seo.pageTitle;
    if (seo.faviconUrl) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = seo.faviconUrl;
    }
    if (seo.pageDescription) { addMeta('description', seo.pageDescription); addMeta('og:description', seo.pageDescription, true); }
    if (seo.pageTitle) addMeta('og:title', seo.pageTitle, true);
    if (seo.ogImage) addMeta('og:image', seo.ogImage, true);
    if (seo.keywords) addMeta('keywords', seo.keywords);
    if (seo.facebookPixelId) {
      const s = document.createElement('script');
      s.innerHTML = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${seo.facebookPixelId}');fbq('track','PageView');`;
      document.head.appendChild(s);
    }
    if (seo.googleAnalyticsId) {
      const g1 = document.createElement('script'); g1.async = true; g1.src = `https://www.googletagmanager.com/gtag/js?id=${seo.googleAnalyticsId}`;
      const g2 = document.createElement('script'); g2.innerHTML = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${seo.googleAnalyticsId}');`;
      document.head.appendChild(g1); document.head.appendChild(g2);
    }
    if (seo.gtmId) {
      const g = document.createElement('script');
      g.innerHTML = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${seo.gtmId}');`;
      document.head.appendChild(g);
    }
    if (seo.tiktokPixelId) {
      const t = document.createElement('script');
      t.innerHTML = `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${seo.tiktokPixelId}');ttq.page();}(window,document,'ttq');`;
      document.head.appendChild(t);
    }
    if (seo.customHeadScript) {
      const div = document.createElement('div');
      div.innerHTML = seo.customHeadScript;
      Array.from(div.childNodes).forEach(n => document.head.appendChild(n));
    }
  }, [page]);

  const cfg = page?.pageConfig || {};
  const bg = cfg.bgColor || '#0b0b14';
  const accent = cfg.accentColor || '#22d3ee';
  const cardBg = cfg.cardBg || '#141425';
  const text = cfg.textColor || '#ffffff';
  const muted = cfg.mutedColor || '#a0a0c0';
  const coinName = page?.coinName || 'Coins';
  const coinIcon = page?.coinIconUrl || '';

  const events: EventRow[] = page?.events || [];
  const outcomesByEvent = useMemo(() => {
    const m: Record<string, OutcomeRow[]> = {};
    (page?.outcomes || []).forEach((o: OutcomeRow) => { (m[o.event_id] ||= []).push(o); });
    return m;
  }, [page]);
  const casesById = useMemo(() => {
    const m: Record<string, CaseRow> = {};
    (page?.cases || []).forEach((c: CaseRow) => { m[c.id] = c; });
    return m;
  }, [page]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = authEmail.trim().toLowerCase();
    const accountId = authAccountId.trim();
    if (!email || !accountId) { toast.error('Preencha e-mail e ID'); return; }
    setAuthLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-user-bets', { body: { tag, email, accountId } });
      if (error) throw error;
      if (!data?.found) { toast.error('Cadastro não encontrado'); return; }
      if (data.user.blacklisted) { toast.error('Conta bloqueada'); return; }
      setAuthed(data.user);
      setMyWagers(data.wagers || []);
      setMyEvents(data.events || []);
    } catch (err: any) {
      toast.error('Falha ao buscar cadastro');
    } finally {
      setAuthLoading(false);
    }
  };

  const refreshMine = async () => {
    if (!authed) return;
    const { data } = await supabase.functions.invoke('get-user-bets', {
      body: { tag, email: authed.email, accountId: authed.account_id },
    });
    if (data?.found) {
      setAuthed(prev => prev ? { ...prev, tokens_balance: data.user.tokens_balance } : prev);
      setMyWagers(data.wagers || []);
      setMyEvents(data.events || []);
    }
  };

  const openSlip = (event: EventRow, outcome: OutcomeRow) => {
    if (!authed) { toast.error('Faça login para apostar'); return; }
    if (event.status !== 'open') { toast.error('Evento fechado'); return; }
    if (isBetDateTimeExpired(event.closes_at)) { toast.error('Apostas encerradas'); return; }
    setSlip({ event, outcome });
    setAmount(String(event.min_bet || 10));
  };

  const placeBet = async () => {
    if (!slip || !authed) return;
    const amt = Math.floor(Number(amount));
    if (!Number.isFinite(amt) || amt <= 0) { toast.error('Valor inválido'); return; }
    if (amt > authed.tokens_balance) { toast.error('Saldo insuficiente'); return; }
    setPlacing(true);
    try {
      const { data, error } = await supabase.functions.invoke('place-bet', {
        body: {
          tag, email: authed.email, accountId: authed.account_id,
          eventId: slip.event.id, outcomeId: slip.outcome.id, amount: amt,
        },
      });
      if (error) throw error;
      if (!data?.success) {
        const errMap: Record<string, string> = {
          max_bets_reached: `Limite de ${data?.max || 1} aposta(s) por usuário neste evento atingido`,
          insufficient_balance: 'Saldo insuficiente',
          event_closed: 'Apostas encerradas',
          event_not_open: 'Evento fechado',
          below_min_bet: `Aposta mínima: ${data?.min}`,
          above_max_bet: `Aposta máxima: ${data?.max}`,
          user_blocked: 'Conta bloqueada',
          user_not_found: 'Usuário não encontrado',
        };
        toast.error(errMap[data?.error] || `Falha: ${data?.error || 'erro desconhecido'}`);
        return;
      }
      toast.success('Aposta confirmada!');
      setAuthed(prev => prev ? { ...prev, tokens_balance: data.tokens_balance } : prev);
      setSlip(null);
      refreshMine();
    } catch (err: any) {
      toast.error('Falha ao apostar');
    } finally {
      setPlacing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: bg, color: text }}>
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!page?.found || !page?.isActive) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: bg, color: text }}>
        <div className="text-center max-w-md p-8 rounded-2xl" style={{ background: cardBg }}>
          <h1 className="text-2xl font-bold mb-2">Apostas indisponíveis</h1>
          <p style={{ color: muted }}>Esta página não está disponível no momento.</p>
        </div>
      </div>
    );
  }

  // Auth screen
  if (!authed) {
    const loginTitle = cfg.loginTitle || cfg.title || 'Apostas';
    const loginSubtitle = cfg.loginSubtitle || cfg.subtitle || 'Entre com seu e-mail e ID da conta para apostar';
    const loginBtnText = cfg.loginBtnText || 'Entrar';
    const titleColor = cfg.titleColor || text;
    const subtitleColor = cfg.subtitleColor || muted;
    const btnTextColor = cfg.btnTextColor || '#000';
    const bgStyle: React.CSSProperties = cfg.bgImage
      ? { backgroundImage: `url(${cfg.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
      : (cfg.bgGradientFrom || cfg.bgGradientTo)
        ? { background: `radial-gradient(ellipse at top, ${cfg.bgGradientFrom || '#1a1230'} 0%, ${cfg.bgGradientTo || '#05040a'} 70%)` }
        : { background: bg };
    const signupHref = cfg.signupUrl || (tag ? `/gorjeta?ref=${tag}` : '/gorjeta');
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden text-white p-4" style={bgStyle}>
        <AuthNoticeBanner ownerId={page?.ownerId} />
        <form onSubmit={handleAuth} className="relative z-10 w-full max-w-sm rounded-2xl p-6 space-y-5 border border-white/10 bg-black/40 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
          <div className="text-center space-y-2">
            {cfg.logoUrl
              ? <img src={cfg.logoUrl} alt="logo" className="max-h-20 mx-auto object-contain" />
              : <div className="text-4xl">🎯</div>}
            <h1 className="text-xl font-bold" style={{ color: titleColor }}>{loginTitle}</h1>
            <p className="text-sm" style={{ color: subtitleColor }}>{loginSubtitle}</p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1 opacity-80">E-mail</label>
              <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)}
                required maxLength={200} autoComplete="email"
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-white/20" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 opacity-80">ID da Conta</label>
              <input type="text" value={authAccountId} onChange={e => setAuthAccountId(e.target.value)}
                required maxLength={50} autoComplete="off"
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-white/20" />
            </div>
          </div>
          <button type="submit" disabled={authLoading}
            className="w-full py-3 rounded-xl font-bold text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: accent, color: btnTextColor }}>
            {authLoading ? <Loader2 className="animate-spin" size={16} /> : null}
            {authLoading ? 'Entrando...' : loginBtnText}
          </button>
          {!cfg.hideSignup && (
            <p className="text-center text-xs" style={{ color: subtitleColor }}>
              {cfg.signupText || 'Não tem conta ainda?'}{' '}
              <a href={signupHref} className="font-semibold underline-offset-2 hover:underline" style={{ color: accent }}>
                {cfg.signupCtaText || 'Clique aqui'}
              </a>
            </p>
          )}
        </form>
      </div>
    );
  }

  const eventStatusBadge = (st: string) => st === 'open' ? 'Aberto' : st === 'closed' ? 'Fechado' : st === 'resolved' ? 'Resolvido' : 'Cancelado';

  const mainBgStyle: React.CSSProperties = cfg.bgImage
    ? { backgroundImage: `url(${cfg.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed', color: text }
    : (cfg.bgGradientFrom || cfg.bgGradientTo)
      ? { background: `radial-gradient(ellipse at top, ${cfg.bgGradientFrom || '#1a1230'} 0%, ${cfg.bgGradientTo || '#05040a'} 70%)`, color: text }
      : { background: bg, color: text };

  return (
    <div className="min-h-screen" style={mainBgStyle}>
      {/* header */}
      <header className="sticky top-0 z-20 backdrop-blur" style={{ background: 'rgba(0,0,0,0.4)', borderBottom: `1px solid ${accent}33` }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {cfg.logoUrl && <img src={cfg.logoUrl} alt="" className="h-9 object-contain" />}
            <div className="min-w-0">
              <div className="font-bold truncate">{cfg.title || 'Apostas'}</div>
              <div className="text-xs truncate" style={{ color: muted }}>{authed.name}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: `${accent}22`, border: `1px solid ${accent}55` }}>
              {coinIcon ? <img src={coinIcon} className="w-4 h-4" alt="" /> : <Wallet size={14} />}
              <span className="font-bold tabular-nums">{authed.tokens_balance}</span>
              <span className="text-xs" style={{ color: muted }}>{coinName}</span>
            </div>
            <button
              onClick={() => {
                const luckyTag = (cfg.luckyboxTag || tag).toString().trim();
                try {
                  const sess = {
                    id: authed.id,
                    name: authed.name,
                    account_id: authed.account_id,
                    email: authed.email,
                    tokens_balance: authed.tokens_balance,
                    case_grants: {},
                  };
                  sessionStorage.setItem(`luckybox_user_${luckyTag}`, JSON.stringify(sess));
                } catch {}
                window.location.href = `/luckybox=${luckyTag}`;
              }}
              title="Loja"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition hover:opacity-90"
              style={{ background: `${accent}22`, border: `1px solid ${accent}55`, color: text }}>
              <Store size={14} />
              <span>Loja</span>
            </button>
            <button onClick={() => { setAuthed(null); setMyWagers([]); }} title="Sair"
              className="p-2 rounded-lg" style={{ background: '#00000033' }}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 pb-2 flex gap-1">
          {([['events','Eventos'],['mine','Minhas apostas']] as const).map(([k, l]) => (
            <button key={k} onClick={() => { setTab(k); if (k === 'mine') refreshMine(); }}
              className="px-4 py-2 rounded-t-lg text-sm font-medium transition"
              style={{
                background: tab === k ? cardBg : 'transparent',
                color: tab === k ? text : muted,
                borderBottom: tab === k ? `2px solid ${accent}` : '2px solid transparent',
              }}>{l}</button>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {tab === 'events' && (
          <div className="space-y-4">
            {events.length === 0 && (
              <div className="text-center py-16" style={{ color: muted }}>
                Nenhum evento disponível no momento.
              </div>
            )}
            {events.map(ev => {
              const outs = outcomesByEvent[ev.id] || [];
              const timeExpired = isBetDateTimeExpired(ev.closes_at);
              const closed = ev.status !== 'open' || timeExpired;
              const c = ev.payout_case_id ? casesById[ev.payout_case_id] : null;
              return (
                <article key={ev.id} className="rounded-2xl p-4 sm:p-5" style={{ background: cardBg, border: `1px solid ${accent}22` }}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      {ev.category && <div className="text-xs uppercase tracking-wider mb-1" style={{ color: accent }}>{ev.category}</div>}
                      <h2 className="font-bold text-lg sm:text-xl truncate">{ev.title}</h2>
                      {ev.subtitle && <p className="text-sm mt-0.5" style={{ color: muted }}>{ev.subtitle}</p>}
                      <div className="flex items-center gap-3 mt-2 text-xs flex-wrap" style={{ color: muted }}>
                        {ev.closes_at && (
                          <span className="flex items-center gap-1"><Clock size={12} /> Encerra: {formatBetDateTime(ev.closes_at)}</span>
                        )}
                        <span className="px-2 py-0.5 rounded-full" style={{ background: '#00000044' }}>{eventStatusBadge(ev.status)}</span>
                        {ev.status === 'open' && timeExpired && (
                          <span className="px-2 py-0.5 rounded-full font-semibold" style={{ background: '#ef444433', color: '#ef4444' }}>Apostas encerradas (prazo expirado)</span>
                        )}
                      </div>
                    </div>
                    {ev.image_url && <img src={ev.image_url} alt="" className="w-28 h-16 sm:w-36 sm:h-20 rounded-lg object-cover flex-shrink-0" />}
                  </div>
                  {ev.payout_mode === 'case' && c && (
                    <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg" style={{ background: '#00000044' }}>
                      {c.image_url && <img src={c.image_url} className="w-8 h-8 rounded" alt="" />}
                      <span className="text-xs">Prêmio: caixa <b>{c.name}</b> ({ev.payout_case_qty_per_unit}× por unidade apostada)</span>
                    </div>
                  )}
                  <div className={`grid gap-2 ${outs.length === 2 ? 'grid-cols-2' : outs.length === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3'}`}>
                    {outs.map(o => {
                      const isWinner = ev.status === 'resolved' && o.is_winner;
                      const isLoser = ev.status === 'resolved' && !o.is_winner;
                      return (
                        <button key={o.id}
                          onClick={() => openSlip(ev, o)}
                          disabled={!!closed}
                          className="px-3 py-3 rounded-xl text-left transition disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02]"
                          style={{
                            background: isWinner ? `${accent}33` : '#00000033',
                            border: `1px solid ${isWinner ? accent : `${accent}33`}`,
                            color: isLoser ? muted : text,
                          }}>
                          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: muted }}>{o.label}</div>
                          <div className="text-xl font-bold tabular-nums" style={{ color: isWinner ? accent : text }}>{Number(o.odd).toFixed(2)}</div>
                        </button>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {tab === 'mine' && (
          <div className="space-y-2">
            {myWagers.length === 0 && (
              <div className="text-center py-16" style={{ color: muted }}>Você ainda não fez apostas.</div>
            )}
            {myWagers.map(w => {
              const ev = myEvents.find(e => e.id === w.event_id);
              const statusLabel: Record<string, string> = {
                pending: 'Pendente', won: 'Ganhou', lost: 'Perdeu', refunded: 'Devolvida', cancelled: 'Cancelada',
              };
              const statusColor: Record<string, string> = {
                pending: muted, won: '#22c55e', lost: '#ef4444', refunded: '#eab308', cancelled: muted,
              };
              const outcome = (page?.outcomes || []).find((o: OutcomeRow) => o.id === w.outcome_id);
              const canShare = cfg.ticketEnabled !== false && (w.status === 'won' || w.status === 'lost' || w.status === 'pending');
              const openShare = () => {
                if (!ev) return;
                const payout = w.status === 'won'
                  ? w.payout_coins
                  : w.status === 'lost'
                    ? 0
                    : Math.round(w.amount_coins * Number(w.odd_snapshot));
                setShareWager({
                  userId: authed?.account_id || authed?.id,
                  eventTitle: ev.title,
                  outcomeLabel: outcome?.label || '—',
                  odd: Number(w.odd_snapshot),
                  amount: w.amount_coins,
                  payout,
                  status: w.status,
                  payoutMode: w.payout_mode,
                  coinName,
                  createdAt: w.created_at,
                });
              };
              return (
                <div key={w.id} className="rounded-xl p-4 flex items-center justify-between gap-3"
                  style={{ background: cardBg, border: `1px solid ${accent}22` }}>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{ev?.title || w.event_id.slice(0, 8)}</div>
                    <div className="text-xs mt-0.5" style={{ color: muted }}>
                      {w.amount_coins} {coinName} · odd {Number(w.odd_snapshot).toFixed(2)}
                      {w.payout_mode === 'case' ? ' · Prêmio: caixa' : ` · Retorno: ${Math.round(w.amount_coins * Number(w.odd_snapshot))} ${coinName}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="text-sm font-bold" style={{ color: statusColor[w.status] }}>{statusLabel[w.status]}</div>
                      {w.status === 'won' && w.payout_mode === 'coins' && (
                        <div className="text-xs" style={{ color: muted }}>+{w.payout_coins}</div>
                      )}
                    </div>
                    {canShare && (
                      <button
                        onClick={openShare}
                        title="Compartilhar bilhete"
                        className="p-2 rounded-lg transition hover:opacity-80"
                        style={{ background: `${accent}22`, border: `1px solid ${accent}55`, color: accent }}
                      >
                        <Share2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {shareWager && (
        <ShareTicket
          open={!!shareWager}
          onClose={() => setShareWager(null)}
          data={shareWager}
          config={cfg.ticket || {}}
        />
      )}

      {/* Bet slip */}
      {slip && (
        <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={() => setSlip(null)}>
          <div className="w-full max-w-md rounded-2xl p-5" style={{ background: cardBg, border: `1px solid ${accent}55` }} onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <div className="text-xs uppercase" style={{ color: muted }}>Cupom de aposta</div>
                <div className="font-bold truncate">{slip.event.title}</div>
                <div className="text-sm mt-1">
                  <span className="px-2 py-0.5 rounded" style={{ background: `${accent}33` }}>
                    {slip.outcome.label} · {Number(slip.outcome.odd).toFixed(2)}
                  </span>
                </div>
              </div>
              <button onClick={() => setSlip(null)} className="p-1.5 rounded" style={{ background: '#00000044' }}>
                <X size={16} />
              </button>
            </div>
            <label className="text-sm" style={{ color: muted }}>Valor ({coinName})</label>
            <input
              type="number" inputMode="numeric" min={slip.event.min_bet} step={1}
              value={amount} onChange={e => setAmount(e.target.value)}
              className="w-full px-4 py-3 rounded-lg outline-none text-lg font-bold tabular-nums mt-1"
              style={{ background: '#00000033', color: text, border: `1px solid ${accent}55` }}
            />
            <div className="flex gap-2 mt-2">
              {[10, 50, 100, 500].map(v => (
                <button key={v} type="button" onClick={() => setAmount(String(v))}
                  className="flex-1 py-1.5 rounded text-xs font-medium" style={{ background: '#00000044', color: text }}>
                  {v}
                </button>
              ))}
              <button type="button" onClick={() => setAmount(String(authed?.tokens_balance ?? 0))}
                className="flex-1 py-1.5 rounded text-xs font-medium" style={{ background: '#00000044', color: text }}>
                Tudo
              </button>
            </div>

            <div className="mt-4 p-3 rounded-lg space-y-1 text-sm" style={{ background: '#00000033' }}>
              <div className="flex justify-between"><span style={{ color: muted }}>Saldo:</span><span className="tabular-nums">{authed?.tokens_balance ?? 0}</span></div>
              <div className="flex justify-between"><span style={{ color: muted }}>Aposta:</span><span className="tabular-nums">{Math.floor(Number(amount) || 0)}</span></div>
              <div className="flex justify-between font-bold">
                <span>Retorno potencial:</span>
                <span className="tabular-nums" style={{ color: accent }}>
                  {slip.event.payout_mode === 'case'
                    ? `${Math.max(1, Math.floor((Number(amount) || 0) * slip.event.payout_case_qty_per_unit))}× caixa`
                    : `${Math.round((Number(amount) || 0) * Number(slip.outcome.odd))} ${coinName}`}
                </span>
              </div>
            </div>

            <button onClick={placeBet} disabled={placing}
              className="mt-4 w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: accent, color: '#000' }}>
              {placing ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
              Confirmar aposta
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Bets;
