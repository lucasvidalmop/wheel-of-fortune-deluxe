import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Dices, Loader2, RotateCcw, Save } from 'lucide-react';

const db = supabase as any;

const ROW_OPTIONS = [8, 9, 10, 11, 12, 13, 14, 15, 16];
type Difficulty = 'baixa' | 'media' | 'alta';
const DIFFICULTY_STEEPNESS: Record<Difficulty, number> = { baixa: 1.3, media: 1.55, alta: 1.85 };
const DEFAULT_ROWS = 12;

const multiplierCurve = (slots: number, difficulty: Difficulty): number[] => {
  const center = (slots - 1) / 2;
  const steepness = DIFFICULTY_STEEPNESS[difficulty];
  return Array.from({ length: slots }, (_, i) => {
    const dist = Math.abs(i - center);
    const raw = 0.4 * Math.pow(steepness, dist);
    return Math.round(raw * 10) / 10;
  });
};

/** Natural binomial odds for a board with this many peg rows. */
const binomialChances = (rows: number): number[] => {
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

interface PlinkoConfig {
  plinkoRows: number;
  plinkoDifficulty: Difficulty;
  plinkoMultipliers: number[];
  plinkoChances: number[];
  plinkoBasePrize: number;
  plinkoBallCount: number;
}

const buildDefaults = (rows: number, difficulty: Difficulty): PlinkoConfig => ({
  plinkoRows: rows,
  plinkoDifficulty: difficulty,
  plinkoMultipliers: multiplierCurve(rows + 1, difficulty),
  plinkoChances: binomialChances(rows),
  plinkoBasePrize: 10,
  plinkoBallCount: 1,
});

/** Configuração do mini game Plinko usado no sorteio ao vivo (página do influencer). */
const PlinkoConfigPanel = ({ ownerId }: { ownerId: string }) => {
  const [config, setConfig] = useState<PlinkoConfig>(buildDefaults(DEFAULT_ROWS, 'media'));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await db
      .from('wheel_configs').select('config').eq('user_id', ownerId).maybeSingle();
    const inf = data?.config?.influencerPageConfig || {};
    const rows = ROW_OPTIONS.includes(inf.plinkoRows) ? inf.plinkoRows : DEFAULT_ROWS;
    const difficulty: Difficulty = ['baixa', 'media', 'alta'].includes(inf.plinkoDifficulty) ? inf.plinkoDifficulty : 'media';
    const slots = rows + 1;
    setConfig({
      plinkoRows: rows,
      plinkoDifficulty: difficulty,
      plinkoMultipliers: inf.plinkoMultipliers?.length === slots ? inf.plinkoMultipliers : multiplierCurve(slots, difficulty),
      plinkoChances: inf.plinkoChances?.length === slots ? inf.plinkoChances : binomialChances(rows),
      plinkoBasePrize: typeof inf.plinkoBasePrize === 'number' ? inf.plinkoBasePrize : 10,
      plinkoBallCount: typeof inf.plinkoBallCount === 'number' ? inf.plinkoBallCount : 1,
    });
    setLoading(false);
  }, [ownerId]);

  useEffect(() => { void load(); }, [load]);

  const update = (partial: Partial<PlinkoConfig>) => setConfig((c) => ({ ...c, ...partial }));

  const applyRows = (rows: number) => {
    const slots = rows + 1;
    update({
      plinkoRows: rows,
      plinkoMultipliers: multiplierCurve(slots, config.plinkoDifficulty),
      plinkoChances: binomialChances(rows),
    });
  };

  const applyDifficulty = (difficulty: Difficulty) => {
    update({
      plinkoDifficulty: difficulty,
      plinkoMultipliers: multiplierCurve(config.plinkoRows + 1, difficulty),
    });
  };

  const mults = config.plinkoMultipliers;
  const chances = mults.map((_, i) => Number(config.plinkoChances[i] ?? 0));
  const total = chances.reduce((s, n) => s + n, 0);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: row } = await db
        .from('wheel_configs').select('config').eq('user_id', ownerId).maybeSingle();
      const dbConfig = row?.config || {};
      const merged = {
        ...dbConfig,
        influencerPageConfig: { ...(dbConfig.influencerPageConfig || {}), ...config, plinkoChances: chances },
      };
      const { error } = await db
        .from('wheel_configs')
        .update({ config: merged, updated_at: new Date().toISOString() })
        .eq('user_id', ownerId);
      if (error) throw error;
      toast.success('Configuração do Plinko salva');
    } catch {
      toast.error('Não foi possível salvar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground">
        <Dices size={14} className="text-primary" /> Mini Game · Plinko
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Linhas do tabuleiro</span>
            <select
              value={config.plinkoRows}
              onChange={(e) => applyRows(Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm font-mono"
            >
              {ROW_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Dificuldade</span>
            <select
              value={config.plinkoDifficulty}
              onChange={(e) => applyDifficulty(e.target.value as Difficulty)}
              className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm font-mono"
            >
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
            </select>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Prêmio base (R$)</span>
            <input
              type="number" min="0" step="1"
              value={config.plinkoBasePrize}
              onChange={(e) => update({ plinkoBasePrize: Number(e.target.value) || 0 })}
              className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm font-mono"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Bolinhas por rodada (1-20)</span>
            <input
              type="number" min="1" max="20"
              value={config.plinkoBallCount}
              onChange={(e) => update({ plinkoBallCount: Math.min(20, Math.max(1, Number(e.target.value) || 1)) })}
              className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm font-mono"
            />
          </label>
        </div>

        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Multiplicadores e chances ({mults.length} casas)</span>
            <span className={`font-mono text-[10px] ${Math.round(total) === 100 ? 'text-primary' : 'text-amber-400'}`}>
              Total {total.toFixed(1)}%
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
            {mults.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-8 font-mono text-[10px] text-muted-foreground">#{i + 1}</span>
                <input
                  type="number" step="0.1" min="0"
                  value={m}
                  onChange={(e) => {
                    const next = [...mults];
                    next[i] = Number(e.target.value) || 0;
                    update({ plinkoMultipliers: next });
                  }}
                  className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm font-mono"
                />
                <span className="text-[10px] text-muted-foreground">x</span>
                <input
                  type="number" step="0.1" min="0" max="100"
                  value={chances[i] ?? 0}
                  onChange={(e) => {
                    const next = [...chances];
                    next[i] = Math.max(0, Number(e.target.value) || 0);
                    update({ plinkoChances: next });
                  }}
                  className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-sm font-mono"
                />
                <span className="w-3 text-[10px] text-muted-foreground">%</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Trocar linhas ou dificuldade regenera essa lista automaticamente. As chances definem a probabilidade de cada casa; se o total não for 100%, os valores são normalizados na hora do sorteio.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleSave} disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar
        </button>
        <button
          onClick={() => update(buildDefaults(config.plinkoRows, config.plinkoDifficulty))}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <RotateCcw size={14} /> Restaurar padrão
        </button>
      </div>
    </div>
  );
};

export default PlinkoConfigPanel;
