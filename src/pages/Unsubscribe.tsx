import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'valid' | 'already' | 'invalid' | 'success' | 'error'>('loading');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    fetch(`${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`, {
      headers: { apikey: anonKey },
    })
      .then(r => r.json())
      .then(data => {
        if (data.valid === false && data.reason === 'already_unsubscribed') setStatus('already');
        else if (data.valid) setStatus('valid');
        else setStatus('invalid');
      })
      .catch(() => setStatus('error'));
  }, [token]);

  const handleUnsubscribe = async () => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('handle-email-unsubscribe', { body: { token } });
      if (error) throw error;
      if (data?.success) setStatus('success');
      else if (data?.reason === 'already_unsubscribed') setStatus('already');
      else setStatus('error');
    } catch { setStatus('error'); }
    setProcessing(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full p-8 rounded-2xl border border-border bg-card shadow-lg text-center space-y-4">
        {status === 'loading' && <p className="text-muted-foreground animate-pulse">Verificando...</p>}
        {status === 'valid' && (
          <>
            <h1 className="text-xl font-bold text-foreground">Cancelar inscrição</h1>
            <p className="text-muted-foreground text-sm">Deseja parar de receber nossos emails?</p>
            <button onClick={handleUnsubscribe} disabled={processing} className="w-full py-3 rounded-lg bg-destructive text-destructive-foreground font-bold text-sm disabled:opacity-50">
              {processing ? 'Processando...' : 'Confirmar cancelamento'}
            </button>
          </>
        )}
        {status === 'success' && (
          <>
            <h1 className="text-xl font-bold text-foreground">Inscrição cancelada ✅</h1>
            <p className="text-muted-foreground text-sm">Você não receberá mais nossos emails.</p>
          </>
        )}
        {status === 'already' && (
          <>
            <h1 className="text-xl font-bold text-foreground">Já cancelado</h1>
            <p className="text-muted-foreground text-sm">Sua inscrição já foi cancelada anteriormente.</p>
          </>
        )}
        {status === 'invalid' && <p className="text-destructive font-medium">Token inválido ou expirado.</p>}
        {status === 'error' && <p className="text-destructive font-medium">Ocorreu um erro. Tente novamente.</p>}
      </div>
    </div>
  );
};

export default Unsubscribe;
