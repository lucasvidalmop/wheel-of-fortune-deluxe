import React, { useState, useCallback, useRef, useEffect } from 'react';
import { WheelConfig } from './types';




interface PremiumWheelProps {
  config: WheelConfig;
  onSpinEnd?: (segmentIndex: number) => void;
  disabled?: boolean;
  forcedSegment?: number | null;
  isMobile?: boolean;
  onShare?: (prizeName: string) => void;
}

const PremiumWheel: React.FC<PremiumWheelProps> = ({ config, onSpinEnd, disabled = false, forcedSegment, isMobile = false }) => {
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);
  const [ledPhase, setLedPhase] = useState(0);
  const ledInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Always blink LEDs
  useEffect(() => {
    const interval = setInterval(() => setLedPhase(p => p + 1), 150);
    return () => clearInterval(interval);
  }, []);

  const numSegments = config.segments.length;
  const segmentAngle = 360 / numSegments;
  const cx = 300, cy = 300, outerR = 250, innerR = 40;

  const pickWeightedSegment = useCallback(() => {
    const totalWeight = config.segments.reduce((sum, s) => sum + s.percentage, 0);
    let rand = Math.random() * totalWeight;
    for (let i = 0; i < config.segments.length; i++) {
      rand -= config.segments[i].percentage;
      if (rand <= 0) return i;
    }
    return config.segments.length - 1;
  }, [config.segments]);

  const spin = useCallback(() => {
    if (isSpinning || disabled) return;
    setIsSpinning(true);
    setWinnerIndex(null);

    const winnerIdx = (forcedSegment != null && forcedSegment >= 0 && forcedSegment < numSegments) ? forcedSegment : pickWeightedSegment();
    const targetOffset = 360 - (winnerIdx + 0.5) * segmentAngle;
    const extraSpins = 5 + Math.floor(Math.random() * 5);
    const totalRotation = extraSpins * 360 + targetOffset;
    const baseRotation = Math.ceil(rotation / 360) * 360;
    setRotation(baseRotation + totalRotation);

    if (ledInterval.current) clearInterval(ledInterval.current);
    ledInterval.current = setInterval(() => setLedPhase(p => p + 1), 80);

    setTimeout(() => {
      setIsSpinning(false);
      if (ledInterval.current) clearInterval(ledInterval.current);
      setWinnerIndex(winnerIdx);
      onSpinEnd?.(winnerIdx);
    }, 5000);
  }, [isSpinning, rotation, segmentAngle, pickWeightedSegment, onSpinEnd, forcedSegment, numSegments]);

  const getSegmentPath = (index: number, r: number, ir: number) => {
    const startAngle = (index * segmentAngle - 90) * (Math.PI / 180);
    const endAngle = ((index + 1) * segmentAngle - 90) * (Math.PI / 180);
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const ix1 = cx + ir * Math.cos(startAngle);
    const iy1 = cy + ir * Math.sin(startAngle);
    const ix2 = cx + ir * Math.cos(endAngle);
    const iy2 = cy + ir * Math.sin(endAngle);
    const largeArc = segmentAngle > 180 ? 1 : 0;
    return `M ${ix1} ${iy1} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${ir} ${ir} 0 ${largeArc} 0 ${ix1} ${iy1} Z`;
  };

  // Get bounding box of a segment for full-cover image placement
  const getSegmentBounds = (index: number) => {
    const startAngle = (index * segmentAngle - 90) * (Math.PI / 180);
    const endAngle = ((index + 1) * segmentAngle - 90) * (Math.PI / 180);
    const r = outerR - 18;
    const points = [
      { x: cx + innerR * Math.cos(startAngle), y: cy + innerR * Math.sin(startAngle) },
      { x: cx + innerR * Math.cos(endAngle), y: cy + innerR * Math.sin(endAngle) },
      { x: cx + r * Math.cos(startAngle), y: cy + r * Math.sin(startAngle) },
      { x: cx + r * Math.cos(endAngle), y: cy + r * Math.sin(endAngle) },
    ];
    // Sample arc points
    const steps = 8;
    for (let s = 0; s <= steps; s++) {
      const a = startAngle + (endAngle - startAngle) * (s / steps);
      points.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  };

  const numLeds = 24;

  return (
    <div className="relative inline-block select-none w-full h-full">
      {/* Background glow */}
      <div
        className="absolute inset-0 rounded-full blur-3xl opacity-40"
        style={{ background: `radial-gradient(circle, ${config.glowColor}44 0%, transparent 70%)` }}
      />

      <svg viewBox="0 0 600 600" width="100%" height="100%" className="relative z-10">
        <defs>
          <radialGradient id="glossOverlay" cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor="white" stopOpacity="0.18" />
            <stop offset="60%" stopColor="white" stopOpacity="0.04" />
            <stop offset="100%" stopColor="black" stopOpacity="0.15" />
          </radialGradient>

          <linearGradient id="ringGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={config.outerRingColor} stopOpacity="1" />
            <stop offset="30%" stopColor="#ffffff" stopOpacity="0.6" />
            <stop offset="50%" stopColor={config.outerRingColor} stopOpacity="0.9" />
            <stop offset="70%" stopColor="#ffffff" stopOpacity="0.3" />
            <stop offset="100%" stopColor={config.outerRingColor} stopOpacity="1" />
          </linearGradient>

          <radialGradient id="capGrad" cx="45%" cy="40%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
            <stop offset="40%" stopColor={config.centerCapColor} />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.6" />
          </radialGradient>

          <filter id="ledGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="wheelShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="8" stdDeviation="15" floodColor="#000000" floodOpacity="0.6" />
          </filter>

          <filter id="frameBevel">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur" />
            <feOffset dx="1" dy="1" result="offsetBlur" />
            <feComposite in="SourceGraphic" in2="offsetBlur" operator="over" />
          </filter>

          <clipPath id="center-clip">
            <circle cx={cx} cy={cy} r={innerR - 3} />
          </clipPath>

          {config.segments.map((_, i) => (
            <clipPath key={i} id={`seg-clip-${i}`}>
              <path d={getSegmentPath(i, outerR - 18, innerR)} />
            </clipPath>
          ))}
        </defs>

        {/* === LAYER 1: Outer shadow === */}
        <circle cx={cx} cy={cy} r={outerR + 28} fill="none" stroke="#000" strokeWidth="4" opacity="0.3" filter="url(#wheelShadow)" />

        {/* === LAYER 2: Metallic frame === */}
        <circle cx={cx} cy={cy} r={outerR + 20} fill="url(#ringGrad)" stroke="#555" strokeWidth="1.5" filter="url(#frameBevel)" />
        <circle cx={cx} cy={cy} r={outerR + 10} fill="none" stroke={config.outerRingColor} strokeWidth="2" opacity="0.5" />
        <circle cx={cx} cy={cy} r={outerR + 16} fill="none" stroke="white" strokeWidth="0.5" opacity="0.3" />

        {/* === LAYER 3: LED ring === */}
        {Array.from({ length: numLeds }).map((_, i) => {
          const angle = (i * 360 / numLeds - 90) * (Math.PI / 180);
          const lx = cx + (outerR + 15) * Math.cos(angle);
          const ly = cy + (outerR + 15) * Math.sin(angle);
          const isLit = (i + ledPhase) % 3 !== 0;
          const ls = config.ledSize ?? 5;
          return (
            <g key={`led-${i}`}>
              <circle cx={lx} cy={ly} r={ls} fill={isLit ? config.ledColor : '#333'} filter={isLit ? 'url(#ledGlow)' : undefined} opacity={isLit ? 1 : 0.3} />
              {isLit && <circle cx={lx} cy={ly} r={ls * 0.6} fill="white" opacity="0.6" />}
            </g>
          );
        })}

        {/* === LAYER 4: Spinning group === */}
        <g
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: `${cx}px ${cy}px`,
            transition: isSpinning ? 'transform 5s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
          }}
        >
          <circle cx={cx} cy={cy} r={outerR - 2} fill="#111" />

          {/* Segment fills */}
          {config.segments.map((seg, i) => (
            <g key={`seg-${i}`}>
              <path d={getSegmentPath(i, outerR - 18, innerR)} fill={seg.color} />
              <path d={getSegmentPath(i, outerR - 18, innerR)} fill={seg.gradientOverlay} />
            </g>
          ))}

          {/* Segment images - FULL COVER */}
          {config.segments.map((seg, i) => {
            if (!seg.imageUrl) return null;
            const bounds = getSegmentBounds(i);
            const scale = seg.imageScale ?? 1;
            const scaledW = bounds.width * scale;
            const scaledH = bounds.height * scale;
            const ox = (seg.imageOffsetX ?? 0) - (scaledW - bounds.width) / 2;
            const oy = (seg.imageOffsetY ?? 0) - (scaledH - bounds.height) / 2;
            return (
              <image
                key={`img-${i}`}
                href={seg.imageUrl}
                x={bounds.x + ox}
                y={bounds.y + oy}
                width={scaledW}
                height={scaledH}
                clipPath={`url(#seg-clip-${i})`}
                preserveAspectRatio="xMidYMid slice"
                opacity="0.85"
              />
            );
          })}

          {/* Gloss overlay */}
          <circle cx={cx} cy={cy} r={outerR - 18} fill="url(#glossOverlay)" />

          {/* Dividers */}
          {config.segments.map((_, i) => {
            const angle = (i * segmentAngle - 90) * (Math.PI / 180);
            const x1 = cx + innerR * Math.cos(angle);
            const y1 = cy + innerR * Math.sin(angle);
            const x2 = cx + (outerR - 18) * Math.cos(angle);
            const y2 = cy + (outerR - 18) * Math.sin(angle);
            return (
              <g key={`div-${i}`}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={config.dividerColor} strokeWidth={config.dividerWidth ?? 3} opacity="0.7" />
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth={Math.max(0.5, (config.dividerWidth ?? 3) * 0.5)} opacity="0.3" />
              </g>
            );
          })}

          {/* Segment text */}
          {!config.hideSegmentText && config.segments.map((seg, i) => {
            const midAngle = (i + 0.5) * segmentAngle - 90;
            const textR = outerR * 0.62;
            const rad = midAngle * (Math.PI / 180);
            const tx = cx + textR * Math.cos(rad);
            const ty = cy + textR * Math.sin(rad);
            const s = config.fontSizeScale ?? 1;
            const vSize = (config.valueFontSize ?? 22) * s;
            const tSize = (config.titleFontSize ?? 10) * s;
            return (
              <g key={`text-${i}`} transform={`rotate(${midAngle + 90}, ${tx}, ${ty})`}>
                <text
                  x={tx}
                  y={ty - tSize * 0.8}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={seg.textColor}
                  fontSize={vSize}
                  fontWeight="900"
                  fontFamily="'Orbitron', sans-serif"
                  style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.9))' }}
                >
                  {seg.reward}
                </text>
                <text
                  x={tx}
                  y={ty + vSize * 0.6}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={seg.textColor}
                  fontSize={tSize}
                  fontWeight="700"
                  fontFamily="'Orbitron', sans-serif"
                  opacity="0.9"
                  style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.9))' }}
                >
                  {seg.title}
                </text>
              </g>
            );
          })}
        </g>

        {/* === CENTER CAP (static, does not spin) === */}
        <circle cx={cx} cy={cy} r={innerR + 8} fill="url(#capGrad)" stroke={config.dividerColor} strokeWidth="2" />
        <circle cx={cx} cy={cy} r={innerR - 2} fill={config.centerCapColor} stroke="#555" strokeWidth="1" />

        {config.centerImageUrl ? (
          <image
            href={config.centerImageUrl}
            x={cx - innerR + 3 + (config.centerImageOffsetX ?? 0)}
            y={cy - innerR + 3 + (config.centerImageOffsetY ?? 0)}
            width={(innerR - 3) * 2 * (config.centerImageScale ?? 1)}
            height={(innerR - 3) * 2 * (config.centerImageScale ?? 1)}
            clipPath="url(#center-clip)"
            preserveAspectRatio="xMidYMid slice"
          />
        ) : (
          <>
            <circle cx={cx - 5} cy={cy - 8} r={12} fill="white" opacity="0.12" />
            <text x={cx} y={cy + 5} textAnchor="middle" fontSize="24" fill={config.ledColor} fontFamily="'Orbitron', sans-serif" fontWeight="900" style={{ filter: `drop-shadow(0 0 6px ${config.ledColor})` }}>⚡</text>
          </>
        )}

        {/* === LAYER 6: Top pointer pointing DOWN === */}
        <g transform={`translate(${cx}, ${cy - outerR - 8})`}>
          <polygon
            points="-16,-18 16,-18 0,12"
            fill={config.pointerColor}
            stroke="#888"
            strokeWidth="1.5"
            style={{ filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.6))' }}
          />
          <polygon points="-10,-15 10,-15 0,6" fill="white" opacity="0.2" />
          <circle cx={0} cy={-20} r={6} fill={config.pointerColor} stroke="#888" strokeWidth="1" />
          <circle cx={0} cy={-20} r={3} fill="white" opacity="0.3" />
        </g>

        {/* Winner highlight */}
        {winnerIndex !== null && !isSpinning && (
          <circle cx={cx} cy={cy} r={outerR - 10} fill="none" stroke={config.glowColor} strokeWidth="4" opacity="0.6" style={{ animation: 'pulse 1s infinite' }} />
        )}
      </svg>

      {/* Spin button */}
      <div
        className="absolute left-1/2 -translate-x-1/2 z-20"
        style={{
          bottom: '-30px',
          transform: isMobile ? `translateX(-50%) translate(${config.mobileButtonOffsetX ?? 0}px, ${config.mobileButtonOffsetY ?? 0}px)` : `translateX(-50%)`,
        }}
      >
        <button
          onClick={spin}
          disabled={isSpinning || disabled}
          className="spin-btn-float font-display font-bold text-sm md:text-lg tracking-widest px-6 md:px-10 py-2 md:py-3 rounded-full border-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: config.buttonColor,
            borderColor: config.buttonColor,
            color: config.buttonTextColor,
            boxShadow: `0 0 20px ${config.buttonColor}66, 0 4px 15px rgba(0,0,0,0.4)`,
            '--btn-glow-color': config.buttonColor,
          } as React.CSSProperties}
        >
          {isSpinning ? 'GIRANDO...' : 'GIRAR'}
        </button>
      </div>

      {/* Winner announcement dialog */}
      {winnerIndex !== null && !isSpinning && config.segments[winnerIndex] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div
            className="relative rounded-2xl px-10 py-8 text-center max-w-sm w-full mx-4"
            style={{
              background: config.resultBoxColor,
              border: `3px solid ${config.resultBorderColor}`,
              boxShadow: `0 0 40px ${config.resultBorderColor}44, 0 8px 32px rgba(0,0,0,0.6)`,
            }}
          >
            <button
              onClick={() => setWinnerIndex(null)}
              className="absolute top-3 right-3 text-lg opacity-60 hover:opacity-100 transition-opacity"
              style={{ color: config.resultTextColor }}
            >
              ✕
            </button>
            <h3
              className="text-xl font-bold font-display mb-3"
              style={{ color: config.resultTextColor }}
            >
              {config.segments[winnerIndex].title}
            </h3>
            <p
              className="text-sm mb-4"
              style={{ color: config.resultTextColor, opacity: 0.85 }}
            >
              Parabéns! Você ganhou {config.segments[winnerIndex].title}!
            </p>
            <button
              onClick={() => sharePrizeImage(
                config.segments[winnerIndex!].title,
                config,
                config.segments[winnerIndex!].color
              )}
              className="px-6 py-2.5 rounded-full font-bold text-sm tracking-wider transition-all duration-300 hover:brightness-110 active:scale-95"
              style={{
                background: config.glowColor || '#FFD700',
                color: config.resultBoxColor || '#1a0a2e',
                boxShadow: `0 4px 20px ${config.glowColor || '#FFD700'}55`,
              }}
            >
              📤 COMPARTILHAR PRÊMIO
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 0.2; }
        }
        @keyframes btn-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .spin-btn-float {
          animation: btn-float 2s ease-in-out infinite;
        }
        .spin-btn-float:hover:not(:disabled), .spin-btn-float:active:not(:disabled) {
          animation: btn-float 2s ease-in-out infinite, btn-glow-pulse 1.5s ease-in-out infinite;
          box-shadow: 0 0 30px var(--btn-glow-color, #FFD700), 0 0 60px var(--btn-glow-color, #FFD700)66, 0 4px 20px rgba(0,0,0,0.5) !important;
        }
        @keyframes btn-glow-pulse {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.3); }
        }
      `}</style>
    </div>
  );
};

export default PremiumWheel;
