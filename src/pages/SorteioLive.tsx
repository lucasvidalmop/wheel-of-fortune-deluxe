import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Radio, Play, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useRaffleRealtime } from '@/hooks/useRaffleRealtime';
import type { RaffleEventPublic, RaffleResultPublic } from '@/lib/raffle';
import RaffleRollAnimation from '@/components/raffle/RaffleRollAnimation';
import { toast } from '@/hooks/use-toast';

/** Tela pensada para transmissão (OBS): 16:9. Controles só aparecem para o operador logado. */
const SorteioLive = ({ tag }: { tag: string }) => {
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<RaffleEventPublic | null>(null);
  const [count, setCount] = useState(0);
  const [participants, setParticipants] = useState<{ code: string; name: string }[]>([]);
  const [result, setResult] = useState<RaffleResultPublic | null>(null);
  const [rolling, setRolling] = useState(false);
  const [revealed, setRevealed] = useState<number>(-1);
  const [userId, setUserId] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  const lastRound = useRef<number>(0);
  const loadingRequest = useRef(false);


  const load = useCallback(async () => {
    if (loadingRequest.current) return;
    loadingRequest.current = true;
    try {
      const { data, error } = await supabase.functions.invoke('get-raffle-event', { body: { tag } });
      if (error || !data) {
        setConnectionError(true);
        return;
      }
      setConnectionError(false);
      if (data.found === false) { setEvent(null); return; }
      setEvent(data.event);
      setCount(data.approvedCount || 0);
      setParticipants(data.participants || []);
      setResult(data.result || null);
    } finally {
      loadingRequest.current = false;
      setLoading(false);
    }
  }, [tag]);

  useEffect(() => { void load(); }, [load]);
  useRaffleRealtime(event?.id, () => { void load(); });

  // Sessão do operador (controles ficam ocultos para o público).
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUserId(s?.user?.id ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const runDraw = useCallback(async (redraw: boolean) => {
    if (!event) return;
    let redrawReason = '';
    if (redraw) {
      redrawReason = window.prompt('Justificativa para refazer o sorteio:')?.trim() || '';
      if (!redrawReason) return;
    }
    setDrawing(true);
    try {
      const { data, error } = await supabase.functions.invoke('run-raffle-draw', {
        body: { eventId: event.id, redrawReason },
      });
      if (error) {
        let msg = '';
        try { msg = (await (error as any).context?.json())?.error || ''; } catch { /* ignore */ }
        toast({ title: 'Não foi possível sortear', description: msg || 'Tente novamente.', variant: 'destructive' });
        return;
      }
      if (data?.error) {
        toast({ title: 'Não foi possível sortear', description: data.error, variant: 'destructive' });
        return;
      }
      await load();
    } catch (err) {
      toast({ title: 'Falha ao executar o sorteio', variant: 'destructive' });
    } finally {
      setDrawing(false);
    }
  }, [event, load]);



  // Poll leve: o resultado é gravado em raffle_draws (fora do realtime).
  useEffect(() => {
    const id = window.setInterval(() => { void load(); }, 5000);
    return () => window.clearInterval(id);
  }, [load]);

  // Ao detectar um novo resultado, roda a animação e revela um a um.
  const resultRound = result?.round ?? 0;
  const winnersCount = result?.winners.length ?? 0;
  useEffect(() => {
    if (!resultRound || !winnersCount) return;
    lastRound.current = resultRound;
    setRevealed(-1);
    setRolling(true);
    const timers: number[] = [];
    for (let i = 0; i < winnersCount; i++) {
      timers.push(window.setTimeout(() => {
        setRevealed(i);
        if (i === winnersCount - 1) setRolling(false);
      }, 4000 + i * 3500));
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [resultRound, winnersCount]);


  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-black">
        <Loader2 className="h-10 w-10 animate-spin text-white/60" />
      </div>
    );
  }
  if (!event && connectionError) {
    return (
      <div className="min-h-[100dvh] flex flex-col gap-3 items-center justify-center bg-black text-white/70">
        <Loader2 className="h-7 w-7 animate-spin text-white/50" />
        Reconectando ao sorteio...
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

      <main className="flex-1 flex items-center justify-center px-4 sm:px-8">
        <div className="w-full max-w-5xl space-y-8">
          <RaffleRollAnimation
            names={rollNames.length ? rollNames : participants.map((p) => p.name)}
            rolling={rolling}
            winner={
              currentWinner
                ? { name: currentWinner.name, code: currentWinner.code, position: currentWinner.position }
                : null
            }
            prizeLabel={event.prizeLabel}
          />
          {!result && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <p className="mb-3 text-[10px] uppercase tracking-[0.28em] text-white/40">
                Participantes confirmados ({count})
              </p>
              {participants.length === 0 ? (
                <p className="text-sm text-white/45">Nenhum participante confirmado ainda.</p>
              ) : (
                <div className="grid max-h-[46vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                  {participants.map((p) => (
                    <div key={p.code} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2">
                      <p className="truncate text-sm font-semibold">{p.name}</p>
                      <p className="text-[11px] tracking-[0.14em] text-white/40">{p.code}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {result && revealed >= 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {result.winners.slice(0, revealed + 1).map((w) => {
                const active = currentWinner?.code === w.code;
                return (
                  <div
                    key={w.code}
                    className={`flex items-center gap-4 rounded-2xl border px-5 py-4 transition-all ${
                      active
                        ? 'border-amber-300/50 bg-amber-400/10'
                        : 'border-white/10 bg-white/[0.04]'
                    }`}
                  >
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-bold ${
                        w.position === 1
                          ? 'bg-amber-400 text-black'
                          : w.position === 2
                            ? 'bg-white/80 text-black'
                            : 'bg-white/15 text-white'
                      }`}
                    >
                      {w.position}º
                    </span>
                    <div className="min-w-0 text-left">
                      <p className="truncate text-lg font-semibold leading-tight">{w.name}</p>
                      <p className="font-mono text-xs tracking-[0.16em] text-white/50">{w.code}</p>
                    </div>
                  </div>
                );
              })}
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
      </footer>

      {/* Controles do operador — invisíveis para o público e para a captura de tela quando ocultos */}
      {userId && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          {showControls ? (
            <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/80 px-3 py-2 backdrop-blur">
              <button
                onClick={() => void runDraw(!!result)}
                disabled={drawing || rolling}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black disabled:opacity-50"
              >
                {drawing ? <Loader2 size={15} className="animate-spin" /> : result ? <RotateCcw size={15} /> : <Play size={15} />}
                {result ? 'Refazer sorteio' : 'Sortear agora'}
              </button>
              <button
                onClick={() => setShowControls(false)}
                className="rounded-full px-3 py-2 text-xs uppercase tracking-widest text-white/50 hover:text-white"
              >
                Ocultar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowControls(true)}
              className="h-3 w-16 rounded-full bg-white/10 hover:bg-white/25"
              aria-label="Mostrar controles"
            />
          )}
        </div>
      )}
    </div>

  );
};

export default SorteioLive;
