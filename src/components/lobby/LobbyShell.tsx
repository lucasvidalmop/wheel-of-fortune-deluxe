import { ReactNode, CSSProperties, useMemo } from 'react';
import { optimizedImage } from '@/lib/imageUrl';
import LobbyHeader from './LobbyHeader';
import LobbyBottomNav, { LobbyTab } from './LobbyBottomNav';
import type { LobbySession } from '@/lib/lobbySession';

export interface LobbyTheme {
  primary?: string;
  bg_color?: string;
  text_color?: string;
  heading_font?: string;
  body_font?: string;
  overlay_strength?: number;
}

interface LobbyShellProps {
  theme: LobbyTheme;
  bgImageUrl?: string;
  logoUrl?: string;
  session: LobbySession | null;
  coins?: number | null;
  coinIconUrl?: string;
  activeTab: LobbyTab;
  onTabChange: (tab: LobbyTab) => void;
  /** Hides bottom nav (login screen) */
  hideNav?: boolean;
  /** Hides header (login screen) */
  hideHeader?: boolean;
  children: ReactNode;
}

const LobbyShell = ({
  theme,
  bgImageUrl,
  logoUrl,
  session,
  coins,
  coinIconUrl,
  activeTab,
  onTabChange,
  hideNav = false,
  hideHeader = false,
  children,
}: LobbyShellProps) => {
  const primary = theme.primary || '#00d4ff';
  const bgColor = theme.bg_color || '#0a0a0f';
  const textColor = theme.text_color || '#ffffff';
  const headingFont = theme.heading_font || 'Bebas Neue';
  const bodyFont = theme.body_font || 'Barlow';
  const overlay = Math.max(0, Math.min(100, theme.overlay_strength ?? 65)) / 100;
  const bg = useMemo(() => optimizedImage(bgImageUrl, { width: 1920, quality: 70 }), [bgImageUrl]);

  const style: CSSProperties = {
    background: bgColor,
    color: textColor,
    fontFamily: `${bodyFont}, sans-serif`,
    ['--lobby-primary' as any]: primary,
    ['--lobby-bg' as any]: bgColor,
    ['--lobby-text' as any]: textColor,
    ['--lobby-font-heading' as any]: `${headingFont}, sans-serif`,
    ['--lobby-font-body' as any]: `${bodyFont}, sans-serif`,
  };

  return (
    <div className="lobby-scope min-h-[100dvh] w-full relative" style={style}>
      {bg && (
        <div
          aria-hidden
          className="fixed inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${bg})` }}
        />
      )}
      <div
        aria-hidden
        className="fixed inset-0"
        style={{
          background: `linear-gradient(to bottom, rgba(0,0,0,${overlay * 0.75}), rgba(0,0,0,${overlay}), rgba(0,0,0,${Math.min(1, overlay * 1.35)}))`,
        }}
      />

      <div className="relative z-10 flex min-h-[100dvh] flex-col">
        {!hideHeader && (
          <LobbyHeader logoUrl={logoUrl} session={session} coins={coins} coinIconUrl={coinIconUrl} onProfile={() => onTabChange('perfil')} />
        )}

        <main className={`flex-1 w-full ${hideNav ? '' : 'mb-safe-nav'}`}>
          {children}
        </main>

        {!hideNav && (
          <LobbyBottomNav active={activeTab} onChange={onTabChange} />
        )}
      </div>
    </div>
  );
};

export default LobbyShell;
