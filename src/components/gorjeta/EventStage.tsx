import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import Plinko from './games/Plinko';
import { normalizePlinko, plinkoRows, chancePercents } from './plinkoConfig';

interface Props {
  event: { id: string; name: string; tag: string; theme?: Record<string, string>; page_config?: Record<string, any> };
  onClose: () => void;
}

interface Participant {
  id: string;
  user_name: string;
  account_id: string;
  entry_number: number;
  has_won: boolean;
}

interface ResultRow {
  id: string;
  user_name: string;
  account_id: string;
  prize_label: string;
  is_winner: boolean;
  created_at: string;
}

const EventStage = ({ event, onClose }: Props) => {
  const accent = event.theme?.accent || '#22c55e';
  const cfg = useMemo(() => normalizePlinko((event.page_config || {}).plinko), [event.page_config]);
  const multipliers = useMemo(() => cfg.slots.map((s) => s.multiplier), [cfg]);
  const rows = useMemo(() => plinkoRows(cfg.slots), [cfg]);
  const percents = useMemo(() => chancePercents(cfg.slots), [cfg]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [baseAmount, setBaseAmount] = useState(cfg.base_amount);
  const [prizeType, setPrizeType] = useState<'pix' | 'spins' | 'coins'>(cfg.prize_type);
  const [phase, setPhase] = useState<'idle' | 'drawing' | 'drawn' | 'playing'>('idle');
  const [rollingName, setRollingName] = useState('');
  const [path, setPath] = useState<number[] | null>(null);
  const [current, setCurrent] = useState<{ id: string; name: string; account_id: string; entry_number: number } | null>(null);
  const [reveal, setReveal] = useState<{ label: string; win: boolean } | null>(null);

  const load = useCallback(async () => {
    const [p, r] = await Promise.all([
      (supabase as any).from('gorjeta_event_participants')
        .select('id, user_name, account_id, entry_number, has_won')
        .eq('event_id', event.id).order('entry_number', { ascending: true }),
      (supabase as any).from('gorjeta_event_results')
        .select('id, user_name, account_id, prize_label, is_winner, created_at')
        .eq('event_id', event.id).order('created_at', { ascending: false }).limit(50),
    ]);
    setParticipants(p.data || []);
    setResults(r.data || []);
  }, [event.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`stage_${event.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gorjeta_event_participants', filter: `event_id=eq.${event.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [event.id, load]);

  const available = useMemo(() => participants.filter((p) => !p.has_won), [participants]);

  /** Etapa 1 — sorteio do participante com animação de nomes. */
  const drawParticipant = () => {
    if (phase !== 'idle' && phase !== 'drawn') return;
    if (available.length === 0) { toast.error('Nenhum participante disponível.'); return; }
    setPhase('drawing');
    setReveal(null);
    setPath(null);
    setCurrent(null);

    const winner = available[Math.floor(Math.random() * available.length)];
    const startedAt = performance.now();
    const DURATION = 2600;

    const tick = () => {
      const t = (performance.now() - startedAt) / DURATION;
      if (t >= 1) {
        setRollingName(winner.user_name);
        setCurrent({ id: winner.id, name: winner.user_name, account_id: winner.account_id, entry_number: winner.entry_number });
        setPhase('drawn');
        return;
      }
      // vai desacelerando
      const delay = 40 + Math.pow(t, 3) * 260;
      setRollingName(available[Math.floor(Math.random() * available.length)].user_name);
      setTimeout(tick, delay);
    };
    tick();
  };

  /** Etapa 2 — o participante sorteado joga o plinko. */
  const play = async () => {
    if (phase !== 'drawn' || !current) return;
    setPhase('playing');
    setReveal(null);
    setPath(null);

    const { data, error } = await supabase.functions.invoke('play-event-round', {
      body: {
        event_id: event.id,
        participant_id: current.id,
        game: 'plinko',
        prize_type: prizeType,
        base_amount: baseAmount,
        game_config: {
          rows,
          multipliers,
          weights: cfg.use_chances ? cfg.slots.map((s) => s.chance) : null,
        },
      },
    });

    const err = (data as any)?.error || (error ? 'Falha ao rodar a jogada.' : '');
    if (err) { toast.error(err); setPhase('drawn'); return; }

    setPath((data as any).outcome.path);
    const label = (data as any).prize_label;
    const win = (data as any).is_winner;
    setTimeout(() => {
      setReveal({ label, win });
      setPhase('idle');
      load();
    }, rows * 190 + 900);
  };


  return (
    <div className="fixed inset-0 z-50 bg-[#05070a] text-white overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-5">
        <header className="flex items-center justify-between gap-4 mb-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-white/45">
              <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: accent }} />
              Palco ao vivo
            </div>
            <h1 className="text-xl sm:text-2xl font-black truncate">{event.name}</h1>
          </div>
          <button onClick={onClose} className="h-9 px-4 rounded-lg border border-white/15 text-xs font-semibold text-white/70 shrink-0">
            Sair do palco
          </button>
        </header>

        <div className="grid lg:grid-cols-[1fr_320px] gap-5">
          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-white/40">Inscritos</div>
                  <div className="text-2xl font-black" style={{ color: accent }}>{participants.length}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-white/40">Disponíveis</div>
                  <div className="text-2xl font-black">{available.length}</div>
                </div>
              </div>
              <div className="text-right min-h-[46px]">
                {current && (
                  <>
                    <div className="text-[10px] uppercase tracking-widest text-white/40">Jogando por</div>
                    <div className="text-lg font-bold">{current.name}</div>
                    <div className="text-[11px] text-white/40">#{String(current.entry_number).padStart(4, '0')} · {current.account_id}</div>
                  </>
                )}
              </div>
            </div>

            {/* Etapa 1 — sorteio do participante */}
            <div
              className="rounded-2xl border p-5 mb-4 text-center transition-colors"
              style={{
                borderColor: phase === 'drawing' ? `${accent}66` : 'rgba(255,255,255,0.08)',
                background: phase === 'drawing' ? `${accent}0f` : 'rgba(255,255,255,0.02)',
              }}
            >
              <div className="text-[10px] uppercase tracking-[0.28em] text-white/40 mb-1">
                {phase === 'drawing' ? 'Sorteando participante...' : phase === 'idle' ? 'Etapa 1 · Sorteio' : 'Participante sorteado'}
              </div>
              <div
                className={`text-2xl sm:text-3xl font-black truncate ${phase === 'drawing' ? 'blur-[0.4px] opacity-80' : ''}`}
                style={{ color: phase === 'idle' && !current ? 'rgba(255,255,255,0.25)' : accent }}
              >
                {phase === 'drawing' ? rollingName || '—' : current?.name || 'Aguardando sorteio'}
              </div>
              {current && phase !== 'drawing' && (
                <div className="text-[11px] text-white/40 mt-1">
                  #{String(current.entry_number).padStart(4, '0')} · {current.account_id}
                </div>
              )}
            </div>

            <div className={`rounded-2xl bg-black/40 border border-white/5 p-2 sm:p-4 transition-opacity ${phase === 'idle' && !path ? 'opacity-40' : 'opacity-100'}`}>
              <Plinko rows={rows} multipliers={multipliers} path={path} accent={accent} />
              {cfg.use_chances && (
                <div className="mt-2 flex flex-wrap justify-center gap-1.5 px-1">
                  {cfg.slots.map((s, i) => (
                    <span key={i} className="rounded-md bg-white/[0.04] border border-white/10 px-1.5 py-0.5 text-[10px] text-white/45 tabular-nums">
                      {s.multiplier}x · {percents[i].toFixed(1)}%
                    </span>
                  ))}
                </div>
              )}
            </div>


            {reveal && (
              <div
                className="mt-4 rounded-2xl border p-5 text-center"
                style={{
                  borderColor: reveal.win ? `${accent}66` : 'rgba(255,255,255,0.12)',
                  background: reveal.win ? `${accent}12` : 'rgba(255,255,255,0.02)',
                }}
              >
                <div className="text-3xl mb-1">{reveal.win ? '🎉' : '😬'}</div>
                <div className="text-xl font-black" style={{ color: reveal.win ? accent : 'rgba(255,255,255,0.6)' }}>
                  {reveal.win ? `${current?.name} ganhou ${reveal.label}!` : 'Não foi dessa vez'}
                </div>
              </div>
            )}

            <div className="mt-5 grid sm:grid-cols-[130px_150px_1fr] gap-3">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1.5">Valor base</label>
                <input
                  type="number"
                  value={baseAmount}
                  onChange={(e) => setBaseAmount(Number(e.target.value))}
                  className="w-full h-12 rounded-xl bg-white/[0.04] border border-white/10 px-3.5 text-white text-sm outline-none focus:border-white/25"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1.5">Prêmio</label>
                <select
                  value={prizeType}
                  onChange={(e) => setPrizeType(e.target.value as any)}
                  className="w-full h-12 rounded-xl bg-white/[0.04] border border-white/10 px-3.5 text-white text-sm outline-none focus:border-white/25"
                >
                  <option value="pix" className="bg-neutral-900">PIX</option>
                  <option value="spins" className="bg-neutral-900">Giros na roleta</option>
                  <option value="coins" className="bg-neutral-900">Coins</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={play}
                  disabled={playing || available.length === 0}
                  className="w-full h-12 rounded-xl font-black text-sm uppercase tracking-wider transition-transform active:scale-[0.98] disabled:opacity-50"
                  style={{ background: accent, color: '#04150a' }}
                >
                  {playing ? 'Soltando a bolinha...' : 'Sortear e jogar'}
                </button>
              </div>
            </div>
          </section>

          <aside className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <h2 className="text-[11px] uppercase tracking-[0.28em] text-white/40 mb-3">Rodadas</h2>
            {results.length === 0 ? (
              <p className="text-white/35 text-sm">Nenhuma rodada ainda.</p>
            ) : (
              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {results.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{r.user_name}</div>
                      <div className="text-[11px] text-white/35">{r.account_id}</div>
                    </div>
                    <div className="text-xs font-bold shrink-0" style={{ color: r.is_winner ? accent : 'rgba(255,255,255,0.35)' }}>
                      {r.prize_label}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
};

export default EventStage;
