import { useState } from 'react';
import { X, Upload, RotateCcw, Palette, Image, Type, MousePointer } from 'lucide-react';
import ReferralPagePreview from './ReferralPagePreview';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { uploadAppAsset } from '@/lib/uploadAppAsset';

export interface ReferralPageConfig {
  bgColor: string;
  bgGradientFrom: string;
  bgGradientTo: string;
  bgImage: string;
  cardBgColor: string;
  cardBorderColor: string;
  titleColor: string;
  subtitleColor: string;
  labelColor: string;
  inputBgColor: string;
  inputBorderColor: string;
  inputTextColor: string;
  btnBgColor: string;
  btnTextColor: string;
  btnHoverBrightness: number;
  iconUrl: string;
  iconEmoji: string;
  titleText: string;
  subtitleText: string;
  btnText: string;
  successTitle: string;
  successSubtitle: string;
  successBtnText: string;
  titlePrefix: string;
  showCounter: boolean;
  // Limit reached screen
  limitEmoji: string;
  limitTitle: string;
  limitSubtitle: string;
  limitTitleColor: string;
  limitSubtitleColor: string;
  limitCardBgColor: string;
  limitCardBorderColor: string;
}

export const defaultPageConfig: ReferralPageConfig = {
  bgColor: '',
  bgGradientFrom: 'rgba(80,20,120,0.3)',
  bgGradientTo: 'rgba(10,5,30,0.9)',
  bgImage: '',
  cardBgColor: 'rgba(255,255,255,0.04)',
  cardBorderColor: 'rgba(255,255,255,0.08)',
  titleColor: '',
  subtitleColor: '',
  labelColor: '',
  inputBgColor: 'rgba(255,255,255,0.04)',
  inputBorderColor: 'rgba(255,255,255,0.1)',
  inputTextColor: '',
  btnBgColor: '',
  btnTextColor: '',
  btnHoverBrightness: 110,
  iconUrl: '',
  iconEmoji: '🎰',
  titleText: '',
  subtitleText: '',
  btnText: '🎯 Resgatar Giro',
  successTitle: 'Giro Liberado!',
  successSubtitle: '',
  successBtnText: '🎰 Ir para a Roleta',
  titlePrefix: '',
  showCounter: true,
  limitEmoji: '⏰',
  limitTitle: 'Resgates Esgotados',
  limitSubtitle: 'Este link atingiu o limite máximo de resgates disponíveis.',
  limitTitleColor: '',
  limitSubtitleColor: '',
  limitCardBgColor: '',
  limitCardBorderColor: '',
};

interface Props {
  linkId: string;
  linkLabel: string;
  currentConfig: Partial<ReferralPageConfig>;
  onClose: () => void;
  onSaved: () => void;
}

const ColorField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-xs text-muted-foreground">{label}</span>
    <div className="flex items-center gap-2">
      <input type="color" value={value || '#ffffff'} onInput={e => onChange((e.target as HTMLInputElement).value)} className="w-7 h-7 rounded-lg border border-white/[0.1] cursor-pointer bg-transparent" />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder="vazio = padrão" className="w-28 text-[10px] font-mono px-2 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground" />
    </div>
  </div>
);

const TextField = ({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) => (
  <div>
    <label className="text-[10px] text-muted-foreground block mb-1">{label}</label>
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-sm focus:outline-none focus:border-primary/50" />
  </div>
);

const ReferralPageEditor = ({ linkId, linkLabel, currentConfig, onClose, onSaved }: Props) => {
  const [config, setConfig] = useState<ReferralPageConfig>({ ...defaultPageConfig, ...currentConfig });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  const update = (partial: Partial<ReferralPageConfig>) => setConfig(c => ({ ...c, ...partial }));

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'bgImage' | 'iconUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(field);
    try {
      const { publicUrl } = await uploadAppAsset(file, `referral-${field}/${linkId}`);
      update({ [field]: publicUrl });
      toast.success('Upload concluído!');
    } catch (err: any) {
      toast.error('Erro no upload: ' + (err.message || ''));
    }
    setUploading(null);
    e.target.value = '';
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await (supabase as any)
      .from('referral_links')
      .update({ page_config: config, updated_at: new Date().toISOString() })
      .eq('id', linkId);
    if (error) toast.error('Erro ao salvar: ' + error.message);
    else { toast.success('Configurações salvas!'); onSaved(); }
    setSaving(false);
  };

  const handleReset = () => {
    setConfig({ ...defaultPageConfig });
    toast.success('Resetado para padrão');
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[90vh] bg-background border border-white/[0.08] rounded-2xl shadow-2xl overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-xl border-b border-white/[0.06] p-5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Palette size={16} className="text-primary" />
              Personalizar Página
            </h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">{linkLabel || 'Link de Referência'}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* ═══ ÍCONE ═══ */}
          <Section icon={<Image size={14} className="text-primary" />} title="Ícone / Logo">
            <TextField label="Emoji do ícone" value={config.iconEmoji} onChange={v => update({ iconEmoji: v })} placeholder="🎰" />
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Imagem do ícone (substitui emoji)</label>
              {config.iconUrl ? (
                <div className="flex items-center gap-3">
                  <img src={config.iconUrl} alt="Icon" className="w-12 h-12 rounded-xl object-cover border border-white/[0.1]" />
                  <div className="flex gap-2">
                    <label className="px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-foreground text-xs cursor-pointer hover:bg-white/[0.1] transition">
                      Trocar <input type="file" accept="image/*" onChange={e => handleUpload(e, 'iconUrl')} className="hidden" />
                    </label>
                    <button onClick={() => update({ iconUrl: '' })} className="px-3 py-1.5 rounded-lg border border-destructive/20 text-destructive text-xs hover:bg-destructive/10 transition">Remover</button>
                  </div>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed border-white/[0.1] hover:border-primary/30 cursor-pointer transition">
                  <Upload size={16} className="text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{uploading === 'iconUrl' ? 'Enviando...' : 'Upload de ícone'}</span>
                  <input type="file" accept="image/*" onChange={e => handleUpload(e, 'iconUrl')} className="hidden" disabled={uploading === 'iconUrl'} />
                </label>
              )}
            </div>
            <TextField label="Prefixo do título (antes do nome do link)" value={config.titlePrefix} onChange={v => update({ titlePrefix: v })} placeholder="Ex: 🎯" />
          </Section>

          {/* ═══ TEXTOS ═══ */}
          <Section icon={<Type size={14} className="text-primary" />} title="Textos">
            <TextField label="Título personalizado (vazio = nome do link)" value={config.titleText} onChange={v => update({ titleText: v })} placeholder="Resgatar Giro" />
            <TextField label="Subtítulo personalizado" value={config.subtitleText} onChange={v => update({ subtitleText: v })} placeholder="Informe seus dados para resgatar..." />
            <TextField label="Texto do botão" value={config.btnText} onChange={v => update({ btnText: v })} placeholder="🎯 Resgatar Giro" />
            <TextField label="Título de sucesso" value={config.successTitle} onChange={v => update({ successTitle: v })} placeholder="Giro Liberado!" />
            <TextField label="Subtítulo de sucesso" value={config.successSubtitle} onChange={v => update({ successSubtitle: v })} placeholder="" />
            <TextField label="Texto do botão de sucesso" value={config.successBtnText} onChange={v => update({ successBtnText: v })} placeholder="🎰 Ir para a Roleta" />
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={config.showCounter} onChange={e => update({ showCounter: e.target.checked })} className="accent-primary" />
              <span className="text-xs text-muted-foreground">Mostrar contador de resgates</span>
            </div>
          </Section>

          {/* ═══ CORES DO FUNDO ═══ */}
          <Section icon={<Palette size={14} className="text-primary" />} title="Cores do Fundo">
            <ColorField label="Gradiente - De" value={config.bgGradientFrom} onChange={v => update({ bgGradientFrom: v })} />
            <ColorField label="Gradiente - Para" value={config.bgGradientTo} onChange={v => update({ bgGradientTo: v })} />
            <ColorField label="Cor sólida do fundo" value={config.bgColor} onChange={v => update({ bgColor: v })} />
          </Section>

          {/* ═══ BACKGROUND IMAGE ═══ */}
          <Section icon={<Image size={14} className="text-primary" />} title="Imagem de Fundo">
            {config.bgImage ? (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden border border-white/[0.08]">
                  <img src={config.bgImage} alt="BG" className="w-full h-28 object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                </div>
                <div className="flex gap-2">
                  <label className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-xs cursor-pointer hover:bg-white/[0.08] transition">
                    <Upload size={14} /> Trocar
                    <input type="file" accept="image/*" onChange={e => handleUpload(e, 'bgImage')} className="hidden" />
                  </label>
                  <button onClick={() => update({ bgImage: '' })} className="flex-1 py-2 rounded-xl border border-destructive/20 text-destructive text-xs hover:bg-destructive/10 transition">Remover</button>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed border-white/[0.1] hover:border-primary/30 cursor-pointer transition group">
                <Upload size={20} className="text-muted-foreground group-hover:text-primary transition" />
                <span className="text-xs text-muted-foreground">{uploading === 'bgImage' ? 'Enviando...' : 'Upload de imagem de fundo'}</span>
                <input type="file" accept="image/*" onChange={e => handleUpload(e, 'bgImage')} className="hidden" disabled={uploading === 'bgImage'} />
              </label>
            )}
          </Section>

          {/* ═══ CORES DO CARD ═══ */}
          <Section icon={<Palette size={14} className="text-primary" />} title="Cores do Card">
            <ColorField label="Fundo do card" value={config.cardBgColor} onChange={v => update({ cardBgColor: v })} />
            <ColorField label="Borda do card" value={config.cardBorderColor} onChange={v => update({ cardBorderColor: v })} />
            <ColorField label="Cor do título" value={config.titleColor} onChange={v => update({ titleColor: v })} />
            <ColorField label="Cor do subtítulo" value={config.subtitleColor} onChange={v => update({ subtitleColor: v })} />
            <ColorField label="Cor dos labels" value={config.labelColor} onChange={v => update({ labelColor: v })} />
          </Section>

          {/* ═══ INPUTS ═══ */}
          <Section icon={<Type size={14} className="text-primary" />} title="Cores dos Inputs">
            <ColorField label="Fundo dos inputs" value={config.inputBgColor} onChange={v => update({ inputBgColor: v })} />
            <ColorField label="Borda dos inputs" value={config.inputBorderColor} onChange={v => update({ inputBorderColor: v })} />
            <ColorField label="Texto dos inputs" value={config.inputTextColor} onChange={v => update({ inputTextColor: v })} />
          </Section>

          {/* ═══ BOTÃO ═══ */}
          <Section icon={<MousePointer size={14} className="text-primary" />} title="Botão">
            <ColorField label="Cor do botão" value={config.btnBgColor} onChange={v => update({ btnBgColor: v })} />
            <ColorField label="Cor do texto do botão" value={config.btnTextColor} onChange={v => update({ btnTextColor: v })} />
          </Section>

          <ReferralPagePreview config={config} linkLabel={linkLabel} />
          <div className="flex gap-3">
            <button onClick={handleReset} className="flex-1 py-3 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm font-medium hover:bg-white/[0.08] transition flex items-center justify-center gap-2">
              <RotateCcw size={15} /> Resetar
            </button>
            <button onClick={handleSave} disabled={saving} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:brightness-110 transition disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? 'Salvando...' : '💾 Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

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

export default ReferralPageEditor;
