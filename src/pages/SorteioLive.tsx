import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Radio, Play, RotateCcw, Trophy, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useRaffleRealtime } from '@/hooks/useRaffleRealtime';
import type { RaffleEventPublic, RaffleResultPublic } from '@/lib/raffle';
import RaffleReel from '@/components/raffle/RaffleReel';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

type Phase = 'idle' | 'countdown' | 'rolling' | 'done';

const TITLE_FONT = { fontFamily: 'var(--lobby-font-title, "Bebas Neue"), sans-serif' };

/** Tela pensada para transmissão (OBS): 16:9. Controles só aparecem para o operador logado. */
const SorteioLive = ({ tag }: { tag: string }) => {
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<RaffleEventPublic | null>(null);
  const [count, setCount] = useState(0);
  const [participants, setParticipants] = useState<{ code: string; name: string }[]>([]);
  const [result, setResult] = useState<RaffleResultPublic | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [connectionError, setConnectionError] = useState(false);

  // Estado da encenação
  const [phase, setPhase] = useState<Phase>('idle');
  const [countdown, setCountdown] = useState(3);
  const loadingRequest = useRef(false);
  const playedRound = useRef(0);
  const initialResultLoaded = useRef(false);

  const load = useCallback(async () => {
    if (loadingRequest.current) return;
    loadingRequest.current = true;
    try {
      const { data, error } = await supabase.functions.invoke('get-raffle-event', { body: { tag } });
      if (error || !data) { setConnectionError(true); return; }
      setConnectionError(false);
      if (data.found === false) { setEvent(null); return; }
      setEvent(data.event);
      setCount(data.approvedCount || 0);
      setParticipants(data.participants || []);
      const nextResult = data.result || null;
      if (!initialResultLoaded.current) {
        initialResultLoaded.current = true;
        if (nextResult?.round) {
          playedRound.current = nextResult.round;
          setPhase('done');
        }
      }
      setResult(nextResult);
    } finally {
      loadingRequest.current = false;
      setLoading(false);
    }
  }, [tag]);

  useEffect(() => { void load(); }, [load]);
  useRaffleRealtime(event?.id, () => { void load(); });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUserId(s?.user?.id ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Poll leve: o resultado é gravado em raffle_draws (fora do realtime).
  useEffect(() => {
    const id = window.setInterval(() => { void load(); }, 5000);
    return () => window.clearInterval(id);
  }, [load]);

  // Uma rodada nova faz uma única encenação. Resultado já existente abre direto no estado final.
  const round = result?.round ?? 0;
  const winnersKey = (result?.winners || []).map((w) => w.code).join(',');

  useEffect(() => {
    if (!round || !winnersKey) return;
    if (playedRound.current === round) return;
    playedRound.current = round;
    let cancelled = false;
    const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

    const run = async () => {
      setPhase('countdown');
      for (let n = 3; n >= 1; n--) {
        if (cancelled) return;
        setCountdown(n);
        await sleep(800);
      }
      if (cancelled) return;
      setPhase('rolling');
      await sleep(2400);
      if (!cancelled) setPhase('done');
    };
    void run();
    return () => { cancelled = true; };
  }, [round, winnersKey]);

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
    } catch {
      toast({ title: 'Falha ao executar o sorteio', variant: 'destructive' });
    } finally {
      setDrawing(false);
    }
  }, [event, load]);

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

  const allWinners = result?.winners || [];
  const reelNames = participants.length ? participants.map((p) => p.name) : allWinners.map((w) => w.name);
  const totalWinners = allWinners.length;

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden bg-[#05050a] text-white">
      {/* fundo */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(circle at 50% 0%, rgba(120,80,255,0.18), transparent 60%)' }}
      />

      <div className="relative flex min-h-[100dvh] flex-col">
        <header className="flex items-center justify-between gap-4 px-6 py-5 sm:px-10">
          <div className="min-w-0">
            <h1 className="truncate text-3xl sm:text-4xl" style={{ ...TITLE_FONT, letterSpacing: '0.05em' }}>
              {event.name}
            </h1>
            {event.prizeLabel && (
              <p className="mt-1 text-[11px] uppercase tracking-[0.28em] text-white/45">
                Prêmio · {event.prizeLabel}
              </p>
            )}
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-red-500/40 bg-red-500/15 px-4 py-1.5 text-[11px] uppercase tracking-[0.28em]">
            <Radio size={13} className="animate-pulse text-red-400" /> Ao vivo
          </span>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-24 sm:px-10">
          <div className="w-full max-w-4xl">
              {phase === 'idle' && (
                <div className="border-y border-white/10 py-12 text-center">
                  <p className="text-[11px] uppercase tracking-[0.34em] text-white/40">Aguardando o sorteio</p>
                  <p className="mt-4 text-7xl tabular-nums" style={TITLE_FONT}>{count}</p>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-white/40">participantes concorrendo</p>
                </div>
              )}

              {phase === 'countdown' && (
                <div className="flex flex-col items-center justify-center py-12">
                  <p className="text-[11px] uppercase tracking-[0.34em] text-white/40">O sorteio começa em</p>
                  <p
                    key={countdown}
                    className="mt-2 animate-[cd_.9s_ease-out] text-8xl sm:text-9xl tabular-nums"
                    style={TITLE_FONT}
                  >
                    {countdown}
                  </p>
                  <style>{`@keyframes cd { 0% { transform: scale(1.6); opacity: 0 } 30% { transform: scale(1); opacity: 1 } 100% { opacity: .85 } }`}</style>
                </div>
              )}

              {phase === 'rolling' && (
                <div className="overflow-hidden border-y border-white/10 py-12 text-center">
                  <p className="text-[11px] uppercase tracking-[0.34em] text-white/45">Sorteando agora</p>
                  <div className="mt-6 text-5xl sm:text-7xl" style={TITLE_FONT}>
                    <RaffleReel names={reelNames} active />
                  </div>
                </div>
              )}

              {phase === 'done' && (
                <div className="text-center">
                  <div className="mb-7 flex items-center justify-center gap-3 text-amber-200">
                    <Trophy size={20} />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.32em]">Resultado do sorteio</p>
                  </div>
                  <div className={`grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 ${totalWinners > 1 ? 'sm:grid-cols-2' : ''}`}>
                    {allWinners.map((winner) => (
                      <div key={winner.code} className="flex min-h-32 items-center gap-5 bg-[#08080d] px-6 py-5 text-left sm:px-8">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-amber-300/40 text-sm font-bold text-amber-200">
                          {winner.position}º
                        </span>
                        <div className="min-w-0">
                          <p className="break-words text-3xl text-amber-100 sm:text-4xl" style={TITLE_FONT}>{winner.name}</p>
                          <p className="mt-1 font-mono text-xs tracking-[0.16em] text-white/45">{winner.code}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>

          {/* Contador discreto de participantes */}
          <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.26em] text-white/35">
            <Users size={13} /> {result?.totalValid ?? count} participantes válidos
          </p>
        </main>
      </div>


      {/* Controles do operador — invisíveis para o público quando ocultos */}
      {userId && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          {showControls ? (
            <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/80 px-3 py-2 backdrop-blur">
              <Button
                onClick={() => void runDraw(!!result)}
                disabled={drawing || (phase !== 'idle' && phase !== 'done')}
                className="rounded-full bg-white px-5 text-black hover:bg-white/90"
              >
                {drawing ? <Loader2 size={15} className="animate-spin" /> : result ? <RotateCcw size={15} /> : <Play size={15} />}
                {result ? 'Refazer sorteio' : 'Sortear agora'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowControls(false)}
                className="rounded-full px-3 text-xs uppercase text-white/50 hover:bg-white/10 hover:text-white"
              >
                Ocultar
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              onClick={() => setShowControls(true)}
              className="h-3 w-16 rounded-full bg-white/10 p-0 hover:bg-white/25"
              aria-label="Mostrar controles"
            />
          )}
        </div>
      )}
    </div>
  );
};

export default SorteioLive;
