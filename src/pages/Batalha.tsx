import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import BattleWheel from '@/components/casino/BattleWheel';
import { defaultBattleConfig, type BattleConfig } from '@/components/casino/battleTypes';

export default function Batalha() {
  const [config, setConfig] = useState<BattleConfig>(defaultBattleConfig);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await (supabase as any).rpc('get_battle_config_default');
        if (!cancelled && !error && data && data.length > 0) {
          const remote = data[0]?.config as Partial<BattleConfig> | null;
          if (remote && typeof remote === 'object') {
            setConfig({ ...defaultBattleConfig, ...remote, participants: remote.participants ?? [] });
          }
        }
      } catch (_) {
        // ignore — fall back to defaults
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // SEO
  useEffect(() => {
    document.title = config.seoTitle || `${config.pageTitle} | Batalha Slot`;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', config.seoDescription || 'Batalha Slot — sorteio entre participantes.');
    if (config.faviconUrl) {
      let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = config.faviconUrl;
    }
  }, [config]);

  const bgStyle: React.CSSProperties = {
    backgroundColor: config.bgColor,
    backgroundImage: config.bgImageUrl ? `url(${config.bgImageUrl})` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };

  return (
    <main className="min-h-screen w-full flex flex-col items-center px-4 py-10" style={bgStyle}>
      <header className="text-center mb-8">
        {config.headerMode !== 'image' && (
          <h1 className="font-extrabold tracking-wide text-white" style={{ fontSize: config.headerTitleSize }}>
            {config.pageTitle}
          </h1>
        )}
        {config.headerMode === 'image' && config.headerImageUrl && (
          <img src={config.headerImageUrl} alt={config.pageTitle} style={{ maxWidth: config.headerImageSize }} className="mx-auto" />
        )}
        {config.headerMode === 'image_text' && config.headerImageUrl && (
          <img src={config.headerImageUrl} alt={config.pageTitle} style={{ maxWidth: config.headerImageSize }} className="mx-auto mb-3" />
        )}
        <p className="text-white/80 mt-2" style={{ fontSize: config.headerSubtitleSize }}>
          {config.pageSubtitle}
        </p>
      </header>

      {loading ? (
        <div className="text-white/70">Carregando...</div>
      ) : (
        <BattleWheel config={config} />
      )}
    </main>
  );
}
