import { useState } from 'react';
import PremiumWheel from '@/components/casino/PremiumWheel';
import { WheelConfig, defaultConfig } from '@/components/casino/types';

const Index = () => {
  const [config] = useState<WheelConfig>(() => {
    const saved = localStorage.getItem('wheel_config');
    return saved ? { ...defaultConfig, ...JSON.parse(saved) } : defaultConfig;
  });

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden" style={{ background: '#0a0a0f' }}>
      {config.backgroundImageUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
          style={{ backgroundImage: `url(${config.backgroundImageUrl})` }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-black/70" />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-[120px] opacity-15"
        style={{ background: `radial-gradient(circle, ${config.glowColor}, transparent)` }}
      />

      {config.headerMode === 'image' && config.headerImageUrl ? (
        <img
          src={config.headerImageUrl}
          alt="Header"
          className="relative z-10 mb-10 object-contain"
          style={{ height: config.headerImageSize, maxWidth: '90vw' }}
        />
      ) : (
        <>
          <h1
            className="relative z-10 font-display font-black tracking-[0.3em] uppercase mb-2"
            style={{
              fontSize: config.headerTitleSize,
              color: config.glowColor,
              textShadow: `0 0 30px ${config.glowColor}55`,
            }}
          >
            {config.pageTitle}
          </h1>
          <p
            className="relative z-10 font-display tracking-[0.5em] text-muted-foreground uppercase mb-10"
            style={{ fontSize: config.headerSubtitleSize }}
          >
            {config.pageSubtitle}
          </p>
        </>
      )}

      <div className="relative z-10 mb-32">
        <PremiumWheel config={config} />
      </div>
    </div>
  );
};

export default Index;
