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

  const segments = useMemo(() => {
    const palette = config.segmentPalette.length > 0 ? config.segmentPalette : ['#11161C'];
    return participants.map((p, i) => ({
      participant: p,
      color: palette[i % palette.length],
    }));
  }, [participants, config.segmentPalette]);

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

    const weights = participants.map((p) => Math.max(1, p.weight ?? 1));
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
    const finalRotation = baseTurns * TAU + (-Math.PI / 2 - targetCenter);

    const start = performance.now();
    const startRot = rotation;
    const duration = 5200;

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
        const w = participants[pickIdx];
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
          className="absolute left-1/2 top-1 -translate-x-1/2 z-10"
          style={{
            width: 0,
            height: 0,
            borderLeft: '10px solid transparent',
            borderRight: '10px solid transparent',
            borderTop: `18px solid ${config.wheelPointerColor}`,
            filter: `drop-shadow(0 0 8px ${config.wheelGlowColor}aa)`,
          }}
        />

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
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full font-extrabold tracking-widest transition-all active:scale-95 disabled:opacity-60"
          style={{
            width: '22%',
            aspectRatio: '1 / 1',
            backgroundColor: config.wheelCenterButtonColor,
            color: config.wheelCenterButtonTextColor,
            border: `2px solid ${config.wheelGlowColor}`,
            boxShadow: `0 0 24px ${config.wheelGlowColor}55, inset 0 0 20px ${config.wheelGlowColor}22`,
            fontSize: 'clamp(12px, 2vw, 18px)',
          }}
        >
          {spinning ? '...' : config.wheelCenterButtonText}
        </button>
      </div>

      {/* Secondary GIRAR button (matches reference) */}
      <button
        onClick={handleSpin}
        disabled={spinning || segCount === 0}
        className="font-semibold tracking-[0.4em] transition-all active:scale-95 disabled:opacity-50"
        style={{
          backgroundColor: config.buttonColor,
          color: config.buttonTextColor,
          fontSize: config.buttonFontSize,
          borderRadius: config.buttonBorderRadius,
          border: `1px solid ${config.buttonBorderColor}`,
          padding: '10px 48px',
          minWidth: 220,
        }}
      >
        {spinning ? '...' : config.buttonText}
      </button>

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
            className="relative w-full max-w-xl text-center font-bold animate-in zoom-in-50 slide-in-from-bottom-4 duration-500"
            style={{
              backgroundColor: config.resultBoxColor,
              color: config.resultTextColor,
              border: `2px solid ${config.resultBorderColor}`,
              borderRadius: 20,
              padding: 'clamp(24px, 4vw, 48px) clamp(20px, 3.5vw, 44px)',
              boxShadow: `0 0 60px ${config.resultBorderColor}55, 0 0 120px ${config.resultBorderColor}22, inset 0 0 40px ${config.resultBorderColor}11`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="font-semibold opacity-80 mb-4"
              style={{
                fontSize: 'clamp(12px, 1.4vw, 16px)',
                letterSpacing: '0.5em',
                color: config.headerAccentColor,
              }}
            >
              🏆 {config.resultTitle} 🏆
            </div>

            <div
              className="font-black leading-[1.05] mb-3 break-words"
              style={{
                fontSize: 'clamp(36px, 6.5vw, 72px)',
                color: config.resultTextColor,
                textShadow: `0 0 30px ${config.resultBorderColor}aa, 0 0 60px ${config.resultBorderColor}55`,
                letterSpacing: '-0.02em',
              }}
            >
              {winner.name}
            </div>

            {winner.game && (
              <div
                className="font-semibold opacity-90 mt-1"
                style={{
                  fontSize: 'clamp(16px, 2.4vw, 26px)',
                  color: config.headerAccentColor,
                  letterSpacing: '0.05em',
                }}
              >
                {winner.game}
              </div>
            )}

            <button
              onClick={() => setWinner(null)}
              className="mt-7 font-bold tracking-[0.4em] transition-all active:scale-95 hover:brightness-125"
              style={{
                backgroundColor: 'transparent',
                color: config.resultBorderColor,
                fontSize: 'clamp(11px, 1.2vw, 13px)',
                borderRadius: 8,
                border: `1px solid ${config.resultBorderColor}`,
                padding: '10px 28px',
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
