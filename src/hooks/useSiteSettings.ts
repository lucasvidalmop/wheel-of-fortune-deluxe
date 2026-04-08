import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SiteSettings {
  site_title: string;
  site_description: string;
  favicon_url: string;
  bg_image_url: string;
  home_mode: 'text' | 'image' | 'image_text';
}

export const useSiteSettings = () => {
  const [settings, setSettings] = useState<SiteSettings | null>(null);

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

  return settings;
};
