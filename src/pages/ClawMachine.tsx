import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Coins, History, Sparkles, X } from "lucide-react";
import {
  CLAW_COST_PER_TRY,
  ClawAttempt,
  ClawPrize,
  DEFAULT_PRIZES,
  RARITY_META,
  attemptCatch,
  getBalance,
  getHistory,
  pushHistory,
  setBalance,
} from "@/lib/clawMachine";

type Phase = "idle" | "descending" | "grabbing" | "ascending" | "result";

const COLS = 3;
const ROWS = 3;

export default function ClawMachine() {
  const [balance, setBalanceState] = useState<number>(0);
  const [prizes] = useState<ClawPrize[]>(() => {
    // monta um grid 3x3 a partir do pool, embaralhando
    const pool = [...DEFAULT_PRIZES];
    const grid: ClawPrize[] = [];
    for (let i = 0; i < COLS * ROWS; i++) {
      grid.push(pool[i % pool.length]);
    }
    return grid.sort(() => Math.random() - 0.5);
  });
  const [clawCol, setClawCol] = useState(1);
  const [phase, setPhase] = useState<Phase>("idle");
  const [clawY, setClawY] = useState(0);
  const [grabbedIndex, setGrabbedIndex] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<{ won: boolean; prize: ClawPrize } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<ClawAttempt[]>([]);
  const [shake, setShake] = useState(false);
  const cabinetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setBalanceState(getBalance());
    setHistory(getHistory());
  }, []);

  const canPlay = phase === "idle" && balance >= CLAW_COST_PER_TRY;

  const moveLeft = () => phase === "idle" && setClawCol((c) => Math.max(0, c - 1));
  const moveRight = () => phase === "idle" && setClawCol((c) => Math.min(COLS - 1, c + 1));

  const handleGrab = async () => {
    if (!canPlay) return;
    // alvo: linha mais baixa da coluna; pega o último ainda presente
    const targetRow = ROWS - 1;
    const targetIndex = targetRow * COLS + clawCol;
    const prize = prizes[targetIndex];

    // debita
    const newBalance = balance - CLAW_COST_PER_TRY;
    setBalance(newBalance);
    setBalanceState(newBalance);

    setPhase("descending");
    setClawY(72); // % de descida

    await wait(900);
    setPhase("grabbing");
    const { won } = attemptCatch(prize);
    if (won) setGrabbedIndex(targetIndex);
    await wait(450);

    setPhase("ascending");
    setClawY(0);
    await wait(900);

    if (!won) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } else if (prize.coinReward) {
      const credited = newBalance + prize.coinReward;
      setBalance(credited);
      setBalanceState(credited);
    }

    const attempt: ClawAttempt = {
      id: crypto.randomUUID(),
      prizeId: prize.id,
      prizeName: prize.name,
      emoji: prize.emoji,
      rarity: prize.rarity,
      won,
      cost: CLAW_COST_PER_TRY,
      reward: won ? prize.coinReward ?? 0 : 0,
      at: Date.now(),
    };
    pushHistory(attempt);
    setHistory(getHistory());

    setLastResult({ won, prize });
    setPhase("result");
    setTimeout(() => setGrabbedIndex(null), 1200);
  };

  const closeResult = () => {
    setLastResult(null);
    setPhase("idle");
  };

  const colPercent = useMemo(() => {
    // posiciona a garra no centro da coluna
    const step = 100 / COLS;
    return step * clawCol + step / 2;
  }, [clawCol]);

  return (
    <div className="min-h-screen w-full bg-[#06030f] text-white overflow-hidden relative">
      {/* fundo neon */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-24 w-[420px] h-[420px] rounded-full bg-fuchsia-600/25 blur-[120px]" />
        <div className="absolute top-1/3 -right-32 w-[480px] h-[480px] rounded-full bg-cyan-500/25 blur-[120px]" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-purple-700/20 blur-[140px]" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-4 sm:px-8 py-5">
        <h1
          className="font-display font-black text-2xl sm:text-3xl tracking-widest"
          style={{ textShadow: "0 0 12px rgba(236,72,153,0.7), 0 0 28px rgba(168,85,247,0.5)" }}
        >
          CLAW <span className="text-cyan-300">ARCADE</span>
        </h1>
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl border border-yellow-300/40 bg-black/40"
            style={{ boxShadow: "0 0 18px rgba(250,204,21,0.25) inset, 0 0 18px rgba(250,204,21,0.25)" }}
          >
            <Coins className="w-4 h-4 text-yellow-300" />
            <span className="font-mono font-bold text-yellow-200 tabular-nums">{balance}</span>
            <span className="text-[10px] uppercase tracking-widest text-yellow-200/70">coins</span>
          </div>
          <button
            onClick={() => setShowHistory(true)}
            className="p-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 transition"
            aria-label="Histórico"
          >
            <History className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="relative z-10 px-4 sm:px-8 pb-10 flex flex-col items-center">
        {/* Gabinete da máquina */}
        <div
          ref={cabinetRef}
          className={`w-full max-w-md sm:max-w-lg transition-transform ${shake ? "animate-[shake_0.5s_ease-in-out]" : ""}`}
        >
          {/* topo / marquee */}
          <div
            className="rounded-t-3xl px-4 py-3 text-center border border-b-0 border-fuchsia-400/50 bg-gradient-to-b from-fuchsia-700/60 to-fuchsia-900/40"
            style={{ boxShadow: "0 0 28px rgba(217,70,239,0.45)" }}
          >
            <span className="font-display font-extrabold tracking-[0.4em] text-sm sm:text-base text-white">
              PRIZE ZONE
            </span>
          </div>

          {/* vitrine */}
          <div
            className="relative aspect-[4/5] border-x-4 border-fuchsia-400/60 bg-gradient-to-b from-cyan-500/10 via-indigo-600/10 to-purple-700/10 backdrop-blur-sm overflow-hidden"
            style={{ boxShadow: "inset 0 0 60px rgba(99,102,241,0.35), inset 0 0 120px rgba(217,70,239,0.2)" }}
          >
            {/* trilho horizontal */}
            <div className="absolute top-3 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-400/70 via-fuchsia-400/70 to-cyan-400/70 shadow-[0_0_12px_rgba(34,211,238,0.7)]" />

            {/* garra */}
            <div
              className="absolute top-0 transition-all duration-700 ease-in-out -translate-x-1/2 z-20"
              style={{ left: `${colPercent}%`, top: `${clawY}%` }}
            >
              {/* cabo */}
              <div className="mx-auto w-1 bg-gradient-to-b from-zinc-300 to-zinc-500 h-10" />
              <Claw open={phase !== "grabbing"} />
              {/* item agarrado */}
              {grabbedIndex !== null && (
                <div className="absolute left-1/2 -translate-x-1/2 top-16 text-3xl drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                  {prizes[grabbedIndex].emoji}
                </div>
              )}
            </div>

            {/* grid de prêmios */}
            <div
              className="absolute inset-x-0 bottom-0 grid gap-2 p-3 sm:p-4"
              style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0,1fr))`, height: "62%" }}
            >
              {prizes.map((p, idx) => {
                const meta = RARITY_META[p.rarity];
                const gone = grabbedIndex === idx && phase !== "ascending";
                return (
                  <div
                    key={idx}
                    className="relative rounded-xl border flex items-center justify-center transition-all"
                    style={{
                      borderColor: meta.color + "66",
                      background: `radial-gradient(circle at 50% 30%, ${meta.glow}, transparent 70%)`,
                      boxShadow: `0 0 14px ${meta.glow}`,
                      opacity: gone ? 0 : 1,
                      transform: gone ? "scale(0.4)" : "scale(1)",
                    }}
                  >
                    <span className="text-3xl sm:text-4xl select-none">{grabbedIndex === idx && phase === "ascending" ? "" : p.emoji}</span>
                    <span
                      className="absolute bottom-1 left-1 right-1 text-[9px] uppercase tracking-wider text-center truncate"
                      style={{ color: meta.color }}
                    >
                      {meta.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* abertura do prêmio (canto) */}
            <div className="absolute bottom-0 left-2 w-14 h-3 rounded-t-md bg-black/70 border border-fuchsia-300/40" />
          </div>

          {/* base com controles */}
          <div
            className="rounded-b-3xl border border-t-0 border-fuchsia-400/50 bg-gradient-to-b from-zinc-900 to-black p-4 sm:p-5"
            style={{ boxShadow: "0 0 28px rgba(217,70,239,0.35)" }}
          >
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={moveLeft}
                disabled={phase !== "idle"}
                className="flex-1 py-3 rounded-xl bg-cyan-500/15 border border-cyan-300/50 text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-95"
                style={{ boxShadow: "0 0 14px rgba(34,211,238,0.35)" }}
                aria-label="Esquerda"
              >
                <ArrowLeft className="w-5 h-5 mx-auto" />
              </button>
              <button
                onClick={handleGrab}
                disabled={!canPlay}
                className="flex-[2] py-3 rounded-xl font-display font-extrabold tracking-[0.3em] text-black bg-gradient-to-b from-yellow-300 to-amber-500 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition active:scale-95"
                style={{ boxShadow: "0 0 22px rgba(250,204,21,0.65)" }}
              >
                PEGAR
              </button>
              <button
                onClick={moveRight}
                disabled={phase !== "idle"}
                className="flex-1 py-3 rounded-xl bg-fuchsia-500/15 border border-fuchsia-300/50 text-fuchsia-200 hover:bg-fuchsia-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-95"
                style={{ boxShadow: "0 0 14px rgba(217,70,239,0.35)" }}
                aria-label="Direita"
              >
                <ArrowRight className="w-5 h-5 mx-auto" />
              </button>
            </div>
            <div className="mt-3 text-center text-xs text-white/60">
              Custo por tentativa:{" "}
              <span className="text-yellow-200 font-bold">{CLAW_COST_PER_TRY} coins</span>
            </div>
            {balance < CLAW_COST_PER_TRY && (
              <div className="mt-2 text-center text-xs text-red-300">
                Coins insuficientes para jogar.
              </div>
            )}
          </div>
        </div>

        {/* tabela de raridades */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2 w-full max-w-md sm:max-w-lg">
          {(Object.keys(RARITY_META) as (keyof typeof RARITY_META)[]).map((k) => {
            const m = RARITY_META[k];
            return (
              <div
                key={k}
                className="rounded-lg border px-3 py-2 text-xs flex items-center justify-between bg-black/40"
                style={{ borderColor: m.color + "55", boxShadow: `0 0 10px ${m.glow}` }}
              >
                <span style={{ color: m.color }} className="font-bold uppercase tracking-wider">
                  {m.label}
                </span>
                <Sparkles className="w-3 h-3" style={{ color: m.color }} />
              </div>
            );
          })}
        </div>
      </main>

      {/* Modal de resultado */}
      {lastResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
          onClick={closeResult}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-2xl p-6 text-center animate-scale-in border bg-gradient-to-b from-zinc-900 to-black"
            style={{
              borderColor: lastResult.won ? RARITY_META[lastResult.prize.rarity].color : "#ef4444",
              boxShadow: `0 0 40px ${
                lastResult.won ? RARITY_META[lastResult.prize.rarity].glow : "rgba(239,68,68,0.45)"
              }`,
            }}
          >
            <button
              onClick={closeResult}
              className="absolute top-3 right-3 p-1 rounded-md hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
            {lastResult.won ? (
              <>
                <div className="text-6xl mb-2 animate-bounce">{lastResult.prize.emoji}</div>
                <div
                  className="font-display font-black text-2xl tracking-widest"
                  style={{ color: RARITY_META[lastResult.prize.rarity].color }}
                >
                  VOCÊ GANHOU!
                </div>
                <div className="mt-1 text-white/80">{lastResult.prize.name}</div>
                {lastResult.prize.coinReward ? (
                  <div className="mt-3 inline-flex items-center gap-1 px-3 py-1 rounded-full border border-yellow-300/50 text-yellow-200 text-sm">
                    <Coins className="w-4 h-4" /> +{lastResult.prize.coinReward} coins
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <div className="text-6xl mb-2">😵</div>
                <div className="font-display font-black text-2xl tracking-widest text-red-400">
                  ESCAPOU!
                </div>
                <div className="mt-1 text-white/70 text-sm">
                  A garra não conseguiu segurar {lastResult.prize.name}. Tente de novo!
                </div>
              </>
            )}
            <button
              onClick={closeResult}
              className="mt-5 w-full py-3 rounded-xl font-display font-extrabold tracking-widest text-black bg-gradient-to-b from-yellow-300 to-amber-500 hover:brightness-110 active:scale-95 transition"
            >
              CONTINUAR
            </button>
          </div>
        </div>
      )}

      {/* Drawer de histórico */}
      {showHistory && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowHistory(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[80vh] rounded-t-2xl sm:rounded-2xl border border-fuchsia-400/40 bg-gradient-to-b from-zinc-900 to-black overflow-hidden flex flex-col"
            style={{ boxShadow: "0 0 30px rgba(217,70,239,0.4)" }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div className="font-display font-bold tracking-widest text-fuchsia-200">
                HISTÓRICO
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="p-1 rounded-md hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-3 space-y-2">
              {history.length === 0 && (
                <div className="text-center text-white/50 text-sm py-10">
                  Nenhuma tentativa ainda.
                </div>
              )}
              {history.map((h) => {
                const m = RARITY_META[h.rarity];
                return (
                  <div
                    key={h.id}
                    className="flex items-center gap-3 p-3 rounded-xl border bg-black/40"
                    style={{ borderColor: (h.won ? m.color : "#ef4444") + "55" }}
                  >
                    <div className="text-2xl">{h.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{h.prizeName}</div>
                      <div className="text-[11px] uppercase tracking-wider" style={{ color: m.color }}>
                        {m.label}
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-xs font-bold ${h.won ? "text-emerald-300" : "text-red-300"}`}
                      >
                        {h.won ? "GANHOU" : "PERDEU"}
                      </div>
                      <div className="text-[11px] text-white/50">
                        {h.won && h.reward > 0 ? `+${h.reward}` : `-${h.cost}`} coins
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}

function Claw({ open }: { open: boolean }) {
  return (
    <div className="relative w-16 h-16 mx-auto">
      {/* base da garra */}
      <div
        className="absolute left-1/2 -translate-x-1/2 top-0 w-10 h-3 rounded-md bg-gradient-to-b from-zinc-200 to-zinc-500"
        style={{ boxShadow: "0 0 10px rgba(255,255,255,0.4)" }}
      />
      {/* dedos */}
      <div
        className="absolute top-2 left-1/2 w-2 h-10 origin-top bg-gradient-to-b from-zinc-200 to-zinc-500 rounded-b-md transition-transform duration-300"
        style={{ transform: `translateX(-100%) rotate(${open ? -35 : -8}deg)` }}
      />
      <div
        className="absolute top-2 left-1/2 w-2 h-10 origin-top bg-gradient-to-b from-zinc-200 to-zinc-500 rounded-b-md transition-transform duration-300"
        style={{ transform: `translateX(0%) rotate(${open ? 35 : 8}deg)` }}
      />
    </div>
  );
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
