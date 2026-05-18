import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import SlotMachineSuccess from '@/components/casino/SlotMachineSuccess';
import { ReferralPageConfig, defaultPageConfig } from '@/components/casino/ReferralPageEditor';
import AuthNoticeBanner from '@/components/AuthNoticeBanner';

/**
 * Página de Resgate por Código.
 * Igual à página /ref/:code, porém com:
 *  - tag fixa do operador na URL (/resgate=:tag)
 *  - exigência de um CÓDIGO de resgate (compartilhado ou único)
 * Distribuição de giros/prêmios reusa exatamente o mesmo motor do referral.
 */
const Resgate = ({ tag }: { tag?: string }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pageData, setPageData] = useState<any>(null);
  const [linkData, setLinkData] = useState<any>(null);
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [accountId, setAccountId] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [spinsGranted, setSpinsGranted] = useState(0);
  const [wheelSlug, setWheelSlug] = useState('');
  const [cfg, setCfg] = useState<ReferralPageConfig>(defaultPageConfig);
  const [slotCfg, setSlotCfg] = useState<any>({});

  useEffect(() => {
    const fetchPage = async () => {
      if (!tag) { setLoading(false); return; }
      const { data: rpcData, error } = await (supabase as any)
        .rpc('get_redemption_page_by_tag', { p_tag: tag });
      const page = rpcData?.pageData;
      const link = rpcData?.linkData;
      if (error || !page || !link) {
        toast.error('Página de resgate não encontrada');
      } else {
        setPageData(page);
        setLinkData(link);
        if (rpcData?.wheelSlug) setWheelSlug(rpcData.wheelSlug);
        const defaultCfg = rpcData?.defaultReferralPageConfig || {};
        const individualCfg = link.page_config && Object.keys(link.page_config).length > 0 ? link.page_config : {};
        setCfg({ ...defaultPageConfig, ...defaultCfg, ...individualCfg });
        setSlotCfg(rpcData?.gorjetaPageConfig || {});
      }
      setLoading(false);
    };
    fetchPage();
  }, [tag]);

  // SEO: title, description, favicon (usa o padrão do link de referência do operador)
  useEffect(() => {
    if (!cfg) return;
    const cleanups: (() => void)[] = [];
    const addMeta = (property: string, content: string) => {
      if (!content) return;
      let el = document.querySelector(`meta[property="${property}"], meta[name="${property}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        if (property.startsWith('og:') || property.startsWith('twitter:')) el.setAttribute('property', property);
        else el.setAttribute('name', property);
        document.head.appendChild(el);
        cleanups.push(() => el?.remove());
      }
      el.setAttribute('content', content);
    };

    const prevTitle = document.title;
    const pageTitle = (cfg as any).seoTitle || cfg.titleText || linkData?.label || 'Resgate de Giros';
    document.title = pageTitle;
    cleanups.push(() => { document.title = prevTitle; });

    addMeta('description', (cfg as any).seoDescription || '');
    addMeta('og:title', pageTitle);
    addMeta('og:description', (cfg as any).seoDescription || '');
    if ((cfg as any).seoOgImageUrl) addMeta('og:image', (cfg as any).seoOgImageUrl);
    addMeta('twitter:card', 'summary_large_image');
    addMeta('twitter:title', pageTitle);
    addMeta('twitter:description', (cfg as any).seoDescription || '');
    if ((cfg as any).seoOgImageUrl) addMeta('twitter:image', (cfg as any).seoOgImageUrl);

    if ((cfg as any).seoFaviconUrl) {
      let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
      const hadExisting = !!link;
      const oldHref = link?.href;
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = (cfg as any).seoFaviconUrl;
      cleanups.push(() => {
        if (!hadExisting) link?.remove();
        else if (link && oldHref) link.href = oldHref;
      });
    }

    return () => cleanups.forEach(fn => fn());
  }, [cfg, linkData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !email.trim() || !accountId.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await (supabase as any).rpc('register_via_redemption', {
        p_tag: tag,
        p_code: code.trim(),
        p_email: email.trim(),
        p_account_id: accountId.trim(),
        p_name: '',
        p_cpf: '',
        p_phone: '',
        p_pix_key: '',
        p_pix_key_type: '',
      });
      if (error) throw error;
      const result = typeof data === 'string' ? JSON.parse(data) : data;
      if (result?.success) {
        setSpinsGranted(result.spins || 1);
        if (result.slug) setWheelSlug(result.slug);
        setSuccess(true);
        try {
          if (result.owner_id) {
            await supabase.functions.invoke('send-owner-notification', {
              body: {
                ownerId: result.owner_id,
                type: 'referral_redeemed',
                payload: {
                  code: code.trim(),
                  email: email.trim(),
                  accountId: accountId.trim(),
                  spins: result.spins || 1,
                  label: result.label || `Resgate ${tag}`,
                },
              },
            });
          }
        } catch {}
        toast.success('Giro resgatado com sucesso!');
      } else {
        toast.error(result?.error || 'Erro ao resgatar');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao resgatar');
    }
    setSubmitting(false);
  };

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
    : <div className="text-4xl">{cfg.iconEmoji || '🎁'}</div>;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!pageData || !linkData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="text-6xl">🚫</div>
          <h1 className="text-xl font-bold text-foreground">Página Inválida</h1>
          <p className="text-muted-foreground text-sm">Esta página de resgate não existe ou foi desativada.</p>
        </div>
      </div>
    );
  }

  if (success) {
    const accent = cfg.btnBgColor || '#00e5ff';
    return (
      <SlotMachineSuccess
        accentColor={accent}
        titleColor={cfg.titleColor || '#ffffff'}
        subtitleColor={cfg.subtitleColor || 'rgba(255,255,255,0.7)'}
        btnBgColor={cfg.successBtnBgColor || cfg.btnBgColor || accent}
        btnTextColor={cfg.successBtnTextColor || cfg.btnTextColor || '#000000'}
        successTitle={cfg.successTitle || 'Giro Liberado!'}
        successSubtitle={cfg.successSubtitle || `Você recebeu ${spinsGranted} giro(s) na roleta!`}
        successBtnText={cfg.successBtnText || '🎰 Ir para a Roleta'}
        successBgColor={slotCfg.successBgColor || cfg.bgColor || `radial-gradient(ellipse at center, ${cfg.bgGradientFrom} 0%, ${cfg.bgGradientTo} 70%)`}
        slotMatchIcon={slotCfg.slotMatchIcon || '🎉'}
        slotReelImages={[slotCfg.slotReelImage1, slotCfg.slotReelImage2, slotCfg.slotReelImage3].filter(Boolean)}
        slotLuckyText={slotCfg.slotLuckyText || '🎰 BOA SORTE! 🎰'}
        slotReelBgColor={slotCfg.slotReelBgColor}
        slotFrameBgColor={slotCfg.slotFrameBgColor}
        slotFrameBorderColor={slotCfg.slotFrameBorderColor}
        ctaUrl={undefined}
        onCtaClick={wheelSlug ? () => navigate(`/${wheelSlug}`) : undefined}
        showCta={!!wheelSlug}
      />
    );
  }

  const titleText = cfg.titleText || linkData?.label || 'Resgatar Giro';
  const displayTitle = cfg.titlePrefix ? `${cfg.titlePrefix} ${titleText}` : titleText;

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
          <h1 className="text-xl font-bold text-foreground" style={titleStyle}>{displayTitle}</h1>
          <p className="text-sm text-muted-foreground" style={subtitleStyle}>
            Informe o código de resgate e seus dados para receber{' '}
            <span className="font-bold" style={{ color: cfg.btnBgColor || undefined }}>
              {linkData.spins_per_registration} giro(s)
            </span>
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={labelStyle}>
              Código de Resgate <span className="text-destructive">*</span>
            </label>
            <input
              type="text" value={code} onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="DIGITE SEU CÓDIGO" required
              className="w-full px-4 py-3 rounded-xl border text-sm font-mono uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground/50"
              style={inputStyle}
            />
          </div>
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

export default Resgate;
