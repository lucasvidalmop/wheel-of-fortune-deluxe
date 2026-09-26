import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

const MaintenanceScreen = () => (
  <div className="fixed inset-0 z-[9999] overflow-y-auto bg-[#0a0a0f] text-white flex items-center justify-center px-6 py-10">
    <div className="max-w-xl w-full text-center space-y-5">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-wide">SERVIÇO TEMPORARIAMENTE INDISPONÍVEL</h1>
      <p className="text-white/70 leading-relaxed">
        Em razão das recentes alterações regulatórias no mercado brasileiro e da publicação da{' '}
        <strong className="text-white">Medida Provisória nº 1.394/2026</strong>, algumas funcionalidades do aplicativo estão temporariamente indisponíveis.
      </p>
      <p className="text-white/70 leading-relaxed">
        A medida é preventiva e permanecerá em vigor enquanto avaliamos os impactos da nova regulamentação e realizamos as adequações necessárias em nossa plataforma.
      </p>
      <p className="text-white/70 leading-relaxed">
        Estamos acompanhando os desdobramentos e novas orientações dos órgãos responsáveis.
      </p>
      <p className="text-white/70 leading-relaxed">Nenhuma ação é necessária por parte dos usuários neste momento.</p>
      <p className="text-white/70">Agradecemos a compreensão.</p>
      <p className="text-white font-semibold">Equipe BSB e Batman</p>
    </div>
  </div>
);

// Fail-open: if the flag can't be read, the page renders normally.
const MaintenanceGate = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<'loading' | 'on' | 'off'>('loading');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await (supabase as any).from('site_settings').select('maintenance_enabled').eq('id', 1).maybeSingle();
        if (alive) setState(data?.maintenance_enabled ? 'on' : 'off');
      } catch {
        if (alive) setState('off');
      }
    })();
    return () => { alive = false; };
  }, []);

  if (state === 'loading') return <div className="fixed inset-0 z-[9999] bg-[#0a0a0f]" />;
  if (state === 'on') return <MaintenanceScreen />;
  return <>{children}</>;
};

export default MaintenanceGate;
