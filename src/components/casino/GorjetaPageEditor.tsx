import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { uploadAppAsset } from '@/lib/uploadAppAsset';
import { Palette, Image, Type, MousePointer, Upload, RotateCcw, Save, Gift, Eye, RefreshCw } from 'lucide-react';
import SlotMachineSuccess from './SlotMachineSuccess';

export interface GorjetaPageConfig {
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
  iconUrl: string;
  titleText: string;
  subtitleText: string;
  headerText: string;
  btnText: string;
  successTitle: string;
  successSubtitle: string;
  successBtnText: string;
  warningText: string;
  termsText: string;
  confirmText: string;
  footerText: string;
  accentColor: string;
  statusDotColor: string;
  // Expired / Limit
  expiredTitle: string;
  expiredSubtitle: string;
  limitTitle: string;
  limitSubtitle: string;
  // Casino name
  casinoName: string;
  // CTA button
  ctaBtnText: string;
  ctaBtnUrl: string;
  ctaBtnBgColor: string;
  ctaBtnTextColor: string;
  ctaBtnBorderColor: string;
  ctaBtnShow: boolean;
  // Terms modal
  termsTitle: string;
  termsContent: string;
  // Slot machine animation
  slotMatchIcon: string;
  slotLuckyText: string;
}

export const defaultGorjetaConfig: GorjetaPageConfig = {
  bgColor: '',
  bgGradientFrom: 'rgba(80,20,120,0.3)',
  bgGradientTo: 'rgba(10,5,30,0.9)',
  bgImage: '',
  cardBgColor: 'rgba(20, 25, 40, 0.92)',
  cardBorderColor: 'rgba(255,255,255,0.06)',
  titleColor: '#ffffff',
  subtitleColor: 'rgba(255,255,255,0.55)',
  labelColor: 'rgba(255,255,255,0.5)',
  inputBgColor: 'rgba(255,255,255,0.04)',
  inputBorderColor: 'rgba(255,255,255,0.08)',
  inputTextColor: '#ffffff',
  btnBgColor: '#2dd4bf',
  btnTextColor: '#000000',
  iconUrl: '',
  titleText: 'Participar',
  subtitleText: 'Cadastre-se agora e concorra a prêmios incríveis todos os dias!',
  headerText: '',
  btnText: 'PARTICIPAR DO SORTEIO',
  successTitle: 'Inscrição Confirmada!',
  successSubtitle: '',
  successBtnText: 'Ir para a Roleta',
  warningText: 'Importante: Prazo de até 72h para crédito.',
  termsText: 'Aceito os Termos de Uso.',
  confirmText: 'Confirmo que os dados são da minha conta.',
  footerText: '',
  accentColor: '#2dd4bf',
  statusDotColor: '',
  expiredTitle: 'Promoção Encerrada',
  expiredSubtitle: 'O prazo desta promoção expirou.',
  limitTitle: 'Inscrições Esgotadas',
  limitSubtitle: 'Este link atingiu o limite máximo de inscrições.',
  casinoName: '',
  ctaBtnText: 'CRIE SUA CONTA PARA PARTICIPAR DE TODOS OS SORTEIOS!',
  ctaBtnUrl: '',
  ctaBtnBgColor: '#ffffff',
  ctaBtnTextColor: '#000000',
  ctaBtnBorderColor: 'rgba(255,255,255,0.1)',
  ctaBtnShow: true,
  termsTitle: 'Termos de Uso – Gorjeta',
  termsContent: `TERMOS DE USO – GORJETA

Ao participar dos sorteios disponibilizados neste aplicativo, o usuário declara que leu, compreendeu e concorda integralmente com os presentes Termos de Uso.

1. Elegibilidade para Participação

1.1. Apenas poderão participar dos sorteios usuários que tenham criado sua conta por meio do link oficial indicado pelo organizador.
1.2. Contas criadas fora do link indicado não serão elegíveis para participação nos sorteios ou recebimento de prêmios.
1.3. O participante deve cumprir todas as regras estabelecidas neste termo para estar apto a participar.

2. Idade Mínima

2.1. A participação nos sorteios é exclusiva para maiores de 18 (dezoito) anos.
2.2. Ao participar, o usuário declara que possui 18 anos ou mais.
2.3. Caso seja identificado que o participante é menor de idade, sua participação será imediatamente cancelada, e qualquer prêmio eventualmente ganho não será concedido.

3. Requisitos de Usuário Ativo

3.1. Para estar apto a participar dos sorteios, o usuário deverá ser considerado usuário ativo.
3.2. Considera-se usuário ativo aquele que realizou ao menos um depósito na plataforma.`,
  slotMatchIcon: '⚡',
  slotLuckyText: '🎰 BOA SORTE! 🎰',
  
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

interface Props {
  userId: string;
  currentConfig: Partial<GorjetaPageConfig>;
  onSaved: (cfg: GorjetaPageConfig) => void;
}

const GorjetaPageEditor = ({ userId, currentConfig, onSaved }: Props) => {
  const [config, setConfig] = useState<GorjetaPageConfig>({ ...defaultGorjetaConfig, ...currentConfig });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);

  useEffect(() => {
    setConfig({ ...defaultGorjetaConfig, ...currentConfig });
  }, [currentConfig]);

  const update = (partial: Partial<GorjetaPageConfig>) => setConfig(c => ({ ...c, ...partial }));

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'bgImage' | 'iconUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(field);
    try {
      const { publicUrl } = await uploadAppAsset(file, `gorjeta-${field}`);
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
      const mergedConfig = { ...dbConfig, gorjetaPageConfig: config };

      const { error } = await (supabase as any)
        .from('wheel_configs')
        .update({ config: mergedConfig, updated_at: new Date().toISOString() })
        .eq('user_id', userId);

      if (error) toast.error('Erro ao salvar: ' + error.message);
      else { toast.success('Visual da gorjeta salvo!'); onSaved(config); }
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || ''));
    }
    setSaving(false);
  };

  const handleReset = () => {
    setConfig({ ...defaultGorjetaConfig });
    toast.success('Resetado para padrão');
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
        <p className="text-xs text-muted-foreground">
          ⚡ Personalize o visual da sua página de <span className="text-primary font-semibold">gorjeta</span>. As alterações serão aplicadas à rota <span className="font-mono text-primary">/gorjeta</span>.
        </p>
      </div>

      <Section icon={<Image size={14} className="text-primary" />} title="Logo / Ícone">
        <div>
          <label className="text-[10px] text-muted-foreground block mb-1">Logo da página</label>
          {config.iconUrl ? (
            <div className="flex items-center gap-3">
              <img src={config.iconUrl} alt="Logo" className="w-12 h-12 rounded-xl object-cover border border-white/[0.1]" />
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
              <span className="text-xs text-muted-foreground">{uploading === 'iconUrl' ? 'Enviando...' : 'Upload de logo'}</span>
              <input type="file" accept="image/*" onChange={e => handleUpload(e, 'iconUrl')} className="hidden" disabled={uploading === 'iconUrl'} />
            </label>
          )}
        </div>
      </Section>

      <Section icon={<Gift size={14} className="text-primary" />} title="Nome do Cassino">
        <TextField label="Nome do cassino (ex: 1PRA1)" value={config.casinoName} onChange={v => update({ casinoName: v })} placeholder="Nome do Cassino" />
        <p className="text-[10px] text-muted-foreground">Aparece em: "ID da Conta *NOME", "Confirmo que os dados são da minha conta *NOME", rodapé e botão CTA.</p>
      </Section>

      <Section icon={<MousePointer size={14} className="text-primary" />} title="Botão CTA (Link Externo)">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">Mostrar botão CTA</span>
          <button
            onClick={() => update({ ctaBtnShow: !config.ctaBtnShow })}
            className={`w-10 h-5 rounded-full transition-colors ${config.ctaBtnShow ? 'bg-primary' : 'bg-white/10'}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${config.ctaBtnShow ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
        {config.ctaBtnShow && (
          <div className="space-y-3">
            <TextField label="Texto do botão CTA" value={config.ctaBtnText} onChange={v => update({ ctaBtnText: v })} placeholder="CRIE SUA CONTA PARA PARTICIPAR..." />
            <TextField label="URL do botão (link)" value={config.ctaBtnUrl} onChange={v => update({ ctaBtnUrl: v })} placeholder="https://exemplo.com/registro" />
            <ColorField label="Fundo do botão CTA" value={config.ctaBtnBgColor} onChange={v => update({ ctaBtnBgColor: v })} />
            <ColorField label="Texto do botão CTA" value={config.ctaBtnTextColor} onChange={v => update({ ctaBtnTextColor: v })} />
            <ColorField label="Borda do botão CTA" value={config.ctaBtnBorderColor} onChange={v => update({ ctaBtnBorderColor: v })} />
          </div>
        )}
      </Section>

      <Section icon={<Type size={14} className="text-primary" />} title="Textos">
        <TextField label="Título do card" value={config.titleText} onChange={v => update({ titleText: v })} placeholder="Participar" />
        <TextField label="Subtítulo / Descrição" value={config.subtitleText} onChange={v => update({ subtitleText: v })} placeholder="Cadastre-se agora e concorra..." />
        <TextField label="Texto do botão" value={config.btnText} onChange={v => update({ btnText: v })} placeholder="PARTICIPAR DO SORTEIO" />
        <TextField label="Aviso (72h)" value={config.warningText} onChange={v => update({ warningText: v })} placeholder="Importante: Prazo de até 72h..." />
        <TextField label="Texto termos" value={config.termsText} onChange={v => update({ termsText: v })} placeholder="Aceito os Termos de Uso." />
        <TextField label="Texto confirmação" value={config.confirmText} onChange={v => update({ confirmText: v })} placeholder="Confirmo que os dados são..." />
        <TextField label="Título de sucesso" value={config.successTitle} onChange={v => update({ successTitle: v })} placeholder="Inscrição Confirmada!" />
        <TextField label="Botão de sucesso" value={config.successBtnText} onChange={v => update({ successBtnText: v })} placeholder="Ir para a Roleta" />
        <TextField label="Rodapé" value={config.footerText} onChange={v => update({ footerText: v })} placeholder="© 2025 Todos os direitos reservados." />
      </Section>

      <Section icon={<Gift size={14} className="text-primary" />} title="Animação de Conclusão (Slot Machine)">
        <TextField label="Emoji do slot (ícone que aparece)" value={config.slotMatchIcon} onChange={v => update({ slotMatchIcon: v })} placeholder="⚡" />
        <TextField label="Texto de sorte" value={config.slotLuckyText} onChange={v => update({ slotLuckyText: v })} placeholder="🎰 BOA SORTE! 🎰" />
        <TextField label="Título de sucesso" value={config.successTitle} onChange={v => update({ successTitle: v })} placeholder="CADASTRO EFETUADO!" />
        <TextField label="Subtítulo de sucesso" value={config.successSubtitle} onChange={v => update({ successSubtitle: v })} placeholder="Agora é só aguardar o sorteio..." />
        <TextField label="Texto do botão CTA" value={config.successBtnText} onChange={v => update({ successBtnText: v })} placeholder="VOCÊ PODE SER O PRÓXIMO GANHADOR!" />
        <p className="text-[10px] text-muted-foreground">A animação mostra um caça-níquel girando → resultado → tela de sucesso com partículas flutuantes.</p>

        {/* Inline Full Animation Preview */}
        <div className="mt-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Eye size={12} /> Pré-visualização:</p>
            <button
              type="button"
              onClick={() => setPreviewKey(k => k + 1)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.06] border border-white/[0.08] text-[10px] text-muted-foreground hover:bg-white/[0.1] hover:text-foreground transition"
            >
              <RefreshCw size={10} /> Reiniciar
            </button>
          </div>
          <div
            className="relative rounded-xl overflow-hidden border border-white/[0.08]"
            style={{ height: 340 }}
          >
            <div key={previewKey} className="absolute inset-0">
              <SlotMachineSuccess
                accentColor={config.accentColor}
                titleColor={config.titleColor}
                subtitleColor={config.subtitleColor}
                btnBgColor={config.btnBgColor}
                btnTextColor={config.btnTextColor}
                successTitle={config.successTitle}
                successSubtitle={config.successSubtitle}
                successBtnText={config.successBtnText}
                slotMatchIcon={config.slotMatchIcon}
                slotLuckyText={config.slotLuckyText}
                ctaUrl={config.ctaBtnUrl}
                showCta={config.ctaBtnShow}
              />
            </div>
          </div>
        </div>
      </Section>

      <Section icon={<Type size={14} className="text-primary" />} title="Termos de Uso (Modal)">
        <TextField label="Título do modal" value={config.termsTitle} onChange={v => update({ termsTitle: v })} placeholder="Termos de Uso – Gorjeta" />
        <div>
          <label className="text-[10px] text-muted-foreground block mb-1">Conteúdo dos termos</label>
          <textarea
            value={config.termsContent}
            onChange={e => update({ termsContent: e.target.value })}
            rows={10}
            placeholder="Digite os termos de uso completos..."
            className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-sm focus:outline-none focus:border-primary/50 resize-y"
          />
        </div>
      </Section>

      <Section icon={<Palette size={14} className="text-primary" />} title="Cor Destaque (Accent)">
        <ColorField label="Cor principal (botão, indicadores)" value={config.accentColor} onChange={v => update({ accentColor: v, btnBgColor: v })} />
        <ColorField label="Cor do texto do botão" value={config.btnTextColor} onChange={v => update({ btnTextColor: v })} />
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

      <Section icon={<Type size={14} className="text-primary" />} title="Tela Expirado / Esgotado">
        <TextField label="Título expirado" value={config.expiredTitle} onChange={v => update({ expiredTitle: v })} placeholder="Promoção Encerrada" />
        <TextField label="Subtítulo expirado" value={config.expiredSubtitle} onChange={v => update({ expiredSubtitle: v })} placeholder="O prazo desta promoção expirou." />
        <TextField label="Título esgotado" value={config.limitTitle} onChange={v => update({ limitTitle: v })} placeholder="Inscrições Esgotadas" />
        <TextField label="Subtítulo esgotado" value={config.limitSubtitle} onChange={v => update({ limitSubtitle: v })} placeholder="Este link atingiu o limite..." />
      </Section>

      <div className="flex gap-3">
        <button onClick={handleReset} className="flex-1 py-3 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm font-medium hover:bg-white/[0.08] transition flex items-center justify-center gap-2">
          <RotateCcw size={15} /> Resetar
        </button>
        <button onClick={handleSave} disabled={saving} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:brightness-110 transition disabled:opacity-50 flex items-center justify-center gap-2">
          {saving ? 'Salvando...' : <><Save size={15} /> Salvar Visual</>}
        </button>
      </div>
    </div>
  );
};

export default GorjetaPageEditor;
