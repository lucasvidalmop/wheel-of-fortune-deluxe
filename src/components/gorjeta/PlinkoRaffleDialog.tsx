import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
  /** Modo do sorteio: base cadastrada ou sala ao vivo. */
  mode: 'base' | 'live';
  onModeChange: (m: 'base' | 'live') => void;
  /** Painel de gestão da sala ao vivo (renderizado apenas no modo live). */
  livePanel?: React.ReactNode;
  /** Controles extras exibidos apenas na aba "Configurar". */
  configExtra?: React.ReactNode;

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

const PLINKO_DROP_MS = 620;
const PLINKO_ROW_MS = 300;
const PLINKO_SETTLE_MS = 700;

const PlinkoRaffleDialog = ({ open, onClose, accent, config, onSaveConfig, candidates, onWinner, mode, onModeChange, livePanel, configExtra }: Props) => {
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
    }, PLINKO_DROP_MS + rows * PLINKO_ROW_MS + PLINKO_SETTLE_MS);
  };

  const saveConfig = async () => {
    setSaving(true);
    await onSaveConfig(cfg);
    setSaving(false);
    setShowConfig(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && phase === 'idle') onClose(); }}>
      <DialogContent className="w-[calc(100vw-24px)] max-w-[1180px] max-h-[96dvh] overflow-hidden rounded-2xl border border-border bg-background p-0 text-foreground shadow-2xl [&>button]:hidden">
        <div className="flex max-h-[96dvh] flex-col overflow-hidden">

          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Sorteio</div>
              <h2 className="text-lg font-black">Plinko da gorjeta</h2>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowConfig((v) => !v)}
                className="text-xs font-semibold"
              >
                <Settings2 size={13} /> Configurar
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={onClose}
                disabled={phase === 'drawing' || phase === 'playing'}
                className="h-9 w-9"
                aria-label="Fechar"
              >
                <X size={14} />
              </Button>
            </div>
          </header>

          {showConfig ? (
            <div className="p-5 space-y-4 overflow-y-auto">
              <PlinkoConfigEditor value={cfg} onChange={setCfg} accent={accent} />
              {configExtra}

              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => { setCfg(config); setShowConfig(false); }} className="text-xs font-semibold">
                  Cancelar
                </Button>
                <Button size="sm" onClick={saveConfig} disabled={saving} className="text-xs font-black uppercase tracking-wider">
                  {saving ? 'Salvando...' : 'Salvar configuração'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
              <div className="mx-auto flex w-full min-h-0 max-w-[1080px] flex-1 flex-col">


              {/* seletor de modo */}
              <div className="mx-auto mb-2 inline-flex shrink-0 gap-1 rounded-lg border border-border bg-secondary/40 p-1">
                {([
                  { key: 'base' as const, label: 'Base + fantasmas' },
                  { key: 'live' as const, label: 'Ao vivo' },
                ]).map((m) => (
                  <Button
                    key={m.key}
                    type="button"
                    size="sm"
                    variant={mode === m.key ? 'default' : 'ghost'}
                    onClick={() => { if (phase !== 'drawing' && phase !== 'playing') onModeChange(m.key); }}
                    className="h-7 rounded-md px-4 text-[10px] font-bold uppercase tracking-wider"
                  >
                    {m.label}
                  </Button>
                ))}
              </div>

              {mode === 'live' && <div className="shrink-0">{livePanel}</div>}

              <div className={`mb-2 shrink-0 rounded-xl border px-4 py-2 text-center transition-colors ${phase === 'drawing' ? 'border-primary/60 bg-primary/10' : 'border-border bg-card'}`}>
                <div className="mb-0.5 text-[9px] uppercase tracking-[0.28em] text-muted-foreground">
                  {phase === 'drawing' ? 'Sorteando participante...' : current ? 'Participante sorteado' : 'Etapa 1 · Sorteio'}
                </div>
                <div
                  className={`truncate text-base font-black sm:text-lg ${phase === 'drawing' ? 'blur-[0.4px] opacity-80' : ''} ${current || phase === 'drawing' ? 'text-primary' : 'text-muted-foreground/60'}`}
                >
                  {phase === 'drawing' ? rollingName || '—' : current?.name || 'Aguardando sorteio'}
                </div>


                {current && phase !== 'drawing' && (
                  <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{current.account_id}</div>
                )}
              </div>

              <div className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-[240px] w-full flex-1">
                  <Plinko rows={rows} multipliers={multipliers} path={path} accent={accent} />
                </div>

                {cfg.use_chances && (
                  <div className="mt-1 flex shrink-0 flex-wrap justify-center gap-1 px-1">
                    {cfg.slots.map((s, i) => (
                      <span key={i} className="rounded-md border border-border bg-secondary/30 px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                        {s.multiplier}x · {percents[i].toFixed(1)}%
                      </span>
                    ))}
                  </div>
                )}
              </div>



              {reveal && (
                <div className={`mt-3 shrink-0 rounded-2xl border p-3 text-center ${reveal.win ? 'border-primary/60 bg-primary/10' : 'border-border bg-card'}`}>
                  <div className="text-2xl mb-1">{reveal.win ? '🎉' : '😬'}</div>
                  <div className={`text-lg font-black ${reveal.win ? 'text-primary' : 'text-muted-foreground'}`}>
                    {reveal.win ? `${current?.name} ganhou ${reveal.label}!` : 'Não foi dessa vez'}
                  </div>
                </div>
              )}

              <div className="mt-3 flex flex-wrap justify-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  onClick={drawParticipant}
                  disabled={phase === 'drawing' || phase === 'playing' || candidates.length === 0}
                  className="h-10 px-6 text-[12px] font-bold uppercase tracking-wide"
                >
                  {phase === 'drawing' ? 'Sorteando...' : '1 · Sortear'}
                </Button>
                <Button
                  onClick={play}
                  disabled={phase !== 'drawn'}
                  className="h-10 px-6 text-[12px] font-bold uppercase tracking-wide"
                >
                  {phase === 'playing' ? 'Soltando...' : '2 · Jogar plinko'}
                </Button>
              </div>


              <p className="mt-1 text-center text-[10px] text-muted-foreground">
                Prêmio base {formatPrize(cfg.base_amount)} × multiplicador do slot · {candidates.length} participante(s) elegíveis
              </p>
              </div>
            </div>

          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PlinkoRaffleDialog;
