import React from 'react';
import { WheelConfig } from './types';

interface CustomizationPanelProps {
  config: WheelConfig;
  onChange: (config: WheelConfig) => void;
}

const ColorInput: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-xs text-muted-foreground">{label}</span>
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-7 h-7 rounded cursor-pointer border border-border bg-transparent"
      />
      <span className="text-xs font-mono text-muted-foreground w-16">{value}</span>
    </div>
  </div>
);

const CustomizationPanel: React.FC<CustomizationPanelProps> = ({ config, onChange }) => {
  const updateGlobal = (key: keyof Omit<WheelConfig, 'segments'>, value: string) => {
    onChange({ ...config, [key]: value });
  };

  const updateSegment = (index: number, key: string, value: string) => {
    const segs = [...config.segments];
    segs[index] = { ...segs[index], [key]: value };
    onChange({ ...config, segments: segs });
  };

  return (
    <div className="w-80 max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card p-4 space-y-5 scrollbar-thin">
      <h2 className="font-display text-sm font-bold tracking-wider text-primary uppercase">Personalização</h2>

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

      {/* Segments */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Segmentos</h3>
        {config.segments.map((seg, i) => (
          <details key={seg.id} className="group border border-border rounded-lg overflow-hidden">
            <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer bg-secondary/50 hover:bg-secondary text-xs font-bold">
              <div className="w-3 h-3 rounded-full" style={{ background: seg.color }} />
              {seg.title || `Segmento ${i + 1}`}
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
              <ColorInput label="Fundo" value={seg.color} onChange={v => updateSegment(i, 'color', v)} />
              <ColorInput label="Texto" value={seg.textColor} onChange={v => updateSegment(i, 'textColor', v)} />
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">URL da imagem (opcional)</label>
                <input
                  type="text"
                  value={seg.imageUrl || ''}
                  onChange={e => updateSegment(i, 'imageUrl', e.target.value)}
                  placeholder="https://..."
                  className="w-full text-xs px-2 py-1.5 rounded border border-border bg-input text-foreground"
                />
              </div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
};

export default CustomizationPanel;
