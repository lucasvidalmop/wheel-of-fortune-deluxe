import { useState, useEffect } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import PremiumWheel from '@/components/casino/PremiumWheel';
import { WheelConfig, defaultConfig } from '@/components/casino/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Roleta = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [accountId, setAccountId] = useState('');
  const [identified, setIdentified] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [emailValue, setEmailValue] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [configLoading, setConfigLoading] = useState(true);

  const [config, setConfig] = useState<WheelConfig>(defaultConfig);

  const [spinsRemaining, setSpinsRemaining] = useState<number | null>(null);
  const [canSpin, setCanSpin] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [fixedPrizeEnabled, setFixedPrizeEnabled] = useState(false);
  const [fixedPrizeSegment, setFixedPrizeSegment] = useState<number | null>(null);

  // Redirect if no slug — only /roleta/:slug is allowed
  useEffect(() => {
    if (!slug) {
      navigate('/', { replace: true });
      return;
    }
    (async () => {
      const { data } = await (supabase as any)
        .from('wheel_configs')
        .select('user_id, config')
        .eq('slug', slug)
        .maybeSingle();
      if (!data) {
        toast.error('Roleta não encontrada');
        navigate('/', { replace: true });
        return;
      }
      setOwnerId(data.user_id);
      if (data.config && Object.keys(data.config).length > 0) {
        setConfig({ ...defaultConfig, ...data.config });
      }
      setConfigLoading(false);
    })();
  }, [slug, navigate]);

  useEffect(() => {
    if (!accountId || !identified) return;
    setLoading(true);
    let query = (supabase as any)
      .from('wheel_users')
      .select('name, spins_available, owner_id, fixed_prize_enabled, fixed_prize_segment')
      .eq('account_id', accountId);
    if (ownerId) query = query.eq('owner_id', ownerId);
    query.maybeSingle()
      .then(({ data }: any) => {
        if (data) {
          setUserName(data.name);
          setSpinsRemaining(data.spins_available);
          setCanSpin(data.spins_available >= 1);
          setFixedPrizeEnabled(data.fixed_prize_enabled ?? false);
          setFixedPrizeSegment(data.fixed_prize_segment ?? null);
          if (!ownerId && data.owner_id) setOwnerId(data.owner_id);
          if (data.spins_available < 1) setMessage('Sem giros disponíveis');
        }
        setLoading(false);
      });
  }, [accountId, identified, ownerId]);

  const handleIdentify = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedId = inputValue.trim();
    const trimmedEmail = emailValue.trim();
    if (!trimmedId || !trimmedEmail) return;
    setAuthLoading(true);

    let authQuery = (supabase as any)
      .from('wheel_users')
      .select('id, name, spins_available, account_id, owner_id, fixed_prize_enabled, fixed_prize_segment')
      .eq('email', trimmedEmail)
      .eq('account_id', trimmedId);
    if (ownerId) authQuery = authQuery.eq('owner_id', ownerId);
    const { data, error } = await authQuery.maybeSingle();

    if (error || !data) {
      toast.error('Dados inválidos. Verifique seu email e ID da conta.');
      setAuthLoading(false);
      return;
    }

    setAccountId(data.account_id);
    setUserName(data.name);
    setSpinsRemaining(data.spins_available);
    setCanSpin(data.spins_available >= 1);
    setFixedPrizeEnabled(data.fixed_prize_enabled ?? false);
    setFixedPrizeSegment(data.fixed_prize_segment ?? null);
    if (data.owner_id) setOwnerId(data.owner_id);
    if (data.spins_available < 1) setMessage('Sem giros disponíveis');
    setIdentified(true);
    setSearchParams({ account_id: trimmedId, email: trimmedEmail });
    setAuthLoading(false);
  };

  const handleSpinEnd = async (segmentIndex: number) => {
    const seg = config.segments[segmentIndex];
    if (!seg) return;

    if (accountId) {
      await (supabase as any)
        .from('spin_results')
        .insert({
          user_name: userName || '',
          user_email: emailValue,
          account_id: accountId,
          prize: seg.title || `Segmento ${segmentIndex + 1}`,
          owner_id: ownerId || null,
        });

      let updateQuery = (supabase as any)
        .from('wheel_users')
        .update({ spins_available: Math.max(0, (spinsRemaining ?? 1) - 1) })
        .eq('account_id', accountId);
      if (ownerId) updateQuery = updateQuery.eq('owner_id', ownerId);
      await updateQuery;

      let refreshQuery = (supabase as any)
        .from('wheel_users')
        .select('spins_available, owner_id')
        .eq('account_id', accountId);
      if (ownerId) refreshQuery = refreshQuery.eq('owner_id', ownerId);
      const { data } = await refreshQuery.maybeSingle();
      if (data) {
        setSpinsRemaining(data.spins_available);
        setCanSpin(data.spins_available >= 1);
        if (!ownerId && data.owner_id) setOwnerId(data.owner_id);
        if (data.spins_available < 1) setMessage('Sem giros disponíveis');
      }
    }
  };

  if (configLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando roleta...</div>
      </div>
    );
  }

  // Login / identification screen
  if (!identified) {
    const ac = config;
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{
        background: ac.authBgImageUrl
          ? `url(${ac.authBgImageUrl}) center/cover no-repeat`
          : ac.authBgColor ?? '#1a0a2e',
      }}>
        {!ac.authBgImageUrl && (
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, rgba(80,20,120,0.3) 0%, rgba(10,5,30,0.9) 70%)' }} />
        )}

        <form
          onSubmit={handleIdentify}
          className="relative z-10 w-full max-w-sm mx-4 rounded-xl p-6 space-y-5"
          style={{
            background: ac.authCardBgColor ? `${ac.authCardBgColor}f2` : 'rgba(20, 12, 40, 0.95)',
            border: `1px solid ${ac.authCardBorderColor ?? 'rgba(255,255,255,0.08)'}`,
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}
        >
          {/* Header: logo, text, or logo+text */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {(ac.authHeaderMode === 'logo' || ac.authHeaderMode === 'logo_text') && ac.authLogoUrl && (
                <img
                  src={ac.authLogoUrl}
                  alt="Logo"
                  className="object-contain mb-3"
                  style={{
                    height: ac.authLogoSize ?? 80,
                    maxWidth: '100%',
                    transform: `translate(${ac.authLogoOffsetX ?? 0}px, ${ac.authLogoOffsetY ?? 0}px) scale(${ac.authLogoScale ?? 1})`,
                  }}
                />
              )}
              {(ac.authHeaderMode === 'text' || ac.authHeaderMode === 'logo_text') && (
                <>
                  <h2 className="font-bold tracking-wide" style={{ color: ac.authLabelColor ?? '#fff', fontSize: ac.authTitleSize ?? 18 }}>
                    {ac.authTitle ?? 'LIBERAR GIRO'}
                  </h2>
                  <p className="mt-1" style={{ color: ac.authTextColor ?? 'rgba(255,255,255,0.5)', fontSize: ac.authSubtitleSize ?? 12 }}>
                    {ac.authSubtitle ?? 'Informe o e-mail e o ID da sua conta para verificarmos seu cadastro.'}
                  </p>
                </>
              )}
              {ac.authHeaderMode === 'logo' && !ac.authLogoUrl && (
                 <h2 className="font-bold tracking-wide" style={{ color: ac.authLabelColor ?? '#fff', fontSize: ac.authTitleSize ?? 18 }}>
                   {ac.authTitle ?? 'LIBERAR GIRO'}
                </h2>
              )}
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold tracking-wider uppercase" style={{ color: ac.authLabelColor ?? '#ffffff' }}>
              E-MAIL
            </label>
            <input
              type="email"
              value={emailValue}
              onChange={e => setEmailValue(e.target.value)}
              placeholder="seu@email.com"
              maxLength={255}
              required
              className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all duration-300"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: `2px solid ${ac.authInputBorderColor ?? '#D4A017'}`,
                color: '#fff',
              }}
              onFocus={e => (e.target.style.borderColor = ac.authInputBorderColor ? `${ac.authInputBorderColor}` : '#FFD700')}
              onBlur={e => (e.target.style.borderColor = ac.authInputBorderColor ?? '#D4A017')}
            />
          </div>

          {/* Account ID */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold tracking-wider uppercase" style={{ color: ac.authLabelColor ?? '#ffffff' }}>
              ID DA CONTA
            </label>
            <input
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder="Seu ID na plataforma"
              maxLength={100}
              required
              className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all duration-300"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: `2px solid ${ac.authInputBorderColor ?? '#D4A017'}`,
                color: '#fff',
              }}
              onFocus={e => (e.target.style.borderColor = ac.authInputBorderColor ? `${ac.authInputBorderColor}` : '#FFD700')}
              onBlur={e => (e.target.style.borderColor = ac.authInputBorderColor ?? '#D4A017')}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={authLoading}
            className="w-full py-3.5 rounded-lg font-bold text-sm tracking-[0.2em] uppercase transition-all duration-300 hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
            style={{
              background: ac.authButtonBgColor ?? '#0ABACC',
              color: ac.authButtonTextColor ?? '#000000',
              boxShadow: `0 4px 20px ${ac.authButtonBgColor ?? '#0ABACC'}55`,
            }}
          >
            {authLoading ? 'VERIFICANDO...' : 'GIRAR AGORA'}
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
          style={{
            backgroundImage: `url(${config.backgroundImageUrl})`,
            transform: `translate(${config.backgroundImageOffsetX ?? 0}px, ${config.backgroundImageOffsetY ?? 0}px) scale(${config.backgroundImageScale ?? 1})`,
          }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-black/70" />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-[120px] opacity-15"
        style={{ background: `radial-gradient(circle, ${config.glowColor}, transparent)` }}
      />

      {/* Logged-in user badge */}
      <div className="fixed top-4 left-4 z-50 flex items-center gap-3 px-4 py-2 rounded-lg" style={{ background: 'rgba(20,20,30,0.85)', border: `1px solid ${config.glowColor}33` }}>
        {userName && (
          <span className="text-sm font-bold font-display" style={{ color: config.glowColor }}>{userName}</span>
        )}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">ID:</span>
          <span className="text-xs font-mono text-muted-foreground">{accountId}</span>
        </div>
        <button
          onClick={() => { setIdentified(false); setAccountId(''); setInputValue(''); setEmailValue(''); setUserName(null); setSearchParams({}); }}
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
          style={{
            height: config.headerImageSize,
            maxWidth: '90vw',
            transform: `translate(${config.headerImageOffsetX ?? 0}px, ${config.headerImageOffsetY ?? 0}px) scale(${config.headerImageScale ?? 1})`,
          }}
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
      {accountId && (
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
          disabled={accountId ? !canSpin : false}
          forcedSegment={fixedPrizeEnabled ? fixedPrizeSegment : null}
        />
      </div>
    </div>
  );
};

export default Roleta;
