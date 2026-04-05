import React, { useState } from 'react';
import { WheelConfig } from './types';
import { Monitor, Smartphone, Eye, Bold, Italic, AlignLeft, AlignCenter, AlignRight, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';

const FONT_OPTIONS = [
  'Inter', 'Arial', 'Georgia', 'Verdana', 'Trebuchet MS', 'Courier New',
  'Palatino', 'Garamond', 'Comic Sans MS', 'Impact', 'Lucida Console',
];

interface Props {
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

const SliderInput: React.FC<{ label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void }> = ({ label, value, min, max, step = 1, unit = 'px', onChange }) => (
  <div className="space-y-1 py-1">
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-xs font-mono text-muted-foreground">{value}{unit}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="w-full accent-primary h-1.5" />
  </div>
);

const CollapsibleSection: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, icon, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-white/[0.06] rounded-xl bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/[0.03] transition"
      >
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          {icon} {title}
        </h4>
        {open ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
      </button>
      {open && <div className="px-3 pb-3 space-y-3">{children}</div>}
    </div>
  );
};

const DialogConfigPanel: React.FC<Props> = ({ config, onChange }) => {
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const set = (key: keyof WheelConfig, val: any) => onChange({ ...config, [key]: val });

  const isMobilePreview = previewMode === 'mobile';
  const dialogWidth = isMobilePreview
    ? (config.postLoginDialogMobileWidth ?? config.postLoginDialogWidth ?? 400)
    : (config.postLoginDialogWidth ?? 400);
  const titleSize = isMobilePreview
    ? (config.postLoginDialogMobileTitleSize ?? config.postLoginDialogTitleSize ?? 20)
    : (config.postLoginDialogTitleSize ?? 20);
  const bodySize = isMobilePreview
    ? (config.postLoginDialogMobileBodySize ?? config.postLoginDialogBodySize ?? 14)
    : (config.postLoginDialogBodySize ?? 14);
  const btnFontSize = isMobilePreview
    ? (config.postLoginDialogMobileBtnFontSize ?? config.postLoginDialogBtnFontSize ?? 14)
    : (config.postLoginDialogBtnFontSize ?? 14);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">📋 Caixa de Diálogo Pós-Login</h3>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-xs text-muted-foreground">{config.postLoginDialogEnabled ? 'Ativa' : 'Inativa'}</span>
          <button
            onClick={() => set('postLoginDialogEnabled', !config.postLoginDialogEnabled)}
            className={`relative w-11 h-6 rounded-full transition-colors ${config.postLoginDialogEnabled ? 'bg-primary' : 'bg-white/10'}`}
          >
            <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${config.postLoginDialogEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </label>
      </div>

      {config.postLoginDialogEnabled && (
        <>
          <CollapsibleSection title="Conteúdo" defaultOpen>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Título</label>
              <input type="text" value={config.postLoginDialogTitle ?? ''} onChange={e => set('postLoginDialogTitle', e.target.value)} placeholder="Bem-vindo!" className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-foreground text-sm" />
              <div className="flex items-center gap-1 mt-1">
                <select value={config.postLoginDialogTitleFont ?? 'Inter'} onChange={e => set('postLoginDialogTitleFont', e.target.value)} className="flex-1 px-2 py-1 rounded border border-white/[0.08] text-xs" style={{ colorScheme: 'dark' }}>
                  {FONT_OPTIONS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                </select>
                <button onClick={() => set('postLoginDialogTitleBold', !config.postLoginDialogTitleBold)} className={`p-1.5 rounded ${config.postLoginDialogTitleBold ? 'bg-primary/30 text-primary' : 'text-muted-foreground hover:text-foreground'}`}><Bold size={13} /></button>
                <button onClick={() => set('postLoginDialogTitleItalic', !config.postLoginDialogTitleItalic)} className={`p-1.5 rounded ${config.postLoginDialogTitleItalic ? 'bg-primary/30 text-primary' : 'text-muted-foreground hover:text-foreground'}`}><Italic size={13} /></button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Mensagem (use Enter para quebrar linhas)</label>
              <textarea value={config.postLoginDialogBody ?? ''} onChange={e => set('postLoginDialogBody', e.target.value)} placeholder="Linha 1&#10;Linha 2&#10;Linha 3" rows={5} className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-foreground text-sm resize-y" />
              <div className="flex items-center gap-1 mt-1">
                <select value={config.postLoginDialogBodyFont ?? 'Inter'} onChange={e => set('postLoginDialogBodyFont', e.target.value)} className="flex-1 px-2 py-1 rounded border border-white/[0.08] text-xs" style={{ colorScheme: 'dark' }}>
                  {FONT_OPTIONS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                </select>
                <button onClick={() => set('postLoginDialogBodyBold', !config.postLoginDialogBodyBold)} className={`p-1.5 rounded ${config.postLoginDialogBodyBold ? 'bg-primary/30 text-primary' : 'text-muted-foreground hover:text-foreground'}`}><Bold size={13} /></button>
                <button onClick={() => set('postLoginDialogBodyItalic', !config.postLoginDialogBodyItalic)} className={`p-1.5 rounded ${config.postLoginDialogBodyItalic ? 'bg-primary/30 text-primary' : 'text-muted-foreground hover:text-foreground'}`}><Italic size={13} /></button>
              </div>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-xs text-muted-foreground">Alinhamento</span>
              <div className="flex gap-1">
                {(['left', 'center', 'right'] as const).map(a => (
                  <button key={a} onClick={() => set('postLoginDialogTextAlign', a)} className={`p-1.5 rounded ${(config.postLoginDialogTextAlign ?? 'left') === a ? 'bg-primary/30 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                    {a === 'left' ? <AlignLeft size={13} /> : a === 'center' ? <AlignCenter size={13} /> : <AlignRight size={13} />}
                  </button>
                ))}
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Botão de Link">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{config.postLoginDialogBtnEnabled !== false ? 'Ativo' : 'Inativo'}</span>
              <button onClick={() => set('postLoginDialogBtnEnabled', !(config.postLoginDialogBtnEnabled !== false))} className={`relative w-11 h-6 rounded-full transition-colors ${config.postLoginDialogBtnEnabled !== false ? 'bg-primary' : 'bg-white/10'}`}>
                <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${config.postLoginDialogBtnEnabled !== false ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
            {config.postLoginDialogBtnEnabled !== false && (
              <>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Texto do Botão</label>
                  <input type="text" value={config.postLoginDialogBtnText ?? ''} onChange={e => set('postLoginDialogBtnText', e.target.value)} placeholder="Acessar" className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-foreground text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">URL do Link</label>
                  <input type="url" value={config.postLoginDialogBtnUrl ?? ''} onChange={e => set('postLoginDialogBtnUrl', e.target.value)} placeholder="https://exemplo.com" className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-foreground text-sm" />
                </div>
                <ColorInput label="Cor do Botão" value={config.postLoginDialogBtnBgColor ?? '#0ABACC'} onChange={v => set('postLoginDialogBtnBgColor', v)} />
                <ColorInput label="Cor do Texto do Botão" value={config.postLoginDialogBtnTextColor ?? '#000000'} onChange={v => set('postLoginDialogBtnTextColor', v)} />
                <SliderInput label="Tamanho da Fonte do Botão" value={config.postLoginDialogBtnFontSize ?? 14} min={10} max={24} onChange={v => set('postLoginDialogBtnFontSize', v)} />
                <SliderInput label="Borda do Botão" value={config.postLoginDialogBtnBorderRadius ?? 8} min={0} max={30} onChange={v => set('postLoginDialogBtnBorderRadius', v)} />
              </>
            )}
          </CollapsibleSection>

          <CollapsibleSection title="Desktop" icon={<Monitor size={14} />}>
            <ColorInput label="Fundo" value={config.postLoginDialogBgColor ?? '#140c28'} onChange={v => set('postLoginDialogBgColor', v)} />
            <ColorInput label="Cor do Título" value={config.postLoginDialogTitleColor ?? '#ffffff'} onChange={v => set('postLoginDialogTitleColor', v)} />
            <ColorInput label="Cor do Texto" value={config.postLoginDialogTextColor ?? '#ffffffcc'} onChange={v => set('postLoginDialogTextColor', v)} />
            <ColorInput label="Cor da Borda" value={config.postLoginDialogBorderColor ?? '#ffffff14'} onChange={v => set('postLoginDialogBorderColor', v)} />
            <SliderInput label="Largura" value={config.postLoginDialogWidth ?? 400} min={280} max={600} onChange={v => set('postLoginDialogWidth', v)} />
            <SliderInput label="Tamanho do Título" value={config.postLoginDialogTitleSize ?? 20} min={12} max={36} onChange={v => set('postLoginDialogTitleSize', v)} />
            <SliderInput label="Tamanho do Texto" value={config.postLoginDialogBodySize ?? 14} min={10} max={24} onChange={v => set('postLoginDialogBodySize', v)} />
          </CollapsibleSection>

          <CollapsibleSection title="Mobile" icon={<Smartphone size={14} />}>
            <SliderInput label="Largura" value={config.postLoginDialogMobileWidth ?? config.postLoginDialogWidth ?? 400} min={250} max={400} onChange={v => set('postLoginDialogMobileWidth', v)} />
            <SliderInput label="Tamanho do Título" value={config.postLoginDialogMobileTitleSize ?? config.postLoginDialogTitleSize ?? 20} min={12} max={30} onChange={v => set('postLoginDialogMobileTitleSize', v)} />
            <SliderInput label="Tamanho do Texto" value={config.postLoginDialogMobileBodySize ?? config.postLoginDialogBodySize ?? 14} min={10} max={20} onChange={v => set('postLoginDialogMobileBodySize', v)} />
            <SliderInput label="Tamanho da Fonte do Botão" value={config.postLoginDialogMobileBtnFontSize ?? config.postLoginDialogBtnFontSize ?? 14} min={10} max={22} onChange={v => set('postLoginDialogMobileBtnFontSize', v)} />
          </CollapsibleSection>

          <CollapsibleSection title="Pré-visualização" icon={<Eye size={14} />} defaultOpen>
            <div className="flex justify-end gap-1 mb-2">
              <button onClick={() => setPreviewMode('desktop')} className={`p-1.5 rounded-md text-xs ${previewMode === 'desktop' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}><Monitor size={14} /></button>
              <button onClick={() => setPreviewMode('mobile')} className={`p-1.5 rounded-md text-xs ${previewMode === 'mobile' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}><Smartphone size={14} /></button>
            </div>
            <div className="flex items-center justify-center py-4" style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 12 }}>
              <div style={{
                width: Math.min(dialogWidth, isMobilePreview ? 300 : 380),
                background: config.postLoginDialogBgColor ?? '#140c28',
                border: `1px solid ${config.postLoginDialogBorderColor ?? '#ffffff14'}`,
                borderRadius: 12,
                padding: isMobilePreview ? 16 : 20,
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                transform: `scale(${isMobilePreview ? 0.85 : 0.9})`,
              }}>
                <div className="flex justify-end mb-1">
                  <span className="text-white/40 text-xs cursor-default">✕</span>
                </div>
                <h3 style={{
                  color: config.postLoginDialogTitleColor ?? '#ffffff',
                  fontSize: titleSize * 0.85,
                  fontWeight: config.postLoginDialogTitleBold !== false ? 700 : 400,
                  fontStyle: config.postLoginDialogTitleItalic ? 'italic' : 'normal',
                  fontFamily: config.postLoginDialogTitleFont ?? 'Inter',
                  textAlign: config.postLoginDialogTextAlign ?? 'left',
                  marginBottom: 8,
                }}>
                  {config.postLoginDialogTitle || 'Título do Diálogo'}
                </h3>
                <p style={{
                  color: config.postLoginDialogTextColor ?? '#ffffffcc',
                  fontSize: bodySize * 0.85,
                  lineHeight: 1.6,
                  fontWeight: config.postLoginDialogBodyBold ? 700 : 400,
                  fontStyle: config.postLoginDialogBodyItalic ? 'italic' : 'normal',
                  fontFamily: config.postLoginDialogBodyFont ?? 'Inter',
                  textAlign: config.postLoginDialogTextAlign ?? 'left',
                  whiteSpace: 'pre-wrap',
                  marginBottom: 14,
                }}>
                  {config.postLoginDialogBody || 'Mensagem de exemplo\npara o usuário...'}
                </p>
                {config.postLoginDialogBtnEnabled !== false && (config.postLoginDialogBtnText || config.postLoginDialogBtnUrl) && (
                  <button style={{
                    background: config.postLoginDialogBtnBgColor ?? '#0ABACC',
                    color: config.postLoginDialogBtnTextColor ?? '#000000',
                    fontSize: btnFontSize * 0.85,
                    fontWeight: 700,
                    border: 'none',
                    borderRadius: config.postLoginDialogBtnBorderRadius ?? 8,
                    padding: '8px 20px',
                    width: '100%',
                    cursor: 'pointer',
                  }}>
                    {config.postLoginDialogBtnText || 'Acessar'}
                  </button>
                )}
              </div>
            </div>
          </CollapsibleSection>
        </>
      )}

      {/* Auto-redirect section - independent from dialog */}
      <div className="border-t border-white/[0.06] pt-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <ExternalLink size={16} /> Redirecionamento Automático
          </h3>
          <button
            onClick={() => set('autoRedirectEnabled', !config.autoRedirectEnabled)}
            className={`relative w-11 h-6 rounded-full transition-colors ${config.autoRedirectEnabled ? 'bg-primary' : 'bg-white/10'}`}
          >
            <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${config.autoRedirectEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground mb-3">Abre um link invisível em nova aba após o usuário ver o prêmio.</p>
        {config.autoRedirectEnabled && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">URL do Link</label>
              <input
                type="url"
                value={config.autoRedirectUrl ?? ''}
                onChange={e => set('autoRedirectUrl', e.target.value)}
                placeholder="https://exemplo.com"
                className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-foreground text-sm"
              />
            </div>
            <SliderInput
              label="Atraso para abrir"
              value={config.autoRedirectDelaySec ?? 3}
              min={0}
              max={30}
              step={1}
              unit="s"
              onChange={v => set('autoRedirectDelaySec', v)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default DialogConfigPanel;