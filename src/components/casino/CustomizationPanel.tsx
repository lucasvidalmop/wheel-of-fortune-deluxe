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
  <div className="flex items-center justify-between gap-2 py-1.5">
    <span className="text-sm text-muted-foreground">{label}</span>
    <div className="flex items-center gap-2">
      <div className="relative">
        <input type="color" value={value} onChange={e => onChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
        <div className="w-8 h-8 rounded-lg border-2 border-border shadow-sm cursor-pointer hover:scale-105 transition-transform" style={{ background: value }} />
      </div>
      <span className="text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-1 rounded">{value}</span>
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
      const { error: uploadError } = await supabase.storage.from('app-assets').upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('app-assets').getPublicUrl(fileName);
      onChange(publicUrl);
      toast.success('Imagem enviada!');
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'Tente novamente'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm text-muted-foreground">{label}</label>
      <div className="flex gap-3 items-center">
        {value && <img src={value} alt="" className="w-12 h-12 rounded-xl object-cover border-2 border-border shadow-sm" />}
        <div className="flex gap-2">
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="text-xs px-4 py-2 rounded-lg border border-border bg-muted/50 text-foreground hover:bg-muted transition-all disabled:opacity-50 font-medium"
          >
            {uploading ? '⏳ Enviando...' : value ? '🔄 Trocar' : '📤 Upload'}
          </button>
          {value && (
            <button onClick={() => onChange('')} className="text-xs px-3 py-2 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-all">✕</button>
          )}
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
    </div>
  );
};

const RangeInput: React.FC<{ label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; suffix?: string }> = ({ label, value, min, max, step = 1, onChange, suffix = '' }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-xs font-mono text-foreground bg-muted/50 px-2 py-0.5 rounded">{step < 1 ? value.toFixed(1) : value}{suffix}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} className="w-full accent-primary h-1.5 rounded-full" />
  </div>
);

const ImagePositionControls: React.FC<{
  offsetX: number; offsetY: number; scale: number;
  onChangeX: (v: number) => void; onChangeY: (v: number) => void; onChangeScale: (v: number) => void;
}> = ({ offsetX, offsetY, scale, onChangeX, onChangeY, onChangeScale }) => (
  <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border/50">
    <RangeInput label="Posição X" value={offsetX} min={-200} max={200} onChange={onChangeX} />
    <RangeInput label="Posição Y" value={offsetY} min={-200} max={200} onChange={onChangeY} />
    <RangeInput label="Zoom" value={scale} min={0.1} max={5} step={0.1} onChange={onChangeScale} />
  </div>
);

const ToggleSwitch: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, checked, onChange }) => (
  <div className="flex items-center justify-between py-1">
    <span className="text-sm text-muted-foreground">{label}</span>
    <button
      onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full relative transition-all duration-300 ${checked ? 'bg-primary shadow-md shadow-primary/30' : 'bg-muted'}`}
    >
      <div className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5 transition-all duration-300 ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  </div>
);

const Section: React.FC<{ title: string; emoji?: string; children: React.ReactNode; defaultOpen?: boolean; description?: string }> = ({ title, emoji, children, defaultOpen = false, description }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`rounded-2xl border transition-all duration-300 overflow-hidden ${open ? 'border-primary/30 shadow-lg shadow-primary/5 bg-card' : 'border-border bg-card/50 hover:bg-card hover:border-border'}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left transition-all"
      >
        {emoji && <span className="text-xl">{emoji}</span>}
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        <span className={`text-muted-foreground transition-transform duration-300 text-xs ${open ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>
      <div className={`transition-all duration-300 ${open ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
        <div className="px-5 pb-5 space-y-3 border-t border-border/50 pt-4">
          {children}
        </div>
      </div>
    </div>
  );
};

const TabButton: React.FC<{ active: boolean; label: string; onClick: () => void }> = ({ active, label, onClick }) => (
  <button
    onClick={onClick}
    className={`flex-1 text-xs py-2.5 rounded-xl font-medium transition-all duration-200 ${
      active ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
    }`}
  >
    {label}
  </button>
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
    <div className="w-full max-w-2xl space-y-4">
      {/* ===== CABEÇALHO DA ROLETA ===== */}
      <Section title="Cabeçalho da Roleta" emoji="📝" description="Título, subtítulo ou imagem">
        <div className="flex gap-2 p-1 rounded-xl bg-muted/50">
          <TabButton active={config.headerMode === 'text'} label="Título + Subtítulo" onClick={() => updateGlobal('headerMode', 'text')} />
          <TabButton active={config.headerMode === 'image'} label="Imagem" onClick={() => updateGlobal('headerMode', 'image')} />
        </div>
        {config.headerMode === 'text' ? (
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground font-medium">Título</label>
              <input type="text" value={config.pageTitle} onChange={e => updateGlobal('pageTitle', e.target.value)} className="w-full text-sm px-4 py-2.5 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground font-medium">Subtítulo</label>
              <input type="text" value={config.pageSubtitle} onChange={e => updateGlobal('pageSubtitle', e.target.value)} className="w-full text-sm px-4 py-2.5 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
            </div>
            <RangeInput label="Tamanho do título" value={config.headerTitleSize ?? 36} min={16} max={72} onChange={v => updateGlobal('headerTitleSize', v)} />
            <RangeInput label="Tamanho do subtítulo" value={config.headerSubtitleSize ?? 12} min={8} max={36} onChange={v => updateGlobal('headerSubtitleSize', v)} />
          </div>
        ) : (
          <div className="space-y-3 pt-1">
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
      <Section title="Fundo da Roleta" emoji="🖼" description="Imagem de fundo da página">
        <ImageUpload label="Imagem de fundo" value={config.backgroundImageUrl} onChange={v => updateGlobal('backgroundImageUrl', v)} />
        {config.backgroundImageUrl && (
          <ImagePositionControls
            offsetX={config.backgroundImageOffsetX ?? 0} offsetY={config.backgroundImageOffsetY ?? 0} scale={config.backgroundImageScale ?? 1}
            onChangeX={v => updateGlobal('backgroundImageOffsetX', v)} onChangeY={v => updateGlobal('backgroundImageOffsetY', v)} onChangeScale={v => updateGlobal('backgroundImageScale', v)}
          />
        )}
      </Section>

      {/* ===== CORES DA ROLETA ===== */}
      <Section title="Cores da Roleta" emoji="🎨" description="Personalizar as cores do anel, LEDs e centro">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <ColorInput label="Anel externo" value={config.outerRingColor} onChange={v => updateGlobal('outerRingColor', v)} />
          <ColorInput label="LEDs" value={config.ledColor} onChange={v => updateGlobal('ledColor', v)} />
          <ColorInput label="Centro" value={config.centerCapColor} onChange={v => updateGlobal('centerCapColor', v)} />
          <ColorInput label="Divisores" value={config.dividerColor} onChange={v => updateGlobal('dividerColor', v)} />
          <ColorInput label="Brilho" value={config.glowColor} onChange={v => updateGlobal('glowColor', v)} />
          <ColorInput label="Ponteiro" value={config.pointerColor} onChange={v => updateGlobal('pointerColor', v)} />
        </div>
      </Section>

      {/* ===== AJUSTES DA ROLETA ===== */}
      <Section title="Ajustes da Roleta" emoji="🔧" description="Divisores, LEDs, fontes e mais">
        <div className="space-y-3">
          <RangeInput label="Espessura dos divisores" value={config.dividerWidth ?? 3} min={0} max={8} step={0.5} onChange={v => updateGlobal('dividerWidth', v)} />
          <RangeInput label="Tamanho dos LEDs" value={config.ledSize ?? 5} min={2} max={12} step={0.5} onChange={v => updateGlobal('ledSize', v)} />
          <RangeInput label="Escala da fonte" value={config.fontSizeScale ?? 1} min={0.5} max={2} step={0.1} onChange={v => updateGlobal('fontSizeScale', v)} suffix="x" />
          <RangeInput label="Tamanho do valor" value={config.valueFontSize ?? 22} min={8} max={40} onChange={v => updateGlobal('valueFontSize', v)} />
          <RangeInput label="Tamanho do título" value={config.titleFontSize ?? 10} min={6} max={30} onChange={v => updateGlobal('titleFontSize', v)} />
          <ToggleSwitch label="Ocultar texto dos segmentos" checked={!!config.hideSegmentText} onChange={v => updateGlobal('hideSegmentText', v)} />
        </div>
      </Section>

      {/* ===== BOTÃO & RESULTADO ===== */}
      <Section title="Botão & Resultado" emoji="🏆" description="Cores do botão girar e do prêmio">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <ColorInput label="Cor do botão" value={config.buttonColor} onChange={v => updateGlobal('buttonColor', v)} />
          <ColorInput label="Texto do botão" value={config.buttonTextColor} onChange={v => updateGlobal('buttonTextColor', v)} />
          <ColorInput label="Fundo do prêmio" value={config.resultBoxColor} onChange={v => updateGlobal('resultBoxColor', v)} />
          <ColorInput label="Borda do prêmio" value={config.resultBorderColor} onChange={v => updateGlobal('resultBorderColor', v)} />
          <ColorInput label="Texto do prêmio" value={config.resultTextColor} onChange={v => updateGlobal('resultTextColor', v)} />
        </div>
      </Section>

      {/* ===== IMAGEM CENTRAL ===== */}
      <Section title="Imagem Central" emoji="⚡" description="Logo ou ícone no centro da roleta">
        <ImageUpload label="Logo / ícone do centro" value={config.centerImageUrl} onChange={v => updateGlobal('centerImageUrl', v)} />
        {config.centerImageUrl && (
          <ImagePositionControls
            offsetX={config.centerImageOffsetX ?? 0} offsetY={config.centerImageOffsetY ?? 0} scale={config.centerImageScale ?? 1}
            onChangeX={v => updateGlobal('centerImageOffsetX', v)} onChangeY={v => updateGlobal('centerImageOffsetY', v)} onChangeScale={v => updateGlobal('centerImageScale', v)}
          />
        )}
      </Section>

      {/* ===== SEGMENTOS ===== */}
      <Section title="Segmentos" emoji="🍕" description="Adicionar, editar ou remover fatias" defaultOpen>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">{config.segments.length} segmento(s)</span>
          <button
            onClick={() => {
              const newSeg = { id: Date.now().toString(), title: 'NOVO', reward: '0', color: '#1a1a3e', gradientOverlay: 'rgba(255,255,255,0.1)', textColor: '#FFFFFF', percentage: 10 };
              onChange({ ...config, segments: [...config.segments, newSeg] });
            }}
            className="text-xs px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-all shadow-sm"
          >
            + Adicionar
          </button>
        </div>
        <div className="space-y-2">
          {config.segments.map((seg, i) => {
            const [segOpen, setSegOpen] = useState(false);
            return (
              <div key={seg.id} className={`rounded-xl border transition-all duration-200 overflow-hidden ${segOpen ? 'border-primary/30 shadow-md bg-card' : 'border-border bg-muted/20 hover:bg-muted/40'}`}>
                <button
                  onClick={() => setSegOpen(!segOpen)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                >
                  <div className="w-5 h-5 rounded-lg shadow-sm border border-border/50" style={{ background: seg.color }} />
                  <span className="text-sm font-medium text-foreground flex-1">{seg.title || `Segmento ${i + 1}`}</span>
                  <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">{seg.percentage}%</span>
                  <span className={`text-muted-foreground transition-transform duration-200 text-xs ${segOpen ? 'rotate-180' : ''}`}>▼</span>
                </button>
                {segOpen && (
                  <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-sm text-muted-foreground font-medium">Título</label>
                        <input type="text" value={seg.title} onChange={e => updateSegment(i, 'title', e.target.value)} className="w-full text-sm px-3 py-2 rounded-xl border border-border bg-background text-foreground" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm text-muted-foreground font-medium">Valor</label>
                        <input type="text" value={seg.reward} onChange={e => updateSegment(i, 'reward', e.target.value)} className="w-full text-sm px-3 py-2 rounded-xl border border-border bg-background text-foreground" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm text-muted-foreground font-medium">Porcentagem (%)</label>
                      <input type="number" min={0} max={100} value={seg.percentage} onChange={e => updateSegment(i, 'percentage', Math.max(0, parseInt(e.target.value) || 0))} className="w-full text-sm px-3 py-2 rounded-xl border border-border bg-background text-foreground" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                      <ColorInput label="Fundo" value={seg.color} onChange={v => updateSegment(i, 'color', v)} />
                      <ColorInput label="Texto" value={seg.textColor} onChange={v => updateSegment(i, 'textColor', v)} />
                    </div>
                    <ImageUpload label="Imagem do segmento" value={seg.imageUrl} onChange={v => updateSegment(i, 'imageUrl', v)} />
                    {seg.imageUrl && (
                      <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border/50">
                        <RangeInput label="X" value={seg.imageOffsetX ?? 0} min={-100} max={100} onChange={v => updateSegment(i, 'imageOffsetX', v)} />
                        <RangeInput label="Y" value={seg.imageOffsetY ?? 0} min={-100} max={100} onChange={v => updateSegment(i, 'imageOffsetY', v)} />
                        <RangeInput label="Escala" value={seg.imageScale ?? 1} min={0.2} max={3} step={0.1} onChange={v => updateSegment(i, 'imageScale', v)} />
                      </div>
                    )}
                    {config.segments.length > 2 && (
                      <button
                        onClick={() => onChange({ ...config, segments: config.segments.filter((_, idx) => idx !== i) })}
                        className="w-full text-sm py-2.5 rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 transition-all mt-1 font-medium"
                      >
                        🗑 Remover segmento
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {/* ===== MOBILE LAYOUT ===== */}
      <Section title="Layout Mobile" emoji="📱" description="Posição da roleta, giros e botão no celular">
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg">Esses ajustes afetam apenas a visualização em dispositivos móveis.</p>
          <RangeInput label="Roleta X" value={config.mobileWheelOffsetX ?? 0} min={-100} max={100} onChange={v => updateGlobal('mobileWheelOffsetX', v)} />
          <RangeInput label="Roleta Y" value={config.mobileWheelOffsetY ?? 0} min={-100} max={100} onChange={v => updateGlobal('mobileWheelOffsetY', v)} />
          <RangeInput label="Roleta Zoom" value={config.mobileWheelScale ?? 1} min={0.5} max={2} step={0.05} onChange={v => updateGlobal('mobileWheelScale', v)} suffix="x" />
          <RangeInput label="Giros X" value={config.mobileSpinsOffsetX ?? 0} min={-100} max={100} onChange={v => updateGlobal('mobileSpinsOffsetX', v)} />
          <RangeInput label="Giros Y" value={config.mobileSpinsOffsetY ?? 0} min={-100} max={100} onChange={v => updateGlobal('mobileSpinsOffsetY', v)} />
          <RangeInput label="Botão Girar X" value={config.mobileButtonOffsetX ?? 0} min={-100} max={100} onChange={v => updateGlobal('mobileButtonOffsetX', v)} />
          <RangeInput label="Botão Girar Y" value={config.mobileButtonOffsetY ?? 0} min={-100} max={100} onChange={v => updateGlobal('mobileButtonOffsetY', v)} />
        </div>
      </Section>

      {/* ===== PÁGINA (SEO / FAVICON) ===== */}
      <Section title="Página (Título / Favicon)" emoji="🌐" description="SEO, título da aba e favicon">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground font-medium">Nome da página (título da aba)</label>
            <input
              type="text"
              value={config.seoTitle ?? ''}
              placeholder="Roleta de Prêmios"
              onChange={e => updateGlobal('seoTitle', e.target.value)}
              className="w-full text-sm px-4 py-2.5 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground font-medium">Descrição da página</label>
            <textarea
              value={config.seoDescription ?? ''}
              placeholder="Gire a roleta e ganhe prêmios incríveis!"
              onChange={e => updateGlobal('seoDescription', e.target.value)}
              className="w-full text-sm px-4 py-2.5 rounded-xl border border-border bg-background text-foreground resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              rows={2}
            />
          </div>
          <ImageUpload label="Favicon" value={config.faviconUrl} onChange={v => updateGlobal('faviconUrl', v)} folder="favicon" />
          {config.faviconUrl && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
              <img src={config.faviconUrl} alt="favicon" className="w-6 h-6 rounded" />
              <span className="text-xs text-muted-foreground">Preview do favicon</span>
            </div>
          )}
        </div>
      </Section>

      {/* ===== API BACKEND ===== */}
      <Section title="API Backend" emoji="🔗" description="Conexão com Laravel">
        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground font-medium">URL base da API (Laravel)</label>
          <input
            type="text"
            value={apiUrl}
            placeholder="https://seusite.com"
            onChange={e => { setApiUrlState(e.target.value); setApiBaseUrl(e.target.value); }}
            className="w-full text-sm px-4 py-2.5 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
          <p className="text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg mt-2">Rota pública: /roleta?account_id=xxx</p>
        </div>
      </Section>
    </div>
  );
};

export default CustomizationPanel;
