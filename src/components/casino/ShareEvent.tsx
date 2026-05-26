import { useRef, useState, useEffect } from 'react';
import { X, Download, Share2, Loader2, Calendar, Link2, Check, Flame, Trophy } from 'lucide-react';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';
import type { TicketConfig } from './ShareTicket';
import { translateMarketName } from '@/lib/marketTranslations';

export interface ShareEventOutcome {
  label: string;
  odd: number;
}
export interface ShareEventMarket {
  title: string;
  outcomes: ShareEventOutcome[];
}
export interface ShareEventData {
  eventTitle: string;
  subtitle?: string;
  category?: string;
  startsAt?: string | null;
  closesAt?: string | null;
  isHot?: boolean;
  markets: ShareEventMarket[];
  copyUrl?: string;
  homeImageUrl?: string;
  awayImageUrl?: string;
  eventImageUrl?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  data: ShareEventData;
  config?: TicketConfig;
}

const fmtDate = (iso?: string | null) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch { return ''; }
};

const translateOutcome = (label: string) => {
  const map: Record<string, string> = {
    HOME: 'CASA', AWAY: 'FORA', DRAW: 'EMPATE', TIE: 'EMPATE',
    YES: 'SIM', NO: 'NÃO', OVER: 'MAIS', UNDER: 'MENOS',
    ODD: 'ÍMPAR', EVEN: 'PAR',
  };
  return label.split(/(\s+)/).map(t => {
    if (/^\s+$/.test(t)) return t;
    return map[t.toUpperCase()] || t;
  }).join('');
};

// Split "Team A vs Team B" / " x " / " - " into two sides
const splitTeams = (title: string): [string, string] | null => {
  const m = title.match(/^(.+?)\s+(?:vs\.?|x|×|-|–)\s+(.+)$/i);
  if (!m) return null;
  return [m[1].trim(), m[2].trim()];
};

const initials = (name: string) =>
  name
    .replace(/[^\p{L}\s]/gu, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase())
    .join('') || name.slice(0, 2).toUpperCase();

export default function ShareEvent({ open, onClose, data, config = {} }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [resolvedImgs, setResolvedImgs] = useState<{ home?: string; away?: string; event?: string }>({});

  // Pre-resolve remote images to data URLs (CORS-safe) for both display and PNG capture.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const toDataUrl = async (url?: string): Promise<string | undefined> => {
      if (!url) return undefined;
      // Already a data url / same origin
      if (url.startsWith('data:')) return url;
      try {
        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) throw new Error('bad status');
        const blob = await res.blob();
        return await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.onerror = reject;
          r.readAsDataURL(blob);
        });
      } catch {
        return url; // fallback — will at least show in UI without CORS, may be tainted in PNG
      }
    };
    (async () => {
      const [home, away, event] = await Promise.all([
        toDataUrl(data.homeImageUrl),
        toDataUrl(data.awayImageUrl),
        toDataUrl(data.eventImageUrl),
      ]);
      if (!cancelled) setResolvedImgs({ home, away, event });
    })();
    return () => { cancelled = true; };
  }, [open, data.homeImageUrl, data.awayImageUrl, data.eventImageUrl]);


  if (!open) return null;

  const bgFrom = config.bgFrom || '#0b0b14';
  const bgTo = config.bgTo || '#1a1230';
  const accent = config.accent || '#22d3ee';
  const textColor = config.textColor || '#ffffff';
  const muted = config.mutedColor || '#a0a0c0';
  const brandName = config.brandName || '';
  const ctaText = config.ctaText || 'Aposte agora';
  const ctaUrl = config.ctaUrl || '';

  const teams = splitTeams(data.eventTitle);
  const homeName = teams?.[0] ?? data.eventTitle;
  const awayName = teams?.[1] ?? '';

  const featured = data.markets[0];

  const waitForImages = async () => {
    if (!cardRef.current) return;
    const imgs = Array.from(cardRef.current.querySelectorAll('img'));
    await Promise.all(imgs.map(img =>
      img.complete && img.naturalWidth > 0
        ? Promise.resolve()
        : new Promise<void>(r => { img.onload = () => r(); img.onerror = () => r(); })
    ));
  };

  const renderPng = async () => {
    await waitForImages();
    await toPng(cardRef.current!, { pixelRatio: 2, cacheBust: true, backgroundColor: bgFrom });
    return toPng(cardRef.current!, { pixelRatio: 2, cacheBust: true, backgroundColor: bgFrom });
  };

  const downloadImage = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const url = await renderPng();
      const a = document.createElement('a');
      a.href = url;
      a.download = `evento-${data.eventTitle.replace(/\s+/g, '-').slice(0, 30)}.png`;
      a.click();
      toast.success('Evento baixado!');
    } catch { toast.error('Falha ao gerar imagem'); }
    finally { setDownloading(false); }
  };

  const shareEvent = async () => {
    if (!cardRef.current) return;
    setSharing(true);
    try {
      const url = await renderPng();
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], 'evento.png', { type: 'image/png' });
      const link = data.copyUrl || ctaUrl;
      const text = `🔥 ${data.eventTitle}${data.startsAt ? ` — ${fmtDate(data.startsAt)}` : ''}${link ? `\n\n👉 ${link}` : ''}`;
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text, title: brandName || data.eventTitle });
      } else if (navigator.share) {
        await navigator.share({ text, title: brandName || data.eventTitle });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success('Texto copiado!');
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') toast.error('Falha ao compartilhar');
    } finally { setSharing(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-[360px]" onClick={e => e.stopPropagation()}>
        {/* Stadium card */}
        <div
          ref={cardRef}
          className="relative rounded-3xl overflow-hidden"
          style={{
            background: `linear-gradient(180deg, ${bgFrom} 0%, ${bgTo} 100%)`,
            color: textColor,
            boxShadow: `0 30px 80px -20px ${accent}55, 0 0 0 1px ${accent}33 inset`,
          }}
        >
          {/* Top stripe band */}
          <div className="relative px-5 pt-5 pb-4" style={{ background: `linear-gradient(135deg, ${accent}22, transparent 70%)` }}>
            <div aria-hidden className="absolute inset-0 opacity-[0.08]" style={{
              backgroundImage: `repeating-linear-gradient(45deg, ${textColor} 0 1px, transparent 1px 14px)`,
            }} />
            <div className="relative flex items-center justify-between">
              {config.logoUrl ? (
                <img src={config.logoUrl} alt="" crossOrigin="anonymous" className="h-8 object-contain" />
              ) : (
                <span className="font-black tracking-tight text-sm" style={{ color: accent }}>{brandName || 'EVENTO'}</span>
              )}
              <div className="flex items-center gap-1.5">
                {data.isHot && (
                  <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1"
                    style={{ background: '#fb923c', color: '#0b0b14' }}>
                    <Flame size={10} /> Quente
                  </span>
                )}
                {data.category && (
                  <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{ background: `${textColor}1a`, color: textColor }}>
                    {data.category}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Event hero image (when no teams) */}
          {!teams && (resolvedImgs.event || data.eventImageUrl) && (
            <div className="px-5 pt-4">
              <div className="rounded-2xl overflow-hidden aspect-[16/9]" style={{ boxShadow: `0 10px 30px -10px ${accent}66` }}>
                <img src={resolvedImgs.event || data.eventImageUrl} alt="" className="w-full h-full object-cover" />
              </div>
            </div>
          )}


          {/* Versus block */}
          <div className="relative px-5 py-6">
            {teams ? (
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                {/* Home */}
                <div className="flex flex-col items-center text-center gap-2">
                  {(resolvedImgs.home || data.homeImageUrl) ? (
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center p-2 bg-white"
                      style={{ boxShadow: `0 10px 30px -10px ${accent}99`, border: `1px solid ${accent}66` }}>
                      <img src={resolvedImgs.home || data.homeImageUrl} alt="" className="w-full h-full object-contain" />
                    </div>

                  ) : (
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-xl"
                      style={{
                        background: `linear-gradient(135deg, ${accent}, ${accent}88)`,
                        color: '#0b0b14',
                        boxShadow: `0 10px 30px -10px ${accent}99`,
                      }}>
                      {initials(homeName)}
                    </div>
                  )}
                  <div className="text-[11px] font-bold leading-tight line-clamp-2" style={{ color: textColor }}>
                    {homeName}
                  </div>
                </div>

                {/* VS */}
                <div className="flex flex-col items-center gap-1">
                  <div className="text-[10px] font-bold tracking-[0.3em]" style={{ color: muted }}>VS</div>
                  <div className="w-px h-10" style={{ background: `${accent}55` }} />
                </div>

                {/* Away */}
                <div className="flex flex-col items-center text-center gap-2">
                  {data.awayImageUrl ? (
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center p-2 bg-white"
                      style={{ border: `1px solid ${accent}66` }}>
                      <img src={data.awayImageUrl} alt="" crossOrigin="anonymous" className="w-full h-full object-contain" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-xl border-2"
                      style={{
                        background: `${textColor}0a`,
                        color: textColor,
                        borderColor: `${accent}66`,
                      }}>
                      {initials(awayName)}
                    </div>
                  )}
                  <div className="text-[11px] font-bold leading-tight line-clamp-2" style={{ color: textColor }}>
                    {awayName}
                  </div>
                </div>
              </div>
            ) : (
              <h2 className="text-center text-xl font-black tracking-tight" style={{ color: textColor }}>
                {data.eventTitle}
              </h2>
            )}

            {data.subtitle && (
              <p className="text-center text-[11px] mt-3" style={{ color: muted }}>{data.subtitle}</p>
            )}

            {(data.startsAt || data.closesAt) && (
              <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] font-semibold"
                style={{ color: textColor }}>
                <Calendar size={12} style={{ color: accent }} />
                <span className="tabular-nums">{fmtDate(data.startsAt || data.closesAt)}</span>
              </div>
            )}
          </div>

          {/* Divider with notch */}
          <div className="relative">
            <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full" style={{ background: bgFrom }} />
            <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full" style={{ background: bgTo }} />
            <div className="mx-5 border-t border-dashed" style={{ borderColor: `${textColor}22` }} />
          </div>

          {/* Featured market */}
          {featured && (
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: muted }}>
                  {translateMarketName(featured.title)}
                </div>
                <Trophy size={12} style={{ color: accent }} />
              </div>
              <div className={`grid gap-2 ${featured.outcomes.length >= 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                {featured.outcomes.slice(0, 3).map((o, j) => (
                  <div key={j} className="rounded-xl px-2 py-2.5 text-center"
                    style={{
                      background: `linear-gradient(180deg, ${accent}22, ${accent}08)`,
                      border: `1px solid ${accent}44`,
                    }}>
                    <div className="text-[9px] font-bold uppercase tracking-[0.12em] truncate" style={{ color: muted }}>
                      {translateOutcome(o.label)}
                    </div>
                    <div className="font-black text-base tabular-nums leading-tight" style={{ color: accent }}>
                      {Number(o.odd).toFixed(2).replace('.', ',')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Extra markets pills */}
          {data.markets.length > 1 && (
            <div className="px-5 pb-4 flex flex-wrap gap-1.5">
              {data.markets.slice(1, 4).map((m, i) => (
                <span key={i} className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
                  style={{ background: `${textColor}0d`, color: muted, border: `1px solid ${textColor}11` }}>
                  + {translateMarketName(m.title)}
                </span>
              ))}
              {data.markets.length > 4 && (
                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
                  style={{ background: `${accent}1a`, color: accent }}>
                  +{data.markets.length - 4} mercados
                </span>
              )}
            </div>
          )}

          {/* CTA footer */}
          <div className="px-5 pt-3 pb-5 text-center" style={{ background: `linear-gradient(0deg, ${accent}10, transparent)` }}>
            <div className="text-[13px] font-black tracking-tight" style={{ color: textColor }}>
              {ctaText}
            </div>
            {ctaUrl && (
              <div className="text-[10px] font-semibold mt-0.5" style={{ color: accent }}>
                {ctaUrl.replace(/^https?:\/\//, '')}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <button onClick={downloadImage} disabled={downloading}
            className="py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition hover:opacity-90"
            style={{ background: accent, color: '#000' }}>
            {downloading ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
            Baixar
          </button>
          <button onClick={shareEvent} disabled={sharing}
            className="py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 bg-white/10 text-white hover:bg-white/15 transition">
            {sharing ? <Loader2 className="animate-spin" size={16} /> : <Share2 size={16} />}
            Compartilhar
          </button>
          <button
            onClick={async () => {
              if (!data.copyUrl) return;
              try {
                await navigator.clipboard.writeText(data.copyUrl);
                setCopied(true);
                toast.success('Link copiado!');
                setTimeout(() => setCopied(false), 2000);
              } catch { toast.error('Não foi possível copiar'); }
            }}
            disabled={!data.copyUrl}
            className="py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 bg-white/10 text-white hover:bg-white/15 transition">
            {copied ? <Check size={16} /> : <Link2 size={16} />}
            {copied ? 'Copiado' : 'Link'}
          </button>
        </div>
        <button onClick={onClose} className="mt-2 w-full py-2 rounded-xl text-sm text-white/70 hover:text-white flex items-center justify-center gap-1.5">
          <X size={14} /> Fechar
        </button>
      </div>
    </div>
  );
}
