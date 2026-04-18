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
 * Sinaliza que uma página/operador já assumiu o controle do branding (favicon/título/descrição).
 * A partir desse momento, `applyGlobalSiteDefaults` vira no-op para evitar que o padrão
 * global sobrescreva o personalizado por causa de race condition assíncrona.
 *
 * Páginas que aplicam SEO próprio (Roleta, Referral, Registration, Deposit, Dashboard,
 * Influencer, Admin) DEVEM chamar isto assim que carregarem — independente de o operador
 * ter ou não preenchido os campos. Se não houver valor próprio, a própria página puxa o
 * fallback global usando `getGlobalFavicon` / fetch direto em site_settings.
 */
export const claimBrandingControl = () => {
  (window as any).__lovableBrandingClaimed = true;
};

export const isBrandingClaimed = () => Boolean((window as any).__lovableBrandingClaimed);

/**
 * Aplica o favicon/título/descrição GLOBAL definidos pelo admin em site_settings.
 * Usado APENAS como bootstrap para páginas que não personalizam SEO (ex: Index/home,
 * NotFound, Unsubscribe). Se outra página já tiver chamado `claimBrandingControl`,
 * esta função não faz nada.
 */
export const applyGlobalSiteDefaults = async () => {
  if (isBrandingClaimed()) return;
  const settings = await fetchSiteSettings();
  if (!settings) return;
  // Re-checa após o await — outra página pode ter assumido o controle nesse intervalo.
  if (isBrandingClaimed()) return;
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
