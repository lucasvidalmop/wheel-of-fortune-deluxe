// Cálculo de odd final para bilhete múltiplo (imita casas de apostas).
export interface TicketSelectionLite {
  eventId: string;
  odd: number;
}

export interface TicketOddLimits {
  /** Odd máxima permitida pelo operador (sempre limitado a 1000). */
  maxOdd?: number;
  /** Retorno máximo permitido (em coins). 0 = sem limite. */
  maxReturn?: number;
  /** Stake mínimo. */
  minBet?: number;
  /** Stake máximo. 0 = sem limite. */
  maxBet?: number;
}

export interface TicketOddBreakdown {
  base: number;
  houseFactor: number;
  bonus: number;
  final: number;
  selections: number;
  hasSameFixture: boolean;
}

export const HARD_MAX_ODD = 1000;

export function computeTicketOdd(selections: TicketSelectionLite[]): TicketOddBreakdown {
  const n = selections.length;
  const base = selections.reduce((a, s) => a * (Number(s.odd) || 1), 1);

  const ids = selections.map((s) => s.eventId);
  const hasSameFixture = new Set(ids).size !== ids.length;

  // Odd final = odd base. Sem fator de casa, sem bônus.
  const houseFactor = 1;
  const bonus = 1;
  const final = Math.round(base * 100) / 100;
  return { base, houseFactor, bonus, final, selections: n, hasSameFixture };
}

export function effectiveMaxOdd(limits?: TicketOddLimits): number {
  const opMax = Number(limits?.maxOdd) || HARD_MAX_ODD;
  return Math.min(HARD_MAX_ODD, opMax);
}
