import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SiteSettings {
  site_title: string;
  site_description: string;
  favicon_url: string;
  bg_image_url: string;
  home_mode: 'text' | 'image' | 'image_text';
  dashboard_title?: string;
  dashboard_description?: string;
  dashboard_favicon_url?: string;
}

export const useSiteSettings = (mode: 'site' | 'dashboard' = 'site') => {
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
    const title = mode === 'dashboard'
      ? (settings.dashboard_title || settings.site_title)
      : settings.site_title;
    const description = mode === 'dashboard'
      ? (settings.dashboard_description || settings.site_description)
      : settings.site_description;
    const favicon = mode === 'dashboard'
      ? (settings.dashboard_favicon_url || settings.favicon_url)
      : settings.favicon_url;

    if (title) document.title = title;
    if (description) {
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) { meta = document.createElement('meta'); (meta as HTMLMetaElement).name = 'description'; document.head.appendChild(meta); }
      (meta as HTMLMetaElement).content = description;
    }
    if (favicon) {
      let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = favicon;
    }
  }, [settings, mode]);

  return settings;
};
