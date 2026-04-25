import { useEffect, useMemo, useRef, useState } from 'react';
import type { BattleConfig, BattleParticipant } from './battleTypes';

interface Props {
  config: BattleConfig;
  participants: BattleParticipant[];
  onWinner?: (p: BattleParticipant) => void;
}

const TAU = Math.PI * 2;

export default function BattleWheel({ config, participants, onWinner }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rotation, setRotation] = useState(0); // radians
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<BattleParticipant | null>(null);

  const segCount = participants.length;

  // Shuffle the visual order of segments so the layout doesn't reflect arrival
  // order. Recomputed whenever the participant set changes (by id signature).
  const segments = useMemo(() => {
    const palette = config.segmentPalette.length > 0 ? config.segmentPalette : ['#11161C'];
    const indices = participants.map((_, i) => i);
    // Fisher-Yates shuffle
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices.map((origIdx, displayIdx) => ({
      participant: participants[origIdx],
      color: palette[displayIdx % palette.length],
      originalIndex: origIdx,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants.map((p) => p.id).join('|'), config.segmentPalette]);

  // Draw the wheel
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = canvas.clientWidth;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;
    const outerR = size / 2 - 4;
    const ringW = Math.max(6, size * 0.025);
    const innerR = outerR - ringW;

    // Subtle outer ring with soft inner shadow look
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, TAU);
    ctx.fillStyle = config.wheelOuterRingColor;
    ctx.fill();

    // Inner disc
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, TAU);
    ctx.fillStyle = config.wheelInnerColor;
    ctx.fill();

    // Segments
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);

    if (segCount > 0) {
      const segAngle = TAU / segCount;
      segments.forEach((seg, i) => {
        const start = i * segAngle;
        const end = start + segAngle;

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, innerR, start, end);
        ctx.closePath();
        ctx.fillStyle = seg.color;
        ctx.fill();

        // Divider
        if (config.wheelDividerWidth > 0) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(start) * innerR, Math.sin(start) * innerR);
          ctx.lineWidth = config.wheelDividerWidth;
          ctx.strokeStyle = config.wheelDividerColor;
          ctx.stroke();
        }

        // Label
        ctx.save();
        ctx.rotate(start + segAngle / 2);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = config.segmentTextColor;
        ctx.font = `600 ${config.segmentFontSize}px ui-sans-serif, system-ui, sans-serif`;
        const text = seg.participant.name.length > 18 ? seg.participant.name.slice(0, 17) + '…' : seg.participant.name;
        ctx.fillText(text, innerR - 18, 0);
        ctx.restore();
      });
    }

    ctx.restore();
  }, [rotation, segments, segCount, config]);

  const handleSpin = () => {
    if (spinning || segCount === 0) return;
    setWinner(null);
    setSpinning(true);

    // Pick a random segment index (uniform). Weights kept for compatibility.
    const weights = segments.map((s) => Math.max(1, s.participant.weight ?? 1));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    let pickIdx = 0;
    for (let i = 0; i < weights.length; i++) {
      if (r < weights[i]) {
        pickIdx = i;
        break;
      }
      r -= weights[i];
    }

    const segAngle = TAU / segCount;
    const targetCenter = pickIdx * segAngle + segAngle / 2;
    const baseTurns = 6 + Math.floor(Math.random() * 3);

    // Normalize current rotation and compute a forward-only delta so spin
    // duration feels constant regardless of participant count or prior spins.
    const startRot = rotation;
    const currentMod = ((startRot % TAU) + TAU) % TAU;
    const targetMod = ((-Math.PI / 2 - targetCenter) % TAU + TAU) % TAU;
    let delta = targetMod - currentMod;
    if (delta <= 0) delta += TAU;
    const finalRotation = startRot + baseTurns * TAU + delta;

    const start = performance.now();
    const duration = 5000;

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = easeOutCubic(t);
      const next = startRot + (finalRotation - startRot) * eased;
      setRotation(next);
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        setSpinning(false);
        const w = segments[pickIdx].participant;
        setWinner(w);
        onWinner?.(w);
      }
    };
    requestAnimationFrame(tick);
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <div className="relative w-full max-w-[560px] aspect-square">
        {/* Pointer (top) */}
        <div
          className="absolute left-1/2 -top-2 -translate-x-1/2 z-10"
          style={{
            filter: `drop-shadow(0 4px 6px rgba(0,0,0,0.55)) drop-shadow(0 0 10px ${config.wheelGlowColor}cc)`,
          }}
        >
          <svg width="34" height="44" viewBox="0 0 34 44" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="battle-pointer-grad" x1="17" y1="2" x2="17" y2="42" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor={config.wheelPointerColor} stopOpacity="1" />
                <stop offset="55%" stopColor={config.wheelPointerColor} stopOpacity="0.95" />
                <stop offset="100%" stopColor={config.wheelPointerColor} stopOpacity="0.7" />
              </linearGradient>
              <linearGradient id="battle-pointer-shine" x1="17" y1="3" x2="17" y2="22" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Body: rounded teardrop pointing down */}
            <path
              d="M17 42 C 7 30, 2 22, 2 14 A 15 15 0 0 1 32 14 C 32 22, 27 30, 17 42 Z"
              fill="url(#battle-pointer-grad)"
              stroke="rgba(0,0,0,0.35)"
              strokeWidth="1"
              strokeLinejoin="round"
            />
            {/* Glossy highlight */}
            <path
              d="M17 38 C 9 28, 5 21, 5 14 A 12 12 0 0 1 29 14 C 29 21, 25 28, 17 38 Z"
              fill="url(#battle-pointer-shine)"
              opacity="0.9"
            />
            {/* Inner dot */}
            <circle cx="17" cy="14" r="3.2" fill="rgba(255,255,255,0.85)" />
          </svg>
        </div>


        <canvas
          ref={canvasRef}
          className="w-full h-full rounded-full"
          style={{
            boxShadow: `inset 0 0 60px rgba(0,0,0,0.6), 0 0 60px ${config.wheelGlowColor}11`,
          }}
        />

        {/* Center SPIN button */}
        <button
          onClick={handleSpin}
          disabled={spinning || segCount === 0}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full font-extrabold tracking-widest transition-all active:scale-95 disabled:opacity-60 overflow-hidden flex items-center justify-center"
          style={{
            width: '22%',
            aspectRatio: '1 / 1',
            backgroundColor: config.wheelCenterButtonColor,
            color: config.wheelCenterButtonTextColor,
            border: `2px solid ${config.wheelGlowColor}`,
            boxShadow: `0 0 24px ${config.wheelGlowColor}55, inset 0 0 20px ${config.wheelGlowColor}22`,
            fontSize: 'clamp(12px, 2vw, 18px)',
            padding: 0,
          }}
        >
          {config.wheelCenterButtonImageUrl ? (
            <img
              src={config.wheelCenterButtonImageUrl}
              alt={config.wheelCenterButtonText || 'SPIN'}
              className="w-full h-full object-cover rounded-full"
              draggable={false}
            />
          ) : (
            spinning ? '...' : config.wheelCenterButtonText
          )}
        </button>
      </div>


      {/* FULLSCREEN WINNER ANNOUNCEMENT */}
      {winner && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-6 animate-in fade-in duration-300"
          style={{
            backgroundColor: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(8px)',
          }}
          onClick={() => setWinner(null)}
        >
          {/* Glow orbs */}
          <div
            className="absolute top-1/3 left-1/4 w-[400px] h-[400px] rounded-full blur-[120px] opacity-40 pointer-events-none animate-pulse"
            style={{ backgroundColor: config.resultBorderColor }}
          />
          <div
            className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] rounded-full blur-[120px] opacity-30 pointer-events-none animate-pulse"
            style={{ backgroundColor: config.headerAccentColor, animationDelay: '0.5s' }}
          />

          <div
            className="relative w-full max-w-md text-center font-bold animate-in zoom-in-50 slide-in-from-bottom-4 duration-500"
            style={{
              backgroundColor: config.resultBoxColor,
              color: config.resultTextColor,
              border: `2px solid ${config.resultBorderColor}`,
              borderRadius: 18,
              padding: 'clamp(18px, 3vw, 32px) clamp(16px, 2.5vw, 28px)',
              boxShadow: `0 0 40px ${config.resultBorderColor}55, 0 0 80px ${config.resultBorderColor}22, inset 0 0 30px ${config.resultBorderColor}11`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="font-semibold opacity-80 mb-3"
              style={{
                fontSize: 'clamp(10px, 1.1vw, 13px)',
                letterSpacing: '0.4em',
                color: config.headerAccentColor,
              }}
            >
              🏆 {config.resultTitle} 🏆
            </div>

            <div
              className="font-black leading-[1.05] mb-2 break-words px-2"
              style={{
                fontSize: `clamp(20px, ${Math.max(18, 56 - winner.name.length * 1.6)}px, 48px)`,
                color: config.resultTextColor,
                textShadow: `0 0 24px ${config.resultBorderColor}aa, 0 0 48px ${config.resultBorderColor}55`,
                letterSpacing: '-0.02em',
                wordBreak: 'break-word',
                hyphens: 'auto',
              }}
            >
              {winner.name}
            </div>

            {winner.game && (
              <div
                className="font-semibold opacity-90 mt-1 break-words"
                style={{
                  fontSize: 'clamp(13px, 1.6vw, 18px)',
                  color: config.headerAccentColor,
                  letterSpacing: '0.05em',
                }}
              >
                {winner.game}
              </div>
            )}

            <button
              onClick={() => setWinner(null)}
              className="mt-5 font-bold tracking-[0.3em] transition-all active:scale-95 hover:brightness-125"
              style={{
                backgroundColor: 'transparent',
                color: config.resultBorderColor,
                fontSize: 'clamp(10px, 1vw, 12px)',
                borderRadius: 8,
                border: `1px solid ${config.resultBorderColor}`,
                padding: '8px 22px',
              }}
            >
              FECHAR
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
