import React, { useRef, useState } from 'react';
import { WheelConfig } from './types';
import { getApiBaseUrl, setApiBaseUrl } from '@/services/api';

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

const ImageUpload: React.FC<{ label: string; value?: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  };
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="flex gap-2 items-center">
        {value && <img src={value} alt="" className="w-8 h-8 rounded object-cover border border-border" />}
        <button onClick={() => inputRef.current?.click()} className="text-xs px-3 py-1.5 rounded border border-border bg-secondary text-foreground hover:bg-accent transition-colors">
          {value ? 'Trocar' : 'Upload'}
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

      {/* ===== PÁGINA DE AUTENTICAÇÃO ===== */}
      <Section title="Página de Autenticação" emoji="🔐" defaultOpen>
        {/* Header mode */}
        <div className="space-y-2">
          <span className="text-xs text-muted-foreground">Tipo de cabeçalho</span>
          <div className="flex gap-1.5">
            {(['text', 'logo', 'logo_text'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => updateGlobal('authHeaderMode', mode)}
                className="flex-1 text-[10px] py-1.5 rounded border transition-colors"
                style={{
                  borderColor: config.authHeaderMode === mode ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                  background: config.authHeaderMode === mode ? 'hsl(var(--primary) / 0.15)' : 'transparent',
                  color: 'hsl(var(--foreground))',
                }}
              >
                {mode === 'text' ? 'Texto' : mode === 'logo' ? 'Logo' : 'Logo+Texto'}
              </button>
            ))}
          </div>
        </div>

        {/* Logo upload */}
        {(config.authHeaderMode === 'logo' || config.authHeaderMode === 'logo_text') && (
          <>
            <ImageUpload label="Logo" value={config.authLogoUrl} onChange={v => updateGlobal('authLogoUrl', v)} />
            <RangeInput label="Tam. logo" value={config.authLogoSize ?? 80} min={30} max={200} step={5} onChange={v => updateGlobal('authLogoSize', v)} />
          </>
        )}

        {/* Text fields */}
        {(config.authHeaderMode === 'text' || config.authHeaderMode === 'logo_text') && (
          <>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Título</label>
              <input type="text" value={config.authTitle ?? ''} onChange={e => updateGlobal('authTitle', e.target.value)} className="w-full text-xs px-2 py-1.5 rounded border border-border bg-input text-foreground" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Subtítulo</label>
              <input type="text" value={config.authSubtitle ?? ''} onChange={e => updateGlobal('authSubtitle', e.target.value)} className="w-full text-xs px-2 py-1.5 rounded border border-border bg-input text-foreground" />
            </div>
            <RangeInput label="Tam. título" value={config.authTitleSize ?? 18} min={12} max={36} onChange={v => updateGlobal('authTitleSize', v)} />
            <RangeInput label="Tam. subtít." value={config.authSubtitleSize ?? 12} min={8} max={24} onChange={v => updateGlobal('authSubtitleSize', v)} />
          </>
        )}

        {/* Colors */}
        <div className="pt-2 border-t border-border space-y-2">
          <span className="text-xs font-bold text-foreground uppercase tracking-wide">Cores</span>
          <ColorInput label="Fundo da página" value={config.authBgColor ?? '#1a0a2e'} onChange={v => updateGlobal('authBgColor', v)} />
          <ColorInput label="Fundo do card" value={config.authCardBgColor ?? '#140c28'} onChange={v => updateGlobal('authCardBgColor', v)} />
          <ColorInput label="Borda do card" value={config.authCardBorderColor ?? '#ffffff14'} onChange={v => updateGlobal('authCardBorderColor', v)} />
          <ColorInput label="Borda dos inputs" value={config.authInputBorderColor ?? '#D4A017'} onChange={v => updateGlobal('authInputBorderColor', v)} />
          <ColorInput label="Cor do botão" value={config.authButtonBgColor ?? '#0ABACC'} onChange={v => updateGlobal('authButtonBgColor', v)} />
          <ColorInput label="Texto do botão" value={config.authButtonTextColor ?? '#000000'} onChange={v => updateGlobal('authButtonTextColor', v)} />
          <ColorInput label="Labels" value={config.authLabelColor ?? '#ffffff'} onChange={v => updateGlobal('authLabelColor', v)} />
          <ColorInput label="Texto desc." value={config.authTextColor ?? '#ffffff80'} onChange={v => updateGlobal('authTextColor', v)} />
        </div>

        {/* Background image */}
        <div className="pt-2 border-t border-border">
          <ImageUpload label="Background da autenticação" value={config.authBgImageUrl} onChange={v => updateGlobal('authBgImageUrl', v)} />
        </div>
      </Section>

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
          </div>
        )}
      </Section>

      {/* ===== FUNDO DA PÁGINA ===== */}
      <Section title="Fundo da Roleta" emoji="🖼">
        <ImageUpload label="Imagem de fundo" value={config.backgroundImageUrl} onChange={v => updateGlobal('backgroundImageUrl', v)} />
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
