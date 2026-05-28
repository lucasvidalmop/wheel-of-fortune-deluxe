// Centralized PT-BR translation for football market names.
// Visual-only: never mutates DB. Unknown markets fall back to original.

// Exact-match dictionary (lowercased key -> PT-BR)
const EXACT: Record<string, string> = {
  // Principais
  'match winner': 'Vencedor da Partida',
  'full time result': 'Resultado Final',
  '1x2': 'Vencedor da Partida',
  'home/away': 'Casa/Fora',
  'double chance': 'Dupla Chance',
  'asian handicap': 'Handicap Asiático',
  'handicap': 'Handicap',
  'odd/even': 'Ímpar/Par',
  'odd / even': 'Ímpar/Par',
  'to win': 'Para Vencer',
  'to qualify': 'Para Se Classificar',
  'win to nil': 'Vencer Sem Sofrer',
  'clean sheet': 'Não Sofrer Gol',
  'half time/full time': 'Intervalo/Final',
  'first half winner': 'Vencedor do 1º Tempo',
  'second half winner': 'Vencedor do 2º Tempo',
  'result of first half': 'Resultado 1º Tempo',
  'result of second half': 'Resultado 2º Tempo',

  // Gols
  'goals over/under': 'Mais/Menos Gols',
  'goals over under': 'Mais/Menos Gols',
  'over/under': 'Mais/Menos',
  'both teams score': 'Ambas Marcam',
  'both teams to score': 'Ambas Marcam',
  'btts': 'Ambas Marcam',
  'total goals': 'Total de Gols',
  'total - home': 'Total da Casa',
  'total - away': 'Total do Fora',
  'home team total goals': 'Total de Gols da Casa',
  'away team total goals': 'Total de Gols do Fora',
  'exact score': 'Placar Exato',
  'correct score': 'Placar Exato',
  'exact goals number': 'Quantidade Exata de Gols',
  'exact goals': 'Gols Exatos',

  // Jogadores
  'anytime goal scorer': 'Jogador Marca a Qualquer Momento',
  'first goal scorer': 'Primeiro Marcador',
  'last goal scorer': 'Último Marcador',
  'player assists': 'Assistências do Jogador',
  'player shots on target': 'Finalizações no Gol',
  'player shots': 'Finalizações do Jogador',
  'goalkeeper saves': 'Defesas do Goleiro',

  // Escanteios
  'corners over under': 'Escanteios Mais/Menos',
  'corners over/under': 'Escanteios Mais/Menos',
  'corners 1x2': 'Resultado em Escanteios',
  'corners asian handicap': 'Handicap Asiático de Escanteios',
  'corners handicap': 'Handicap de Escanteios',
  'total corners': 'Total de Escanteios',
  'total corners (3 way)': 'Total de Escanteios',
  'home corners over/under': 'Escanteios Casa Mais/Menos',
  'away corners over/under': 'Escanteios Fora Mais/Menos',
  'corners odd/even': 'Escanteios Ímpar/Par',
  'corners. odd/even': 'Escanteios Ímpar/Par',
  'corners double chance': 'Dupla Chance Escanteios',
  'first corner': 'Primeiro Escanteio',
  'last corner': 'Último Escanteio',

  // Cartões
  'cards over/under': 'Cartões Mais/Menos',
  'cards over under': 'Cartões Mais/Menos',
  'total cards': 'Total de Cartões',
  'asian cards': 'Handicap Asiático de Cartões',
  'cards handicap': 'Handicap de Cartões',
  'cards asian handicap': 'Handicap Asiático de Cartões',
  'yellow cards': 'Cartões Amarelos',
  'red cards': 'Cartões Vermelhos',
  'booking points': 'Pontos de Cartões',
  'team cards': 'Cartões por Time',
  'home team total cards': 'Cartões Casa',
  'away team total cards': 'Cartões Fora',
};

// Regex fallbacks (ordered: most specific first). Applied if no exact hit.
const REGEX_RULES: Array<[RegExp, string]> = [
  // Escanteios
  [/^corners?\s*over\s*\/?\s*under.*$/i, 'Escanteios Mais/Menos'],
  [/^home\s+corners?\s+over\s*\/?\s*under.*$/i, 'Escanteios Casa Mais/Menos'],
  [/^away\s+corners?\s+over\s*\/?\s*under.*$/i, 'Escanteios Fora Mais/Menos'],
  [/^corners?\s+1x2.*$/i, 'Resultado em Escanteios'],
  [/^corners?\s+asian\s+handicap.*$/i, 'Handicap Asiático de Escanteios'],
  [/^corners?\s+handicap.*$/i, 'Handicap de Escanteios'],
  [/^total\s+corners.*$/i, 'Total de Escanteios'],
  [/^corners?\.?\s*odd\s*\/?\s*even.*$/i, 'Escanteios Ímpar/Par'],
  [/^corners?\s+double\s+chance.*$/i, 'Dupla Chance Escanteios'],
  // Cartões
  [/^cards?\s*over\s*\/?\s*under.*$/i, 'Cartões Mais/Menos'],
  [/^total\s+cards.*$/i, 'Total de Cartões'],
  [/^asian\s+cards.*$/i, 'Handicap Asiático de Cartões'],
  [/^cards?\s+asian\s+handicap.*$/i, 'Handicap Asiático de Cartões'],
  [/^cards?\s+handicap.*$/i, 'Handicap de Cartões'],
  [/^yellow\s+cards?.*$/i, 'Cartões Amarelos'],
  [/^red\s+cards?.*$/i, 'Cartões Vermelhos'],
  [/^booking\s+points.*$/i, 'Pontos de Cartões'],
  [/^home\s+team\s+total\s+cards.*$/i, 'Cartões Casa'],
  [/^away\s+team\s+total\s+cards.*$/i, 'Cartões Fora'],
  [/^team\s+cards.*$/i, 'Cartões por Time'],
  // Jogadores
  [/^anytime\s+goal\s+scorer.*$/i, 'Jogador Marca a Qualquer Momento'],
  [/^first\s+goal\s+scorer.*$/i, 'Primeiro Marcador'],
  [/^last\s+goal\s+scorer.*$/i, 'Último Marcador'],
  [/^player\s+assists.*$/i, 'Assistências do Jogador'],
  [/^player\s+shots\s+on\s+target.*$/i, 'Finalizações no Gol'],
  [/^player\s+shots.*$/i, 'Finalizações do Jogador'],
  [/^goalkeeper\s+saves.*$/i, 'Defesas do Goleiro'],
  // Gols
  [/^goals?\s+over\s*\/?\s*under.*$/i, 'Mais/Menos Gols'],
  [/^both\s+teams\s+(to\s+)?score.*$/i, 'Ambas Marcam'],
  [/^home\s+team\s+total\s+goals.*$/i, 'Total de Gols da Casa'],
  [/^away\s+team\s+total\s+goals.*$/i, 'Total de Gols do Fora'],
  [/^total\s+goals.*$/i, 'Total de Gols'],
  [/^correct\s+score.*$/i, 'Placar Exato'],
  [/^exact\s+score.*$/i, 'Placar Exato'],
  [/^exact\s+goals.*$/i, 'Gols Exatos'],
  [/^over\s*\/?\s*under.*$/i, 'Mais/Menos'],
  // Principais
  [/^match\s+winner.*$/i, 'Vencedor da Partida'],
  [/^full\s+time\s+result.*$/i, 'Resultado Final'],
  [/^first\s+half\s+winner.*$/i, 'Vencedor do 1º Tempo'],
  [/^second\s+half\s+winner.*$/i, 'Vencedor do 2º Tempo'],
  [/^double\s+chance.*$/i, 'Dupla Chance'],
  [/^asian\s+handicap.*$/i, 'Handicap Asiático'],
  [/^handicap.*$/i, 'Handicap'],
  [/^odd\s*\/?\s*even.*$/i, 'Ímpar/Par'],
  [/^home\s*\/?\s*away.*$/i, 'Casa/Fora'],
  [/^1x2.*$/i, 'Vencedor da Partida'],
];

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

// Detects half-period suffix like "(1st Half)", "(2nd Half)", "1st Half", etc.
function extractHalfSuffix(raw: string): { stripped: string; suffix: string } {
  const re = /\s*\(?\s*(1st|first|2nd|second)\s+half\s*\)?\s*$/i;
  const m = raw.match(re);
  if (!m) return { stripped: raw, suffix: '' };
  const which = m[1].toLowerCase();
  const isFirst = which === '1st' || which === 'first';
  return {
    stripped: raw.slice(0, m.index).trim(),
    suffix: isFirst ? ' (1º Tempo)' : ' (2º Tempo)',
  };
}

export function translateMarketName(name?: string | null): string {
  if (!name) return name ?? '';
  const raw = String(name);
  if (!raw.trim()) return raw;

  // Preserve half-period info so users distinguish full-match vs half markets.
  const { stripped, suffix } = extractHalfSuffix(raw.trim());
  const target = stripped || raw.trim();
  const key = norm(target);

  const exact = EXACT[key];
  if (exact) return exact + suffix;
  for (const [re, rep] of REGEX_RULES) {
    if (re.test(target)) return rep + suffix;
  }
  return target + suffix;
}
