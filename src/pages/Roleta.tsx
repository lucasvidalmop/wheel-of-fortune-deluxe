import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import PremiumWheel from '@/components/casino/PremiumWheel';
import { WheelConfig, defaultConfig } from '@/components/casino/types';
import { checkSpins, recordSpinResult, getApiBaseUrl } from '@/services/api';

const Roleta = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [accountId, setAccountId] = useState(searchParams.get('account_id') || '');
  const [identified, setIdentified] = useState(!!searchParams.get('account_id'));
  const [inputValue, setInputValue] = useState('');
  const [emailValue, setEmailValue] = useState('');

  const [config] = useState<WheelConfig>(() => {
    const saved = localStorage.getItem('wheel_config');
    return saved ? { ...defaultConfig, ...JSON.parse(saved) } : defaultConfig;
  });

  const [spinsRemaining, setSpinsRemaining] = useState<number | null>(null);
  const [canSpin, setCanSpin] = useState(true);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const hasApi = !!getApiBaseUrl();

  useEffect(() => {
    if (!hasApi || !accountId || !identified) return;
    setLoading(true);
    checkSpins(accountId).then(res => {
      setCanSpin(res.allowed);
      setSpinsRemaining(res.spins_remaining);
      if (!res.allowed) setMessage(res.message || 'Sem giros disponíveis');
      setLoading(false);
    });
  }, [accountId, hasApi, identified]);

  const handleIdentify = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedId = inputValue.trim();
    const trimmedEmail = emailValue.trim();
    if (!trimmedId || !trimmedEmail) return;
    setAccountId(trimmedId);
    setIdentified(true);
    setSearchParams({ account_id: trimmedId, email: trimmedEmail });
  };

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

      const res = await checkSpins(accountId);
      setCanSpin(res.allowed);
      setSpinsRemaining(res.spins_remaining);
      if (!res.allowed) setMessage(res.message || 'Sem giros disponíveis');
    }
  };

  // Login / identification screen
  if (!identified) {
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
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px] opacity-15"
          style={{ background: `radial-gradient(circle, ${config.glowColor}, transparent)` }}
        />

        {/* Header */}
        {config.headerMode === 'image' && config.headerImageUrl ? (
          <img
            src={config.headerImageUrl}
            alt="Header"
            className="relative z-10 mb-8 object-contain"
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
              className="relative z-10 font-display tracking-[0.5em] text-muted-foreground uppercase mb-8"
              style={{ fontSize: config.headerSubtitleSize }}
            >
              {config.pageSubtitle}
            </p>
          </>
        )}

        {/* Login card */}
        <form
          onSubmit={handleIdentify}
          className="relative z-10 w-full max-w-sm mx-4 rounded-2xl p-8 space-y-6"
          style={{
            background: 'rgba(20, 20, 30, 0.85)',
            border: `2px solid ${config.glowColor}33`,
            boxShadow: `0 0 40px ${config.glowColor}15, 0 8px 32px rgba(0,0,0,0.5)`,
            backdropFilter: 'blur(20px)',
          }}
        >
          <div className="text-center space-y-2">
            <h2
              className="font-display font-bold text-xl tracking-wider uppercase"
              style={{ color: config.glowColor }}
            >
              Identificação
            </h2>
            <p className="text-xs text-muted-foreground tracking-wide">
              Informe seu ID de conta para acessar a roleta
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground font-display tracking-wider uppercase">
              ID da Conta
            </label>
            <input
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder="Digite seu ID..."
              maxLength={100}
              required
              className="w-full px-4 py-3 rounded-lg text-sm font-display tracking-wide outline-none transition-all duration-300"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: `1.5px solid ${config.glowColor}33`,
                color: '#fff',
              }}
              onFocus={e => (e.target.style.borderColor = `${config.glowColor}88`)}
              onBlur={e => (e.target.style.borderColor = `${config.glowColor}33`)}
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-lg font-display font-bold text-sm tracking-widest uppercase transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: config.buttonColor,
              color: config.buttonTextColor,
              boxShadow: `0 0 20px ${config.buttonColor}44, 0 4px 15px rgba(0,0,0,0.3)`,
            }}
          >
            ENTRAR
          </button>
        </form>
      </div>
    );
  }

  // Wheel screen
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

      {/* Logged-in user badge */}
      <div className="fixed top-4 left-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(20,20,30,0.8)', border: `1px solid ${config.glowColor}33` }}>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">ID:</span>
        <span className="text-xs font-bold font-display" style={{ color: config.glowColor }}>{accountId}</span>
        <button
          onClick={() => { setIdentified(false); setAccountId(''); setInputValue(''); setSearchParams({}); }}
          className="text-xs text-muted-foreground hover:text-foreground ml-1 transition-colors"
        >
          ✕
        </button>
      </div>

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
            <p className="text-sm text-destructive mt-1">{message}</p>
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
