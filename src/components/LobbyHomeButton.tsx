import { Home } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const HIDDEN_PATHS = [/^\/$/, /^\/admin/, /^\/dashboard/, /^\/unsubscribe/, /^\/ref\//, /^\/gorjeta/, /^\/influencer/];

const LobbyHomeButton = () => {
  const location = useLocation();
  const [tag, setTag] = useState<string>('');

  useEffect(() => {
    try {
      setTag(sessionStorage.getItem('lobby_tag') || '');
    } catch { /* ignore */ }
  }, [location.pathname]);

  if (!tag) return null;
  // Hide on the lobby page itself and on pages that don't belong to operator-facing flow.
  if (location.pathname === `/lobby=${tag}`) return null;
  if (HIDDEN_PATHS.some((re) => re.test(location.pathname))) return null;

  return (
    <a
      href={`/lobby=${tag}`}
      aria-label="Voltar ao lobby"
      className="fixed top-3 left-3 z-[100] flex items-center gap-1.5 px-3 py-2 rounded-full bg-black/60 hover:bg-black/80 text-white text-xs font-semibold backdrop-blur-md border border-white/15 shadow-lg transition-colors"
    >
      <Home size={14} />
      <span>Lobby</span>
    </a>
  );
};

export default LobbyHomeButton;
