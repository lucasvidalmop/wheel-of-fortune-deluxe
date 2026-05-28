// Claw Machine — service layer
// Estrutura preparada para futura integração com banco de dados (Lovable Cloud).
// Hoje persiste localmente; troque as funções `*Remote` para chamadas Supabase
// quando quiser sincronizar saldo, prêmios e histórico.

export type Rarity = "common" | "rare" | "epic" | "legendary";

export interface ClawPrize {
  id: string;
  name: string;
  emoji: string;
  rarity: Rarity;
  /** chance base 0..1 de sucesso ao tentar pegar este item */
  successChance: number;
  /** valor simbólico em coins concedido ao ganhar (opcional) */
  coinReward?: number;
}

export interface ClawAttempt {
  id: string;
  prizeId: string;
  prizeName: string;
  emoji: string;
  rarity: Rarity;
  won: boolean;
  cost: number;
  reward: number;
  at: number;
}

export const RARITY_META: Record<Rarity, { label: string; color: string; glow: string }> = {
  common: { label: "Comum", color: "#5eead4", glow: "rgba(94,234,212,0.55)" },
  rare: { label: "Raro", color: "#60a5fa", glow: "rgba(96,165,250,0.6)" },
  epic: { label: "Épico", color: "#c084fc", glow: "rgba(192,132,252,0.65)" },
  legendary: { label: "Lendário", color: "#fbbf24", glow: "rgba(251,191,36,0.7)" },
};

export const DEFAULT_PRIZES: ClawPrize[] = [
  { id: "p1", name: "Pelúcia", emoji: "🧸", rarity: "common", successChance: 0.55, coinReward: 5 },
  { id: "p2", name: "Doce", emoji: "🍬", rarity: "common", successChance: 0.6, coinReward: 3 },
  { id: "p3", name: "Donut", emoji: "🍩", rarity: "common", successChance: 0.5, coinReward: 4 },
  { id: "p4", name: "Joystick", emoji: "🎮", rarity: "rare", successChance: 0.32, coinReward: 25 },
  { id: "p5", name: "Fone", emoji: "🎧", rarity: "rare", successChance: 0.3, coinReward: 30 },
  { id: "p6", name: "Robô", emoji: "🤖", rarity: "epic", successChance: 0.16, coinReward: 80 },
  { id: "p7", name: "Diamante", emoji: "💎", rarity: "epic", successChance: 0.14, coinReward: 100 },
  { id: "p8", name: "Coroa", emoji: "👑", rarity: "legendary", successChance: 0.06, coinReward: 300 },
  { id: "p9", name: "Troféu", emoji: "🏆", rarity: "legendary", successChance: 0.05, coinReward: 500 },
];

export const CLAW_COST_PER_TRY = 10;

const BALANCE_KEY = "claw_balance";
const HISTORY_KEY = "claw_history";

export function getBalance(): number {
  const v = Number(localStorage.getItem(BALANCE_KEY));
  if (Number.isFinite(v) && v > 0) return v;
  // saldo inicial de demonstração
  localStorage.setItem(BALANCE_KEY, "200");
  return 200;
}

export function setBalance(n: number) {
  localStorage.setItem(BALANCE_KEY, String(Math.max(0, Math.floor(n))));
}

export function getHistory(): ClawAttempt[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

export function pushHistory(a: ClawAttempt) {
  const list = [a, ...getHistory()].slice(0, 50);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
}

/** Resolve uma tentativa contra o prêmio escolhido. */
export function attemptCatch(prize: ClawPrize): { won: boolean; roll: number } {
  const roll = Math.random();
  return { won: roll < prize.successChance, roll };
}

/*
  Integração futura com banco de dados:
  - getBalanceRemote(userId): SELECT coins FROM wheel_users WHERE id = userId
  - debitRemote(userId, amount): UPDATE wheel_users SET coins = coins - amount ...
  - creditRemote(userId, amount): UPDATE wheel_users SET coins = coins + amount ...
  - logAttemptRemote(attempt): INSERT INTO claw_attempts (...)
  - listAttemptsRemote(userId): SELECT * FROM claw_attempts WHERE user_id = userId
*/
