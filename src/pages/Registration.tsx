import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { GorjetaPageConfig, defaultGorjetaConfig } from '@/components/casino/GorjetaPageEditor';
import { Gift, User, Mail, Phone, MapPin, Key, AlertCircle, Shield, CheckSquare } from 'lucide-react';
import SlotMachineSuccess from '@/components/casino/SlotMachineSuccess';

const PIX_TYPES = [
  { value: '', label: 'Tipo' },
  { value: 'cpf', label: 'CPF' },
  { value: 'cnpj', label: 'CNPJ' },
  { value: 'email', label: 'E-mail' },
  { value: 'phone', label: 'Celular' },
  { value: 'random', label: 'Aleatória' },
];

const Registration = () => {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('ref') || '';
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [linkData, setLinkData] = useState<any>(null);
  const [cfg, setCfg] = useState<GorjetaPageConfig>(defaultGorjetaConfig);
  const [wheelSlug, setWheelSlug] = useState('');
  const [seoConfig, setSeoConfig] = useState<any>({});

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [accountId, setAccountId] = useState('');
  const [pixKeyType, setPixKeyType] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [confirmData, setConfirmData] = useState(false);

  const maskPhone = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`;
    return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  };
  const maskCpf = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  };
  const maskCnpj = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 14);
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0,2)}.${d.slice(2)}`;
    if (d.length <= 8) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`;
    if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`;
    return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
  };

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [spinsGranted, setSpinsGranted] = useState(0);
  const [showTerms, setShowTerms] = useState(false);

  useEffect(() => {
    const fetchLink = async () => {
      if (!code) { setLoading(false); return; }
      const { data, error } = await (supabase as any)
        .from('referral_links')
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .maybeSingle();
      if (error || !data) {
        toast.error('Link inválido ou desativado');
      } else {
        setLinkData(data);
        const { data: wcData } = await (supabase as any)
          .from('wheel_configs')
          .select('slug, config')
          .eq('user_id', data.owner_id)
          .maybeSingle();
        if (wcData?.slug) setWheelSlug(wcData.slug);
        const gorjetaCfg = wcData?.config?.gorjetaPageConfig || {};
        setCfg({ ...defaultGorjetaConfig, ...gorjetaCfg });
        const seo = wcData?.config?.gorjetaSeo || {};
        setSeoConfig(seo);
      }
      setLoading(false);
    };
    fetchLink();
  }, [code]);

  // Track pageview
  useEffect(() => {
    if (!linkData) return;
    const sessionId = (() => {
      let sid = sessionStorage.getItem('pv_session_gorjeta');
      if (!sid) { sid = crypto.randomUUID(); sessionStorage.setItem('pv_session_gorjeta', sid); }
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
        page_type: 'gorjeta',
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

  // Inject SEO metatags and pixels
  useEffect(() => {
    if (!seoConfig || Object.keys(seoConfig).length === 0) return;
    const cleanups: (() => void)[] = [];
    const addMeta = (property: string, content: string) => {
      if (!content) return;
      const existing = document.querySelector(`meta[property="${property}"]`) || document.querySelector(`meta[name="${property}"]`);
      if (existing) { existing.setAttribute('content', content); return; }
      const meta = document.createElement('meta');
      if (property.startsWith('og:')) { meta.setAttribute('property', property); } else { meta.setAttribute('name', property); }
      meta.setAttribute('content', content);
      document.head.appendChild(meta);
      cleanups.push(() => meta.remove());
    };
    // Page title (tab name)
    const pageTitle = seoConfig.pageTitle || seoConfig.ogTitle;
    if (pageTitle) { document.title = pageTitle; }
    // Favicon
    if (seoConfig.faviconUrl) {
      let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      const oldHref = link?.getAttribute('href');
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); cleanups.push(() => link.remove()); }
      link.href = seoConfig.faviconUrl;
      cleanups.push(() => { if (oldHref) link.href = oldHref; });
    }
    // Meta description
    const pageDesc = seoConfig.pageDescription || seoConfig.ogDescription;
    if (pageDesc) { addMeta('description', pageDesc); }
    // OG tags
    if (pageTitle) { addMeta('og:title', pageTitle); }
    if (pageDesc) { addMeta('og:description', pageDesc); }
    if (seoConfig.ogImage) { addMeta('og:image', seoConfig.ogImage); }
    if (seoConfig.keywords) { addMeta('keywords', seoConfig.keywords); }
    if (seoConfig.facebookPixelId) {
      const s = document.createElement('script');
      s.innerHTML = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${seoConfig.facebookPixelId}');fbq('track','PageView');`;
      document.head.appendChild(s); cleanups.push(() => s.remove());
    }
    if (seoConfig.googleAnalyticsId) {
      const g1 = document.createElement('script'); g1.async = true; g1.src = `https://www.googletagmanager.com/gtag/js?id=${seoConfig.googleAnalyticsId}`;
      const g2 = document.createElement('script'); g2.innerHTML = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${seoConfig.googleAnalyticsId}');`;
      document.head.appendChild(g1); document.head.appendChild(g2); cleanups.push(() => { g1.remove(); g2.remove(); });
    }
    if (seoConfig.gtmId) {
      const g = document.createElement('script');
      g.innerHTML = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${seoConfig.gtmId}');`;
      document.head.appendChild(g); cleanups.push(() => g.remove());
    }
    if (seoConfig.tiktokPixelId) {
      const t = document.createElement('script');
      t.innerHTML = `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${seoConfig.tiktokPixelId}');ttq.page();}(window,document,'ttq');`;
      document.head.appendChild(t); cleanups.push(() => t.remove());
    }
    if (seoConfig.customHeadScript) {
      const div = document.createElement('div');
      div.innerHTML = seoConfig.customHeadScript;
      Array.from(div.children).forEach(child => { document.head.appendChild(child); cleanups.push(() => child.remove()); });
    }
    return () => cleanups.forEach(fn => fn());
  }, [seoConfig]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !accountId.trim()) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }
    if (!acceptTerms || !confirmData) {
      toast.error('Você precisa aceitar os termos e confirmar os dados');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await (supabase as any).rpc('register_via_referral', {
        p_code: code || '',
        p_email: email.trim(),
        p_account_id: accountId.trim(),
        p_name: name.trim(),
        p_cpf: cpf.replace(/\D/g, ''),
        p_phone: phone.replace(/\D/g, ''),
        p_pix_key: pixKey.trim(),
        p_pix_key_type: pixKeyType,
      });
      if (error) throw error;
      const result = typeof data === 'string' ? JSON.parse(data) : data;
      if (result?.success) {
        setSpinsGranted(result.spins || 1);
        if (result.slug) setWheelSlug(result.slug);
        setSuccess(true);

        toast.success('Inscrição realizada com sucesso!');
      } else {
        toast.error(result?.error || 'Erro ao registrar');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registrar');
    }
    setSubmitting(false);
  };

  // ─── Styles ───
  const accentColor = cfg.accentColor || cfg.btnBgColor || '#2dd4bf';

  const bgStyle: React.CSSProperties = {
    background: cfg.bgColor || `radial-gradient(ellipse at center, ${cfg.bgGradientFrom} 0%, ${cfg.bgGradientTo} 70%)`,
    ...(cfg.bgImage ? { backgroundImage: `url(${cfg.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}),
  };

  const cardBg = cfg.cardBgColor || 'rgba(20, 25, 40, 0.92)';
  const cardBorder = cfg.cardBorderColor || 'rgba(255,255,255,0.06)';
  const inputBg = cfg.inputBgColor || 'rgba(255,255,255,0.04)';
  const inputBorder = cfg.inputBorderColor || 'rgba(255,255,255,0.08)';
  const inputText = cfg.inputTextColor || '#ffffff';
  const labelColor = cfg.labelColor || 'rgba(255,255,255,0.5)';
  const titleColor = cfg.titleColor || '#ffffff';
  const subtitleColor = cfg.subtitleColor || 'rgba(255,255,255,0.55)';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d1117' }}>
        <div className="animate-pulse text-white/50">Carregando...</div>
      </div>
    );
  }

  if (!linkData) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d1117' }}>
        <div className="text-center space-y-4">
          <div className="text-6xl">🚫</div>
          <h1 className="text-xl font-bold text-white">Link Inválido</h1>
          <p className="text-white/50 text-sm">Este link de inscrição não existe ou foi desativado.</p>
        </div>
      </div>
    );
  }

  const isLimitReached = linkData.max_registrations != null && linkData.registrations_count >= linkData.max_registrations;
  const isExpired = linkData.expires_at && new Date(linkData.expires_at) <= new Date();

  if (isExpired || isLimitReached) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={bgStyle}>
        <div className="relative z-10 text-center space-y-5 max-w-sm mx-4 rounded-2xl p-8 border backdrop-blur-xl shadow-2xl"
          style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
          <div className="text-6xl">{isExpired ? '⏳' : '⏰'}</div>
          <h1 className="text-2xl font-bold" style={{ color: titleColor }}>
            {isExpired ? (cfg.expiredTitle || 'Promoção Encerrada') : (cfg.limitTitle || 'Inscrições Esgotadas')}
          </h1>
          <p className="text-sm" style={{ color: subtitleColor }}>
            {isExpired ? (cfg.expiredSubtitle || 'O prazo desta promoção expirou.') : (cfg.limitSubtitle || 'Este link atingiu o limite máximo de inscrições.')}
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    const successCtaUrl = cfg.successCtaUrl || cfg.ctaBtnUrl || '';
    return (
      <SlotMachineSuccess
        accentColor={accentColor}
        titleColor={titleColor}
        subtitleColor={subtitleColor}
        btnBgColor={cfg.ctaBtnBgColor || accentColor}
        btnTextColor={cfg.ctaBtnTextColor || cfg.btnTextColor || '#000000'}
        successTitle={cfg.successTitle || 'CADASTRO EFETUADO!'}
        successSubtitle={cfg.successSubtitle || 'Agora é só aguardar o sorteio...'}
        successBtnText={cfg.successBtnText || 'VOCÊ PODE SER O PRÓXIMO GANHADOR!'}
        slotMatchIcon={cfg.slotMatchIcon || '⚡'}
        slotMatchImageUrl={cfg.slotMatchImageUrl}
        slotLuckyText={cfg.slotLuckyText || '🎰 BOA SORTE! 🎰'}
        slotReelBgColor={cfg.slotReelBgColor}
        slotFrameBgColor={cfg.slotFrameBgColor}
        slotFrameBorderColor={cfg.slotFrameBorderColor}
        successBgColor={cfg.successBgColor}
        ctaUrl={successCtaUrl}
        showCta={cfg.successCtaShow !== false && !!successCtaUrl}
      />
    );
  }

  const icon = cfg.iconUrl
    ? <img src={cfg.iconUrl} alt="logo" className="max-w-[200px] max-h-[80px] object-contain mx-auto" />
    : null;

  const headerText = cfg.subtitleText || 'Cadastre-se agora e concorra a prêmios incríveis todos os dias!';

  return (
    <div className="min-h-screen flex flex-col items-center justify-start py-6 px-4 relative overflow-hidden" style={bgStyle}>
      {!cfg.bgImage && !cfg.bgColor && <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, ${cfg.bgGradientFrom} 0%, ${cfg.bgGradientTo} 70%)` }} />}

      {/* Header */}
      <div className="relative z-10 text-center space-y-3 mb-6">
        {icon}
        <p className="text-sm max-w-md mx-auto" style={{ color: subtitleColor }}>{headerText}</p>
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border backdrop-blur-xl shadow-[0_8px_40px_rgba(0,0,0,0.5)] overflow-hidden"
        style={{ backgroundColor: cardBg, borderColor: cardBorder }}>

        {/* Card Header */}
        <div className="text-center pt-6 pb-4 px-6">
          <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-3"
            style={{ backgroundColor: `${accentColor}15`, border: `1.5px solid ${accentColor}30` }}>
            <Gift size={24} style={{ color: accentColor }} />
          </div>
          <h2 className="text-lg font-bold" style={{ color: titleColor }}>{cfg.titleText || 'Participar'}</h2>
          <p className="text-xs mt-0.5" style={{ color: subtitleColor }}>Preencha seus dados para participar</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          {/* Nome */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: labelColor }}>Nome Completo</label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: `${labelColor}` }} />
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Qual seu nome completo"
                required
                className="w-full pl-10 pr-10 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-all placeholder:opacity-40"
                style={{ backgroundColor: inputBg, borderColor: inputBorder, color: inputText, '--tw-ring-color': `${accentColor}40` } as any}
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full" style={{ backgroundColor: name ? accentColor : 'rgba(255,255,255,0.15)' }} />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: labelColor }}>E-mail</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: `${labelColor}` }} />
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="w-full pl-10 pr-10 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-all placeholder:opacity-40"
                style={{ backgroundColor: inputBg, borderColor: inputBorder, color: inputText, '--tw-ring-color': `${accentColor}40` } as any}
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full" style={{ backgroundColor: email ? accentColor : 'rgba(255,255,255,0.15)' }} />
            </div>
          </div>

          {/* Celular */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: labelColor }}>Celular</label>
            <div className="relative">
              <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: `${labelColor}` }} />
              <input
                type="tel" value={phone} onChange={e => setPhone(maskPhone(e.target.value))}
                placeholder="(DD) 9XXXX-XXXX"
                className="w-full pl-10 pr-10 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-all placeholder:opacity-40"
                style={{ backgroundColor: inputBg, borderColor: inputBorder, color: inputText, '--tw-ring-color': `${accentColor}40` } as any}
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full" style={{ backgroundColor: phone ? accentColor : 'rgba(255,255,255,0.15)' }} />
            </div>
          </div>

          {/* CPF */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: labelColor }}>CPF</label>
            <div className="relative">
              <Shield size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: `${labelColor}` }} />
              <input
                type="text" value={cpf} onChange={e => setCpf(maskCpf(e.target.value))}
                placeholder="000.000.000-00"
                className="w-full pl-10 pr-10 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-all placeholder:opacity-40"
                style={{ backgroundColor: inputBg, borderColor: inputBorder, color: inputText, '--tw-ring-color': `${accentColor}40` } as any}
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full" style={{ backgroundColor: cpf ? accentColor : 'rgba(255,255,255,0.15)' }} />
            </div>
          </div>

          {/* ID da Conta */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: labelColor }}>
              ID da Conta {cfg.casinoName && <span style={{ color: accentColor }}>{cfg.casinoName}</span>}
            </label>
            <div className="relative">
              <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: `${labelColor}` }} />
              <input
                type="text" value={accountId} onChange={e => setAccountId(e.target.value)}
                placeholder={cfg.casinoName ? `Seu ID de usuário ${cfg.casinoName}` : 'Seu ID de usuário'}
                required
                className="w-full pl-10 pr-10 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-all placeholder:opacity-40"
                style={{ backgroundColor: inputBg, borderColor: inputBorder, color: inputText, '--tw-ring-color': `${accentColor}40` } as any}
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full" style={{ backgroundColor: accountId ? accentColor : 'rgba(255,255,255,0.15)' }} />
            </div>
          </div>

          {/* Chave PIX */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: labelColor }}>Chave PIX</label>
            <div className="flex gap-2">
              <div className="relative w-[130px] shrink-0">
                <select
                  value={pixKeyType}
                  onChange={e => { setPixKeyType(e.target.value); setPixKey(''); }}
                  className="w-full py-3 px-3 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-all appearance-none cursor-pointer"
                  style={{ backgroundColor: inputBg, borderColor: inputBorder, color: inputText, '--tw-ring-color': `${accentColor}40` } as any}
                >
                  {PIX_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: labelColor }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              <div className="relative flex-1">
                <input
                  type={pixKeyType === 'email' ? 'email' : 'text'}
                  value={pixKey}
                  onChange={e => {
                    const v = e.target.value;
                    if (pixKeyType === 'cpf') setPixKey(maskCpf(v));
                    else if (pixKeyType === 'cnpj') setPixKey(maskCnpj(v));
                    else if (pixKeyType === 'phone') setPixKey(maskPhone(v));
                    else setPixKey(v);
                  }}
                  placeholder={
                    pixKeyType === 'cpf' ? '000.000.000-00' :
                    pixKeyType === 'cnpj' ? '00.000.000/0000-00' :
                    pixKeyType === 'phone' ? '(DD) 9XXXX-XXXX' :
                    pixKeyType === 'email' ? 'email@exemplo.com' :
                    'Chave aleatória'
                  }
                  className="w-full px-3.5 pr-10 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-all placeholder:opacity-40"
                  style={{ backgroundColor: inputBg, borderColor: inputBorder, color: inputText, '--tw-ring-color': `${accentColor}40` } as any}
                />
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full" style={{ backgroundColor: pixKey ? accentColor : 'rgba(255,255,255,0.15)' }} />
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-center gap-2.5 p-3 rounded-xl text-xs"
            style={{ backgroundColor: `${accentColor}08`, border: `1px solid ${accentColor}15`, color: subtitleColor }}>
            <AlertCircle size={16} className="shrink-0" style={{ color: accentColor }} />
            <span>{cfg.warningText || 'Importante: Prazo de até 72h para crédito.'}</span>
          </div>

          {/* Checkboxes */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2.5">
              <div
                onClick={() => setAcceptTerms(!acceptTerms)}
                className="w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 cursor-pointer"
                style={{
                  borderColor: acceptTerms ? accentColor : 'rgba(255,255,255,0.15)',
                  backgroundColor: acceptTerms ? accentColor : 'transparent',
                }}
              >
                {acceptTerms && <svg className="w-3 h-3" fill="none" stroke="#000" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </div>
              <span className="text-xs cursor-pointer" onClick={() => setAcceptTerms(!acceptTerms)} style={{ color: subtitleColor }}>
                Aceito os <button type="button" onClick={(e) => { e.stopPropagation(); setShowTerms(true); }} className="font-semibold underline cursor-pointer" style={{ color: accentColor }}>Termos de Uso</button>.
              </span>
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <div
                onClick={() => setConfirmData(!confirmData)}
                className="w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 cursor-pointer"
                style={{
                  borderColor: confirmData ? accentColor : 'rgba(255,255,255,0.15)',
                  backgroundColor: confirmData ? accentColor : 'transparent',
                }}
              >
                {confirmData && <svg className="w-3 h-3" fill="none" stroke="#000" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </div>
              <span className="text-xs" style={{ color: subtitleColor }}>
                Confirmo que os dados são da minha conta{cfg.casinoName ? <span style={{ color: accentColor }}> {cfg.casinoName}</span> : ''}.
              </span>
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-xl font-bold text-sm uppercase tracking-wider hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
            style={{
              backgroundColor: accentColor,
              color: cfg.btnTextColor || '#000000',
              boxShadow: `0 8px 25px ${accentColor}30`,
            }}
          >
            {submitting ? (
              <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Verificando...</>
            ) : (
              <><Gift size={16} /> {cfg.btnText || 'PARTICIPAR DO SORTEIO'}</>
            )}
          </button>

          {/* Security note */}
          <div className="flex items-center justify-center gap-1.5 text-[10px]" style={{ color: `${accentColor}90` }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accentColor }} />
            Seus dados estão seguros
          </div>
        </form>

        {/* CTA Button */}
        {cfg.ctaBtnShow !== false && cfg.ctaBtnUrl && (
          <div className="px-6 pb-4">
            <a
              href={cfg.ctaBtnUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-3.5 rounded-xl font-bold text-sm uppercase tracking-wider text-center transition-all hover:brightness-110"
              style={{
                backgroundColor: cfg.ctaBtnBgColor || '#ffffff',
                color: cfg.ctaBtnTextColor || '#000000',
                border: `1px solid ${cfg.ctaBtnBorderColor || 'rgba(255,255,255,0.1)'}`,
              }}
            >
              {cfg.ctaBtnText
                ? cfg.ctaBtnText.replace('{casino}', cfg.casinoName || '')
                : `CRIE SUA CONTA NA ${cfg.casinoName || 'PLATAFORMA'} PARA PARTICIPAR DE TODOS OS SORTEIOS!`}
            </a>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 pb-5 text-center space-y-3">
          <div className="text-[10px] space-y-1" style={{ color: subtitleColor }}>
            <p>{cfg.footerText || `© ${new Date().getFullYear()} ${cfg.casinoName ? `${cfg.casinoName.toUpperCase()}!` : ''} Todos os direitos reservados.`}</p>
            {cfg.casinoName && cfg.ctaBtnUrl && (
              <a href={cfg.ctaBtnUrl} target="_blank" rel="noopener noreferrer" className="font-semibold" style={{ color: accentColor }}>{cfg.casinoName}</a>
            )}
          </div>
        </div>
      </div>

      {/* Terms Modal */}
      {showTerms && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowTerms(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative z-10 w-full max-w-md max-h-[80vh] rounded-2xl border flex flex-col overflow-hidden"
            style={{ backgroundColor: cardBg, borderColor: cardBorder }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: cardBorder }}>
              <h3 className="text-base font-bold" style={{ color: accentColor }}>{cfg.termsTitle || 'Termos de Uso – Gorjeta'}</h3>
              <button onClick={() => setShowTerms(false)} className="text-white/40 hover:text-white transition text-xl leading-none">✕</button>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: subtitleColor }}>
                {cfg.termsContent || defaultGorjetaConfig.termsContent}
              </div>
            </div>
            {/* Footer */}
            <div className="px-5 py-4 border-t" style={{ borderColor: cardBorder }}>
              <button
                onClick={() => setShowTerms(false)}
                className="w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wider hover:brightness-110 transition"
                style={{ backgroundColor: accentColor, color: cfg.btnTextColor || '#000000' }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Registration;