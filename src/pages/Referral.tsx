import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ReferralPageConfig, defaultPageConfig } from '@/components/casino/ReferralPageEditor';


const Referral = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [linkData, setLinkData] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [accountId, setAccountId] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [spinsGranted, setSpinsGranted] = useState(0);
  const [wheelSlug, setWheelSlug] = useState('');
  const [cfg, setCfg] = useState<ReferralPageConfig>(defaultPageConfig);

  useEffect(() => {
    const fetchLink = async () => {
      if (!code) { setLoading(false); return; }
      const { data, error } = await (supabase as any)
        .from('referral_links')
        .select('*')
        .eq('code', code.toUpperCase())
        .eq('is_active', true)
        .maybeSingle();
      if (error || !data) {
        toast.error('Link inválido ou desativado');
      } else {
        setLinkData(data);
        // Load page config: individual > default from wheel_configs > defaultPageConfig
        const { data: wcData } = await (supabase as any)
          .from('wheel_configs')
          .select('slug, config')
          .eq('user_id', data.owner_id)
          .maybeSingle();
        if (wcData?.slug) setWheelSlug(wcData.slug);

        const defaultCfg = wcData?.config?.defaultReferralPageConfig || {};
        const individualCfg = data.page_config && Object.keys(data.page_config).length > 0 ? data.page_config : {};
        setCfg({ ...defaultPageConfig, ...defaultCfg, ...individualCfg });
      }
      setLoading(false);
    };
    fetchLink();
  }, [code]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !accountId.trim()) {
      toast.error('Preencha todos os campos corretamente');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await (supabase as any).rpc('register_via_referral', {
        p_code: code?.toUpperCase() || '',
        p_email: email.trim(),
        p_account_id: accountId.trim(),
        p_name: '',
        p_cpf: '',
      });
      if (error) throw error;
      const result = typeof data === 'string' ? JSON.parse(data) : data;
      if (result?.success) {
        setSpinsGranted(result.spins || 1);
        if (result.slug) setWheelSlug(result.slug);
        setSuccess(true);
        toast.success('Giro resgatado com sucesso!');
      } else {
        toast.error(result?.error || 'Erro ao registrar');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao registrar');
    }
    setSubmitting(false);
  };

  // Styled helpers
  const bgStyle: React.CSSProperties = {
    background: cfg.bgColor || `radial-gradient(ellipse at center, ${cfg.bgGradientFrom} 0%, ${cfg.bgGradientTo} 70%)`,
    ...(cfg.bgImage ? { backgroundImage: `url(${cfg.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}),
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: cfg.cardBgColor || 'rgba(255,255,255,0.04)',
    borderColor: cfg.cardBorderColor || 'rgba(255,255,255,0.08)',
  };

  const inputStyle: React.CSSProperties = {
    backgroundColor: cfg.inputBgColor || 'rgba(255,255,255,0.04)',
    borderColor: cfg.inputBorderColor || 'rgba(255,255,255,0.1)',
    color: cfg.inputTextColor || undefined,
  };

  const btnStyle: React.CSSProperties = {
    ...(cfg.btnBgColor ? { backgroundColor: cfg.btnBgColor } : {}),
    ...(cfg.btnTextColor ? { color: cfg.btnTextColor } : {}),
  };

  const titleStyle: React.CSSProperties = cfg.titleColor ? { color: cfg.titleColor } : {};
  const subtitleStyle: React.CSSProperties = cfg.subtitleColor ? { color: cfg.subtitleColor } : {};
  const labelStyle: React.CSSProperties = cfg.labelColor ? { color: cfg.labelColor } : {};

  const icon = cfg.iconUrl
    ? <img src={cfg.iconUrl} alt="icon" className="max-w-[180px] max-h-[100px] rounded-xl object-contain mx-auto" />
    : <div className="text-4xl">{cfg.iconEmoji || '🎰'}</div>;

  const titleText = cfg.titleText || 'Resgatar Giro';
  const displayTitle = cfg.titlePrefix ? `${cfg.titlePrefix} ${titleText}` : titleText;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!linkData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="text-6xl">🚫</div>
          <h1 className="text-xl font-bold text-foreground">Link Inválido</h1>
          <p className="text-muted-foreground text-sm">Este link de referência não existe ou foi desativado.</p>
        </div>
      </div>
    );
  }

  const isLimitReached = linkData.max_registrations != null && linkData.registrations_count >= linkData.max_registrations;
  const isExpired = linkData.expires_at && new Date(linkData.expires_at) <= new Date();

  if (isExpired) {
    const expCardStyle: React.CSSProperties = {
      backgroundColor: cfg.expiredCardBgColor || cardStyle.backgroundColor,
      borderColor: cfg.expiredCardBorderColor || cardStyle.borderColor,
    };
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={bgStyle}>
        {!cfg.bgImage && !cfg.bgColor && <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, ${cfg.bgGradientFrom} 0%, ${cfg.bgGradientTo} 70%)` }} />}
        <div className="relative z-10 text-center space-y-5 max-w-sm mx-4 rounded-2xl p-8 border backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]" style={expCardStyle}>
          <div className="text-6xl">{cfg.expiredEmoji || '⏳'}</div>
          <h1 className="text-2xl font-bold text-foreground" style={cfg.expiredTitleColor ? { color: cfg.expiredTitleColor } : titleStyle}>
            {cfg.expiredTitle || 'Promoção Encerrada'}
          </h1>
          <p className="text-sm text-muted-foreground" style={cfg.expiredSubtitleColor ? { color: cfg.expiredSubtitleColor } : subtitleStyle}>
            {cfg.expiredSubtitle || 'O prazo desta promoção expirou.'}
          </p>
        </div>
      </div>
    );
  }

  if (isLimitReached) {
    const limitCardStyle: React.CSSProperties = {
      backgroundColor: cfg.limitCardBgColor || cardStyle.backgroundColor,
      borderColor: cfg.limitCardBorderColor || cardStyle.borderColor,
    };
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={bgStyle}>
        {!cfg.bgImage && !cfg.bgColor && <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, ${cfg.bgGradientFrom} 0%, ${cfg.bgGradientTo} 70%)` }} />}
        <div className="relative z-10 text-center space-y-5 max-w-sm mx-4 rounded-2xl p-8 border backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]" style={limitCardStyle}>
          <div className="text-6xl">{cfg.limitEmoji || '⏰'}</div>
          <h1 className="text-2xl font-bold text-foreground" style={cfg.limitTitleColor ? { color: cfg.limitTitleColor } : titleStyle}>
            {cfg.limitTitle || 'Resgates Esgotados'}
          </h1>
          <p className="text-sm text-muted-foreground" style={cfg.limitSubtitleColor ? { color: cfg.limitSubtitleColor } : subtitleStyle}>
            {cfg.limitSubtitle || 'Este link atingiu o limite máximo de resgates disponíveis.'}
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={bgStyle}>
        {!cfg.bgImage && !cfg.bgColor && <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, ${cfg.bgGradientFrom} 0%, ${cfg.bgGradientTo} 70%)` }} />}
        <div className="relative z-10 text-center space-y-6 max-w-sm mx-4 rounded-2xl p-8 border backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]" style={cardStyle}>
          <div className="text-6xl animate-bounce">🎉</div>
          <h1 className="text-2xl font-bold text-foreground" style={titleStyle}>{cfg.successTitle || 'Giro Liberado!'}</h1>
          <p className="text-muted-foreground" style={subtitleStyle}>
            {cfg.successSubtitle || <>Você recebeu <span className="font-bold" style={{ color: cfg.btnBgColor || undefined }}>{spinsGranted} giro(s)</span> na roleta!</>}
          </p>
          {wheelSlug ? (
            <button
              onClick={() => navigate(`/${wheelSlug}`)}
              className={`w-full py-3 rounded-xl font-bold text-sm hover:brightness-110 transition ${!cfg.successBtnBgColor && !cfg.btnBgColor ? 'bg-primary text-primary-foreground' : ''}`}
              style={{
                ...(cfg.successBtnBgColor ? { backgroundColor: cfg.successBtnBgColor } : cfg.btnBgColor ? { backgroundColor: cfg.btnBgColor } : {}),
                ...(cfg.successBtnTextColor ? { color: cfg.successBtnTextColor } : cfg.btnTextColor ? { color: cfg.btnTextColor } : {}),
              }}
            >
              {cfg.successBtnText || '🎰 Ir para a Roleta'}
            </button>
          ) : (
            <p className="text-xs text-muted-foreground">Acesse a roleta para girar agora.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={bgStyle}>
      {!cfg.bgImage && !cfg.bgColor && <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, ${cfg.bgGradientFrom} 0%, ${cfg.bgGradientTo} 70%)` }} />}

      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-sm mx-4 rounded-2xl p-6 space-y-5 border backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
        style={cardStyle}
      >
        <div className="text-center space-y-2">
          {icon}
          <h1 className="text-xl font-bold text-foreground" style={titleStyle}>
            {displayTitle}
          </h1>
          <p className="text-sm text-muted-foreground" style={subtitleStyle}>
            {cfg.subtitleText || <>Informe seus dados para resgatar <span className="font-bold" style={{ color: cfg.btnBgColor || undefined }}>{linkData.spins_per_registration} giro(s)</span></>}
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={labelStyle}>E-mail <span className="text-destructive">*</span></label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com" required
              className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground/50"
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={labelStyle}>ID da Conta <span className="text-destructive">*</span></label>
            <input
              type="text" value={accountId} onChange={e => setAccountId(e.target.value)}
              placeholder="Seu ID" required
              className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground/50"
              style={inputStyle}
            />
          </div>
        </div>

        <button
          type="submit" disabled={submitting}
          className={`w-full py-3 rounded-xl font-bold text-sm hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed ${!cfg.btnBgColor ? 'bg-primary text-primary-foreground' : ''}`}
          style={btnStyle}
        >
          {submitting ? 'Verificando...' : (cfg.btnText || '🎯 Resgatar Giro')}
        </button>
      </form>
    </div>
  );
};

export default Referral;
