import { useEffect, useMemo, useRef, useState } from "react";
import { Coins, History, Info, X } from "lucide-react";
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

// Pilha de prêmios espalhados na "caçamba"
interface PileItem {
  prize: ClawPrize;
  // posição relativa em % dentro da caçamba
  x: number; // 0..100
  y: number; // 0..100 (0 = topo da pilha)
  rot: number;
  size: number; // em px
  z: number;
  taken: boolean;
}

function buildPile(): PileItem[] {
  const items: PileItem[] = [];
  // 28 bolinhas distribuídas em camadas, dando aparência de monte
  const layers = [
    { y: 78, count: 9, size: 78 }, // base
    { y: 60, count: 8, size: 74 },
    { y: 42, count: 6, size: 70 },
    { y: 26, count: 4, size: 66 },
    { y: 12, count: 1, size: 64 }, // topo
  ];
  let z = 0;
  layers.forEach((layer) => {
    for (let i = 0; i < layer.count; i++) {
      const pad = 8;
      const span = 100 - pad * 2;
      const x = pad + (span / Math.max(1, layer.count - 1 || 1)) * i + (Math.random() * 4 - 2);
      const prize = DEFAULT_PRIZES[Math.floor(Math.random() * DEFAULT_PRIZES.length)];
      items.push({
        prize,
        x: layer.count === 1 ? 50 + (Math.random() * 6 - 3) : x,
        y: layer.y + (Math.random() * 4 - 2),
        rot: Math.random() * 30 - 15,
        size: layer.size + Math.floor(Math.random() * 6 - 3),
        z: z++,
        taken: false,
      });
    }
  });
  return items;
}

export default function ClawMachine() {
  const [balance, setBalanceState] = useState<number>(0);
  const [pile, setPile] = useState<PileItem[]>(() => buildPile());
  // posição da garra em % horizontal (10..90)
  const [clawX, setClawX] = useState(50);
  const [clawY, setClawY] = useState(0); // 0 topo, 100 fundo do interior
  const [phase, setPhase] = useState<Phase>("idle");
  const [grabbedId, setGrabbedId] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<{ won: boolean; prize: ClawPrize } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [history, setHistory] = useState<ClawAttempt[]>([]);
  const [shake, setShake] = useState(false);
  const joystickRef = useRef<HTMLDivElement>(null);
  const [knobOffset, setKnobOffset] = useState(0); // -1, 0, 1

  useEffect(() => {
    setBalanceState(getBalance());
    setHistory(getHistory());
  }, []);

  const canPlay = phase === "idle" && balance >= CLAW_COST_PER_TRY;

  const moveBy = (dir: -1 | 1) => {
    if (phase !== "idle") return;
    setKnobOffset(dir);
    setClawX((x) => Math.min(88, Math.max(12, x + dir * 14)));
    setTimeout(() => setKnobOffset(0), 220);
  };

  // joystick com hold contínuo
  const holdRef = useRef<number | null>(null);
  const startHold = (dir: -1 | 1) => {
    moveBy(dir);
    holdRef.current = window.setInterval(() => moveBy(dir), 260) as unknown as number;
  };
  const endHold = () => {
    if (holdRef.current) {
      clearInterval(holdRef.current);
      holdRef.current = null;
    }
    setKnobOffset(0);
  };

  // escolhe o prêmio "abaixo" da garra: o mais próximo no eixo x dentro de uma janela
  const pickTarget = (): PileItem | null => {
    const candidates = pile
      .filter((p) => !p.taken)
      .map((p) => ({ p, dx: Math.abs(p.x - clawX) }))
      .sort((a, b) => a.dx - b.dx);
    return candidates[0]?.p ?? null;
  };

  const handleGrab = async () => {
    if (!canPlay) return;
    const target = pickTarget();
    if (!target) return;

    const newBalance = balance - CLAW_COST_PER_TRY;
    setBalance(newBalance);
    setBalanceState(newBalance);

    setPhase("descending");
    setClawY(82);
    await wait(900);

    setPhase("grabbing");
    const { won } = attemptCatch(target.prize);
    if (won) setGrabbedId(target.z);
    await wait(420);

    setPhase("ascending");
    setClawY(0);
    await wait(950);

    if (!won) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } else {
      setPile((prev) => prev.map((it) => (it.z === target.z ? { ...it, taken: true } : it)));
      if (target.prize.coinReward) {
        const credited = newBalance + target.prize.coinReward;
        setBalance(credited);
        setBalanceState(credited);
      }
    }

    const attempt: ClawAttempt = {
      id: crypto.randomUUID(),
      prizeId: target.prize.id,
      prizeName: target.prize.name,
      emoji: target.prize.emoji,
      rarity: target.prize.rarity,
      won,
      cost: CLAW_COST_PER_TRY,
      reward: won ? target.prize.coinReward ?? 0 : 0,
      at: Date.now(),
    };
    pushHistory(attempt);
    setHistory(getHistory());

    setLastResult({ won, prize: target.prize });
    setPhase("result");
    setTimeout(() => setGrabbedId(null), 1400);
  };

  const closeResult = () => {
    setLastResult(null);
    setPhase("idle");
  };

  const grabbedItem = useMemo(
    () => (grabbedId !== null ? pile.find((p) => p.z === grabbedId) : null),
    [grabbedId, pile],
  );

  return (
    <div className="min-h-[100dvh] w-full overflow-hidden relative select-none"
      style={{
        background:
          "radial-gradient(ellipse at 50% 35%, #a855f7 0%, #6b21a8 38%, #2e0a52 70%, #15052b 100%)",
      }}
    >
      {/* HUD topo */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 pt-4">
        <button
          onClick={() => setShowInfo(true)}
          className="w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white/90 border border-white/10"
          aria-label="Info"
        >
          <Info className="w-5 h-5" />
        </button>

        <div
          className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-b from-amber-100 to-amber-300 text-amber-900 shadow-lg border border-amber-200"
        >
          <Coins className="w-4 h-4" />
          <div className="leading-tight text-center">
            <div className="text-[9px] font-bold uppercase tracking-widest opacity-70">Saldo</div>
            <div className="font-mono font-extrabold text-base tabular-nums">{balance}</div>
          </div>
        </div>

        <button
          onClick={() => setShowHistory(true)}
          className="w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white/90 border border-white/10"
          aria-label="Histórico"
        >
          <History className="w-5 h-5" />
        </button>
      </div>

      {/* Cena da máquina (tela cheia) */}
      <div className={`relative w-full h-[100dvh] ${shake ? "animate-[clawshake_0.5s_ease-in-out]" : ""}`}>
        {/* Brilho ambiente do interior */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-[55%] rounded-full bg-fuchsia-500/30 blur-3xl" />
        </div>

        {/* Cabo + garra */}
        <div
          className="absolute top-0 z-20 -translate-x-1/2 transition-[left] duration-300 ease-out"
          style={{ left: `${clawX}%` }}
        >
          {/* trilho de cabo (visual fino) */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -z-10" />
          <div
            className="mx-auto w-[3px] bg-gradient-to-b from-zinc-200 via-zinc-300 to-zinc-400 shadow-[0_0_8px_rgba(255,255,255,0.4)] transition-all duration-700 ease-in-out"
            style={{ height: `calc(${10 + clawY * 0.55}% + 60px)` }}
          />
          {/* Garra */}
          <div
            className="absolute left-1/2 -translate-x-1/2 transition-all duration-700 ease-in-out"
            style={{ top: `calc(${10 + clawY * 0.55}% + 60px)` }}
          >
            <Claw open={phase !== "grabbing" && phase !== "ascending"} />
            {/* item pego */}
            {grabbedItem && (
              <div
                className="absolute left-1/2 -translate-x-1/2 top-[60px] flex items-center justify-center rounded-full"
                style={{
                  width: grabbedItem.size,
                  height: grabbedItem.size,
                  background: `radial-gradient(circle at 35% 30%, #fff 0%, ${RARITY_META[grabbedItem.prize.rarity].color} 55%, #1a1a1a 100%)`,
                  boxShadow: `0 0 22px ${RARITY_META[grabbedItem.prize.rarity].glow}`,
                }}
              >
                <span style={{ fontSize: grabbedItem.size * 0.55 }}>{grabbedItem.prize.emoji}</span>
              </div>
            )}
          </div>
        </div>

        {/* Paredes neon do interior (canto inferior, dando profundidade) */}
        <div className="absolute left-0 right-0 bottom-[210px] h-[44%] z-0 pointer-events-none">
          {/* parede de fundo escura com glow neon roxo nas bordas */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.55) 35%, rgba(0,0,0,0.85) 100%)",
            }}
          />
          {/* trilhos neon laterais */}
          <div className="absolute left-3 top-2 bottom-0 w-[6px] rounded-full bg-fuchsia-400 shadow-[0_0_18px_6px_rgba(232,121,249,0.7)]" />
          <div className="absolute right-3 top-2 bottom-0 w-[6px] rounded-full bg-fuchsia-400 shadow-[0_0_18px_6px_rgba(232,121,249,0.7)]" />
          {/* trilho neon do topo da caçamba */}
          <div className="absolute left-3 right-3 top-2 h-[5px] rounded-full bg-fuchsia-300 shadow-[0_0_16px_5px_rgba(240,171,252,0.8)]" />
        </div>

        {/* Pilha de prêmios */}
        <div className="absolute left-0 right-0 bottom-[210px] h-[44%] z-10 px-4">
          <div className="relative w-full h-full">
            {pile.map((it) => {
              if (it.taken) return null;
              const meta = RARITY_META[it.prize.rarity];
              return (
                <div
                  key={it.z}
                  className="absolute rounded-full flex items-center justify-center transition-opacity"
                  style={{
                    width: it.size,
                    height: it.size,
                    left: `calc(${it.x}% - ${it.size / 2}px)`,
                    bottom: `calc(${100 - it.y}% - ${it.size / 2}px)`,
                    transform: `rotate(${it.rot}deg)`,
                    zIndex: it.z,
                    background: `radial-gradient(circle at 35% 30%, #ffffff 0%, ${meta.color} 45%, #0a0a0a 100%)`,
                    boxShadow: `0 8px 14px rgba(0,0,0,0.5), inset -6px -10px 16px rgba(0,0,0,0.45), 0 0 18px ${meta.glow}`,
                    border: "2px solid rgba(255,255,255,0.18)",
                  }}
                >
                  <span style={{ fontSize: it.size * 0.5 }} className="drop-shadow">
                    {it.prize.emoji}
                  </span>
                </div>
              );
            })}
            {/* chão / sombra */}
            <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-black/80 to-transparent" />
          </div>
        </div>

        {/* PAINEL DE CONTROLE */}
        <div className="absolute bottom-0 left-0 right-0 z-30">
          {/* tampo metálico */}
          <div className="h-3 bg-gradient-to-b from-zinc-700 to-zinc-900" />
          <div
            className="relative h-[200px] px-6 flex items-center justify-around"
            style={{
              background:
                "linear-gradient(to bottom, #1a1a1a 0%, #050505 60%, #000 100%)",
              boxShadow: "inset 0 2px 0 rgba(255,255,255,0.06)",
            }}
          >
            {/* Joystick */}
            <div className="relative flex flex-col items-center">
              <div
                ref={joystickRef}
                className="relative w-[150px] h-[110px] rounded-full flex items-center justify-center"
                style={{
                  background:
                    "radial-gradient(circle at 50% 60%, #1a1a1a 0%, #000 70%)",
                  boxShadow: "inset 0 4px 12px rgba(0,0,0,0.8), 0 4px 10px rgba(0,0,0,0.6)",
                }}
              >
                {/* base do joystick */}
                <div className="absolute w-[110px] h-[28px] rounded-[50%] bg-black/70 top-[58%]" />
                {/* haste */}
                <div
                  className="absolute bottom-[40px] transition-transform duration-200 origin-bottom"
                  style={{ transform: `translateX(${knobOffset * 14}px) rotate(${knobOffset * 12}deg)` }}
                >
                  <div className="w-[10px] h-[60px] mx-auto bg-gradient-to-b from-fuchsia-300 to-fuchsia-500 rounded-full shadow-[0_0_10px_rgba(232,121,249,0.6)]" />
                  {/* esfera */}
                  <div
                    className="w-[44px] h-[44px] rounded-full -mt-3 mx-auto"
                    style={{
                      background:
                        "radial-gradient(circle at 35% 30%, #fff 0%, #f0abfc 35%, #c026d3 80%)",
                      boxShadow:
                        "0 4px 10px rgba(0,0,0,0.6), inset -4px -6px 10px rgba(0,0,0,0.35), 0 0 20px rgba(232,121,249,0.55)",
                    }}
                  />
                </div>
                {/* zonas de clique invisíveis (esq/dir) */}
                <button
                  className="absolute left-0 top-0 bottom-0 w-1/2"
                  onMouseDown={() => startHold(-1)}
                  onMouseUp={endHold}
                  onMouseLeave={endHold}
                  onTouchStart={(e) => { e.preventDefault(); startHold(-1); }}
                  onTouchEnd={endHold}
                  aria-label="Esquerda"
                  disabled={phase !== "idle"}
                />
                <button
                  className="absolute right-0 top-0 bottom-0 w-1/2"
                  onMouseDown={() => startHold(1)}
                  onMouseUp={endHold}
                  onMouseLeave={endHold}
                  onTouchStart={(e) => { e.preventDefault(); startHold(1); }}
                  onTouchEnd={endHold}
                  aria-label="Direita"
                  disabled={phase !== "idle"}
                />
              </div>
              <div className="mt-2 text-[10px] uppercase tracking-[0.3em] text-fuchsia-300/70">Mover</div>
            </div>

            {/* Botão PEGAR */}
            <div className="flex flex-col items-center">
              <button
                onClick={handleGrab}
                disabled={!canPlay}
                className="relative w-[110px] h-[110px] rounded-full active:translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed transition-transform"
                style={{
                  background:
                    "radial-gradient(circle at 35% 30%, #ffffff 0%, #f5d0fe 18%, #e879f9 55%, #a21caf 100%)",
                  boxShadow:
                    "0 10px 0 #4a044e, 0 14px 24px rgba(0,0,0,0.7), inset -6px -10px 18px rgba(0,0,0,0.35), 0 0 30px rgba(232,121,249,0.55)",
                }}
              >
                <span
                  className="absolute inset-0 flex items-center justify-center font-black tracking-widest text-white"
                  style={{ textShadow: "0 2px 0 rgba(0,0,0,0.45)" }}
                >
                  PEGAR
                </span>
              </button>
              <div className="mt-2 text-[10px] uppercase tracking-[0.3em] text-fuchsia-300/70">
                {CLAW_COST_PER_TRY} coins
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de resultado */}
      {lastResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
          onClick={closeResult}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-3xl p-6 text-center animate-scale-in border bg-gradient-to-b from-zinc-900 to-black"
            style={{
              borderColor: lastResult.won ? RARITY_META[lastResult.prize.rarity].color : "#ef4444",
              boxShadow: `0 0 50px ${
                lastResult.won ? RARITY_META[lastResult.prize.rarity].glow : "rgba(239,68,68,0.45)"
              }`,
            }}
          >
            <button
              onClick={closeResult}
              className="absolute top-3 right-3 p-1 rounded-md hover:bg-white/10 text-white"
            >
              <X className="w-4 h-4" />
            </button>
            {lastResult.won ? (
              <>
                <div className="text-7xl mb-2 animate-bounce">{lastResult.prize.emoji}</div>
                <div
                  className="font-black text-2xl tracking-widest text-white"
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
                <div className="text-7xl mb-2">😵</div>
                <div className="font-black text-2xl tracking-widest text-red-400">ESCAPOU!</div>
                <div className="mt-1 text-white/70 text-sm">
                  A garra não conseguiu segurar {lastResult.prize.name}. Tente de novo!
                </div>
              </>
            )}
            <button
              onClick={closeResult}
              className="mt-5 w-full py-3 rounded-2xl font-extrabold tracking-widest text-white"
              style={{
                background:
                  "radial-gradient(circle at 35% 30%, #f5d0fe 0%, #e879f9 45%, #a21caf 100%)",
                boxShadow: "0 6px 0 #4a044e, 0 0 20px rgba(232,121,249,0.55)",
              }}
            >
              CONTINUAR
            </button>
          </div>
        </div>
      )}

      {/* Drawer Histórico */}
      {showHistory && (
        <Sheet title="HISTÓRICO" onClose={() => setShowHistory(false)}>
          {history.length === 0 && (
            <div className="text-center text-white/50 text-sm py-10">Nenhuma tentativa ainda.</div>
          )}
          <div className="space-y-2">
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
                    <div className="text-sm font-semibold truncate text-white">{h.prizeName}</div>
                    <div className="text-[11px] uppercase tracking-wider" style={{ color: m.color }}>
                      {m.label}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs font-bold ${h.won ? "text-emerald-300" : "text-red-300"}`}>
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
        </Sheet>
      )}

      {showInfo && (
        <Sheet title="COMO JOGAR" onClose={() => setShowInfo(false)}>
          <div className="space-y-3 text-sm text-white/85 leading-relaxed">
            <p>Use o <b>joystick</b> (esquerda/direita) para posicionar a garra sobre a pilha.</p>
            <p>Pressione <b>PEGAR</b>. A garra desce e tenta capturar a esfera mais próxima.</p>
            <p>A chance de sucesso depende da <b>raridade</b> do prêmio. Quanto mais raro, mais difícil.</p>
            <div className="grid grid-cols-2 gap-2 pt-2">
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
                  </div>
                );
              })}
            </div>
          </div>
        </Sheet>
      )}

      <style>{`
        @keyframes clawshake {
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

function wait(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function Claw({ open }: { open: boolean }) {
  // garra metálica em SVG
  return (
    <svg width="92" height="84" viewBox="0 0 92 84" className="drop-shadow-[0_6px_10px_rgba(0,0,0,0.6)]">
      <defs>
        <linearGradient id="metal" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#f4f4f5" />
          <stop offset="45%" stopColor="#a1a1aa" />
          <stop offset="100%" stopColor="#3f3f46" />
        </linearGradient>
      </defs>
      {/* topo / pivot */}
      <rect x="36" y="0" width="20" height="14" rx="3" fill="url(#metal)" stroke="#27272a" />
      <rect x="30" y="12" width="32" height="10" rx="2" fill="url(#metal)" stroke="#27272a" />
      {/* dedos da garra */}
      <g style={{ transformOrigin: "46px 22px", transition: "transform 250ms", transform: open ? "scaleX(1.15)" : "scaleX(0.7)" }}>
        <path
          d="M 22 22 Q 18 50 36 70 L 42 64 Q 30 50 32 28 Z"
          fill="url(#metal)"
          stroke="#27272a"
          strokeWidth="1.5"
        />
        <path
          d="M 70 22 Q 74 50 56 70 L 50 64 Q 62 50 60 28 Z"
          fill="url(#metal)"
          stroke="#27272a"
          strokeWidth="1.5"
        />
        {/* dedo central */}
        <path
          d="M 42 22 L 50 22 L 50 60 L 46 66 L 42 60 Z"
          fill="url(#metal)"
          stroke="#27272a"
          strokeWidth="1.2"
        />
      </g>
    </svg>
  );
}

interface SheetProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}
function Sheet({ title, onClose, children }: SheetProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[80vh] rounded-t-3xl sm:rounded-3xl border border-fuchsia-400/40 bg-gradient-to-b from-zinc-900 to-black overflow-hidden flex flex-col"
        style={{ boxShadow: "0 0 30px rgba(217,70,239,0.4)" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="font-bold tracking-widest text-fuchsia-200">{title}</div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-white/10 text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
