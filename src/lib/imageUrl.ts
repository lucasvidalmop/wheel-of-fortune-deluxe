/**
 * Optimize a Supabase Storage public URL via the image-render endpoint.
 * Falls back to the original URL for non-Supabase URLs.
 *
 * - Preserves aspect ratio (no forced crop).
 * - Accounts for devicePixelRatio so images stay crisp on retina screens.
 */
export function optimizedImage(
  url: string | null | undefined,
  opts: {
    width?: number;
    quality?: number;
    format?: 'webp' | 'origin';
    /** 'contain' preserves aspect ratio (default). 'cover' crops to fill. */
    resize?: 'contain' | 'cover';
    /** Multiply width by devicePixelRatio for crisp rendering. Default true. */
    retina?: boolean;
  } = {}
): string | undefined {
  if (!url) return undefined;
  const {
    width = 1600,
    quality = 82,
    format = 'webp',
    resize = 'contain',
    retina = true,
  } = opts;
  if (!url.includes('/storage/v1/object/public/')) return url;

  const dpr =
    retina && typeof window !== 'undefined' && window.devicePixelRatio
      ? Math.min(2, Math.max(1, Math.round(window.devicePixelRatio)))
      : 1;
  const finalWidth = Math.min(2400, Math.round(width * dpr));

  const rendered = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
  const sep = rendered.includes('?') ? '&' : '?';
  return `${rendered}${sep}width=${finalWidth}&quality=${quality}&format=${format}&resize=${resize}`;
}
