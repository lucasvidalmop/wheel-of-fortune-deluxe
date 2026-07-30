import { PlinkoConfig, chancePercents, expectedMultiplier, DEFAULT_PLINKO } from './plinkoConfig';

interface Props {
  value: PlinkoConfig;
  onChange: (cfg: PlinkoConfig) => void;
  accent?: string;
}

const label = 'block text-[10px] uppercase tracking-widest text-white/40 mb-1.5';
const field = 'w-full h-10 rounded-lg bg-white/[0.04] border border-white/10 px-3 text-white text-sm outline-none focus:border-white/25';

const PlinkoConfigEditor = ({ value, onChange, accent = '#22c55e' }: Props) => {
  const pct = chancePercents(value.slots);
  const ev = expectedMultiplier(value);

  const setSlot = (i: number, patch: Partial<{ multiplier: number; chance: number }>) => {
    const slots = value.slots.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    onChange({ ...value, slots });
  };

  const addSlot = () => onChange({ ...value, slots: [...value.slots, { multiplier: 1, chance: 10 }] });
  const removeSlot = (i: number) => {
    if (value.slots.length <= 3) return;
    onChange({ ...value, slots: value.slots.filter((_, idx) => idx !== i) });
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white">Plinko · multiplicadores</h3>
          <p className="text-[11px] text-white/40 mt-0.5">
            O sorteado joga o plinko e o multiplicador define o prêmio dele.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange({ ...DEFAULT_PLINKO, base_amount: value.base_amount, prize_type: value.prize_type })}
          className="h-8 px-3 rounded-lg border border-white/15 text-[11px] font-semibold text-white/60 shrink-0"
        >
          Restaurar padrão
        </button>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className={label}>Valor base do prêmio</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={value.base_amount}
            onChange={(e) => onChange({ ...value, base_amount: Number(e.target.value) })}
            className={field}
          />
        </div>
        <div>
          <label className={label}>Tipo de prêmio</label>
          <select
            value={value.prize_type}
            onChange={(e) => onChange({ ...value, prize_type: e.target.value as PlinkoConfig['prize_type'] })}
            className={field}
          >
            <option value="pix" className="bg-neutral-900">PIX</option>
            <option value="spins" className="bg-neutral-900">Giros na roleta</option>
            <option value="coins" className="bg-neutral-900">Coins</option>
          </select>
        </div>
        <div>
          <label className={label}>Sorteio do slot</label>
          <select
            value={value.use_chances ? 'chances' : 'fisica'}
            onChange={(e) => onChange({ ...value, use_chances: e.target.value === 'chances' })}
            className={field}
          >
            <option value="chances" className="bg-neutral-900">Pelas % definidas</option>
            <option value="fisica" className="bg-neutral-900">Física natural do plinko</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-[28px_1fr_1fr_70px_32px] gap-2 text-[10px] uppercase tracking-widest text-white/35 px-1">
          <span>#</span>
          <span>Multiplicador</span>
          <span>Peso {value.use_chances ? '' : '(ignorado)'}</span>
          <span className="text-right">Chance</span>
          <span />
        </div>
        {value.slots.map((s, i) => (
          <div key={i} className="grid grid-cols-[28px_1fr_1fr_70px_32px] gap-2 items-center">
            <span className="text-[11px] text-white/35 text-center">{i + 1}</span>
            <div className="relative">
              <input
                type="number"
                min={0}
                step="0.1"
                value={s.multiplier}
                onChange={(e) => setSlot(i, { multiplier: Number(e.target.value) })}
                className={`${field} pr-7`}
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-white/30">x</span>
            </div>
            <input
              type="number"
              min={0}
              step="1"
              disabled={!value.use_chances}
              value={s.chance}
              onChange={(e) => setSlot(i, { chance: Number(e.target.value) })}
              className={`${field} disabled:opacity-40`}
            />
            <span className="text-right text-xs font-bold tabular-nums" style={{ color: accent }}>
              {value.use_chances ? `${pct[i].toFixed(1)}%` : '—'}
            </span>
            <button
              type="button"
              onClick={() => removeSlot(i)}
              disabled={value.slots.length <= 3}
              className="h-8 w-8 rounded-lg border border-white/10 text-white/40 text-sm disabled:opacity-25"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addSlot}
          className="w-full h-9 rounded-lg border border-dashed border-white/15 text-[11px] font-semibold text-white/50"
        >
          + Adicionar casa
        </button>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-[11px] text-white/50 flex flex-wrap gap-x-5 gap-y-1">
        <span>Casas: <b className="text-white/80">{value.slots.length}</b></span>
        <span>Multiplicador médio: <b className="text-white/80">{ev.toFixed(2)}x</b></span>
        <span>
          Custo médio por rodada:{' '}
          <b className="text-white/80">
            {value.prize_type === 'pix'
              ? `R$ ${(value.base_amount * ev).toFixed(2).replace('.', ',')}`
              : `${Math.round(value.base_amount * ev)} ${value.prize_type === 'spins' ? 'giros' : 'coins'}`}
          </b>
        </span>
        <span>
          Chance de zerar:{' '}
          <b className="text-white/80">
            {value.use_chances
              ? `${value.slots.reduce((a, s, i) => a + (s.multiplier === 0 ? pct[i] : 0), 0).toFixed(1)}%`
              : '—'}
          </b>
        </span>
      </div>
    </div>
  );
};

export default PlinkoConfigEditor;
