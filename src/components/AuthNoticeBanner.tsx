import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { X } from 'lucide-react';

interface AuthNotice {
  enabled: boolean;
  title: string;
  message: string;
  cta_text: string;
  cta_url: string;
  bg_color: string;
  text_color: string;
  cta_bg_color: string;
  cta_text_color: string;
}

interface Props {
  ownerId: string | null | undefined;
  /** If true, banner is shown only while the user is NOT authenticated yet. */
  onlyOnAuth?: boolean;
  /** When provided + onlyOnAuth, this should be true while user is unauthenticated. */
  isUnauthenticated?: boolean;
}

const AuthNoticeBanner = ({ ownerId, onlyOnAuth = false, isUnauthenticated = true }: Props) => {
  const [notice, setNotice] = useState<AuthNotice | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!ownerId) { setNotice(null); return; }
    (async () => {
      try {
        const { data } = await (supabase as any).rpc('get_auth_notice', { p_owner_id: ownerId });
        if (!alive) return;
        const row = Array.isArray(data) ? data[0] : data;
        setNotice(row || null);
      } catch {
        if (alive) setNotice(null);
      }
    })();
    return () => { alive = false; };
  }, [ownerId]);

  if (!notice?.enabled) return null;
  if (onlyOnAuth && !isUnauthenticated) return null;
  if (dismissed) return null;
  if (!notice.title && !notice.message && !notice.cta_text) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[60] shadow-lg"
      style={{ background: notice.bg_color, color: notice.text_color }}
      role="alert"
    >
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          {notice.title && (
            <div className="font-bold text-sm sm:text-base leading-tight">{notice.title}</div>
          )}
          {notice.message && (
            <div className="text-xs sm:text-sm opacity-95 mt-0.5 whitespace-pre-line">{notice.message}</div>
          )}
        </div>
        {notice.cta_text && notice.cta_url && (
          <a
            href={notice.cta_url}
            target={notice.cta_url.startsWith('http') ? '_blank' : undefined}
            rel="noopener noreferrer"
            className="flex-shrink-0 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold whitespace-nowrap transition hover:opacity-90"
            style={{ background: notice.cta_bg_color, color: notice.cta_text_color }}
          >
            {notice.cta_text}
          </a>
        )}
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 p-1 rounded hover:bg-black/10 transition"
          aria-label="Fechar aviso"
          style={{ color: notice.text_color }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default AuthNoticeBanner;
