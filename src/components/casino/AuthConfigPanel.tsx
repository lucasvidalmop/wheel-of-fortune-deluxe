import React, { useRef, useState } from 'react';
import { WheelConfig } from './types';
import { toast } from 'sonner';
import { uploadAppAsset } from '@/lib/uploadAppAsset';

interface AuthConfigPanelProps {
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

const ImageUpload: React.FC<{ label: string; value?: string; onChange: (v: string) => void; folder?: string }> = ({ label, value, onChange, folder = 'auth' }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { publicUrl } = await uploadAppAsset(file, folder);
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

const AuthConfigPanel: React.FC<AuthConfigPanelProps> = ({ config, onChange }) => {
  const updateGlobal = (key: keyof WheelConfig, value: any) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <div className="w-full max-w-lg space-y-3">
      <h2 className="font-display text-sm font-bold tracking-wider text-primary uppercase px-1">🔐 Configuração da Página de Autenticação</h2>

      {/* Cabeçalho */}
      <Section title="Cabeçalho" emoji="📝" defaultOpen>
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

        {(config.authHeaderMode === 'logo' || config.authHeaderMode === 'logo_text') && (
          <>
            <ImageUpload label="Logo central" value={config.authLogoUrl} onChange={v => updateGlobal('authLogoUrl', v)} />
            <RangeInput label="Tam. logo" value={config.authLogoSize ?? 80} min={30} max={200} step={5} onChange={v => updateGlobal('authLogoSize', v)} />
            {config.authLogoUrl && (
              <ImagePositionControls
                offsetX={config.authLogoOffsetX ?? 0} offsetY={config.authLogoOffsetY ?? 0} scale={config.authLogoScale ?? 1}
                onChangeX={v => updateGlobal('authLogoOffsetX', v)} onChangeY={v => updateGlobal('authLogoOffsetY', v)} onChangeScale={v => updateGlobal('authLogoScale', v)}
              />
            )}
          </>
        )}

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
      </Section>

      {/* Cores */}
      <Section title="Cores" emoji="🎨" defaultOpen>
        <ColorInput label="Fundo da página" value={config.authBgColor ?? '#1a0a2e'} onChange={v => updateGlobal('authBgColor', v)} />
        <ColorInput label="Fundo do card" value={config.authCardBgColor ?? '#140c28'} onChange={v => updateGlobal('authCardBgColor', v)} />
        <ColorInput label="Borda do card" value={config.authCardBorderColor ?? '#ffffff14'} onChange={v => updateGlobal('authCardBorderColor', v)} />
        <ColorInput label="Borda dos inputs" value={config.authInputBorderColor ?? '#D4A017'} onChange={v => updateGlobal('authInputBorderColor', v)} />
        <ColorInput label="Cor do botão" value={config.authButtonBgColor ?? '#0ABACC'} onChange={v => updateGlobal('authButtonBgColor', v)} />
        <ColorInput label="Texto do botão" value={config.authButtonTextColor ?? '#000000'} onChange={v => updateGlobal('authButtonTextColor', v)} />
        <ColorInput label="Labels" value={config.authLabelColor ?? '#ffffff'} onChange={v => updateGlobal('authLabelColor', v)} />
        <ColorInput label="Texto descritivo" value={config.authTextColor ?? '#ffffff80'} onChange={v => updateGlobal('authTextColor', v)} />
      </Section>

      {/* Background Desktop */}
      <Section title="Background Desktop" emoji="🖥" defaultOpen>
        <p className="text-[10px] text-muted-foreground/70 italic">📐 Tamanho recomendado: 1920×1080px (16:9)</p>
        <ImageUpload label="Imagem de fundo (Desktop)" value={config.authBgImageUrl} onChange={v => updateGlobal('authBgImageUrl', v)} />
        {config.authBgImageUrl && (
          <ImagePositionControls
            offsetX={config.authBgImageOffsetX ?? 0} offsetY={config.authBgImageOffsetY ?? 0} scale={config.authBgImageScale ?? 1}
            onChangeX={v => updateGlobal('authBgImageOffsetX', v)} onChangeY={v => updateGlobal('authBgImageOffsetY', v)} onChangeScale={v => updateGlobal('authBgImageScale', v)}
          />
        )}
      </Section>

      {/* Background Mobile */}
      <Section title="Background Mobile" emoji="📱" defaultOpen>
        <p className="text-[10px] text-muted-foreground/70 italic">📐 Tamanho recomendado: 1080×1920px (9:16)</p>
        <ImageUpload label="Imagem de fundo (Mobile)" value={config.authBgImageMobileUrl} onChange={v => updateGlobal('authBgImageMobileUrl', v)} folder="auth-mobile" />
        {config.authBgImageMobileUrl && (
          <ImagePositionControls
            offsetX={config.authBgImageMobileOffsetX ?? 0} offsetY={config.authBgImageMobileOffsetY ?? 0} scale={config.authBgImageMobileScale ?? 1}
            onChangeX={v => updateGlobal('authBgImageMobileOffsetX', v)} onChangeY={v => updateGlobal('authBgImageMobileOffsetY', v)} onChangeScale={v => updateGlobal('authBgImageMobileScale', v)}
          />
        )}
      </Section>
    </div>
  );
};

export default AuthConfigPanel;
