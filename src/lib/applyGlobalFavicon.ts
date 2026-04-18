import { supabase } from '@/integrations/supabase/client';

let cached: { favicon: string; title: string; description: string } | null = null;
let inflight: Promise<typeof cached> | null = null;

const fetchSiteSettings = async () => {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    const { data } = await (supabase as any)
      .from('site_settings')
      .select('favicon_url, site_title, site_description')
      .eq('id', 1)
      .maybeSingle();
    cached = {
      favicon: data?.favicon_url || '',
      title: data?.site_title || '',
      description: data?.site_description || '',
    };
    return cached;
  })();
  return inflight;
};

const setFaviconHref = (href: string) => {
  let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = href;
};

const setMetaDescription = (content: string) => {
  let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'description';
    document.head.appendChild(meta);
  }
  meta.content = content;
};

/**
 * Aplica o favicon/título/descrição GLOBAL definidos pelo admin em site_settings.
 * Use como bootstrap (ex: no App.tsx) para garantir que toda página sem
 * personalização própria mostre o favicon padrão do sistema.
 */
export const applyGlobalSiteDefaults = async () => {
  const settings = await fetchSiteSettings();
  if (!settings) return;
  if (settings.favicon) setFaviconHref(settings.favicon);
  if (settings.title && !document.title) document.title = settings.title;
  if (settings.description) setMetaDescription(settings.description);
};

/**
 * Retorna apenas a URL do favicon padrão do sistema (cacheado).
 * Útil como fallback quando o operador não definiu um próprio.
 */
export const getGlobalFavicon = async (): Promise<string> => {
  const settings = await fetchSiteSettings();
  return settings?.favicon || '';
};
