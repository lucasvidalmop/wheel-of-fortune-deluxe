import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X, Dices, Settings2, Play } from 'lucide-react';
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
  multipliers?: number[];
  chances?: number[];
  basePrize?: number;
  ballCount?: number;
}

const ROWS = 8;
const DEFAULT_MULTIPLIERS = [10, 5, 3, 2, 1, 2, 3, 5, 10];
const DEFAULT_CHANCES = [2, 6, 10, 15, 34, 15, 10, 6, 2];

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
  multipliers: multipliersProp, chances: chancesProp,
  basePrize: basePrizeProp, ballCount: ballCountProp,
}: PlinkoGameProps) => {
  const multipliers = multipliersProp?.length === ROWS + 1 ? multipliersProp : DEFAULT_MULTIPLIERS;
  const chances = multipliers.map((_, i) => Number(chancesProp?.[i] ?? DEFAULT_CHANCES[i] ?? 0));
  const basePrize = typeof basePrizeProp === 'number' && basePrizeProp >= 0 ? basePrizeProp : 10;
  const ballCount = Math.min(20, Math.max(1, ballCountProp || 1));

  const [phase, setPhase] = useState<'idle' | 'picking' | 'dropping' | 'result'>('idle');
  const [reelName, setReelName] = useState('');
  const [activeBalls, setActiveBalls] = useState<PlinkoBall[]>([]);
  const [rounds, setRounds] = useState<PlinkoRound[]>([]);
  const [batch, setBatch] = useState<PlinkoRound[]>([]);
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
      setBatch([]);
      setRounds([]);
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
      return { id, label: p.name };
    });

    setBatch([]);
    setActiveBalls(newBalls);
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
    setBatch(prev => [...prev, round]);
    setRounds(prev => [round, ...prev]);
    onWin(pick, amount, landing.multiplier);
  };

  const handleAllLanded = () => {
    timers.current.push(setTimeout(() => setPhase('result'), 500));
  };


  const busy = phase === 'picking' || phase === 'dropping';

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-w-2xl p-0 border-none bg-transparent shadow-none [&>button]:hidden">
        <div className="rounded-2xl border border-white/[0.1] overflow-hidden max-h-[92vh] overflow-y-auto" style={cardStyle}>
          <div className="p-5 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Dices size={18} style={{ color: accent }} />
                <h2 className="text-base font-bold" style={{ color: textColor }}>Mini Game · Plinko</h2>
              </div>
              <p className="text-[11px] text-white/40">
                {participantCount} participante(s) · prêmio base {formatCurrency(basePrize)}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {!busy && (
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.06] transition text-white/40 hover:text-white">
                  <X size={18} />
                </button>
              )}
            </div>
          </div>

          <div className="px-5 pb-5 space-y-4">


            {/* Name display */}
            <div className="rounded-xl border p-3 text-center" style={{ borderColor: `${accent}25`, background: `${accent}08` }}>
              <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">
                {phase === 'picking' ? 'Sorteando participantes' : phase === 'idle' ? 'Aguardando' : `Participantes (${activeBalls.length})`}
              </p>
              <p
                className="text-lg font-black uppercase tracking-wide line-clamp-2"
                style={{ color: phase === 'picking' ? textColor : accent, textShadow: phase !== 'idle' ? `0 0 16px ${accent}70` : 'none' }}
              >
                {phase === 'idle' ? '—' : (reelName || '—')}
              </p>
            </div>

            <PlinkoBoard
              rows={ROWS}
              multipliers={multipliers}
              accent={accent}
              dropToken={dropToken}
              balls={activeBalls}
              onLanded={handleLanded}
              onAllLanded={handleAllLanded}
            />

            {phase === 'result' && batch.length > 0 && (
              <div className="rounded-xl border p-4 animate-scale-in space-y-2" style={{ borderColor: accent, background: `${accent}12`, boxShadow: `0 0 30px ${accent}30` }}>
                <p className="text-[10px] uppercase tracking-widest text-white/50 text-center">
                  Resultado {batch.length > 1 ? `· ${batch.length} bolinhas` : ''}
                </p>
                {batch.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="flex-1 text-sm font-black uppercase truncate" style={{ color: textColor }}>{r.name}</span>
                    <span className="text-xs font-mono text-white/50">{r.multiplier}x</span>
                    <span className="text-base font-black" style={{ color: accent, textShadow: `0 0 14px ${accent}70` }}>{formatCurrency(r.amount)}</span>
                  </div>
                ))}
                {batch.length > 1 && (
                  <p className="text-center text-[11px] font-bold pt-1 border-t" style={{ color: accent, borderColor: `${accent}30` }}>
                    Total {formatCurrency(batch.reduce((s, r) => s + r.amount, 0))}
                  </p>
                )}
              </div>
            )}

            <button
              onClick={startRound}
              disabled={busy || participantCount === 0}
              className="w-full py-4 rounded-2xl text-sm font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
              style={{ background: accent, color: btnText, boxShadow: `0 0 40px ${accent}50` }}
            >
              <Play size={18} fill="currentColor" />
              {busy ? 'Rodando...' : `Soltar ${ballCount} bolinha${ballCount > 1 ? 's' : ''}`}
            </button>


            {rounds.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-widest text-white/40">Rodadas ({rounds.length})</p>
                  <p className="text-[11px] font-bold" style={{ color: accent }}>
                    Total {formatCurrency(rounds.reduce((s, r) => s + r.amount, 0))}
                  </p>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {rounds.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
                      <span className="flex-1 text-xs font-bold uppercase truncate" style={{ color: textColor }}>{r.name}</span>
                      <span className="text-[10px] font-mono text-white/40">{r.multiplier}x</span>
                      <span className="text-xs font-black" style={{ color: accent }}>{formatCurrency(r.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PlinkoGame;
