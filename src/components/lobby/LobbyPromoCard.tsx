import { ArrowRight, ExternalLink } from 'lucide-react';
import { optimizedImage } from '@/lib/imageUrl';

export type ProductKey = 'roleta' | 'batalha' | 'luckybox' | 'apostas';

interface Props {
  product: ProductKey;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  badge?: string;
  external?: boolean;
  featured?: boolean;
  onClick: () => void;
}

const meta: Record<ProductKey, { icon: string; accent: string }> = {
  roleta: { icon: '🎰', accent: 'from-amber-500/35 to-orange-700/10' },
  apostas: { icon: '⚽', accent: 'from-emerald-500/35 to-sky-700/10' },
  luckybox: { icon: '🎁', accent: 'from-fuchsia-500/35 to-purple-700/10' },
  batalha: { icon: '⚔️', accent: 'from-rose-500/35 to-red-700/10' },
};

const LobbyPromoCard = ({ product, title, subtitle, imageUrl, badge, external, featured, onClick }: Props) => {
  const m = meta[product];
  const imgWidth = featured ? 900 : 600;
  const imgHeight = Math.round(imgWidth / (16 / 9));
  const img = imageUrl ? (optimizedImage(imageUrl, { width: imgWidth, quality: 78 }) || imageUrl) : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`lobby-tap group relative w-full text-left overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] hover:border-white/25 hover:bg-white/[0.07] ${featured ? 'min-h-[260px] sm:min-h-[320px]' : 'min-h-[140px] sm:min-h-[160px]'}`}
    >
      {img ? (
        <img
          src={img}
          alt={title}
          width={imgWidth}
          height={imgHeight}
          loading="lazy"
          className={`absolute inset-0 h-full w-full object-cover ${featured ? 'opacity-80' : 'opacity-65'} group-hover:scale-[1.04] transition-transform duration-700`}
        />
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-br ${m.accent}`}>
          <div className="absolute inset-0 flex items-center justify-center text-7xl sm:text-8xl opacity-50">
            {m.icon}
          </div>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/10" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />

      <div className={`relative z-10 h-full flex flex-col justify-between ${featured ? 'p-5 sm:p-7' : 'p-4 sm:p-5'}`}>
        <div className="flex items-start justify-between gap-2">
          {badge && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] font-semibold text-white"
              style={{ fontFamily: 'var(--lobby-font-body, Barlow), sans-serif' }}
            >
              <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: 'var(--lobby-primary, #fff)' }} />
              {badge}
            </span>
          )}
          {external && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-black/40 border border-white/15 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-white/70"
              style={{ fontFamily: 'var(--lobby-font-body, Barlow), sans-serif' }}
            >
              <ExternalLink size={10} /> Nova aba
            </span>
          )}
        </div>

        <div>
          <h3
            className="text-white leading-[0.92]"
            style={{
              fontFamily: 'var(--lobby-font-heading, Bebas Neue), sans-serif',
              fontSize: featured ? 'clamp(34px, 8vw, 56px)' : 'clamp(24px, 5.6vw, 34px)',
              letterSpacing: '0.01em',
            }}
          >
            {title}
          </h3>
          {subtitle && (
            <p
              className={`mt-1.5 text-white/75 ${featured ? 'text-sm sm:text-base max-w-md' : 'text-xs sm:text-sm line-clamp-2'}`}
              style={{ fontFamily: 'var(--lobby-font-body, Barlow), sans-serif' }}
            >
              {subtitle}
            </p>
          )}
          <div
            className="mt-3 inline-flex items-center gap-2 text-white text-[11px] uppercase tracking-[0.22em] font-bold group-hover:gap-3 transition-all"
            style={{ fontFamily: 'var(--lobby-font-body, Barlow), sans-serif' }}
          >
            <span style={{ color: 'var(--lobby-primary, #00d4ff)' }}>Acessar</span>
            <ArrowRight size={14} style={{ color: 'var(--lobby-primary, #00d4ff)' }} />
          </div>
        </div>
      </div>
    </button>
  );
};

export default LobbyPromoCard;
