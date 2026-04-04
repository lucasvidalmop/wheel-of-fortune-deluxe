import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const [settings, setSettings] = useState<{
    bg_image_url: string;
    site_title: string;
    site_description: string;
    favicon_url: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from('site_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
      if (data) setSettings(data);
    })();
  }, []);

  useEffect(() => {
    if (!settings) return;
    if (settings.site_title) document.title = settings.site_title;
    if (settings.site_description) {
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) { meta = document.createElement('meta'); (meta as HTMLMetaElement).name = 'description'; document.head.appendChild(meta); }
      (meta as HTMLMetaElement).content = settings.site_description;
    }
    if (settings.favicon_url) {
      let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = settings.favicon_url;
    }
  }, [settings]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden" style={{ background: '#0a0a0f' }}>
      {settings?.bg_image_url && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${settings.bg_image_url})` }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/50 to-black/80" />

      <div className="relative z-10 text-center space-y-4">
        {settings?.site_title && (
          <h1 className="text-4xl md:text-6xl font-black tracking-wider uppercase text-white" style={{ textShadow: '0 0 40px rgba(255,255,255,0.15)' }}>
            {settings.site_title}
          </h1>
        )}
        {settings?.site_description && (
          <p className="text-lg md:text-xl text-white/60 max-w-xl mx-auto">
            {settings.site_description}
          </p>
        )}
      </div>
    </div>
  );
};

export default Index;
