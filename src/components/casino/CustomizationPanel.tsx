import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { WheelConfig } from './types';

import { toast } from 'sonner';
import { Settings, X, ChevronDown, Upload, Trash2, Plus } from 'lucide-react';
import { uploadAppAsset } from '@/lib/uploadAppAsset';

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
        <div className="w-7 h-7 rounded-lg border border-border shadow-sm cursor-pointer hover:scale-110 transition-transform" style={{ background: value }} />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground">{value}</span>
    </div>
  </div>
);

const ImageUpload: React.FC<{ label: string; value?: string; onChange: (v: string) => void; folder?: string; compact?: boolean }> = ({ label, value, onChange, folder = 'wheel', compact }) => {
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
      <div className="flex items-center gap-3">
        {value && <img src={value} alt="" className="w-10 h-10 rounded-lg object-cover border border-border" />}
        <button onClick={() => inputRef.current?.click()} disabled={uploading} className="text-xs px-3 py-1.5 rounded-lg bg-muted/80 text-foreground hover:bg-muted transition-all disabled:opacity-50">
          {uploading ? '⏳' : value ? '🔄' : '📤'} {label}
        </button>
        {value && <button onClick={() => onChange('')} className="text-xs text-destructive hover:text-destructive/80"><Trash2 size={14} /></button>}
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-sm text-muted-foreground">{label}</label>
      <div className="flex gap-3 items-center">
        {value && <img src={value} alt="" className="w-12 h-12 rounded-xl object-cover border-2 border-border shadow-sm" />}
        <div className="flex gap-2">
          <button onClick={() => inputRef.current?.click()} disabled={uploading} className="text-xs px-4 py-2 rounded-lg border border-border bg-muted/50 text-foreground hover:bg-muted transition-all disabled:opacity-50 font-medium">
            {uploading ? '⏳ Enviando...' : value ? '🔄 Trocar' : '📤 Upload'}
          </button>
          {value && <button onClick={() => onChange('')} className="text-xs px-3 py-2 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-all"><Trash2 size={14} /></button>}
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
    </div>
  );
};

const RangeInput: React.FC<{ label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; suffix?: string }> = ({ label, value, min, max, step = 1, onChange, suffix = '' }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-[10px] font-mono text-foreground bg-muted/50 px-1.5 py-0.5 rounded">{step < 1 ? value.toFixed(1) : value}{suffix}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} className="w-full accent-primary h-1 rounded-full" />
  </div>
);

const ImagePositionControls: React.FC<{
  offsetX: number; offsetY: number; scale: number;
  onChangeX: (v: number) => void; onChangeY: (v: number) => void; onChangeScale: (v: number) => void;
}> = ({ offsetX, offsetY, scale, onChangeX, onChangeY, onChangeScale }) => (
  <div className="space-y-1 p-2 rounded-lg bg-muted/20 border border-border/30">
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
      className={`w-10 h-5 rounded-full relative transition-all duration-300 ${checked ? 'bg-primary' : 'bg-muted'}`}
    >
      <div className={`w-4 h-4 rounded-full bg-white shadow-sm absolute top-0.5 transition-all duration-300 ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  </div>
);

/* ── Collapsible Card ── */
const Card: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, icon, children, defaultOpen = false }) => (
  <details open={defaultOpen} className="group rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden transition-all">
    <summary className="flex items-center gap-2.5 px-4 py-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden select-none hover:bg-muted/30 transition-colors">
      {icon}
      <span className="text-sm font-semibold text-foreground flex-1">{title}</span>
      <ChevronDown size={14} className="text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
    </summary>
    <div className="px-4 pb-4 pt-2 space-y-3 border-t border-border/30">
      {children}
    </div>
  </details>
);

const TabButton: React.FC<{ active: boolean; label: string; onClick: () => void }> = ({ active, label, onClick }) => (
  <button
    onClick={onClick}
    className={`flex-1 text-xs py-2 rounded-lg font-medium transition-all ${
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
      <div className="relative w-full max-w-sm bg-card border-l border-border shadow-2xl h-full overflow-y-auto animate-in slide-in-from-right duration-300" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
        <div className="sticky top-0 bg-card/95 backdrop-blur-md border-b border-border z-10 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-primary" />
            <h2 className="text-base font-bold text-foreground">Cores & Ajustes</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-all">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Wheel colors */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Roleta</h3>
            <ColorInput label="Anel externo" value={config.outerRingColor} onChange={v => updateGlobal('outerRingColor', v)} />
            <ColorInput label="LEDs" value={config.ledColor} onChange={v => updateGlobal('ledColor', v)} />
            <ColorInput label="Centro" value={config.centerCapColor} onChange={v => updateGlobal('centerCapColor', v)} />
            <ColorInput label="Divisores" value={config.dividerColor} onChange={v => updateGlobal('dividerColor', v)} />
            <ColorInput label="Brilho" value={config.glowColor} onChange={v => updateGlobal('glowColor', v)} />
            <ColorInput label="Ponteiro" value={config.pointerColor} onChange={v => updateGlobal('pointerColor', v)} />
          </div>

          <div className="border-t border-border/30" />

          {/* Button & result colors */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Botão & Resultado</h3>
            <ColorInput label="Cor do botão" value={config.buttonColor} onChange={v => updateGlobal('buttonColor', v)} />
            <ColorInput label="Texto do botão" value={config.buttonTextColor} onChange={v => updateGlobal('buttonTextColor', v)} />
            <ColorInput label="Fundo do prêmio" value={config.resultBoxColor} onChange={v => updateGlobal('resultBoxColor', v)} />
            <ColorInput label="Borda do prêmio" value={config.resultBorderColor} onChange={v => updateGlobal('resultBorderColor', v)} />
            <ColorInput label="Texto do prêmio" value={config.resultTextColor} onChange={v => updateGlobal('resultTextColor', v)} />
          </div>

          <div className="border-t border-border/30" />

          {/* Adjustments */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Ajustes</h3>
            <RangeInput label="Espessura dos divisores" value={config.dividerWidth ?? 3} min={0} max={8} step={0.5} onChange={v => updateGlobal('dividerWidth', v)} />
            <RangeInput label="Tamanho dos LEDs" value={config.ledSize ?? 5} min={2} max={12} step={0.5} onChange={v => updateGlobal('ledSize', v)} />
            <RangeInput label="Escala da fonte" value={config.fontSizeScale ?? 1} min={0.5} max={2} step={0.1} onChange={v => updateGlobal('fontSizeScale', v)} suffix="x" />
            <RangeInput label="Tamanho do valor" value={config.valueFontSize ?? 22} min={8} max={40} onChange={v => updateGlobal('valueFontSize', v)} />
            <RangeInput label="Tamanho do título" value={config.titleFontSize ?? 10} min={6} max={30} onChange={v => updateGlobal('titleFontSize', v)} />
            <ToggleSwitch label="Ocultar texto dos segmentos" checked={!!config.hideSegmentText} onChange={v => updateGlobal('hideSegmentText', v)} />
          </div>
        </div>
      </div>
    </div>,
    document.body
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

  const updateSegment = (index: number, key: string, value: string | number) => {
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
        {/* Mini wheel preview */}
        <SegmentPreview config={config} />

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
                    <div className="grid grid-cols-2 gap-x-4">
                      <ColorInput label="Fundo" value={seg.color} onChange={v => updateSegment(i, 'color', v)} />
                      <ColorInput label="Texto" value={seg.textColor} onChange={v => updateSegment(i, 'textColor', v)} />
                    </div>
                    <ImageUpload label="Imagem" value={seg.imageUrl} onChange={v => updateSegment(i, 'imageUrl', v)} compact />
                    {seg.imageUrl && (
                      <ImagePositionControls
                        offsetX={seg.imageOffsetX ?? 0} offsetY={seg.imageOffsetY ?? 0} scale={seg.imageScale ?? 1}
                        onChangeX={v => updateSegment(i, 'imageOffsetX', v)} onChangeY={v => updateSegment(i, 'imageOffsetY', v)} onChangeScale={v => updateSegment(i, 'imageScale', v)}
                      />
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
  );
};

export default CustomizationPanel;
