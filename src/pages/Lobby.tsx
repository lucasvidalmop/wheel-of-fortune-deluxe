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

interface LobbyPageConfig {
  site_title?: string;
  site_description?: string;
  bg_image_url?: string;
  logo_url?: string;
  cards?: CardConfig[];
  footer_text?: string;
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
      // Batalha standalone abre em nova aba (requer login admin separado).
      window.open('/batalha', '_blank', 'noopener,noreferrer');
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
    <header className="sticky top-0 z-50 backdrop-blur-md bg-black/40 border-b border-white/10">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {showBack ? (
            <button
              onClick={() => setView('home')}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition"
            >
              <ArrowLeft size={14} /> Lobby
            </button>
          ) : (
            <div className="inline-flex items-center gap-2 text-white">
              {pageConfig.logo_url ? (
                <img src={pageConfig.logo_url} alt="Logo" className="h-7 object-contain" />
              ) : (
                <Home size={18} />
              )}
              <span className="font-semibold text-sm truncate">{pageConfig.site_title || 'Lobby'}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-xs text-white/70 truncate max-w-[160px]">
            {session.name || session.email}
          </span>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/10 hover:bg-destructive/80 text-white text-xs font-semibold transition"
          >
            <LogOut size={14} /> Sair
          </button>
        </div>
      </div>
    </header>
  );

  // ─── Home (grid de cards) ───
  if (view === 'home') {
    return (
      <Wrapper>
        <Header showBack={false} />
        <div className="max-w-6xl mx-auto px-4 py-10 md:py-14">
          <div className="text-center mb-10 space-y-2">
            <h1 className="text-3xl md:text-5xl font-black tracking-wide uppercase text-white" style={{ textShadow: '0 0 40px rgba(255,255,255,0.15)' }}>
              {pageConfig.site_title || 'Bem-vindo'}
            </h1>
            {pageConfig.site_description && (
              <p className="text-base md:text-lg text-white/70 max-w-2xl mx-auto">{pageConfig.site_description}</p>
            )}
          </div>

          {cards.length === 0 ? (
            <div className="text-center text-white/60 py-16">Nenhum produto configurado.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 md:gap-6">
              {cards.map((card) => (
                <button
                  key={card.key}
                  onClick={() => openProduct(card.key)}
                  className="text-left group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm hover:border-primary/60 hover:bg-white/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/20"
                >
                  <div className="aspect-[16/9] relative overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20">
                    {card.image_url ? (
                      <img
                        src={optimizedImage(card.image_url, { width: 800, quality: 75 }) || card.image_url}
                        alt={card.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-6xl">
                        {card.key === 'roleta' ? '🎰' : card.key === 'apostas' ? '⚽' : card.key === 'luckybox' ? '🎁' : '⚔️'}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    {card.key === 'batalha' && (
                      <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 text-[10px] text-white/80">
                        <ExternalLink size={10} /> nova aba
                      </span>
                    )}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-5 md:p-6">
                    <h2 className="text-xl md:text-2xl font-bold text-white">{card.title}</h2>
                    {card.subtitle && <p className="text-sm md:text-base text-white/80 mt-1">{card.subtitle}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}

          {pageConfig.footer_text && (
            <footer className="mt-12 text-center text-white/50 text-sm">{pageConfig.footer_text}</footer>
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
          {view === 'roleta' && productTags.roleta && <Roleta />}
          {view === 'luckybox' && productTags.luckybox && <Luckybox tag={productTags.luckybox} />}
        </Suspense>
      </LobbyEmbedProvider>
    </Wrapper>
  );
};

export default Lobby;
