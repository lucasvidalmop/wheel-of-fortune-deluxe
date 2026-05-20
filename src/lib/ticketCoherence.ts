// Coerência de mercados no bilhete múltiplo.
//
// Permite combinar múltiplos mercados do MESMO fixture (como sportsbooks reais),
// porém bloqueia pares incoerentes/redundantes (ex.: Over/Under mesmo line,
// BTTS Sim+Não, Vitória + Dupla Chance que já cobre o time, Placar Correto +
// resultado final contraditório, etc.).
//
// Cada seleção é normalizada em um "Claim" — um conjunto de afirmações sobre o
// jogo (quem vence, total de gols, ambos marcam, placar etc.). Dois claims são
// comparados duas a duas para detectar contradição ou redundância.

export type MarketKind =
  | 'final' // Resultado Final / 1x2 / Vencedor
  | 'dc'    // Dupla Chance
  | 'dnb'   // Draw No Bet / Empate anula
  | 'btts'  // Ambos marcam
  | 'ou'    // Mais de / Menos de
  | 'cs'    // Placar correto
  | 'ah'    // Handicap
  | 'fnv'   // "Time para NÃO vencer"
  | 'other';

export interface CoherenceSelection {
  eventId: string;
  marketId: string | null;
  marketTitle: string;
  outcomeLabel: string;
  eventTitle?: string;
}

export interface CoherenceCheck { ok: boolean; reason?: string }

const DEFAULT_REASON = 'Essa seleção é incoerente com outra do mesmo jogo.';

// -------------------- helpers --------------------

const ACCENT_MAP: Record<string, string> = {
  á:'a',à:'a',â:'a',ã:'a',ä:'a',é:'e',è:'e',ê:'e',ë:'e',
  í:'i',ì:'i',î:'i',ï:'i',ó:'o',ò:'o',ô:'o',õ:'o',ö:'o',
  ú:'u',ù:'u',û:'u',ü:'u',ç:'c',ñ:'n',
};
function norm(s: string | null | undefined): string {
  const lower = (s || '').toLowerCase().trim();
  let out = '';
  for (const ch of lower) out += ACCENT_MAP[ch] || ch;
  return out;
}

function parseTeams(eventTitle: string | undefined): { home: string; away: string } {
  const t = norm(eventTitle || '');
  const m = t.split(/\s+(?:x|vs|×|@|-)\s+/);
  if (m.length >= 2) return { home: m[0].trim(), away: m.slice(1).join(' ').trim() };
  return { home: '', away: '' };
}

function teamSide(label: string, teams: { home: string; away: string }): 'home' | 'away' | null {
  const l = norm(label);
  if (!l) return null;
  // exact word match using first token of each team
  const ht = teams.home.split(/\s+/)[0];
  const at = teams.away.split(/\s+/)[0];
  if (ht && new RegExp(`\\b${escapeRe(ht)}\\b`).test(l)) return 'home';
  if (at && new RegExp(`\\b${escapeRe(at)}\\b`).test(l)) return 'away';
  if (/\b(casa|mandante|home|1)\b/.test(l)) return 'home';
  if (/\b(fora|visitante|away|2)\b/.test(l)) return 'away';
  return null;
}
function escapeRe(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// -------------------- classification --------------------

export function classifyMarket(title: string | null | undefined): MarketKind {
  const t = norm(title);
  if (!t || t === 'principal') return 'final';
  if (/dupla\s*chance|double\s*chance/.test(t)) return 'dc';
  if (/draw\s*no\s*bet|empate\s*anula|sem\s*empate|\bdnb\b/.test(t)) return 'dnb';
  if (/ambos.*marcam|both.*score|\bbtts\b/.test(t)) return 'btts';
  if (/placar.*correto|correct.*score/.test(t)) return 'cs';
  if (/handicap|asiatico/.test(t)) return 'ah';
  if (/nao\s*vence/.test(t)) return 'fnv';
  if (/mais\s*de|menos\s*de|\bover\b|\bunder\b|total.*gols|mais\/menos|over\/under/.test(t)) return 'ou';
  if (/resultado.*final|1x2|moneyline|vencedor|match.*winner|full.*time/.test(t)) return 'final';
  return 'other';
}

// -------------------- claim derivation --------------------

interface Claim {
  kind: MarketKind;
  finalPick?: 'home' | 'draw' | 'away';
  finalNot?: 'home' | 'away';
  dcCover?: Set<'home' | 'draw' | 'away'>;
  dnbTeam?: 'home' | 'away';
  bttsYes?: boolean;
  ou?: { line: number; over: boolean };
  cs?: { h: number; a: number };
  ah?: { team: 'home' | 'away'; value: number };
}

function parseLine(s: string): number | null {
  const m = s.match(/(\d+(?:[\.,]\d+)?)/);
  if (!m) return null;
  return parseFloat(m[1].replace(',', '.'));
}

function deriveClaim(sel: CoherenceSelection): Claim {
  const kind = classifyMarket(sel.marketTitle);
  const teams = parseTeams(sel.eventTitle);
  const label = norm(sel.outcomeLabel);
  const mTitle = norm(sel.marketTitle);
  const claim: Claim = { kind };

  switch (kind) {
    case 'final': {
      if (/\b(empate|draw|x)\b/.test(label)) claim.finalPick = 'draw';
      else {
        const side = teamSide(label, teams);
        if (side) claim.finalPick = side;
      }
      break;
    }
    case 'fnv': {
      const side = teamSide(label, teams);
      if (side) claim.finalNot = side;
      break;
    }
    case 'dc': {
      const cov = new Set<'home' | 'draw' | 'away'>();
      // codes
      if (/\b1\s*x\b|\bcasa\s*ou\s*empate\b|\bhome\s*or\s*draw\b/.test(label)) { cov.add('home'); cov.add('draw'); }
      if (/\bx\s*2\b|\bempate\s*ou\s*(visitante|fora)\b|\bdraw\s*or\s*away\b/.test(label)) { cov.add('draw'); cov.add('away'); }
      if (/\b12\b|\bcasa\s*ou\s*(visitante|fora)\b|\bhome\s*or\s*away\b/.test(label)) { cov.add('home'); cov.add('away'); }
      // detect both team names in label → home+away (ex.: "Santos ou San Lorenzo")
      const ht = teams.home.split(/\s+/)[0];
      const at = teams.away.split(/\s+/)[0];
      const hasHome = !!ht && new RegExp(`\\b${escapeRe(ht)}\\b`).test(label);
      const hasAway = !!at && new RegExp(`\\b${escapeRe(at)}\\b`).test(label);
      if (hasHome && hasAway) { cov.add('home'); cov.add('away'); }
      // by team name + "empate"
      const hasDraw = /\b(empate|draw)\b/.test(label);
      if (hasDraw && hasHome) { cov.add('home'); cov.add('draw'); }
      if (hasDraw && hasAway) { cov.add('away'); cov.add('draw'); }
      // fallback: single side with draw word
      if (cov.size === 0) {
        const side = teamSide(label, teams);
        if (side && hasDraw) { cov.add(side); cov.add('draw'); }
        // last resort: if DC market but no parse, assume covers the side mentioned alongside anything
        else if (side) { cov.add(side); }
      }
      if (cov.size > 0) claim.dcCover = cov;
      break;
    }
    case 'dnb': {
      const side = teamSide(label, teams);
      if (side) claim.dnbTeam = side;
      break;
    }
    case 'btts': {
      if (/\b(sim|yes)\b/.test(label)) claim.bttsYes = true;
      else if (/\b(nao|no)\b/.test(label)) claim.bttsYes = false;
      break;
    }
    case 'ou': {
      const over = /\b(mais|over|\+)\b/.test(label) || /\b(mais|over)\b/.test(mTitle);
      const under = /\b(menos|under|-)\b/.test(label) || /\b(menos|under)\b/.test(mTitle);
      const line = parseLine(label) ?? parseLine(mTitle);
      if (line != null && (over || under)) claim.ou = { line, over: over && !under };
      break;
    }
    case 'cs': {
      const m = label.match(/(\d+)\s*[xX\-:]\s*(\d+)/);
      if (m) claim.cs = { h: parseInt(m[1], 10), a: parseInt(m[2], 10) };
      break;
    }
    case 'ah': {
      const side = teamSide(label, teams);
      const v = parseLine(label);
      if (side && v != null) claim.ah = { team: side, value: v };
      break;
    }
  }
  return claim;
}

// -------------------- conflict detection --------------------

function csFinal(cs: { h: number; a: number }): 'home' | 'draw' | 'away' {
  return cs.h > cs.a ? 'home' : cs.h < cs.a ? 'away' : 'draw';
}

function pairConflict(a: Claim, b: Claim): string | null {
  // BTTS Sim x Não
  if (a.bttsYes !== undefined && b.bttsYes !== undefined && a.bttsYes !== b.bttsYes) {
    return 'Ambos Marcam Sim e Não no mesmo jogo.';
  }
  // Over/Under mesma linha
  if (a.ou && b.ou && a.ou.line === b.ou.line && a.ou.over !== b.ou.over) {
    return `Over e Under ${a.ou.line} no mesmo jogo.`;
  }
  // Resultado final
  if (a.finalPick && b.finalPick) {
    return a.finalPick === b.finalPick
      ? 'Resultado final repetido.'
      : 'Resultados finais contraditórios.';
  }
  // DNB vs DNB
  if (a.dnbTeam && b.dnbTeam && a.dnbTeam !== b.dnbTeam) {
    return 'Draw No Bet contraditórios.';
  }
  // Handicap 0 vs Handicap 0 same fixture different teams: contradiction
  if (a.ah && b.ah && a.ah.value === 0 && b.ah.value === 0 && a.ah.team !== b.ah.team) {
    return 'Handicaps 0 contraditórios.';
  }

  // pairs (directional)
  for (const [x, y] of [[a, b], [b, a]] as const) {
    // final + finalNot
    if (x.finalPick && y.finalNot) {
      if (x.finalPick === y.finalNot) return '"Vence" e "Não vence" do mesmo time.';
      if (x.finalPick !== 'draw' && x.finalPick !== y.finalNot) {
        return '"Vence X" implica "Não vence Y" — combinação redundante.';
      }
    }
    // final + DC
    if (x.finalPick && y.dcCover) {
      if (y.dcCover.has(x.finalPick)) return 'Resultado final já coberto pela Dupla Chance.';
      return 'Resultado final fora da Dupla Chance escolhida.';
    }
    // final + DNB
    if (x.finalPick && y.dnbTeam) {
      if (x.finalPick === 'draw') return 'Final "Empate" + DNB é redundante (DNB devolve no empate).';
      if (x.finalPick === y.dnbTeam) return 'Vitória + DNB do mesmo time é redundante.';
      return 'Vitória + DNB do time oposto é contraditório.';
    }
    // final + Handicap 0
    if (x.finalPick && y.ah && y.ah.value === 0) {
      if (x.finalPick === y.ah.team) return 'Vitória + Handicap 0 do mesmo time é redundante.';
      if (x.finalPick !== 'draw' && x.finalPick !== y.ah.team) return 'Vitória + Handicap 0 do oponente é contraditório.';
    }
    // CS implica final/btts/ou
    if (x.cs && y.finalPick) {
      const f = csFinal(x.cs);
      return f === y.finalPick
        ? 'Placar correto já define o resultado final.'
        : 'Placar correto contradiz o resultado final.';
    }
    if (x.cs && y.dcCover) {
      const f = csFinal(x.cs);
      return y.dcCover.has(f)
        ? 'Placar correto já está contido na Dupla Chance.'
        : 'Placar correto está fora da Dupla Chance.';
    }
    if (x.cs && y.dnbTeam) {
      const f = csFinal(x.cs);
      if (f === 'draw') return 'Placar de empate + DNB é redundante.';
      return f === y.dnbTeam ? 'Placar correto já define o DNB.' : 'Placar correto contradiz o DNB.';
    }
    if (x.cs && y.bttsYes !== undefined) {
      const yes = x.cs.h > 0 && x.cs.a > 0;
      return yes === y.bttsYes
        ? 'Placar correto já define Ambos Marcam.'
        : 'Placar correto contradiz Ambos Marcam.';
    }
    if (x.cs && y.ou) {
      const total = x.cs.h + x.cs.a;
      if (total === y.ou.line) continue; // empate na linha = devolve (raro)
      const over = total > y.ou.line;
      if (over !== y.ou.over) return 'Placar correto contradiz Over/Under.';
      return 'Placar correto já define Over/Under.';
    }
    // DC + DNB
    if (x.dcCover && y.dnbTeam) {
      if (x.dcCover.has(y.dnbTeam) && x.dcCover.has('draw')) return 'Dupla Chance já cobre o DNB.';
      if (!x.dcCover.has(y.dnbTeam) && !x.dcCover.has('draw')) return 'Dupla Chance contradiz o DNB.';
    }
    // DC + DC
    if (x.dcCover && y.dcCover && x !== y) {
      const inter = [...x.dcCover].filter(v => y.dcCover!.has(v));
      if (inter.length === 0) return 'Duplas Chances contraditórias.';
      if (inter.length === x.dcCover.size || inter.length === y.dcCover.size) return 'Duplas Chances redundantes.';
    }
  }
  return null;
}

// -------------------- public API --------------------

export function canAddSelection(
  existing: CoherenceSelection[],
  candidate: CoherenceSelection,
): CoherenceCheck {
  const sameFixture = existing.filter((s) => s.eventId === candidate.eventId);
  if (sameFixture.length === 0) return { ok: true };
  const cand = deriveClaim(candidate);
  for (const s of sameFixture) {
    const reason = pairConflict(deriveClaim(s), cand);
    if (reason) return { ok: false, reason };
  }
  return { ok: true };
}

export function validateTicketCoherence(selections: CoherenceSelection[]): CoherenceCheck {
  for (let i = 0; i < selections.length; i++) {
    const rest = selections.slice(0, i);
    const r = canAddSelection(rest, selections[i]);
    if (!r.ok) return r;
  }
  return { ok: true };
}
