import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X, Settings2 } from 'lucide-react';
import Plinko from './games/Plinko';
import PlinkoConfigEditor from './PlinkoConfigEditor';
import { chancePercents, plinkoRows, type PlinkoConfig } from './plinkoConfig';

export interface PlinkoCandidate {
  id: string;
  name: string;
  account_id: string;
  _isGhost?: boolean;
  [key: string]: any;
}

interface Props {
  open: boolean;
  onClose: () => void;
  accent: string;
  config: PlinkoConfig;
  onSaveConfig: (cfg: PlinkoConfig) => Promise<void> | void;
  candidates: PlinkoCandidate[];
  /** Persiste o prêmio do ganhador (PIX / giros / coins conforme o tipo). */
  onWinner: (winner: PlinkoCandidate, amount: number, multiplier: number) => Promise<void> | void;
}

/** Sorteia um índice de slot respeitando os pesos configurados. */
const pickSlot = (cfg: PlinkoConfig) => {
  if (!cfg.use_chances) {
    // física natural: binomial sobre as fileiras
    const rows = plinkoRows(cfg.slots);
    let right = 0;
    for (let i = 0; i < rows; i++) right += Math.random() < 0.5 ? 0 : 1;
    return Math.min(cfg.slots.length - 1, Math.round((right / rows) * (cfg.slots.length - 1)));
  }
  const total = cfg.slots.reduce((a, s) => a + Math.max(0, s.chance), 0);
  if (total <= 0) return Math.floor(Math.random() * cfg.slots.length);
  let r = Math.random() * total;
  for (let i = 0; i < cfg.slots.length; i++) {
    r -= Math.max(0, cfg.slots[i].chance);
    if (r <= 0) return i;
  }
  return cfg.slots.length - 1;
};

/** Caminho aleatório de `rows` passos cuja soma de "direitas" cai no slot alvo. */
const buildPath = (rows: number, slots: number, target: number) => {
  const rights = Math.max(0, Math.min(rows, Math.round((target / Math.max(1, slots - 1)) * rows)));
  const path = Array(rows).fill(0);
  const idx = [...Array(rows).keys()].sort(() => Math.random() - 0.5).slice(0, rights);
  idx.forEach((i) => { path[i] = 1; });
  return path;
};

const PlinkoRaffleDialog = ({ open, onClose, accent, config, onSaveConfig, candidates, onWinner }: Props) => {
  const [cfg, setCfg] = useState<PlinkoConfig>(config);
  const [showConfig, setShowConfig] = useState(false);
  const [saving, setSaving] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'drawing' | 'drawn' | 'playing'>('idle');
  const [rollingName, setRollingName] = useState('');
  const [current, setCurrent] = useState<PlinkoCandidate | null>(null);
  const [path, setPath] = useState<number[] | null>(null);
  const [reveal, setReveal] = useState<{ label: string; win: boolean } | null>(null);

  useEffect(() => { setCfg(config); }, [config, open]);
  useEffect(() => {
    if (!open) {
      setPhase('idle'); setCurrent(null); setPath(null); setReveal(null); setShowConfig(false);
    }
  }, [open]);

  const multipliers = useMemo(() => cfg.slots.map((s) => s.multiplier), [cfg]);
  const rows = useMemo(() => plinkoRows(cfg.slots), [cfg]);
  const percents = useMemo(() => chancePercents(cfg.slots), [cfg]);

  const unit = cfg.prize_type === 'pix' ? 'pix' : cfg.prize_type === 'spins' ? 'giros' : 'coins';
  const formatPrize = (amount: number) =>
    cfg.prize_type === 'pix' ? `R$ ${amount.toFixed(2).replace('.', ',')}` : `${Math.round(amount)} ${unit}`;

  const drawParticipant = () => {
    if (phase === 'drawing' || phase === 'playing') return;
    if (candidates.length === 0) return;
    setPhase('drawing');
    setReveal(null); setPath(null); setCurrent(null);

    const winner = candidates[Math.floor(Math.random() * candidates.length)];
    const startedAt = performance.now();
    const DURATION = 2400;
    const tick = () => {
      const t = (performance.now() - startedAt) / DURATION;
      if (t >= 1) {
        setRollingName(winner.name);
        setCurrent(winner);
        setPhase('drawn');
        return;
      }
      setRollingName(candidates[Math.floor(Math.random() * candidates.length)].name);
      setTimeout(tick, 40 + Math.pow(t, 3) * 260);
    };
    tick();
  };

  const play = async () => {
    if (phase !== 'drawn' || !current) return;
    setPhase('playing');
    setReveal(null);

    const slot = pickSlot(cfg);
    const multiplier = cfg.slots[slot].multiplier;
    const amount = Number((cfg.base_amount * multiplier).toFixed(2));
    setPath(buildPath(rows, cfg.slots.length, slot));

    window.setTimeout(async () => {
      setReveal({ label: multiplier > 0 ? formatPrize(amount) : 'nada', win: multiplier > 0 });
      setPhase('idle');
      if (multiplier > 0) {
        try { await onWinner(current, amount, multiplier); } catch (e) { console.error(e); }
      }
    }, 620 + rows * 320 + 900);
  };

  const saveConfig = async () => {
    setSaving(true);
    await onSaveConfig(cfg);
    setSaving(false);
    setShowConfig(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && phase === 'idle') onClose(); }}>
      <DialogContent className="max-w-3xl w-[96vw] p-0 border-none bg-transparent shadow-none [&>button]:hidden">
        <div className="flex flex-col rounded-2xl border border-white/10 bg-[#080b11] text-white overflow-hidden max-h-[90vh]">
          <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/[0.07] shrink-0">
            <div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-white/40">Sorteio</div>
              <h2 className="text-lg font-black">Plinko da gorjeta</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowConfig((v) => !v)}
                className="h-9 px-3 rounded-lg border border-white/12 text-xs font-semibold text-white/60 flex items-center gap-1.5"
              >
                <Settings2 size={13} /> Configurar
              </button>
              <button
                onClick={onClose}
                disabled={phase === 'drawing' || phase === 'playing'}
                className="h-9 w-9 rounded-lg border border-white/12 text-white/60 flex items-center justify-center disabled:opacity-30"
              >
                <X size={14} />
              </button>
            </div>
          </header>

          {showConfig ? (
            <div className="p-5 space-y-4">
              <PlinkoConfigEditor value={cfg} onChange={setCfg} accent={accent} />
              <div className="flex justify-end gap-2">
                <button onClick={() => { setCfg(config); setShowConfig(false); }} className="h-10 px-4 rounded-xl border border-white/12 text-xs font-semibold text-white/60">
                  Cancelar
                </button>
                <button onClick={saveConfig} disabled={saving} className="h-10 px-5 rounded-xl text-xs font-black uppercase tracking-wider disabled:opacity-50" style={{ background: accent, color: '#04150a' }}>
                  {saving ? 'Salvando...' : 'Salvar configuração'}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 sm:p-5">
              <div
                className="rounded-2xl border p-4 mb-3 text-center transition-colors"
                style={{
                  borderColor: phase === 'drawing' ? `${accent}66` : 'rgba(255,255,255,0.08)',
                  background: phase === 'drawing' ? `${accent}0f` : 'rgba(255,255,255,0.02)',
                }}
              >
                <div className="text-[10px] uppercase tracking-[0.28em] text-white/40 mb-1">
                  {phase === 'drawing' ? 'Sorteando participante...' : current ? 'Participante sorteado' : 'Etapa 1 · Sorteio'}
                </div>
                <div
                  className={`text-2xl font-black truncate ${phase === 'drawing' ? 'blur-[0.4px] opacity-80' : ''}`}
                  style={{ color: current || phase === 'drawing' ? accent : 'rgba(255,255,255,0.25)' }}
                >
                  {phase === 'drawing' ? rollingName || '—' : current?.name || 'Aguardando sorteio'}
                </div>
                {current && phase !== 'drawing' && (
                  <div className="text-[11px] text-white/40 mt-1 font-mono">{current.account_id}</div>
                )}
              </div>

              <div className={`rounded-2xl bg-black/40 border border-white/5 p-2 sm:p-3 transition-opacity ${!path && phase !== 'playing' ? 'opacity-50' : 'opacity-100'}`}>
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
                  className="mt-3 rounded-2xl border p-4 text-center"
                  style={{
                    borderColor: reveal.win ? `${accent}66` : 'rgba(255,255,255,0.12)',
                    background: reveal.win ? `${accent}12` : 'rgba(255,255,255,0.02)',
                  }}
                >
                  <div className="text-2xl mb-1">{reveal.win ? '🎉' : '😬'}</div>
                  <div className="text-lg font-black" style={{ color: reveal.win ? accent : 'rgba(255,255,255,0.6)' }}>
                    {reveal.win ? `${current?.name} ganhou ${reveal.label}!` : 'Não foi dessa vez'}
                  </div>
                </div>
              )}

              <div className="mt-4 grid sm:grid-cols-2 gap-3">
                <button
                  onClick={drawParticipant}
                  disabled={phase === 'drawing' || phase === 'playing' || candidates.length === 0}
                  className="h-12 rounded-xl font-black text-sm uppercase tracking-wider border border-white/15 bg-white/[0.05] text-white disabled:opacity-40"
                >
                  {phase === 'drawing' ? 'Sorteando...' : '1 · Sortear participante'}
                </button>
                <button
                  onClick={play}
                  disabled={phase !== 'drawn'}
                  className="h-12 rounded-xl font-black text-sm uppercase tracking-wider disabled:opacity-40"
                  style={{ background: accent, color: '#04150a' }}
                >
                  {phase === 'playing' ? 'Soltando...' : '2 · Jogar plinko'}
                </button>
              </div>
              <p className="mt-2 text-center text-[11px] text-white/30">
                Prêmio base {formatPrize(cfg.base_amount)} × multiplicador do slot · {candidates.length} participante(s) elegíveis
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PlinkoRaffleDialog;
