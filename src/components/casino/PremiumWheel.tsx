import React, { useState, useCallback, useRef } from 'react';
import { WheelConfig } from './types';

interface PremiumWheelProps {
  config: WheelConfig;
  onSpinEnd?: (segmentIndex: number) => void;
}

const PremiumWheel: React.FC<PremiumWheelProps> = ({ config, onSpinEnd }) => {
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);
  const [ledPhase, setLedPhase] = useState(0);
  const ledInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const numSegments = config.segments.length;
  const segmentAngle = 360 / numSegments;
  const cx = 300, cy = 300, outerR = 250, innerR = 40;

  // Weighted random selection based on percentages
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
    if (isSpinning) return;
    setIsSpinning(true);
    setWinnerIndex(null);

    const winnerIdx = pickWeightedSegment();

    // Calculate target angle so the winner segment CENTER aligns with the pointer (top, -90°)
    // Pointer is at top (270° in SVG coords = -90°). Segments start at -90°.
    // Segment i center is at (i + 0.5) * segmentAngle degrees from the start.
    // We need to rotate the wheel so that the center of winnerIdx is at 0° (top).
    // The wheel's segment i center is at (i+0.5)*segmentAngle. To bring it to top (0° visual = -90° SVG),
    // we rotate by -(winnerIdx+0.5)*segmentAngle, but since segments are drawn starting at -90°,
    // the center of segment i in wheel-space is at (i+0.5)*segmentAngle.
    // To align it with top pointer: targetOffset = 360 - (winnerIdx + 0.5) * segmentAngle
    const targetOffset = 360 - (winnerIdx + 0.5) * segmentAngle;
    const extraSpins = 5 + Math.floor(Math.random() * 5);
    const totalRotation = extraSpins * 360 + targetOffset;

    // Add to current rotation (use absolute for clean calc)
    const baseRotation = Math.ceil(rotation / 360) * 360;
    setRotation(baseRotation + totalRotation);

    // LED animation
    if (ledInterval.current) clearInterval(ledInterval.current);
    ledInterval.current = setInterval(() => setLedPhase(p => p + 1), 100);

    setTimeout(() => {
      setIsSpinning(false);
      if (ledInterval.current) clearInterval(ledInterval.current);
      setWinnerIndex(winnerIdx);
      onSpinEnd?.(winnerIdx);
    }, 5000);
  }, [isSpinning, rotation, segmentAngle, pickWeightedSegment, onSpinEnd]);

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

  const numLeds = 24;

  return (
    <div className="relative inline-block select-none" style={{ width: 620, height: 620 }}>
      {/* Background glow */}
      <div
        className="absolute inset-0 rounded-full blur-3xl opacity-40"
        style={{ background: `radial-gradient(circle, ${config.glowColor}44 0%, transparent 70%)` }}
      />

      <svg viewBox="0 0 600 600" width={620} height={620} className="relative z-10">
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

          {/* Center image clip */}
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
          const isLit = isSpinning ? (i + ledPhase) % 3 === 0 : true;
          return (
            <g key={`led-${i}`}>
              <circle cx={lx} cy={ly} r={5} fill={isLit ? config.ledColor : '#333'} filter={isLit ? 'url(#ledGlow)' : undefined} opacity={isLit ? 1 : 0.3} />
              {isLit && <circle cx={lx} cy={ly} r={3} fill="white" opacity="0.6" />}
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

          {/* Segment images */}
          {config.segments.map((seg, i) => {
            if (!seg.imageUrl) return null;
            const midAngle = ((i + 0.5) * segmentAngle - 90) * (Math.PI / 180);
            const imgX = cx + (outerR * 0.55) * Math.cos(midAngle) - 30;
            const imgY = cy + (outerR * 0.55) * Math.sin(midAngle) - 30;
            return (
              <image
                key={`img-${i}`}
                href={seg.imageUrl}
                x={imgX}
                y={imgY}
                width={60}
                height={60}
                clipPath={`url(#seg-clip-${i})`}
                style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}
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
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={config.dividerColor} strokeWidth="3" opacity="0.7" />
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth="1" opacity="0.3" />
              </g>
            );
          })}

          {/* Segment text */}
          {config.segments.map((seg, i) => {
            const midAngle = (i + 0.5) * segmentAngle - 90;
            const textR = outerR * 0.62;
            const rad = midAngle * (Math.PI / 180);
            const tx = cx + textR * Math.cos(rad);
            const ty = cy + textR * Math.sin(rad);
            return (
              <text
                key={`text-${i}`}
                x={tx}
                y={ty}
                textAnchor="middle"
                dominantBaseline="central"
                transform={`rotate(${midAngle + 90}, ${tx}, ${ty})`}
                fill={seg.textColor}
                fontSize="14"
                fontWeight="800"
                fontFamily="'Orbitron', sans-serif"
                style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }}
              >
                <tspan x={tx} dy="-8" fontSize="20" fontWeight="900">{seg.reward}</tspan>
                <tspan x={tx} dy="20" fontSize="11" fontWeight="700">{seg.title.replace(/\d+\s*/, '')}</tspan>
              </text>
            );
          })}

          {/* Center cap */}
          <circle cx={cx} cy={cy} r={innerR + 8} fill="url(#capGrad)" stroke={config.dividerColor} strokeWidth="2" />
          <circle cx={cx} cy={cy} r={innerR - 2} fill={config.centerCapColor} stroke="#555" strokeWidth="1" />
          
          {/* Center image or default icon */}
          {config.centerImageUrl ? (
            <image
              href={config.centerImageUrl}
              x={cx - innerR + 3}
              y={cy - innerR + 3}
              width={(innerR - 3) * 2}
              height={(innerR - 3) * 2}
              clipPath="url(#center-clip)"
              preserveAspectRatio="xMidYMid slice"
            />
          ) : (
            <>
              <circle cx={cx - 5} cy={cy - 8} r={12} fill="white" opacity="0.12" />
              <text x={cx} y={cy + 5} textAnchor="middle" fontSize="24" fill={config.ledColor} fontFamily="'Orbitron', sans-serif" fontWeight="900" style={{ filter: `drop-shadow(0 0 6px ${config.ledColor})` }}>⚡</text>
            </>
          )}
        </g>

        {/* === LAYER 6: Top pointer (centered) === */}
        <g transform={`translate(${cx}, ${cy - outerR - 24})`}>
          <polygon
            points="-14,25 0,-5 14,25"
            fill={config.pointerColor}
            stroke="#888"
            strokeWidth="1.5"
            style={{ filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.5))' }}
          />
          <polygon points="-8,22 0,0 8,22" fill="white" opacity="0.25" />
        </g>

        {/* Winner highlight */}
        {winnerIndex !== null && !isSpinning && (
          <circle cx={cx} cy={cy} r={outerR - 10} fill="none" stroke={config.glowColor} strokeWidth="4" opacity="0.6" style={{ animation: 'pulse 1s infinite' }} />
        )}
      </svg>

      {/* Spin button */}
      <button
        onClick={spin}
        disabled={isSpinning}
        className="absolute left-1/2 -translate-x-1/2 -bottom-4 z-20 font-display font-bold text-lg tracking-widest px-10 py-3 rounded-full border-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: `linear-gradient(135deg, ${config.glowColor}, ${config.ledColor})`,
          borderColor: config.glowColor,
          color: '#000',
          boxShadow: `0 0 20px ${config.glowColor}66, 0 4px 15px rgba(0,0,0,0.4)`,
        }}
      >
        {isSpinning ? 'GIRANDO...' : 'GIRAR'}
      </button>

      {/* Winner announcement */}
      {winnerIndex !== null && !isSpinning && (
        <div
          className="absolute left-1/2 -translate-x-1/2 -top-16 z-20 font-display font-bold text-center px-6 py-2 rounded-xl"
          style={{
            background: 'rgba(0,0,0,0.85)',
            border: `2px solid ${config.glowColor}`,
            color: config.segments[winnerIndex].textColor,
            boxShadow: `0 0 30px ${config.glowColor}44`,
          }}
        >
          🎉 {config.segments[winnerIndex].title}!
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 0.2; }
        }
      `}</style>
    </div>
  );
};

export default PremiumWheel;
