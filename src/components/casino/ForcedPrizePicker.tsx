import { useEffect, useMemo } from 'react';
import { Sparkles, Layers, Package, Shuffle, Plus, Trash2 } from 'lucide-react';

export interface ForcedEntry {
  prize_index?: number;
  scratch_index?: number;
  case_ids?: string[];
}

export type ForcedMode = 'fixed' | 'list' | 'pool';

interface Props {
  selectedCase: any;
  allCases: any[];
  openingsCount: number;
  mode: ForcedMode;
  setMode: (m: ForcedMode) => void;
  fixed: ForcedEntry | null;
  setFixed: (e: ForcedEntry | null) => void;
  list: (ForcedEntry | null)[];
  setList: (l: (ForcedEntry | null)[]) => void;
  // Pool mode (optional — enable with allowPool)
  allowPool?: boolean;
  pool?: ForcedEntry[];
  setPool?: (p: ForcedEntry[]) => void;
  poolLabel?: string;
}

const PrizeRow = ({
  selectedCase,
  allCases,
  value,
  onChange,
  label,
}: {
  selectedCase: any;
  allCases: any[];
  value: ForcedEntry | null;
  onChange: (v: ForcedEntry) => void;
  label?: string;
}) => {
  const isCasePool = selectedCase?.mode === 'case_pool';
  const poolQty = isCasePool ? Math.max(1, Math.min(10, Number(selectedCase?.prize_pool?.quantity) || 1)) : 0;
  const poolCases = isCasePool
    ? (selectedCase?.prize_pool?.items || [])
        .map((it: any) => allCases.find(c => c.id === it.case_id))
        .filter(Boolean)
    : [];
  const prizes: any[] = !isCasePool ? (selectedCase?.prizes || []) : [];

  if (isCasePool) {
    const ids = (value?.case_ids || []).slice(0, poolQty);
    while (ids.length < poolQty) ids.push(poolCases[0]?.id || '');
    return (
      <div className="space-y-2">
        {label && <div className="text-xs opacity-70">{label}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Array.from({ length: poolQty }).map((_, i) => (
            <select
              key={i}
              value={ids[i] || ''}
              onChange={e => {
                const next = ids.slice();
                next[i] = e.target.value;
                onChange({ case_ids: next });
              }}
              className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-sm"
            >
              {poolCases.length === 0 && <option value="">Pool vazio</option>}
              {poolCases.map((pc: any) => (
                <option key={pc.id} value={pc.id}>{pc.name}</option>
              ))}
            </select>
          ))}
        </div>
      </div>
    );
  }

  const pIdx = value?.prize_index ?? 0;
  const selectedPrize = prizes[pIdx];
  const isScratch = !!selectedPrize?.scratch && Array.isArray(selectedPrize?.scratchPrizes) && selectedPrize.scratchPrizes.length > 0;

  return (
    <div className="space-y-2">
      {label && <div className="text-xs opacity-70">{label}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select
          value={pIdx}
          onChange={e => onChange({ prize_index: Number(e.target.value) })}
          className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-sm"
        >
          {prizes.length === 0 && <option value="">Sem prêmios</option>}
          {prizes.map((p, i) => (
            <option key={i} value={i}>
              {p.label || `Prêmio ${i + 1}`}{p.amount ? ` · R$ ${Number(p.amount).toFixed(2)}` : ''}
            </option>
          ))}
        </select>
        {isScratch && (
          <select
            value={value?.scratch_index ?? 0}
            onChange={e => onChange({ prize_index: pIdx, scratch_index: Number(e.target.value) })}
            className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-sm"
          >
            {selectedPrize.scratchPrizes.map((sp: any, i: number) => (
              <option key={i} value={i}>
                Raspadinha · {sp.label || `Sub ${i + 1}`}{sp.amount ? ` · R$ ${Number(sp.amount).toFixed(2)}` : ''}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
};

const ForcedPrizePicker = ({
  selectedCase, allCases, openingsCount,
  mode, setMode, fixed, setFixed, list, setList,
}: Props) => {
  const isCasePool = selectedCase?.mode === 'case_pool';
  const poolQty = isCasePool ? Math.max(1, Math.min(10, Number(selectedCase?.prize_pool?.quantity) || 1)) : 0;
  const poolCases = isCasePool
    ? (selectedCase?.prize_pool?.items || [])
        .map((it: any) => allCases.find(c => c.id === it.case_id))
        .filter(Boolean)
    : [];
  const prizes: any[] = !isCasePool ? (selectedCase?.prizes || []) : [];

  // Default value when picker shows
  const defaultEntry = useMemo<ForcedEntry>(() => {
    if (isCasePool) {
      const firstId = poolCases[0]?.id || '';
      return { case_ids: Array.from({ length: poolQty }).map(() => firstId) };
    }
    return { prize_index: 0 };
  }, [isCasePool, poolQty, poolCases.length]);

  // Initialize / sync fixed
  useEffect(() => {
    if (mode === 'fixed' && (!fixed || (isCasePool && !fixed.case_ids))) {
      setFixed(defaultEntry);
    }
  }, [mode, isCasePool, defaultEntry]);

  // Initialize / sync list length
  useEffect(() => {
    if (mode !== 'list') return;
    const next = list.slice(0, openingsCount);
    while (next.length < openingsCount) next.push(defaultEntry);
    if (next.length !== list.length) setList(next);
  }, [mode, openingsCount, defaultEntry]);

  if (!selectedCase) return null;
  const empty = (isCasePool && poolCases.length === 0) || (!isCasePool && prizes.length === 0);
  if (empty) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
        Esta caixa não tem {isCasePool ? 'pool de caixas' : 'prêmios'} configurados.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-cyan-300">
          <Sparkles size={14} />
          Prêmio garantido <span className="text-[10px] uppercase opacity-60">obrigatório</span>
        </div>
        <div className="flex rounded-lg border border-white/10 overflow-hidden text-xs">
          <button type="button"
            onClick={() => setMode('fixed')}
            className={`px-3 py-1.5 flex items-center gap-1 ${mode === 'fixed' ? 'bg-cyan-500/20 text-cyan-200' : 'opacity-60 hover:opacity-100'}`}>
            <Package size={12} /> Mesmo p/ todas
          </button>
          <button type="button"
            onClick={() => setMode('list')}
            className={`px-3 py-1.5 flex items-center gap-1 border-l border-white/10 ${mode === 'list' ? 'bg-cyan-500/20 text-cyan-200' : 'opacity-60 hover:opacity-100'}`}>
            <Layers size={12} /> Uma por uma ({openingsCount})
          </button>
        </div>
      </div>

      {mode === 'fixed' && (
        <PrizeRow
          selectedCase={selectedCase} allCases={allCases}
          value={fixed} onChange={setFixed}
        />
      )}

      {mode === 'list' && (
        <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
          {Array.from({ length: openingsCount }).map((_, i) => (
            <PrizeRow
              key={i}
              selectedCase={selectedCase} allCases={allCases}
              label={`Abertura #${i + 1}`}
              value={list[i] || null}
              onChange={(v) => {
                const next = list.slice();
                next[i] = v;
                setList(next);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ForcedPrizePicker;

// Helpers used by the parent: build full forced_prizes array for a grant
export function buildForcedPrizes(
  mode: 'fixed' | 'list',
  fixed: ForcedEntry | null,
  list: (ForcedEntry | null)[],
  openingsCount: number,
): ForcedEntry[] {
  if (mode === 'fixed') {
    if (!fixed) return [];
    return Array.from({ length: openingsCount }).map(() => ({ ...fixed }));
  }
  return Array.from({ length: openingsCount }).map((_, i) => list[i] || {});
}
