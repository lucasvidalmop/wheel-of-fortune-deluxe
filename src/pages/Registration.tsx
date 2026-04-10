import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ReferralPageConfig, defaultPageConfig } from '@/components/casino/ReferralPageEditor';
import { Gift, User, Mail, Phone, MapPin, Key, AlertCircle, Shield, CheckSquare } from 'lucide-react';

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
  const [cfg, setCfg] = useState<ReferralPageConfig>(defaultPageConfig);
  const [wheelSlug, setWheelSlug] = useState('');

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [accountId, setAccountId] = useState('');
  const [pixKeyType, setPixKeyType] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [confirmData, setConfirmData] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [spinsGranted, setSpinsGranted] = useState(0);

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
        p_code: code?.toUpperCase() || '',
        p_email: email.trim(),
        p_account_id: accountId.trim(),
        p_name: name.trim(),
        p_cpf: '',
      });
      if (error) throw error;
      const result = typeof data === 'string' ? JSON.parse(data) : data;
      if (result?.success) {
        // Update extra fields on the wheel_user
        if (result.wheel_user_id || result.user_id) {
          const uid = result.wheel_user_id || result.user_id;
          await (supabase as any).from('wheel_users').update({
            phone: phone.trim(),
            pix_key_type: pixKeyType,
            pix_key: pixKey.trim(),
          }).eq('id', uid);
        } else {
          // fallback: update by account_id + owner
          await (supabase as any).from('wheel_users').update({
            phone: phone.trim(),
            pix_key_type: pixKeyType,
            pix_key: pixKey.trim(),
          }).eq('account_id', accountId.trim()).eq('owner_id', result.owner_id);
        }

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
                  name: name.trim(),
                  phone: phone.trim(),
                  spins: result.spins || 1,
                  label: result.label || '',
                },
              },
            });
          }
        } catch {}

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
  const accentColor = cfg.btnBgColor || '#2dd4bf';

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
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={bgStyle}>
        <div className="relative z-10 text-center space-y-6 max-w-sm mx-4 rounded-2xl p-8 border backdrop-blur-xl shadow-2xl"
          style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
          <div className="text-6xl animate-bounce">🎉</div>
          <h1 className="text-2xl font-bold" style={{ color: titleColor }}>{cfg.successTitle || 'Inscrição Confirmada!'}</h1>
          <p style={{ color: subtitleColor }}>
            Você recebeu <span className="font-bold" style={{ color: accentColor }}>{spinsGranted} giro(s)</span> na roleta!
          </p>
          {wheelSlug ? (
            <button
              onClick={() => navigate(`/${wheelSlug}`)}
              className="w-full py-3.5 rounded-xl font-bold text-sm uppercase tracking-wider hover:brightness-110 transition flex items-center justify-center gap-2"
              style={{ backgroundColor: accentColor, color: cfg.btnTextColor || '#000000' }}
            >
              <Gift size={18} /> Ir para a Roleta
            </button>
          ) : (
            <p className="text-xs" style={{ color: subtitleColor }}>Acesse a roleta para girar agora.</p>
          )}
        </div>
      </div>
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
                type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="(11) 98765-4321"
                className="w-full pl-10 pr-10 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-all placeholder:opacity-40"
                style={{ backgroundColor: inputBg, borderColor: inputBorder, color: inputText, '--tw-ring-color': `${accentColor}40` } as any}
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full" style={{ backgroundColor: phone ? accentColor : 'rgba(255,255,255,0.15)' }} />
            </div>
          </div>

          {/* ID da Conta */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: labelColor }}>
              {cfg.btnText ? `ID da Conta` : 'ID da Conta'}
            </label>
            <div className="relative">
              <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: `${labelColor}` }} />
              <input
                type="text" value={accountId} onChange={e => setAccountId(e.target.value)}
                placeholder="Seu ID de usuário"
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
                  onChange={e => setPixKeyType(e.target.value)}
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
                  type="text" value={pixKey} onChange={e => setPixKey(e.target.value)}
                  placeholder="Chave aleatória (ex: ..."
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
            <span>Importante: Prazo de até 72h para crédito.</span>
          </div>

          {/* Checkboxes */}
          <div className="space-y-2.5">
            <label className="flex items-center gap-2.5 cursor-pointer group">
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
              <span className="text-xs" style={{ color: subtitleColor }}>
                Aceito os <a href="#" className="font-semibold underline" style={{ color: accentColor }} onClick={e => e.preventDefault()}>Termos de Uso</a>.
              </span>
            </label>
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
                Confirmo que os dados são da minha conta.
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

        {/* Footer */}
        <div className="px-6 pb-5 text-center space-y-3">
          <div className="text-[10px] space-y-1" style={{ color: subtitleColor }}>
            <p>© {new Date().getFullYear()} Todos os direitos reservados.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Registration;