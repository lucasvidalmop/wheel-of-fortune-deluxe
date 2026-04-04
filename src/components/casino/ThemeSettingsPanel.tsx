import { useState } from 'react';
import { Settings, X, Upload, RotateCcw, Palette, Image, Monitor } from 'lucide-react';
import { toast } from 'sonner';
import { uploadAppAsset } from '@/lib/uploadAppAsset';

export interface ThemeSettings {
  primaryColor: string;
  accentColor: string;
  sidebarBg: string;
  cardBg: string;
  textColor: string;
  bgImage: string;
  glowColor: string;
  glowOpacity: number;
  borderOpacity: number;
}

export const defaultTheme: ThemeSettings = {
  primaryColor: '#e6a817',
  accentColor: '#c9922a',
  sidebarBg: 'rgba(255,255,255,0.03)',
  cardBg: 'rgba(255,255,255,0.04)',
  textColor: '#e8dcc8',
  bgImage: '',
  glowColor: '#e6a817',
  glowOpacity: 3,
  borderOpacity: 8,
};

interface Props {
  storageKey: string;
}

const ThemeSettingsPanel = ({ storageKey }: Props) => {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeSettings>(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? { ...defaultTheme, ...JSON.parse(saved) } : defaultTheme;
  });
  const [uploading, setUploading] = useState(false);

  const save = (t: ThemeSettings) => {
    setTheme(t);
    localStorage.setItem(storageKey, JSON.stringify(t));
    applyTheme(t);
  };

  const applyTheme = (t: ThemeSettings) => {
    const root = document.documentElement;
    const toHSL = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h = 0, s = 0;
      const l = (max + min) / 2;
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
          case g: h = ((b - r) / d + 2) / 6; break;
          case b: h = ((r - g) / d + 4) / 6; break;
        }
      }
      return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
    };

    root.style.setProperty('--primary', toHSL(t.primaryColor));
    root.style.setProperty('--accent', toHSL(t.accentColor));
    root.style.setProperty('--ring', toHSL(t.primaryColor));
    root.style.setProperty('--sidebar-primary', toHSL(t.primaryColor));
    root.style.setProperty('--foreground', toHSL(t.textColor));
    root.style.setProperty('--theme-glow-color', t.glowColor);
    root.style.setProperty('--theme-glow-opacity', String(t.glowOpacity));
    root.style.setProperty('--theme-border-opacity', String(t.borderOpacity));
    root.style.setProperty('--theme-bg-image', t.bgImage ? `url(${t.bgImage})` : 'none');
  };

  const handleReset = () => {
    localStorage.removeItem(storageKey);
    save(defaultTheme);
    const root = document.documentElement;
    root.style.removeProperty('--primary');
    root.style.removeProperty('--accent');
    root.style.removeProperty('--ring');
    root.style.removeProperty('--sidebar-primary');
    root.style.removeProperty('--foreground');
    root.style.removeProperty('--theme-glow-color');
    root.style.removeProperty('--theme-glow-opacity');
    root.style.removeProperty('--theme-border-opacity');
    root.style.removeProperty('--theme-bg-image');
    toast.success('Tema resetado!');
  };

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const { publicUrl } = await uploadAppAsset(file, `theme-bg/${storageKey}`);
      save({ ...theme, bgImage: publicUrl });
      toast.success('Background atualizado!');
    } catch (error: any) {
      toast.error('Erro no upload: ' + (error.message || 'Tente novamente'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeBg = () => {
    save({ ...theme, bgImage: '' });
    toast.success('Background removido!');
  };

  useState(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) applyTheme({ ...defaultTheme, ...JSON.parse(saved) });
  });

  

  return (
    <>
      {/* Gear button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 right-4 z-50 p-2.5 rounded-xl border border-white/[0.1] bg-white/[0.06] backdrop-blur-xl text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/10 transition-all duration-300 shadow-lg group"
        title="Configurações visuais"
      >
        <Settings size={18} className="group-hover:rotate-90 transition-transform duration-500" />
      </button>

      {/* Panel overlay */}
      {open && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-sm bg-background border-l border-white/[0.08] shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-xl border-b border-white/[0.06] p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <Palette className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground">Personalização</h2>
                  <p className="text-[10px] text-muted-foreground">Cores, fundo e estilo visual</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-6">
              {/* Colors */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wider">
                  <Palette size={14} className="text-primary" />
                  Cores
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                  <ColorInput label="Cor primária" value={theme.primaryColor} onChange={v => save({ ...theme, primaryColor: v })} />
                  <ColorInput label="Cor de destaque" value={theme.accentColor} onChange={v => save({ ...theme, accentColor: v })} />
                  <ColorInput label="Cor do texto" value={theme.textColor} onChange={v => save({ ...theme, textColor: v })} />
                  <ColorInput label="Cor do brilho" value={theme.glowColor} onChange={v => save({ ...theme, glowColor: v })} />
                </div>
              </div>

              {/* Glass effects */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wider">
                  <Monitor size={14} className="text-primary" />
                  Efeitos Glass
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">Intensidade do brilho</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{theme.glowOpacity}%</span>
                    </div>
                    <input
                      type="range" min="0" max="20" value={theme.glowOpacity}
                      onChange={e => save({ ...theme, glowOpacity: parseInt(e.target.value) })}
                      className="w-full accent-primary h-1.5"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">Opacidade das bordas</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{theme.borderOpacity}%</span>
                    </div>
                    <input
                      type="range" min="0" max="30" value={theme.borderOpacity}
                      onChange={e => save({ ...theme, borderOpacity: parseInt(e.target.value) })}
                      className="w-full accent-primary h-1.5"
                    />
                  </div>
                </div>
              </div>

              {/* Background image */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wider">
                  <Image size={14} className="text-primary" />
                  Imagem de fundo
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                  {theme.bgImage ? (
                    <div className="space-y-3">
                      <div className="relative rounded-xl overflow-hidden border border-white/[0.08]">
                        <img src={theme.bgImage} alt="Background" className="w-full h-32 object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      </div>
                      <div className="flex gap-2">
                        <label className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-xs cursor-pointer hover:bg-white/[0.08] transition">
                          <Upload size={14} />
                          Trocar
                          <input type="file" accept="image/*" onChange={handleBgUpload} className="hidden" />
                        </label>
                        <button onClick={removeBg} className="flex-1 py-2 rounded-xl border border-destructive/20 text-destructive text-xs hover:bg-destructive/10 transition">
                          Remover
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed border-white/[0.1] hover:border-primary/30 cursor-pointer transition group">
                      <Upload size={24} className="text-muted-foreground group-hover:text-primary transition" />
                      <span className="text-xs text-muted-foreground group-hover:text-foreground transition">
                        {uploading ? 'Enviando...' : 'Clique para enviar imagem'}
                      </span>
                      <input type="file" accept="image/*" onChange={handleBgUpload} className="hidden" disabled={uploading} />
                    </label>
                  )}
                </div>
              </div>

              {/* Reset */}
              <button
                onClick={handleReset}
                className="w-full py-3 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm font-medium hover:bg-white/[0.08] transition flex items-center justify-center gap-2"
              >
                <RotateCcw size={15} />
                Resetar para padrão
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const ColorInput = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-xs text-muted-foreground">{label}</span>
    <div className="flex items-center gap-2">
      <input type="color" value={value} onInput={e => onChange((e.target as HTMLInputElement).value)} className="w-8 h-8 rounded-lg border border-white/[0.1] cursor-pointer bg-transparent" />
      <span className="text-[10px] text-muted-foreground font-mono uppercase">{value}</span>
    </div>
  </div>
);

export default ThemeSettingsPanel;
