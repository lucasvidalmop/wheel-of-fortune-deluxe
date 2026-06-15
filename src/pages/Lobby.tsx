import { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, LogOut, Home, ArrowLeft, ExternalLink } from 'lucide-react';
import { optimizedImage } from '@/lib/imageUrl';
import { getLobbySession, clearLobbySession, type LobbySession } from '@/lib/lobbySession';
import { LobbyEmbedProvider } from '@/contexts/LobbyEmbed';
import LobbyLogin from '@/components/lobby/LobbyLogin';

const Bets = lazy(() => import('./Bets.tsx'));
const Roleta = lazy(() => import('./Roleta.tsx'));
const Luckybox = lazy(() => import('./Luckybox.tsx'));

type ProductKey = 'roleta' | 'batalha' | 'luckybox' | 'apostas';
type View = 'login' | 'home' | ProductKey;

interface CardConfig {
  key: ProductKey;
  enabled: boolean;
  title: string;
  subtitle?: string;
  image_url?: string;
  href?: string;
  order?: number;
}

interface LobbyTheme {
  primary?: string;
  bg_color?: string;
  text_color?: string;
  heading_font?: string;
  body_font?: string;
  overlay_strength?: number; // 0..100
}

interface LobbyLoginConfig {
  title?: string;
  subtitle?: string;
  button_label?: string;
  remember_label?: string;
  signup_text?: string;
  signup_link_text?: string;
  signup_url?: string;
  show_signup?: boolean;
  show_lobby_pill?: boolean;
}

interface LobbyPageConfig {
  site_title?: string;
  site_description?: string;
  bg_image_url?: string;
  logo_url?: string;
  cards?: CardConfig[];
  footer_text?: string;
  theme?: LobbyTheme;
  login?: LobbyLoginConfig;
}

const DEFAULT_CARDS = (tags: { bets: string; luckybox: string; roleta: string }): CardConfig[] => [
  { key: 'roleta', enabled: !!tags.roleta, title: 'Roleta', subtitle: 'Gire e ganhe prêmios', order: 1 },
  { key: 'apostas', enabled: !!tags.bets, title: 'Apostas', subtitle: 'Aposte nos jogos do dia', order: 2 },
  { key: 'luckybox', enabled: !!tags.luckybox, title: 'Luckybox', subtitle: 'Abra caixas e descubra prêmios', order: 3 },
  { key: 'batalha', enabled: true, title: 'Batalha de Slots', subtitle: 'Competição ao vivo', order: 4 },
];

const ViewFallback = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const Lobby = ({ tag }: { tag: string }) => {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [pageConfig, setPageConfig] = useState<LobbyPageConfig>({});
  const [productTags, setProductTags] = useState({ bets: '', luckybox: '', roleta: '' });
  const [session, setSession] = useState<LobbySession | null>(() => getLobbySession());
  const [view, setView] = useState<View>(() => (getLobbySession() ? 'home' : 'login'));

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('get-lobby-page', { body: { tag } });
        if (!alive) return;
        if (error || !data?.found || !data?.isActive) {
          try { sessionStorage.removeItem('lobby_tag'); } catch { /* ignore */ }
          setNotFound(true);
          return;
        }
        try { sessionStorage.setItem('lobby_tag', tag); } catch { /* ignore */ }
        setPageConfig(data.pageConfig || {});
        setProductTags(data.productTags || { bets: '', luckybox: '', roleta: '' });
        if (data.pageConfig?.site_title) document.title = data.pageConfig.site_title;
      } catch {
        if (alive) setNotFound(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [tag]);

  const cards = useMemo(() => {
    const defaults = DEFAULT_CARDS(productTags);
    const configured = pageConfig.cards || [];
    const merged = defaults.map((d) => {
      const override = configured.find((c) => c.key === d.key);
      return override ? { ...d, ...override } : d;
    });
    return merged.filter((c) => c.enabled).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  }, [pageConfig.cards, productTags]);

  const bg = optimizedImage(pageConfig.bg_image_url, { width: 1920, quality: 70 });

  const theme = pageConfig.theme || {};
  const loginCfg = pageConfig.login || {};
  const primary = theme.primary || '#00d4ff';
  const bgColor = theme.bg_color || '#0a0a0f';
  const textColor = theme.text_color || '#ffffff';
  const headingFont = theme.heading_font || 'Bebas Neue';
  const bodyFont = theme.body_font || 'Barlow';
  const fontHead = `${headingFont}, sans-serif`;
  const fontBody = `${bodyFont}, sans-serif`;
  const overlay = Math.max(0, Math.min(100, theme.overlay_strength ?? 65)) / 100;

  const handleSignOut = () => {
    clearLobbySession();
    setSession(null);
    setView('login');
  };

  const handleSignedIn = () => {
    setSession(getLobbySession());
    setView('home');
  };

  const openProduct = (key: ProductKey) => {
    if (!session) { setView('login'); return; }
    if (key === 'batalha') {
      // Abre a página pública de depósito da Batalha de Slots do operador.
      window.open(`/depbs=${tag}`, '_blank', 'noopener,noreferrer');
      return;
    }
    setView(key);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Lobby indisponível</h1>
          <p className="text-muted-foreground">Verifique o link e tente novamente.</p>
        </div>
      </div>
    );
  }

  // ─── Background wrapper ───
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen relative overflow-hidden" style={{ background: '#0a0a0f' }}>
      {bg && (
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${bg})` }} />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/65 to-black/90" />
      <div className="relative z-10">{children}</div>
    </div>
  );

  // ─── Login view ───
  if (view === 'login' || !session) {
    return (
      <Wrapper>
        <LobbyLogin
          tag={tag}
          logoUrl={pageConfig.logo_url}
          title={pageConfig.site_title || 'Acesse o Lobby'}
          subtitle={pageConfig.site_description || 'Entre com seu e-mail e ID da conta'}
          onSignedIn={handleSignedIn}
        />
      </Wrapper>
    );
  }

  // ─── Header (visible on home + embedded views) ───
  const Header = ({ showBack }: { showBack: boolean }) => (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/30 border-b border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {showBack ? (
            <button
              onClick={() => setView('home')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white text-[11px] uppercase tracking-[0.18em] font-semibold transition border border-white/10"
              style={{ fontFamily: fontBody }}
            >
              <ArrowLeft size={13} /> Lobby
            </button>
          ) : (
            <div className="inline-flex items-center gap-2.5 text-white min-w-0">
              {pageConfig.logo_url ? (
                <img src={pageConfig.logo_url} alt="Logo" className="h-8 object-contain" />
              ) : (
                <div className="h-8 w-8 rounded-md bg-white/10 flex items-center justify-center">
                  <Home size={16} />
                </div>
              )}
              <span
                className="hidden sm:inline text-[11px] uppercase tracking-[0.28em] text-white/50 font-medium truncate"
                style={{ fontFamily: fontBody }}
              >
                Lobby
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end leading-tight">
            <span
              className="text-[9px] uppercase tracking-[0.24em] text-white/40"
              style={{ fontFamily: fontBody }}
            >
              Conectado
            </span>
            <span
              className="text-xs text-white/85 truncate max-w-[180px]"
              style={{ fontFamily: fontBody, fontWeight: 600 }}
            >
              {session.name || session.email}
            </span>
          </div>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-red-500/80 text-white text-[11px] uppercase tracking-[0.18em] font-semibold transition border border-white/10"
            style={{ fontFamily: fontBody }}
          >
            <LogOut size={13} /> Sair
          </button>
        </div>
      </div>
    </header>
  );

  // ─── Home (composição moderna assimétrica) ───
  if (view === 'home') {
    const featured = cards[0];
    const rest = cards.slice(1);
    const productMeta: Record<ProductKey, { tag: string; icon: string; accent: string }> = {
      roleta: { tag: 'Jackpot', icon: '🎰', accent: 'from-amber-400/40 to-orange-600/10' },
      apostas: { tag: 'Esportes', icon: '⚽', accent: 'from-emerald-400/40 to-sky-600/10' },
      luckybox: { tag: 'Caixas', icon: '🎁', accent: 'from-fuchsia-400/40 to-purple-600/10' },
      batalha: { tag: 'Ao vivo', icon: '⚔️', accent: 'from-rose-400/40 to-red-600/10' },
    };

    return (
      <Wrapper>
        <Header showBack={false} />

        {/* Decorative ambient blobs */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -left-24 w-[520px] h-[520px] rounded-full bg-white/[0.04] blur-3xl" />
          <div className="absolute top-1/3 -right-32 w-[480px] h-[480px] rounded-full bg-white/[0.05] blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-5 md:px-8 pt-10 md:pt-16 pb-16">
          {/* Hero block — editorial style */}
          <div className="grid grid-cols-12 gap-6 mb-10 md:mb-14 items-end">
            <div className="col-span-12 md:col-span-8">
              <div
                className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.32em] text-white/50 mb-4"
                style={{ fontFamily: fontBody }}
              >
                <span className="h-px w-8 bg-white/40" />
                {session.name ? `Olá, ${session.name.split(' ')[0]}` : 'Bem-vindo'}
              </div>
              <h1
                className="text-white leading-[0.88] tracking-tight"
                style={{
                  fontFamily: fontHead,
                  fontSize: 'clamp(56px, 9vw, 132px)',
                  letterSpacing: '0.01em',
                }}
              >
                {pageConfig.site_title || 'Central de Promoções'}
              </h1>
              {pageConfig.site_description && (
                <p
                  className="mt-5 text-white/65 max-w-xl text-base md:text-lg leading-relaxed"
                  style={{ fontFamily: fontBody }}
                >
                  {pageConfig.site_description}
                </p>
              )}
            </div>
            <div className="hidden md:flex col-span-4 justify-end">
              <div className="text-right">
                <div
                  className="text-[10px] uppercase tracking-[0.32em] text-white/40 mb-1"
                  style={{ fontFamily: fontBody }}
                >
                  Promoções ativas
                </div>
                <div
                  className="text-white/90"
                  style={{ fontFamily: fontHead, fontSize: '88px', lineHeight: 0.9 }}
                >
                  {String(cards.length).padStart(2, '0')}
                </div>
              </div>
            </div>
          </div>

          {cards.length === 0 ? (
            <div
              className="text-center text-white/60 py-20 border border-dashed border-white/10 rounded-3xl"
              style={{ fontFamily: fontBody }}
            >
              Nenhuma promoção configurada.
            </div>
          ) : (
            <div className="grid grid-cols-12 gap-5 md:gap-6">
              {/* Featured card — large */}
              {featured && (() => {
                const meta = productMeta[featured.key];
                return (
                  <button
                    onClick={() => openProduct(featured.key)}
                    className="group relative col-span-12 lg:col-span-7 row-span-2 text-left overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.01] hover:border-white/30 transition-all duration-500"
                    style={{ minHeight: '440px' }}
                  >
                    {featured.image_url ? (
                      <img
                        src={optimizedImage(featured.image_url, { width: 1200, quality: 80 }) || featured.image_url}
                        alt={featured.title}
                        className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:scale-[1.04] transition-transform duration-[1200ms] ease-out"
                        loading="lazy"
                      />
                    ) : (
                      <div className={`absolute inset-0 bg-gradient-to-br ${meta.accent}`}>
                        <div className="absolute inset-0 flex items-center justify-center text-[180px] opacity-60">
                          {meta.icon}
                        </div>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/10" />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />

                    <div className="relative h-full flex flex-col justify-between p-6 md:p-9 z-10">
                      <div className="flex items-start justify-between gap-3">
                        <span
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[10px] uppercase tracking-[0.24em] text-white/90"
                          style={{ fontFamily: fontBody, fontWeight: 600 }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                          Destaque
                        </span>
                        <span
                          className="text-white/40 text-sm"
                          style={{ fontFamily: fontBody, fontWeight: 600 }}
                        >
                          01
                        </span>
                      </div>

                      <div>
                        <div
                          className="text-[10px] uppercase tracking-[0.32em] text-white/60 mb-2"
                          style={{ fontFamily: fontBody, fontWeight: 600 }}
                        >
                          {meta.tag}
                          {featured.key === 'batalha' && <span className="ml-2 text-white/40">· abre em nova aba</span>}
                        </div>
                        <h2
                          className="text-white leading-[0.9]"
                          style={{
                            fontFamily: fontHead,
                            fontSize: 'clamp(44px, 6vw, 76px)',
                            letterSpacing: '0.01em',
                          }}
                        >
                          {featured.title}
                        </h2>
                        {featured.subtitle && (
                          <p
                            className="mt-3 text-white/75 max-w-md text-base md:text-lg"
                            style={{ fontFamily: fontBody }}
                          >
                            {featured.subtitle}
                          </p>
                        )}
                        <div
                          className="mt-6 inline-flex items-center gap-2 text-white text-xs uppercase tracking-[0.24em] group-hover:gap-4 transition-all"
                          style={{ fontFamily: fontBody, fontWeight: 700 }}
                        >
                          <span className="h-px w-8 bg-white group-hover:w-14 transition-all" />
                          Entrar agora
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })()}

              {/* Secondary cards — vertical stack */}
              {rest.map((card, idx) => {
                const meta = productMeta[card.key];
                const num = String(idx + 2).padStart(2, '0');
                return (
                  <button
                    key={card.key}
                    onClick={() => openProduct(card.key)}
                    className="group relative col-span-12 sm:col-span-6 lg:col-span-5 text-left overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/25 hover:-translate-y-1 transition-all duration-500"
                    style={{ minHeight: '210px' }}
                  >
                    {card.image_url ? (
                      <img
                        src={optimizedImage(card.image_url, { width: 700, quality: 75 }) || card.image_url}
                        alt={card.title}
                        className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:scale-[1.06] group-hover:opacity-90 transition-all duration-700"
                        loading="lazy"
                      />
                    ) : (
                      <div className={`absolute inset-0 bg-gradient-to-br ${meta.accent}`} />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/55 to-black/20" />

                    <div className="relative h-full flex items-center gap-5 p-6 md:p-7 z-10">
                      <div className="shrink-0 h-16 w-16 md:h-20 md:w-20 rounded-2xl bg-white/[0.08] border border-white/15 backdrop-blur-md flex items-center justify-center text-3xl md:text-4xl group-hover:bg-white/15 transition">
                        {meta.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1.5">
                          <span
                            className="text-[9px] uppercase tracking-[0.28em] text-white/55"
                            style={{ fontFamily: fontBody, fontWeight: 600 }}
                          >
                            {meta.tag}
                          </span>
                          {card.key === 'batalha' && (
                            <span
                              className="inline-flex items-center gap-1 text-[9px] text-white/40"
                              style={{ fontFamily: fontBody }}
                            >
                              <ExternalLink size={9} /> nova aba
                            </span>
                          )}
                        </div>
                        <h3
                          className="text-white leading-[0.95] truncate"
                          style={{
                            fontFamily: fontHead,
                            fontSize: 'clamp(28px, 3.4vw, 40px)',
                            letterSpacing: '0.02em',
                          }}
                        >
                          {card.title}
                        </h3>
                        {card.subtitle && (
                          <p
                            className="text-white/65 text-sm mt-1 line-clamp-1"
                            style={{ fontFamily: fontBody }}
                          >
                            {card.subtitle}
                          </p>
                        )}
                      </div>
                      <div
                        className="hidden md:flex shrink-0 self-start text-white/30 text-sm group-hover:text-white/70 transition"
                        style={{ fontFamily: fontBody, fontWeight: 600 }}
                      >
                        {num}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {pageConfig.footer_text && (
            <footer
              className="mt-16 pt-6 border-t border-white/10 text-center text-white/40 text-xs uppercase tracking-[0.24em]"
              style={{ fontFamily: fontBody }}
            >
              {pageConfig.footer_text}
            </footer>
          )}
        </div>
      </Wrapper>
    );
  }

  // ─── Promotional view embedded ───
  const embedValue = {
    session,
    onExitToLobby: () => setView('home'),
    onSignOut: handleSignOut,
  };

  return (
    <Wrapper>
      <Header showBack={true} />
      <LobbyEmbedProvider value={embedValue}>
        <Suspense fallback={<ViewFallback />}>
          {view === 'apostas' && productTags.bets && <Bets tag={productTags.bets} />}
          {view === 'roleta' && productTags.roleta && <Roleta slugOverride={productTags.roleta} />}
          {view === 'luckybox' && productTags.luckybox && <Luckybox tag={productTags.luckybox} />}
        </Suspense>
      </LobbyEmbedProvider>
    </Wrapper>
  );
};

export default Lobby;
