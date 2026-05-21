import { useRef, useState } from 'react';
import { X, Download, Share2, Loader2, TrendingDown, Clock, Trophy, Calendar, Ticket, Link2, Check } from 'lucide-react';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';

export interface ShareTicketData {
  userName?: string;
  userId?: string;
  wagerCode?: string;
  eventTitle: string;
  outcomeLabel: string;
  odd: number;
  amount: number;
  payout: number;
  status: 'pending' | 'won' | 'lost' | 'refunded' | 'cancelled';
  payoutMode: 'coins' | 'case';
  coinName: string;
  createdAt: string;
  copyUrl?: string;
}

const maskId = (id?: string) => {
  if (!id) return '***';
  const clean = String(id).replace(/-/g, '');
  if (clean.length <= 6) return `${clean.slice(0, 2)}***${clean.slice(-2)}`;
  return `${clean.slice(0, 6)}***${clean.slice(-4)}`;
};

export interface TicketConfig {
  enabled?: boolean;
  brandName?: string;
  logoUrl?: string;
  titleWin?: string;
  titleLoss?: string;
  titlePending?: string;
  footer?: string;
  ctaText?: string;
  ctaUrl?: string;
  bgFrom?: string;
  bgTo?: string;
  accent?: string;
  accentWin?: string;
  accentLoss?: string;
  textColor?: string;
  mutedColor?: string;
  cardBg?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  data: ShareTicketData;
  config?: TicketConfig;
}

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).replace(',', ' •');
  } catch { return ''; }
};

const shortId = (id?: string) => {
  if (!id) return '------';
  const clean = String(id).replace(/-/g, '').toUpperCase();
  return clean.slice(0, 6);
};

export default function ShareTicket({ open, onClose, data, config = {} }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);

  if (!open) return null;

  const isWin = data.status === 'won';
  const isLoss = data.status === 'lost';
  const isPending = data.status === 'pending';

  const bgFrom = config.bgFrom || '#0b0b14';
  const bgTo = config.bgTo || '#1a1230';
  const accent = isWin
    ? (config.accentWin || '#22c55e')
    : isLoss
      ? (config.accentLoss || '#ef4444')
      : (config.accent || '#22d3ee');
  const textColor = config.textColor || '#ffffff';
  const muted = config.mutedColor || '#a0a0c0';
  const cardBg = config.cardBg || 'rgba(255,255,255,0.05)';

  const title = isWin
    ? (config.titleWin || 'GANHEI! 🎉')
    : isLoss
      ? (config.titleLoss || 'Não foi dessa vez 😢')
      : (config.titlePending || 'Aposta em andamento ⏳');

  const footer = config.footer || 'Faça sua aposta também!';
  const ctaText = config.ctaText || 'Aposte agora';
  const ctaUrl = config.ctaUrl || '';
  const brandName = config.brandName || '';

  const StatusIcon = isWin ? Trophy : isLoss ? TrendingDown : Clock;

  const waitForImages = async () => {
    if (!cardRef.current) return;
    const imgs = Array.from(cardRef.current.querySelectorAll('img'));
    await Promise.all(
      imgs.map(img =>
        img.complete && img.naturalWidth > 0
          ? Promise.resolve()
          : new Promise<void>(resolve => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            })
      )
    );
  };

  const renderPng = async () => {
    await waitForImages();
    // double pass: first call warms fonts/images, second produces stable output
    await toPng(cardRef.current!, { pixelRatio: 2, cacheBust: true, backgroundColor: bgFrom });
    return toPng(cardRef.current!, { pixelRatio: 2, cacheBust: true, backgroundColor: bgFrom });
  };

  const downloadImage = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await renderPng();
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `bilhete-${data.eventTitle.replace(/\s+/g, '-').slice(0, 30)}.png`;
      a.click();
      toast.success('Bilhete baixado!');
    } catch (e: any) {
      toast.error('Falha ao gerar imagem');
    } finally {
      setDownloading(false);
    }
  };

  const shareTicket = async () => {
    if (!cardRef.current) return;
    setSharing(true);
    try {
      const dataUrl = await renderPng();
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'bilhete.png', { type: 'image/png' });
      const shareText = isWin
        ? `🎉 Acabei de ganhar ${data.payout} ${data.coinName} em "${data.eventTitle}"!`
        : `Olha minha aposta em "${data.eventTitle}" — odd ${data.odd.toFixed(2)}`;
      const copyLine = data.copyUrl ? `\n\n👉 Copie este bilhete: ${data.copyUrl}` : '';
      const fullText = (ctaUrl ? `${shareText}\n\n${ctaUrl}` : shareText) + copyLine;

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: fullText, title: brandName || 'Meu bilhete' });
      } else if (navigator.share) {
        await navigator.share({ text: fullText, title: brandName || 'Meu bilhete' });
      } else {
        await navigator.clipboard.writeText(fullText);
        toast.success('Texto copiado para a área de transferência!');
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') toast.error('Falha ao compartilhar');
    } finally {
      setSharing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div className="w-full max-w-sm" onClick={e => e.stopPropagation()}>
        {/* Ticket card */}
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
          {/* Decorative glow */}
          <div
            aria-hidden
            className="absolute -top-24 -right-24 w-40 h-40 rounded-full pointer-events-none"
            style={{ background: `radial-gradient(circle, ${accent}15, transparent 70%)` }}
          />

          {/* Header */}
          <div className="relative flex items-center justify-center mb-3 pt-1">
            <div className="flex w-full items-center justify-center min-w-0 px-8">
              {config.logoUrl ? (
                <img src={config.logoUrl} alt="" crossOrigin="anonymous" className="h-14 w-full max-w-[180px] object-contain" />
              ) : brandName ? (
                <span className="font-black text-base tracking-tight truncate" style={{ color: accent }}>
                  {brandName}
                </span>
              ) : null}
            </div>
            <div
              className="absolute right-0 top-0 text-[9px] font-bold tracking-[0.2em] px-2 py-0.5 rounded-full"
              style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}55` }}
            >
              BILHETE
            </div>
          </div>

          {/* Status */}
          <div className="relative text-center mb-3">
            <h2
              className="text-lg font-black tracking-tight leading-tight"
              style={{ color: accent, textShadow: `0 0 16px ${accent}55` }}
            >
              {title}
            </h2>
          </div>

          {/* Meta bar: date + ID */}
          <div
            className="relative flex items-center justify-between gap-2 mb-2 px-1 text-[10px] font-semibold"
            style={{ color: textColor }}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <Calendar size={12} style={{ color: textColor }} />
              <span className="truncate tabular-nums">{fmtDate(data.createdAt)}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 pl-2" style={{ borderLeft: `1px solid ${textColor}22` }}>
              <Ticket size={12} style={{ color: textColor }} />
              <span className="tabular-nums tracking-wider">ID: {data.wagerCode || shortId(data.userId)}</span>
            </div>
          </div>

          {/* Event title */}
          <div
            className="relative rounded-xl p-2.5 mb-2"
            style={{ background: cardBg, border: `1px solid ${textColor}11` }}
          >
            <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: muted }}>Evento</div>
            <div className="font-bold text-[13px] leading-snug mb-1.5">{data.eventTitle}</div>
            <div
              className="inline-block px-2 py-0.5 rounded-md font-bold text-[11px]"
              style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}55` }}
            >
              {data.outcomeLabel}
            </div>
          </div>

          {/* VALOR / COTA cards */}
          <div className="relative grid grid-cols-2 gap-2 mb-2">
            {/* VALOR */}
            <div
              className="relative rounded-xl px-2.5 py-2 overflow-hidden"
              style={{
                background: `linear-gradient(180deg, ${cardBg}, ${cardBg})`,
                border: `1px solid ${accent}33`,
                boxShadow: `inset 0 -1px 0 ${accent}88, 0 8px 24px -10px ${accent}66`,
              }}
            >
              <div
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-px"
                style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
              />
              <div className="text-[9px] uppercase tracking-[0.18em] font-bold mb-0.5" style={{ color: accent }}>VALOR</div>
              <div className="font-black text-lg tabular-nums leading-none" style={{ color: accent, textShadow: `0 0 12px ${accent}55` }}>
                {data.amount.toLocaleString('pt-BR')}
              </div>
              <div className="text-[9px] mt-0.5 font-medium" style={{ color: muted }}>{data.coinName}</div>
            </div>

            {/* COTA */}
            <div
              className="relative rounded-xl px-2.5 py-2"
              style={{ background: cardBg, border: `1px solid ${textColor}15` }}
            >
              <div className="text-[9px] uppercase tracking-[0.18em] font-bold mb-0.5" style={{ color: muted }}>COTA</div>
              <div className="font-black text-lg tabular-nums leading-none" style={{ color: textColor }}>
                {data.odd.toFixed(2).replace('.', ',')}
              </div>
              <div className="text-[9px] mt-0.5 font-medium" style={{ color: muted }}>multiplicador</div>
            </div>
          </div>

          {/* Retorno */}
          <div
            className="relative rounded-xl px-3 py-2 mb-2 flex items-center justify-between"
            style={{ background: cardBg, border: `1px solid ${textColor}11` }}
          >
            <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: muted }}>
              {isWin ? 'Retorno' : isPending ? 'Retorno potencial' : isLoss ? 'Perdeu' : 'Retorno'}
            </div>
            <div className="font-black text-base tabular-nums" style={{ color: isWin || isPending ? accent : textColor }}>
              {data.payoutMode === 'case' ? '🎁 caixa' : `${data.payout.toLocaleString('pt-BR')} ${data.coinName}`}
            </div>
          </div>

          {/* Footer */}
          <div className="relative text-center">
            <p className="text-sm font-semibold mb-1" style={{ color: textColor }}>{footer}</p>
            {ctaUrl && (
              <p className="text-xs font-medium" style={{ color: accent }}>
                {ctaUrl.replace(/^https?:\/\//, '')}
              </p>
            )}
            {data.copyUrl && (
              <div
                className="mt-3 rounded-lg px-3 py-2 text-center"
                style={{ background: `${accent}11`, border: `1px dashed ${accent}55` }}
              >
                <div className="text-[9px] uppercase tracking-[0.18em] font-bold mb-0.5" style={{ color: accent }}>
                  Copie este bilhete
                </div>
                <div className="text-[10px] font-mono break-all" style={{ color: textColor }}>
                  {data.copyUrl.replace(/^https?:\/\//, '')}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Actions */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={downloadImage}
            disabled={downloading}
            className="py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition hover:opacity-90"
            style={{ background: accent, color: '#000' }}
          >
            {downloading ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
            Baixar
          </button>
          <button
            onClick={shareTicket}
            disabled={sharing}
            className="py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 bg-white/10 text-white hover:bg-white/15 transition"
          >
            {sharing ? <Loader2 className="animate-spin" size={16} /> : <Share2 size={16} />}
            Compartilhar
          </button>
        </div>
        <button
          onClick={onClose}
          className="mt-2 w-full py-2 rounded-xl text-sm text-white/70 hover:text-white flex items-center justify-center gap-1.5"
        >
          <X size={14} /> Fechar
        </button>
      </div>
    </div>
  );
}
