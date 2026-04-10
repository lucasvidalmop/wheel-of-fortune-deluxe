import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Palette, Type, Save, RotateCcw } from 'lucide-react';

export interface InfluencerPageConfig {
  accentColor: string;
  bgColor: string;
  cardBgColor: string;
  textColor: string;
  btnBgColor: string;
  btnTextColor: string;
}

export const defaultInfluencerConfig: InfluencerPageConfig = {
  accentColor: '#2dd4bf',
  bgColor: '#0a0e1a',
  cardBgColor: 'rgba(20, 30, 50, 0.95)',
  textColor: '#ffffff',
  btnBgColor: '#2dd4bf',
  btnTextColor: '#000000',
};

const ColorField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-xs text-muted-foreground">{label}</span>
    <div className="flex items-center gap-2">
      <input type="color" value={value || '#ffffff'} onInput={e => onChange((e.target as HTMLInputElement).value)} className="w-7 h-7 rounded-lg border border-white/[0.1] cursor-pointer bg-transparent" />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder="padrão" className="w-28 text-[10px] font-mono px-2 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground" />
    </div>
  </div>
);

const Section = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wider">
      {icon} {title}
    </div>
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
      {children}
    </div>
  </div>
);

interface Props {
  userId: string;
  currentConfig: Partial<InfluencerPageConfig>;
  onSaved: (cfg: InfluencerPageConfig) => void;
}

const InfluencerPageEditor = ({ userId, currentConfig, onSaved }: Props) => {
  const [config, setConfig] = useState<InfluencerPageConfig>({ ...defaultInfluencerConfig, ...currentConfig });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setConfig({ ...defaultInfluencerConfig, ...currentConfig });
  }, [currentConfig]);

  const update = (partial: Partial<InfluencerPageConfig>) => setConfig(c => ({ ...c, ...partial }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: dbRow } = await (supabase as any)
        .from('wheel_configs')
        .select('config')
        .eq('user_id', userId)
        .maybeSingle();

      const dbConfig = dbRow?.config || {};
      const mergedConfig = { ...dbConfig, influencerPageConfig: config };

      const { error } = await (supabase as any)
        .from('wheel_configs')
        .update({ config: mergedConfig, updated_at: new Date().toISOString() })
        .eq('user_id', userId);

      if (error) toast.error('Erro ao salvar: ' + error.message);
      else { toast.success('Visual do influencer salvo!'); onSaved(config); }
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || ''));
    }
    setSaving(false);
  };

  const handleReset = () => {
    setConfig({ ...defaultInfluencerConfig });
    toast.success('Resetado para padrão');
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
        <p className="text-xs text-muted-foreground">
          ⚡ Personalize o visual da sua página de <span className="text-primary font-semibold">influencer</span>. As alterações serão aplicadas à rota <span className="font-mono text-primary">/influencer</span>.
        </p>
      </div>

      <Section icon={<Palette size={14} className="text-primary" />} title="Cor Principal (Accent)">
        <ColorField label="Cor destaque (botões, ícones)" value={config.accentColor} onChange={v => update({ accentColor: v, btnBgColor: v })} />
        <ColorField label="Cor do texto do botão" value={config.btnTextColor} onChange={v => update({ btnTextColor: v })} />
      </Section>

      <Section icon={<Palette size={14} className="text-primary" />} title="Cores do Fundo">
        <ColorField label="Fundo da página" value={config.bgColor} onChange={v => update({ bgColor: v })} />
        <ColorField label="Fundo dos cards" value={config.cardBgColor} onChange={v => update({ cardBgColor: v })} />
      </Section>

      <Section icon={<Type size={14} className="text-primary" />} title="Cores do Texto">
        <ColorField label="Cor do texto principal" value={config.textColor} onChange={v => update({ textColor: v })} />
      </Section>

      <div className="flex gap-3">
        <button onClick={handleReset} className="flex-1 py-3 rounded-xl border border-white/[0.08] text-muted-foreground text-xs font-semibold hover:bg-white/[0.04] transition flex items-center justify-center gap-2">
          <RotateCcw size={14} /> Resetar
        </button>
        <button onClick={handleSave} disabled={saving} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 hover:brightness-110 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
          <Save size={14} /> {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
};

export default InfluencerPageEditor;
