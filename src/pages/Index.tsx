import { useState, useEffect } from 'react';
import PremiumWheel from '@/components/casino/PremiumWheel';
import CustomizationPanel from '@/components/casino/CustomizationPanel';
import { WheelConfig, defaultConfig } from '@/components/casino/types';

const Index = () => {
  const [config, setConfig] = useState<WheelConfig>(defaultConfig);
  const [showPanel, setShowPanel] = useState(false);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden" style={{ background: '#0a0a0f' }}>
      {/* Background image */}
      {config.backgroundImageUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
          style={{ backgroundImage: `url(${config.backgroundImageUrl})` }}
        />
      )}

      {/* Ambient overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-black/70" />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-[120px] opacity-15"
        style={{ background: `radial-gradient(circle, ${config.glowColor}, transparent)` }}
      />

      {/* Header: text or image */}
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

      {/* Wheel */}
      <div className="relative z-10 mb-32">
        <PremiumWheel config={config} />
      </div>

      {/* Toggle panel */}
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="fixed top-4 right-4 z-50 font-display text-xs tracking-wider px-4 py-2 rounded-lg border border-border bg-card text-foreground hover:bg-secondary transition-colors"
      >
        {showPanel ? '✕ FECHAR' : '⚙ ADMIN'}
      </button>

      {showPanel && (
        <div className="fixed top-16 right-4 z-40">
          <CustomizationPanel config={config} onChange={setConfig} />
        </div>
      )}
    </div>
  );
};

export default Index;
