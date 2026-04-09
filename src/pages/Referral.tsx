import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Referral = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [linkData, setLinkData] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [accountId, setAccountId] = useState('');
  const [name, setName] = useState('');
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
      }
      setLoading(false);
    };
    fetchLink();
  }, [code]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !accountId.trim()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await (supabase as any).rpc('register_via_referral', {
        p_code: code?.toUpperCase() || '',
        p_email: email.trim(),
        p_account_id: accountId.trim(),
        p_name: name.trim(),
      });
      if (error) throw error;
      const result = typeof data === 'string' ? JSON.parse(data) : data;
      if (result?.success) {
        setSpinsGranted(result.spins || 1);
        setSuccess(true);
        toast.success('Inscrição realizada com sucesso!');
      } else {
        toast.error(result?.error || 'Erro ao registrar');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao registrar');
    }
    setSubmitting(false);
  };

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

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, rgba(80,20,120,0.3) 0%, rgba(10,5,30,0.9) 70%)' }} />
        <div className="relative z-10 text-center space-y-6 max-w-sm mx-4 rounded-2xl p-8 border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <div className="text-6xl animate-bounce">🎉</div>
          <h1 className="text-2xl font-bold text-foreground">Inscrição Confirmada!</h1>
          <p className="text-muted-foreground">
            Você recebeu <span className="text-primary font-bold">{spinsGranted} giro(s)</span> na roleta!
          </p>
          <p className="text-xs text-muted-foreground">
            Aguarde a liberação do operador para girar a roleta.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, rgba(80,20,120,0.3) 0%, rgba(10,5,30,0.9) 70%)' }} />

      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-sm mx-4 rounded-2xl p-6 space-y-5 border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
      >
        <div className="text-center space-y-2">
          <div className="text-4xl">🎰</div>
          <h1 className="text-xl font-bold text-foreground">
            {linkData.label || 'Inscrição na Roleta'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Preencha seus dados para ganhar <span className="text-primary font-bold">{linkData.spins_per_registration} giro(s)</span>
          </p>
          {linkData.max_registrations && (
            <p className="text-xs text-muted-foreground/70">
              {linkData.registrations_count}/{linkData.max_registrations} vagas preenchidas
            </p>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Nome</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Seu nome"
              className="w-full px-4 py-3 rounded-xl border border-white/[0.1] bg-white/[0.04] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">E-mail <span className="text-destructive">*</span></label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="w-full px-4 py-3 rounded-xl border border-white/[0.1] bg-white/[0.04] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">ID da Conta <span className="text-destructive">*</span></label>
            <input
              type="text"
              value={accountId}
              onChange={e => setAccountId(e.target.value)}
              placeholder="Seu ID"
              required
              className="w-full px-4 py-3 rounded-xl border border-white/[0.1] bg-white/[0.04] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Registrando...' : '🎯 Inscrever-se'}
        </button>
      </form>
    </div>
  );
};

export default Referral;
