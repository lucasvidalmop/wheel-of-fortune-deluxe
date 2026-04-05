import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { WheelConfig } from './types';

import { toast } from 'sonner';
import { Settings, X, ChevronDown, Upload, Trash2, Plus } from 'lucide-react';
import { uploadAppAsset } from '@/lib/uploadAppAsset';
import { playSpinSound } from '@/lib/spinSound';

interface CustomizationPanelProps {
  config: WheelConfig;
  onChange: (config: WheelConfig) => void;
}

type ColorInputProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
};

const ColorInput = React.forwardRef<HTMLDivElement, ColorInputProps>(({ label, value, onChange }, ref) => (
  <div ref={ref} className="flex items-center justify-between gap-2 py-1.5">
    <span className="text-sm text-muted-foreground">{label}</span>
    <div className="flex items-center gap-2">
      <div className="relative">
        <input type="color" value={value} onChange={e => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        <div className="h-7 w-7 cursor-pointer rounded-lg border border-border shadow-sm transition-transform hover:scale-110" style={{ background: value }} />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground">{value}</span>
    </div>
  </div>
));
ColorInput.displayName = 'ColorInput';

type ImageUploadProps = {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  folder?: string;
  compact?: boolean;
};

const ImageUpload = React.forwardRef<HTMLDivElement, ImageUploadProps>(({ label, value, onChange, folder = 'wheel', compact }, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { publicUrl } = await uploadAppAsset(file, folder);
      onChange(publicUrl);
      toast.success('Imagem enviada!');
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'Tente novamente'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  if (compact) {
    return (
      <div ref={ref} className="flex items-center gap-3">
        {value && <img src={value} alt="" className="h-10 w-10 rounded-lg border border-border object-cover" />}
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="rounded-lg bg-muted/80 px-3 py-1.5 text-xs text-foreground transition-all hover:bg-muted disabled:opacity-50">
          {uploading ? '⏳' : value ? '🔄' : '📤'} {label}
        </button>
        {value && <button type="button" onClick={() => onChange('')} className="text-xs text-destructive hover:text-destructive/80"><Trash2 size={14} /></button>}
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      </div>
    );
  }

  return (
    <div ref={ref} className="space-y-2">
      <label className="text-sm text-muted-foreground">{label}</label>
      <div className="flex items-center gap-3">
        {value && <img src={value} alt="" className="h-12 w-12 rounded-xl border-2 border-border object-cover shadow-sm" />}
        <div className="flex gap-2">
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="rounded-lg border border-border bg-muted/50 px-4 py-2 text-xs font-medium text-foreground transition-all hover:bg-muted disabled:opacity-50">
            {uploading ? '⏳ Enviando...' : value ? '🔄 Trocar' : '📤 Upload'}
          </button>
          {value && <button type="button" onClick={() => onChange('')} className="rounded-lg border border-destructive/30 px-3 py-2 text-xs text-destructive transition-all hover:bg-destructive/10"><Trash2 size={14} /></button>}
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
    </div>
  );
});
ImageUpload.displayName = 'ImageUpload';

// Audio upload component
type AudioUploadProps = { label: string; value?: string; onChange: (v: string) => void };
const AudioUpload: React.FC<AudioUploadProps> = ({ label, value, onChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { publicUrl } = await uploadAppAsset(file, 'audio');
      onChange(publicUrl);
      toast.success('Áudio enviado!');
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'Tente novamente'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2">
        {value && (
          <div className="flex items-center gap-1 rounded-lg bg-muted/60 px-2 py-1 text-[10px] text-foreground">
            🎵 Áudio carregado
          </div>
        )}
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
          className="rounded-lg bg-muted/80 px-3 py-1.5 text-xs text-foreground transition-all hover:bg-muted disabled:opacity-50">
          {uploading ? '⏳ Enviando...' : value ? '🔄 Trocar' : '📤 Enviar MP3'}
        </button>
        {value && (
          <button type="button" onClick={() => onChange('')} className="text-xs text-destructive hover:text-destructive/80">
            <Trash2 size={14} />
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="audio/*" onChange={handleFile} className="hidden" />
    </div>
  );
};

type RangeInputProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  suffix?: string;
};

const RangeInput: React.FC<RangeInputProps> = ({ label, value, min, max, step = 1, onChange, suffix = '' }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="rounded bg-muted/50 px-1.5 py-0.5 text-[10px] font-mono text-foreground">{step < 1 ? value.toFixed(1) : value}{suffix}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} className="h-1 w-full rounded-full accent-primary" />
  </div>
);

type ImagePositionControlsProps = {
  offsetX: number;
  offsetY: number;
  scale: number;
  onChangeX: (v: number) => void;
  onChangeY: (v: number) => void;
  onChangeScale: (v: number) => void;
};

const ImagePositionControls = React.forwardRef<HTMLDivElement, ImagePositionControlsProps>(({ offsetX, offsetY, scale, onChangeX, onChangeY, onChangeScale }, ref) => (
  <div ref={ref} className="space-y-1 rounded-lg border border-border/30 bg-muted/20 p-2">
    <RangeInput label="Posição X" value={offsetX} min={-200} max={200} onChange={onChangeX} />
    <RangeInput label="Posição Y" value={offsetY} min={-200} max={200} onChange={onChangeY} />
    <RangeInput label="Zoom" value={scale} min={0.1} max={5} step={0.1} onChange={onChangeScale} />
  </div>
));
ImagePositionControls.displayName = 'ImagePositionControls';

const ToggleSwitch: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, checked, onChange }) => (
  <div className="flex items-center justify-between py-1">
    <span className="text-sm text-muted-foreground">{label}</span>
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-10 rounded-full transition-all duration-300 ${checked ? 'bg-primary' : 'bg-muted'}`}
    >
      <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-300 ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  </div>
);

/* ── Collapsible Card ── */
const Card: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, icon, children, defaultOpen = false }) => (
  <details open={defaultOpen} className="group overflow-hidden rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm transition-all">
    <summary className="flex cursor-pointer list-none select-none items-center gap-2.5 px-4 py-3 transition-colors hover:bg-muted/30 [&::-webkit-details-marker]:hidden">
      {icon}
      <span className="flex-1 text-sm font-semibold text-foreground">{title}</span>
      <ChevronDown size={14} className="text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
    </summary>
    <div className="space-y-3 border-t border-border/30 px-4 pb-4 pt-2">
      {children}
    </div>
  </details>
);

const TabButton: React.FC<{ active: boolean; label: string; onClick: () => void }> = ({ active, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex-1 rounded-lg py-2 text-xs font-medium transition-all ${
      active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted/60'
    }`}
  >
    {label}
  </button>
);

/* ── Color Settings Drawer ── */
const ColorSettingsDrawer: React.FC<{ open: boolean; onClose: () => void; config: WheelConfig; updateGlobal: (key: keyof Omit<WheelConfig, 'segments'>, value: any) => void }> = ({ open, onClose, config, updateGlobal }) => {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative h-full w-full max-w-sm animate-in overflow-y-auto border-l border-border bg-card shadow-2xl slide-in-from-right duration-300" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 px-5 py-4 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-primary" />
            <h2 className="text-base font-bold text-foreground">Cores & Ajustes</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground transition-all hover:bg-muted/60 hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-6 p-5">
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Roleta</h3>
            <ColorInput label="Anel externo" value={config.outerRingColor} onChange={v => updateGlobal('outerRingColor', v)} />
            <ColorInput label="LEDs" value={config.ledColor} onChange={v => updateGlobal('ledColor', v)} />
            <ColorInput label="Centro" value={config.centerCapColor} onChange={v => updateGlobal('centerCapColor', v)} />
            <ColorInput label="Divisores" value={config.dividerColor} onChange={v => updateGlobal('dividerColor', v)} />
            <ColorInput label="Brilho" value={config.glowColor} onChange={v => updateGlobal('glowColor', v)} />
            <ColorInput label="Ponteiro" value={config.pointerColor} onChange={v => updateGlobal('pointerColor', v)} />
          </div>

          <div className="border-t border-border/30" />

          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Botão & Resultado</h3>
            <ColorInput label="Cor do botão" value={config.buttonColor} onChange={v => updateGlobal('buttonColor', v)} />
            <ColorInput label="Texto do botão" value={config.buttonTextColor} onChange={v => updateGlobal('buttonTextColor', v)} />
            <ColorInput label="Fundo do prêmio" value={config.resultBoxColor} onChange={v => updateGlobal('resultBoxColor', v)} />
            <ColorInput label="Borda do prêmio" value={config.resultBorderColor} onChange={v => updateGlobal('resultBorderColor', v)} />
            <ColorInput label="Texto do prêmio" value={config.resultTextColor} onChange={v => updateGlobal('resultTextColor', v)} />
          </div>

          <div className="border-t border-border/30" />

          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ajustes</h3>
            <RangeInput label="Espessura dos divisores" value={config.dividerWidth ?? 3} min={0} max={8} step={0.5} onChange={v => updateGlobal('dividerWidth', v)} />
            <RangeInput label="Tamanho dos LEDs" value={config.ledSize ?? 5} min={2} max={12} step={0.5} onChange={v => updateGlobal('ledSize', v)} />
            <RangeInput label="Escala da fonte" value={config.fontSizeScale ?? 1} min={0.5} max={2} step={0.1} onChange={v => updateGlobal('fontSizeScale', v)} suffix="x" />
            <RangeInput label="Tamanho do valor" value={config.valueFontSize ?? 22} min={8} max={40} onChange={v => updateGlobal('valueFontSize', v)} />
            <RangeInput label="Tamanho do título" value={config.titleFontSize ?? 10} min={6} max={30} onChange={v => updateGlobal('titleFontSize', v)} />
            <ToggleSwitch label="Ocultar texto dos segmentos" checked={!!config.hideSegmentText} onChange={v => updateGlobal('hideSegmentText', v)} />
            <ToggleSwitch label="Ocultar título dos segmentos" checked={!!config.hideSegmentTitle} onChange={v => updateGlobal('hideSegmentTitle', v)} />
            <ToggleSwitch label="Ocultar valor dos segmentos" checked={!!config.hideSegmentValue} onChange={v => updateGlobal('hideSegmentValue', v)} />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

/* ── Segment Preview (mini wheel) ── */
const SegmentPreview: React.FC<{ config: WheelConfig; floating?: boolean }> = ({ config, floating }) => {
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [collapsed, setCollapsed] = useState(false);
  const segments = config.segments;
  const numSegs = Math.max(segments.length, 1);
  const segAngle = 360 / numSegs;
  const wheelSize = previewMode === 'mobile' ? 124 : 168;
  const frameWidth = previewMode === 'mobile' ? 190 : 360;
  const frameHeight = previewMode === 'mobile' ? 320 : 236;
  const cx = wheelSize / 2;
  const cy = wheelSize / 2;
  const r = wheelSize / 2 - 8;
  const outerR = r - 6;
  const innerPreviewR = Math.max(14, wheelSize * 0.14);

  const polarToCart = (angleDeg: number, radius: number) => ({
    x: cx + radius * Math.cos((angleDeg - 90) * Math.PI / 180),
    y: cy + radius * Math.sin((angleDeg - 90) * Math.PI / 180),
  });

  const getSegmentPath = (index: number, outerRadius: number, innerRadius: number) => {
    const startAngle = (index * segAngle - 90) * (Math.PI / 180);
    const endAngle = ((index + 1) * segAngle - 90) * (Math.PI / 180);
    const x1 = cx + outerRadius * Math.cos(startAngle);
    const y1 = cy + outerRadius * Math.sin(startAngle);
    const x2 = cx + outerRadius * Math.cos(endAngle);
    const y2 = cy + outerRadius * Math.sin(endAngle);
    const ix1 = cx + innerRadius * Math.cos(startAngle);
    const iy1 = cy + innerRadius * Math.sin(startAngle);
    const ix2 = cx + innerRadius * Math.cos(endAngle);
    const iy2 = cy + innerRadius * Math.sin(endAngle);
    const largeArc = segAngle > 180 ? 1 : 0;
    return `M ${ix1} ${iy1} L ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1} Z`;
  };

  const getSegmentBounds = (index: number) => {
    const startAngle = (index * segAngle - 90) * (Math.PI / 180);
    const endAngle = ((index + 1) * segAngle - 90) * (Math.PI / 180);
    const points = [
      { x: cx + innerPreviewR * Math.cos(startAngle), y: cy + innerPreviewR * Math.sin(startAngle) },
      { x: cx + innerPreviewR * Math.cos(endAngle), y: cy + innerPreviewR * Math.sin(endAngle) },
      { x: cx + outerR * Math.cos(startAngle), y: cy + outerR * Math.sin(startAngle) },
      { x: cx + outerR * Math.cos(endAngle), y: cy + outerR * Math.sin(endAngle) },
    ];

    const steps = 10;
    for (let s = 0; s <= steps; s++) {
      const a = startAngle + (endAngle - startAngle) * (s / steps);
      points.push({ x: cx + outerR * Math.cos(a), y: cy + outerR * Math.sin(a) });
    }

    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return {
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
    };
  };

  const wrapperClass = floating
    ? 'fixed bottom-4 right-4 z-50 w-[320px] rounded-xl border border-border/60 bg-background/95 backdrop-blur-md p-3 shadow-2xl space-y-2 transition-all'
    : 'space-y-2 rounded-xl border border-border/40 bg-muted/20 p-3';

  if (floating && collapsed) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/95 backdrop-blur-md px-4 py-2 shadow-2xl text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          🎡 Pré-visualização
        </button>
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pré-visualização dos segmentos</span>
        <div className="flex items-center gap-1">
          <div className="flex gap-1 rounded-lg bg-muted/40 p-0.5">
            <button type="button" onClick={() => setPreviewMode('desktop')} className={`rounded-md px-2 py-1 text-[10px] font-medium transition-all ${previewMode === 'desktop' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted/60'}`}>🖥️ Desktop</button>
            <button type="button" onClick={() => setPreviewMode('mobile')} className={`rounded-md px-2 py-1 text-[10px] font-medium transition-all ${previewMode === 'mobile' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted/60'}`}>📱 Mobile</button>
          </div>
          {floating && (
            <button type="button" onClick={() => setCollapsed(true)} className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors" title="Minimizar">✕</button>
          )}
        </div>
      </div>

      <div className="flex justify-center">
        <div className="relative overflow-hidden rounded-[24px] border border-border/40 bg-background shadow-[0_20px_60px_rgba(0,0,0,0.35)]" style={{ width: frameWidth, height: frameHeight }}>
          {config.backgroundImageUrl ? (
            <img
              key={config.backgroundImageUrl}
              src={config.backgroundImageUrl}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
              style={{
                opacity: 0.82,
                transform: `translate(${config.backgroundImageOffsetX ?? 0}px, ${config.backgroundImageOffsetY ?? 0}px) scale(${config.backgroundImageScale ?? 1})`,
                transformOrigin: 'center',
              }}
            />
          ) : (
            <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, rgba(30,10,60,0.9), rgba(10,5,25,0.98))' }} />
          )}

          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/60" />
          <div
            className="absolute left-1/2 top-1/2 h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-[70px]"
            style={{ background: `radial-gradient(circle, ${config.glowColor}, transparent)` }}
          />

          <div className="relative z-10 flex h-full flex-col items-center justify-between px-3 py-4 text-center">
            <div className="space-y-1">
              {config.headerMode === 'image' && config.headerImageUrl ? (
                <img
                  src={config.headerImageUrl}
                  alt=""
                  className="mx-auto object-contain"
                  style={{
                    height: previewMode === 'mobile' ? Math.min(config.headerImageSize ?? 120, 48) : Math.min(config.headerImageSize ?? 120, 64),
                    maxWidth: previewMode === 'mobile' ? 140 : 220,
                    transform: previewMode === 'mobile'
                      ? `translate(${config.mobileLogoOffsetX ?? config.headerImageOffsetX ?? 0}px, ${config.mobileLogoOffsetY ?? config.headerImageOffsetY ?? 0}px) scale(${config.mobileLogoScale ?? config.headerImageScale ?? 1})`
                      : `translate(${config.headerImageOffsetX ?? 0}px, ${config.headerImageOffsetY ?? 0}px) scale(${config.headerImageScale ?? 1})`,
                  }}
                />
              ) : (
                <>
                  <h3
                    className="font-black uppercase tracking-[0.18em]"
                    style={{
                      fontSize: previewMode === 'mobile' ? Math.min(config.headerTitleSize ?? 36, 20) : Math.min(config.headerTitleSize ?? 36, 24),
                      color: config.glowColor,
                      textShadow: `0 0 30px ${config.glowColor}55`,
                    }}
                  >
                    {config.pageTitle}
                  </h3>
                  <p className="uppercase tracking-[0.3em] text-muted-foreground" style={{ fontSize: previewMode === 'mobile' ? 7 : 8 }}>
                    {config.pageSubtitle}
                  </p>
                </>
              )}
            </div>

            <div
              className="relative flex items-center justify-center"
              style={previewMode === 'mobile' ? { transform: `translate(${config.mobileWheelOffsetX ?? 0}px, ${config.mobileWheelOffsetY ?? 0}px) scale(${config.mobileWheelScale ?? 1})` } : undefined}
            >
              <svg width={wheelSize} height={wheelSize} viewBox={`0 0 ${wheelSize} ${wheelSize}`}>
                <defs>
                  {segments.map((seg, i) => (
                    <clipPath key={`seg-preview-clip-${seg.id}`} id={`seg-preview-clip-${previewMode}-${i}`}>
                      <path d={getSegmentPath(i, outerR, innerPreviewR)} />
                    </clipPath>
                  ))}
                </defs>

                <circle cx={cx} cy={cy} r={outerR + 4} fill="none" stroke={config.outerRingColor} strokeWidth={3} />
                <circle cx={cx} cy={cy} r={outerR} fill="#111" opacity={0.45} />

                {segments.map((seg, i) => (
                  <g key={`seg-fill-${seg.id}`}>
                    <path d={getSegmentPath(i, outerR, innerPreviewR)} fill={seg.color} />
                    <path d={getSegmentPath(i, outerR, innerPreviewR)} fill={seg.gradientOverlay} />
                  </g>
                ))}

                {segments.map((seg, i) => {
                  if (!seg.imageUrl) return null;
                  const bounds = getSegmentBounds(i);
                  const scale = seg.imageScale ?? 1;
                  const scaledW = bounds.width * scale;
                  const scaledH = bounds.height * scale;
                  const ox = (seg.imageOffsetX ?? 0) - (scaledW - bounds.width) / 2;
                  const oy = (seg.imageOffsetY ?? 0) - (scaledH - bounds.height) / 2;

                  const rot = seg.imageRotation ?? 0;
                  const imgCx = bounds.x + ox + scaledW / 2;
                  const imgCy = bounds.y + oy + scaledH / 2;

                  return (
                    <g key={`seg-image-${seg.id}`} clipPath={`url(#seg-preview-clip-${previewMode}-${i})`}>
                      <image
                        href={seg.imageUrl}
                        x={bounds.x + ox}
                        y={bounds.y + oy}
                        width={scaledW}
                        height={scaledH}
                        preserveAspectRatio="xMidYMid slice"
                        opacity="0.92"
                        transform={rot ? `rotate(${rot}, ${imgCx}, ${imgCy})` : undefined}
                      />
                    </g>
                  );
                })}

                {segments.map((seg, i) => {
                  const angle = (i * segAngle - 90) * (Math.PI / 180);
                  const x1 = cx + innerPreviewR * Math.cos(angle);
                  const y1 = cy + innerPreviewR * Math.sin(angle);
                  const x2 = cx + outerR * Math.cos(angle);
                  const y2 = cy + outerR * Math.sin(angle);

                  return (
                    <line
                      key={`seg-divider-${seg.id}`}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={config.dividerColor}
                      strokeWidth={config.dividerWidth ?? 2}
                      opacity="0.7"
                    />
                  );
                })}

                {!config.hideSegmentText && segments.map((seg, i) => {
                  const midAngle = i * segAngle + segAngle / 2;
                  const textPos = polarToCart(midAngle, outerR * 0.66);
                  const valueFontSize = previewMode === 'mobile' ? 7 : 9;
                  const titleFontSize = valueFontSize * 0.7;
                  const showValue = !config.hideSegmentValue && !seg.hideValue;
                  const showTitle = !config.hideSegmentTitle && !seg.hideTitle;

                  if (!showValue && !showTitle) return null;

                  return (
                    <g key={`seg-text-${seg.id}`} transform={`rotate(${midAngle}, ${textPos.x}, ${textPos.y})`}>
                      {showValue && (
                        <text
                          x={textPos.x}
                          y={showTitle ? textPos.y - valueFontSize * 0.45 : textPos.y}
                          fill={seg.textColor}
                          fontSize={valueFontSize}
                          fontWeight="bold"
                          textAnchor="middle"
                          dominantBaseline="central"
                        >
                          {seg.reward.slice(0, previewMode === 'mobile' ? 6 : 8)}
                        </text>
                      )}
                      {showTitle && (
                        <text
                          x={textPos.x}
                          y={showValue ? textPos.y + valueFontSize * 0.7 : textPos.y}
                          fill={seg.textColor}
                          fontSize={titleFontSize}
                          fontWeight="bold"
                          textAnchor="middle"
                          dominantBaseline="central"
                        >
                          {seg.title.slice(0, previewMode === 'mobile' ? 6 : 8)}
                        </text>
                      )}
                    </g>
                  );
                })}

                <circle cx={cx} cy={cy} r={innerPreviewR} fill={config.centerCapColor} stroke={config.dividerColor} strokeWidth={1} />
                <polygon points={`${cx},${cy - outerR - 8} ${cx - 6},${cy - outerR + 4} ${cx + 6},${cy - outerR + 4}`} fill={config.pointerColor} stroke={config.dividerColor} strokeWidth={0.5} />
              </svg>
            </div>

            <div
              className="rounded-full px-4 py-2 font-bold uppercase tracking-[0.18em]"
              style={{
                background: config.buttonColor,
                color: config.buttonTextColor,
                fontSize: previewMode === 'mobile' ? 10 : 11,
                transform: previewMode === 'mobile' ? `translate(${config.mobileButtonOffsetX ?? 0}px, ${config.mobileButtonOffsetY ?? 0}px)` : undefined,
              }}
            >
              Girar
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════
   MAIN PANEL
   ══════════════════════════════════════════════ */

const CustomizationPanel: React.FC<CustomizationPanelProps> = ({ config, onChange }) => {
  const [colorDrawerOpen, setColorDrawerOpen] = useState(false);
  const [openSegments, setOpenSegments] = useState<Record<string, boolean>>({});

  const updateGlobal = (key: keyof Omit<WheelConfig, 'segments'>, value: any) => {
    onChange({ ...config, [key]: value });
  };

  const updateSegment = (index: number, key: string, value: string | number | boolean) => {
    const segs = [...config.segments];
    segs[index] = { ...segs[index], [key]: value };
    onChange({ ...config, segments: segs });
  };

  return (
    <div className="w-full space-y-3 relative">
      {/* ── Top bar with gear ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">🎡 Configuração da Roleta</h2>
        <button
          onClick={() => setColorDrawerOpen(true)}
          className="p-2.5 rounded-xl bg-muted/60 hover:bg-primary/10 border border-border hover:border-primary/40 text-muted-foreground hover:text-primary transition-all duration-200 group"
          title="Cores & Ajustes"
        >
          <Settings size={18} className="group-hover:rotate-90 transition-transform duration-500" />
        </button>
      </div>

      {/* Color drawer */}
      <ColorSettingsDrawer open={colorDrawerOpen} onClose={() => setColorDrawerOpen(false)} config={config} updateGlobal={updateGlobal} />

      {/* ── Cabeçalho ── */}
      <Card title="Cabeçalho" icon={<span className="text-base">📝</span>}>
        <div className="flex gap-1.5 p-1 rounded-lg bg-muted/40">
          <TabButton active={config.headerMode === 'text'} label="Texto" onClick={() => updateGlobal('headerMode', 'text')} />
          <TabButton active={config.headerMode === 'image'} label="Imagem" onClick={() => updateGlobal('headerMode', 'image')} />
        </div>
        {config.headerMode === 'text' ? (
          <div className="space-y-2">
            <input type="text" value={config.pageTitle} onChange={e => updateGlobal('pageTitle', e.target.value)} placeholder="Título" className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background text-foreground" />
            <input type="text" value={config.pageSubtitle} onChange={e => updateGlobal('pageSubtitle', e.target.value)} placeholder="Subtítulo" className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background text-foreground" />
            <RangeInput label="Título" value={config.headerTitleSize ?? 36} min={16} max={72} onChange={v => updateGlobal('headerTitleSize', v)} />
            <RangeInput label="Subtítulo" value={config.headerSubtitleSize ?? 12} min={8} max={36} onChange={v => updateGlobal('headerSubtitleSize', v)} />
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
      </Card>

      {/* ── Background ── */}
      <Card title="Fundo da Página" icon={<span className="text-base">🖼</span>}>
        <ImageUpload label="Imagem de fundo" value={config.backgroundImageUrl} onChange={v => updateGlobal('backgroundImageUrl', v)} />
        {config.backgroundImageUrl && (
          <ImagePositionControls
            offsetX={config.backgroundImageOffsetX ?? 0} offsetY={config.backgroundImageOffsetY ?? 0} scale={config.backgroundImageScale ?? 1}
            onChangeX={v => updateGlobal('backgroundImageOffsetX', v)} onChangeY={v => updateGlobal('backgroundImageOffsetY', v)} onChangeScale={v => updateGlobal('backgroundImageScale', v)}
          />
        )}
      </Card>

      {/* ── Som & Botão Central ── */}
      <Card title="Som & Interação" icon={<span className="text-base">🔊</span>}>
        <ToggleSwitch label="Som ao girar" checked={config.spinSoundEnabled !== false} onChange={v => updateGlobal('spinSoundEnabled', v)} />
        <p className="text-[9px] text-muted-foreground">Efeito sonoro de roleta girando.</p>

        {config.spinSoundEnabled !== false && (
          <>
            <div className="border-t border-border/30 my-2" />
            <label className="text-xs text-muted-foreground">Tipo de som</label>
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={() => updateGlobal('spinSoundMode', 'default')}
                className={`flex-1 rounded-lg px-3 py-1.5 text-xs border transition-all ${
                  (config.spinSoundMode || 'default') === 'default'
                    ? 'bg-primary/20 border-primary text-primary'
                    : 'bg-muted/40 border-border text-muted-foreground hover:bg-muted/60'
                }`}
              >
                🎵 Padrão
              </button>
              <button
                type="button"
                onClick={() => updateGlobal('spinSoundMode', 'custom')}
                className={`flex-1 rounded-lg px-3 py-1.5 text-xs border transition-all ${
                  config.spinSoundMode === 'custom'
                    ? 'bg-primary/20 border-primary text-primary'
                    : 'bg-muted/40 border-border text-muted-foreground hover:bg-muted/60'
                }`}
              >
                🎶 Personalizado
              </button>
            </div>

            {config.spinSoundMode === 'custom' && (
              <div className="mt-2 space-y-2">
                <AudioUpload
                  label="Áudio personalizado"
                  value={config.customSpinSoundUrl}
                  onChange={v => updateGlobal('customSpinSoundUrl', v)}
                />
              </div>
            )}

            <div className="mt-2">
              <button
                type="button"
                onClick={() => {
                  const customUrl = config.spinSoundMode === 'custom' && config.customSpinSoundUrl
                    ? config.customSpinSoundUrl : undefined;
                  playSpinSound(3000, customUrl);
                }}
                className="w-full rounded-lg bg-muted/60 px-3 py-1.5 text-xs text-foreground hover:bg-muted/80 transition-all"
              >
                ▶️ Testar som
              </button>
            </div>
          </>
        )}

        <div className="border-t border-border/30 my-2" />
        <ToggleSwitch label="Botão central gira" checked={!!config.centerButtonSpinEnabled} onChange={v => updateGlobal('centerButtonSpinEnabled', v)} />
        <p className="text-[9px] text-muted-foreground">Permite girar clicando no centro da roleta.</p>
      </Card>

      {/* ── Imagem Central ── */}
      <Card title="Imagem Central" icon={<span className="text-base">⚡</span>}>
        <ImageUpload label="Logo / ícone do centro" value={config.centerImageUrl} onChange={v => updateGlobal('centerImageUrl', v)} />
        {config.centerImageUrl && (
          <ImagePositionControls
            offsetX={config.centerImageOffsetX ?? 0} offsetY={config.centerImageOffsetY ?? 0} scale={config.centerImageScale ?? 1}
            onChangeX={v => updateGlobal('centerImageOffsetX', v)} onChangeY={v => updateGlobal('centerImageOffsetY', v)} onChangeScale={v => updateGlobal('centerImageScale', v)}
          />
        )}
      </Card>

      {/* ── Segmentos ── */}
      <Card title="Segmentos" icon={<span className="text-base">🍕</span>} defaultOpen>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{config.segments.length} fatia(s)</span>
          <button
            onClick={() => {
              const newSeg = { id: Date.now().toString(), title: 'NOVO', reward: '0', color: '#1a1a3e', gradientOverlay: 'rgba(255,255,255,0.1)', textColor: '#FFFFFF', percentage: 10 };
              onChange({ ...config, segments: [...config.segments, newSeg] });
            }}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-all"
          >
            <Plus size={12} /> Adicionar
          </button>
        </div>

        <div className="space-y-1.5">
          {config.segments.map((seg, i) => {
            const segOpen = openSegments[seg.id] ?? false;
            return (
              <div key={seg.id} className={`rounded-lg border overflow-hidden transition-all ${segOpen ? 'border-primary/30 bg-card shadow-sm' : 'border-border/40 hover:border-border'}`}>
                <button
                  onClick={() => setOpenSegments(prev => ({ ...prev, [seg.id]: !prev[seg.id] }))}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
                >
                  <div className="w-4 h-4 rounded-md border border-border/50" style={{ background: seg.color }} />
                  <span className="text-sm font-medium text-foreground flex-1 truncate">{seg.reward || `Seg ${i + 1}`}</span>
                  <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">{seg.percentage}%</span>
                  <ChevronDown size={12} className={`text-muted-foreground transition-transform duration-200 ${segOpen ? 'rotate-180' : ''}`} />
                </button>
                {segOpen && (
                  <div className="px-3 pb-3 space-y-2.5 border-t border-border/30 pt-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground font-medium">Título</label>
                        <input type="text" value={seg.title} onChange={e => updateSegment(i, 'title', e.target.value)} className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground" />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground font-medium">Valor</label>
                        <input type="text" value={seg.reward} onChange={e => updateSegment(i, 'reward', e.target.value)} className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground font-medium">Porcentagem (%)</label>
                      <input type="number" min={0} max={100} value={seg.percentage} onChange={e => updateSegment(i, 'percentage', Math.max(0, parseInt(e.target.value) || 0))} className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground font-medium">Emoji pós-giro</label>
                      <input
                        type="text"
                        value={seg.postSpinEmoji ?? '🎉'}
                        onChange={e => updateSegment(i, 'postSpinEmoji', e.target.value)}
                        maxLength={4}
                        className="w-16 text-center text-lg px-2 py-1 rounded-lg border border-border bg-background"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground font-medium">Mensagem pós-giro</label>
                      <textarea
                        value={seg.postSpinMessage ?? ''}
                        onChange={e => updateSegment(i, 'postSpinMessage', e.target.value)}
                        placeholder={`Parabéns! Você ganhou ${seg.reward}!`}
                        rows={2}
                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground"
                      />
                      <span className="text-[9px] text-muted-foreground">Deixe vazio para usar o padrão. Use {'{premio}'} e {'{titulo}'} como variáveis.</span>
                    </div>
                    {(seg.postSpinMessage || seg.postSpinEmoji) && (
                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Pré-visualização</span>
                        <div
                          className="mt-1.5 rounded-lg p-3 text-center"
                          style={{ background: config.resultBoxColor, color: config.resultTextColor, border: `1px solid ${config.resultBorderColor}` }}
                        >
                          <p className="font-bold text-base mb-1">{seg.postSpinEmoji ?? '🎉'} {seg.reward}</p>
                          
                          <p className="text-xs opacity-85" style={{ whiteSpace: 'pre-line' }}>
                            {(seg.postSpinMessage || `Parabéns! Você ganhou ${seg.reward}!`).replace(/\{premio\}/g, seg.reward).replace(/\{titulo\}/g, seg.title)}
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="flex gap-4">
                      <ToggleSwitch label="Ocultar título" checked={!!seg.hideTitle} onChange={v => updateSegment(i, 'hideTitle', v)} />
                      <ToggleSwitch label="Ocultar valor" checked={!!seg.hideValue} onChange={v => updateSegment(i, 'hideValue', v)} />
                    </div>
                    <div className="grid grid-cols-2 gap-x-4">
                      <ColorInput label="Fundo" value={seg.color} onChange={v => updateSegment(i, 'color', v)} />
                      <ColorInput label="Texto" value={seg.textColor} onChange={v => updateSegment(i, 'textColor', v)} />
                    </div>
                    <p className="text-[10px] text-muted-foreground/70 italic">📐 Recomendado: imagem quadrada 1000×1000px com o elemento principal centralizado.</p>
                    <ImageUpload label="Imagem de fundo do segmento" value={seg.imageUrl} onChange={v => updateSegment(i, 'imageUrl', v)} compact />
                    {seg.imageUrl && (
                      <>
                        <ImagePositionControls
                          offsetX={seg.imageOffsetX ?? 0} offsetY={seg.imageOffsetY ?? 0} scale={seg.imageScale ?? 1}
                          onChangeX={v => updateSegment(i, 'imageOffsetX', v)} onChangeY={v => updateSegment(i, 'imageOffsetY', v)} onChangeScale={v => updateSegment(i, 'imageScale', v)}
                        />
                        <RangeInput label="Rotação da imagem" value={seg.imageRotation ?? 0} min={0} max={360} step={1} onChange={v => updateSegment(i, 'imageRotation', v)} suffix="°" />
                      </>
                    )}
                    {config.segments.length > 2 && (
                      <button
                        onClick={() => onChange({ ...config, segments: config.segments.filter((_, idx) => idx !== i) })}
                        className="w-full flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg border border-destructive/20 text-destructive hover:bg-destructive/10 transition-all font-medium"
                      >
                        <Trash2 size={12} /> Remover
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── Spins & Badge ── */}
      <Card title="Textos de Giros & Identificação" icon={<span className="text-base">🏷️</span>}>
        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Giros Restantes</h4>
        <ColorInput label="Cor do texto" value={config.spinsTextColor ?? config.glowColor} onChange={v => updateGlobal('spinsTextColor', v)} />
        <RangeInput label="Tamanho" value={config.spinsTextSize ?? 14} min={10} max={32} onChange={v => updateGlobal('spinsTextSize', v)} />
        <div>
          <label className="text-[10px] text-muted-foreground font-medium">Fonte</label>
          <select value={config.spinsTextFont ?? ''} onChange={e => updateGlobal('spinsTextFont', e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background text-foreground">
            <option value="">Padrão</option>
            <option value="'Inter', sans-serif">Inter</option>
            <option value="'Arial', sans-serif">Arial</option>
            <option value="'Georgia', serif">Georgia</option>
            <option value="'Courier New', monospace">Courier New</option>
            <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
            <option value="'Verdana', sans-serif">Verdana</option>
          </select>
        </div>

        <div className="border-t border-border/30 my-2" />
        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Sem Giros Disponíveis</h4>
        <ColorInput label="Cor do texto" value={config.noSpinsTextColor ?? '#ef4444'} onChange={v => updateGlobal('noSpinsTextColor', v)} />
        <RangeInput label="Tamanho" value={config.noSpinsTextSize ?? 14} min={10} max={32} onChange={v => updateGlobal('noSpinsTextSize', v)} />
        <div>
          <label className="text-[10px] text-muted-foreground font-medium">Fonte</label>
          <select value={config.noSpinsTextFont ?? ''} onChange={e => updateGlobal('noSpinsTextFont', e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background text-foreground">
            <option value="">Padrão</option>
            <option value="'Inter', sans-serif">Inter</option>
            <option value="'Arial', sans-serif">Arial</option>
            <option value="'Georgia', serif">Georgia</option>
            <option value="'Courier New', monospace">Courier New</option>
            <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
            <option value="'Verdana', sans-serif">Verdana</option>
          </select>
        </div>

        <div className="border-t border-border/30 my-2" />
        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Badge do Usuário</h4>
        <ColorInput label="Fundo" value={config.badgeBgColor ?? 'rgba(20,20,30,0.85)'} onChange={v => updateGlobal('badgeBgColor', v)} />
        <ColorInput label="Borda" value={config.badgeBorderColor ?? config.glowColor} onChange={v => updateGlobal('badgeBorderColor', v)} />
        <ColorInput label="Cor do nome" value={config.badgeNameColor ?? config.glowColor} onChange={v => updateGlobal('badgeNameColor', v)} />
        <ColorInput label="Cor do label ID" value={config.badgeLabelColor ?? '#a1a1aa'} onChange={v => updateGlobal('badgeLabelColor', v)} />
        <ColorInput label="Cor do ID" value={config.badgeIdColor ?? '#a1a1aa'} onChange={v => updateGlobal('badgeIdColor', v)} />
      </Card>

      {/* ── Botão Compartilhar ── */}
      <Card title="Botão Compartilhar" icon={<span className="text-base">📤</span>}>
        <div className="space-y-2">
          <div>
            <label className="text-[10px] text-muted-foreground font-medium">Texto do botão</label>
            <input type="text" value={config.shareBtnText ?? 'COMPARTILHAR PRÊMIO'} onChange={e => updateGlobal('shareBtnText', e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background text-foreground" />
          </div>
        </div>
        <ColorInput label="Cor de fundo" value={config.shareBtnBgColor ?? config.glowColor ?? '#FFD700'} onChange={v => updateGlobal('shareBtnBgColor', v)} />
        <ColorInput label="Cor do texto" value={config.shareBtnTextColor ?? config.resultBoxColor ?? '#1a0a2e'} onChange={v => updateGlobal('shareBtnTextColor', v)} />
        <ColorInput label="Cor da borda" value={config.shareBtnBorderColor ?? 'transparent'} onChange={v => updateGlobal('shareBtnBorderColor', v)} />
        <RangeInput label="Arredondamento" value={config.shareBtnBorderRadius ?? 999} min={0} max={999} onChange={v => updateGlobal('shareBtnBorderRadius', v)} suffix="px" />

        <div className="border-t border-border/30 my-2" />
        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">🖥️ Desktop</h4>
        <RangeInput label="Tamanho da fonte" value={config.shareBtnFontSize ?? 14} min={8} max={32} onChange={v => updateGlobal('shareBtnFontSize', v)} suffix="px" />
        <RangeInput label="Padding horizontal" value={config.shareBtnPaddingX ?? 24} min={4} max={60} onChange={v => updateGlobal('shareBtnPaddingX', v)} suffix="px" />
        <RangeInput label="Padding vertical" value={config.shareBtnPaddingY ?? 10} min={2} max={30} onChange={v => updateGlobal('shareBtnPaddingY', v)} suffix="px" />

        {/* Desktop preview */}
        <div className="p-3 rounded-lg bg-muted/20 border border-border/30 flex items-center justify-center">
          <div className="text-[10px] text-muted-foreground absolute top-1 left-2">Desktop</div>
          <button
            className="font-bold tracking-wider cursor-default"
            style={{
              background: config.shareBtnBgColor || config.glowColor || '#FFD700',
              color: config.shareBtnTextColor || config.resultBoxColor || '#1a0a2e',
              border: config.shareBtnBorderColor ? `2px solid ${config.shareBtnBorderColor}` : 'none',
              borderRadius: config.shareBtnBorderRadius ?? 999,
              fontSize: config.shareBtnFontSize ?? 14,
              paddingLeft: config.shareBtnPaddingX ?? 24,
              paddingRight: config.shareBtnPaddingX ?? 24,
              paddingTop: config.shareBtnPaddingY ?? 10,
              paddingBottom: config.shareBtnPaddingY ?? 10,
              boxShadow: `0 4px 20px ${config.shareBtnBgColor || config.glowColor || '#FFD700'}55`,
            }}
          >
            📤 {config.shareBtnText || 'COMPARTILHAR PRÊMIO'}
          </button>
        </div>

        <div className="border-t border-border/30 my-2" />
        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">📱 Mobile</h4>
        <RangeInput label="Tamanho da fonte" value={config.shareBtnMobileFontSize ?? config.shareBtnFontSize ?? 14} min={6} max={24} onChange={v => updateGlobal('shareBtnMobileFontSize', v)} suffix="px" />
        <RangeInput label="Padding horizontal" value={config.shareBtnMobilePaddingX ?? config.shareBtnPaddingX ?? 24} min={4} max={40} onChange={v => updateGlobal('shareBtnMobilePaddingX', v)} suffix="px" />
        <RangeInput label="Padding vertical" value={config.shareBtnMobilePaddingY ?? config.shareBtnPaddingY ?? 10} min={2} max={20} onChange={v => updateGlobal('shareBtnMobilePaddingY', v)} suffix="px" />

        {/* Mobile preview */}
        <div className="p-3 rounded-lg bg-muted/20 border border-border/30 flex items-center justify-center relative">
          <div className="border border-border/40 rounded-lg px-3 py-4 flex items-center justify-center" style={{ width: 180, background: 'rgba(0,0,0,0.3)' }}>
            <button
              className="font-bold tracking-wider cursor-default"
              style={{
                background: config.shareBtnBgColor || config.glowColor || '#FFD700',
                color: config.shareBtnTextColor || config.resultBoxColor || '#1a0a2e',
                border: config.shareBtnBorderColor ? `2px solid ${config.shareBtnBorderColor}` : 'none',
                borderRadius: config.shareBtnBorderRadius ?? 999,
                fontSize: config.shareBtnMobileFontSize ?? config.shareBtnFontSize ?? 14,
                paddingLeft: config.shareBtnMobilePaddingX ?? config.shareBtnPaddingX ?? 24,
                paddingRight: config.shareBtnMobilePaddingX ?? config.shareBtnPaddingX ?? 24,
                paddingTop: config.shareBtnMobilePaddingY ?? config.shareBtnPaddingY ?? 10,
                paddingBottom: config.shareBtnMobilePaddingY ?? config.shareBtnPaddingY ?? 10,
                boxShadow: `0 4px 20px ${config.shareBtnBgColor || config.glowColor || '#FFD700'}55`,
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              📤 {config.shareBtnText || 'COMPARTILHAR PRÊMIO'}
            </button>
          </div>
          <span className="absolute top-1 left-2 text-[10px] text-muted-foreground">📱 Mobile</span>
        </div>

        <p className="text-[10px] text-muted-foreground bg-muted/30 px-2.5 py-1.5 rounded-lg mt-2">O compartilhamento captura a tela inteira com o ID mascarado para segurança.</p>
      </Card>

      {/* ── Layout Mobile ── */}
      <Card title="Layout Mobile" icon={<span className="text-base">📱</span>}>
        <p className="text-[10px] text-muted-foreground bg-muted/30 px-2.5 py-1.5 rounded-lg">Ajustes apenas para dispositivos móveis.</p>
        <RangeInput label="Roleta X" value={config.mobileWheelOffsetX ?? 0} min={-100} max={100} onChange={v => updateGlobal('mobileWheelOffsetX', v)} />
        <RangeInput label="Roleta Y" value={config.mobileWheelOffsetY ?? 0} min={-100} max={100} onChange={v => updateGlobal('mobileWheelOffsetY', v)} />
        <RangeInput label="Roleta Zoom" value={config.mobileWheelScale ?? 1} min={0.5} max={2} step={0.05} onChange={v => updateGlobal('mobileWheelScale', v)} suffix="x" />
        <RangeInput label="Giros X" value={config.mobileSpinsOffsetX ?? 0} min={-100} max={100} onChange={v => updateGlobal('mobileSpinsOffsetX', v)} />
        <RangeInput label="Giros Y" value={config.mobileSpinsOffsetY ?? 0} min={-100} max={100} onChange={v => updateGlobal('mobileSpinsOffsetY', v)} />
        <RangeInput label="Botão Girar X" value={config.mobileButtonOffsetX ?? 0} min={-100} max={100} onChange={v => updateGlobal('mobileButtonOffsetX', v)} />
        <RangeInput label="Botão Girar Y" value={config.mobileButtonOffsetY ?? 0} min={-100} max={100} onChange={v => updateGlobal('mobileButtonOffsetY', v)} />
        <RangeInput label="Logo X" value={config.mobileLogoOffsetX ?? 0} min={-150} max={150} onChange={v => updateGlobal('mobileLogoOffsetX', v)} />
        <RangeInput label="Logo Y" value={config.mobileLogoOffsetY ?? 0} min={-150} max={150} onChange={v => updateGlobal('mobileLogoOffsetY', v)} />
        <RangeInput label="Logo Zoom" value={config.mobileLogoScale ?? 1} min={0.3} max={3} step={0.05} onChange={v => updateGlobal('mobileLogoScale', v)} suffix="x" />
      </Card>

      {/* ── SEO / Favicon ── */}
      <Card title="Página (Título / Favicon)" icon={<span className="text-base">🌐</span>}>
        <div className="space-y-2">
          <div>
            <label className="text-[10px] text-muted-foreground font-medium">Nome da página</label>
            <input type="text" value={config.seoTitle ?? ''} placeholder="Roleta de Prêmios" onChange={e => updateGlobal('seoTitle', e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background text-foreground" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground font-medium">Descrição</label>
            <textarea value={config.seoDescription ?? ''} placeholder="Gire a roleta e ganhe prêmios!" onChange={e => updateGlobal('seoDescription', e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background text-foreground resize-none" rows={2} />
          </div>
          <ImageUpload label="Favicon" value={config.faviconUrl} onChange={v => updateGlobal('faviconUrl', v)} folder="favicon" compact />
          {config.faviconUrl && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/20">
              <img src={config.faviconUrl} alt="favicon" className="w-5 h-5 rounded" />
              <span className="text-[10px] text-muted-foreground">Preview</span>
            </div>
          )}
        </div>
      </Card>

      {/* ── OG Image (Link Preview) ── */}
      <Card title="Imagem de Pré-visualização de Link" icon={<span className="text-base">🔗</span>}>
        <p className="text-[10px] text-muted-foreground mb-2">Imagem exibida ao compartilhar o link no WhatsApp, Facebook, etc. Tamanho recomendado: 1200×630px</p>
        <ImageUpload label="Imagem OG" value={config.ogImageUrl} onChange={v => updateGlobal('ogImageUrl', v)} folder="og" />
        {config.ogImageUrl && (
          <div className="mt-2 space-y-2">
            <div className="rounded-lg border border-border overflow-hidden bg-muted/20">
              <img src={config.ogImageUrl} alt="OG Preview" className="w-full h-auto object-cover" style={{ maxHeight: 180 }} />
              <div className="p-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{window.location.host}</p>
                <p className="text-sm font-semibold text-foreground truncate">{config.seoTitle || config.pageTitle || 'Roleta de Prêmios'}</p>
                <p className="text-[11px] text-muted-foreground truncate">{config.seoDescription || 'Gire a roleta e ganhe prêmios!'}</p>
              </div>
            </div>
            <p className="text-[9px] text-muted-foreground italic">↑ Simulação de como ficará no WhatsApp</p>
          </div>
        )}
      </Card>


    </div>
    <SegmentPreview config={config} floating />
    </>
  );
};

export default CustomizationPanel;
