import { Helmet } from 'react-helmet-async';

export interface LobbySEOConfig {
  seo_title?: string;
  seo_description?: string;
  seo_image_url?: string;
  seo_keywords?: string;
  favicon_url?: string;
  noindex?: boolean;
}

interface Props {
  tag: string;
  config: LobbySEOConfig;
  /** Fallbacks usados quando os campos SEO específicos não estão preenchidos */
  fallbackTitle?: string;
  fallbackDescription?: string;
  fallbackImage?: string;
}

const SITE_BASE = 'https://tipspayroleta.com';

const LobbySEO = ({ tag, config, fallbackTitle, fallbackDescription, fallbackImage }: Props) => {
  const title = config.seo_title || fallbackTitle || 'Lobby de promoções';
  const description =
    config.seo_description ||
    fallbackDescription ||
    'Acesse promoções exclusivas, roleta, caixas e apostas em um só lugar.';
  const image = config.seo_image_url || fallbackImage;
  const url = `${SITE_BASE}/lobby=${tag}`;
  const favicon = config.favicon_url;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: title,
    url,
    description,
  };

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      {config.seo_keywords && <meta name="keywords" content={config.seo_keywords} />}
      {config.noindex ? (
        <meta name="robots" content="noindex,nofollow" />
      ) : (
        <meta name="robots" content="index,follow" />
      )}
      <link rel="canonical" href={url} />
      {favicon && <link rel="icon" href={favicon} />}
      {favicon && <link rel="apple-touch-icon" href={favicon} />}

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      {image && <meta property="og:image" content={image} />}

      {/* Twitter */}
      <meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {image && <meta name="twitter:image" content={image} />}

      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </Helmet>
  );
};

export default LobbySEO;
