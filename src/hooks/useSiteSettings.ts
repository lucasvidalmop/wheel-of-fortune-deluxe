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

// Module-level cache: site_settings is a single-row table, never changes during a session.
// This avoids duplicate fetches when multiple components mount the hook (or StrictMode double-mount).
let cachedSettings: SiteSettings | null = null;
let inflight: Promise<SiteSettings | null> | null = null;

const fetchSettings = (): Promise<SiteSettings | null> => {
  if (cachedSettings) return Promise.resolve(cachedSettings);
  if (inflight) return inflight;
  inflight = (async () => {
    const { data } = await (supabase as any)
      .from('site_settings')
      .select('site_title,site_description,favicon_url,bg_image_url,home_mode,dashboard_title,dashboard_description,dashboard_favicon_url')
      .eq('id', 1)
      .maybeSingle();
    cachedSettings = (data as SiteSettings) || null;
    inflight = null;
    return cachedSettings;
  })();
  return inflight;
};

export const useSiteSettings = (mode: 'site' | 'dashboard' = 'site') => {
  const [settings, setSettings] = useState<SiteSettings | null>(cachedSettings);

  useEffect(() => {
    let cancelled = false;
    if (!cachedSettings) {
      fetchSettings().then((data) => { if (!cancelled && data) setSettings(data); });
    }
    return () => { cancelled = true; };
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
