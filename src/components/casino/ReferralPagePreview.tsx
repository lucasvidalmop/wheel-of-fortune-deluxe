import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Eye, Minimize2, Maximize2, GripVertical, ZoomIn, ZoomOut } from 'lucide-react';
import { ReferralPageConfig } from './ReferralPageEditor';

interface Props {
  config: ReferralPageConfig;
  linkLabel?: string;
}

const ReferralPagePreview = ({ config: cfg, linkLabel }: Props) => {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 20, y: 80 });
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const boxRef = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.preventDefault();
  }, [pos]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setPos({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const bgStyle: React.CSSProperties = {
    background: cfg.bgColor || `radial-gradient(ellipse at center, ${cfg.bgGradientFrom || 'rgba(80,20,120,0.3)'} 0%, ${cfg.bgGradientTo || 'rgba(10,5,30,0.9)'} 70%)`,
    ...(cfg.bgImage ? { backgroundImage: `url(${cfg.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}),
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: cfg.cardBgColor || 'rgba(255,255,255,0.04)',
    borderColor: cfg.cardBorderColor || 'rgba(255,255,255,0.08)',
  };

  const inputStyle: React.CSSProperties = {
    backgroundColor: cfg.inputBgColor || 'rgba(255,255,255,0.04)',
    borderColor: cfg.inputBorderColor || 'rgba(255,255,255,0.1)',
    color: cfg.inputTextColor || '#e8dcc8',
  };

  const btnStyle: React.CSSProperties = {
    backgroundColor: cfg.btnBgColor || 'hsl(var(--primary))',
    color: cfg.btnTextColor || 'hsl(var(--primary-foreground))',
  };

  const titleStyle: React.CSSProperties = cfg.titleColor ? { color: cfg.titleColor } : { color: '#e8dcc8' };
  const subtitleStyle: React.CSSProperties = cfg.subtitleColor ? { color: cfg.subtitleColor } : { color: '#9ca3af' };
  const labelStyle: React.CSSProperties = cfg.labelColor ? { color: cfg.labelColor } : { color: '#9ca3af' };

  const icon = cfg.iconUrl
    ? <img src={cfg.iconUrl} alt="icon" className="max-w-[120px] max-h-[60px] rounded-lg object-contain mx-auto" />
    : <div className="text-2xl">{cfg.iconEmoji || '🎰'}</div>;

  const titleText = cfg.titleText || linkLabel || 'Resgatar Giro';
  const displayTitle = cfg.titlePrefix ? `${cfg.titlePrefix} ${titleText}` : titleText;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm font-medium hover:bg-white/[0.08] transition flex items-center justify-center gap-2"
      >
        <Eye size={15} /> Mostrar Preview
      </button>
    );
  }

  return (
    <>
      {/* Inline placeholder so the button space remains */}
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="w-full py-2.5 rounded-xl border border-primary/20 bg-primary/5 text-primary text-sm font-medium hover:bg-primary/10 transition flex items-center justify-center gap-2"
      >
        <Eye size={15} /> Fechar Preview
      </button>

      {/* Floating draggable preview */}
      <div
        ref={boxRef}
        className="fixed z-[65] rounded-2xl border border-white/[0.12] bg-background shadow-[0_12px_48px_rgba(0,0,0,0.6)] overflow-hidden"
        style={{ left: pos.x, top: pos.y, width: minimized ? 220 : 300 * scale, pointerEvents: 'auto' }}
      >
        {/* Drag handle header */}
        <div
          onMouseDown={onMouseDown}
          className="flex items-center justify-between px-3 py-2 bg-white/[0.06] border-b border-white/[0.08] cursor-grab active:cursor-grabbing select-none"
        >
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <GripVertical size={12} className="text-muted-foreground/50" />
            <Eye size={11} className="text-primary" /> Preview
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setScale(s => Math.max(0.6, s - 0.15))} className="p-1 rounded hover:bg-white/[0.1] text-muted-foreground hover:text-foreground transition" title="Diminuir">
              <ZoomOut size={11} />
            </button>
            <span className="text-[9px] text-muted-foreground font-mono w-7 text-center">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale(s => Math.min(2, s + 0.15))} className="p-1 rounded hover:bg-white/[0.1] text-muted-foreground hover:text-foreground transition" title="Aumentar">
              <ZoomIn size={11} />
            </button>
            <button onClick={() => setMinimized(m => !m)} className="p-1 rounded hover:bg-white/[0.1] text-muted-foreground hover:text-foreground transition">
              {minimized ? <Maximize2 size={11} /> : <Minimize2 size={11} />}
            </button>
            <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-white/[0.1] text-muted-foreground hover:text-foreground transition">
              <X size={11} />
            </button>
          </div>
        </div>

        {!minimized && (
          <div className="flex items-center justify-center py-5 px-3 relative" style={{ ...bgStyle, minHeight: 300 }}>
            {!cfg.bgImage && !cfg.bgColor && (
              <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, ${cfg.bgGradientFrom || 'rgba(80,20,120,0.3)'} 0%, ${cfg.bgGradientTo || 'rgba(10,5,30,0.9)'} 70%)` }} />
            )}
            <div
              className="relative z-10 w-full max-w-[240px] rounded-2xl p-3.5 space-y-2.5 border backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
              style={cardStyle}
            >
              <div className="text-center space-y-1">
                {icon}
                <h1 className="text-xs font-bold" style={titleStyle}>{displayTitle}</h1>
                <p className="text-[9px]" style={subtitleStyle}>
                  {cfg.subtitleText || 'Informe seus dados para resgatar 1 giro(s)'}
                </p>
                {cfg.showCounter && (
                  <p className="text-[8px]" style={{ color: 'rgba(156,163,175,0.6)' }}>0/100 resgates</p>
                )}
              </div>

              <div className="space-y-1.5">
                {['E-mail', 'ID da Conta', 'CPF'].map(label => (
                  <div key={label}>
                    <label className="block text-[8px] font-medium mb-0.5" style={labelStyle}>{label} *</label>
                    <div className="w-full px-2 py-1 rounded border text-[9px]" style={inputStyle}>
                      <span style={{ opacity: 0.35 }}>{label === 'CPF' ? '000.000.000-00' : label === 'E-mail' ? 'seu@email.com' : 'Seu ID'}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="w-full py-1.5 rounded-lg font-bold text-[9px] text-center" style={btnStyle}>
                {cfg.btnText || '🎯 Resgatar Giro'}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ReferralPagePreview;
