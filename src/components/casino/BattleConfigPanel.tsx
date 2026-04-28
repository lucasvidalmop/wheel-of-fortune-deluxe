import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { defaultBattleConfig, type BattleConfig, type BattleParticipant } from './battleTypes';
import BattleWheel from './BattleWheel';
import { Plus, Trash2, Save, RotateCcw, Upload } from 'lucide-react';
import { uploadAppAsset } from '@/lib/uploadAppAsset';

interface Props {
  userId: string;
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="flex flex-col gap-1 text-sm">
    <span className="text-foreground/80 font-medium">{label}</span>
    {children}
  </label>
);

const ColorInput = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <div className="flex items-center gap-2">
    <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-12 rounded border border-border bg-transparent" />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 flex-1 rounded border border-border bg-background px-2 text-xs font-mono"
    />
  </div>
);

const NumberInput = ({ value, onChange, min, max, step }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) => (
  <input
    type="number"
    value={value}
    min={min}
    max={max}
    step={step ?? 1}
    onChange={(e) => onChange(Number(e.target.value))}
    className="h-8 rounded border border-border bg-background px-2 text-sm"
  />
);

const TextInput = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
  <input
    type="text"
    value={value}
    placeholder={placeholder}
    onChange={(e) => onChange(e.target.value)}
    className="h-8 rounded border border-border bg-background px-2 text-sm"
  />
);

const ImageUpload = ({ value, onChange, folder }: { value?: string; onChange: (url: string) => void; folder: string }) => {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { publicUrl } = await uploadAppAsset(file, folder);
      onChange(publicUrl);
      toast.success('Imagem enviada!');
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao enviar imagem');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-2">
      {value && (
        <img src={value} alt="" className="h-10 w-16 rounded border border-border object-cover" />
      )}
      <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-border bg-background px-2 h-8 text-xs hover:bg-muted">
        <Upload size={12} />
        {uploading ? 'Enviando...' : value ? 'Trocar' : 'Enviar'}
        <input ref={inputRef} type="file" accept="image/*" onChange={handle} className="hidden" disabled={uploading} />
      </label>
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="text-destructive hover:opacity-80"
          aria-label="Remover imagem"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
};

const AudioUpload = ({ value, onChange, folder }: { value?: string; onChange: (url: string) => void; folder: string }) => {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      toast.error('Selecione um arquivo de áudio (MP3, WAV, etc.)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('O áudio deve ter no máximo 5MB');
      return;
    }
    setUploading(true);
    try {
      const { publicUrl } = await uploadAppAsset(file, folder);
      onChange(publicUrl);
      toast.success('Áudio enviado!');
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao enviar áudio');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-border bg-background px-2 h-8 text-xs hover:bg-muted">
          <Upload size={12} />
          {uploading ? 'Enviando...' : value ? 'Trocar áudio' : 'Enviar áudio'}
          <input ref={inputRef} type="file" accept="audio/*" onChange={handle} className="hidden" disabled={uploading} />
        </label>
        {value && (
          <>
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-destructive hover:opacity-80"
              aria-label="Remover áudio"
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>
      {value && (
        <audio src={value} controls className="w-full h-8" />
      )}
    </div>
  );
};

// Mock participants for the live preview only (not saved).
const previewParticipants: BattleParticipant[] = [
  { id: 'p1', name: 'Jogador 1', game: 'Fortune Tiger', weight: 1 },
  { id: 'p2', name: 'Jogador 2', game: 'Fortune Ox', weight: 1 },
  { id: 'p3', name: 'Jogador 3', game: 'Aviator', weight: 1 },
  { id: 'p4', name: 'Jogador 4', game: 'Mines', weight: 1 },
];

export default function BattleConfigPanel({ userId }: Props) {
  const [config, setConfig] = useState<BattleConfig>(defaultBattleConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase as any)
        .from('battle_configs')
        .select('config')
        .eq('user_id', userId)
        .maybeSingle();

      if (cancelled) return;
      if (!error && data?.config && typeof data.config === 'object') {
        setConfig({ ...defaultBattleConfig, ...data.config });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const update = <K extends keyof BattleConfig>(key: K, value: BattleConfig[K]) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    setSaving(true);
    const { error } = await (supabase as any)
      .from('battle_configs')
      .upsert({ user_id: userId, config }, { onConflict: 'user_id' });
    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
    } else {
      toast.success('Configuração salva!');
    }
  };

  const resetDefaults = () => {
    if (confirm('Restaurar todas as configurações visuais para o padrão?')) {
      setConfig(defaultBattleConfig);
    }
  };

  const updatePalette = (idx: number, color: string) => {
    const next = [...config.segmentPalette];
    next[idx] = color;
    update('segmentPalette', next);
  };
  const addPaletteColor = () => update('segmentPalette', [...config.segmentPalette, '#11161C']);
  const removePaletteColor = (idx: number) => {
    if (config.segmentPalette.length <= 1) return;
    update('segmentPalette', config.segmentPalette.filter((_, i) => i !== idx));
  };

  if (loading) {
    return <div className="p-6 text-foreground/70">Carregando configuração...</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_440px] gap-6 p-4 lg:p-6">
      {/* PREVIEW */}
      <div
        className="rounded-xl border border-border p-6 flex flex-col items-center"
        style={{ backgroundColor: config.bgColor, minHeight: 600 }}
      >
        <div className="text-center mb-6">
          <h2 className="font-black tracking-tight" style={{ fontSize: config.headerTitleSize, color: config.titleColor }}>
            {config.pageTitle}
          </h2>
          <div
            className="mx-auto mt-2"
            style={{ width: 60, height: 2, backgroundColor: config.headerAccentColor, boxShadow: `0 0 10px ${config.headerAccentColor}` }}
          />
          {config.pageSubtitle && (
            <p className="mt-2" style={{ color: config.panelLabelColor, fontSize: config.headerSubtitleSize }}>
              {config.pageSubtitle}
            </p>
          )}
        </div>
        <BattleWheel config={config} participants={previewParticipants} />
      </div>

      {/* CONTROLS */}
      <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2">
        <div className="flex items-center gap-2 sticky top-0 bg-background z-10 py-2 -my-2 border-b border-border">
          <button onClick={save} disabled={saving} className="flex-1 inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-primary text-primary-foreground font-semibold disabled:opacity-50">
            <Save size={16} /> {saving ? 'Salvando...' : 'Salvar'}
          </button>
          <button onClick={resetDefaults} className="inline-flex items-center justify-center gap-2 h-10 px-3 rounded-lg border border-border text-sm">
            <RotateCcw size={14} /> Padrão
          </button>
        </div>

        {/* Header */}
        <section className="space-y-3">
          <h3 className="font-bold text-foreground">Cabeçalho & SEO</h3>
          <Field label="Título"><TextInput value={config.pageTitle} onChange={(v) => update('pageTitle', v)} /></Field>
          <Field label="Subtítulo (opcional)"><TextInput value={config.pageSubtitle} onChange={(v) => update('pageSubtitle', v)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cor do título"><ColorInput value={config.titleColor} onChange={(v) => update('titleColor', v)} /></Field>
            <Field label="Cor do detalhe (linha)"><ColorInput value={config.headerAccentColor} onChange={(v) => update('headerAccentColor', v)} /></Field>
            <Field label="Tamanho título"><NumberInput value={config.headerTitleSize} onChange={(v) => update('headerTitleSize', v)} min={10} max={120} /></Field>
            <Field label="Tamanho subtítulo"><NumberInput value={config.headerSubtitleSize} onChange={(v) => update('headerSubtitleSize', v)} min={8} max={60} /></Field>
          </div>
          <Field label="Modo do cabeçalho">
            <select
              value={config.headerMode}
              onChange={(e) => update('headerMode', e.target.value as BattleConfig['headerMode'])}
              className="h-8 rounded border border-border bg-background px-2 text-sm"
            >
              <option value="text">Apenas texto</option>
              <option value="image">Apenas imagem</option>
              <option value="image_text">Imagem + texto</option>
            </select>
          </Field>
          <Field label="Imagem do cabeçalho"><ImageUpload value={config.headerImageUrl} onChange={(v) => update('headerImageUrl', v)} folder="battle/header" /></Field>
          <Field label="Tamanho da imagem"><NumberInput value={config.headerImageSize} onChange={(v) => update('headerImageSize', v)} min={40} max={500} /></Field>
          <Field label="SEO Title"><TextInput value={config.seoTitle ?? ''} onChange={(v) => update('seoTitle', v)} /></Field>
          <Field label="SEO Description"><TextInput value={config.seoDescription ?? ''} onChange={(v) => update('seoDescription', v)} /></Field>
          <Field label="Favicon"><ImageUpload value={config.faviconUrl} onChange={(v) => update('faviconUrl', v)} folder="battle/favicon" /></Field>
        </section>

        {/* Spin sound */}
        <section className="space-y-3">
          <h3 className="font-bold text-foreground">Som da Roleta</h3>
          <p className="text-xs text-muted-foreground">
            Envie um MP3/WAV. O giro acompanhará automaticamente a duração do áudio. Sem áudio = sem som.
          </p>
          <Field label="Arquivo de áudio">
            <AudioUpload
              value={config.spinSoundUrl}
              onChange={(v) => update('spinSoundUrl', v)}
              folder="battle/spin-sound"
            />
          </Field>
          <Field label={`Volume — ${Math.round(((config.spinSoundVolume ?? 0.85) * 100))}%`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={config.spinSoundVolume ?? 0.85}
              onChange={(e) => update('spinSoundVolume', Number(e.target.value))}
              className="w-full accent-primary"
            />
          </Field>
        </section>

        {/* Background */}
        <section className="space-y-3">
          <h3 className="font-bold text-foreground">Fundo</h3>
          <Field label="Cor de fundo"><ColorInput value={config.bgColor} onChange={(v) => update('bgColor', v)} /></Field>
          <Field label="Imagem de fundo (desktop)"><ImageUpload value={config.bgImageUrl} onChange={(v) => update('bgImageUrl', v)} folder="battle/bg-desktop" /></Field>
          <Field label="Imagem de fundo (mobile)"><ImageUpload value={config.bgImageMobileUrl} onChange={(v) => update('bgImageMobileUrl', v)} folder="battle/bg-mobile" /></Field>
        </section>

        {/* Wheel visuals */}
        <section className="space-y-3">
          <h3 className="font-bold text-foreground">Visual da Roleta</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Anel externo"><ColorInput value={config.wheelOuterRingColor} onChange={(v) => update('wheelOuterRingColor', v)} /></Field>
            <Field label="Disco interno"><ColorInput value={config.wheelInnerColor} onChange={(v) => update('wheelInnerColor', v)} /></Field>
            <Field label="Brilho/glow"><ColorInput value={config.wheelGlowColor} onChange={(v) => update('wheelGlowColor', v)} /></Field>
            <Field label="Ponteiro"><ColorInput value={config.wheelPointerColor} onChange={(v) => update('wheelPointerColor', v)} /></Field>
            <Field label="Divisores"><ColorInput value={config.wheelDividerColor} onChange={(v) => update('wheelDividerColor', v)} /></Field>
            <Field label="Largura divisor"><NumberInput value={config.wheelDividerWidth} onChange={(v) => update('wheelDividerWidth', v)} min={0} max={20} /></Field>
          </div>
          <h4 className="text-sm font-semibold text-foreground/80 mt-2">Botão central (SPIN)</h4>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Texto"><TextInput value={config.wheelCenterButtonText} onChange={(v) => update('wheelCenterButtonText', v)} /></Field>
            <Field label="Cor de fundo"><ColorInput value={config.wheelCenterButtonColor} onChange={(v) => update('wheelCenterButtonColor', v)} /></Field>
            <Field label="Cor do texto"><ColorInput value={config.wheelCenterButtonTextColor} onChange={(v) => update('wheelCenterButtonTextColor', v)} /></Field>
          </div>
          <Field label="Imagem do botão (opcional — substitui o texto)">
            <ImageUpload
              value={config.wheelCenterButtonImageUrl}
              onChange={(url) => update('wheelCenterButtonImageUrl', url)}
              folder="battle-center-button"
            />
          </Field>
        </section>

        {/* Segments */}
        <section className="space-y-3">
          <h3 className="font-bold text-foreground">Segmentos</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cor do texto"><ColorInput value={config.segmentTextColor} onChange={(v) => update('segmentTextColor', v)} /></Field>
            <Field label="Tamanho da fonte"><NumberInput value={config.segmentFontSize} onChange={(v) => update('segmentFontSize', v)} min={8} max={40} /></Field>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-foreground/80 font-medium">Paleta de cores</span>
              <button onClick={addPaletteColor} className="text-xs text-primary inline-flex items-center gap-1"><Plus size={12} /> cor</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {config.segmentPalette.map((c, i) => (
                <div key={i} className="flex items-center gap-1">
                  <ColorInput value={c} onChange={(v) => updatePalette(i, v)} />
                  <button onClick={() => removePaletteColor(i)} className="h-8 w-8 inline-flex items-center justify-center text-destructive">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Side Panels */}
        <section className="space-y-3">
          <h3 className="font-bold text-foreground">Painéis Laterais (Novo Jogador / Ranking)</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fundo do painel"><ColorInput value={config.panelBgColor} onChange={(v) => update('panelBgColor', v)} /></Field>
            <Field label="Borda do painel"><ColorInput value={config.panelBorderColor} onChange={(v) => update('panelBorderColor', v)} /></Field>
            <Field label="Texto"><ColorInput value={config.panelTextColor} onChange={(v) => update('panelTextColor', v)} /></Field>
            <Field label="Labels (uppercase)"><ColorInput value={config.panelLabelColor} onChange={(v) => update('panelLabelColor', v)} /></Field>
            <Field label="Fundo do input"><ColorInput value={config.inputBgColor} onChange={(v) => update('inputBgColor', v)} /></Field>
            <Field label="Borda do input"><ColorInput value={config.inputBorderColor} onChange={(v) => update('inputBorderColor', v)} /></Field>
          </div>
        </section>

        {/* Button */}
        <section className="space-y-3">
          <h3 className="font-bold text-foreground">Botão GIRAR (abaixo da roleta)</h3>
          <Field label="Texto do botão"><TextInput value={config.buttonText} onChange={(v) => update('buttonText', v)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fundo"><ColorInput value={config.buttonColor} onChange={(v) => update('buttonColor', v)} /></Field>
            <Field label="Texto"><ColorInput value={config.buttonTextColor} onChange={(v) => update('buttonTextColor', v)} /></Field>
            <Field label="Borda"><ColorInput value={config.buttonBorderColor} onChange={(v) => update('buttonBorderColor', v)} /></Field>
            <Field label="Tamanho fonte"><NumberInput value={config.buttonFontSize} onChange={(v) => update('buttonFontSize', v)} min={10} max={40} /></Field>
            <Field label="Borda (raio)"><NumberInput value={config.buttonBorderRadius} onChange={(v) => update('buttonBorderRadius', v)} min={0} max={40} /></Field>
          </div>
        </section>

        {/* Result */}
        <section className="space-y-3">
          <h3 className="font-bold text-foreground">Caixa do Vencedor</h3>
          <Field label="Título da caixa"><TextInput value={config.resultTitle} onChange={(v) => update('resultTitle', v)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fundo"><ColorInput value={config.resultBoxColor} onChange={(v) => update('resultBoxColor', v)} /></Field>
            <Field label="Texto"><ColorInput value={config.resultTextColor} onChange={(v) => update('resultTextColor', v)} /></Field>
            <Field label="Borda"><ColorInput value={config.resultBorderColor} onChange={(v) => update('resultBorderColor', v)} /></Field>
          </div>
        </section>
      </div>
    </div>
  );
}
