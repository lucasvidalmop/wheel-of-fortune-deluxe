import { useRef, useState } from 'react';
import { X, Download, Share2, Loader2, TrendingUp, TrendingDown, Clock, Trophy } from 'lucide-react';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';

export interface ShareTicketData {
  userName?: string;
  userId?: string;
  eventTitle: string;
  outcomeLabel: string;
  odd: number;
  amount: number;
  payout: number;
  status: 'pending' | 'won' | 'lost' | 'refunded' | 'cancelled';
  payoutMode: 'coins' | 'case';
  coinName: string;
  createdAt: string;
}

const maskId = (id?: string) => {
  if (!id) return '***';
  const clean = String(id).replace(/-/g, '');
  if (clean.length <= 4) return `***${clean}`;
  return `${clean.slice(0, 4)}***${clean.slice(-4)}`;
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
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return ''; }
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

  const downloadImage = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: bgFrom,
      });
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
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2, cacheBust: true, backgroundColor: bgFrom,
      });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'bilhete.png', { type: 'image/png' });
      const shareText = isWin
        ? `🎉 Acabei de ganhar ${data.payout} ${data.coinName} em "${data.eventTitle}"!`
        : `Olha minha aposta em "${data.eventTitle}" — odd ${data.odd.toFixed(2)}`;
      const fullText = ctaUrl ? `${shareText}\n\n${ctaUrl}` : shareText;

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
          className="relative rounded-2xl overflow-hidden p-6"
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
          <div className="relative flex items-center justify-center mb-6 pt-2">
            <div className="flex w-full items-center justify-center min-w-0 px-8">
              {config.logoUrl ? (
                <img src={config.logoUrl} alt="" crossOrigin="anonymous" className="h-28 w-full max-w-[280px] object-contain" />
              ) : brandName ? (
                <span className="font-black text-base tracking-tight truncate" style={{ color: accent }}>
                  {brandName}
                </span>
              ) : null}
            </div>
            <div
              className="absolute right-0 top-0 text-[10px] font-bold tracking-[0.2em] px-2 py-1 rounded-full"
              style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}55` }}
            >
              BILHETE
            </div>
          </div>

          {/* Status */}
          <div className="relative text-center mb-5">

            <h2
              className="text-2xl font-black tracking-tight leading-tight"
              style={{ color: accent, textShadow: `0 0 16px ${accent}55` }}
            >
              {title}
            </h2>
            <p className="text-sm mt-1" style={{ color: muted }}>{data.userName}</p>
          </div>

          {/* Event */}
          <div
            className="relative rounded-xl p-4 mb-4"
            style={{ background: cardBg, border: `1px solid ${textColor}11` }}
          >
            <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: muted }}>
              Evento
            </div>
            <div className="font-bold text-base leading-snug mb-3">{data.eventTitle}</div>

            <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: muted }}>
              Palpite
            </div>
            <div
              className="inline-block px-3 py-1.5 rounded-lg font-bold text-sm mb-3"
              style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}55` }}
            >
              {data.outcomeLabel} · {data.odd.toFixed(2)}
            </div>

            {/* Amounts grid */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t" style={{ borderColor: `${textColor}11` }}>
              <div>
                <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: muted }}>
                  Aposta
                </div>
                <div className="font-bold tabular-nums">
                  {data.amount} <span className="text-xs font-normal" style={{ color: muted }}>{data.coinName}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: muted }}>
                  {isWin ? 'Retorno' : isPending ? 'Potencial' : isLoss ? 'Perdeu' : 'Retorno'}
                </div>
                <div className="font-bold tabular-nums" style={{ color: isWin || isPending ? accent : textColor }}>
                  {data.payoutMode === 'case' ? '🎁 caixa' : `${data.payout} ${data.coinName}`}
                </div>
              </div>
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
            <div className="text-[10px] mt-3 flex items-center justify-center gap-2" style={{ color: muted }}>
              <span>{fmtDate(data.createdAt)}</span>
            </div>
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
