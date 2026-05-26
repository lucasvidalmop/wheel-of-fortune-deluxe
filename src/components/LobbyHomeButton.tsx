import { Home } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

// Routes where we never show the back-to-lobby button (operator/admin areas).
const HIDDEN_PATHS = [/^\/$/, /^\/admin/, /^\/dashboard/, /^\/unsubscribe/];

const cache = new Map<string, string>(); // path -> lobbyTag ("" means none)

const LobbyHomeButton = () => {
  const location = useLocation();
  const [tag, setTag] = useState<string>('');

  useEffect(() => {
    const path = location.pathname;

    if (HIDDEN_PATHS.some((re) => re.test(path))) { setTag(''); return; }
    // Hide on the lobby page itself
    if (/^\/lobby=/.test(path)) { setTag(''); return; }

    // Quick cache hit
    if (cache.has(path)) { setTag(cache.get(path) || ''); return; }

    // Seed from sessionStorage so it shows immediately while we resolve.
    try {
      const cached = sessionStorage.getItem('lobby_tag') || '';
      setTag(cached);
    } catch { /* ignore */ }

    let alive = true;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke('resolve-lobby', { body: { path } });
        if (!alive) return;
        const resolved = (data?.lobbyTag as string) || '';
        cache.set(path, resolved);
        setTag(resolved);
        try {
          if (resolved) sessionStorage.setItem('lobby_tag', resolved);
          else sessionStorage.removeItem('lobby_tag');
        } catch { /* ignore */ }
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [location.pathname]);

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
