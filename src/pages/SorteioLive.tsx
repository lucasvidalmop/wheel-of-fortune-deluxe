import { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2, Radio } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useRaffleRealtime } from '@/hooks/useRaffleRealtime';
import type { RaffleEventPublic, RaffleResultPublic } from '@/lib/raffle';
import RaffleRollAnimation from '@/components/raffle/RaffleRollAnimation';

/** Tela pensada para transmissão (OBS): 16:9, sem PII, apenas leitura. */
const SorteioLive = ({ tag }: { tag: string }) => {
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<RaffleEventPublic | null>(null);
  const [count, setCount] = useState(0);
  const [result, setResult] = useState<RaffleResultPublic | null>(null);
  const [rolling, setRolling] = useState(false);
  const [revealed, setRevealed] = useState<number>(-1);
  const lastRound = useRef<number>(0);

  const load = useCallback(async () => {
    try {
      const { data } = await supabase.functions.invoke('get-raffle-event', { body: { tag } });
      if (!data?.found) { setEvent(null); return; }
      setEvent(data.event);
      setCount(data.approvedCount || 0);
      setResult(data.result || null);
    } finally {
      setLoading(false);
    }
  }, [tag]);

  useEffect(() => { void load(); }, [load]);
  useRaffleRealtime(event?.id, () => { void load(); });

  // Poll leve: o resultado é gravado em raffle_draws (fora do realtime).
  useEffect(() => {
    const id = window.setInterval(() => { void load(); }, 5000);
    return () => window.clearInterval(id);
  }, [load]);

  // Ao detectar um novo resultado, roda a animação e revela um a um.
  useEffect(() => {
    if (!result || result.round === lastRound.current) return;
    lastRound.current = result.round;
    setRevealed(-1);
    setRolling(true);
    const timers: number[] = [];
    result.winners.forEach((_, i) => {
      timers.push(window.setTimeout(() => {
        setRevealed(i);
        if (i === result.winners.length - 1) setRolling(false);
      }, 4000 + i * 3500));
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [result]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-black">
        <Loader2 className="h-10 w-10 animate-spin text-white/60" />
      </div>
    );
  }
  if (!event) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-black text-white/70">
        Sorteio indisponível
      </div>
    );
  }

  const rollNames = (result?.winners || []).map((w) => w.name);
  const currentWinner = revealed >= 0 ? result?.winners[revealed] : null;

  return (
    <div className="min-h-[100dvh] w-full bg-black text-white flex flex-col">
      <header className="flex items-center justify-between px-8 py-6">
        <h1
          className="text-3xl sm:text-5xl font-bold"
          style={{ fontFamily: 'var(--lobby-font-title, "Bebas Neue"), sans-serif', letterSpacing: '0.05em' }}
        >
          {event.name}
        </h1>
        <span className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/15 px-4 py-1.5 text-xs uppercase tracking-[0.28em]">
          <Radio size={13} className="animate-pulse text-red-400" /> Ao vivo
        </span>
      </header>

      <main className="flex-1 flex items-center justify-center px-8">
        <div className="w-full max-w-4xl space-y-6">
          <RaffleRollAnimation
            names={rollNames.length ? rollNames : ['...']}
            rolling={rolling}
            winner={currentWinner ? { name: currentWinner.name, code: currentWinner.code } : null}
          />
          {result && revealed >= 0 && result.winners.length > 1 && (
            <div className="flex flex-wrap justify-center gap-3">
              {result.winners.slice(0, revealed + 1).map((w) => (
                <span key={w.code} className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm">
                  {w.position}º {w.name} · {w.code}
                </span>
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="flex items-center justify-between px-8 py-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-white/40">Participantes válidos</p>
          <p className="text-3xl font-bold tabular-nums">{result?.totalValid ?? count}</p>
        </div>
        {event.prizeLabel && (
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/40">Prêmio</p>
            <p className="text-xl font-semibold">{event.prizeLabel}</p>
          </div>
        )}
        <div className="rounded-xl bg-white p-2">
          <QRCodeSVG value={`${window.location.origin}/sorteio=${event.tag}`} size={72} />
        </div>
      </footer>
    </div>
  );
};

export default SorteioLive;
