import React, { useState } from 'react';
import { WheelConfig } from './types';
import { Monitor, Smartphone, Eye } from 'lucide-react';

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
          {/* Content */}
          <div className="space-y-3 border border-white/[0.06] rounded-xl p-3 bg-white/[0.02]">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Conteúdo</h4>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Título</label>
              <input
                type="text"
                value={config.postLoginDialogTitle ?? ''}
                onChange={e => set('postLoginDialogTitle', e.target.value)}
                placeholder="Bem-vindo!"
                className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-foreground text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Mensagem</label>
              <textarea
                value={config.postLoginDialogBody ?? ''}
                onChange={e => set('postLoginDialogBody', e.target.value)}
                placeholder="Sua mensagem aqui..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-foreground text-sm resize-none"
              />
            </div>
          </div>

          {/* Link Button */}
          <div className="space-y-3 border border-white/[0.06] rounded-xl p-3 bg-white/[0.02]">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Botão de Link</h4>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-muted-foreground">{config.postLoginDialogBtnEnabled !== false ? 'Ativo' : 'Inativo'}</span>
                <button
                  onClick={() => set('postLoginDialogBtnEnabled', !(config.postLoginDialogBtnEnabled !== false))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${config.postLoginDialogBtnEnabled !== false ? 'bg-primary' : 'bg-white/10'}`}
                >
                  <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${config.postLoginDialogBtnEnabled !== false ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </label>
            </div>
            {config.postLoginDialogBtnEnabled !== false && (
              <>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Texto do Botão</label>
                  <input
                    type="text"
                    value={config.postLoginDialogBtnText ?? ''}
                    onChange={e => set('postLoginDialogBtnText', e.target.value)}
                    placeholder="Acessar"
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-foreground text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">URL do Link</label>
                  <input
                    type="url"
                    value={config.postLoginDialogBtnUrl ?? ''}
                    onChange={e => set('postLoginDialogBtnUrl', e.target.value)}
                    placeholder="https://exemplo.com"
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-foreground text-sm"
                  />
                </div>
                <ColorInput label="Cor do Botão" value={config.postLoginDialogBtnBgColor ?? '#0ABACC'} onChange={v => set('postLoginDialogBtnBgColor', v)} />
                <ColorInput label="Cor do Texto do Botão" value={config.postLoginDialogBtnTextColor ?? '#000000'} onChange={v => set('postLoginDialogBtnTextColor', v)} />
                <SliderInput label="Tamanho da Fonte do Botão" value={config.postLoginDialogBtnFontSize ?? 14} min={10} max={24} onChange={v => set('postLoginDialogBtnFontSize', v)} />
                <SliderInput label="Borda do Botão" value={config.postLoginDialogBtnBorderRadius ?? 8} min={0} max={30} onChange={v => set('postLoginDialogBtnBorderRadius', v)} />
              </>
            )}
          </div>

          {/* Visual Desktop */}
          <div className="space-y-3 border border-white/[0.06] rounded-xl p-3 bg-white/[0.02]">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Monitor size={14} /> Desktop</h4>
            <ColorInput label="Fundo" value={config.postLoginDialogBgColor ?? '#140c28'} onChange={v => set('postLoginDialogBgColor', v)} />
            <ColorInput label="Cor do Título" value={config.postLoginDialogTitleColor ?? '#ffffff'} onChange={v => set('postLoginDialogTitleColor', v)} />
            <ColorInput label="Cor do Texto" value={config.postLoginDialogTextColor ?? '#ffffffcc'} onChange={v => set('postLoginDialogTextColor', v)} />
            <ColorInput label="Cor da Borda" value={config.postLoginDialogBorderColor ?? '#ffffff14'} onChange={v => set('postLoginDialogBorderColor', v)} />
            <SliderInput label="Largura" value={config.postLoginDialogWidth ?? 400} min={280} max={600} onChange={v => set('postLoginDialogWidth', v)} />
            <SliderInput label="Tamanho do Título" value={config.postLoginDialogTitleSize ?? 20} min={12} max={36} onChange={v => set('postLoginDialogTitleSize', v)} />
            <SliderInput label="Tamanho do Texto" value={config.postLoginDialogBodySize ?? 14} min={10} max={24} onChange={v => set('postLoginDialogBodySize', v)} />
          </div>

          {/* Visual Mobile */}
          <div className="space-y-3 border border-white/[0.06] rounded-xl p-3 bg-white/[0.02]">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Smartphone size={14} /> Mobile</h4>
            <SliderInput label="Largura" value={config.postLoginDialogMobileWidth ?? config.postLoginDialogWidth ?? 400} min={250} max={400} onChange={v => set('postLoginDialogMobileWidth', v)} />
            <SliderInput label="Tamanho do Título" value={config.postLoginDialogMobileTitleSize ?? config.postLoginDialogTitleSize ?? 20} min={12} max={30} onChange={v => set('postLoginDialogMobileTitleSize', v)} />
            <SliderInput label="Tamanho do Texto" value={config.postLoginDialogMobileBodySize ?? config.postLoginDialogBodySize ?? 14} min={10} max={20} onChange={v => set('postLoginDialogMobileBodySize', v)} />
            <SliderInput label="Tamanho da Fonte do Botão" value={config.postLoginDialogMobileBtnFontSize ?? config.postLoginDialogBtnFontSize ?? 14} min={10} max={22} onChange={v => set('postLoginDialogMobileBtnFontSize', v)} />
          </div>

          {/* Preview */}
          <div className="space-y-2 border border-white/[0.06] rounded-xl p-3 bg-white/[0.02]">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Eye size={14} /> Pré-visualização</h4>
              <div className="flex gap-1">
                <button onClick={() => setPreviewMode('desktop')} className={`p-1.5 rounded-md text-xs ${previewMode === 'desktop' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}><Monitor size={14} /></button>
                <button onClick={() => setPreviewMode('mobile')} className={`p-1.5 rounded-md text-xs ${previewMode === 'mobile' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}><Smartphone size={14} /></button>
              </div>
            </div>

            <div className="flex items-center justify-center py-4" style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 12 }}>
              <div
                style={{
                  width: Math.min(dialogWidth, isMobilePreview ? 300 : 380),
                  background: config.postLoginDialogBgColor ?? '#140c28',
                  border: `1px solid ${config.postLoginDialogBorderColor ?? '#ffffff14'}`,
                  borderRadius: 12,
                  padding: isMobilePreview ? 16 : 20,
                  boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                  transform: `scale(${isMobilePreview ? 0.85 : 0.9})`,
                }}
              >
                {/* Close X */}
                <div className="flex justify-end mb-1">
                  <span className="text-white/40 text-xs cursor-default">✕</span>
                </div>
                <h3 style={{ color: config.postLoginDialogTitleColor ?? '#ffffff', fontSize: titleSize * 0.85, fontWeight: 700, marginBottom: 8 }}>
                  {config.postLoginDialogTitle || 'Título do Diálogo'}
                </h3>
                <p style={{ color: config.postLoginDialogTextColor ?? '#ffffffcc', fontSize: bodySize * 0.85, lineHeight: 1.5, marginBottom: 14 }}>
                  {config.postLoginDialogBody || 'Mensagem de exemplo para o usuário...'}
                </p>
                {config.postLoginDialogBtnEnabled !== false && (config.postLoginDialogBtnText || config.postLoginDialogBtnUrl) && (
                  <button
                    style={{
                      background: config.postLoginDialogBtnBgColor ?? '#0ABACC',
                      color: config.postLoginDialogBtnTextColor ?? '#000000',
                      fontSize: btnFontSize * 0.85,
                      fontWeight: 700,
                      border: 'none',
                      borderRadius: config.postLoginDialogBtnBorderRadius ?? 8,
                      padding: '8px 20px',
                      width: '100%',
                      cursor: 'pointer',
                    }}
                  >
                    {config.postLoginDialogBtnText || 'Acessar'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DialogConfigPanel;
