import LobbyPromoCard, { ProductKey } from './LobbyPromoCard';

export interface PromoCard {
  key: ProductKey;
  enabled: boolean;
  title: string;
  subtitle?: string;
  image_url?: string;
  href?: string;
  order?: number;
}

interface Props {
  title?: string;
  description?: string;
  greeting?: string;
  cards: PromoCard[];
  footerText?: string;
  onOpenProduct: (key: ProductKey) => void;
}

const productBadge: Record<ProductKey, string> = {
  roleta: 'Jackpot',
  apostas: 'Esportes',
  luckybox: 'Caixas',
  batalha: 'Ao vivo',
};

const LobbyHome = ({ title, description, greeting, cards, footerText, onOpenProduct }: Props) => {
  const featured = cards[0];
  const rest = cards.slice(1);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pt-5 sm:pt-8 pb-8">
      {/* Greeting + headline */}
      <div className="mb-5 sm:mb-8">
        {greeting && (
          <div
            className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-white/55 mb-2"
            style={{ fontFamily: 'var(--lobby-font-body, Barlow), sans-serif' }}
          >
            <span className="h-px w-6 bg-white/40" /> {greeting}
          </div>
        )}
        <h1
          className="text-white leading-[0.92]"
          style={{
            fontFamily: 'var(--lobby-font-heading, Bebas Neue), sans-serif',
            fontSize: 'clamp(36px, 9vw, 84px)',
            letterSpacing: '0.01em',
          }}
        >
          {title || 'Central de promoções'}
        </h1>
        {description && (
          <p
            className="mt-2.5 text-white/65 text-sm sm:text-base max-w-xl"
            style={{ fontFamily: 'var(--lobby-font-body, Barlow), sans-serif' }}
          >
            {description}
          </p>
        )}
      </div>

      {cards.length === 0 ? (
        <div
          className="text-center text-white/60 py-16 border border-dashed border-white/15 rounded-3xl"
          style={{ fontFamily: 'var(--lobby-font-body, Barlow), sans-serif' }}
        >
          Nenhuma promoção configurada.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-5">
          {featured && (
            <div className="sm:col-span-2">
              <LobbyPromoCard
                product={featured.key}
                title={featured.title}
                subtitle={featured.subtitle}
                imageUrl={featured.image_url}
                badge={productBadge[featured.key]}
                external={false}
                featured
                onClick={() => onOpenProduct(featured.key)}
              />
            </div>
          )}
          {rest.map((card) => (
            <LobbyPromoCard
              key={card.key}
              product={card.key}
              title={card.title}
              subtitle={card.subtitle}
              imageUrl={card.image_url}
              badge={productBadge[card.key]}
              external={card.key === 'batalha'}
              onClick={() => onOpenProduct(card.key)}
            />
          ))}
        </div>
      )}

      {footerText && (
        <footer
          className="mt-10 pt-5 border-t border-white/10 text-center text-white/40 text-[11px] uppercase tracking-[0.22em]"
          style={{ fontFamily: 'var(--lobby-font-body, Barlow), sans-serif' }}
        >
          {footerText}
        </footer>
      )}
    </div>
  );
};

export default LobbyHome;
