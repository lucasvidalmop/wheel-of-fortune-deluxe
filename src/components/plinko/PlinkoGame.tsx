import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X, Dices, Settings2, Play } from 'lucide-react';
import PlinkoBoard from './PlinkoBoard';

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
}

const ROWS = 8;
const DEFAULT_MULTIPLIERS = [10, 5, 3, 2, 1, 2, 3, 5, 10];
const STORE_KEY = 'plinko_config_v1';

const formatCurrency = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

const PlinkoGame = ({
  open, onClose, accent, btnText, textColor, cardStyle,
  names, participantCount, pickParticipant, onWin,
}: PlinkoGameProps) => {
  const [multipliers, setMultipliers] = useState<number[]>(DEFAULT_MULTIPLIERS);
  const [basePrize, setBasePrize] = useState(10);
  const [showConfig, setShowConfig] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'picking' | 'dropping' | 'result'>('idle');
  const [reelName, setReelName] = useState('');
  const [current, setCurrent] = useState<PlinkoPick | null>(null);
  const [lastRound, setLastRound] = useState<PlinkoRound | null>(null);
  const [rounds, setRounds] = useState<PlinkoRound[]>([]);
  const [dropToken, setDropToken] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const reelRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.multipliers) && parsed.multipliers.length === ROWS + 1) {
          setMultipliers(parsed.multipliers.map((n: any) => Number(n) || 1));
        }
        if (typeof parsed.basePrize === 'number') setBasePrize(parsed.basePrize);
      }
    } catch { /* ignore */ }
  }, []);

  const persistConfig = (mults: number[], base: number) => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ multipliers: mults, basePrize: base })); } catch { /* ignore */ }
  };

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
      setCurrent(null);
      setLastRound(null);
      setRounds([]);
      setDropToken(0);
    }
  }, [open]);

  const startRound = () => {
    if (phase === 'picking' || phase === 'dropping') return;
    const pick = pickParticipant();
    if (!pick) return;

    setCurrent(pick);
    setLastRound(null);
    setPhase('picking');

    const pool = names.length > 0 ? names : [pick.name];
    reelRef.current = setInterval(() => {
      setReelName(pool[Math.floor(Math.random() * pool.length)]);
    }, 70);

    timers.current.push(setTimeout(() => {
      if (reelRef.current) { clearInterval(reelRef.current); reelRef.current = null; }
      setReelName(pick.name);
      setPhase('dropping');
      setDropToken(t => t + 1);
    }, 1800));
  };

  const handleLanded = (_slot: number, multiplier: number) => {
    const pick = current;
    if (!pick) return;
    const amount = Math.round(basePrize * multiplier * 100) / 100;
    const round: PlinkoRound = {
      name: pick.name,
      account_id: pick.account_id,
      multiplier,
      amount,
      isGhost: pick.isGhost,
    };
    setLastRound(round);
    setRounds(prev => [round, ...prev]);
    setPhase('result');
    onWin(pick, amount, multiplier);
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
              <button
                onClick={() => setShowConfig(v => !v)}
                className="p-1.5 rounded-lg hover:bg-white/[0.06] transition text-white/40 hover:text-white"
                title="Configurar multiplicadores"
              >
                <Settings2 size={16} />
              </button>
              {!busy && (
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.06] transition text-white/40 hover:text-white">
                  <X size={18} />
                </button>
              )}
            </div>
          </div>

          <div className="px-5 pb-5 space-y-4">
            {showConfig && (
              <div className="rounded-xl border p-3 space-y-3" style={{ borderColor: `${accent}25`, background: 'rgba(255,255,255,0.02)' }}>
                <p className="text-[10px] uppercase tracking-widest text-white/40">Multiplicadores ({ROWS + 1} casas)</p>
                <div className="grid grid-cols-9 gap-1">
                  {multipliers.map((m, i) => (
                    <input
                      key={i}
                      type="number"
                      step="0.5"
                      min="0"
                      value={m}
                      onChange={(e) => {
                        const next = [...multipliers];
                        next[i] = Number(e.target.value) || 0;
                        setMultipliers(next);
                        persistConfig(next, basePrize);
                      }}
                      className="w-full bg-transparent border rounded-md text-center text-[11px] font-bold py-1 outline-none"
                      style={{ borderColor: `${accent}33`, color: accent }}
                    />
                  ))}
                </div>
                <button
                  onClick={() => { setMultipliers(DEFAULT_MULTIPLIERS); persistConfig(DEFAULT_MULTIPLIERS, basePrize); }}
                  className="text-[10px] uppercase tracking-widest text-white/40 hover:text-white/70 transition"
                >
                  Restaurar padrão
                </button>
              </div>
            )}

            <div className="rounded-xl border p-3 flex items-center gap-3" style={{ borderColor: `${accent}25`, background: 'rgba(255,255,255,0.02)' }}>
              <span className="text-[10px] uppercase tracking-widest text-white/40 shrink-0">Prêmio base</span>
              <div className="flex items-center gap-1.5 flex-1">
                <span className="text-sm font-bold text-white/50">R$</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={basePrize}
                  disabled={busy}
                  onChange={(e) => { const v = Number(e.target.value) || 0; setBasePrize(v); persistConfig(multipliers, v); }}
                  className="w-24 bg-transparent border rounded-lg px-2 py-1.5 text-sm font-black outline-none disabled:opacity-50"
                  style={{ borderColor: `${accent}33`, color: accent }}
                />
                <div className="flex gap-1 ml-1">
                  {[5, 10, 20, 30].map(v => (
                    <button
                      key={v}
                      disabled={busy}
                      onClick={() => { setBasePrize(v); persistConfig(multipliers, v); }}
                      className="px-2 py-1 rounded-md border text-[10px] font-bold transition disabled:opacity-40"
                      style={basePrize === v
                        ? { borderColor: accent, background: `${accent}18`, color: accent }
                        : { borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Name display */}
            <div className="rounded-xl border p-3 text-center" style={{ borderColor: `${accent}25`, background: `${accent}08` }}>
              <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">
                {phase === 'picking' ? 'Sorteando participante' : phase === 'idle' ? 'Aguardando' : 'Participante'}
              </p>
              <p
                className="text-xl font-black uppercase tracking-wide truncate"
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
              onLanded={handleLanded}
            />

            {lastRound && phase === 'result' && (
              <div className="rounded-xl border p-4 text-center animate-scale-in" style={{ borderColor: accent, background: `${accent}12`, boxShadow: `0 0 30px ${accent}30` }}>
                <p className="text-[10px] uppercase tracking-widest text-white/50">Resultado</p>
                <p className="text-lg font-black uppercase" style={{ color: textColor }}>{lastRound.name}</p>
                <p className="text-2xl font-black mt-1" style={{ color: accent, textShadow: `0 0 20px ${accent}80` }}>
                  {lastRound.multiplier}x · {formatCurrency(lastRound.amount)}
                </p>
              </div>
            )}

            <button
              onClick={startRound}
              disabled={busy || participantCount === 0}
              className="w-full py-4 rounded-2xl text-sm font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
              style={{ background: accent, color: btnText, boxShadow: `0 0 40px ${accent}50` }}
            >
              <Play size={18} fill="currentColor" />
              {busy ? 'Rodando...' : rounds.length > 0 ? 'Soltar nova bolinha' : 'Sortear e soltar bolinha'}
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
