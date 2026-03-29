import React, { useRef } from 'react';
import { WheelConfig } from './types';

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
        {value && (
          <img src={value} alt="" className="w-8 h-8 rounded object-cover border border-border" />
        )}
        <button
          onClick={() => inputRef.current?.click()}
          className="text-xs px-3 py-1.5 rounded border border-border bg-secondary text-foreground hover:bg-accent transition-colors"
        >
          {value ? 'Trocar' : 'Upload'}
        </button>
        {value && (
          <button
            onClick={() => onChange('')}
            className="text-xs px-2 py-1.5 rounded border border-border text-destructive hover:bg-destructive/10 transition-colors"
          >
            ✕
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
    </div>
  );
};

const CustomizationPanel: React.FC<CustomizationPanelProps> = ({ config, onChange }) => {
  const updateGlobal = (key: keyof Omit<WheelConfig, 'segments'>, value: string) => {
    onChange({ ...config, [key]: value });
  };

  const updateSegment = (index: number, key: string, value: string | number) => {
    const segs = [...config.segments];
    segs[index] = { ...segs[index], [key]: value };
    onChange({ ...config, segments: segs });
  };
  const fontSizeScale = config.fontSizeScale ?? 1;

  return (
    <div className="w-80 max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card p-4 space-y-5">
      <h2 className="font-display text-sm font-bold tracking-wider text-primary uppercase">Personalização</h2>

      {/* Page texts */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Textos da Página</h3>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Título</label>
          <input
            type="text"
            value={config.pageTitle}
            onChange={e => updateGlobal('pageTitle', e.target.value)}
            className="w-full text-xs px-2 py-1.5 rounded border border-border bg-input text-foreground"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Subtítulo</label>
          <input
            type="text"
            value={config.pageSubtitle}
            onChange={e => updateGlobal('pageSubtitle', e.target.value)}
            className="w-full text-xs px-2 py-1.5 rounded border border-border bg-input text-foreground"
          />
        </div>
      </div>

      {/* Background image */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Fundo da Página</h3>
        <ImageUpload
          label="Imagem de fundo"
          value={config.backgroundImageUrl}
          onChange={v => updateGlobal('backgroundImageUrl', v)}
        />
      </div>

      {/* Global colors */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Cores Gerais</h3>
        <ColorInput label="Anel externo" value={config.outerRingColor} onChange={v => updateGlobal('outerRingColor', v)} />
        <ColorInput label="LEDs" value={config.ledColor} onChange={v => updateGlobal('ledColor', v)} />
        <ColorInput label="Centro" value={config.centerCapColor} onChange={v => updateGlobal('centerCapColor', v)} />
        <ColorInput label="Divisores" value={config.dividerColor} onChange={v => updateGlobal('dividerColor', v)} />
        <ColorInput label="Brilho" value={config.glowColor} onChange={v => updateGlobal('glowColor', v)} />
        <ColorInput label="Ponteiro" value={config.pointerColor} onChange={v => updateGlobal('pointerColor', v)} />
      </div>

      {/* Font size */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Tamanho da Fonte</h3>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={config.fontSizeScale}
            onChange={e => onChange({ ...config, fontSizeScale: parseFloat(e.target.value) })}
            className="flex-1 accent-primary"
          />
          <span className="text-xs font-mono text-muted-foreground w-10 text-right">{config.fontSizeScale.toFixed(1)}x</span>
        </div>
      </div>

      {/* Button & result box */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Botão & Resultado</h3>
        <ColorInput label="Cor do botão" value={config.buttonColor} onChange={v => updateGlobal('buttonColor', v)} />
        <ColorInput label="Texto do botão" value={config.buttonTextColor} onChange={v => updateGlobal('buttonTextColor', v)} />
        <ColorInput label="Caixa do prêmio" value={config.resultBoxColor} onChange={v => updateGlobal('resultBoxColor', v)} />
        <ColorInput label="Texto do prêmio" value={config.resultTextColor} onChange={v => updateGlobal('resultTextColor', v)} />
      </div>

      {/* Center image */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Imagem Central</h3>
        <ImageUpload
          label="Logo / ícone do centro"
          value={config.centerImageUrl}
          onChange={v => updateGlobal('centerImageUrl', v)}
        />
      </div>

      {/* Segments */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Segmentos</h3>
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
                <input
                  type="text"
                  value={seg.title}
                  onChange={e => updateSegment(i, 'title', e.target.value)}
                  className="w-full text-xs px-2 py-1.5 rounded border border-border bg-input text-foreground"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Valor</label>
                <input
                  type="text"
                  value={seg.reward}
                  onChange={e => updateSegment(i, 'reward', e.target.value)}
                  className="w-full text-xs px-2 py-1.5 rounded border border-border bg-input text-foreground"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Porcentagem (%)</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={seg.percentage}
                  onChange={e => updateSegment(i, 'percentage', Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full text-xs px-2 py-1.5 rounded border border-border bg-input text-foreground"
                />
              </div>
              <ColorInput label="Fundo" value={seg.color} onChange={v => updateSegment(i, 'color', v)} />
              <ColorInput label="Texto" value={seg.textColor} onChange={v => updateSegment(i, 'textColor', v)} />
              <ImageUpload
                label="Imagem do segmento (cobre o fundo)"
                value={seg.imageUrl}
                onChange={v => updateSegment(i, 'imageUrl', v)}
              />
            </div>
          </details>
        ))}
      </div>
    </div>
  );
};

export default CustomizationPanel;
