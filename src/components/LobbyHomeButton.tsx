import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

// Routes where we never show the back-to-lobby button (operator/admin areas + lobby itself).
const HIDDEN_PATHS = [/^\/$/, /^\/admin/, /^\/dashboard/, /^\/unsubscribe/];

const cache = new Map<string, string>(); // path -> lobbyTag ("" means none)
const SS_PREFIX = 'lobby_tag_for:'; // sessionStorage cache key per path

const LobbyHomeButton = () => {
  const location = useLocation();
  const [tag, setTag] = useState<string>('');

  useEffect(() => {
    const path = location.pathname;

    if (HIDDEN_PATHS.some((re) => re.test(path))) { setTag(''); return; }
    // Hide on the lobby page itself (any casing / nested form)
    if (path.toLowerCase().includes('lobby=')) { setTag(''); return; }

    // 1) In-memory cache (instant, no network)
    if (cache.has(path)) { setTag(cache.get(path) || ''); return; }

    // 2) sessionStorage cache per-path — persists across navigations & reloads in the tab.
    //    If we already resolved this exact path in this session, skip the edge function entirely.
    try {
      const ssKey = SS_PREFIX + path;
      const stored = sessionStorage.getItem(ssKey);
      if (stored !== null) {
        cache.set(path, stored);
        setTag(stored);
        return;
      }
    } catch { /* ignore */ }

    // 3) Optimistic: show last-known global tag while resolving (avoids flicker on first load)
    try {
      const hint = sessionStorage.getItem('lobby_tag') || '';
      if (hint) setTag(hint);
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
          sessionStorage.setItem(SS_PREFIX + path, resolved);
          if (resolved) sessionStorage.setItem('lobby_tag', resolved);
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
      className="group fixed top-3 left-3 z-[100] inline-flex items-center gap-2 pl-3 pr-4 py-2 rounded-full text-[12px] font-semibold tracking-wide text-white/95 bg-gradient-to-br from-white/15 to-white/[0.04] hover:from-white/25 hover:to-white/10 backdrop-blur-xl border border-white/20 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)] transition-all duration-200 active:scale-95"
    >
      <span className="grid place-items-center w-5 h-5 rounded-full bg-white/15 group-hover:bg-white/25 transition-colors">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </span>
      <span>Lobby</span>
    </a>
  );
};

export default LobbyHomeButton;
