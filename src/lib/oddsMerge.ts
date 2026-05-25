// ============================================================================
// Odds merge / normalization / validation
// ----------------------------------------------------------------------------
// Aggregator-ready layer on top of API-Football odds payloads.
// Goals:
//   • Normalize market names from many bookmakers into canonical keys (PT-BR).
//   • Normalize outcome labels (Over/Under, Mais/Menos, Acima de, etc.).
//   • Per-category bookmaker policy (e.g. Match Winner = Bet365 only,
//     Cards/Corners = allow fallback to 1xBet/Marathonbet/Bwin/…).
//   • Validate markets (odds > 1, ≥2 outcomes, no dupes, no broken lines).
//   • In-memory cache so the same fixture isn't re-merged every render/import.
//   • Live-ready output shape: each market carries `status`, `bookmaker`,
//     `lastUpdated`, `suspended` and a stable `key` so future realtime patches
//     (odds change, suspension, cashout) can target a single market in place.
// ============================================================================

export const BOOKMAKER_PRIORITY = ['bet365', '1xbet', 'marathonbet', 'bwin'];

// ---------- Market name normalization ----------
// Each entry: canonical PT-BR title + list of alias regexes/keywords coming
// from the API. Match is case-insensitive on the raw bet.name.
type MarketDef = {
  /** Canonical PT-BR title shown in UI. */
  title: string;
  /** Stable key used for dedupe + future realtime updates. */
  key: string;
  /** Category drives bookmaker policy below. */
  category: MarketCategory;
  /** Aliases as plain lowercased substrings or full names. */
  aliases: string[];
};

export type MarketCategory =
  | 'match_winner'
  | 'double_chance'
  | 'btts'
  | 'goals_ou'
  | 'handicap'
  | 'corners'
  | 'cards'
  | 'halves'
  | 'exact_score'
  | 'team_totals'
  | 'other';

const MARKET_DEFS: MarketDef[] = [
  { key: 'match_winner', title: 'Resultado Final', category: 'match_winner',
    aliases: ['match winner', 'full time result', '1x2', 'resultado final', 'vencedor', 'vencedor do jogo', 'resultado'] },
  { key: 'home_away', title: 'Vencedor (sem empate)', category: 'match_winner',
    aliases: ['home/away'] },
  { key: 'double_chance', title: 'Dupla chance', category: 'double_chance',
    aliases: ['double chance', 'dupla chance'] },
  { key: 'btts', title: 'Ambos marcam', category: 'btts',
    aliases: ['both teams to score', 'both teams score', 'btts', 'ambos marcam'] },
  { key: 'goals_ou', title: 'Mais/Menos gols', category: 'goals_ou',
    aliases: ['goals over/under', 'goals over under', 'over/under', 'total goals', 'total - goals'] },
  { key: 'asian_handicap', title: 'Handicap asiático', category: 'handicap',
    aliases: ['asian handicap'] },
  { key: 'handicap', title: 'Handicap', category: 'handicap',
    aliases: ['handicap result', 'handicap'] },
  { key: 'corners_ou', title: 'Escanteios', category: 'corners',
    aliases: ['corners over under', 'corners over/under', 'total corners', 'corners 1x2', 'corners'] },
  { key: 'cards_ou', title: 'Cartões', category: 'cards',
    aliases: ['cards over under', 'cards over/under', 'total cards', 'cards', 'bookings', 'yellow cards', 'yellow cards over/under', 'asian cards', 'cards asian', 'player cards'] },
  { key: 'first_half_winner', title: 'Vencedor 1º tempo', category: 'halves',
    aliases: ['first half winner', '1st half winner'] },
  { key: 'second_half_winner', title: 'Vencedor 2º tempo', category: 'halves',
    aliases: ['second half winner', '2nd half winner'] },
  { key: 'exact_score', title: 'Placar exato', category: 'exact_score',
    aliases: ['exact score', 'correct score'] },
  { key: 'total_home', title: 'Total gols mandante', category: 'team_totals',
    aliases: ['total - home', 'home total goals'] },
  { key: 'total_away', title: 'Total gols visitante', category: 'team_totals',
    aliases: ['total - away', 'away total goals'] },
];

/** Resolve a raw bet name to a canonical market definition (or null). */
export function resolveMarket(rawName: string): MarketDef | null {
  const n = String(rawName || '').trim().toLowerCase();
  if (!n) return null;
  // Exact match first
  for (const d of MARKET_DEFS) if (d.aliases.some(a => a === n)) return d;
  // Substring fallback (e.g. "Cards Over/Under - 1st Half")
  for (const d of MARKET_DEFS) if (d.aliases.some(a => n.includes(a))) return d;
  return null;
}

// ---------- Category → bookmaker policy ----------
// `bet365Only` = ignore fallbacks even if Bet365 doesn't publish it.
// `allowFallback` = use Bet365 if present, otherwise next bookmaker by priority.
export const CATEGORY_POLICY: Record<MarketCategory, 'bet365Only' | 'allowFallback'> = {
  match_winner: 'bet365Only',
  double_chance: 'bet365Only',
  btts: 'allowFallback',
  goals_ou: 'allowFallback',
  handicap: 'allowFallback',
  corners: 'allowFallback',
  cards: 'allowFallback',
  halves: 'allowFallback',
  exact_score: 'allowFallback',
  team_totals: 'allowFallback',
  other: 'allowFallback',
};

// ---------- Outcome label normalization ----------
const OVER_RE = /^(?:over|mais\s+de|acima\s+de|mais|\+)\s*([\d.,]+)$/i;
const UNDER_RE = /^(?:under|menos\s+de|abaixo\s+de|menos|-)\s*([\d.,]+)$/i;

export function normalizeOutcomeLabel(raw: string, homeName: string, awayName: string): string {
  const v = String(raw || '').trim();
  if (!v) return '';
  const low = v.toLowerCase();
  if (low === 'home' || low === '1' || low === 'casa') return `${homeName} vence`;
  if (low === 'away' || low === '2' || low === 'fora' || low === 'visitante') return `${awayName} vence`;
  if (low === 'draw' || low === 'x' || low === 'empate') return 'Empate';
  if (low === 'yes' || low === 'sim') return 'Sim';
  if (low === 'no' || low === 'não' || low === 'nao') return 'Não';
  if (low === 'home/draw' || low === '1x') return `${homeName} ou empate`;
  if (low === 'draw/away' || low === 'x2') return `Empate ou ${awayName}`;
  if (low === 'home/away' || low === '12') return `${homeName} ou ${awayName}`;
  const ov = v.match(OVER_RE);
  if (ov) return `Mais de ${ov[1].replace(',', '.')}`;
  const un = v.match(UNDER_RE);
  if (un) return `Menos de ${un[1].replace(',', '.')}`;
  return v;
}

// ---------- Validation ----------
type RawOutcome = { value: string; odd: string | number };
type RawBet = { name: string; values: RawOutcome[] };
type RawBookmaker = { id?: number; name: string; bets?: RawBet[] };

export type MergedOutcome = { label: string; odd: number };
export type MergedMarket = {
  /** Stable canonical key (e.g. 'cards_ou'). */
  key: string;
  /** PT-BR title for UI. */
  title: string;
  category: MarketCategory;
  /** Bookmaker the market was sourced from. */
  bookmaker: string;
  /** Live-ready status (defaults to 'open'). */
  status: 'open' | 'suspended' | 'closed';
  /** ms epoch — used by future live-update reconciliation. */
  lastUpdated: number;
  outcomes: MergedOutcome[];
};

export type MergeStats = {
  primary: string | null;
  ordered: string[];
  base: number;
  fallback: number;
  total: number;
  perBookmaker: Record<string, number>;
  coverage: Record<string, number>; // % of total markets each bookmaker contributed
  duplicated: Array<{ key: string; bookmaker: string; alreadyFrom: string }>;
  rejected: Array<{ name: string; bookmaker: string; reason: string }>;
};

function priorityOf(name: string): number {
  const i = BOOKMAKER_PRIORITY.indexOf(String(name || '').toLowerCase());
  return i === -1 ? BOOKMAKER_PRIORITY.length + 1 : i;
}

function validateOutcomes(raw: RawOutcome[], homeName: string, awayName: string): {
  outs: MergedOutcome[]; reason?: string;
} {
  if (!Array.isArray(raw) || raw.length < 2) return { outs: [], reason: 'menos de 2 valores' };
  const seen = new Set<string>();
  const outs: MergedOutcome[] = [];
  for (const v of raw) {
    const label = normalizeOutcomeLabel(String(v.value), homeName, awayName);
    const odd = Number(v.odd);
    if (!label) continue;
    if (!Number.isFinite(odd) || odd <= 1.01) continue; // odds quebradas (1.00 etc.)
    if (odd > 1000) continue;                            // linhas inválidas
    const k = label.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    outs.push({ label, odd: Math.round(odd * 100) / 100 });
  }
  if (outs.length < 2) return { outs: [], reason: 'menos de 2 outcomes válidos (odd>1.01 + dedupe)' };
  return { outs };
}

// ---------- Merge ----------
export type MergeOptions = { homeName: string; awayName: string };

export function mergeBookmakers(
  bookmakers: RawBookmaker[],
  opts: MergeOptions,
): { markets: MergedMarket[]; stats: MergeStats } {
  const ordered = [...(bookmakers || [])].sort((a, b) => priorityOf(a?.name) - priorityOf(b?.name));
  const primary = ordered[0]?.name?.toLowerCase() === 'bet365' ? ordered[0] : null;

  const stats: MergeStats = {
    primary: primary?.name ?? ordered[0]?.name ?? null,
    ordered: ordered.map(b => b?.name).filter(Boolean) as string[],
    base: 0, fallback: 0, total: 0,
    perBookmaker: {}, coverage: {},
    duplicated: [], rejected: [],
  };

  const byKey = new Map<string, MergedMarket>();
  const now = Date.now();

  const processOne = (bk: RawBookmaker, isPrimary: boolean) => {
    const bkName = bk?.name || '(desconhecido)';
    const bets = bk?.bets || [];
    for (const bet of bets) {
      const def = resolveMarket(bet?.name);
      if (!def) {
        // Unknown market — keep as-is in 'other' bucket only if outcomes validate.
        const { outs, reason } = validateOutcomes(bet?.values || [], opts.homeName, opts.awayName);
        if (!outs.length) { stats.rejected.push({ name: bet?.name || '(sem nome)', bookmaker: bkName, reason: reason || 'inválido' }); continue; }
        const key = `other:${String(bet.name).trim().toLowerCase()}`;
        if (byKey.has(key)) {
          stats.duplicated.push({ key, bookmaker: bkName, alreadyFrom: byKey.get(key)!.bookmaker });
          continue;
        }
        byKey.set(key, { key, title: bet.name, category: 'other', bookmaker: bkName, status: 'open', lastUpdated: now, outcomes: outs });
        stats.perBookmaker[bkName] = (stats.perBookmaker[bkName] || 0) + 1;
        if (!isPrimary) stats.fallback += 1; else stats.base += 1;
        continue;
      }

      // Policy gate: bet365Only categories ignore non-bet365 sources.
      const policy = CATEGORY_POLICY[def.category];
      if (policy === 'bet365Only' && bkName.toLowerCase() !== 'bet365') {
        stats.rejected.push({ name: bet.name, bookmaker: bkName, reason: `categoria ${def.category} restrita ao Bet365` });
        continue;
      }

      if (byKey.has(def.key)) {
        stats.duplicated.push({ key: def.key, bookmaker: bkName, alreadyFrom: byKey.get(def.key)!.bookmaker });
        continue;
      }

      const { outs, reason } = validateOutcomes(bet.values || [], opts.homeName, opts.awayName);
      if (!outs.length) { stats.rejected.push({ name: bet.name, bookmaker: bkName, reason: reason || 'inválido' }); continue; }

      byKey.set(def.key, {
        key: def.key, title: def.title, category: def.category,
        bookmaker: bkName, status: 'open', lastUpdated: now, outcomes: outs,
      });
      stats.perBookmaker[bkName] = (stats.perBookmaker[bkName] || 0) + 1;
      if (!isPrimary) stats.fallback += 1; else stats.base += 1;
    }
  };

  // 1) Bet365 first (if present) to lock priority categories.
  if (primary) processOne(primary, true);
  // 2) Then remaining bookmakers in priority order.
  for (const bk of ordered) {
    if (bk === primary) continue;
    processOne(bk, !primary && bk === ordered[0]);
  }

  const markets = Array.from(byKey.values());
  stats.total = markets.length;
  for (const [name, n] of Object.entries(stats.perBookmaker)) {
    stats.coverage[name] = stats.total ? Math.round((n / stats.total) * 1000) / 10 : 0;
  }
  return { markets, stats };
}

// ---------- Cache (live-ready: keyed by fixtureId, TTL-bounded) ----------
type CacheEntry = { at: number; data: { markets: MergedMarket[]; stats: MergeStats } };
const CACHE = new Map<string | number, CacheEntry>();
const DEFAULT_TTL_MS = 60_000; // 1 min — short enough for near-live odds

export function getCachedMerge(fixtureId: string | number): CacheEntry['data'] | null {
  const hit = CACHE.get(fixtureId);
  if (!hit) return null;
  if (Date.now() - hit.at > DEFAULT_TTL_MS) { CACHE.delete(fixtureId); return null; }
  return hit.data;
}

export function setCachedMerge(fixtureId: string | number, data: CacheEntry['data']) {
  CACHE.set(fixtureId, { at: Date.now(), data });
}

export function invalidateMerge(fixtureId?: string | number) {
  if (fixtureId == null) CACHE.clear(); else CACHE.delete(fixtureId);
}

/** Convenience: cached merge in one call. */
export function mergeBookmakersCached(
  fixtureId: string | number,
  bookmakers: RawBookmaker[],
  opts: MergeOptions,
): { markets: MergedMarket[]; stats: MergeStats; fromCache: boolean } {
  const cached = getCachedMerge(fixtureId);
  if (cached) return { ...cached, fromCache: true };
  const res = mergeBookmakers(bookmakers, opts);
  setCachedMerge(fixtureId, res);
  return { ...res, fromCache: false };
}

// ---------- Live update hooks (placeholders for future realtime integration) ----------
export function applyLivePatch(
  markets: MergedMarket[],
  patch: { key: string; status?: MergedMarket['status']; outcomes?: MergedOutcome[] },
): MergedMarket[] {
  return markets.map(m => m.key === patch.key
    ? { ...m, ...patch, outcomes: patch.outcomes ?? m.outcomes, lastUpdated: Date.now() }
    : m);
}
