// Coerência de mercados no bilhete múltiplo.
// Classifica mercados a partir do título e bloqueia combinações redundantes/correlacionadas
// dentro do MESMO fixture (event_id).

export type MarketKind =
  | 'final'   // Resultado Final / 1x2 / Vencedor
  | 'dc'      // Dupla Chance
  | 'dnb'     // Draw No Bet / Empate anula
  | 'btts'    // Ambos marcam
  | 'ou'      // Mais de / Menos de (over/under)
  | 'cs'      // Placar correto
  | 'ah'      // Handicap
  | 'other';

export function classifyMarket(title: string | null | undefined): MarketKind {
  const t = (title || '').toLowerCase().trim();
  if (!t || t === 'principal' || /resultado.*final|1x2|moneyline|vencedor(?!.*tempo)|match.*winner|full.*time/.test(t)) {
    // título vazio/"Principal" tratamos como Resultado Final do jogo
    if (!t || t === 'principal') return 'final';
  }
  if (/dupla\s*chance|double\s*chance/.test(t)) return 'dc';
  if (/draw\s*no\s*bet|empate\s*anula|sem\s*empate|dnb/.test(t)) return 'dnb';
  if (/ambos.*marcam|both.*score|btts/.test(t)) return 'btts';
  if (/placar.*correto|correct.*score/.test(t)) return 'cs';
  if (/handicap|asi[áa]tico|empate\s*anula/.test(t)) return 'ah';
  if (/mais\s*de|menos\s*de|over|under|total.*gols|mais\/menos|over\/under/.test(t)) return 'ou';
  if (/resultado.*final|1x2|moneyline|vencedor|match.*winner|full.*time/.test(t)) return 'final';
  return 'other';
}

// Pares de tipos de mercado que NÃO podem coexistir no mesmo fixture (qualquer ordem).
const BLOCKED_PAIRS: ReadonlyArray<readonly [MarketKind, MarketKind]> = [
  ['final', 'dc'],
  ['final', 'dnb'],
  ['final', 'ah'],
  ['final', 'cs'],
  ['dc', 'dnb'],
  ['dc', 'cs'],
  ['dc', 'ah'],
  ['btts', 'cs'],
  ['ou', 'cs'],
];

function isPairBlocked(a: MarketKind, b: MarketKind): boolean {
  return BLOCKED_PAIRS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

export interface CoherenceSelection {
  eventId: string;
  marketId: string | null;
  marketTitle: string;
}

export interface CoherenceOptions {
  /** Se false, só permite UMA seleção por fixture. Padrão: false. */
  allowSameFixture?: boolean;
}

export interface CoherenceCheck {
  ok: boolean;
  reason?: string;
}

/**
 * Verifica se uma nova seleção pode ser adicionada às existentes do bilhete.
 * Não considera duplicidade exata do mesmo mercado (esta já é tratada à parte).
 */
export function canAddSelection(
  existing: CoherenceSelection[],
  candidate: CoherenceSelection,
  opts: CoherenceOptions = {},
): CoherenceCheck {
  const allowSameFixture = !!opts.allowSameFixture;
  const sameFixture = existing.filter((s) => s.eventId === candidate.eventId);
  if (sameFixture.length === 0) return { ok: true };

  if (!allowSameFixture) {
    return {
      ok: false,
      reason: 'Essa seleção não pode ser combinada com outra aposta do mesmo jogo.',
    };
  }

  const candKind = classifyMarket(candidate.marketTitle);
  for (const s of sameFixture) {
    // mesmo mercado já é bloqueado por dedupe; aqui foco em conflitos cruzados
    if ((s.marketId || 'main') === (candidate.marketId || 'main')) continue;
    const kind = classifyMarket(s.marketTitle);
    if (isPairBlocked(kind, candKind)) {
      return {
        ok: false,
        reason: 'Essa seleção não pode ser combinada com outra aposta do mesmo jogo.',
      };
    }
  }
  return { ok: true };
}

/** Valida o bilhete inteiro antes de confirmar. */
export function validateTicketCoherence(
  selections: CoherenceSelection[],
  opts: CoherenceOptions = {},
): CoherenceCheck {
  for (let i = 0; i < selections.length; i++) {
    const rest = selections.slice(0, i);
    const r = canAddSelection(rest, selections[i], opts);
    if (!r.ok) return r;
  }
  return { ok: true };
}
