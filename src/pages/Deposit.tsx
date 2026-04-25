import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { User, Smartphone, CreditCard, Copy, CheckCircle2 } from 'lucide-react';

interface DepositConfig {
  enabled: boolean;
  tag: string;
  accountIdLabel: string;
  presetValues: number[];
  minimumValue: number;
  allowCustomValue: boolean;
  description: string;
  bgColor: string;
  accentColor: string;
  textColor: string;
  logoUrl: string;
  bgImageUrl: string;
  seoTitle: string;
  seoDescription: string;
  seoFaviconUrl: string;
  seoOgImageUrl: string;
  pixelFacebook: string;
  pixelGoogle: string;
  pixelTiktok: string;
  customHeadScript: string;
  confirmationTitle: string;
  confirmationMessage: string;
  confirmationLogoUrl: string;
  confirmationButtonText: string;
  confirmationButtonUrl: string;
  confirmationButtonColor: string;
  showNewDepositButton: boolean;
  // BS-only limits (Depósito BS — /depbs=tag)
  bsMaxPerDeposit?: number; // 0 = sem limite
  bsMaxTotal?: number;      // 0 = sem limite
  bsMaxCount?: number;      // 0 = sem limite
  bsLimitReachedMessage?: string;
}

const defaultDepositConfig: DepositConfig = {
  enabled: false,
  tag: '',
  accountIdLabel: 'ID da Conta',
  presetValues: [10, 20, 50, 100],
  minimumValue: 10,
  allowCustomValue: true,
  description: 'Selecione um valor para depósito',
  bgColor: '#0a0a0f',
  accentColor: '#10b981',
  textColor: '#ffffff',
  logoUrl: '',
  bgImageUrl: '',
  seoTitle: '',
  seoDescription: '',
  seoFaviconUrl: '',
  seoOgImageUrl: '',
  pixelFacebook: '',
  pixelGoogle: '',
  pixelTiktok: '',
  customHeadScript: '',
  confirmationTitle: 'Pagamento Confirmado!',
  confirmationMessage: 'Seu depósito foi recebido com sucesso.',
  confirmationLogoUrl: '',
  confirmationButtonText: 'Acessar →',
  confirmationButtonUrl: '',
  confirmationButtonColor: '',
  showNewDepositButton: true,
};

interface DepositLabels {
  nameLabel?: string;
  namePlaceholder?: string;
  accountLabel?: string;
  accountPlaceholder?: string;
  whatsappLabel?: string;
}

const Deposit = ({ tag: tagProp, labels, variant }: { tag?: string; labels?: DepositLabels; variant?: 'default' | 'bs' }) => {
  const params = useParams<{ tag: string }>();
  const tag = tagProp || params.tag || '';
  const isBs = variant === 'bs';
  const nameLabel = labels?.nameLabel ?? 'Nome completo';
  const namePlaceholder = labels?.namePlaceholder ?? 'Seu nome';
  const whatsappLabel = labels?.whatsappLabel ?? 'WhatsApp';
  const [loading, setLoading] = useState(true);
  const [ownerId, setOwnerId] = useState('');
  const [config, setConfig] = useState<DepositConfig>(defaultDepositConfig);
  const [notFound, setNotFound] = useState(false);
  const [bsStats, setBsStats] = useState<{ total: number; count: number } | null>(null);
  const accountLabel = labels?.accountLabel ?? config.accountIdLabel;
  const accountPlaceholder = labels?.accountPlaceholder ?? config.accountIdLabel;

  const [name, setName] = useState('');
  const [accountId, setAccountId] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [step, setStep] = useState<'form' | 'amount' | 'qrcode' | 'confirmed'>('form');

  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');

  const [qrLoading, setQrLoading] = useState(false);
  const [qrData, setQrData] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [txId, setTxId] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const maskPhone = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };

  // Inject SEO + Pixels
  useEffect(() => {
    if (!config || !config.enabled) return;
    const cleanup: (() => void)[] = [];

    const origTitle = document.title;
    if (config.seoTitle) document.title = config.seoTitle;
    cleanup.push(() => { document.title = origTitle; });

    if (config.seoFaviconUrl) {
      const link = document.createElement('link');
      link.rel = 'icon';
      link.href = config.seoFaviconUrl;
      document.head.appendChild(link);
      cleanup.push(() => link.remove());
    }

    const addMeta = (prop: string, content: string) => {
      if (!content) return;
      const meta = document.createElement('meta');
      meta.setAttribute('property', prop);
      meta.content = content;
      document.head.appendChild(meta);
      cleanup.push(() => meta.remove());
    };
    addMeta('og:title', config.seoTitle || 'Depósito PIX');
    addMeta('og:description', config.seoDescription || '');
    addMeta('og:image', config.seoOgImageUrl || '');

    if (config.pixelFacebook) {
      const s = document.createElement('script');
      s.textContent = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${config.pixelFacebook}');fbq('track','PageView');`;
      document.head.appendChild(s);
      cleanup.push(() => s.remove());
    }

    if (config.pixelGoogle) {
      const id = config.pixelGoogle;
      if (id.startsWith('GTM-')) {
        const s = document.createElement('script');
        s.textContent = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${id}');`;
        document.head.appendChild(s);
        cleanup.push(() => s.remove());
      } else {
        const s1 = document.createElement('script');
        s1.async = true;
        s1.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
        document.head.appendChild(s1);
        const s2 = document.createElement('script');
        s2.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');`;
        document.head.appendChild(s2);
        cleanup.push(() => { s1.remove(); s2.remove(); });
      }
    }

    if (config.pixelTiktok) {
      const s = document.createElement('script');
      s.textContent = `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${config.pixelTiktok}');ttq.page();}(window,document,'ttq');`;
      document.head.appendChild(s);
      cleanup.push(() => s.remove());
    }

    if (config.customHeadScript) {
      const div = document.createElement('div');
      div.innerHTML = config.customHeadScript;
      Array.from(div.children).forEach(el => {
        document.head.appendChild(el);
        cleanup.push(() => el.remove());
      });
    }

    return () => cleanup.forEach(fn => fn());
  }, [config]);

  useEffect(() => {
    const fetchConfig = async () => {
      if (!tag) { setNotFound(true); setLoading(false); return; }

      const { data: rows, error } = await (supabase as any)
        .rpc('get_deposit_config_by_tag', { p_tag: tag });

      const match = Array.isArray(rows) ? rows[0] : null;
      if (error || !match) {
        setNotFound(true); setLoading(false); return;
      }

      const cfg = typeof match.config === 'string' ? JSON.parse(match.config) : match.config;
      setOwnerId(match.user_id);
      setConfig({ ...defaultDepositConfig, ...cfg.depositConfig });
      setLoading(false);
    };

    fetchConfig();
  }, [tag]);

  // Poll for payment confirmation
  useEffect(() => {
    if (step !== 'qrcode' || !txId) return;

    const poll = async () => {
      try {
        const { data } = await (supabase as any)
          .from('edpay_transactions')
          .select('status')
          .eq('edpay_id', txId)
          .maybeSingle();
        if (data?.status === 'paid' || data?.status === 'confirmed' || data?.status === 'completed') {
          setStep('confirmed');
          if (pollRef.current) clearInterval(pollRef.current);
        } else if (data?.status === 'cancelled' || data?.status === 'expired') {
          toast.error('Pagamento expirado. Gere um novo QR Code.');
          resetForm();
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch { /* ignore */ }
    };

    pollRef.current = setInterval(poll, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [step, txId]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !accountId.trim() || !whatsapp.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }
    setStep('amount');
  };

  const finalAmount = selectedAmount || Number(customAmount);

  const handleGenerateQr = async () => {
    if (!finalAmount || finalAmount < config.minimumValue) {
      toast.error(`Valor mínimo: R$ ${config.minimumValue.toFixed(2)}`);
      return;
    }
    setQrLoading(true);
    setQrData(null);
    try {
      const { data, error } = await supabase.functions.invoke('edpay-public-qrcode', {
        body: { ownerId, amount: finalAmount, userName: name, userPhone: whatsapp.replace(/\D/g, ''), userAccountId: accountId },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); }
      else {
        const qr = data?.data || data;
        setQrData(qr);
        setTxId(qr?.id || null);
        setStep('qrcode');
        toast.success('QR Code gerado!');
      }
    } catch (err: any) { toast.error(err?.message || 'Erro ao gerar QR Code'); }
    finally { setQrLoading(false); }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const resetForm = () => {
    setStep('form');
    setQrData(null);
    setTxId(null);
    setSelectedAmount(null);
    setCustomAmount('');
    setName('');
    setAccountId('');
    setWhatsapp('');
  };

  const accent = config.accentColor || '#10b981';
  const bg = config.bgColor || '#0a0a0f';
  const txt = config.textColor || '#ffffff';
  const txtMuted = txt + '99';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: bg }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: accent, borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: bg, color: txt }}>
        <div className="text-center space-y-3">
          <div className="text-5xl">🚫</div>
          <h1 className="text-xl font-bold">Página não encontrada</h1>
          <p className="text-sm" style={{ color: txtMuted }}>Este link de depósito não existe ou está desativado.</p>
        </div>
      </div>
    );
  }

  const cardStyle = { background: `${txt}08`, border: `1px solid ${txt}14` };
  const inputStyle = { background: `${txt}0a`, border: `1px solid ${txt}14`, color: txt };
  const inputFocusClass = 'focus:outline-none focus:ring-2 transition-all';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative" style={{ background: bg, color: txt }}>
      {config.bgImageUrl && (
        <div className="fixed inset-0 pointer-events-none bg-cover bg-center bg-no-repeat opacity-20" style={{ backgroundImage: `url(${config.bgImageUrl})` }} />
      )}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/3 w-[500px] h-[500px] rounded-full blur-[120px]" style={{ background: `${accent}0d` }} />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full blur-[100px]" style={{ background: `${accent}08` }} />
      </div>

      <div className="relative w-full max-w-md z-10">
        {/* Header */}
        {step !== 'confirmed' && (
          <div className="text-center mb-6">
            {config.logoUrl && (
              <img src={config.logoUrl} alt="" className="h-14 mx-auto mb-4 object-contain" />
            )}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4" style={{ background: `${accent}1a`, border: `1px solid ${accent}33` }}>
              <CreditCard size={16} style={{ color: accent }} />
              <span className="text-sm font-semibold" style={{ color: accent }}>Depósito PIX</span>
            </div>
            {config.description && (
              <p className="text-sm mt-2" style={{ color: txtMuted }}>{config.description}</p>
            )}
          </div>
        )}

        {/* Step indicator */}
        {step !== 'confirmed' && (
          <div className="flex items-center justify-center gap-2 mb-6">
            {['Dados', 'Valor', 'Pagamento'].map((label, i) => {
              const stepIndex = step === 'form' ? 0 : step === 'amount' ? 1 : 2;
              return (
                <div key={label} className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all" style={{ background: i <= stepIndex ? accent : `${txt}0f`, color: i <= stepIndex ? '#fff' : txtMuted }}>
                    {i < stepIndex ? '✓' : i + 1}
                  </div>
                  <span className="text-xs" style={{ color: i <= stepIndex ? accent : txtMuted }}>{label}</span>
                  {i < 2 && <div className="w-8 h-0.5" style={{ background: i < stepIndex ? accent : `${txt}14` }} />}
                </div>
              );
            })}
          </div>
        )}

        {/* Step 1: Form */}
        {step === 'form' && (
          <form onSubmit={handleFormSubmit} className="space-y-4 rounded-2xl backdrop-blur-xl p-6" style={cardStyle}>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: txtMuted }}>
                <User size={12} /> {nameLabel}
              </label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder={namePlaceholder} required className={`w-full px-4 py-3 rounded-xl text-sm ${inputFocusClass}`} style={{ ...inputStyle, '--tw-ring-color': `${accent}66` } as any} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: txtMuted }}>
                <CreditCard size={12} /> {accountLabel}
              </label>
              <input type="text" value={accountId} onChange={e => setAccountId(e.target.value)} placeholder={accountPlaceholder} required className={`w-full px-4 py-3 rounded-xl text-sm ${inputFocusClass}`} style={{ ...inputStyle, '--tw-ring-color': `${accent}66` } as any} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: txtMuted }}>
                <Smartphone size={12} /> {whatsappLabel}
              </label>
              <input type="text" value={whatsapp} onChange={e => setWhatsapp(maskPhone(e.target.value))} placeholder="(00) 00000-0000" required className={`w-full px-4 py-3 rounded-xl text-sm ${inputFocusClass}`} style={{ ...inputStyle, '--tw-ring-color': `${accent}66` } as any} />
            </div>
            <button type="submit" className="w-full py-3.5 rounded-xl text-sm font-bold transition-all shadow-lg" style={{ background: accent, color: '#fff', boxShadow: `0 10px 25px -5px ${accent}33` }}>
              Continuar →
            </button>
          </form>
        )}

        {/* Step 2: Amount Selection */}
        {step === 'amount' && (
          <div className="space-y-4 rounded-2xl backdrop-blur-xl p-6" style={cardStyle}>
            <p className="text-sm text-center" style={{ color: txtMuted }}>Selecione o valor do depósito</p>
            <div className="grid grid-cols-2 gap-3">
              {config.presetValues.map(val => (
                <button key={val} onClick={() => { setSelectedAmount(val); setCustomAmount(''); }} className="py-3.5 rounded-xl text-sm font-bold transition-all" style={{ background: selectedAmount === val ? accent : `${txt}08`, color: selectedAmount === val ? '#fff' : txt, border: `1px solid ${selectedAmount === val ? accent : `${txt}14`}`, boxShadow: selectedAmount === val ? `0 8px 20px -5px ${accent}33` : 'none' }}>
                  R$ {val.toFixed(2)}
                </button>
              ))}
            </div>
            {config.allowCustomValue && (
              <div className="space-y-1.5 pt-2">
                <label className="text-xs" style={{ color: txtMuted }}>Ou digite um valor personalizado:</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm" style={{ color: txtMuted }}>R$</span>
                  <input type="number" value={customAmount} onChange={e => { setCustomAmount(e.target.value); setSelectedAmount(null); }} placeholder={`Mínimo ${config.minimumValue.toFixed(2)}`} min={config.minimumValue} step="0.01" className={`w-full pl-10 pr-4 py-3 rounded-xl text-sm ${inputFocusClass}`} style={inputStyle} />
                </div>
                <p className="text-xs" style={{ color: txtMuted }}>Valor mínimo: R$ {config.minimumValue.toFixed(2)}</p>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep('form')} className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all" style={{ background: `${txt}0a`, color: txtMuted, border: `1px solid ${txt}14` }}>
                ← Voltar
              </button>
              <button onClick={handleGenerateQr} disabled={qrLoading || (!selectedAmount && !customAmount)} className="flex-1 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: accent, color: '#fff', boxShadow: `0 10px 25px -5px ${accent}33` }}>
                {qrLoading ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Gerando...</span> : `Pagar R$ ${finalAmount ? finalAmount.toFixed(2) : '0.00'}`}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: QR Code */}
        {step === 'qrcode' && qrData && (
          <div className="space-y-4 rounded-2xl backdrop-blur-xl p-6 text-center" style={cardStyle}>
            <div className="text-4xl">📱</div>
            <h3 className="text-lg font-bold">Escaneie o QR Code</h3>
            <p className="text-sm" style={{ color: txtMuted }}>
              Valor: <span className="font-bold" style={{ color: accent }}>R$ {finalAmount?.toFixed(2)}</span>
            </p>
            {(qrData.qrcode || qrData.copiacola) && (
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-xl">
                  <QRCodeSVG value={qrData.copiacola || qrData.qrcode} size={200} level="M" />
                </div>
              </div>
            )}
            {(qrData.copiacola || qrData.qrcode) && (
              <div className="space-y-2">
                <p className="text-xs" style={{ color: txtMuted }}>PIX Copia e Cola:</p>
                <div className="flex gap-2">
                  <input readOnly value={qrData.copiacola || qrData.qrcode} className="flex-1 px-3 py-2 rounded-lg text-xs truncate" style={inputStyle} />
                  <button onClick={() => handleCopy(qrData.copiacola || qrData.qrcode)} className="px-3 py-2 rounded-lg transition-all" style={{ background: `${accent}33`, color: accent }}>
                    {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            )}
            <div className="flex items-center justify-center gap-2 pt-2" style={{ color: txtMuted }}>
              <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Aguardando pagamento...</span>
            </div>
            <button onClick={resetForm} className="w-full py-3 rounded-xl text-sm font-semibold transition-all mt-4" style={{ background: `${txt}0a`, color: txtMuted, border: `1px solid ${txt}14` }}>
              Cancelar
            </button>
          </div>
        )}

        {/* Step 4: Confirmed */}
        {step === 'confirmed' && (
          <div className="space-y-6 rounded-2xl backdrop-blur-xl p-8 text-center" style={cardStyle}>
            {config.confirmationLogoUrl ? (
              <img src={config.confirmationLogoUrl} alt="" className="h-20 mx-auto object-contain" />
            ) : (
              <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center" style={{ background: `${accent}22` }}>
                <CheckCircle2 size={40} style={{ color: accent }} />
              </div>
            )}
            <div className="space-y-2">
              <h2 className="text-2xl font-extrabold" style={{ color: accent }}>
                {config.confirmationTitle || 'Pagamento Confirmado!'}
              </h2>
              <p className="text-sm" style={{ color: txtMuted }}>
                {config.confirmationMessage || 'Seu depósito foi recebido com sucesso.'}
              </p>
            </div>

            {/* Receipt-like card */}
            <div className="rounded-xl p-4 space-y-3 text-left" style={{ background: `${txt}06`, border: `1px solid ${txt}10` }}>
              <div className="flex justify-between text-sm">
                <span style={{ color: txtMuted }}>{nameLabel}</span>
                <span className="font-semibold">{name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: txtMuted }}>{accountLabel}</span>
                <span className="font-semibold">{accountId}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: txtMuted }}>{whatsappLabel}</span>
                <span className="font-semibold">{whatsapp}</span>
              </div>
              <div className="pt-2" style={{ borderTop: `1px solid ${txt}14` }}>
                <div className="flex justify-between items-center">
                  <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: accent }}>Valor Depositado</span>
                  <span className="text-2xl font-extrabold" style={{ color: accent }}>R$ {finalAmount?.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {config.confirmationButtonUrl && (
              <a href={config.confirmationButtonUrl} target="_blank" rel="noopener noreferrer" className="block w-full py-3.5 rounded-xl text-sm font-bold transition-all shadow-lg text-center" style={{ background: config.confirmationButtonColor || accent, color: '#fff', boxShadow: `0 10px 25px -5px ${(config.confirmationButtonColor || accent)}33` }}>
                {config.confirmationButtonText || 'Acessar →'}
              </a>
            )}
            {config.showNewDepositButton && (
              <button onClick={resetForm} className="w-full py-3.5 rounded-xl text-sm font-bold transition-all shadow-lg" style={{ background: config.confirmationButtonUrl ? `${txt}0a` : accent, color: config.confirmationButtonUrl ? txtMuted : '#fff', border: config.confirmationButtonUrl ? `1px solid ${txt}14` : 'none', boxShadow: config.confirmationButtonUrl ? 'none' : `0 10px 25px -5px ${accent}33` }}>
                Novo depósito
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Deposit;
