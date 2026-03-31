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

      {/* Header mode toggle */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Cabeçalho</h3>
        <div className="flex gap-2">
          <button
            onClick={() => onChange({ ...config, headerMode: 'text' })}
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
            onClick={() => onChange({ ...config, headerMode: 'image' })}
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
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-16">Título</span>
              <input
                type="range"
                min={16}
                max={72}
                step={1}
                value={config.headerTitleSize ?? 36}
                onChange={e => onChange({ ...config, headerTitleSize: parseInt(e.target.value) })}
                className="flex-1 accent-primary"
              />
              <span className="text-xs font-mono text-muted-foreground w-8 text-right">{config.headerTitleSize ?? 36}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-16">Subtítulo</span>
              <input
                type="range"
                min={8}
                max={36}
                step={1}
                value={config.headerSubtitleSize ?? 12}
                onChange={e => onChange({ ...config, headerSubtitleSize: parseInt(e.target.value) })}
                className="flex-1 accent-primary"
              />
              <span className="text-xs font-mono text-muted-foreground w-8 text-right">{config.headerSubtitleSize ?? 12}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <ImageUpload
              label="Imagem do cabeçalho"
              value={config.headerImageUrl}
              onChange={v => updateGlobal('headerImageUrl', v)}
            />
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-16">Tamanho</span>
              <input
                type="range"
                min={40}
                max={300}
                step={5}
                value={config.headerImageSize ?? 120}
                onChange={e => onChange({ ...config, headerImageSize: parseInt(e.target.value) })}
                className="flex-1 accent-primary"
              />
              <span className="text-xs font-mono text-muted-foreground w-8 text-right">{config.headerImageSize ?? 120}</span>
            </div>
          </div>
        )}
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

      {/* Divider width */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Espessura dos Divisores</h3>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={8}
            step={0.5}
            value={config.dividerWidth ?? 3}
            onChange={e => onChange({ ...config, dividerWidth: parseFloat(e.target.value) })}
            className="flex-1 accent-primary"
          />
          <span className="text-xs font-mono text-muted-foreground w-10 text-right">{(config.dividerWidth ?? 3).toFixed(1)}</span>
        </div>
      </div>

      {/* LED size */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Tamanho dos LEDs</h3>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={2}
            max={12}
            step={0.5}
            value={config.ledSize ?? 5}
            onChange={e => onChange({ ...config, ledSize: parseFloat(e.target.value) })}
            className="flex-1 accent-primary"
          />
          <span className="text-xs font-mono text-muted-foreground w-10 text-right">{(config.ledSize ?? 5).toFixed(1)}</span>
        </div>
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
            value={fontSizeScale}
            onChange={e => onChange({ ...config, fontSizeScale: parseFloat(e.target.value) })}
            className="flex-1 accent-primary"
          />
          <span className="text-xs font-mono text-muted-foreground w-10 text-right">{fontSizeScale.toFixed(1)}x</span>
        </div>
      </div>

      {/* Title & Value font sizes */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Tamanho Título / Valor</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-12">Valor</span>
          <input
            type="range"
            min={8}
            max={40}
            step={1}
            value={config.valueFontSize ?? 22}
            onChange={e => onChange({ ...config, valueFontSize: parseInt(e.target.value) })}
            className="flex-1 accent-primary"
          />
          <span className="text-xs font-mono text-muted-foreground w-8 text-right">{config.valueFontSize ?? 22}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-12">Título</span>
          <input
            type="range"
            min={6}
            max={30}
            step={1}
            value={config.titleFontSize ?? 10}
            onChange={e => onChange({ ...config, titleFontSize: parseInt(e.target.value) })}
            className="flex-1 accent-primary"
          />
          <span className="text-xs font-mono text-muted-foreground w-8 text-right">{config.titleFontSize ?? 10}</span>
        </div>
      </div>

      {/* Hide text toggle */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Ocultar texto na roleta</span>
        <button
          onClick={() => onChange({ ...config, hideSegmentText: !config.hideSegmentText })}
          className="w-10 h-5 rounded-full relative transition-colors"
          style={{ background: config.hideSegmentText ? 'hsl(var(--primary))' : 'hsl(var(--muted))' }}
        >
          <div
            className="w-4 h-4 rounded-full bg-foreground absolute top-0.5 transition-all"
            style={{ left: config.hideSegmentText ? '22px' : '2px' }}
          />
        </button>
      </div>

      {/* Button & result box */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Botão & Resultado</h3>
        <ColorInput label="Cor do botão" value={config.buttonColor} onChange={v => updateGlobal('buttonColor', v)} />
        <ColorInput label="Texto do botão" value={config.buttonTextColor} onChange={v => updateGlobal('buttonTextColor', v)} />
        <ColorInput label="Fundo do prêmio" value={config.resultBoxColor} onChange={v => updateGlobal('resultBoxColor', v)} />
        <ColorInput label="Borda do prêmio" value={config.resultBorderColor} onChange={v => updateGlobal('resultBorderColor', v)} />
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
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Segmentos</h3>
          <button
            onClick={() => {
              const newSeg = {
                id: Date.now().toString(),
                title: `NOVO`,
                reward: '0',
                color: '#1a1a3e',
                gradientOverlay: 'rgba(255,255,255,0.1)',
                textColor: '#FFFFFF',
                percentage: 10,
              };
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
                  min={0}
                  max={100}
                  value={seg.percentage}
                  onChange={e => updateSegment(i, 'percentage', Math.max(0, parseInt(e.target.value) || 0))}
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
              {config.segments.length > 2 && (
                <button
                  onClick={() => {
                    const segs = config.segments.filter((_, idx) => idx !== i);
                    onChange({ ...config, segments: segs });
                  }}
                  className="w-full text-xs py-1.5 rounded border border-destructive text-destructive hover:bg-destructive/10 transition-colors mt-2"
                >
                  Remover segmento
                </button>
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
};

export default CustomizationPanel;
