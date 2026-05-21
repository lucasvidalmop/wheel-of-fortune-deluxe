/**
 * Optimize a Supabase Storage public URL via the image-render endpoint.
 * Falls back to the original URL for non-Supabase URLs.
 */
export function optimizedImage(
  url: string | null | undefined,
  opts: { width?: number; quality?: number; format?: 'webp' | 'origin' } = {}
): string | undefined {
  if (!url) return undefined;
  const { width = 1600, quality = 70, format = 'webp' } = opts;
  // Only transform Supabase storage public object URLs
  if (!url.includes('/storage/v1/object/public/')) return url;
  const rendered = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
  const sep = rendered.includes('?') ? '&' : '?';
  return `${rendered}${sep}width=${width}&quality=${quality}&format=${format}&resize=cover`;
}
