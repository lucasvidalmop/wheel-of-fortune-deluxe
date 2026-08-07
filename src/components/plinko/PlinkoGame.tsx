import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X, Dices, Play } from 'lucide-react';
import PlinkoBoard, { PlinkoBall, PlinkoLanding } from './PlinkoBoard';


export interface PlinkoPick {
  id: string;
  name: string;
  account_id: string;
  isGhost: boolean;
  raw?: any;
}

export interface PlinkoRound {
  name: string;
  account_id: string;
  multiplier: number;
  amount: number;
  isGhost: boolean;
}

interface RosterEntry {
  id: string;
  name: string;
  status: 'falling' | 'landed';
  multiplier?: number;
  amount?: number;
}

interface PlinkoGameProps {
  open: boolean;
  onClose: () => void;
  accent: string;
  btnText: string;
  textColor: string;
  cardStyle: React.CSSProperties;
  names: string[];
  participantCount: number;
  pickParticipant: () => PlinkoPick | null;
  onWin: (pick: PlinkoPick, amount: number, multiplier: number) => void;
  /** Configured in the admin panel (Influencer > Mini Game Plinko) */
  rows?: number;
  multipliers?: number[];
  chances?: number[];
  basePrize?: number;
  ballCount?: number;
}

// A real Galton board always has slots = rows + 1.
const DEFAULT_ROWS = 12;

/** Symmetric multiplier curve, low at the center, high at the edges. */
const defaultMultipliers = (slots: number): number[] => {
  const center = (slots - 1) / 2;
  return Array.from({ length: slots }, (_, i) => {
    const dist = Math.abs(i - center);
    const raw = 0.4 * Math.pow(1.55, dist);
    return Math.round(raw * 10) / 10;
  });
};

/** Natural binomial odds for a board with this many peg rows — matches how a
 *  physical ball actually distributes itself, so it doubles as a sane default. */
const defaultChances = (rows: number): number[] => {
  let row = [1];
  for (let r = 1; r <= rows; r++) {
    const next = [1];
    for (let i = 1; i < r; i++) next.push(row[i - 1] + row[i]);
    next.push(1);
    row = next;
  }
  const total = row.reduce((s, n) => s + n, 0);
  return row.map(n => Math.round((n / total) * 1000) / 10);
};

const formatCurrency = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

/** Weighted pick of a slot index using the configured percentages */
const pickSlot = (weights: number[]) => {
  const total = weights.reduce((s, n) => s + Math.max(0, n), 0);
  if (total <= 0) return Math.floor(Math.random() * weights.length);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= Math.max(0, weights[i]);
    if (r <= 0) return i;
  }
  return weights.length - 1;
};

const PlinkoGame = ({
  open, onClose, accent, btnText, textColor, cardStyle,
  names, participantCount, pickParticipant, onWin,
  rows: rowsProp, multipliers: multipliersProp, chances: chancesProp,
  basePrize: basePrizeProp, ballCount: ballCountProp,
}: PlinkoGameProps) => {
  const rows = Math.min(16, Math.max(8, rowsProp || DEFAULT_ROWS));
  const slots = rows + 1;
  const multipliers = multipliersProp?.length === slots ? multipliersProp : defaultMultipliers(slots);
  const fallbackChances = defaultChances(rows);
  const chances = multipliers.map((_, i) => Number(chancesProp?.[i] ?? fallbackChances[i] ?? 0));
  const basePrize = typeof basePrizeProp === 'number' && basePrizeProp >= 0 ? basePrizeProp : 10;
  const ballCount = Math.min(20, Math.max(1, ballCountProp || 1));

  const [phase, setPhase] = useState<'idle' | 'picking' | 'dropping' | 'result'>('idle');
  const [reelName, setReelName] = useState('');
  const [activeBalls, setActiveBalls] = useState<PlinkoBall[]>([]);
  const [rounds, setRounds] = useState<PlinkoRound[]>([]);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [dropToken, setDropToken] = useState(0);
  const picksRef = useRef<Map<string, PlinkoPick>>(new Map());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const reelRef = useRef<ReturnType<typeof setInterval> | null>(null);


  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (reelRef.current) { clearInterval(reelRef.current); reelRef.current = null; }
  };

  useEffect(() => () => clearTimers(), []);

  useEffect(() => {
    if (!open) {
      clearTimers();
      setPhase('idle');
      setActiveBalls([]);
      setRounds([]);
      setRoster([]);
      setDropToken(0);
      picksRef.current = new Map();
    }
  }, [open]);

  const startRound = () => {
    if (phase === 'picking' || phase === 'dropping') return;

    const wanted = Math.min(ballCount, Math.max(1, participantCount));
    const picks: PlinkoPick[] = [];
    for (let i = 0; i < wanted; i++) {
      const p = pickParticipant();
      if (!p) break;
      picks.push(p);
    }
    if (picks.length === 0) return;

    picksRef.current = new Map();
    const newBalls: PlinkoBall[] = picks.map((p, i) => {
      const id = `${Date.now()}-${i}`;
      picksRef.current.set(id, p);
      return { id, label: p.name, targetSlot: pickSlot(chances) };
    });

    setActiveBalls(newBalls);
    setRoster(newBalls.map(b => ({ id: b.id, name: b.label, status: 'falling' })));
    setPhase('picking');

    const pool = names.length > 0 ? names : picks.map(p => p.name);
    reelRef.current = setInterval(() => {
      setReelName(pool[Math.floor(Math.random() * pool.length)]);
    }, 70);

    timers.current.push(setTimeout(() => {
      if (reelRef.current) { clearInterval(reelRef.current); reelRef.current = null; }
      setReelName(picks.map(p => p.name).join(' · '));
      setPhase('dropping');
      setDropToken(t => t + 1);
    }, 1800));
  };

  const handleLanded = (landing: PlinkoLanding) => {
    const pick = picksRef.current.get(landing.id);
    if (!pick) return;
    const amount = Math.round(basePrize * landing.multiplier * 100) / 100;
    const round: PlinkoRound = {
      name: pick.name,
      account_id: pick.account_id,
      multiplier: landing.multiplier,
      amount,
      isGhost: pick.isGhost,
    };
    setRounds(prev => [round, ...prev]);
    setRoster(prev => prev.map(entry => entry.id === landing.id
      ? { ...entry, status: 'landed', multiplier: landing.multiplier, amount }
      : entry));
    onWin(pick, amount, landing.multiplier);
  };

  const handleAllLanded = () => {
    timers.current.push(setTimeout(() => setPhase('result'), 500));
  };


  const busy = phase === 'picking' || phase === 'dropping';

  const total = rounds.reduce((s, r) => s + r.amount, 0);
  const statusLabel = phase === 'picking'
    ? 'Sorteando'
    : phase === 'dropping'
      ? 'Em queda'
      : phase === 'result'
        ? 'Resultado'
        : 'Pronto';

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-w-none w-screen h-[100dvh] p-0 border-none bg-transparent shadow-none rounded-none translate-x-0 translate-y-0 left-0 top-0 [&>button]:hidden">
        <div
          className="h-[100dvh] w-full overflow-hidden flex flex-col relative"
          style={{
            ...cardStyle,
            backgroundImage: `radial-gradient(120% 80% at 50% 0%, ${accent}18, transparent 60%), radial-gradient(80% 60% at 50% 110%, ${accent}12, transparent 60%)`,
          }}
        >
          <header className="shrink-0 px-4 sm:px-7 h-14 flex items-center justify-between border-b border-white/[0.05]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}>
                <Dices size={16} style={{ color: accent }} />
              </div>
              <div className="leading-none">
                <p className="text-[9px] uppercase tracking-[0.3em] text-white/35">Mini game</p>
                <h2 className="text-sm font-black uppercase tracking-[0.18em]" style={{ color: textColor }}>Plinko</h2>
              </div>
            </div>

            <div className="flex items-center gap-5">
              <div className="hidden sm:flex items-center gap-5">
                <div className="text-right leading-none">
                  <p className="text-[9px] uppercase tracking-[0.2em] text-white/35">Participantes</p>
                  <p className="text-sm font-black tabular-nums" style={{ color: textColor }}>{participantCount}</p>
                </div>
                <div className="text-right leading-none">
                  <p className="text-[9px] uppercase tracking-[0.2em] text-white/35">Prêmio base</p>
                  <p className="text-sm font-black tabular-nums" style={{ color: accent }}>{formatCurrency(basePrize)}</p>
                </div>
              </div>
              {!busy && (
                <button onClick={onClose} aria-label="Fechar" className="w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.07] transition">
                  <X size={18} />
                </button>
              )}
            </div>
          </header>

          {/* The board is the stage. Nothing sits beside it or compresses it. */}
          <main className="flex-1 min-h-0 px-2 sm:px-5 pb-3 flex flex-col items-center">
            <div className="w-full max-w-[1180px] h-11 sm:h-12 shrink-0 flex items-center justify-between px-2 sm:px-4 gap-3">
              <div className="min-w-0 flex items-center gap-3">
                <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.3em] text-white/30 shrink-0">{statusLabel}</span>
                <span
                  className="text-sm sm:text-xl font-black uppercase truncate"
                  style={{ color: phase === 'idle' ? 'rgba(255,255,255,0.25)' : accent, textShadow: phase === 'idle' ? 'none' : `0 0 24px ${accent}55` }}
                >
                  {phase === 'idle' ? 'Aguardando' : (reelName || '—')}
                </span>
              </div>
              <div className="hidden sm:flex items-center gap-2 shrink-0">
                <span className="text-[9px] uppercase tracking-[0.2em] text-white/30">Total pago</span>
                <strong className="text-sm tabular-nums" style={{ color: textColor }}>{formatCurrency(total)}</strong>
              </div>
            </div>

            <section className="relative flex-1 min-h-0 w-full max-w-[1180px]">
              <PlinkoBoard
                fill
                rows={rows}
                multipliers={multipliers}
                accent={accent}
                dropToken={dropToken}
                balls={activeBalls}
                onLanded={handleLanded}
                onAllLanded={handleAllLanded}
              />

              {roster.length > 0 && (phase === 'dropping' || phase === 'result') && (
                <div className="absolute top-3 right-3 w-[min(340px,calc(100%_-_24px))] max-h-[60%] overflow-y-auto rounded-2xl border p-3 sm:p-4 animate-scale-in backdrop-blur-xl" style={{ borderColor: `${accent}70`, background: 'rgba(5,12,17,0.9)' }}>
                  <p className="text-[9px] uppercase tracking-[0.25em] text-white/40 mb-2">Sorteados</p>
                  <div className="space-y-2">
                    {roster.map((r) => (
                      <div key={r.id} className="flex items-center gap-3">
                        <span className="flex-1 text-xs sm:text-sm font-black uppercase truncate" style={{ color: textColor }}>{r.name}</span>
                        {r.status === 'landed' ? (
                          <>
                            <span className="text-[10px] font-mono text-white/40">{r.multiplier}x</span>
                            <span className="text-xs sm:text-sm font-black tabular-nums" style={{ color: accent }}>{formatCurrency(r.amount ?? 0)}</span>
                          </>
                        ) : (
                          <span className="text-[10px] uppercase tracking-wider text-white/30 animate-pulse">Caindo…</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <div className="w-full max-w-[1180px] h-16 shrink-0 flex items-center justify-center">
              <button
                onClick={startRound}
                disabled={busy || participantCount === 0}
                className="px-7 sm:px-10 py-3 rounded-full text-[11px] sm:text-xs font-black uppercase tracking-[0.18em] flex items-center justify-center gap-2.5 transition-all hover:brightness-110 active:scale-95 disabled:opacity-40"
                style={{ background: accent, color: btnText, boxShadow: `0 10px 40px ${accent}40` }}
              >
                <Play size={14} fill="currentColor" />
                {busy ? 'Rodando' : `Soltar ${ballCount} bolinha${ballCount > 1 ? 's' : ''}`}
              </button>
            </div>
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PlinkoGame;
