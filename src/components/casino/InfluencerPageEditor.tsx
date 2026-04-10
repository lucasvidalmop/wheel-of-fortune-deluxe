import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Palette, Type, Save, RotateCcw, Volume2, Upload, X, Sliders, Image as ImageIcon, Monitor } from 'lucide-react';
import { uploadAppAsset } from '@/lib/uploadAppAsset';

export interface InfluencerPageConfig {
  accentColor: string;
  bgColor: string;
  cardBgColor: string;
  textColor: string;
  btnBgColor: string;
  btnTextColor: string;
  // Background image
  bgImageUrl: string;
  // Glass effects
  glowColor: string;
  glowOpacity: number;
  borderOpacity: number;
  borderColor: string;
  borderWidth: number;
  // Tab styling
  tabActiveColor: string;
  tabInactiveColor: string;
  tabBorderWidth: number;
  tabBgColor: string;
  // Raffle sound
  raffleSoundEnabled: boolean;
  raffleSoundUrl: string;
}

export const defaultInfluencerConfig: InfluencerPageConfig = {
  accentColor: '#2dd4bf',
  bgColor: '#0a0e1a',
  cardBgColor: 'rgba(20, 30, 50, 0.95)',
  textColor: '#ffffff',
  btnBgColor: '#2dd4bf',
  btnTextColor: '#000000',
  bgImageUrl: '',
  glowColor: '#2dd4bf',
  glowOpacity: 3,
  borderOpacity: 8,
  borderColor: '',
  borderWidth: 1,
  tabActiveColor: '',
  tabInactiveColor: '',
  tabBorderWidth: 2,
  tabBgColor: '',
  raffleSoundEnabled: false,
  raffleSoundUrl: '',
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
  const [uploadingSound, setUploadingSound] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const soundInputRef = useRef<HTMLInputElement>(null);

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

  const handleSoundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      toast.error('Selecione um arquivo de áudio');
      return;
    }
    setUploadingSound(true);
    try {
      const { publicUrl } = await uploadAppAsset(file, `raffle-sounds/${userId}`);
      update({ raffleSoundUrl: publicUrl, raffleSoundEnabled: true });
      toast.success('Som de sorteio atualizado!');
    } catch (err: any) {
      toast.error('Erro no upload: ' + (err.message || ''));
    }
    setUploadingSound(false);
    e.target.value = '';
  };

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBg(true);
    try {
      const { publicUrl } = await uploadAppAsset(file, `influencer-bg/${userId}`);
      update({ bgImageUrl: publicUrl });
      toast.success('Background atualizado!');
    } catch (err: any) {
      toast.error('Erro no upload: ' + (err.message || ''));
    }
    setUploadingBg(false);
    e.target.value = '';
  };

  const removeBg = () => {
    update({ bgImageUrl: '' });
    toast.success('Background removido!');
  };

  const removeSound = () => {
    update({ raffleSoundUrl: '', raffleSoundEnabled: false });
    toast.success('Som removido');
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

      {/* Background Image */}
      <Section icon={<ImageIcon size={14} className="text-primary" />} title="Imagem de Fundo">
        {config.bgImageUrl ? (
          <div className="space-y-3">
            <div className="relative rounded-xl overflow-hidden border border-white/[0.08]">
              <img src={config.bgImageUrl} alt="Background" className="w-full h-32 object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            </div>
            <div className="flex gap-2">
              <label className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-xs cursor-pointer hover:bg-white/[0.08] transition">
                <Upload size={14} /> Trocar
                <input type="file" accept="image/*" onChange={handleBgUpload} className="hidden" />
              </label>
              <button onClick={removeBg} className="flex-1 py-2 rounded-xl border border-destructive/20 text-destructive text-xs hover:bg-destructive/10 transition">
                Remover
              </button>
            </div>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed border-white/[0.1] hover:border-primary/30 cursor-pointer transition group">
            <Upload size={24} className="text-muted-foreground group-hover:text-primary transition" />
            <span className="text-xs text-muted-foreground group-hover:text-foreground transition">
              {uploadingBg ? 'Enviando...' : 'Clique para enviar imagem de fundo'}
            </span>
            <input type="file" accept="image/*" onChange={handleBgUpload} className="hidden" disabled={uploadingBg} />
          </label>
        )}
      </Section>

      {/* Glass Effects */}
      <Section icon={<Monitor size={14} className="text-primary" />} title="Efeitos Glass">
        <ColorField label="Cor do brilho" value={config.glowColor} onChange={v => update({ glowColor: v })} />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">Intensidade do brilho</span>
          <div className="flex items-center gap-2">
            <input type="range" min="0" max="20" value={config.glowOpacity} onChange={e => update({ glowOpacity: parseInt(e.target.value) })} className="w-24 accent-primary h-1.5" />
            <span className="text-[10px] font-mono text-muted-foreground w-8 text-right">{config.glowOpacity}%</span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">Opacidade das bordas</span>
          <div className="flex items-center gap-2">
            <input type="range" min="0" max="30" value={config.borderOpacity} onChange={e => update({ borderOpacity: parseInt(e.target.value) })} className="w-24 accent-primary h-1.5" />
            <span className="text-[10px] font-mono text-muted-foreground w-8 text-right">{config.borderOpacity}%</span>
          </div>
        </div>
        <ColorField label="Cor das bordas" value={config.borderColor} onChange={v => update({ borderColor: v })} />
      </Section>

      <Section icon={<Type size={14} className="text-primary" />} title="Cores do Texto">
        <ColorField label="Cor do texto principal" value={config.textColor} onChange={v => update({ textColor: v })} />
      </Section>

      {/* Tab Styling */}
      <Section icon={<Sliders size={14} className="text-primary" />} title="Abas (Tabs)">
        <ColorField label="Cor da aba ativa" value={config.tabActiveColor} onChange={v => update({ tabActiveColor: v })} />
        <ColorField label="Cor da aba inativa" value={config.tabInactiveColor} onChange={v => update({ tabInactiveColor: v })} />
        <ColorField label="Fundo das abas" value={config.tabBgColor} onChange={v => update({ tabBgColor: v })} />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">Espessura da borda ativa</span>
          <div className="flex items-center gap-2">
            <input
              type="range" min="1" max="6" step="1"
              value={config.tabBorderWidth}
              onChange={e => update({ tabBorderWidth: parseInt(e.target.value) })}
              className="w-24 accent-primary h-1.5"
            />
            <span className="text-[10px] font-mono text-muted-foreground w-6 text-right">{config.tabBorderWidth}px</span>
          </div>
        </div>
      </Section>

      {/* Sound Effect */}
      <Section icon={<Volume2 size={14} className="text-primary" />} title="Efeito Sonoro do Sorteio">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">Ativar som no sorteio</span>
          <button
            onClick={() => update({ raffleSoundEnabled: !config.raffleSoundEnabled })}
            className={`w-10 h-5 rounded-full transition-all relative ${config.raffleSoundEnabled ? 'bg-primary' : 'bg-white/[0.1]'}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${config.raffleSoundEnabled ? 'left-5' : 'left-0.5'}`} />
          </button>
        </div>

        {config.raffleSoundEnabled && (
          <div className="space-y-3 pt-2">
            {config.raffleSoundUrl ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08]">
                  <Volume2 size={14} className="text-primary shrink-0" />
                  <span className="text-[10px] text-muted-foreground truncate flex-1 font-mono">
                    {config.raffleSoundUrl.split('/').pop()}
                  </span>
                  <button onClick={() => {
                    const audio = new Audio(config.raffleSoundUrl);
                    audio.play().catch(() => toast.error('Não foi possível reproduzir'));
                  }} className="text-[10px] text-primary font-semibold hover:underline shrink-0">
                    ▶ Testar
                  </button>
                </div>
                <div className="flex gap-2">
                  <label className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-xs cursor-pointer hover:bg-white/[0.08] transition">
                    <Upload size={14} />
                    Trocar
                    <input ref={soundInputRef} type="file" accept="audio/*" onChange={handleSoundUpload} className="hidden" />
                  </label>
                  <button onClick={removeSound} className="flex-1 py-2 rounded-xl border border-destructive/20 text-destructive text-xs hover:bg-destructive/10 transition flex items-center justify-center gap-1">
                    <X size={12} /> Remover
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed border-white/[0.1] hover:border-primary/30 cursor-pointer transition group">
                <Upload size={20} className="text-muted-foreground group-hover:text-primary transition" />
                <span className="text-xs text-muted-foreground group-hover:text-foreground transition">
                  {uploadingSound ? 'Enviando...' : 'Clique para enviar áudio (.mp3, .wav, etc.)'}
                </span>
                <input type="file" accept="audio/*" onChange={handleSoundUpload} className="hidden" disabled={uploadingSound} />
              </label>
            )}
          </div>
        )}
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
