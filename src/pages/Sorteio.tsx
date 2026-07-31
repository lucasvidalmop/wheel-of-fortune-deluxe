import { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2, Radio, Share2, Copy, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useRaffleRealtime } from '@/hooks/useRaffleRealtime';
import { RAFFLE_STATUS_LABEL, type RaffleEventPublic, type RaffleResultPublic } from '@/lib/raffle';
import { getLobbySession } from '@/lib/lobbySession';
import RaffleCountdown from '@/components/raffle/RaffleCountdown';
import RaffleProgress from '@/components/raffle/RaffleProgress';
import RaffleJoinForm from '@/components/raffle/RaffleJoinForm';
import RaffleTicket from '@/components/raffle/RaffleTicket';
import RaffleResult from '@/components/raffle/RaffleResult';

interface Payload {
  found: boolean;
  event?: RaffleEventPublic;
  approvedCount?: number;
  result?: RaffleResultPublic | null;
  me?: { publicCode: string; status: string; displayName: string } | null;
}

const Sorteio = ({ tag }: { tag: string }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Payload | null>(null);
  const [joined, setJoined] = useState<{ publicCode?: string; status?: string; message?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const pending = useRef(false);

  const load = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;
    try {
      const session = getLobbySession();
      const { data: res } = await supabase.functions.invoke('get-raffle-event', {
        body: { tag, email: session?.email, accountId: session?.account_id },
      });
      setData(res as Payload);
    } catch {
      setData({ found: false });
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }, [tag]);

  useEffect(() => { void load(); }, [load]);
  useRaffleRealtime(data?.event?.id, () => { void load(); });

  useEffect(() => {
    if (data?.event?.name) {
      document.title = `${data.event.name} | Sorteio ao Vivo`;
      const meta = document.querySelector('meta[name="description"]');
      if (meta && data.event.description) meta.setAttribute('content', data.event.description.slice(0, 155));
    }
  }, [data?.event?.name, data?.event?.description]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#0a0a0f]">
        <Loader2 className="h-8 w-8 animate-spin text-white/70" />
      </div>
    );
  }

  if (!data?.found || !data.event) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#0a0a0f] px-6 text-center text-white">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Sorteio indisponível</h1>
          <p className="text-white/60">Verifique o link e tente novamente.</p>
        </div>
      </div>
    );
  }

  const ev = data.event;
  const me = joined || (data.me ? { publicCode: data.me.publicCode, status: data.me.status } : null);
  const isOpen = ev.status === 'open';
  const isLive = ev.status === 'live';
  const count = data.approvedCount || 0;

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0f] text-white pb-16">
      <div className="mx-auto w-full max-w-xl px-4 pt-4 space-y-5">
        {/* Banner */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 min-h-[180px] sm:min-h-[240px]">
          {ev.bannerUrl ? (
            <img src={ev.bannerUrl} alt={ev.name} className="absolute inset-0 h-full w-full object-cover opacity-80" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-600/40 to-sky-700/20" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
          <div className="relative z-10 flex h-full min-h-[180px] sm:min-h-[240px] flex-col justify-end p-5">
            <span className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] backdrop-blur-md">
              {isLive && <Radio size={11} className="animate-pulse text-red-400" />}
              {RAFFLE_STATUS_LABEL[ev.status]}
            </span>
            <h1
              className="text-3xl sm:text-4xl font-bold leading-tight"
              style={{ fontFamily: 'var(--lobby-font-title, "Bebas Neue"), sans-serif', letterSpacing: '0.02em' }}
            >
              {ev.name}
            </h1>
            {ev.description && <p className="mt-1 text-sm text-white/70">{ev.description}</p>}
          </div>
        </div>

        {ev.prizeLabel && (
          <div className="rounded-3xl border border-white/10 bg-white/[0.05] px-5 py-4">
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/45">Prêmio</p>
            <p className="mt-1 text-xl font-bold">{ev.prizeLabel}</p>
            {ev.winnersCount > 1 && (
              <p className="text-[12px] text-white/50">{ev.winnersCount} ganhadores</p>
            )}
          </div>
        )}

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 space-y-4">
          <RaffleCountdown target={isOpen ? ev.closesAt : ev.drawAt} label={isOpen ? 'Inscrições encerram em' : 'Sorteio em'} />
          <RaffleProgress current={count} min={ev.minParticipants} max={ev.maxParticipants} />
        </div>

        {data.result ? (
          <RaffleResult result={data.result} highlightCode={me?.publicCode} />
        ) : me ? (
          <RaffleTicket
            code={me.publicCode}
            status={me.status}
            eventName={ev.name}
            drawAt={ev.drawAt}
            message={joined?.message}
          />
        ) : isOpen ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 space-y-4">
            <h2 className="text-lg font-bold">Participar agora</h2>
            <RaffleJoinForm
              tag={ev.tag}
              signupUrl={ev.signupUrl}
              onJoined={(r) => { setJoined(r); void load(); }}
            />
          </div>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-sm text-white/60">
            {ev.status === 'scheduled' || ev.status === 'draft'
              ? 'As inscrições ainda não começaram. Volte em breve.'
              : ev.status === 'cancelled'
                ? 'Este sorteio foi cancelado.'
                : 'As inscrições estão encerradas. Aguarde o sorteio ao vivo.'}
          </div>
        )}

        {ev.rules && (
          <details className="rounded-3xl border border-white/10 bg-white/[0.04] px-5 py-4">
            <summary className="cursor-pointer text-sm font-semibold">Regulamento</summary>
            <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-white/65">{ev.rules}</p>
          </details>
        )}

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 flex items-center gap-4">
          <div className="rounded-2xl bg-white p-2">
            <QRCodeSVG value={window.location.href} size={84} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm font-semibold"><Share2 size={15} /> Compartilhe</p>
            <p className="truncate text-[12px] text-white/45">{window.location.href}</p>
            <button
              type="button" onClick={copyLink}
              className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-[12px]"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copiado' : 'Copiar link'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sorteio;
