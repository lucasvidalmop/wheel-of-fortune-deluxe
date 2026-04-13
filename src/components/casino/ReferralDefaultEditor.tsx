import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { uploadAppAsset } from '@/lib/uploadAppAsset';
import { ReferralPageConfig, defaultPageConfig } from './ReferralPageEditor';
import ReferralPagePreview from './ReferralPagePreview';
import { Palette, Image, Type, MousePointer, Upload, RotateCcw, Save, Globe, Code } from 'lucide-react';

interface Props {
  userId: string;
  currentConfig: Partial<ReferralPageConfig>;
  onSaved: (cfg: ReferralPageConfig) => void;
}

const ColorField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-xs text-muted-foreground">{label}</span>
    <div className="flex items-center gap-2">
      <input type="color" value={value || '#ffffff'} onInput={e => onChange((e.target as HTMLInputElement).value)} className="w-7 h-7 rounded-lg border border-white/[0.1] cursor-pointer bg-transparent" />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder="padrão" className="w-28 text-[10px] font-mono px-2 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground" />
    </div>
  </div>
);

const TextField = ({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) => (
  <div>
    <label className="text-[10px] text-muted-foreground block mb-1">{label}</label>
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-sm focus:outline-none focus:border-primary/50" />
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

const ReferralDefaultEditor = ({ userId, currentConfig, onSaved }: Props) => {
  const [config, setConfig] = useState<ReferralPageConfig>({ ...defaultPageConfig, ...currentConfig });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    setConfig({ ...defaultPageConfig, ...currentConfig });
  }, [currentConfig]);

  const update = (partial: Partial<ReferralPageConfig>) => setConfig(c => ({ ...c, ...partial }));

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'bgImage' | 'iconUrl' | 'seoFaviconUrl' | 'seoOgImageUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(field);
    try {
      const { publicUrl } = await uploadAppAsset(file, `referral-default-${field}`);
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
    try {
      const { data: dbRow } = await (supabase as any)
        .from('wheel_configs')
        .select('config')
        .eq('user_id', userId)
        .maybeSingle();

      const dbConfig = dbRow?.config || {};
      const mergedConfig = { ...dbConfig, defaultReferralPageConfig: config };

      const { error } = await (supabase as any)
        .from('wheel_configs')
        .update({ config: mergedConfig, updated_at: new Date().toISOString() })
        .eq('user_id', userId);

      if (error) toast.error('Erro ao salvar: ' + error.message);
      else { toast.success('Personalização padrão salva!'); onSaved(config); }
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || ''));
    }
    setSaving(false);
  };

  const handleReset = () => {
    setConfig({ ...defaultPageConfig });
    toast.success('Resetado para padrão');
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
        <p className="text-xs text-muted-foreground">
          ⚡ Esta é a personalização <span className="text-primary font-semibold">padrão</span> aplicada a todos os links que não possuem personalização individual.
        </p>
      </div>

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
        <TextField label="Prefixo do título" value={config.titlePrefix} onChange={v => update({ titlePrefix: v })} placeholder="Ex: 🎯" />
      </Section>

      <Section icon={<Type size={14} className="text-primary" />} title="Textos">
        <TextField label="Título personalizado" value={config.titleText} onChange={v => update({ titleText: v })} placeholder="Resgatar Giro" />
        <TextField label="Subtítulo" value={config.subtitleText} onChange={v => update({ subtitleText: v })} placeholder="Informe seus dados..." />
        <TextField label="Texto do botão" value={config.btnText} onChange={v => update({ btnText: v })} placeholder="🎯 Resgatar Giro" />
        <TextField label="Título de sucesso" value={config.successTitle} onChange={v => update({ successTitle: v })} placeholder="Giro Liberado!" />
        <TextField label="Subtítulo de sucesso" value={config.successSubtitle} onChange={v => update({ successSubtitle: v })} />
        <TextField label="Texto botão de sucesso" value={config.successBtnText} onChange={v => update({ successBtnText: v })} placeholder="🎰 Ir para a Roleta" />
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={config.showCounter} onChange={e => update({ showCounter: e.target.checked })} className="accent-primary" />
          <span className="text-xs text-muted-foreground">Mostrar contador de resgates</span>
        </div>
      </Section>

      <Section icon={<Palette size={14} className="text-primary" />} title="Cores do Fundo">
        <ColorField label="Gradiente - De" value={config.bgGradientFrom} onChange={v => update({ bgGradientFrom: v })} />
        <ColorField label="Gradiente - Para" value={config.bgGradientTo} onChange={v => update({ bgGradientTo: v })} />
        <ColorField label="Cor sólida do fundo" value={config.bgColor} onChange={v => update({ bgColor: v })} />
      </Section>

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

      <Section icon={<Palette size={14} className="text-primary" />} title="Cores do Card">
        <ColorField label="Fundo do card" value={config.cardBgColor} onChange={v => update({ cardBgColor: v })} />
        <ColorField label="Borda do card" value={config.cardBorderColor} onChange={v => update({ cardBorderColor: v })} />
        <ColorField label="Cor do título" value={config.titleColor} onChange={v => update({ titleColor: v })} />
        <ColorField label="Cor do subtítulo" value={config.subtitleColor} onChange={v => update({ subtitleColor: v })} />
        <ColorField label="Cor dos labels" value={config.labelColor} onChange={v => update({ labelColor: v })} />
      </Section>

      <Section icon={<Type size={14} className="text-primary" />} title="Cores dos Inputs">
        <ColorField label="Fundo dos inputs" value={config.inputBgColor} onChange={v => update({ inputBgColor: v })} />
        <ColorField label="Borda dos inputs" value={config.inputBorderColor} onChange={v => update({ inputBorderColor: v })} />
        <ColorField label="Texto dos inputs" value={config.inputTextColor} onChange={v => update({ inputTextColor: v })} />
      </Section>

      <Section icon={<MousePointer size={14} className="text-primary" />} title="Botão">
        <ColorField label="Cor do botão" value={config.btnBgColor} onChange={v => update({ btnBgColor: v })} />
        <ColorField label="Cor do texto do botão" value={config.btnTextColor} onChange={v => update({ btnTextColor: v })} />
      </Section>

      <Section icon={<Type size={14} className="text-primary" />} title="Tela de Limite Atingido">
        <TextField label="Emoji" value={config.limitEmoji} onChange={v => update({ limitEmoji: v })} placeholder="⏰" />
        <TextField label="Título" value={config.limitTitle} onChange={v => update({ limitTitle: v })} placeholder="Resgates Esgotados" />
        <TextField label="Subtítulo" value={config.limitSubtitle} onChange={v => update({ limitSubtitle: v })} placeholder="Este link atingiu o limite máximo..." />
        <ColorField label="Cor do título" value={config.limitTitleColor} onChange={v => update({ limitTitleColor: v })} />
        <ColorField label="Cor do subtítulo" value={config.limitSubtitleColor} onChange={v => update({ limitSubtitleColor: v })} />
        <ColorField label="Fundo do card" value={config.limitCardBgColor} onChange={v => update({ limitCardBgColor: v })} />
        <ColorField label="Borda do card" value={config.limitCardBorderColor} onChange={v => update({ limitCardBorderColor: v })} />
      </Section>

      {/* ═══ SEO ═══ */}
      <Section icon={<Globe size={14} className="text-primary" />} title="SEO / Meta Tags (Padrão)">
        <TextField label="Título da página (tab do navegador)" value={config.seoTitle} onChange={v => update({ seoTitle: v })} placeholder="Ex: Ganhe giros grátis!" />
        <TextField label="Descrição (meta description)" value={config.seoDescription} onChange={v => update({ seoDescription: v })} placeholder="Ex: Cadastre-se e ganhe giros na roleta" />
        <div>
          <label className="text-[10px] text-muted-foreground block mb-1">Favicon</label>
          {config.seoFaviconUrl ? (
            <div className="flex items-center gap-3">
              <img src={config.seoFaviconUrl} alt="Favicon" className="w-8 h-8 rounded object-cover border border-white/[0.1]" />
              <div className="flex gap-2">
                <label className="px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-foreground text-xs cursor-pointer hover:bg-white/[0.1] transition">
                  Trocar <input type="file" accept="image/*" onChange={e => handleUpload(e, 'seoFaviconUrl')} className="hidden" />
                </label>
                <button onClick={() => update({ seoFaviconUrl: '' })} className="px-3 py-1.5 rounded-lg border border-destructive/20 text-destructive text-xs hover:bg-destructive/10 transition">Remover</button>
              </div>
            </div>
          ) : (
            <label className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-white/[0.1] hover:border-primary/30 cursor-pointer transition">
              <Upload size={14} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{uploading === 'seoFaviconUrl' ? 'Enviando...' : 'Upload de favicon'}</span>
              <input type="file" accept="image/*" onChange={e => handleUpload(e, 'seoFaviconUrl')} className="hidden" disabled={uploading === 'seoFaviconUrl'} />
            </label>
          )}
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground block mb-1">Imagem social (OG Image)</label>
          {config.seoOgImageUrl ? (
            <div className="space-y-2">
              <img src={config.seoOgImageUrl} alt="OG" className="w-full h-24 rounded-xl object-cover border border-white/[0.08]" />
              <div className="flex gap-2">
                <label className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-xs cursor-pointer hover:bg-white/[0.08] transition">
                  <Upload size={14} /> Trocar
                  <input type="file" accept="image/*" onChange={e => handleUpload(e, 'seoOgImageUrl')} className="hidden" />
                </label>
                <button onClick={() => update({ seoOgImageUrl: '' })} className="flex-1 py-2 rounded-xl border border-destructive/20 text-destructive text-xs hover:bg-destructive/10 transition">Remover</button>
              </div>
            </div>
          ) : (
            <label className="flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed border-white/[0.1] hover:border-primary/30 cursor-pointer transition">
              <Upload size={16} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{uploading === 'seoOgImageUrl' ? 'Enviando...' : 'Upload de imagem social'}</span>
              <input type="file" accept="image/*" onChange={e => handleUpload(e, 'seoOgImageUrl')} className="hidden" disabled={uploading === 'seoOgImageUrl'} />
            </label>
          )}
        </div>
      </Section>

      {/* ═══ PIXEL / TRACKING ═══ */}
      <Section icon={<Code size={14} className="text-primary" />} title="Pixel / Tracking (Padrão)">
        <TextField label="Facebook Pixel ID" value={config.pixelFacebook} onChange={v => update({ pixelFacebook: v })} placeholder="Ex: 123456789012345" />
        <TextField label="Google Analytics / GTM ID" value={config.pixelGoogle} onChange={v => update({ pixelGoogle: v })} placeholder="Ex: G-XXXXXXX ou GTM-XXXXXXX" />
        <TextField label="TikTok Pixel ID" value={config.pixelTikTok} onChange={v => update({ pixelTikTok: v })} placeholder="Ex: CXXXXXXXXXXXXXXX" />
        <div>
          <label className="text-[10px] text-muted-foreground block mb-1">Script personalizado (head)</label>
          <textarea
            value={config.pixelCustomHead}
            onChange={e => update({ pixelCustomHead: e.target.value })}
            placeholder="<!-- Cole aqui scripts de tracking -->"
            rows={3}
            className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-xs font-mono focus:outline-none focus:border-primary/50 resize-none"
          />
        </div>
      </Section>

      <ReferralPagePreview config={config} linkLabel="Preview Padrão" />

      <div className="flex gap-3">
        <button onClick={handleReset} className="flex-1 py-3 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm font-medium hover:bg-white/[0.08] transition flex items-center justify-center gap-2">
          <RotateCcw size={15} /> Resetar
        </button>
        <button onClick={handleSave} disabled={saving} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:brightness-110 transition disabled:opacity-50 flex items-center justify-center gap-2">
          {saving ? 'Salvando...' : <><Save size={15} /> Salvar Padrão</>}
        </button>
      </div>
    </div>
  );
};

export default ReferralDefaultEditor;
