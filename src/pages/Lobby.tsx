import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { optimizedImage } from '@/lib/imageUrl';

type ProductKey = 'roleta' | 'batalha' | 'luckybox' | 'apostas';

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
  { key: 'roleta', enabled: !!tags.roleta, title: 'Roleta', subtitle: 'Gire e ganhe prêmios', href: tags.roleta ? `/${tags.roleta}` : '', order: 1 },
  { key: 'apostas', enabled: !!tags.bets, title: 'Apostas', subtitle: 'Aposte nos jogos do dia', href: tags.bets ? `/odds=${tags.bets}` : '', order: 2 },
  { key: 'luckybox', enabled: !!tags.luckybox, title: 'Luckybox', subtitle: 'Abra caixas e descubra prêmios', href: tags.luckybox ? `/luckybox=${tags.luckybox}` : '', order: 3 },
  { key: 'batalha', enabled: true, title: 'Batalha de Slots', subtitle: 'Competição ao vivo', href: '/batalha', order: 4 },
];

const Lobby = ({ tag }: { tag: string }) => {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [pageConfig, setPageConfig] = useState<LobbyPageConfig>({});
  const [productTags, setProductTags] = useState({ bets: '', luckybox: '', roleta: '' });

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('get-lobby-page', { body: { tag } });
        if (!alive) return;
        if (error || !data?.found || !data?.isActive) { setNotFound(true); return; }
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
      return override ? { ...d, ...override, href: override.href || d.href } : d;
    });
    return merged.filter((c) => c.enabled && c.href).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  }, [pageConfig.cards, productTags]);

  const bg = optimizedImage(pageConfig.bg_image_url, { width: 1920, quality: 70 });

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

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: '#0a0a0f' }}>
      {bg && (
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${bg})` }} />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black/90" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-10 md:py-16">
        <header className="text-center mb-10 space-y-3">
          {pageConfig.logo_url && (
            <img src={pageConfig.logo_url} alt="Logo" className="mx-auto h-16 md:h-20 object-contain" />
          )}
          <h1 className="text-3xl md:text-5xl font-black tracking-wide uppercase text-white" style={{ textShadow: '0 0 40px rgba(255,255,255,0.15)' }}>
            {pageConfig.site_title || 'Bem-vindo'}
          </h1>
          {pageConfig.site_description && (
            <p className="text-base md:text-lg text-white/70 max-w-2xl mx-auto">{pageConfig.site_description}</p>
          )}
        </header>

        {cards.length === 0 ? (
          <div className="text-center text-white/60 py-16">Nenhum produto configurado.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-5 md:gap-6">
            {cards.map((card) => (
              <a
                key={card.key}
                href={card.href}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm hover:border-primary/60 hover:bg-white/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/20"
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
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-5 md:p-6">
                  <h2 className="text-xl md:text-2xl font-bold text-white">{card.title}</h2>
                  {card.subtitle && <p className="text-sm md:text-base text-white/80 mt-1">{card.subtitle}</p>}
                </div>
              </a>
            ))}
          </div>
        )}

        {pageConfig.footer_text && (
          <footer className="mt-12 text-center text-white/50 text-sm">{pageConfig.footer_text}</footer>
        )}
      </div>
    </div>
  );
};

export default Lobby;
