import { useEffect, useMemo, useState, lazy, Suspense, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { getLobbySession, clearLobbySession, type LobbySession } from '@/lib/lobbySession';
import { LobbyEmbedProvider } from '@/contexts/LobbyEmbed';
import LobbyLogin from '@/components/lobby/LobbyLogin';
import LobbyShell, { type LobbyTheme } from '@/components/lobby/LobbyShell';
import LobbyHome, { type PromoCard } from '@/components/lobby/LobbyHome';
import LobbyProfile from '@/components/lobby/LobbyProfile';
import type { LobbyTab } from '@/components/lobby/LobbyBottomNav';
import type { ProductKey } from '@/components/lobby/LobbyPromoCard';

const Bets = lazy(() => import('./Bets.tsx'));
const Roleta = lazy(() => import('./Roleta.tsx'));
const Luckybox = lazy(() => import('./Luckybox.tsx'));
const DepositBS = lazy(() => import('./DepositBS.tsx'));

type View = 'login' | 'home' | 'perfil' | ProductKey;

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
  cards?: PromoCard[];
  footer_text?: string;
  theme?: LobbyTheme;
  login?: LobbyLoginConfig;
}

const DEFAULT_CARDS = (tags: { bets: string; luckybox: string; roleta: string }): PromoCard[] => [
  { key: 'roleta', enabled: !!tags.roleta, title: 'Roleta', subtitle: 'Gire e ganhe prêmios incríveis', order: 1 },
  { key: 'apostas', enabled: !!tags.bets, title: 'Apostas', subtitle: 'Aposte nos jogos do dia', order: 2 },
  { key: 'luckybox', enabled: !!tags.luckybox, title: 'Luckybox', subtitle: 'Abra caixas e descubra prêmios', order: 3 },
  { key: 'batalha', enabled: true, title: 'Batalha de Slots', subtitle: 'Competição ao vivo entre apostadores', order: 4 },
];

const ViewFallback = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--lobby-primary, #00d4ff)' }} />
  </div>
);

const Lobby = ({ tag }: { tag: string }) => {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [pageConfig, setPageConfig] = useState<LobbyPageConfig>({});
  const [productTags, setProductTags] = useState({ bets: '', luckybox: '', roleta: '' });
  // Hidrata sessão de forma síncrona — evita flicker para a tela de login.
  const [session, setSession] = useState<LobbySession | null>(() => getLobbySession());
  const [view, setView] = useState<View>(() => (getLobbySession() ? 'home' : 'login'));
  const [coins, setCoins] = useState<number | null>(null);

  // ─── Carrega config do lobby ───
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

  // ─── Prefetch dos módulos após login (transição instantânea) ───
  useEffect(() => {
    if (!session) return;
    // dispara em background, sem await
    void import('./Bets.tsx');
    void import('./Roleta.tsx');
    void import('./Luckybox.tsx');
  }, [session]);

  // ─── Coins (tokens_balance) ───
  const fetchCoins = useCallback(async () => {
    if (!session?.wheel_user_id) { setCoins(null); return; }
    try {
      const { data } = await (supabase as any)
        .from('wheel_users')
        .select('tokens_balance')
        .eq('id', session.wheel_user_id)
        .maybeSingle();
      if (typeof data?.tokens_balance === 'number') setCoins(data.tokens_balance);
    } catch { /* ignore */ }
  }, [session?.wheel_user_id]);

  useEffect(() => { void fetchCoins(); }, [fetchCoins]);

  const cards = useMemo(() => {
    const defaults = DEFAULT_CARDS(productTags);
    const configured = pageConfig.cards || [];
    const merged = defaults.map((d) => {
      const override = configured.find((c) => c.key === d.key);
      return override ? { ...d, ...override } : d;
    });
    return merged.filter((c) => c.enabled).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  }, [pageConfig.cards, productTags]);

  const theme: LobbyTheme = pageConfig.theme || {};
  const loginCfg = pageConfig.login || {};

  const handleSignOut = useCallback(() => {
    clearLobbySession();
    setSession(null);
    setCoins(null);
    setView('login');
  }, []);

  const handleSignedIn = useCallback(() => {
    setSession(getLobbySession());
    setView('home');
  }, []);

  const openProduct = useCallback((key: ProductKey) => {
    if (!session) { setView('login'); return; }
    setView(key);
  }, [session]);

  const handleTabChange = useCallback((tab: LobbyTab) => {
    if (tab === 'home') setView('home');
    else if (tab === 'perfil') setView('perfil');
  }, []);

  const activeTab: LobbyTab = view === 'perfil' ? 'perfil' : 'home';

  // ─── Loading inicial ───
  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#0a0a0f]">
        <Loader2 className="h-8 w-8 animate-spin text-white/70" />
      </div>
    );
  }
  if (notFound) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#0a0a0f] text-white px-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Lobby indisponível</h1>
          <p className="text-white/60">Verifique o link e tente novamente.</p>
        </div>
      </div>
    );
  }

  // ─── Login (sem header/nav) ───
  if (view === 'login' || !session) {
    return (
      <LobbyShell
        theme={theme}
        bgImageUrl={pageConfig.bg_image_url}
        logoUrl={pageConfig.logo_url}
        session={null}
        coins={null}
        activeTab="home"
        onTabChange={() => {}}
        hideHeader
        hideNav
      >
        <LobbyLogin
          tag={tag}
          logoUrl={pageConfig.logo_url}
          title={loginCfg.title || pageConfig.site_title || 'Acesse o Lobby'}
          subtitle={loginCfg.subtitle || pageConfig.site_description || 'Entre com seu e-mail e ID da conta'}
          buttonLabel={loginCfg.button_label}
          rememberLabel={loginCfg.remember_label}
          signupText={loginCfg.signup_text}
          signupLinkText={loginCfg.signup_link_text}
          signupUrl={loginCfg.signup_url}
          showSignup={loginCfg.show_signup !== false}
          showLobbyPill={loginCfg.show_lobby_pill !== false}
          primary={theme.primary || '#00d4ff'}
          headingFont={theme.heading_font || 'Bebas Neue'}
          bodyFont={theme.body_font || 'Barlow'}
          onSignedIn={handleSignedIn}
        />
      </LobbyShell>
    );
  }

  // ─── Conteúdo das views ───
  const embedValue = {
    session,
    onExitToLobby: () => setView('home'),
    onSignOut: handleSignOut,
  };

  let content: React.ReactNode;
  if (view === 'home') {
    content = (
      <LobbyHome
        title={pageConfig.site_title || 'Central de promoções'}
        description={pageConfig.site_description}
        greeting={session.name ? `Olá, ${session.name.split(' ')[0]}` : 'Bem-vindo'}
        cards={cards}
        footerText={pageConfig.footer_text}
        onOpenProduct={openProduct}
      />
    );
  } else if (view === 'perfil') {
    content = (
      <LobbyProfile
        session={session}
        coins={coins}
        onSignOut={handleSignOut}
        onBackToHome={() => setView('home')}
      />
    );
  } else {
    content = (
      <LobbyEmbedProvider value={embedValue}>
        <Suspense fallback={<ViewFallback />}>
          {view === 'apostas' && productTags.bets && <Bets tag={productTags.bets} />}
          {view === 'roleta' && productTags.roleta && <Roleta slugOverride={productTags.roleta} />}
          {view === 'luckybox' && productTags.luckybox && <Luckybox tag={productTags.luckybox} />}
        </Suspense>
      </LobbyEmbedProvider>
    );
  }

  return (
    <LobbyShell
      theme={theme}
      bgImageUrl={pageConfig.bg_image_url}
      logoUrl={pageConfig.logo_url}
      session={session}
      coins={coins}
      activeTab={activeTab}
      onTabChange={handleTabChange}
    >
      {content}
    </LobbyShell>
  );
};

export default Lobby;
