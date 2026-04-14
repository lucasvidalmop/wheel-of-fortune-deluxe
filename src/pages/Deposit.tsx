import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
}

const defaultDepositConfig: DepositConfig = {
  enabled: false,
  tag: '',
  accountIdLabel: 'ID da Conta',
  presetValues: [10, 20, 50, 100],
  minimumValue: 10,
  allowCustomValue: true,
  description: 'Selecione um valor para depósito',
};

const Deposit = () => {
  const [searchParams] = useSearchParams();
  const tag = searchParams.get('dep') || '';
  const [loading, setLoading] = useState(true);
  const [ownerId, setOwnerId] = useState('');
  const [config, setConfig] = useState<DepositConfig>(defaultDepositConfig);
  const [notFound, setNotFound] = useState(false);

  // Form
  const [name, setName] = useState('');
  const [accountId, setAccountId] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [step, setStep] = useState<'form' | 'amount' | 'qrcode' | 'success'>('form');

  // Amount
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');

  // QR
  const [qrLoading, setQrLoading] = useState(false);
  const [qrData, setQrData] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const maskPhone = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };

  useEffect(() => {
    const fetchConfig = async () => {
      if (!tag) { setNotFound(true); setLoading(false); return; }

      // Search all wheel_configs for matching deposit tag
      const { data: configs } = await (supabase as any)
        .from('wheel_configs')
        .select('user_id, config');

      if (!configs || configs.length === 0) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const match = configs.find((c: any) => {
        const cfg = typeof c.config === 'string' ? JSON.parse(c.config) : c.config;
        const dc = cfg?.depositConfig;
        return dc?.enabled && dc?.tag?.toLowerCase() === tag.toLowerCase();
      });

      if (!match) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const cfg = typeof match.config === 'string' ? JSON.parse(match.config) : match.config;
      setOwnerId(match.user_id);
      setConfig({ ...defaultDepositConfig, ...cfg.depositConfig });
      setLoading(false);
    };

    fetchConfig();
  }, [tag]);

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
        body: {
          ownerId,
          amount: finalAmount,
          userName: name,
          userPhone: whatsapp.replace(/\D/g, ''),
          userAccountId: accountId,
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
      } else {
        setQrData(data?.data || data);
        setStep('qrcode');
        toast.success('QR Code gerado!');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao gerar QR Code');
    } finally {
      setQrLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] p-4">
        <div className="text-center space-y-3">
          <div className="text-5xl">🚫</div>
          <h1 className="text-xl font-bold text-white">Página não encontrada</h1>
          <p className="text-sm text-gray-400">Este link de depósito não existe ou está desativado.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/3 w-[500px] h-[500px] rounded-full bg-emerald-500/[0.05] blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-blue-500/[0.04] blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
            <CreditCard size={16} className="text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-400">Depósito PIX</span>
          </div>
          {config.description && (
            <p className="text-sm text-gray-400 mt-2">{config.description}</p>
          )}
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {['Dados', 'Valor', 'Pagamento'].map((label, i) => {
            const stepIndex = step === 'form' ? 0 : step === 'amount' ? 1 : 2;
            return (
              <div key={label} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  i <= stepIndex ? 'bg-emerald-500 text-white' : 'bg-white/[0.06] text-gray-500'
                }`}>
                  {i < stepIndex ? '✓' : i + 1}
                </div>
                <span className={`text-xs ${i <= stepIndex ? 'text-emerald-400' : 'text-gray-500'}`}>{label}</span>
                {i < 2 && <div className={`w-8 h-0.5 ${i < stepIndex ? 'bg-emerald-500' : 'bg-white/[0.08]'}`} />}
              </div>
            );
          })}
        </div>

        {/* Step 1: Form */}
        {step === 'form' && (
          <form onSubmit={handleFormSubmit} className="space-y-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                <User size={12} /> Nome completo
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Seu nome"
                required
                className="w-full px-4 py-3 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                <CreditCard size={12} /> {config.accountIdLabel}
              </label>
              <input
                type="text"
                value={accountId}
                onChange={e => setAccountId(e.target.value)}
                placeholder={config.accountIdLabel}
                required
                className="w-full px-4 py-3 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                <Smartphone size={12} /> WhatsApp
              </label>
              <input
                type="text"
                value={whatsapp}
                onChange={e => setWhatsapp(maskPhone(e.target.value))}
                placeholder="(00) 00000-0000"
                required
                className="w-full px-4 py-3 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl text-sm font-bold bg-emerald-500 text-white hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
            >
              Continuar →
            </button>
          </form>
        )}

        {/* Step 2: Amount Selection */}
        {step === 'amount' && (
          <div className="space-y-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6">
            <p className="text-sm text-gray-300 text-center">Selecione o valor do depósito</p>

            {/* Preset values */}
            <div className="grid grid-cols-2 gap-3">
              {config.presetValues.map(val => (
                <button
                  key={val}
                  onClick={() => { setSelectedAmount(val); setCustomAmount(''); }}
                  className={`py-3.5 rounded-xl text-sm font-bold transition-all border ${
                    selectedAmount === val
                      ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20'
                      : 'bg-white/[0.04] text-white border-white/[0.08] hover:bg-white/[0.08]'
                  }`}
                >
                  R$ {val.toFixed(2)}
                </button>
              ))}
            </div>

            {/* Custom value */}
            {config.allowCustomValue && (
              <div className="space-y-1.5 pt-2">
                <label className="text-xs text-gray-400">Ou digite um valor personalizado:</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">R$</span>
                  <input
                    type="number"
                    value={customAmount}
                    onChange={e => { setCustomAmount(e.target.value); setSelectedAmount(null); }}
                    placeholder={`Mínimo ${config.minimumValue.toFixed(2)}`}
                    min={config.minimumValue}
                    step="0.01"
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all"
                  />
                </div>
                <p className="text-xs text-gray-500">Valor mínimo: R$ {config.minimumValue.toFixed(2)}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setStep('form')}
                className="flex-1 py-3 rounded-xl text-sm font-semibold bg-white/[0.06] text-gray-300 border border-white/[0.08] hover:bg-white/[0.1] transition-all"
              >
                ← Voltar
              </button>
              <button
                onClick={handleGenerateQr}
                disabled={qrLoading || (!selectedAmount && !customAmount)}
                className="flex-1 py-3 rounded-xl text-sm font-bold bg-emerald-500 text-white hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {qrLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Gerando...
                  </span>
                ) : (
                  `Pagar R$ ${finalAmount ? finalAmount.toFixed(2) : '0.00'}`
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: QR Code */}
        {step === 'qrcode' && qrData && (
          <div className="space-y-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6 text-center">
            <div className="text-4xl">📱</div>
            <h3 className="text-lg font-bold text-white">Escaneie o QR Code</h3>
            <p className="text-sm text-gray-400">
              Valor: <span className="text-emerald-400 font-bold">R$ {finalAmount?.toFixed(2)}</span>
            </p>

            {(qrData.qrcode || qrData.copiacola) && (
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-xl">
                  <QRCodeSVG
                    value={qrData.copiacola || qrData.qrcode}
                    size={200}
                    level="M"
                  />
                </div>
              </div>
            )}

            {(qrData.copiacola || qrData.qrcode) && (
              <div className="space-y-2">
                <p className="text-xs text-gray-400">PIX Copia e Cola:</p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={qrData.copiacola || qrData.qrcode}
                    className="flex-1 px-3 py-2 rounded-lg text-xs bg-white/[0.06] border border-white/[0.08] text-gray-300 truncate"
                  />
                  <button
                    onClick={() => handleCopy(qrData.copiacola || qrData.qrcode)}
                    className="px-3 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-all"
                  >
                    {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => {
                setStep('form');
                setQrData(null);
                setSelectedAmount(null);
                setCustomAmount('');
                setName('');
                setAccountId('');
                setWhatsapp('');
              }}
              className="w-full py-3 rounded-xl text-sm font-semibold bg-white/[0.06] text-gray-300 border border-white/[0.08] hover:bg-white/[0.1] transition-all mt-4"
            >
              Novo depósito
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Deposit;
