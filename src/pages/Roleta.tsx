import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import PremiumWheel from '@/components/casino/PremiumWheel';
import { WheelConfig, defaultConfig } from '@/components/casino/types';
import { checkSpins, recordSpinResult, getApiBaseUrl } from '@/services/api';

const Roleta = () => {
  const [searchParams] = useSearchParams();
  const accountId = searchParams.get('account_id') || '';
  const [config] = useState<WheelConfig>(() => {
    const saved = localStorage.getItem('wheel_config');
    return saved ? { ...defaultConfig, ...JSON.parse(saved) } : defaultConfig;
  });

  const [spinsRemaining, setSpinsRemaining] = useState<number | null>(null);
  const [canSpin, setCanSpin] = useState(true);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const hasApi = !!getApiBaseUrl();

  // Verifica giros ao carregar
  useEffect(() => {
    if (!hasApi || !accountId) return;
    setLoading(true);
    checkSpins(accountId).then(res => {
      setCanSpin(res.allowed);
      setSpinsRemaining(res.spins_remaining);
      if (!res.allowed) setMessage(res.message || 'Sem giros disponíveis');
      setLoading(false);
    });
  }, [accountId, hasApi]);

  const handleSpinEnd = async (segmentIndex: number) => {
    const seg = config.segments[segmentIndex];
    if (!seg) return;

    if (hasApi && accountId) {
      await recordSpinResult({
        account_id: accountId,
        segment_title: seg.title,
        segment_reward: seg.reward,
        segment_index: segmentIndex,
      });

      // Recheck spins
      const res = await checkSpins(accountId);
      setCanSpin(res.allowed);
      setSpinsRemaining(res.spins_remaining);
      if (!res.allowed) setMessage(res.message || 'Sem giros disponíveis');
    }
  };

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

      {/* Header */}
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

      {/* Spins info */}
      {hasApi && accountId && (
        <div className="relative z-10 mb-4 text-center">
          {loading ? (
            <p className="text-sm text-muted-foreground animate-pulse">Verificando giros...</p>
          ) : spinsRemaining !== null && spinsRemaining >= 0 ? (
            <p className="text-sm font-bold" style={{ color: config.glowColor }}>
              Giros restantes: {spinsRemaining}
            </p>
          ) : null}
          {!canSpin && message && (
            <p className="text-sm text-red-400 mt-1">{message}</p>
          )}
        </div>
      )}

      {/* Wheel */}
      <div className="relative z-10 mb-32">
        <PremiumWheel
          config={config}
          onSpinEnd={handleSpinEnd}
          disabled={hasApi && accountId ? !canSpin : false}
        />
      </div>
    </div>
  );
};

export default Roleta;
