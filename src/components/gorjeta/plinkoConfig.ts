export interface PlinkoSlot {
  multiplier: number;
  chance: number; // peso em % (relativo)
}

export interface PlinkoConfig {
  slots: PlinkoSlot[];
  base_amount: number;
  prize_type: 'pix' | 'spins' | 'coins';
  use_chances: boolean; // false = física natural do plinko
}

export const DEFAULT_PLINKO: PlinkoConfig = {
  slots: [
    { multiplier: 10, chance: 1 },
    { multiplier: 5, chance: 3 },
    { multiplier: 2, chance: 8 },
    { multiplier: 1, chance: 14 },
    { multiplier: 0.5, chance: 20 },
    { multiplier: 0, chance: 8 },
    { multiplier: 0.5, chance: 20 },
    { multiplier: 1, chance: 14 },
    { multiplier: 2, chance: 8 },
    { multiplier: 5, chance: 3 },
    { multiplier: 10, chance: 1 },
  ],
  base_amount: 10,
  prize_type: 'pix',
  use_chances: true,
};

export function normalizePlinko(raw: unknown): PlinkoConfig {
  const cfg = (raw || {}) as Partial<PlinkoConfig>;
  const slots = Array.isArray(cfg.slots) && cfg.slots.length >= 3
    ? cfg.slots.map((s) => ({
        multiplier: Math.max(0, Number((s as PlinkoSlot)?.multiplier) || 0),
        chance: Math.max(0, Number((s as PlinkoSlot)?.chance) || 0),
      }))
    : DEFAULT_PLINKO.slots;
  return {
    slots,
    base_amount: Number(cfg.base_amount) > 0 ? Number(cfg.base_amount) : DEFAULT_PLINKO.base_amount,
    prize_type: (['pix', 'spins', 'coins'] as const).includes(cfg.prize_type as never)
      ? (cfg.prize_type as PlinkoConfig['prize_type'])
      : 'pix',
    use_chances: cfg.use_chances !== false,
  };
}

/** Percentual real de cada slot depois de normalizar os pesos. */
export function chancePercents(slots: PlinkoSlot[]): number[] {
  const total = slots.reduce((a, s) => a + Math.max(0, s.chance), 0);
  if (total <= 0) return slots.map(() => 100 / slots.length);
  return slots.map((s) => (Math.max(0, s.chance) / total) * 100);
}

/** Retorno médio esperado (multiplicador médio ponderado). */
export function expectedMultiplier(cfg: PlinkoConfig): number {
  const pct = chancePercents(cfg.slots);
  return cfg.slots.reduce((a, s, i) => a + s.multiplier * (pct[i] / 100), 0);
}

export function plinkoRows(slots: PlinkoSlot[]): number {
  return Math.max(6, Math.min(16, slots.length - 1));
}
