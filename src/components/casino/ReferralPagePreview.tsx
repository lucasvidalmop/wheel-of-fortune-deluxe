import { useState } from 'react';
import { X, Eye, Minimize2, Maximize2 } from 'lucide-react';
import { ReferralPageConfig } from './ReferralPageEditor';

interface Props {
  config: ReferralPageConfig;
  linkLabel?: string;
}

const ReferralPagePreview = ({ config: cfg, linkLabel }: Props) => {
  const [open, setOpen] = useState(true);
  const [minimized, setMinimized] = useState(false);

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
    ? <img src={cfg.iconUrl} alt="icon" className="w-8 h-8 rounded-lg object-cover mx-auto" />
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
    <div className="rounded-xl border border-white/[0.1] bg-white/[0.02] overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-white/[0.04] border-b border-white/[0.06]">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Eye size={12} className="text-primary" /> Preview ao vivo
        </span>
        <div className="flex items-center gap-1">
          <button onClick={() => setMinimized(m => !m)} className="p-1 rounded hover:bg-white/[0.08] text-muted-foreground hover:text-foreground transition">
            {minimized ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
          </button>
          <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-white/[0.08] text-muted-foreground hover:text-foreground transition">
            <X size={12} />
          </button>
        </div>
      </div>

      {!minimized && (
        <div className="flex items-center justify-center py-6 px-4 relative" style={{ ...bgStyle, minHeight: 340 }}>
          {!cfg.bgImage && !cfg.bgColor && (
            <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, ${cfg.bgGradientFrom || 'rgba(80,20,120,0.3)'} 0%, ${cfg.bgGradientTo || 'rgba(10,5,30,0.9)'} 70%)` }} />
          )}
          <div
            className="relative z-10 w-full max-w-[260px] rounded-2xl p-4 space-y-3 border backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
            style={cardStyle}
          >
            <div className="text-center space-y-1">
              {icon}
              <h1 className="text-sm font-bold" style={titleStyle}>{displayTitle}</h1>
              <p className="text-[10px]" style={subtitleStyle}>
                {cfg.subtitleText || 'Informe seus dados para resgatar 1 giro(s)'}
              </p>
              {cfg.showCounter && (
                <p className="text-[9px]" style={{ color: 'rgba(156,163,175,0.6)' }}>0/100 resgates</p>
              )}
            </div>

            <div className="space-y-2">
              {['E-mail', 'ID da Conta', 'CPF'].map(label => (
                <div key={label}>
                  <label className="block text-[9px] font-medium mb-0.5" style={labelStyle}>{label} *</label>
                  <div className="w-full px-2.5 py-1.5 rounded-lg border text-[10px]" style={inputStyle}>
                    <span style={{ opacity: 0.35 }}>{label === 'CPF' ? '000.000.000-00' : label === 'E-mail' ? 'seu@email.com' : 'Seu ID'}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="w-full py-2 rounded-lg font-bold text-[10px] text-center" style={btnStyle}>
              {cfg.btnText || '🎯 Resgatar Giro'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReferralPagePreview;
