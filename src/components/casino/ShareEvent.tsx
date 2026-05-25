import { useRef, useState } from 'react';
import { X, Download, Share2, Loader2, Calendar, Link2, Check, Flame } from 'lucide-react';
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

export default function ShareEvent({ open, onClose, data, config = {} }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const bgFrom = config.bgFrom || '#0b0b14';
  const bgTo = config.bgTo || '#1a1230';
  const accent = config.accent || '#22d3ee';
  const textColor = config.textColor || '#ffffff';
  const muted = config.mutedColor || '#a0a0c0';
  const cardBg = config.cardBg || 'rgba(255,255,255,0.05)';
  const brandName = config.brandName || '';
  const ctaText = config.ctaText || 'Aposte agora';
  const ctaUrl = config.ctaUrl || '';
  const footer = config.footer || 'Não perca esse jogo!';

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
      <div className="w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div
          ref={cardRef}
          className="relative rounded-2xl overflow-hidden p-4"
          style={{
            background: `linear-gradient(160deg, ${bgFrom} 0%, ${bgTo} 100%)`,
            color: textColor,
            border: `2px solid ${accent}55`,
            boxShadow: `0 0 60px ${accent}33`,
          }}
        >
          <div aria-hidden className="absolute -top-24 -right-24 w-40 h-40 rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, ${accent}15, transparent 70%)` }} />

          {/* Header */}
          <div className="relative flex items-center justify-center mb-3 pt-1">
            <div className="flex w-full items-center justify-center min-w-0 px-8">
              {config.logoUrl ? (
                <img src={config.logoUrl} alt="" crossOrigin="anonymous" className="h-12 w-full max-w-[160px] object-contain" />
              ) : brandName ? (
                <span className="font-black text-base tracking-tight truncate" style={{ color: accent }}>{brandName}</span>
              ) : null}
            </div>
            <div className="absolute right-0 top-0 text-[9px] font-bold tracking-[0.2em] px-2 py-0.5 rounded-full"
              style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}55` }}>
              EVENTO
            </div>
          </div>

          {/* Category / hot */}
          {(data.category || data.isHot) && (
            <div className="relative flex items-center justify-center gap-2 mb-2">
              {data.category && (
                <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full" style={{ background: `${accent}1a`, color: accent }}>
                  {data.category}
                </span>
              )}
              {data.isHot && (
                <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: '#f9731622', color: '#fb923c' }}>
                  <Flame size={10} /> Quente
                </span>
              )}
            </div>
          )}

          {/* Title */}
          <div className="relative text-center mb-3">
            <h2 className="text-lg font-black tracking-tight leading-tight" style={{ color: textColor, textShadow: `0 0 16px ${accent}55` }}>
              {data.eventTitle}
            </h2>
            {data.subtitle && (
              <p className="text-xs mt-1" style={{ color: muted }}>{data.subtitle}</p>
            )}
          </div>

          {/* Time */}
          {(data.startsAt || data.closesAt) && (
            <div className="relative flex items-center justify-center gap-2 mb-3 text-[11px] font-semibold tabular-nums" style={{ color: textColor }}>
              <Calendar size={12} />
              <span>{fmtDate(data.startsAt || data.closesAt)}</span>
            </div>
          )}

          {/* Markets */}
          <div className="relative space-y-2 mb-3">
            {data.markets.slice(0, 3).map((m, i) => (
              <div key={i} className="rounded-xl p-2.5" style={{ background: cardBg, border: `1px solid ${textColor}11` }}>
                <div className="text-[9px] uppercase tracking-wider mb-1.5 font-bold" style={{ color: muted }}>
                  {translateMarketName(m.title)}
                </div>
                <div className={`grid gap-1.5 ${m.outcomes.length >= 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  {m.outcomes.slice(0, 3).map((o, j) => (
                    <div key={j} className="rounded-lg px-2 py-1.5 text-center" style={{ background: `${accent}10`, border: `1px solid ${accent}33` }}>
                      <div className="text-[9px] uppercase tracking-[0.12em] font-bold truncate" style={{ color: muted }}>
                        {translateOutcome(o.label)}
                      </div>
                      <div className="font-black text-sm tabular-nums" style={{ color: accent }}>
                        {Number(o.odd).toFixed(2).replace('.', ',')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="relative text-center">
            <p className="text-sm font-semibold mb-1">{footer}</p>
            {ctaUrl && (
              <p className="text-xs font-bold" style={{ color: accent }}>
                {ctaText} · {ctaUrl.replace(/^https?:\/\//, '')}
              </p>
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
