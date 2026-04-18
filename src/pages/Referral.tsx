import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import SlotMachineSuccess from '@/components/casino/SlotMachineSuccess';
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
  const [slotCfg, setSlotCfg] = useState<any>({});
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

        // Load shared slot machine config from gorjetaPageConfig
        const gorjetaSlot = wcData?.config?.gorjetaPageConfig || {};
        setSlotCfg(gorjetaSlot);

        const defaultCfg = wcData?.config?.defaultReferralPageConfig || {};
        const individualCfg = data.page_config && Object.keys(data.page_config).length > 0 ? data.page_config : {};
        setCfg({ ...defaultPageConfig, ...defaultCfg, ...individualCfg });
      }
      setLoading(false);
    };
    fetchLink();
  }, [code]);

  // SEO + Pixel injection
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

    const pageTitle = (cfg as any).seoTitle || cfg.titleText || linkData?.label || 'Roleta de Prêmios';
    document.title = pageTitle;
    addMeta('description', (cfg as any).seoDescription || '');
    addMeta('og:title', pageTitle);
    addMeta('og:description', (cfg as any).seoDescription || '');
    if ((cfg as any).seoOgImageUrl) addMeta('og:image', (cfg as any).seoOgImageUrl);
    addMeta('twitter:card', 'summary_large_image');
    addMeta('twitter:title', pageTitle);
    addMeta('twitter:description', (cfg as any).seoDescription || '');
    if ((cfg as any).seoOgImageUrl) addMeta('twitter:image', (cfg as any).seoOgImageUrl);

    // Favicon — usa o do operador, ou cai no padrão global do sistema
    (async () => {
      let faviconUrl = (cfg as any).seoFaviconUrl as string | undefined;
      if (!faviconUrl) {
        const { getGlobalFavicon } = await import('@/lib/applyGlobalFavicon');
        faviconUrl = await getGlobalFavicon();
      }
      if (!faviconUrl) return;
      let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
      const hadExisting = !!link;
      const oldHref = link?.href;
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = faviconUrl;
      cleanups.push(() => {
        if (!hadExisting) link?.remove();
        else if (link && oldHref) link.href = oldHref;
      });
    })();

    // Facebook Pixel
    if ((cfg as any).pixelFacebook) {
      const script = document.createElement('script');
      script.textContent = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${(cfg as any).pixelFacebook}');fbq('track','PageView');`;
      document.head.appendChild(script);
      cleanups.push(() => script.remove());
    }

    // Google Analytics / GTM
    if ((cfg as any).pixelGoogle) {
      const id = (cfg as any).pixelGoogle.trim();
      if (id.startsWith('GTM-')) {
        const script = document.createElement('script');
        script.textContent = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${id}');`;
        document.head.appendChild(script);
        cleanups.push(() => script.remove());
      } else {
        const s1 = document.createElement('script');
        s1.async = true;
        s1.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
        document.head.appendChild(s1);
        const s2 = document.createElement('script');
        s2.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');`;
        document.head.appendChild(s2);
        cleanups.push(() => { s1.remove(); s2.remove(); });
      }
    }

    // TikTok Pixel
    if ((cfg as any).pixelTikTok) {
      const script = document.createElement('script');
      script.textContent = `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e+"_"+n]=+new Date;(ttq._o=ttq._o||{})[e+"_"+n]=n||{};var o=document.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${(cfg as any).pixelTikTok}');ttq.page();}(window,document,'ttq');`;
      document.head.appendChild(script);
      cleanups.push(() => script.remove());
    }

    // Custom head scripts
    if ((cfg as any).pixelCustomHead) {
      const container = document.createElement('div');
      container.innerHTML = (cfg as any).pixelCustomHead;
      Array.from(container.children).forEach(child => {
        document.head.appendChild(child);
        cleanups.push(() => child.remove());
      });
    }

    return () => cleanups.forEach(fn => fn());
  }, [cfg, linkData]);

  // Track pageview
  useEffect(() => {
    if (!linkData) return;
    const sessionId = (() => {
      let sid = sessionStorage.getItem('pv_session_ref');
      if (!sid) { sid = crypto.randomUUID(); sessionStorage.setItem('pv_session_ref', sid); }
      return sid;
    })();
    const startTime = Date.now();

    supabase.functions.invoke('track-pageview', {
      body: {
        session_id: sessionId,
        slug: code || null,
        owner_id: linkData.owner_id,
        referrer: document.referrer || null,
        page_url: window.location.href,
        page_type: 'referral',
      },
    }).catch(() => {});

    const durationInterval = setInterval(() => {
      const seconds = Math.round((Date.now() - startTime) / 1000);
      supabase.functions.invoke('track-pageview', {
        body: { session_id: sessionId, action: 'update_duration', duration_seconds: seconds },
      }).catch(() => {});
    }, 30000);

    const handleUnload = () => {
      const seconds = Math.round((Date.now() - startTime) / 1000);
      navigator.sendBeacon?.(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-pageview`,
        JSON.stringify({ session_id: sessionId, action: 'update_duration', duration_seconds: seconds })
      );
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(durationInterval);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [linkData]);

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
                  code: code?.toUpperCase() || '',
                  email: email.trim(),
                  accountId: accountId.trim(),
                  spins: result.spins || 1,
                  label: result.label || '',
                },
              },
            });
          }
        } catch (notifyErr) {
          console.error('Referral notification failed:', notifyErr);
        }

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

  const titleText = cfg.titleText || linkData?.label || 'Resgatar Giro';
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
