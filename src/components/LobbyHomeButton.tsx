import { Home } from 'lucide-react';
import { useEffect, useState } from 'react';

const LobbyHomeButton = () => {
  const [tag, setTag] = useState<string>('');

  useEffect(() => {
    try {
      const t = sessionStorage.getItem('lobby_tag') || '';
      setTag(t);
    } catch { /* ignore */ }
  }, []);

  if (!tag) return null;

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
