import { Home, UserCircle2 } from 'lucide-react';

export type LobbyTab = 'home' | 'perfil';

interface Props {
  active: LobbyTab;
  onChange: (tab: LobbyTab) => void;
}

const tabs: { key: LobbyTab; label: string; Icon: typeof Home }[] = [
  { key: 'home', label: 'Início', Icon: Home },
  { key: 'perfil', label: 'Perfil', Icon: UserCircle2 },
];

const LobbyBottomNav = ({ active, onChange }: Props) => (
  <nav
    aria-label="Navegação principal"
    className="fixed bottom-0 inset-x-0 z-40 backdrop-blur-xl bg-black/55 border-t border-white/10 pb-safe"
    style={{ fontFamily: 'var(--lobby-font-body, Barlow), sans-serif' }}
  >
    <ul className="mx-auto w-full max-w-xs grid grid-cols-2">
      {tabs.map(({ key, label, Icon }) => {
        const isActive = active === key;
        return (
          <li key={key} className="flex">
            <button
              type="button"
              onClick={() => onChange(key)}
              aria-current={isActive ? 'page' : undefined}
              className="lobby-tap flex-1 flex flex-col items-center justify-center gap-1 py-2.5 px-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{
                color: isActive ? 'var(--lobby-primary, #00d4ff)' : 'rgba(255,255,255,0.55)',
              }}
            >
              <span
                className="inline-flex items-center justify-center h-9 w-9 rounded-full transition"
                style={{
                  background: isActive ? 'color-mix(in srgb, var(--lobby-primary, #00d4ff) 18%, transparent)' : 'transparent',
                }}
              >
                <Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
              </span>
              {label}
            </button>
          </li>
        );
      })}
    </ul>
  </nav>
);

export default LobbyBottomNav;
