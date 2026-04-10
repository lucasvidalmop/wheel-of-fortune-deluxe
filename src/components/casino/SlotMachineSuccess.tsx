import { useState, useEffect, useRef, useCallback } from 'react';

const SLOT_ICONS = ['⚡', '❤️', '🍒', '💎', '🔥', '⭐', '🎰', '💰'];

interface SlotMachineSuccessProps {
  accentColor: string;
  titleColor: string;
  subtitleColor: string;
  btnBgColor: string;
  btnTextColor: string;
  successTitle: string;
  successSubtitle: string;
  successBtnText: string;
  slotMatchIcon?: string;
  slotReelImages?: string[];
  slotLuckyText?: string;
  slotReelBgColor?: string;
  slotFrameBgColor?: string;
  slotFrameBorderColor?: string;
  successBgColor?: string;
  ctaUrl?: string;
  onCtaClick?: () => void;
  showCta: boolean;
  inline?: boolean;
}

// Floating particles
const Particles = ({ accentColor }: { accentColor: string }) => {
  const count = 30;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {Array.from({ length: count }).map((_, i) => {
        const size = 2 + Math.random() * 4;
        const left = Math.random() * 100;
        const delay = Math.random() * 6;
        const duration = 4 + Math.random() * 6;
        const opacity = 0.2 + Math.random() * 0.6;
        return (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: size,
              height: size,
              left: `${left}%`,
              bottom: `-${size}px`,
              backgroundColor: i % 3 === 0 ? accentColor : `${accentColor}80`,
              opacity,
              animation: `floatUp ${duration}s ${delay}s linear infinite`,
            }}
          />
        );
      })}
    </div>
  );
};

// Single slot reel
const SlotReel = ({
  targetIcon,
  targetImageUrl,
  delay,
  onStop,
  reelBgColor,
}: {
  targetIcon: string;
  targetImageUrl?: string;
  delay: number;
  onStop: () => void;
  reelBgColor?: string;
}) => {
  const [spinning, setSpinning] = useState(true);
  const [currentIcon, setCurrentIcon] = useState('⚡');
  const [showFinalImage, setShowFinalImage] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    let spinCount = 0;
    const maxSpins = 15 + delay * 5;
    intervalRef.current = setInterval(() => {
      spinCount++;
      setCurrentIcon(SLOT_ICONS[Math.floor(Math.random() * SLOT_ICONS.length)]);
      if (spinCount >= maxSpins) {
        clearInterval(intervalRef.current!);
        if (targetImageUrl) {
          setShowFinalImage(true);
        } else {
          setCurrentIcon(targetIcon);
        }
        setSpinning(false);
        onStop();
      }
    }, 80 + delay * 15);

    return () => clearInterval(intervalRef.current!);
  }, [targetIcon, targetImageUrl, delay, onStop]);

  return (
    <div
      className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg flex items-center justify-center text-2xl sm:text-3xl transition-all duration-200"
      style={{
        backgroundColor: reelBgColor || 'rgba(100, 40, 20, 0.9)',
        boxShadow: spinning
          ? 'inset 0 0 15px rgba(0,0,0,0.5)'
          : 'inset 0 0 15px rgba(0,0,0,0.3), 0 0 20px rgba(255,180,0,0.3)',
        transform: spinning ? 'scale(0.95)' : 'scale(1)',
      }}
    >
      {showFinalImage && targetImageUrl ? (
        <img src={targetImageUrl} alt="slot" className="w-10 h-10 sm:w-12 sm:h-12 object-contain" />
      ) : (
        <span
          className="transition-transform duration-150"
          style={{
            filter: spinning ? 'blur(1px)' : 'none',
            transform: spinning ? `translateY(${Math.random() > 0.5 ? 2 : -2}px)` : 'none',
          }}
        >
          {currentIcon}
        </span>
      )}
    </div>
  );
};

const SlotMachineSuccess = ({
  accentColor,
  titleColor,
  subtitleColor,
  btnBgColor,
  btnTextColor,
  successTitle,
  successSubtitle,
  successBtnText,
  slotMatchIcon = '⚡',
  slotReelImages,
  slotLuckyText = '🎰 BOA SORTE! 🎰',
  slotReelBgColor,
  slotFrameBgColor,
  slotFrameBorderColor,
  successBgColor,
  ctaUrl,
  onCtaClick,
  showCta,
  inline = false,
}: SlotMachineSuccessProps) => {
  const [phase, setPhase] = useState<'slots' | 'lucky' | 'success'>('slots');
  const [stoppedCount, setStoppedCount] = useState(0);
  const [showLuckyText, setShowLuckyText] = useState(false);

  const handleReelStop = useCallback(() => {
    setStoppedCount(prev => prev + 1);
  }, []);

  useEffect(() => {
    if (stoppedCount >= 3 && phase === 'slots') {
      setTimeout(() => setShowLuckyText(true), 300);
      setTimeout(() => setPhase('lucky'), 2000);
      setTimeout(() => setPhase('success'), 2800);
    }
  }, [stoppedCount, phase]);

  return (
    <div className={`${inline ? 'absolute' : 'fixed'} inset-0 ${inline ? 'z-0' : 'z-50'} flex items-center justify-center overflow-hidden`}
      style={{ background: successBgColor || 'rgba(0,0,0,0.92)' }}>
      <Particles accentColor={accentColor} />

      {/* Slot Machine Phase */}
      {phase === 'slots' && (
        <div className="relative z-10 flex flex-col items-center gap-5 animate-[scaleIn_0.4s_ease-out]">
          <div
            className="flex gap-2 p-3 rounded-xl border-2"
            style={{
              borderColor: slotFrameBorderColor || 'rgba(255,220,150,0.4)',
              backgroundColor: slotFrameBgColor || 'rgba(60, 20, 10, 0.8)',
              boxShadow: '0 0 40px rgba(200,100,0,0.15)',
            }}
          >
            <SlotReel targetIcon={slotMatchIcon} targetImageUrl={slotReelImages?.[0]} delay={0} onStop={handleReelStop} reelBgColor={slotReelBgColor} />
            <SlotReel targetIcon={slotMatchIcon} targetImageUrl={slotReelImages?.[1]} delay={2} onStop={handleReelStop} reelBgColor={slotReelBgColor} />
            <SlotReel targetIcon={slotMatchIcon} targetImageUrl={slotReelImages?.[2]} delay={4} onStop={handleReelStop} reelBgColor={slotReelBgColor} />
          </div>
          {showLuckyText && (
            <div
              className="text-sm sm:text-base font-bold uppercase tracking-widest animate-[fadeInUp_0.5s_ease-out]"
              style={{ color: accentColor }}
            >
              {slotLuckyText}
            </div>
          )}
        </div>
      )}

      {/* Lucky transition */}
      {phase === 'lucky' && (
        <div className="relative z-10 animate-[pulseGlow_0.8s_ease-in-out]">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-3xl"
            style={{
              backgroundColor: `${accentColor}20`,
              boxShadow: `0 0 60px ${accentColor}40, 0 0 120px ${accentColor}20`,
            }}
          >
            {slotMatchIcon}
          </div>
        </div>
      )}

      {/* Success Phase */}
      {phase === 'success' && (
        <div className="relative z-10 text-center space-y-5 max-w-sm mx-4 px-6 animate-[fadeInUp_0.6s_ease-out]">
          {/* Glowing icon */}
          <div className="flex justify-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl animate-[emojiPulse_3s_ease-in-out_infinite]"
              style={{
                backgroundColor: `${accentColor}20`,
                boxShadow: `0 0 40px ${accentColor}30`,
              }}
            >
              {slotMatchIcon}
            </div>
          </div>

          {/* Title */}
          <h1
            className="text-2xl sm:text-3xl font-extrabold uppercase tracking-wide"
            style={{ color: titleColor }}
          >
            {successTitle}
          </h1>

          {/* Decorative line */}
          <div className="flex items-center justify-center gap-2">
            <div className="h-px w-10" style={{ backgroundColor: `${accentColor}40` }} />
            <span style={{ color: accentColor }}>✦</span>
            <div className="h-px w-10" style={{ backgroundColor: `${accentColor}40` }} />
          </div>

          {/* Subtitle */}
          {successSubtitle && (
            <p className="text-sm" style={{ color: subtitleColor }}>
              {successSubtitle}
            </p>
          )}

          {/* CTA Button */}
          {showCta && ctaUrl ? (
            <a
              href={ctaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 rounded-xl font-bold text-sm uppercase tracking-wider hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-lg animate-[fadeInUp_0.5s_0.3s_ease-out_both] no-underline"
              style={{
                backgroundColor: btnBgColor,
                color: btnTextColor,
                boxShadow: `0 8px 25px ${btnBgColor}30`,
              }}
            >
              {successBtnText}
            </a>
          ) : showCta && onCtaClick ? (
            <button
              onClick={onCtaClick}
              className="w-full py-3.5 rounded-xl font-bold text-sm uppercase tracking-wider hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-lg animate-[fadeInUp_0.5s_0.3s_ease-out_both]"
              style={{
                backgroundColor: btnBgColor,
                color: btnTextColor,
                boxShadow: `0 8px 25px ${btnBgColor}30`,
              }}
            >
              {successBtnText}
            </button>
          ) : null}

          {/* Dots */}
          <div className="flex justify-center gap-1.5 pt-2">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  backgroundColor: `${accentColor}${i === 1 ? '' : '50'}`,
                  animation: `dotPulse 1.5s ${i * 0.3}s ease-in-out infinite`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Inline keyframes */}
      <style>{`
        @keyframes floatUp {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 0.5; }
          100% { transform: translateY(-100vh) translateX(${Math.random() > 0.5 ? '' : '-'}30px); opacity: 0; }
        }
        @keyframes scaleIn {
          0% { transform: scale(0.5); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes fadeInUp {
          0% { transform: translateY(20px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes pulseGlow {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.1); opacity: 1; }
        }
        @keyframes emojiPulse {
          0%, 100% { transform: scale(1); }
          25% { transform: scale(1.35); }
          50% { transform: scale(0.9); }
          75% { transform: scale(1.2); }
        }
        @keyframes dotPulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
};

export default SlotMachineSuccess;
