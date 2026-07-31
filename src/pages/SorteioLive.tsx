import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Radio, Play, RotateCcw, Trophy, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useRaffleRealtime } from '@/hooks/useRaffleRealtime';
import type { RaffleEventPublic, RaffleResultPublic, RaffleWinner } from '@/lib/raffle';
import RaffleReel from '@/components/raffle/RaffleReel';
import { toast } from '@/hooks/use-toast';

type Phase = 'idle' | 'countdown' | 'rolling' | 'reveal' | 'done';

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
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [announced, setAnnounced] = useState<RaffleWinner[]>([]);
  const loadingRequest = useRef(false);

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
      setResult(data.result || null);
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

  // Encenação do sorteio: contagem regressiva -> rolo -> revelação, um vencedor por vez.
  const round = result?.round ?? 0;
  const winnersKey = (result?.winners || []).map((w) => w.code).join(',');
  const winnersRef = useRef<RaffleWinner[]>([]);
  winnersRef.current = result?.winners || [];

  const playedRound = useRef(0);

  useEffect(() => {
    if (!round || !winnersKey) return;
    if (playedRound.current === round) return; // nunca repete a encenação do mesmo sorteio
    playedRound.current = round;
    let cancelled = false;
    const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

    const run = async () => {
      const winners = winnersRef.current;
      setAnnounced([]);
      setCurrentIndex(-1);
      setPhase('countdown');
      for (let n = 3; n >= 1; n--) {
        if (cancelled) return;
        setCountdown(n);
        await sleep(900);
      }
      for (let i = 0; i < winners.length; i++) {
        if (cancelled) return;
        setCurrentIndex(i);
        setPhase('rolling');
        await sleep(3200);
        if (cancelled) return;
        setPhase('reveal');
        setAnnounced(winners.slice(0, i + 1));
        await sleep(i === winners.length - 1 ? 1200 : 3000);
      }
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
  const currentWinner = phase === 'reveal' && currentIndex >= 0 ? allWinners[currentIndex] : null;
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

        <main className="grid flex-1 gap-6 px-6 pb-28 sm:px-10 lg:grid-cols-[1.6fr_1fr]">
          {/* PALCO */}
          <section className="flex min-h-[46vh] items-center justify-center">
            <div className="w-full">
              {phase === 'idle' && (
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
                  <p className="text-[11px] uppercase tracking-[0.34em] text-white/40">Aguardando o sorteio</p>
                  <p className="mt-4 text-6xl sm:text-7xl tabular-nums" style={TITLE_FONT}>{count}</p>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-white/40">participantes confirmados</p>
                </div>
              )}

              {phase === 'countdown' && (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/[0.03] p-10">
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
                <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
                  <p className="text-[11px] uppercase tracking-[0.34em] text-white/45">
                    Sorteando {currentIndex + 1}º de {totalWinners}
                  </p>
                  <div className="mt-5 text-4xl sm:text-6xl" style={TITLE_FONT}>
                    <RaffleReel names={reelNames} active />
                  </div>
                  <div className="mx-auto mt-6 h-1 w-full max-w-md overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-full origin-left animate-[bar_3.2s_linear_forwards] bg-white/70" />
                  </div>
                  <style>{`@keyframes bar { from { transform: scaleX(0) } to { transform: scaleX(1) } }`}</style>
                </div>
              )}

              {(phase === 'reveal' || phase === 'done') && (
                <div className="rounded-3xl border border-amber-300/40 bg-gradient-to-b from-amber-500/10 via-black/50 to-black/70 p-8 text-center shadow-[0_0_90px_-30px_rgba(251,191,36,0.6)]">
                  {currentWinner ? (
                    <div className="animate-[pop_.5s_ease-out]">
                      <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/50 bg-amber-400/15 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.32em] text-amber-200">
                        <Trophy size={12} />
                        {currentWinner.position}º lugar
                      </span>
                      <p
                        className="mt-4 break-words bg-gradient-to-b from-white to-amber-200 bg-clip-text text-5xl text-transparent sm:text-7xl"
                        style={TITLE_FONT}
                      >
                        {currentWinner.name}
                      </p>
                      <p className="mt-3 font-mono text-lg tracking-[0.2em] text-white/70 sm:text-xl">
                        {currentWinner.code}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.32em] text-amber-200/80">Sorteio concluído</p>
                      <p className="mt-3 text-4xl sm:text-5xl" style={TITLE_FONT}>
                        {totalWinners} {totalWinners === 1 ? 'vencedor' : 'vencedores'}
                      </p>
                      <p className="mt-2 text-sm text-white/50">Confira a lista completa ao lado.</p>
                    </div>
                  )}
                  <style>{`@keyframes pop { 0% { transform: scale(.86); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }`}</style>
                </div>
              )}
            </div>
          </section>

          {/* PAINEL LATERAL: sempre mostra a lista completa */}
          <aside className="flex flex-col gap-4">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
              <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.26em] text-white/45">
                <Users size={14} /> Participantes
              </span>
              <span className="text-2xl font-bold tabular-nums">{result?.totalValid ?? count}</span>
            </div>

            <div className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="mb-3 text-[11px] uppercase tracking-[0.28em] text-white/45">
                {allWinners.length ? 'Vencedores' : 'Confirmados'}
              </p>

              {allWinners.length > 0 ? (
                <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
                  {allWinners.map((w, i) => {
                    const revealed = announced.length > i;
                    return (
                      <div
                        key={w.code}
                        className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
                          revealed ? 'border-white/15 bg-white/[0.06]' : 'border-white/5 bg-white/[0.02]'
                        } ${currentIndex === i && phase === 'reveal' ? 'border-amber-300/60 bg-amber-400/10' : ''}`}
                      >
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                            !revealed
                              ? 'bg-white/10 text-white/40'
                              : w.position === 1
                                ? 'bg-amber-400 text-black'
                                : w.position === 2
                                  ? 'bg-white/85 text-black'
                                  : 'bg-white/20 text-white'
                          }`}
                        >
                          {w.position}º
                        </span>
                        <div className="min-w-0">
                          <p className={`truncate font-semibold ${revealed ? '' : 'blur-sm select-none'}`}>
                            {revealed ? w.name : '••••••'}
                          </p>
                          <p className="font-mono text-[11px] tracking-[0.14em] text-white/45">
                            {revealed ? w.code : '••••••'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : participants.length === 0 ? (
                <p className="text-sm text-white/45">Nenhum participante confirmado ainda.</p>
              ) : (
                <div className="max-h-[52vh] space-y-1.5 overflow-y-auto pr-1">
                  {participants.map((p) => (
                    <div key={p.code} className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2">
                      <span className="truncate text-sm">{p.name}</span>
                      <span className="ml-3 shrink-0 font-mono text-[11px] text-white/40">{p.code}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </main>
      </div>

      {/* Controles do operador — invisíveis para o público quando ocultos */}
      {userId && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          {showControls ? (
            <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/80 px-3 py-2 backdrop-blur">
              <button
                onClick={() => void runDraw(!!result)}
                disabled={drawing || (phase !== 'idle' && phase !== 'done')}
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
