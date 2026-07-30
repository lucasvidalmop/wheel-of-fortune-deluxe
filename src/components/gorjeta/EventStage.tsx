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
  const [playing, setPlaying] = useState(false);
  const [path, setPath] = useState<number[] | null>(null);
  const [current, setCurrent] = useState<{ name: string; account_id: string; entry_number: number } | null>(null);
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

  const play = async () => {
    if (playing) return;
    if (available.length === 0) { toast.error('Nenhum participante disponível.'); return; }
    setPlaying(true);
    setReveal(null);
    setPath(null);

    const { data, error } = await supabase.functions.invoke('play-event-round', {
      body: {
        event_id: event.id,
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
    if (err) { toast.error(err); setPlaying(false); return; }

    setCurrent((data as any).participant);
    setPath((data as any).outcome.path);
    const label = (data as any).prize_label;
    const win = (data as any).is_winner;
    setTimeout(() => {
      setReveal({ label, win });
      setPlaying(false);
      load();
    }, rows * 150 + 400);
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

            <div className="rounded-2xl bg-black/40 border border-white/5 p-2 sm:p-4">
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
