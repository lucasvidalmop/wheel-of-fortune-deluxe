import React, { useRef, useState } from 'react';
import { WheelConfig } from './types';
import { getApiBaseUrl, setApiBaseUrl } from '@/services/api';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CustomizationPanelProps {
  config: WheelConfig;
  onChange: (config: WheelConfig) => void;
}

const ColorInput: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-xs text-muted-foreground">{label}</span>
    <div className="flex items-center gap-1.5">
      <input type="color" value={value} onChange={e => onChange(e.target.value)} className="w-7 h-7 rounded cursor-pointer border border-border bg-transparent" />
      <span className="text-xs font-mono text-muted-foreground w-16">{value}</span>
    </div>
  </div>
);

const ImageUpload: React.FC<{ label: string; value?: string; onChange: (v: string) => void; folder?: string }> = ({ label, value, onChange, folder = 'wheel' }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || 'anonymous';
      const fileName = `${userId}/${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('app-assets')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('app-assets')
        .getPublicUrl(fileName);

      onChange(publicUrl);
      toast.success('Imagem enviada com sucesso!');
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error('Erro ao enviar imagem: ' + (err.message || 'Tente novamente'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="flex gap-2 items-center">
        {value && <img src={value} alt="" className="w-8 h-8 rounded object-cover border border-border" />}
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-xs px-3 py-1.5 rounded border border-border bg-secondary text-foreground hover:bg-accent transition-colors disabled:opacity-50"
        >
          {uploading ? 'Enviando...' : value ? 'Trocar' : 'Upload'}
        </button>
        {value && (
          <button onClick={() => onChange('')} className="text-xs px-2 py-1.5 rounded border border-border text-destructive hover:bg-destructive/10 transition-colors">✕</button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
    </div>
  );
};

const RangeInput: React.FC<{ label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; suffix?: string }> = ({ label, value, min, max, step = 1, onChange, suffix = '' }) => (
  <div className="flex items-center gap-3">
    <span className="text-xs text-muted-foreground w-20 shrink-0">{label}</span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} className="flex-1 accent-primary" />
    <span className="text-xs font-mono text-muted-foreground w-10 text-right">{step < 1 ? value.toFixed(1) : value}{suffix}</span>
  </div>
);

const ImagePositionControls: React.FC<{
  offsetX: number; offsetY: number; scale: number;
  onChangeX: (v: number) => void; onChangeY: (v: number) => void; onChangeScale: (v: number) => void;
}> = ({ offsetX, offsetY, scale, onChangeX, onChangeY, onChangeScale }) => (
  <div className="space-y-1 pl-2 border-l-2 border-border ml-1">
    <RangeInput label="Mover X" value={offsetX} min={-200} max={200} onChange={onChangeX} />
    <RangeInput label="Mover Y" value={offsetY} min={-200} max={200} onChange={onChangeY} />
    <RangeInput label="Zoom" value={scale} min={0.1} max={5} step={0.1} onChange={onChangeScale} />
  </div>
);

const Section: React.FC<{ title: string; emoji?: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, emoji, children, defaultOpen = false }) => (
  <details open={defaultOpen} className="group border border-border rounded-lg overflow-hidden">
    <summary className="flex items-center gap-2 px-4 py-2.5 cursor-pointer bg-secondary/30 hover:bg-secondary/60 transition-colors text-xs font-bold text-foreground uppercase tracking-wide">
      {emoji && <span>{emoji}</span>}
      {title}
      <span className="ml-auto text-muted-foreground group-open:rotate-90 transition-transform">▶</span>
    </summary>
    <div className="p-4 space-y-3 bg-card/50">
      {children}
    </div>
  </details>
);

const CustomizationPanel: React.FC<CustomizationPanelProps> = ({ config, onChange }) => {
  const updateGlobal = (key: keyof Omit<WheelConfig, 'segments'>, value: any) => {
    onChange({ ...config, [key]: value });
  };

  const updateSegment = (index: number, key: string, value: string | number) => {
    const segs = [...config.segments];
    segs[index] = { ...segs[index], [key]: value };
    onChange({ ...config, segments: segs });
  };

  const [apiUrl, setApiUrlState] = useState(getApiBaseUrl());

  return (
    <div className="w-80 max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card p-3 space-y-3">
      <h2 className="font-display text-sm font-bold tracking-wider text-primary uppercase px-1">⚙ Personalização</h2>

      {/* ===== CABEÇALHO DA ROLETA ===== */}
      <Section title="Cabeçalho da Roleta" emoji="📝">
        <div className="flex gap-2">
          <button
            onClick={() => updateGlobal('headerMode', 'text')}
            className="flex-1 text-xs py-1.5 rounded border transition-colors"
            style={{
              borderColor: config.headerMode === 'text' ? 'hsl(var(--primary))' : 'hsl(var(--border))',
              background: config.headerMode === 'text' ? 'hsl(var(--primary) / 0.15)' : 'transparent',
              color: 'hsl(var(--foreground))',
            }}
          >
            Título + Subtítulo
          </button>
          <button
            onClick={() => updateGlobal('headerMode', 'image')}
            className="flex-1 text-xs py-1.5 rounded border transition-colors"
            style={{
              borderColor: config.headerMode === 'image' ? 'hsl(var(--primary))' : 'hsl(var(--border))',
              background: config.headerMode === 'image' ? 'hsl(var(--primary) / 0.15)' : 'transparent',
              color: 'hsl(var(--foreground))',
            }}
          >
            Imagem
          </button>
        </div>
        {config.headerMode === 'text' ? (
          <div className="space-y-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Título</label>
              <input type="text" value={config.pageTitle} onChange={e => updateGlobal('pageTitle', e.target.value)} className="w-full text-xs px-2 py-1.5 rounded border border-border bg-input text-foreground" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Subtítulo</label>
              <input type="text" value={config.pageSubtitle} onChange={e => updateGlobal('pageSubtitle', e.target.value)} className="w-full text-xs px-2 py-1.5 rounded border border-border bg-input text-foreground" />
            </div>
            <RangeInput label="Tam. título" value={config.headerTitleSize ?? 36} min={16} max={72} onChange={v => updateGlobal('headerTitleSize', v)} />
            <RangeInput label="Tam. subtít." value={config.headerSubtitleSize ?? 12} min={8} max={36} onChange={v => updateGlobal('headerSubtitleSize', v)} />
          </div>
        ) : (
          <div className="space-y-2">
            <ImageUpload label="Imagem do cabeçalho" value={config.headerImageUrl} onChange={v => updateGlobal('headerImageUrl', v)} />
            <RangeInput label="Tamanho" value={config.headerImageSize ?? 120} min={40} max={300} step={5} onChange={v => updateGlobal('headerImageSize', v)} />
            {config.headerImageUrl && (
              <ImagePositionControls
                offsetX={config.headerImageOffsetX ?? 0} offsetY={config.headerImageOffsetY ?? 0} scale={config.headerImageScale ?? 1}
                onChangeX={v => updateGlobal('headerImageOffsetX', v)} onChangeY={v => updateGlobal('headerImageOffsetY', v)} onChangeScale={v => updateGlobal('headerImageScale', v)}
              />
            )}
          </div>
        )}
      </Section>

      {/* ===== FUNDO DA PÁGINA ===== */}
      <Section title="Fundo da Roleta" emoji="🖼">
        <ImageUpload label="Imagem de fundo" value={config.backgroundImageUrl} onChange={v => updateGlobal('backgroundImageUrl', v)} />
        {config.backgroundImageUrl && (
          <ImagePositionControls
            offsetX={config.backgroundImageOffsetX ?? 0} offsetY={config.backgroundImageOffsetY ?? 0} scale={config.backgroundImageScale ?? 1}
            onChangeX={v => updateGlobal('backgroundImageOffsetX', v)} onChangeY={v => updateGlobal('backgroundImageOffsetY', v)} onChangeScale={v => updateGlobal('backgroundImageScale', v)}
          />
        )}
      </Section>

      {/* ===== CORES DA ROLETA ===== */}
      <Section title="Cores da Roleta" emoji="🎨">
        <ColorInput label="Anel externo" value={config.outerRingColor} onChange={v => updateGlobal('outerRingColor', v)} />
        <ColorInput label="LEDs" value={config.ledColor} onChange={v => updateGlobal('ledColor', v)} />
        <ColorInput label="Centro" value={config.centerCapColor} onChange={v => updateGlobal('centerCapColor', v)} />
        <ColorInput label="Divisores" value={config.dividerColor} onChange={v => updateGlobal('dividerColor', v)} />
        <ColorInput label="Brilho" value={config.glowColor} onChange={v => updateGlobal('glowColor', v)} />
        <ColorInput label="Ponteiro" value={config.pointerColor} onChange={v => updateGlobal('pointerColor', v)} />
      </Section>

      {/* ===== AJUSTES DA ROLETA ===== */}
      <Section title="Ajustes da Roleta" emoji="🔧">
        <RangeInput label="Divisores" value={config.dividerWidth ?? 3} min={0} max={8} step={0.5} onChange={v => updateGlobal('dividerWidth', v)} />
        <RangeInput label="LEDs" value={config.ledSize ?? 5} min={2} max={12} step={0.5} onChange={v => updateGlobal('ledSize', v)} />
        <RangeInput label="Escala fonte" value={config.fontSizeScale ?? 1} min={0.5} max={2} step={0.1} onChange={v => updateGlobal('fontSizeScale', v)} suffix="x" />
        <RangeInput label="Tam. valor" value={config.valueFontSize ?? 22} min={8} max={40} onChange={v => updateGlobal('valueFontSize', v)} />
        <RangeInput label="Tam. título" value={config.titleFontSize ?? 10} min={6} max={30} onChange={v => updateGlobal('titleFontSize', v)} />
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground">Ocultar texto</span>
          <button
            onClick={() => updateGlobal('hideSegmentText', !config.hideSegmentText)}
            className="w-10 h-5 rounded-full relative transition-colors"
            style={{ background: config.hideSegmentText ? 'hsl(var(--primary))' : 'hsl(var(--muted))' }}
          >
            <div className="w-4 h-4 rounded-full bg-foreground absolute top-0.5 transition-all" style={{ left: config.hideSegmentText ? '22px' : '2px' }} />
          </button>
        </div>
      </Section>

      {/* ===== BOTÃO & RESULTADO ===== */}
      <Section title="Botão & Resultado" emoji="🏆">
        <ColorInput label="Cor do botão" value={config.buttonColor} onChange={v => updateGlobal('buttonColor', v)} />
        <ColorInput label="Texto do botão" value={config.buttonTextColor} onChange={v => updateGlobal('buttonTextColor', v)} />
        <ColorInput label="Fundo do prêmio" value={config.resultBoxColor} onChange={v => updateGlobal('resultBoxColor', v)} />
        <ColorInput label="Borda do prêmio" value={config.resultBorderColor} onChange={v => updateGlobal('resultBorderColor', v)} />
        <ColorInput label="Texto do prêmio" value={config.resultTextColor} onChange={v => updateGlobal('resultTextColor', v)} />
      </Section>

      {/* ===== IMAGEM CENTRAL ===== */}
      <Section title="Imagem Central" emoji="⚡">
        <ImageUpload label="Logo / ícone do centro" value={config.centerImageUrl} onChange={v => updateGlobal('centerImageUrl', v)} />
        {config.centerImageUrl && (
          <ImagePositionControls
            offsetX={config.centerImageOffsetX ?? 0} offsetY={config.centerImageOffsetY ?? 0} scale={config.centerImageScale ?? 1}
            onChangeX={v => updateGlobal('centerImageOffsetX', v)} onChangeY={v => updateGlobal('centerImageOffsetY', v)} onChangeScale={v => updateGlobal('centerImageScale', v)}
          />
        )}
      </Section>

      {/* ===== SEGMENTOS ===== */}
      <Section title="Segmentos" emoji="🍕">
        <div className="flex justify-end">
          <button
            onClick={() => {
              const newSeg = { id: Date.now().toString(), title: 'NOVO', reward: '0', color: '#1a1a3e', gradientOverlay: 'rgba(255,255,255,0.1)', textColor: '#FFFFFF', percentage: 10 };
              onChange({ ...config, segments: [...config.segments, newSeg] });
            }}
            className="text-xs px-2.5 py-1 rounded border border-border bg-secondary text-foreground hover:bg-accent transition-colors"
          >
            + Adicionar
          </button>
        </div>
        {config.segments.map((seg, i) => (
          <details key={seg.id} className="group border border-border rounded-lg overflow-hidden">
            <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer bg-secondary/50 hover:bg-secondary text-xs font-bold">
              <div className="w-3 h-3 rounded-full" style={{ background: seg.color }} />
              {seg.title || `Segmento ${i + 1}`}
              <span className="ml-auto text-muted-foreground font-normal">{seg.percentage}%</span>
            </summary>
            <div className="p-3 space-y-2 bg-card">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Título</label>
                <input type="text" value={seg.title} onChange={e => updateSegment(i, 'title', e.target.value)} className="w-full text-xs px-2 py-1.5 rounded border border-border bg-input text-foreground" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Valor</label>
                <input type="text" value={seg.reward} onChange={e => updateSegment(i, 'reward', e.target.value)} className="w-full text-xs px-2 py-1.5 rounded border border-border bg-input text-foreground" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Porcentagem (%)</label>
                <input type="number" min={0} max={100} value={seg.percentage} onChange={e => updateSegment(i, 'percentage', Math.max(0, parseInt(e.target.value) || 0))} className="w-full text-xs px-2 py-1.5 rounded border border-border bg-input text-foreground" />
              </div>
              <ColorInput label="Fundo" value={seg.color} onChange={v => updateSegment(i, 'color', v)} />
              <ColorInput label="Texto" value={seg.textColor} onChange={v => updateSegment(i, 'textColor', v)} />
              <ImageUpload label="Imagem do segmento" value={seg.imageUrl} onChange={v => updateSegment(i, 'imageUrl', v)} />
              {seg.imageUrl && (
                <div className="space-y-1">
                  <RangeInput label="X" value={seg.imageOffsetX ?? 0} min={-100} max={100} onChange={v => updateSegment(i, 'imageOffsetX', v)} />
                  <RangeInput label="Y" value={seg.imageOffsetY ?? 0} min={-100} max={100} onChange={v => updateSegment(i, 'imageOffsetY', v)} />
                  <RangeInput label="Escala" value={seg.imageScale ?? 1} min={0.2} max={3} step={0.1} onChange={v => updateSegment(i, 'imageScale', v)} />
                </div>
              )}
              {config.segments.length > 2 && (
                <button
                  onClick={() => onChange({ ...config, segments: config.segments.filter((_, idx) => idx !== i) })}
                  className="w-full text-xs py-1.5 rounded border border-destructive text-destructive hover:bg-destructive/10 transition-colors mt-2"
                >
                  Remover segmento
                </button>
              )}
            </div>
          </details>
        ))}
      </Section>

      {/* ===== API BACKEND ===== */}
      <Section title="API Backend" emoji="🔗">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">URL base da API (Laravel)</label>
          <input
            type="text"
            value={apiUrl}
            placeholder="https://seusite.com"
            onChange={e => { setApiUrlState(e.target.value); setApiBaseUrl(e.target.value); }}
            className="w-full text-xs px-2 py-1.5 rounded border border-border bg-input text-foreground"
          />
          <p className="text-[10px] text-muted-foreground">Rota pública: /roleta?account_id=xxx</p>
        </div>
      </Section>
    </div>
  );
};

export default CustomizationPanel;
