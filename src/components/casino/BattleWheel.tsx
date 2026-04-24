import { useEffect, useMemo, useRef, useState } from 'react';
import type { BattleConfig, BattleParticipant } from './battleTypes';

interface Props {
  config: BattleConfig;
  onWinner?: (p: BattleParticipant) => void;
}

const TAU = Math.PI * 2;

export default function BattleWheel({ config, onWinner }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rotation, setRotation] = useState(0); // radians
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<BattleParticipant | null>(null);

  const participants = config.participants ?? [];
  const segCount = participants.length;

  const segments = useMemo(() => {
    const palette = config.segmentPalette.length > 0 ? config.segmentPalette : ['#1a1a3e'];
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
    const ringW = Math.max(8, size * 0.04);
    const innerR = outerR - ringW;

    // Outer ring
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, TAU);
    ctx.fillStyle = config.wheelOuterRingColor;
    ctx.fill();

    // LEDs
    const ledCount = 32;
    const ledR = Math.max(2, config.wheelLedSize);
    for (let i = 0; i < ledCount; i++) {
      const a = (i / ledCount) * TAU;
      const lx = cx + Math.cos(a) * (outerR - ringW / 2);
      const ly = cy + Math.sin(a) * (outerR - ringW / 2);
      ctx.beginPath();
      ctx.arc(lx, ly, ledR, 0, TAU);
      ctx.fillStyle = config.wheelLedColor;
      ctx.fill();
    }

    // Segments
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);

    if (segCount === 0) {
      ctx.beginPath();
      ctx.arc(0, 0, innerR, 0, TAU);
      ctx.fillStyle = '#222';
      ctx.fill();
      ctx.fillStyle = '#888';
      ctx.font = `${Math.max(12, size * 0.04)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Adicione participantes', 0, 0);
    } else {
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
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(start) * innerR, Math.sin(start) * innerR);
        ctx.lineWidth = config.wheelDividerWidth;
        ctx.strokeStyle = config.wheelDividerColor;
        ctx.stroke();

        // Label
        ctx.save();
        ctx.rotate(start + segAngle / 2);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = config.segmentTextColor;
        ctx.font = `bold ${config.segmentFontSize}px sans-serif`;
        const text = seg.participant.name.length > 16 ? seg.participant.name.slice(0, 15) + '…' : seg.participant.name;
        ctx.fillText(text, innerR - 12, 0);
        ctx.restore();
      });
    }

    ctx.restore();

    // Center cap
    const capR = innerR * 0.12;
    ctx.beginPath();
    ctx.arc(cx, cy, capR, 0, TAU);
    ctx.fillStyle = config.wheelCenterCapColor;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = config.wheelGlowColor;
    ctx.stroke();
  }, [rotation, segments, segCount, config]);

  const handleSpin = () => {
    if (spinning || segCount === 0) return;
    setWinner(null);
    setSpinning(true);

    // Weighted pick
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
    // Pointer is at top (angle = -PI/2). Bring targetCenter to that position.
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
      <div className="relative w-full max-w-[480px] aspect-square">
        {/* Pointer */}
        <div
          className="absolute left-1/2 -top-2 -translate-x-1/2 z-10"
          style={{
            width: 0,
            height: 0,
            borderLeft: '14px solid transparent',
            borderRight: '14px solid transparent',
            borderTop: `28px solid ${config.wheelPointerColor}`,
            filter: `drop-shadow(0 0 6px ${config.wheelGlowColor})`,
          }}
        />
        <canvas ref={canvasRef} className="w-full h-full rounded-full" style={{ boxShadow: `0 0 40px ${config.wheelGlowColor}55` }} />
      </div>

      <button
        onClick={handleSpin}
        disabled={spinning || segCount === 0}
        className="font-bold transition-transform active:scale-95 disabled:opacity-50"
        style={{
          backgroundColor: config.buttonColor,
          color: config.buttonTextColor,
          fontSize: config.buttonFontSize,
          borderRadius: config.buttonBorderRadius,
          padding: '12px 32px',
          boxShadow: `0 4px 20px ${config.buttonColor}55`,
        }}
      >
        {spinning ? '...' : config.buttonText}
      </button>

      {winner && (
        <div
          className="mt-4 px-6 py-4 text-center font-bold animate-in fade-in slide-in-from-bottom-2"
          style={{
            backgroundColor: config.resultBoxColor,
            color: config.resultTextColor,
            border: `2px solid ${config.resultBorderColor}`,
            borderRadius: 12,
            minWidth: 240,
          }}
        >
          <div className="text-sm opacity-80 mb-1">{config.resultTitle}</div>
          <div className="text-2xl">{winner.name}</div>
        </div>
      )}
    </div>
  );
}
