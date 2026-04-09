import { useState } from 'react';
import { X, Eye } from 'lucide-react';
import { ReferralPageConfig, defaultPageConfig } from './ReferralPageEditor';

interface Props {
  config: ReferralPageConfig;
  linkLabel?: string;
}

const ReferralPagePreview = ({ config: cfg, linkLabel }: Props) => {
  const [open, setOpen] = useState(false);

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
    ? <img src={cfg.iconUrl} alt="icon" className="w-10 h-10 rounded-lg object-cover mx-auto" />
    : <div className="text-3xl">{cfg.iconEmoji || '🎰'}</div>;

  const titleText = cfg.titleText || linkLabel || 'Resgatar Giro';
  const displayTitle = cfg.titlePrefix ? `${cfg.titlePrefix} ${titleText}` : titleText;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full py-3 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm font-medium hover:bg-white/[0.08] transition flex items-center justify-center gap-2"
      >
        <Eye size={15} /> Pré-visualizar
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl border border-white/[0.1]">
            {/* Close button */}
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 z-20 p-2 rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 transition"
            >
              <X size={16} />
            </button>
            <div className="text-[10px] absolute top-3 left-3 z-20 px-2 py-1 rounded-full bg-black/50 backdrop-blur-sm text-white/70 font-medium">
              PREVIEW
            </div>

            {/* Preview content */}
            <div className="flex items-center justify-center min-h-[500px] relative" style={bgStyle}>
              {!cfg.bgImage && !cfg.bgColor && (
                <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, ${cfg.bgGradientFrom || 'rgba(80,20,120,0.3)'} 0%, ${cfg.bgGradientTo || 'rgba(10,5,30,0.9)'} 70%)` }} />
              )}
              <div
                className="relative z-10 w-full max-w-xs mx-4 rounded-2xl p-5 space-y-4 border backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
                style={cardStyle}
              >
                <div className="text-center space-y-1.5">
                  {icon}
                  <h1 className="text-base font-bold" style={titleStyle}>{displayTitle}</h1>
                  <p className="text-xs" style={subtitleStyle}>
                    {cfg.subtitleText || 'Informe seus dados para resgatar 1 giro(s)'}
                  </p>
                  {cfg.showCounter && (
                    <p className="text-[10px]" style={{ color: 'rgba(156,163,175,0.6)' }}>0/100 resgates realizados</p>
                  )}
                </div>

                <div className="space-y-2.5">
                  <div>
                    <label className="block text-[10px] font-medium mb-0.5" style={labelStyle}>E-mail *</label>
                    <div className="w-full px-3 py-2 rounded-lg border text-xs" style={inputStyle}>
                      <span style={{ opacity: 0.4 }}>seu@email.com</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium mb-0.5" style={labelStyle}>ID da Conta *</label>
                    <div className="w-full px-3 py-2 rounded-lg border text-xs" style={inputStyle}>
                      <span style={{ opacity: 0.4 }}>Seu ID</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium mb-0.5" style={labelStyle}>CPF *</label>
                    <div className="w-full px-3 py-2 rounded-lg border text-xs" style={inputStyle}>
                      <span style={{ opacity: 0.4 }}>000.000.000-00</span>
                    </div>
                  </div>
                </div>

                <div
                  className="w-full py-2.5 rounded-lg font-bold text-xs text-center"
                  style={btnStyle}
                >
                  {cfg.btnText || '🎯 Resgatar Giro'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ReferralPagePreview;
