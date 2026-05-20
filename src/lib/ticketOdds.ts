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

  // Fator de controle: pegar o MAIS restritivo dentre os aplicáveis.
  let houseFactor = 0.97;
  if (base > 50) houseFactor = Math.min(houseFactor, 0.9);
  if (base > 100) houseFactor = Math.min(houseFactor, 0.8);
  if (hasSameFixture) houseFactor = Math.min(houseFactor, 0.85);

  // Bônus por quantidade de seleções
  let bonus = 1;
  if (n >= 10) bonus = 1.20;
  else if (n >= 8) bonus = 1.12;
  else if (n >= 5) bonus = 1.07;
  else if (n >= 3) bonus = 1.03;

  const final = Math.round(base * houseFactor * bonus * 100) / 100;
  return { base, houseFactor, bonus, final, selections: n, hasSameFixture };
}

export function effectiveMaxOdd(limits?: TicketOddLimits): number {
  const opMax = Number(limits?.maxOdd) || HARD_MAX_ODD;
  return Math.min(HARD_MAX_ODD, opMax);
}
