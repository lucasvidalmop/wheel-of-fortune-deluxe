import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Gift, User, Mail, Phone, MapPin, Shield, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { GorjetaPageConfig, defaultGorjetaConfig } from '@/components/casino/GorjetaPageEditor';
import { UpdatePageConfig, defaultUpdatePageConfig } from '@/components/casino/UpdatePageEditor';
import AuthNoticeBanner from '@/components/AuthNoticeBanner';

const PIX_TYPES = [
  { value: '', label: 'Tipo' },
  { value: 'cpf', label: 'CPF' },
  { value: 'cnpj', label: 'CNPJ' },
  { value: 'email', label: 'E-mail' },
  { value: 'phone', label: 'Celular' },
  { value: 'random', label: 'Aleatória' },
];

const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};
const maskCpf = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};
const maskCnpj = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
};

const withAlpha = (color: string, alpha: number): string => {
  if (!color) return `rgba(0,0,0,${alpha})`;
  const c = color.trim();
  let hex = c;
  if (hex.startsWith('#')) {
    if (hex.length === 9) hex = hex.slice(0, 7);
    else if (hex.length === 5) hex = hex.slice(0, 4);
    if (hex.length === 4) hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    if (hex.length === 7) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  const m = c.match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    const parts = m[1].split(',').map(p => p.trim());
    if (parts.length >= 3) return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
  }
  return c;
};

interface Props {
  tag: string;
}

const UpdateRegistration = ({ tag }: Props) => {
  const [loading, setLoading] = useState(true);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [cfg, setCfg] = useState<GorjetaPageConfig>(defaultGorjetaConfig);
  const [upd, setUpd] = useState<UpdatePageConfig>(defaultUpdatePageConfig);
  const [pageEnabled, setPageEnabled] = useState(false);

  const [step, setStep] = useState<'lookup' | 'edit' | 'success'>('lookup');
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookupCpf, setLookupCpf] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [pixKeyType, setPixKeyType] = useState('');
  const [newAccountId, setNewAccountId] = useState('');

  // Stable session id for analytics tracking
  const sessionIdRef = (typeof window !== 'undefined') ? (() => {
    const k = 'pv_session_atualizacao';
    let s = sessionStorage.getItem(k);
    if (!s) { s = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; sessionStorage.setItem(k, s); }
    return s;
  })() : '';
  const [lookupOriginal, setLookupOriginal] = useState<any>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    const load = async () => {
      const { data, error } = await supabase.functions.invoke('get-update-page', { body: { tag } });
      if (error || !data?.found) {
        setLoading(false);
        return;
      }
      setOwnerId(data.ownerId);
      setCfg({ ...defaultGorjetaConfig, ...(data.gorjetaPageConfig || {}) });
      const u = { ...defaultUpdatePageConfig, ...(data.updatePageConfig || {}) };
      u.fields = { ...defaultUpdatePageConfig.fields, ...(data.updatePageConfig?.fields || {}) };
      setUpd(u);
      setPageEnabled(!!u.enabled);
      setLoading(false);

      try {
        supabase.functions.invoke('track-pageview', {
          body: {
            session_id: sessionIdRef,
            slug: tag,
            owner_id: data.ownerId,
            referrer: document.referrer || null,
            page_url: window.location.href,
            page_type: 'atualizacao',
          },
        });
      } catch { /* best-effort */ }

      const start = Date.now();
      const sendDur = () => {
        const seconds = Math.round((Date.now() - start) / 1000);
        try {
          const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-pageview`;
          const blob = new Blob([JSON.stringify({ session_id: sessionIdRef, action: 'update_duration', duration_seconds: seconds })], { type: 'application/json' });
          navigator.sendBeacon?.(url, blob);
        } catch { /* ignore */ }
      };
      window.addEventListener('beforeunload', sendDur);
      cleanup = () => window.removeEventListener('beforeunload', sendDur);
    };
    load();
    return () => { cleanup?.(); };
  }, [tag]);

  useEffect(() => {
    const block = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', block);
    return () => document.removeEventListener('contextmenu', block);
  }, []);

  // Inject SEO metatags and pixels for the update page
  useEffect(() => {
    const seo: any = (upd as any).seo || {};
    if (!seo || Object.keys(seo).length === 0) return;
    const addMeta = (name: string, content: string, property = false) => {
      if (!content) return;
      const sel = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
      let m = document.querySelector(sel) as HTMLMetaElement | null;
      if (!m) { m = document.createElement('meta'); property ? m.setAttribute('property', name) : m.setAttribute('name', name); document.head.appendChild(m); }
      m.setAttribute('content', content);
    };
    if (seo.pageTitle) document.title = seo.pageTitle;
    if (seo.faviconUrl) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = seo.faviconUrl;
    }
    if (seo.pageDescription) { addMeta('description', seo.pageDescription); addMeta('og:description', seo.pageDescription, true); }
    if (seo.pageTitle) addMeta('og:title', seo.pageTitle, true);
    if (seo.ogImage) addMeta('og:image', seo.ogImage, true);
    if (seo.keywords) addMeta('keywords', seo.keywords);
    if (seo.facebookPixelId) {
      const s = document.createElement('script');
      s.innerHTML = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${seo.facebookPixelId}');fbq('track','PageView');`;
      document.head.appendChild(s);
    }
    if (seo.googleAnalyticsId) {
      const g1 = document.createElement('script'); g1.async = true; g1.src = `https://www.googletagmanager.com/gtag/js?id=${seo.googleAnalyticsId}`;
      const g2 = document.createElement('script'); g2.innerHTML = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${seo.googleAnalyticsId}');`;
      document.head.appendChild(g1); document.head.appendChild(g2);
    }
    if (seo.gtmId) {
      const g = document.createElement('script');
      g.innerHTML = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${seo.gtmId}');`;
      document.head.appendChild(g);
    }
    if (seo.tiktokPixelId) {
      const t = document.createElement('script');
      t.innerHTML = `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${seo.tiktokPixelId}');ttq.page();}(window,document,'ttq');`;
      document.head.appendChild(t);
    }
    if (seo.customHeadScript) {
      const div = document.createElement('div');
      div.innerHTML = seo.customHeadScript;
      Array.from(div.childNodes).forEach(n => document.head.appendChild(n));
    }
  }, [upd]);

  const allowed = upd.fields || {};
  const anyFieldAllowed = !!(allowed.name || allowed.phone || allowed.cpf || allowed.pixKey || allowed.accountId);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const cpfDigits = lookupCpf.replace(/\D/g, '');
    if (!lookupEmail.trim() || cpfDigits.length < 11) {
      toast.error('Informe e-mail e CPF válidos');
      return;
    }
    if (!ownerId) return;
    setSubmitting(true);
    try {
      const { data, error } = await (supabase as any).rpc('update_wheel_user_self', {
        p_owner_id: ownerId,
        p_email: lookupEmail.trim(),
        p_cpf: cpfDigits,
        p_mode: 'lookup',
      });
      if (error) throw error;
      const r = typeof data === 'string' ? JSON.parse(data) : data;
      if (!r?.success) {
        toast.error(upd.notFoundText || 'Cadastro não encontrado.');
      } else {
        setName(r.user.name || '');
        setPhone(r.user.phone ? maskPhone(r.user.phone) : '');
        setPixKey(r.user.pix_key || '');
        setPixKeyType(r.user.pix_key_type || '');
        setNewAccountId(r.user.account_id || '');
        setLookupOriginal({
          name: r.user.name || '',
          phone: r.user.phone || '',
          pix_key: r.user.pix_key || '',
          pix_key_type: r.user.pix_key_type || '',
          account_id: r.user.account_id || '',
          wheel_user_id: r.user.id || null,
        });
        setStep('edit');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao buscar cadastro');
    }
    setSubmitting(false);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerId) return;
    setSubmitting(true);
    try {
      const { data, error } = await (supabase as any).rpc('update_wheel_user_self', {
        p_owner_id: ownerId,
        p_email: lookupEmail.trim(),
        p_cpf: lookupCpf.replace(/\D/g, ''),
        p_name: allowed.name ? name.trim() : null,
        p_phone: allowed.phone ? phone.replace(/\D/g, '') : null,
        p_pix_key: allowed.pixKey ? pixKey.trim() : null,
        p_pix_key_type: allowed.pixKey ? pixKeyType : null,
        p_new_account_id: allowed.accountId ? newAccountId.trim() : null,
        p_allowed_fields: allowed,
        p_mode: 'update',
      });
      if (error) throw error;
      const r = typeof data === 'string' ? JSON.parse(data) : data;
      if (r?.success) {
        // Detect which fields actually changed and log
        try {
          const orig = lookupOriginal || {};
          const newPhone = allowed.phone ? phone.replace(/\D/g, '') : orig.phone;
          const newName = allowed.name ? name.trim() : orig.name;
          const newPix = allowed.pixKey ? pixKey.trim() : orig.pix_key;
          const newPixType = allowed.pixKey ? pixKeyType : orig.pix_key_type;
          const newAcc = allowed.accountId ? newAccountId.trim() : orig.account_id;
          const changed: string[] = [];
          const before: any = {}; const after: any = {};
          if (allowed.name && (newName || '') !== (orig.name || '')) { changed.push('name'); before.name = orig.name; after.name = newName; }
          if (allowed.phone && (newPhone || '') !== (orig.phone || '')) { changed.push('phone'); before.phone = orig.phone; after.phone = newPhone; }
          if (allowed.pixKey && ((newPix || '') !== (orig.pix_key || '') || (newPixType || '') !== (orig.pix_key_type || ''))) {
            changed.push('pix_key'); before.pix_key = orig.pix_key; after.pix_key = newPix; before.pix_key_type = orig.pix_key_type; after.pix_key_type = newPixType;
          }
          if (allowed.accountId && (newAcc || '') !== (orig.account_id || '')) { changed.push('account_id'); before.account_id = orig.account_id; after.account_id = newAcc; }
          supabase.functions.invoke('log-registration-update', {
            body: {
              owner_id: ownerId,
              wheel_user_id: orig.wheel_user_id || null,
              user_email: lookupEmail.trim(),
              user_name: newName || orig.name || '',
              account_id: newAcc || orig.account_id || '',
              changed_fields: changed,
              before_data: before,
              after_data: after,
              referrer: document.referrer || null,
              page_url: window.location.href,
              session_id: sessionIdRef,
            },
          });
        } catch { /* best-effort */ }
        setStep('success');
      } else {
        const msg = r?.error === 'account_id_taken'
          ? 'Esse ID já está em uso em outro cadastro.'
          : r?.error || 'Erro ao atualizar';
        toast.error(msg);
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar');
    }
    setSubmitting(false);
  };

  // Styles (copiado do Registration.tsx para 100% de consistência visual)
  const accentColor = cfg.accentColor || cfg.btnBgColor || '#2dd4bf';
  const bgStyle: React.CSSProperties = (() => {
    const gradient = `radial-gradient(ellipse at center, ${cfg.bgGradientFrom || '#1e293b'} 0%, ${cfg.bgGradientTo || '#0f172a'} 70%)`;
    if (cfg.bgImage) {
      return {
        backgroundColor: cfg.bgColor || '#0d1117',
        backgroundImage: `url("${cfg.bgImage}"), ${gradient}`,
        backgroundSize: 'cover, auto',
        backgroundPosition: 'center, center',
        backgroundRepeat: 'no-repeat, no-repeat',
      };
    }
    if (cfg.bgColor) return { backgroundColor: cfg.bgColor, backgroundImage: gradient };
    return { backgroundColor: '#0d1117', backgroundImage: gradient };
  })();
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

  if (!ownerId || !pageEnabled || !anyFieldAllowed) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={bgStyle}>
        <div className="relative z-10 text-center space-y-5 max-w-sm mx-4 rounded-2xl p-8 border backdrop-blur-xl shadow-2xl"
          style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
          <div className="text-6xl">🔒</div>
          <h1 className="text-2xl font-bold" style={{ color: titleColor }}>Atualização indisponível</h1>
          <p className="text-sm" style={{ color: subtitleColor }}>
            Esta página de atualização não está ativa no momento.
          </p>
        </div>
      </div>
    );
  }

  const icon = cfg.iconUrl
    ? <img src={cfg.iconUrl} alt="logo" className="max-w-[200px] max-h-[80px] object-contain mx-auto" />
    : null;

  const inputCls = "w-full pl-10 pr-10 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-all placeholder:opacity-40";
  const inputStyle = { backgroundColor: inputBg, borderColor: inputBorder, color: inputText, '--tw-ring-color': withAlpha(accentColor, 0.251) } as any;

  return (
    <div className="min-h-screen flex flex-col items-center justify-start py-6 px-4 relative overflow-hidden" style={bgStyle}>
      {/* Header */}
      <div className="relative z-10 text-center space-y-3 mb-6">
        {icon}
        <p className="text-sm max-w-md mx-auto" style={{ color: subtitleColor }}>{upd.subtitleText}</p>
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border backdrop-blur-xl shadow-[0_8px_40px_rgba(0,0,0,0.5)] overflow-hidden"
        style={{ backgroundColor: cardBg, borderColor: cardBorder }}>

        {/* Card Header */}
        <div className="text-center pt-6 pb-4 px-6">
          <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-3"
            style={{ backgroundColor: withAlpha(accentColor, 0.082), border: `1.5px solid ${withAlpha(accentColor, 0.188)}` }}>
            {step === 'success' ? <CheckCircle2 size={24} style={{ color: accentColor }} /> : <RefreshCw size={24} style={{ color: accentColor }} />}
          </div>
          <h2 className="text-lg font-bold" style={{ color: titleColor }}>
            {step === 'success' ? upd.successTitle : upd.titleText}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: subtitleColor }}>
            {step === 'lookup' && 'Identifique-se para localizar seu cadastro'}
            {step === 'edit' && 'Atualize os dados liberados pelo responsável'}
            {step === 'success' && upd.successSubtitle}
          </p>
        </div>

        {/* Step: Lookup */}
        {step === 'lookup' && (
          <form onSubmit={handleLookup} className="px-6 pb-6 space-y-4">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: labelColor }}>E-mail</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: labelColor }} />
                <input type="email" value={lookupEmail} onChange={e => setLookupEmail(e.target.value)} placeholder="seu@email.com" required className={inputCls} style={inputStyle} />
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full" style={{ backgroundColor: lookupEmail ? accentColor : 'rgba(255,255,255,0.15)' }} />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: labelColor }}>CPF</label>
              <div className="relative">
                <Shield size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: labelColor }} />
                <input
                  type="text"
                  inputMode="numeric"
                  value={lookupCpf}
                  onChange={e => setLookupCpf(maskCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  required
                  className={inputCls}
                  style={inputStyle}
                />
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full" style={{ backgroundColor: lookupCpf ? accentColor : 'rgba(255,255,255,0.15)' }} />
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-3 rounded-xl text-xs"
              style={{ backgroundColor: withAlpha(accentColor, 0.031), border: `1px solid ${withAlpha(accentColor, 0.082)}`, color: subtitleColor }}>
              <AlertCircle size={16} className="shrink-0" style={{ color: accentColor }} />
              <span>Usaremos esses dados apenas para localizar seu cadastro.</span>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl font-bold text-sm uppercase tracking-wider hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
              style={{ backgroundColor: accentColor, color: cfg.btnTextColor || '#000000', boxShadow: `0 8px 25px ${withAlpha(accentColor, 0.188)}` }}
            >
              {submitting ? (
                <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Buscando...</>
              ) : (
                <><RefreshCw size={16} /> {upd.lookupBtnText || 'BUSCAR CADASTRO'}</>
              )}
            </button>
          </form>
        )}

        {/* Step: Edit */}
        {step === 'edit' && (
          <form onSubmit={handleUpdate} className="px-6 pb-6 space-y-4">
            {/* Identidade (somente leitura) */}
            <div className="p-3 rounded-xl text-xs space-y-1"
              style={{ backgroundColor: withAlpha(accentColor, 0.031), border: `1px solid ${withAlpha(accentColor, 0.082)}` }}>
              <div style={{ color: subtitleColor }}><span style={{ color: accentColor }} className="font-semibold">E-mail:</span> {lookupEmail}</div>
              <div style={{ color: subtitleColor }}><span style={{ color: accentColor }} className="font-semibold">CPF:</span> {lookupCpf}</div>
            </div>

            {allowed.name && (
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: labelColor }}>Nome Completo</label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: labelColor }} />
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" className={inputCls} style={inputStyle} />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full" style={{ backgroundColor: name ? accentColor : 'rgba(255,255,255,0.15)' }} />
                </div>
              </div>
            )}

            {allowed.accountId && (
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: labelColor }}>
                  Novo ID da Conta {cfg.casinoName && <span style={{ color: accentColor }}>{cfg.casinoName}</span>}
                </label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: labelColor }} />
                  <input
                    type="text"
                    inputMode={cfg.accountIdMode === 'numeric' ? 'numeric' : 'text'}
                    value={newAccountId}
                    onChange={e => setNewAccountId(cfg.accountIdMode === 'numeric' ? e.target.value.replace(/\D/g, '') : e.target.value)}
                    placeholder="Novo ID"
                    className={inputCls}
                    style={inputStyle}
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full" style={{ backgroundColor: newAccountId ? accentColor : 'rgba(255,255,255,0.15)' }} />
                </div>
              </div>
            )}

            {allowed.phone && (
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: labelColor }}>Celular / WhatsApp</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: labelColor }} />
                  <input type="tel" value={phone} onChange={e => setPhone(maskPhone(e.target.value))} placeholder="(DD) 9XXXX-XXXX" className={inputCls} style={inputStyle} />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full" style={{ backgroundColor: phone ? accentColor : 'rgba(255,255,255,0.15)' }} />
                </div>
              </div>
            )}

            {allowed.cpf && (
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: labelColor }}>CPF</label>
                <div className="relative">
                  <Shield size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: labelColor }} />
                  <input type="text" value={cpf} onChange={e => setCpf(maskCpf(e.target.value))} placeholder="000.000.000-00" className={inputCls} style={inputStyle} />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full" style={{ backgroundColor: cpf ? accentColor : 'rgba(255,255,255,0.15)' }} />
                </div>
              </div>
            )}

            {allowed.pixKey && (
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: labelColor }}>Chave PIX</label>
                <div className="flex gap-2">
                  <div className="relative w-[130px] shrink-0">
                    <select
                      value={pixKeyType}
                      onChange={e => { setPixKeyType(e.target.value); setPixKey(''); }}
                      className="w-full py-3 px-3 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-all appearance-none cursor-pointer"
                      style={inputStyle}
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
                      style={inputStyle}
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full" style={{ backgroundColor: pixKey ? accentColor : 'rgba(255,255,255,0.15)' }} />
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl font-bold text-sm uppercase tracking-wider hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
              style={{ backgroundColor: accentColor, color: cfg.btnTextColor || '#000000', boxShadow: `0 8px 25px ${withAlpha(accentColor, 0.188)}` }}
            >
              {submitting ? (
                <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Atualizando...</>
              ) : (
                <><Gift size={16} /> {upd.btnText || 'SALVAR ATUALIZAÇÃO'}</>
              )}
            </button>
          </form>
        )}

        {/* Step: Success */}
        {step === 'success' && (
          <div className="px-6 pb-6 space-y-4 text-center">
            <p className="text-sm" style={{ color: subtitleColor }}>{upd.successSubtitle}</p>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 pb-5 text-center space-y-3">
          <div className="text-[10px] space-y-1" style={{ color: subtitleColor }}>
            <p>{cfg.footerText || `© ${new Date().getFullYear()} ${cfg.casinoName ? `${cfg.casinoName.toUpperCase()}!` : ''} Todos os direitos reservados.`}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpdateRegistration;
