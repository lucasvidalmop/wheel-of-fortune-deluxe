import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, LogOut, Wallet, X, Check, Clock, Store, Share2, Ticket, Calendar, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { formatBetDateTime, isBetDateTimeExpired } from '@/lib/betsDateTime';
import { computeTicketOdd, effectiveMaxOdd, HARD_MAX_ODD, type TicketOddLimits } from '@/lib/ticketOdds';
import { canAddSelection, validateTicketCoherence } from '@/lib/ticketCoherence';
import AuthNoticeBanner from '@/components/AuthNoticeBanner';
import type { ShareTicketData } from '@/components/casino/ShareTicket';
import type { ShareMultipleData } from '@/components/casino/ShareTicketMultiple';
import { optimizedImage } from '@/lib/imageUrl';
import { useIsMobile } from '@/hooks/use-mobile';

const ShareTicket = lazy(() => import('@/components/casino/ShareTicket'));
const ShareTicketMultiple = lazy(() => import('@/components/casino/ShareTicketMultiple'));
const Bolao = lazy(() => import('@/components/Bolao'));

function HotEventsCarousel({ events, renderEvent }: { events: any[]; renderEvent: (ev: any) => React.ReactNode }) {
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);
  const pausedRef = useRef(false);
  const interactedRef = useRef(false);
  const touchStartXRef = useRef<number | null>(null);
  const n = events.length;

  const slides = n > 1 ? [...events, events[0]] : events;

  useEffect(() => {
    if (n <= 1) return;
    const id = setInterval(() => {
      if (pausedRef.current || interactedRef.current) return;
      setIndex(i => i + 1);
    }, 4000);
    return () => clearInterval(id);
  }, [n]);

  useEffect(() => {
    if (n <= 1) return;
    if (index === n) {
      const t = setTimeout(() => {
        setAnimate(false);
        setIndex(0);
        requestAnimationFrame(() => requestAnimationFrame(() => setAnimate(true)));
      }, 600);
      return () => clearTimeout(t);
    }
    if (index < 0) {
      const t = setTimeout(() => {
        setAnimate(false);
        setIndex(n - 1);
        requestAnimationFrame(() => requestAnimationFrame(() => setAnimate(true)));
      }, 600);
      return () => clearTimeout(t);
    }
  }, [index, n]);

  const pause = () => { pausedRef.current = true; };
  const resume = () => { pausedRef.current = false; };

  const goNext = () => {
    interactedRef.current = true;
    setAnimate(true);
    setIndex(i => (i >= n ? 1 : i + 1));
  };
  const goPrev = () => {
    interactedRef.current = true;
    setAnimate(true);
    setIndex(i => i - 1);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    pause();
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    resume();
    const startX = touchStartXRef.current;
    touchStartXRef.current = null;
    if (startX == null) return;
    const endX = e.changedTouches[0]?.clientX ?? startX;
    const dx = endX - startX;
    if (Math.abs(dx) > 40) {
      if (dx < 0) goNext(); else goPrev();
    }
  };

  const activeDot = n > 0 ? (((index % n) + n) % n) : 0;

  return (
    <div
      className="relative overflow-hidden group"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="flex"
        style={{
          transform: `translateX(-${(index < 0 ? 0 : index) * 100}%)`,
          transition: animate ? 'transform 600ms ease-in-out' : 'none',
        }}
      >
        {slides.map((ev, i) => (
          <div key={`${ev.id}-${i}`} className="shrink-0 w-full px-1">
            {renderEvent(ev)}
          </div>
        ))}
      </div>

      {n > 1 && (
        <>
          <button
            type="button"
            onClick={goPrev}
            aria-label="Anterior"
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm border border-white/10 text-white flex items-center justify-center opacity-70 hover:opacity-100 transition"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Próximo"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm border border-white/10 text-white flex items-center justify-center opacity-70 hover:opacity-100 transition"
          >
            <ChevronRight size={18} />
          </button>
          <div className="absolute bottom-1 left-0 right-0 flex justify-center gap-1.5 z-10 pointer-events-none">
            {events.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${activeDot === i ? 'w-4 bg-white' : 'w-1.5 bg-white/40'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface BetsPageProps { tag: string }

interface OutcomeRow { id: string; event_id: string; market_id: string | null; label: string; odd: number; position: number; is_winner: boolean }
interface MarketRow {
  id: string; event_id: string; title: string; position: number;
  status: 'open'|'closed'|'resolved'|'cancelled'; closes_at: string | null;
  winning_outcome_id: string | null; min_bet: number; max_bet: number;
  max_bets_per_user: number; payout_mode: 'coins'|'case';
  payout_case_id: string | null; payout_case_qty_per_unit: number;
}
interface EventRow {
  id: string; title: string; subtitle: string; category: string; category_id: string | null; image_url: string;
  home_image_url?: string | null; away_image_url?: string | null;
  starts_at: string | null; closes_at: string | null; status: 'scheduled'|'open'|'closed'|'resolved'|'cancelled';
  payout_mode: 'coins' | 'case'; payout_case_id: string | null; payout_case_qty_per_unit: number;
  min_bet: number; max_bet: number; max_bets_per_user: number; position: number; winning_outcome_id: string | null;
  is_hot?: boolean;
  competition_id?: string | null; competition_name?: string | null;
  competition_slug?: string | null; competition_country?: string | null;
}
interface CategoryRow { id: string; name: string; color: string; icon: string; position: number; background_url?: string }
interface CaseRow { id: string; name: string; image_url: string; rarity: string }
interface WagerRow {
  id: string; public_code?: string; event_id: string; outcome_id: string; amount_coins: number; odd_snapshot: number;
  payout_mode: 'coins'|'case'; status: 'pending'|'won'|'lost'|'refunded'|'cancelled';
  payout_coins: number; payout_grant_id: string | null; created_at: string; resolved_at: string | null;
}
interface TicketRow {
  id: string; public_code: string; total_odd: number; stake: number; potential_return: number;
  status: 'pending'|'won'|'lost'|'cancelled'|'refunded'; payout_coins: number;
  created_at: string; resolved_at: string | null;
}
interface TicketSelectionRow {
  id: string; ticket_id: string; event_id: string; market_id: string | null; outcome_id: string;
  event_title: string; market_title: string; selection_label: string; odd: number;
  status: 'pending'|'won'|'lost'|'cancelled';
}
interface TicketDraft {
  eventId: string; eventTitle: string; marketId: string | null; marketTitle: string;
  outcomeId: string; outcomeLabel: string; odd: number;
}

interface AuthedUser { id: string; name: string; email: string; account_id: string; tokens_balance: number }

const PT_BR_DICT: Array<[RegExp, string]> = [
  // Competition / round names
  [/\bRegular Season\b/gi, 'Temporada Regular'],
  [/\bQuarter[- ]?finals?\b/gi, 'Quartas de Final'],
  [/\bSemi[- ]?finals?\b/gi, 'Semifinal'],
  [/\bRound of 16\b/gi, 'Oitavas de Final'],
  [/\bRound of 32\b/gi, 'Dezesseis avos'],
  [/\bGroup Stage\b/gi, 'Fase de Grupos'],
  [/\bPlay[- ]?offs?\b/gi, 'Playoffs'],
  [/\bMatchday\b/gi, 'Rodada'],
  [/\bRound\b/gi, 'Rodada'],
  // Markets (mais específicos primeiro)
  [/\bMatch Winner\b/gi, 'Vencedor da Partida'],
  [/\bFull Time Result\b/gi, 'Resultado Final'],
  [/\bFirst Half Winner\b/gi, 'Vencedor do 1º Tempo'],
  [/\bSecond Half Winner\b/gi, 'Vencedor do 2º Tempo'],
  [/\bDouble Chance\b/gi, 'Dupla Chance'],
  [/\bBoth Teams (To )?Score\b/gi, 'Ambas Marcam'],
  [/\bGoals Over\/Under\b/gi, 'Mais/Menos Gols'],
  [/\bOver\/Under\b/gi, 'Mais/Menos'],
  [/\bAsian Handicap\b/gi, 'Handicap Asiático'],
  [/\bHandicap\b/gi, 'Handicap'],
  [/\bCorrect Score\b/gi, 'Placar Exato'],
  [/\bHalf Time\/Full Time\b/gi, 'Intervalo/Final'],
  [/\bClean Sheet\b/gi, 'Não Sofrer Gol'],
  [/\bWin To Nil\b/gi, 'Vencer Sem Sofrer'],
  [/\bTotal Goals\b/gi, 'Total de Gols'],
  [/\bExact Goals?\b/gi, 'Gols Exatos'],
  [/\bOdd\/Even\b/gi, 'Ímpar/Par'],
  [/\bHome\/Away\b/gi, 'Casa/Fora'],
  [/\bTo Win\b/gi, 'Para Vencer'],
  [/\bTo Qualify\b/gi, 'Para Se Classificar'],
  [/\bCards\b/gi, 'Cartões'],
  [/\bCorners\b/gi, 'Escanteios'],
  [/\bPenalty\b/gi, 'Pênalti'],
  // Genéricos no fim
  [/\bFinal\b/gi, 'Final'],
];
const translatePt = (s?: string | null) => {
  if (!s) return s ?? '';
  let out = s;
  for (const [re, rep] of PT_BR_DICT) out = out.replace(re, rep);
  return out;
};
const translateOutcomeLabel = (s?: string | null) => {
  if (!s) return s ?? '';
  const up = s.trim().toUpperCase();
  if (up === 'HOME') return 'CASA';
  if (up === 'AWAY') return 'FORA';
  if (up === 'DRAW' || up === 'TIE') return 'EMPATE';
  if (up === 'YES') return 'SIM';
  if (up === 'NO') return 'NÃO';
  if (up === 'OVER') return 'MAIS';
  if (up === 'UNDER') return 'MENOS';
  if (up === 'ODD') return 'ÍMPAR';
  if (up === 'EVEN') return 'PAR';
  return translatePt(s);
};

// Gera sigla de 3 letras de um nome de time (visual apenas).
const teamAcronym = (name?: string | null): string => {
  if (!name) return '';
  const cleaned = name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .trim();
  if (!cleaned) return '';
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const initials = words.slice(0, 3).map(w => w[0]).join('').toUpperCase();
    if (initials.length >= 2) return initials.slice(0, 3);
  }
  const letters = cleaned.replace(/[^A-Za-z]/g, '');
  if (letters.length < 3) return '';
  return letters.slice(0, 3).toUpperCase();
};

const parseEventTeams = (title?: string | null): { home: string; away: string } => {
  if (!title) return { home: '', away: '' };
  const parts = title.split(/\s+(?:x|vs|×|@|-)\s+/i);
  if (parts.length < 2) return { home: '', away: '' };
  return { home: parts[0].trim(), away: parts.slice(1).join(' ').trim() };
};

// Para botões de odds principais: troca CASA/EMPATE/FORA por sigla dos times.
const outcomeLabelForCard = (label?: string | null, eventTitle?: string | null) => {
  if (!label) return '';
  const up = label.trim().toUpperCase();
  if (up === 'HOME') {
    const { home } = parseEventTeams(eventTitle);
    return teamAcronym(home) || 'CASA';
  }
  if (up === 'AWAY') {
    const { away } = parseEventTeams(eventTitle);
    return teamAcronym(away) || 'FORA';
  }
  if (up === 'DRAW' || up === 'TIE') return 'EMP';
  return translateOutcomeLabel(label);
};

const SLUG_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
const genSlug = (len = 6) => {
  let s = '';
  for (let i = 0; i < len; i++) s += SLUG_ALPHABET[Math.floor(Math.random() * SLUG_ALPHABET.length)];
  return s;
};
const createShortShareLink = async (
  tag: string,
  selections: Array<{ e: string; o: string }>
): Promise<string> => {
  const origin = window.location.origin;
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = genSlug(6);
    const { error } = await supabase
      .from('shared_tickets')
      .insert({ slug, tag, selections });
    if (!error) return `${origin}/odds=${tag}#c=${slug}`;
    if ((error as any).code !== '23505') break;
  }
  return `${origin}/odds=${tag}`;
};
// legacy decoder for #copy= (compressed) links
const decodeCopy = async (s: string): Promise<Array<{ e: string; o: string }>> => {
  try {
    if (s.startsWith('z')) {
      const LZString = (await import('lz-string')).default;
      const decompressed = LZString.decompressFromEncodedURIComponent(s.slice(1));
      if (!decompressed) return [];
      return decompressed.split(';').map(pair => {
        const [e, o] = pair.split('|');
        return { e, o };
      }).filter(x => x.e && x.o);
    }
    const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
    const json = JSON.parse(atob(b64));
    return Array.isArray(json?.s) ? json.s.filter((x: any) => x?.e && x?.o) : [];
  } catch { return []; }
};

const Bets = ({ tag }: BetsPageProps) => {
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState<any | null>(null);
  const [authed, setAuthed] = useState<AuthedUser | null>(null);

  // auth screen
  const [authEmail, setAuthEmail] = useState('');
  const [authAccountId, setAuthAccountId] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // bet slip
  const [slip, setSlip] = useState<{ event: EventRow; outcome: OutcomeRow } | null>(null);
  const [amount, setAmount] = useState('');
  const [placing, setPlacing] = useState(false);

  // my bets
  const [tab, setTab] = useState<'events' | 'mine'>('events');
  const [categoryFilter, setCategoryFilter] = useState<string>('all'); // 'all' | category_id | 'uncategorized'
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [myWagers, setMyWagers] = useState<WagerRow[]>([]);
  const [expandedTickets, setExpandedTickets] = useState<Set<string>>(new Set());
  const [myEvents, setMyEvents] = useState<any[]>([]);
  const [myOutcomes, setMyOutcomes] = useState<any[]>([]);
  const [myMarkets, setMyMarkets] = useState<any[]>([]);
  const [shareWager, setShareWager] = useState<ShareTicketData | null>(null);
  const [shareMultiple, setShareMultiple] = useState<ShareMultipleData | null>(null);
  const [bolaoOpen, setBolaoOpen] = useState(false);
  const [wagerCounts, setWagerCounts] = useState<Record<string, number>>({});
  const [outcomeStats, setOutcomeStats] = useState<Record<string, { count: number; total: number }>>({});
  const [collapsedMarkets, setCollapsedMarkets] = useState<Record<string, boolean>>({});
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});
  const [selectedEventId, setSelectedEventIdState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const m = window.location.hash.match(/(?:^#|&)ev=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  });
  const setSelectedEventId = (id: string | null) => {
    setSelectedEventIdState(id);
    if (typeof window !== 'undefined') {
      if (id) window.history.pushState(null, '', `#ev=${encodeURIComponent(id)}`);
      else window.history.pushState(null, '', window.location.pathname + window.location.search);
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  };

  // multi-bet ticket
  const isMobile = useIsMobile();
  const [ticketDraft, setTicketDraft] = useState<TicketDraft[]>([]);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketAmount, setTicketAmount] = useState('10');
  const [placingTicket, setPlacingTicket] = useState(false);
  const [myTickets, setMyTickets] = useState<TicketRow[]>([]);
  const [myTicketSelections, setMyTicketSelections] = useState<TicketSelectionRow[]>([]);
  const [visibleEventLimit, setVisibleEventLimit] = useState(18);
  const [detailedEventIds, setDetailedEventIds] = useState<Record<string, boolean>>({});
  const [loadingDetailEventId, setLoadingDetailEventId] = useState<string | null>(null);

  // load page
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-bets-page', { body: { tag } });
        if (error) throw error;
        setPage(data);
        if (data?.wagerCounts) setWagerCounts(data.wagerCounts);
        if (data?.outcomeStats) setOutcomeStats(data.outcomeStats);
      } catch (e: any) {
        toast.error('Erro ao carregar página');
      } finally {
        setLoading(false);
      }
    })();
  }, [tag]);

  // ── Track pageview (odds page) ──
  useEffect(() => {
    if (!page?.ownerId) return;
    const sessionId = (() => {
      let sid = sessionStorage.getItem('pv_session');
      if (!sid) { sid = crypto.randomUUID(); sessionStorage.setItem('pv_session', sid); }
      return sid;
    })();
    const startTime = Date.now();

    supabase.functions.invoke('track-pageview', {
      body: {
        session_id: sessionId,
        slug: tag,
        owner_id: page.ownerId,
        referrer: document.referrer || null,
        page_url: window.location.href,
        page_type: 'odds',
      },
    }).catch(() => {});

    const durationInterval = setInterval(() => {
      const seconds = Math.round((Date.now() - startTime) / 1000);
      supabase.functions.invoke('track-pageview', {
        body: { session_id: sessionId, action: 'update_duration', duration_seconds: seconds },
      }).catch(() => {});
    }, 120000);

    const handleUnload = () => {
      const seconds = Math.round((Date.now() - startTime) / 1000);
      navigator.sendBeacon?.(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-pageview`,
        JSON.stringify({ session_id: sessionId, action: 'update_duration', duration_seconds: seconds })
      );
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(durationInterval);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [page?.ownerId, tag]);

  // sync selectedEventId with browser back/forward
  useEffect(() => {
    const onPop = () => {
      const m = window.location.hash.match(/(?:^#|&)ev=([^&]+)/);
      setSelectedEventIdState(m ? decodeURIComponent(m[1]) : null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // wager counts são carregados apenas no load inicial (via get-bets-page).
  // Usuário precisa dar F5 para ver contagem atualizada — economia máxima de recursos.

  // import shared ticket via #c=<slug> (new) or #copy=<payload> (legacy)
  useEffect(() => {
    if (!page?.events) return;
    (async () => {
      let sel: Array<{ e: string; o: string }> = [];
      let stripPattern: RegExp | null = null;
      const mShort = window.location.hash.match(/(?:^#|&)c=([^&]+)/);
      const mLegacy = window.location.hash.match(/(?:^#|&)copy=([^&]+)/);
      if (mShort) {
        const slug = decodeURIComponent(mShort[1]);
        const { data, error } = await supabase
          .from('shared_tickets')
          .select('selections')
          .eq('slug', slug)
          .maybeSingle();
        if (error || !data) { toast.error('Bilhete não encontrado'); return; }
        sel = (data.selections as any) || [];
        stripPattern = /(?:^#|&)c=[^&]+/;
      } else if (mLegacy) {
        sel = await decodeCopy(decodeURIComponent(mLegacy[1]));
        stripPattern = /(?:^#|&)copy=[^&]+/;
      } else {
        return;
      }
      if (!sel.length) return;
      const events: EventRow[] = page.events || [];
      const outcomes: OutcomeRow[] = page.outcomes || [];
      const markets: MarketRow[] = page.markets || [];
      const drafts: TicketDraft[] = [];
      for (const { e, o } of sel) {
        const ev = events.find(x => x.id === e);
        const oc = outcomes.find(x => x.id === o && x.event_id === e);
        if (!ev || !oc) continue;
        const mk = markets.find(x => x.id === oc.market_id);
        drafts.push({
          eventId: ev.id, eventTitle: ev.title,
          marketId: oc.market_id, marketTitle: mk?.title || 'Resultado Final',
          outcomeId: oc.id, outcomeLabel: oc.label, odd: Number(oc.odd),
        });
      }
      const newHash = window.location.hash
        .replace(stripPattern!, '')
        .replace(/^#&/, '#')
        .replace(/^#$/, '');
      window.history.replaceState(null, '', window.location.pathname + window.location.search + newHash);
      if (!drafts.length) return;
      if (drafts.length === 1) {
        const ev = events.find(x => x.id === drafts[0].eventId);
        const oc = outcomes.find(x => x.id === drafts[0].outcomeId);
        if (ev && oc) { setSlip({ event: ev, outcome: oc }); toast.success('Bilhete carregado! Confirme para apostar.'); }
      } else {
        setTicketDraft(drafts);
        setTicketOpen(true);
        toast.success(`Múltipla com ${drafts.length} seleções carregada!`);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);


  // restore persisted session
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`bets_user_${tag}`);
      if (raw) setAuthed(JSON.parse(raw));
    } catch {}
  }, [tag]);

  // persist authed user across navigations
  useEffect(() => {
    try {
      if (authed) sessionStorage.setItem(`bets_user_${tag}`, JSON.stringify(authed));
      else sessionStorage.removeItem(`bets_user_${tag}`);
    } catch {}
  }, [authed, tag]);

  useEffect(() => {
    setVisibleEventLimit(18);
  }, [categoryFilter]);

  useEffect(() => {
    if (!selectedEventId || !page?.found || detailedEventIds[selectedEventId]) return;
    let cancelled = false;
    setLoadingDetailEventId(selectedEventId);
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-bets-page', { body: { tag, detailEventId: selectedEventId } });
        if (error) throw error;
        if (cancelled || !data?.found) return;
        setPage((prev: any) => {
          if (!prev) return prev;
          const mergeById = (a: any[] = [], b: any[] = []) => Array.from(new Map([...a, ...b].map(x => [x.id, x])).values());
          return {
            ...prev,
            events: mergeById(prev.events, data.events),
            markets: [
              ...(prev.markets || []).filter((m: MarketRow) => m.event_id !== selectedEventId),
              ...(data.markets || []),
            ],
            outcomes: [
              ...(prev.outcomes || []).filter((o: OutcomeRow) => o.event_id !== selectedEventId),
              ...(data.outcomes || []),
            ],
            cases: mergeById(prev.cases, data.cases),
            wagerCounts: { ...(prev.wagerCounts || {}), ...(data.wagerCounts || {}) },
            outcomeStats: { ...(prev.outcomeStats || {}), ...(data.outcomeStats || {}) },
          };
        });
        if (data?.wagerCounts) setWagerCounts(prev => ({ ...prev, ...data.wagerCounts }));
        if (data?.outcomeStats) setOutcomeStats(prev => ({ ...prev, ...data.outcomeStats }));
        setDetailedEventIds(prev => ({ ...prev, [selectedEventId]: true }));
      } catch {
        toast.error('Erro ao carregar mercados do jogo');
      } finally {
        if (!cancelled) setLoadingDetailEventId(null);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedEventId, page?.found, detailedEventIds, tag]);

  // SEO/pixels injection
  useEffect(() => {
    const seo: any = page?.pageConfig?.seo;
    if (!seo || Object.keys(seo).length === 0) return;
    const addMeta = (name: string, content: string, property = false) => {
      if (!content) return;
      const sel = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
      let m = document.querySelector(sel) as HTMLMetaElement | null;
      if (!m) { m = document.createElement('meta'); property ? m.setAttribute('property', name) : m.setAttribute('name', name); document.head.appendChild(m); }
      m.setAttribute('content', content);
    };
    if (seo.pageTitle) document.title = seo.pageTitle;
    if (seo.faviconUrl) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = seo.faviconUrl;
    }
    if (seo.pageDescription) { addMeta('description', seo.pageDescription); addMeta('og:description', seo.pageDescription, true); }
    if (seo.pageTitle) addMeta('og:title', seo.pageTitle, true);
    if (seo.ogImage) addMeta('og:image', seo.ogImage, true);
    if (seo.keywords) addMeta('keywords', seo.keywords);
    if (seo.facebookPixelId) {
      const s = document.createElement('script');
      s.innerHTML = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${seo.facebookPixelId}');fbq('track','PageView');`;
      document.head.appendChild(s);
    }
    if (seo.googleAnalyticsId) {
      const g1 = document.createElement('script'); g1.async = true; g1.src = `https://www.googletagmanager.com/gtag/js?id=${seo.googleAnalyticsId}`;
      const g2 = document.createElement('script'); g2.innerHTML = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${seo.googleAnalyticsId}');`;
      document.head.appendChild(g1); document.head.appendChild(g2);
    }
    if (seo.gtmId) {
      const g = document.createElement('script');
      g.innerHTML = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${seo.gtmId}');`;
      document.head.appendChild(g);
    }
    if (seo.tiktokPixelId) {
      const t = document.createElement('script');
      t.innerHTML = `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${seo.tiktokPixelId}');ttq.page();}(window,document,'ttq');`;
      document.head.appendChild(t);
    }
    if (seo.customHeadScript) {
      const div = document.createElement('div');
      div.innerHTML = seo.customHeadScript;
      Array.from(div.childNodes).forEach(n => document.head.appendChild(n));
    }
  }, [page]);

  const cfg = page?.pageConfig || {};
  const bg = cfg.bgColor || '#0b0b14';
  const accent = cfg.accentColor || '#22d3ee';
  const cardBg = cfg.cardBg || '#141425';
  const text = cfg.textColor || '#ffffff';
  const muted = cfg.mutedColor || '#a0a0c0';
  const coinName = page?.coinName || 'Coins';
  const coinIcon = page?.coinIconUrl || '';

  const events: EventRow[] = page?.events || [];
  const marketsByEvent = useMemo(() => {
    const m: Record<string, MarketRow[]> = {};
    (page?.markets || []).forEach((mk: MarketRow) => { (m[mk.event_id] ||= []).push(mk); });
    Object.values(m).forEach(arr => arr.sort((a, b) => a.position - b.position));
    return m;
  }, [page]);
  const outcomesByEvent = useMemo(() => {
    const m: Record<string, OutcomeRow[]> = {};
    (page?.outcomes || []).forEach((o: OutcomeRow) => { (m[o.event_id] ||= []).push(o); });
    return m;
  }, [page]);
  const outcomesByMarket = useMemo(() => {
    const m: Record<string, OutcomeRow[]> = {};
    (page?.outcomes || []).forEach((o: OutcomeRow) => {
      if (o.market_id) (m[o.market_id] ||= []).push(o);
    });
    Object.values(m).forEach(arr => arr.sort((a, b) => a.position - b.position));
    return m;
  }, [page]);
  const casesById = useMemo(() => {
    const m: Record<string, CaseRow> = {};
    (page?.cases || []).forEach((c: CaseRow) => { m[c.id] = c; });
    return m;
  }, [page]);

  // Lookups memoizados para evitar O(N*M) re-scan do ticketDraft dentro do .map de outcomes
  const ticketDraftProjection = useMemo(
    () => ticketDraft.map(s => ({
      eventId: s.eventId,
      marketId: s.marketId,
      marketTitle: s.marketTitle,
      outcomeLabel: s.outcomeLabel,
      eventTitle: s.eventTitle,
    })),
    [ticketDraft],
  );
  const ticketDraftOutcomeIds = useMemo(
    () => new Set(ticketDraft.map(s => s.outcomeId)),
    [ticketDraft],
  );
  const ticketDraftMarketKeys = useMemo(() => {
    const s = new Set<string>();
    ticketDraft.forEach(t => s.add(`${t.eventId}|${t.marketId || 'main'}`));
    return s;
  }, [ticketDraft]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = authEmail.trim().toLowerCase();
    const accountId = authAccountId.trim();
    if (!email || !accountId) { toast.error('Preencha e-mail e ID'); return; }
    setAuthLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-user-bets', { body: { tag, email, accountId } });
      if (error) throw error;
      if (!data?.found) { toast.error('Cadastro não encontrado'); return; }
      if (data.user.blacklisted) { toast.error('Conta bloqueada'); return; }
      setAuthed(data.user);
      setMyWagers(data.wagers || []);
      setMyEvents(data.events || []);
      setMyOutcomes(data.outcomes || []);
      setMyMarkets(data.markets || []);
      setMyTickets(data.tickets || []);
      setMyTicketSelections(data.ticketSelections || []);
    } catch (err: any) {
      toast.error('Falha ao buscar cadastro');
    } finally {
      setAuthLoading(false);
    }
  };

  const refreshMine = async () => {
    if (!authed) return;
    const { data } = await supabase.functions.invoke('get-user-bets', {
      body: { tag, email: authed.email, accountId: authed.account_id },
    });
    if (data?.found) {
      setAuthed(prev => prev ? { ...prev, tokens_balance: data.user.tokens_balance } : prev);
      setMyWagers(data.wagers || []);
      setMyEvents(data.events || []);
      setMyOutcomes(data.outcomes || []);
      setMyMarkets(data.markets || []);
      setMyTickets(data.tickets || []);
      setMyTicketSelections(data.ticketSelections || []);
    }
  };

  const SIMPLE_MIN_BET = 10;
  const SIMPLE_MAX_BET = 500;

  const openSlip = (event: EventRow, outcome: OutcomeRow) => {
    if (!authed) { toast.error('Faça login para apostar'); return; }
    const market = outcome.market_id ? (page?.markets || []).find((m: MarketRow) => m.id === outcome.market_id) : null;
    const status = market?.status ?? event.status;
    const closesAt = market?.closes_at ?? event.closes_at;
    if (status !== 'open') { toast.error('Mercado fechado'); return; }
    if (isBetDateTimeExpired(closesAt)) { toast.error('Apostas encerradas'); return; }
    setSlip({ event, outcome });
    setAmount(String(SIMPLE_MIN_BET));
  };

  const placeBet = async () => {
    if (!slip || !authed) return;
    const amt = Math.floor(Number(amount));
    if (!Number.isFinite(amt) || amt <= 0) { toast.error('Valor inválido'); return; }
    if (amt < SIMPLE_MIN_BET) { toast.error(`Valor mínimo de aposta: ${SIMPLE_MIN_BET} ${coinName}`); return; }
    if (amt > SIMPLE_MAX_BET) { toast.error(`Valor máximo de aposta: ${SIMPLE_MAX_BET} ${coinName}`); return; }
    if (amt > authed.tokens_balance) { toast.error('Saldo insuficiente'); return; }
    setPlacing(true);
    try {
      const { data, error } = await supabase.functions.invoke('place-bet', {
        body: {
          tag, email: authed.email, accountId: authed.account_id,
          eventId: slip.event.id, outcomeId: slip.outcome.id, amount: amt,
        },
      });
      if (error) throw error;
      if (!data?.success) {
        const errMap: Record<string, string> = {
          max_bets_reached: `Limite de ${data?.max || 1} aposta(s) por usuário neste evento atingido`,
          insufficient_balance: 'Saldo insuficiente',
          event_closed: 'Apostas encerradas',
          event_not_open: 'Evento fechado',
          below_min_bet: `Aposta mínima: ${data?.min}`,
          above_max_bet: `Aposta máxima: ${data?.max}`,
          user_blocked: 'Conta bloqueada',
          user_not_found: 'Usuário não encontrado',
        };
        toast.error(errMap[data?.error] || `Falha: ${data?.error || 'erro desconhecido'}`);
        return;
      }
      toast.success('Aposta confirmada!');
      setAuthed(prev => prev ? { ...prev, tokens_balance: data.tokens_balance } : prev);
      setSlip(null);
      refreshMine();
    } catch (err: any) {
      toast.error('Falha ao apostar');
    } finally {
      setPlacing(false);
    }
  };

  const allowSameFixture = !!(cfg.multiTicket?.allowSameFixture);

  const addToTicket = (event: EventRow, outcome: OutcomeRow) => {
    if (!authed) { toast.error('Faça login para apostar'); return; }
    const market = outcome.market_id ? (page?.markets || []).find((m: MarketRow) => m.id === outcome.market_id) : null;
    const status = market?.status ?? event.status;
    const closesAt = market?.closes_at ?? event.closes_at;
    if (status !== 'open' && status !== 'scheduled') { toast.error('Mercado fechado'); return; }
    if (isBetDateTimeExpired(closesAt)) { toast.error('Apostas encerradas'); return; }
    const marketKey = outcome.market_id || 'main';
    const marketTitle = market?.title || 'Resultado Final';
    const exists = ticketDraft.find(s => s.eventId === event.id && (s.marketId || 'main') === marketKey);
    if (exists) {
      if (exists.outcomeId === outcome.id) {
        toast.info('Seleção já no bilhete');
      } else {
        // replace selection within the same market
        setTicketDraft(prev => prev.map(s =>
          (s.eventId === event.id && (s.marketId || 'main') === marketKey)
            ? { ...s, outcomeId: outcome.id, outcomeLabel: outcome.label, odd: Number(outcome.odd) }
            : s
        ));
        toast.success('Seleção atualizada no bilhete');
      }
      return;
    }
    // coerência: bloquear combinações conflitantes/redundantes no mesmo fixture
    const check = canAddSelection(
      ticketDraftProjection,
      { eventId: event.id, marketId: outcome.market_id, marketTitle, outcomeLabel: outcome.label, eventTitle: event.title },
    );
    if (!check.ok) { toast.error(check.reason || 'Combinação não permitida'); return; }

    setTicketDraft(prev => [...prev, {
      eventId: event.id, eventTitle: event.title,
      marketId: outcome.market_id, marketTitle,
      outcomeId: outcome.id, outcomeLabel: outcome.label, odd: Number(outcome.odd),
    }]);
    toast.success('Adicionado ao bilhete');
  };

  const removeFromTicket = (outcomeId: string) => {
    setTicketDraft(prev => prev.filter(s => s.outcomeId !== outcomeId));
  };
  const clearTicket = () => setTicketDraft([]);

  const ticketLimits: TicketOddLimits = (cfg.multiTicket || {}) as TicketOddLimits;
  const maxOddAllowed = effectiveMaxOdd(ticketLimits);
  const maxReturnAllowed = Math.max(0, Number(ticketLimits.maxReturn) || 0); // 0 = sem limite
  const MULTI_MIN_BET = 10;
  const MULTI_MAX_BET = 150;
  const isSingleTicket = ticketDraft.length <= 1;
  const minBetAllowed = isSingleTicket
    ? SIMPLE_MIN_BET
    : Math.max(MULTI_MIN_BET, Number(ticketLimits.minBet) || MULTI_MIN_BET);
  const maxBetAllowed = isSingleTicket
    ? SIMPLE_MAX_BET
    : Math.max(MULTI_MIN_BET, Number(ticketLimits.maxBet) || MULTI_MAX_BET);

  const oddBreakdown = useMemo(
    () => computeTicketOdd(ticketDraft.map(s => ({ eventId: s.eventId, odd: Number(s.odd) || 1 }))),
    [ticketDraft],
  );
  const totalOdd = oddBreakdown.final;
  const ticketReturn = useMemo(() => {
    const amt = Math.floor(Number(ticketAmount));
    if (!Number.isFinite(amt) || amt <= 0) return 0;
    return Math.round(amt * totalOdd);
  }, [ticketAmount, totalOdd]);

  const ticketBlockReason = useMemo<string | null>(() => {
    if (ticketDraft.length === 0) return null;
    const amt = Math.floor(Number(ticketAmount));
    if (Number.isFinite(amt) && amt > 0) {
      if (amt < minBetAllowed) return `Valor mínimo de aposta é ${minBetAllowed}`;
      if (maxBetAllowed > 0 && amt > maxBetAllowed) return `Valor máximo de aposta é ${maxBetAllowed}`;
    }
    if (ticketDraft.length < 2) return null;
    if (totalOdd > maxOddAllowed) {
      return maxOddAllowed >= HARD_MAX_ODD
        ? `Odd máxima permitida é ${HARD_MAX_ODD}`
        : `Odd máxima permitida é ${maxOddAllowed}`;
    }
    if (maxReturnAllowed > 0 && ticketReturn > maxReturnAllowed) {
      return `Retorno máximo permitido é ${maxReturnAllowed.toLocaleString('pt-BR')}`;
    }
    return null;
  }, [ticketDraft.length, totalOdd, maxOddAllowed, ticketAmount, ticketReturn, minBetAllowed, maxBetAllowed, maxReturnAllowed]);

  const placeTicket = async () => {
    if (!authed) return;
    if (ticketDraft.length < 1) { toast.error('Selecione uma opção'); return; }
    const amt = Math.floor(Number(ticketAmount));
    if (!Number.isFinite(amt) || amt <= 0) { toast.error('Valor inválido'); return; }
    if (amt > authed.tokens_balance) { toast.error('Saldo insuficiente'); return; }
    if (ticketBlockReason) { toast.error(ticketBlockReason); return; }
    if (ticketDraft.length === 1) {
      setPlacingTicket(true);
      try {
        const selection = ticketDraft[0];
        const { data, error } = await supabase.functions.invoke('place-bet', {
          body: {
            tag, email: authed.email, accountId: authed.account_id,
            eventId: selection.eventId, outcomeId: selection.outcomeId, amount: amt,
          },
        });
        if (error) throw error;
        if (!data?.success) {
          const errMap: Record<string, string> = {
            max_bets_reached: `Limite de ${data?.max || 1} aposta(s) por usuário neste evento atingido`,
            insufficient_balance: 'Saldo insuficiente',
            event_closed: 'Apostas encerradas',
            event_not_open: 'Evento fechado',
            below_min_bet: `Aposta mínima: ${data?.min}`,
            above_max_bet: `Aposta máxima: ${data?.max}`,
            user_blocked: 'Conta bloqueada',
            user_not_found: 'Usuário não encontrado',
          };
          toast.error(errMap[data?.error] || `Falha: ${data?.error || 'erro desconhecido'}`);
          return;
        }
        toast.success('Aposta confirmada!');
        setAuthed(prev => prev ? { ...prev, tokens_balance: data.tokens_balance } : prev);
        if (cfg.ticketEnabled !== false) {
          try {
            const ev = events.find(e => e.id === selection.eventId);
            const payout = Math.round(amt * Number(selection.odd));
            const copyUrl = await createShortShareLink(tag, [{ e: selection.eventId, o: selection.outcomeId }]);
            setShareWager({
              userId: authed?.account_id || authed?.id,
              wagerCode: data.public_code || undefined,
              eventTitle: selection.eventTitle,
              outcomeLabel: selection.outcomeLabel,
              odd: Number(selection.odd),
              amount: amt,
              payout,
              status: 'pending',
              payoutMode: ev?.payout_mode || 'coins',
              coinName,
              createdAt: new Date().toISOString(),
              copyUrl,
            });
          } catch (e) { /* ignore share build errors */ }
        }
        setTicketDraft([]);
        setTicketOpen(false);
        refreshMine();
      } catch (err: any) {
        toast.error('Falha ao apostar');
      } finally {
        setPlacingTicket(false);
      }
      return;
    }
    const coherence = validateTicketCoherence(ticketDraftProjection);
    if (!coherence.ok) { toast.error(coherence.reason || 'Combinação não permitida'); return; }
    setPlacingTicket(true);
    try {
      const { data, error } = await supabase.functions.invoke('place-ticket', {
        body: {
          tag, email: authed.email, accountId: authed.account_id,
          selections: ticketDraft.map(s => ({ outcomeId: s.outcomeId })),
          amount: amt,
        },
      });
      if (error) throw error;
      if (!data?.success) {
        const errMap: Record<string, string> = {
          need_min_two_selections: 'Selecione pelo menos 2 opções',
          too_many_selections: 'Limite de 20 seleções por bilhete',
          insufficient_balance: 'Saldo insuficiente',
          event_closed: 'Um dos eventos já está encerrado',
          event_not_open: 'Um dos eventos não está aberto',
          market_not_open: 'Um dos mercados não está aberto',
          duplicate_market: 'Não pode haver duas seleções do mesmo mercado',
          same_fixture_not_allowed: 'Essa seleção não pode ser combinada com outra aposta do mesmo jogo.',
          incoherent_selections: 'Essa seleção não pode ser combinada com outra aposta do mesmo jogo.',
          user_not_found: 'Usuário não encontrado',
          odd_above_max: `Odd máxima permitida é ${maxOddAllowed}`,
          return_above_max: `Retorno máximo permitido é ${maxReturnAllowed.toLocaleString('pt-BR')}`,
          stake_below_min: `Valor mínimo de aposta é ${minBetAllowed}`,
          stake_above_max: `Valor máximo de aposta é ${maxBetAllowed}`,
        };
        toast.error(errMap[data?.error] || `Falha: ${data?.error || 'erro'}`);
        return;
      }
      toast.success(`Bilhete confirmado! Retorno potencial: ${data.potential_return}`);
      setAuthed(prev => prev ? { ...prev, tokens_balance: data.new_balance } : prev);
      if (cfg.ticketEnabled !== false) {
        try {
          const copyUrl = await createShortShareLink(
            tag,
            ticketDraft.map(s => ({ e: s.eventId, o: s.outcomeId })),
          );
          setShareMultiple({
            userId: authed?.account_id || authed?.id,
            wagerCode: data.public_code || undefined,
            selections: ticketDraft.map(s => ({
              eventTitle: s.eventTitle,
              marketTitle: s.marketTitle,
              outcomeLabel: s.outcomeLabel,
              odd: Number(s.odd),
              status: 'pending' as any,
            })),
            totalOdd: Number(data.total_odd) || totalOdd,
            amount: amt,
            payout: Number(data.potential_return) || Math.round(amt * totalOdd),
            status: 'pending',
            coinName,
            createdAt: new Date().toISOString(),
            copyUrl,
          });
        } catch (e) { /* ignore share build errors */ }
      }
      setTicketDraft([]);
      setTicketOpen(false);
      refreshMine();
    } catch (err: any) {
      toast.error('Falha ao registrar bilhete');
    } finally {
      setPlacingTicket(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: bg, color: text }}>
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!page?.found || !page?.isActive) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: bg, color: text }}>
        <div className="text-center max-w-md p-8 rounded-2xl" style={{ background: cardBg }}>
          <h1 className="text-2xl font-bold mb-2">Apostas indisponíveis</h1>
          <p style={{ color: muted }}>Esta página não está disponível no momento.</p>
        </div>
      </div>
    );
  }

  // Auth screen
  if (!authed) {
    const loginTitle = cfg.loginTitle || cfg.title || 'Apostas';
    const loginSubtitle = cfg.loginSubtitle || cfg.subtitle || 'Entre com seu e-mail e ID da conta para apostar';
    const loginBtnText = cfg.loginBtnText || 'Entrar';
    const titleColor = cfg.titleColor || text;
    const subtitleColor = cfg.subtitleColor || muted;
    const btnTextColor = cfg.btnTextColor || '#000';
    const bgStyle: React.CSSProperties = cfg.bgImage
      ? { backgroundImage: `url(${optimizedImage(cfg.bgImage, { width: 1280, quality: 70 })})`, backgroundSize: 'cover', backgroundPosition: 'center' }
      : (cfg.bgGradientFrom || cfg.bgGradientTo)
        ? { background: `radial-gradient(ellipse at top, ${cfg.bgGradientFrom || '#1a1230'} 0%, ${cfg.bgGradientTo || '#05040a'} 70%)` }
        : { background: bg };
    const signupHref = cfg.signupUrl || (tag ? `/gorjeta?ref=${tag}` : '/gorjeta');
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden text-white p-4" style={bgStyle}>
        <AuthNoticeBanner ownerId={page?.ownerId} />
        <form onSubmit={handleAuth} className="relative z-10 w-full max-w-sm rounded-2xl p-6 space-y-5 border border-white/10 bg-black/40 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
          <div className="text-center space-y-2">
            {cfg.logoUrl
              ? <img src={optimizedImage(cfg.logoUrl, { width: 320, quality: 80 })} alt="logo" decoding="async" className="max-h-20 mx-auto object-contain" />
              : <div className="text-4xl">🎯</div>}
            <h1 className="text-xl font-bold" style={{ color: titleColor }}>{loginTitle}</h1>
            <p className="text-sm" style={{ color: subtitleColor }}>{loginSubtitle}</p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1 opacity-80">E-mail</label>
              <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)}
                required maxLength={200} autoComplete="email"
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-white/20" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 opacity-80">ID da Conta</label>
              <input type="text" value={authAccountId} onChange={e => setAuthAccountId(e.target.value)}
                required maxLength={50} autoComplete="off"
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-white/20" />
            </div>
          </div>
          <button type="submit" disabled={authLoading}
            className="w-full py-3 rounded-xl font-bold text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: accent, color: btnTextColor }}>
            {authLoading ? <Loader2 className="animate-spin" size={16} /> : null}
            {authLoading ? 'Entrando...' : loginBtnText}
          </button>
          {!cfg.hideSignup && (
            <p className="text-center text-xs" style={{ color: subtitleColor }}>
              {cfg.signupText || 'Não tem conta ainda?'}{' '}
              <a href={signupHref} className="font-semibold underline-offset-2 hover:underline" style={{ color: accent }}>
                {cfg.signupCtaText || 'Clique aqui'}
              </a>
            </p>
          )}
        </form>
      </div>
    );
  }

  const eventStatusBadge = (st: string) => st === 'open' ? 'Aberto' : st === 'closed' ? 'Fechado' : st === 'resolved' ? 'Resolvido' : 'Cancelado';

  const pageBackgroundLayerStyle: React.CSSProperties = cfg.bgImage
    ? { backgroundImage: `url(${optimizedImage(cfg.bgImage, { width: 1280, quality: 65 })})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }
    : (cfg.bgGradientFrom || cfg.bgGradientTo)
      ? { background: `radial-gradient(ellipse at top, ${cfg.bgGradientFrom || '#1a1230'} 0%, ${cfg.bgGradientTo || '#05040a'} 70%)` }
      : { background: bg };

  return (
    <div className="relative isolate min-h-screen overflow-x-hidden" style={{ background: bg, color: text }}>
      <div aria-hidden className="fixed inset-0 pointer-events-none -z-10" style={pageBackgroundLayerStyle} />
      {/* header */}
      <header className="sticky top-0 z-20 backdrop-blur" style={{ background: 'rgba(0,0,0,0.4)', borderBottom: `1px solid ${accent}33` }}>
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {cfg.logoUrl && <img src={optimizedImage(cfg.logoUrl, { width: 160, quality: 80 })} alt="" decoding="async" className="h-9 object-contain shrink-0" />}
            <div className="min-w-0 hidden sm:block">
              <div className="font-bold truncate">{cfg.title || 'Apostas'}</div>
              <div className="text-xs truncate" style={{ color: muted }}>{authed.name}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg" style={{ background: `${accent}22`, border: `1px solid ${accent}55` }}>
              {coinIcon ? <img src={optimizedImage(coinIcon, { width: 48, quality: 80 })} className="w-4 h-4" alt="" decoding="async" /> : <Wallet size={14} />}
              <span className="font-bold tabular-nums text-sm">{authed.tokens_balance}</span>
              <span className="text-xs hidden sm:inline" style={{ color: muted }}>{coinName}</span>
            </div>
            <button
              onClick={() => {
                const luckyTag = (cfg.luckyboxTag || tag).toString().trim();
                try {
                  const sess = {
                    id: authed.id,
                    name: authed.name,
                    account_id: authed.account_id,
                    email: authed.email,
                    tokens_balance: authed.tokens_balance,
                    case_grants: {},
                  };
                  sessionStorage.setItem(`luckybox_user_${luckyTag}`, JSON.stringify(sess));
                } catch {}
                window.location.href = `/luckybox=${luckyTag}`;
              }}
              title="Loja"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-sm font-medium transition hover:opacity-90"
              style={{ background: `${accent}22`, border: `1px solid ${accent}55`, color: text }}>
              <Store size={14} />
              <span className="hidden sm:inline">Loja</span>
            </button>
            <button onClick={() => { setAuthed(null); setMyWagers([]); }} title="Sair"
              className="p-2 rounded-lg" style={{ background: '#00000033' }}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 pb-2 flex gap-1 items-center">
          {([['events','Eventos'],['mine','Minhas apostas']] as const).map(([k, l]) => (
            <button key={k} onClick={() => { setTab(k); if (k === 'mine') refreshMine(); }}
              className="px-4 py-2 rounded-t-lg text-sm font-medium transition"
              style={{
                background: tab === k ? cardBg : 'transparent',
                color: tab === k ? text : muted,
                borderBottom: tab === k ? `2px solid ${accent}` : '2px solid transparent',
              }}>{l}</button>
          ))}
          <style>{`
            @keyframes bolaoShimmer {
              0% { background-position: -200% 0; }
              100% { background-position: 200% 0; }
            }
            @keyframes bolaoGlow {
              0%, 100% { box-shadow: 0 0 8px rgba(212,175,55,0.35), 0 0 16px rgba(212,175,55,0.15); }
              50% { box-shadow: 0 0 14px rgba(212,175,55,0.6), 0 0 28px rgba(212,175,55,0.3); }
            }
            .bolao-btn {
              background-image: linear-gradient(110deg, #b8862a 0%, #d4af37 25%, #f5e08a 50%, #d4af37 75%, #b8862a 100%);
              background-size: 200% 100%;
              animation: bolaoShimmer 9s linear infinite, bolaoGlow 6s ease-in-out infinite;
            }
          `}</style>
          <button
            onClick={() => setBolaoOpen(true)}
            className="bolao-btn ml-auto px-4 py-2 rounded-lg text-sm font-bold tracking-wide transition hover:brightness-110"
            style={{ color: '#3a2a05', border: '1px solid rgba(255,225,140,0.6)' }}
            title="Bolão da Copa"
          >
            🏆 Bolão da Copa
          </button>
        </div>
      </header>


      <main className="max-w-5xl mx-auto px-4 py-6">
        {tab === 'events' && (() => {
          const cats: CategoryRow[] = page?.categories || [];
          const normSearch = searchQuery.trim().toLowerCase();
          const matchesSearch = (e: EventRow) => {
            if (!normSearch) return true;
            const hay = `${e.title || ''} ${e.subtitle || ''} ${e.competition_name || ''} ${e.category || ''}`.toLowerCase();
            return hay.includes(normSearch);
          };
          const isFinalized = (e: EventRow) => e.status === 'resolved' || e.status === 'cancelled';
          const hotEvents = events.filter(e => e.is_hot && !isFinalized(e) && matchesSearch(e));
          const nonHot = events.filter(e => !e.is_hot && !isFinalized(e) && matchesSearch(e));

          // Filtros fixos por categoria/competição
          // key formats:
          //  'all'                          -> tudo
          //  'category:<name lowercase>'    -> todos os eventos cuja categoria (nome) bate
          //  'competition:<slug>'           -> eventos com competition_slug específico
          //  'uncategorized'                -> sem category_id
          //  <category_id>                  -> compat: filtro por id (não usado nos chips fixos)
          const normCat = (s: string | null | undefined) => (s || '').trim().toLowerCase();
          const saoPauloYMD = (d: Date) => new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
          }).format(d);
          const todayYMD = saoPauloYMD(new Date());
          const isToday = (e: EventRow) => {
            if (!e.starts_at) return false;
            const d = new Date(e.starts_at);
            if (Number.isNaN(d.getTime())) return false;
            return saoPauloYMD(d) === todayYMD;
          };
          const matchesFilter = (e: EventRow) => {
            if (categoryFilter === 'all') return true;
            if (categoryFilter === 'today') return isToday(e);
            if (categoryFilter === 'uncategorized') return !e.category_id;
            if (categoryFilter.startsWith('competition:')) {
              const slug = categoryFilter.slice('competition:'.length);
              return (e.competition_slug || '') === slug;
            }
            if (categoryFilter.startsWith('category:')) {
              const name = categoryFilter.slice('category:'.length);
              const evCatName = normCat(e.category) || normCat(cats.find(c => c.id === e.category_id)?.name);
              return evCatName === name;
            }
            return e.category_id === categoryFilter;
          };

          // Prioridade: abertos COM odds carregadas → abertos sem odds → agendados → expirados → encerrados → finalizados → cancelados
          const hasOdds = (e: EventRow): boolean => {
            const outs = outcomesByEvent[e.id] || [];
            return outs.length > 0;
          };
          const statusRank = (e: EventRow): number => {
            const expired = isBetDateTimeExpired(e.closes_at);
            const odds = hasOdds(e);
            if (e.status === 'open' && !expired && odds) return 0;
            if (e.status === 'open' && !expired && !odds) return 1;
            if (e.status === 'scheduled') return 2;
            if (e.status === 'open' && expired) return 3;
            if (e.status === 'closed') return 4;
            if (e.status === 'resolved') return 5;
            return 6;
          };
          const sortByStatus = (arr: EventRow[]) =>
            [...arr].sort((a, b) => {
              const ra = statusRank(a), rb = statusRank(b);
              if (ra !== rb) return ra - rb;
              const ta = a.starts_at ? new Date(a.starts_at).getTime() : Number.POSITIVE_INFINITY;
              const tb = b.starts_at ? new Date(b.starts_at).getTime() : Number.POSITIVE_INFINITY;
              if (ta !== tb) return ta - tb;
              return (a.position ?? 0) - (b.position ?? 0);
            });


          const filtered = sortByStatus(nonHot.filter(matchesFilter));

          // categorias presentes em nonHot (para agrupar quando "Todos")
          const usedCatIds = new Set(nonHot.map(e => e.category_id).filter(Boolean) as string[]);
          const groupFirstIndex = new Map<string, number>();
          filtered.forEach((e, index) => {
            const key = e.category_id || '__uncategorized';
            if (!groupFirstIndex.has(key)) groupFirstIndex.set(key, index);
          });
          const visibleCats = cats
            .filter(c => usedCatIds.has(c.id))
            .sort((a, b) =>
              (groupFirstIndex.get(a.id) ?? 9999) - (groupFirstIndex.get(b.id) ?? 9999) ||
              (a.position ?? 0) - (b.position ?? 0)
            );
          const hasUncategorized = nonHot.some(e => !e.category_id);

          // Agrupamento
          const grouped: Array<{ cat: CategoryRow | null; items: EventRow[]; label?: string }> = [];
          if (categoryFilter === 'all') {
            const groupEntries = [
              ...visibleCats.map(c => ({ key: c.id, cat: c })),
              ...(hasUncategorized ? [{ key: '__uncategorized', cat: null as CategoryRow | null }] : []),
            ].sort((a, b) => (groupFirstIndex.get(a.key) ?? 9999) - (groupFirstIndex.get(b.key) ?? 9999));
            groupEntries.forEach(({ key, cat }) => {
              const items = sortByStatus(filtered.filter(e => key === '__uncategorized' ? !e.category_id : e.category_id === key));
              if (items.length) grouped.push({ cat, items });
            });
          } else if (categoryFilter.startsWith('competition:')) {
            const slug = categoryFilter.slice('competition:'.length);
            const label = filtered[0]?.competition_name || slug;
            if (filtered.length) grouped.push({ cat: null, items: filtered, label });
          } else if (categoryFilter.startsWith('category:')) {
            const name = categoryFilter.slice('category:'.length);
            const cat = cats.find(c => normCat(c.name) === name) || null;
            if (filtered.length) grouped.push({ cat, items: filtered, label: cat?.name || name });
          } else if (categoryFilter === 'today') {
            if (filtered.length) grouped.push({ cat: null, items: filtered, label: 'Hoje' });
          } else if (categoryFilter === 'uncategorized') {
            if (filtered.length) grouped.push({ cat: null, items: filtered });
          } else {
            const c = cats.find(x => x.id === categoryFilter) || null;
            if (filtered.length) grouped.push({ cat: c, items: filtered });
          }

          const displayedHotEvents = hotEvents.slice(0, visibleEventLimit);
          let remainingEventSlots = Math.max(0, visibleEventLimit - displayedHotEvents.length);
          const displayedGrouped = grouped
            .map(g => {
              const items = g.items.slice(0, remainingEventSlots);
              remainingEventSlots = Math.max(0, remainingEventSlots - items.length);
              return { ...g, items };
            })
            .filter(g => g.items.length > 0);
          const totalEventCount = hotEvents.length + grouped.reduce((sum, g) => sum + g.items.length, 0);
          const visibleEventCount = displayedHotEvents.length + displayedGrouped.reduce((sum, g) => sum + g.items.length, 0);
          const canShowMoreEvents = visibleEventCount < totalEventCount;


          const renderEvent = (ev: EventRow, detailMode = false) => {
            const outs = outcomesByEvent[ev.id] || [];
            const timeExpired = isBetDateTimeExpired(ev.closes_at);
            const closed = (ev.status !== 'open' && ev.status !== 'scheduled') || timeExpired;
            const finalized = ev.status === 'resolved' || ev.status === 'cancelled';
            const c = ev.payout_case_id ? casesById[ev.payout_case_id] : null;
            const evCat = ev.category_id ? cats.find(x => x.id === ev.category_id) : null;
            const catBg = evCat?.background_url || '';
            const ticketAccent = ev.is_hot ? '#f97316' : (evCat?.color || accent);
            const cardStyle: React.CSSProperties = catBg
              ? {
                  backgroundImage: `linear-gradient(180deg, rgba(2, 8, 18, 0.28) 0%, rgba(3, 10, 24, 0.78) 54%, rgba(3, 7, 15, 0.97) 100%), url(${optimizedImage(catBg, { width: detailMode ? 960 : 480, quality: 68 })})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  border: `2px solid ${ticketAccent}66`,
                  boxShadow: `0 10px 24px -18px ${ticketAccent}99, inset 0 1px 0 rgba(255,255,255,0.12)`,
                }
              : {
                  background: `linear-gradient(160deg, ${bg} 0%, ${cardBg} 100%)`,
                  border: `2px solid ${ticketAccent}66`,
                  boxShadow: `0 10px 24px -18px ${ticketAccent}99, inset 0 1px 0 rgba(255,255,255,0.12)`,
                };
            return (
              <article key={ev.id} className="relative rounded-2xl p-3 sm:p-3.5 overflow-hidden flex flex-col" style={cardStyle}>
                <div className="relative flex items-center justify-between gap-2 mb-2 text-[11px] font-semibold" style={{ color: text }}>
                  <span className="flex items-center gap-1.5 min-w-0 flex-1">
                    {ev.competition_name && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-[0.12em] truncate max-w-[60%]"
                        style={{ background: `${ticketAccent}22`, color: ticketAccent, border: `1px solid ${ticketAccent}44` }}
                        title={ev.competition_name}
                      >
                        🏆 {ev.competition_name}
                      </span>
                    )}
                    <span className="flex items-center gap-1 truncate tabular-nums" style={closed ? { color: '#f87171', fontWeight: 800, letterSpacing: '0.08em' } : { color: muted }}>
                      <Calendar size={11} />
                      <span className="truncate">{finalized ? 'FINALIZADO' : closed ? 'ENCERRADO' : (ev.closes_at ? formatBetDateTime(ev.closes_at) : eventStatusBadge(ev.status))}</span>
                    </span>
                  </span>
                  <span
                    className="flex items-center gap-1 shrink-0 pl-1.5 tabular-nums"
                    style={{ borderLeft: `1px solid ${text}22`, color: ticketAccent }}
                    title="Apostas em tempo real"
                  >
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: ticketAccent }} />
                    </span>
                    <b>{(wagerCounts[ev.id] || 0).toLocaleString('pt-BR')}</b>
                  </span>
                </div>


                <button
                  type="button"
                  onClick={() => { if (!detailMode) setSelectedEventId(ev.id); }}
                  className="relative w-full text-left rounded-xl p-3 mb-2.5 transition hover:brightness-110"
                  style={{ background: 'rgba(0,0,0,0.48)', border: `1px solid ${text}14`, cursor: detailMode ? 'default' : 'pointer' }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {ev.is_hot && <span className="inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full mb-1" style={{ background: '#f9731633', color: '#f97316', border: '#f9731655' }}>🔥</span>}
                      <h2 className="font-black text-base sm:text-base leading-tight line-clamp-2" style={{ color: text, textShadow: '0 2px 12px rgba(0,0,0,0.55)' }}>{ev.title}</h2>
                      {ev.subtitle && <p className="text-[11px] mt-0.5 line-clamp-1" style={{ color: muted }}>{translatePt(ev.subtitle)}</p>}
                    </div>
                    {(ev.home_image_url || ev.away_image_url) ? (
                      <div className="flex items-center gap-1 flex-shrink-0 px-2 py-1.5 rounded-md" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        {ev.home_image_url
                          ? <img src={optimizedImage(ev.home_image_url, { width: 96, quality: 70 })} alt="" loading="lazy" decoding="async" className="w-8 h-8 sm:w-7 sm:h-7 object-contain" />
                          : <div className="w-8 h-8 sm:w-7 sm:h-7" />}
                        <span className="text-[9px] font-bold opacity-60" style={{ color: text }}>VS</span>
                        {ev.away_image_url
                          ? <img src={optimizedImage(ev.away_image_url, { width: 96, quality: 70 })} alt="" loading="lazy" decoding="async" className="w-8 h-8 sm:w-7 sm:h-7 object-contain" />
                          : <div className="w-8 h-8 sm:w-7 sm:h-7" />}
                      </div>
                    ) : ev.image_url && (
                      <img src={optimizedImage(ev.image_url, { width: 200, quality: 70 })} alt="" loading="lazy" decoding="async" className="w-16 h-10 sm:w-16 sm:h-10 rounded-md object-cover flex-shrink-0 border border-white/10" />
                    )}
                  </div>
                </button>
                {ev.payout_mode === 'case' && c && (
                  <div className="relative flex items-center gap-2 mb-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(0,0,0,0.48)', border: `1px solid ${text}12` }}>
                    {c.image_url && <img src={optimizedImage(c.image_url, { width: 96, quality: 70 })} loading="lazy" decoding="async" className="w-8 h-8 rounded" alt="" />}
                    <span className="text-xs">Prêmio: caixa <b>{c.name}</b> ({ev.payout_case_qty_per_unit}× por unidade apostada)</span>
                  </div>
                )}
                {(() => {
                  const evMarkets = marketsByEvent[ev.id] || [];
                  // Group outcomes: by market if available, else fallback to single "main" group
                  const groups: Array<{ market: MarketRow | null; outs: OutcomeRow[] }> = [];
                  if (evMarkets.length) {
                    evMarkets.forEach(mk => {
                      const mOuts = outcomesByMarket[mk.id] || [];
                      if (mOuts.length) groups.push({ market: mk, outs: mOuts });
                    });
                    const orphan = outs.filter(o => !o.market_id);
                    if (orphan.length) groups.push({ market: null, outs: orphan });
                  } else {
                    if (outs.length) groups.push({ market: null, outs });
                  }
                  const evExpanded = detailMode || !!expandedEvents[ev.id];
                  // Pick principal market: prefer OPEN main-titled markets (strict match), then any open, then fallback
                  const norm = (s: string | null | undefined) => (s || '').trim().toLowerCase();
                  const MAIN_TITLES_FE = new Set([
                    'match winner', 'full time result', 'home/away',
                    '1x2', 'vencedor', 'vencedor do jogo', 'resultado final', 'resultado',
                  ]);
                  const isMainTitle = (m: MarketRow | null) => MAIN_TITLES_FE.has(norm(m?.title));
                  const isOpenMk = (m: MarketRow | null) => !m || (m.status === 'open' && !isBetDateTimeExpired(m.closes_at));
                  let principalIdx = groups.findIndex(g => isMainTitle(g.market) && isOpenMk(g.market) && g.outs.length >= 2);
                  if (principalIdx < 0) principalIdx = groups.findIndex(g => isOpenMk(g.market) && g.outs.length >= 2);
                  if (principalIdx < 0) principalIdx = groups.findIndex(g => isMainTitle(g.market) && g.outs.length >= 2);
                  if (principalIdx < 0) principalIdx = groups.findIndex(g => g.outs.length === 3);
                  if (principalIdx < 0) principalIdx = groups.findIndex(g => g.outs.length === 2);
                  if (principalIdx < 0) principalIdx = 0;
                  if (principalIdx > 0) {
                    const [pg] = groups.splice(principalIdx, 1);
                    groups.unshift(pg);
                  }
                  const hasFullMarkets = detailMode || !!detailedEventIds[ev.id];
                  const extraCount = hasFullMarkets ? Math.max(0, groups.length - 1) : (groups.length > 0 ? 1 : 0);
                  const visibleGroups = evExpanded ? groups : groups.slice(0, 1);
                  return (
                    <>
                      {groups.length === 0 && !closed && !finalized && (
                        <div className="px-3 py-1.5 rounded-lg text-[11px] uppercase tracking-[0.15em] font-bold text-center flex items-center justify-center gap-2" style={{ background: `${ticketAccent}1a`, color: ticketAccent, border: `1px dashed ${ticketAccent}55` }}>
                          <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ background: ticketAccent }} />
                          Odds em breve
                        </div>
                      )}
                      {!detailMode && evExpanded && extraCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setExpandedEvents(s => ({ ...s, [ev.id]: false }))}
                          className="mb-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] uppercase tracking-[0.15em] font-bold transition hover:brightness-110"
                          style={{ background: `${ticketAccent}1a`, color: ticketAccent, border: `1px dashed ${ticketAccent}55` }}
                        >
                          Esconder mercados <ChevronUp size={14} />
                        </button>
                      )}
                      {visibleGroups.map((g, gi) => {
                    const mk = g.market;
                    const mkClosed = mk
                      ? (closed || mk.status !== 'open' || isBetDateTimeExpired(mk.closes_at))
                      : closed;
                    const mkCase = mk?.payout_case_id ? casesById[mk.payout_case_id] : null;
                    const isPrincipal = gi === 0;
                    const showHeader = !isPrincipal && !!mk;
                    const collapseKey = `${ev.id}:${mk?.id || 'main'}`;
                    const collapsed = !isPrincipal && (collapsedMarkets[collapseKey] ?? true);
                    return (
                      <div key={mk?.id || `g${gi}`} className={gi > 0 ? 'mt-2' : ''}>
                        {showHeader && (
                          <button
                            type="button"
                            onClick={() => setCollapsedMarkets(s => ({ ...s, [collapseKey]: !(s[collapseKey] ?? true) }))}
                            className="relative w-full flex items-center justify-between gap-2 mb-2 px-2 py-1.5 rounded-md transition hover:opacity-90"
                            style={{ background: `${ticketAccent}14`, border: `1px solid ${ticketAccent}33` }}
                          >
                            <h3 className="text-[10px] uppercase tracking-[0.18em] font-black flex items-center gap-2" style={{ color: ticketAccent }}>
                              <span className="inline-block w-1 h-3 rounded-sm" style={{ background: ticketAccent }} />
                              {translatePt(mk!.title)}
                            </h3>
                            <span className="flex items-center gap-2">
                              {mk!.status !== 'open' && (
                                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded" style={{ background: '#ef444433', color: '#f87171' }}>
                                  {mk!.status === 'resolved' ? 'Resolvido' : mk!.status === 'closed' ? 'Fechado' : 'Cancelado'}
                                </span>
                              )}
                              {collapsed ? <ChevronDown size={14} style={{ color: ticketAccent }} /> : <ChevronUp size={14} style={{ color: ticketAccent }} />}
                            </span>
                          </button>
                        )}
                        {!collapsed && mk?.payout_mode === 'case' && mkCase && (
                          <div className="relative flex items-center gap-2 mb-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(0,0,0,0.48)', border: `1px solid ${text}12` }}>
                            {mkCase.image_url && <img src={optimizedImage(mkCase.image_url, { width: 96, quality: 70 })} loading="lazy" decoding="async" className="w-8 h-8 rounded" alt="" />}
                            <span className="text-xs">Prêmio: caixa <b>{mkCase.name}</b> ({mk.payout_case_qty_per_unit}× por unidade apostada)</span>
                          </div>
                        )}
                        {!collapsed && mkClosed && (mk ? mk.status !== 'resolved' : ev.status !== 'resolved') && (
                          <div className="px-3 py-2 rounded-lg text-[11px] uppercase tracking-[0.15em] font-bold text-center" style={{ background: '#ef444422', color: '#f87171', border: '1px dashed #ef444455' }}>
                            Mercado encerrado
                          </div>
                        )}
                        {!collapsed && !(mkClosed && (mk ? mk.status !== 'resolved' : ev.status !== 'resolved')) && (

                        <div className={`relative grid gap-2 ${g.outs.length === 2 ? 'grid-cols-2' : g.outs.length === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3'}`}>
                          {g.outs.map(o => {
                            const resolvedFlag = mk ? mk.status === 'resolved' : ev.status === 'resolved';
                            const isWinner = resolvedFlag && o.is_winner;
                            const isLoser = resolvedFlag && !o.is_winner;
                            const stat = outcomeStats[o.id] || { count: 0, total: 0 };
                            const inTicket = ticketDraftOutcomeIds.has(o.id);
                            const oMarketKey = o.market_id || 'main';
                            const sameMarketExists = ticketDraftMarketKeys.has(`${ev.id}|${oMarketKey}`);
                            const oMarketTitle = mk?.title || 'Resultado Final';
                            const coherence = (!inTicket && !sameMarketExists && ticketDraftProjection.length > 0)
                              ? canAddSelection(
                                  ticketDraftProjection,
                                  { eventId: ev.id, marketId: o.market_id, marketTitle: oMarketTitle, outcomeLabel: o.label, eventTitle: ev.title },
                                )
                              : { ok: true as const, reason: undefined as string | undefined };
                            const incoherent = !coherence.ok;
                            return (
                              <div key={o.id} className="relative">
                                <button
                                  onClick={() => {
                                    if (incoherent) return;
                                    if (isMobile) {
                                      if (inTicket) removeFromTicket(o.id);
                                      else addToTicket(ev, o);
                                    } else {
                                      openSlip(ev, o);
                                    }
                                  }}
                                  disabled={mkClosed || incoherent}
                                  title={incoherent ? (coherence.reason || 'Combinação não permitida com seleções do bilhete') : undefined}
                                  className="relative w-full px-2.5 py-2 rounded-lg text-left transition disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] overflow-hidden"
                                  style={{
                                    background: isWinner ? `${ticketAccent}33` : 'rgba(0,0,0,0.5)',
                                    border: `1px solid ${isWinner ? ticketAccent : `${ticketAccent}44`}`,
                                    boxShadow: isWinner ? `0 0 22px ${ticketAccent}33` : `inset 0 -1px 0 ${ticketAccent}44`,
                                    color: isLoser ? muted : text,
                                  }}>
                                  <div aria-hidden className="absolute inset-x-0 bottom-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${ticketAccent}, transparent)` }} />
                                  <div className="text-[9px] uppercase tracking-[0.15em] font-bold mb-0.5 truncate pr-6" style={{ color: muted }}>{outcomeLabelForCard(o.label, ev.title)}</div>
                                  <div className="text-base sm:text-lg font-black tabular-nums leading-none" style={{ color: isWinner ? ticketAccent : text, textShadow: isWinner ? `0 0 12px ${ticketAccent}55` : undefined }}>{Number(o.odd).toFixed(2).replace('.', ',')}</div>
                                  <div className="mt-1.5 pt-1.5 border-t flex items-center justify-between gap-1 text-[9px] tabular-nums" style={{ borderColor: `${ticketAccent}22`, color: muted }}>
                                    <span className="flex items-center gap-1"><Ticket size={9} /><b style={{ color: text }}>{stat.count.toLocaleString('pt-BR')}</b></span>
                                    <span className="truncate"><b style={{ color: text }}>{stat.total.toLocaleString('pt-BR')}</b> {coinName}</span>
                                  </div>
                                </button>
                                {!mkClosed && !incoherent && (
                                  <button
                                    type="button"
                                    title={inTicket ? 'Remover do bilhete' : 'Adicionar ao bilhete'}
                                    onClick={(e) => { e.stopPropagation(); inTicket ? removeFromTicket(o.id) : addToTicket(ev, o); }}
                                    className="absolute top-1 right-1 z-10 w-5 h-5 rounded-full flex items-center justify-center transition hover:scale-110"
                                    style={{
                                      background: inTicket ? ticketAccent : `${ticketAccent}33`,
                                      color: inTicket ? '#000' : ticketAccent,
                                      border: `1px solid ${ticketAccent}`,
                                    }}
                                  >
                                    {inTicket ? <Check size={11} strokeWidth={3} /> : <Plus size={12} strokeWidth={3} />}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        )}
                      </div>
                    );
                  })}
                  {!detailMode && !closed && extraCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedEventId(ev.id)}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] uppercase tracking-[0.15em] font-bold transition hover:brightness-110"
                      style={{ background: `${ticketAccent}1a`, color: ticketAccent, border: `1px dashed ${ticketAccent}55` }}
                    >
                      {hasFullMarkets ? `+${extraCount} mercados` : 'Ver todos os mercados'} <ChevronDown size={14} />
                    </button>
                  )}

                    </>
                  );
                })()}
                {ev.status === 'open' && timeExpired && (
                  <div className="relative mt-3 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: '#ef444433', color: '#ef4444' }}>Apostas encerradas (prazo expirado)</div>
                )}
              </article>
            );
          };

          // Detail mode: show only the selected event in full width
          if (selectedEventId) {
            const selectedEvent = events.find(e => e.id === selectedEventId);
            return (
              <div className="space-y-4">
                <button
                  onClick={() => setSelectedEventId(null)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition hover:brightness-110"
                  style={{ background: `${accent}22`, border: `1px solid ${accent}55`, color: text }}
                >
                  <ChevronUp size={16} style={{ transform: 'rotate(-90deg)' }} />
                  Voltar aos jogos
                </button>
                {selectedEvent ? (
                  <div className="max-w-2xl mx-auto space-y-3">
                    {loadingDetailEventId === selectedEvent.id && (
                      <div className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold" style={{ background: `${accent}16`, color: accent, border: `1px solid ${accent}33` }}>
                        <Loader2 className="animate-spin" size={16} /> Carregando mercados...
                      </div>
                    )}
                    {renderEvent(selectedEvent, true)}
                  </div>
                ) : (
                  <div className="text-center py-16" style={{ color: muted }}>
                    Evento não encontrado.
                  </div>
                )}
              </div>
            );
          }

          return (
            <div className="space-y-6">
              {events.length === 0 && (
                <div className="text-center py-16" style={{ color: muted }}>
                  Nenhum evento disponível no momento.
                </div>
              )}

              {/* Search input */}
              {events.length > 0 && (
                <div className="relative">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                    style={{ color: muted }}
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por time, competição..."
                    className="w-full pl-9 pr-9 py-2.5 rounded-xl text-sm outline-none transition focus:brightness-110"
                    style={{
                      background: '#00000055',
                      color: text,
                      border: `1px solid ${accent}55`,
                    }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition hover:brightness-125"
                      style={{ background: `${accent}33`, color: text }}
                      aria-label="Limpar busca"
                    >
                      ×
                    </button>
                  )}
                </div>
              )}


              {/* Hot events — always shown on top, ignore filter */}
              {displayedHotEvents.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🔥</span>
                    <h3 className="font-bold uppercase tracking-wider text-sm" style={{ color: '#f97316' }}>Eventos quentes</h3>
                    <div className="flex-1 h-px" style={{ background: '#f9731633' }} />
                  </div>
                  <HotEventsCarousel events={displayedHotEvents} renderEvent={renderEvent} />

                </section>
              )}

              {/* Filtros: categorias (linha 1) + competições da categoria selecionada (linha 2) */}
              {(() => {
                // Top-level: somente categorias
                const TOP: Array<{ key: string; label: string; icon?: string }> = [
                  { key: 'all', label: 'Todos' },
                  { key: 'today', label: 'Hoje', icon: '📅' },
                  { key: 'category:futebol', label: 'Futebol', icon: '⚽' },
                ];
                // Sub-chips de competições por categoria (base fixa + dinâmicas dos eventos)
                const BASE_SUBS: Record<string, Array<{ key: string; label: string; icon?: string }>> = {
                  'category:futebol': [
                    { key: 'competition:world-cup-2026', label: 'Copa do Mundo', icon: '🏆' },
                    { key: 'competition:brasileirao', label: 'Brasileirão', icon: '🇧🇷' },
                    { key: 'competition:champions-league', label: 'Champions League', icon: '⭐' },
                    { key: 'competition:libertadores', label: 'Libertadores', icon: '🌎' },
                  ],
                };
                const futebolDynamic: Array<{ key: string; label: string; icon?: string }> = [];
                const seenSlugs = new Set(BASE_SUBS['category:futebol'].map(s => s.key));
                nonHot.forEach(e => {
                  const evCatName = normCat(e.category) || normCat(cats.find(c => c.id === e.category_id)?.name);
                  if (evCatName !== 'futebol') return;
                  if (!e.competition_slug) return;
                  const key = `competition:${e.competition_slug}`;
                  if (seenSlugs.has(key)) return;
                  seenSlugs.add(key);
                  futebolDynamic.push({ key, label: e.competition_name || e.competition_slug });
                });
                const SUBS: Record<string, Array<{ key: string; label: string; icon?: string }>> = {
                  'category:futebol': [...BASE_SUBS['category:futebol'], ...futebolDynamic],
                };
                const hasMatches = (key: string) => {
                  if (key === 'all') return true;
                  if (key === 'today') return nonHot.some(isToday);
                  if (key.startsWith('competition:')) {
                    const slug = key.slice('competition:'.length);
                    return nonHot.some(e => e.competition_slug === slug);
                  }
                  if (key.startsWith('category:')) {
                    const name = key.slice('category:'.length);
                    return nonHot.some(e => {
                      const evCatName = normCat(e.category) || normCat(cats.find(c => c.id === e.category_id)?.name);
                      return evCatName === name;
                    });
                  }
                  return false;
                };
                const visibleTop = TOP.filter(c => c.key === 'all' || hasMatches(c.key));
                const fixedKeys = new Set(visibleTop.map(c => c.key));
                const dynamicCategoryChips = cats
                  .filter(c => nonHot.some(e => e.category_id === c.id))
                  .map(c => ({ key: c.name.trim().toLowerCase() === 'futebol' ? 'category:futebol' : c.id, label: c.name, icon: c.icon || undefined }))
                  .filter(c => !fixedKeys.has(c.key));
                const topChips = [...visibleTop, ...dynamicCategoryChips];

                const activeParentKey = (() => {
                  if (categoryFilter.startsWith('category:')) return categoryFilter;
                  if (categoryFilter.startsWith('competition:')) {
                    for (const [parent, subs] of Object.entries(SUBS)) {
                      if (subs.some(s => s.key === categoryFilter)) return parent;
                    }
                  }
                  return null;
                })();
                const subChips = activeParentKey ? (SUBS[activeParentKey] || []).filter(c => hasMatches(c.key)) : [];

                if (topChips.length <= 1 && subChips.length === 0) return null;

                const renderRow = (items: Array<{ key: string; label: string; icon?: string }>, keyPrefix: string) => (
                  <div className="relative -mx-3">
                    <div
                      className="bets-chips-scroll flex gap-2 overflow-x-auto px-3 py-2 scroll-smooth snap-x"
                      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                      {items.map(({ key, label, icon }) => {
                        const active = categoryFilter === key;
                        return (
                          <button key={`${keyPrefix}-${key}`} onClick={() => setCategoryFilter(active ? 'all' : key)}
                            className="shrink-0 snap-start px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition whitespace-nowrap"
                            style={{
                              background: active ? accent : '#00000055',
                              color: active ? '#000' : text,
                              border: `1px solid ${active ? accent : accent + '55'}`,
                            }}>
                            {icon ? `${icon} ` : ''}{label}
                          </button>
                        );
                      })}
                    </div>
                    <div aria-hidden className="pointer-events-none absolute top-0 right-0 h-full w-8" style={{ background: `linear-gradient(90deg, transparent, ${bg})` }} />
                  </div>
                );

                return (
                  <div className="space-y-1">
                    <style>{`.bets-chips-scroll::-webkit-scrollbar{display:none}`}</style>
                    {topChips.length > 1 && renderRow(topChips, 'top')}
                    {subChips.length > 0 && (
                      <div className="pl-3 pt-1 border-l-2" style={{ borderColor: `${accent}55` }}>
                        {renderRow(subChips, 'sub')}
                      </div>
                    )}
                  </div>
                );
              })()}


              {/* Grouped events */}
              {displayedGrouped.map((g, i) => (
                <section key={g.cat?.id || g.label || `unc-${i}`} className="space-y-3">
                  <div className="flex items-center gap-2">
                    {g.cat?.icon && <span>{g.cat.icon}</span>}
                    <h3 className="font-bold uppercase tracking-wider text-sm" style={{ color: g.cat?.color || muted }}>
                      {g.label || g.cat?.name || 'Outros'}
                    </h3>
                    <div className="flex-1 h-px" style={{ background: (g.cat?.color || accent) + '33' }} />
                    <span className="text-xs" style={{ color: muted }}>{g.items.length}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{g.items.map(ev => renderEvent(ev))}</div>
                </section>
              ))}

              {canShowMoreEvents && (
                <button
                  type="button"
                  onClick={() => setVisibleEventLimit(v => v + 18)}
                  className="w-full py-3 rounded-xl text-sm font-black uppercase tracking-wider transition hover:brightness-110"
                  style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}55` }}
                >
                  Ver mais jogos ({totalEventCount - visibleEventCount})
                </button>
              )}

              {hotEvents.length === 0 && grouped.length === 0 && events.length > 0 && (
                <div className="text-center py-16" style={{ color: muted }}>
                  {normSearch ? `Nenhum evento encontrado para "${searchQuery}".` : 'Nenhum evento nesta categoria.'}
                </div>
              )}
            </div>
          );
        })()}

        {tab === 'mine' && (
          <div className="space-y-2">
            {myWagers.length === 0 && myTickets.length === 0 && (
              <div className="text-center py-16" style={{ color: muted }}>Você ainda não fez apostas.</div>
            )}
            {myTickets.length > 0 && (
              <div className="space-y-2 mb-4">
                <div className="text-xs font-bold uppercase tracking-wider px-1" style={{ color: accent }}>
                  Bilhetes múltiplos
                </div>
                {myTickets.map(t => {
                  const sels = myTicketSelections.filter(s => s.ticket_id === t.id);
                  const statusLabel: Record<string, string> = {
                    pending: 'Pendente', won: 'Ganhou', lost: 'Perdeu', refunded: 'Devolvido', cancelled: 'Cancelado',
                  };
                  const statusColor: Record<string, string> = {
                    pending: muted, won: '#22c55e', lost: '#ef4444', refunded: '#eab308', cancelled: muted,
                  };
                  const selStatusColor: Record<string, string> = {
                    pending: muted, won: '#22c55e', lost: '#ef4444', cancelled: muted,
                  };
                  return (
                    <div key={t.id} className="rounded-xl p-4"
                      style={{ background: cardBg, border: `1px solid ${accent}33` }}>
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                              style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}55` }}>
                              Múltipla · {sels.length}
                            </span>
                            {t.public_code && (
                              <span className="text-[10px] font-mono tracking-wider" style={{ color: accent }}>
                                #{t.public_code}
                              </span>
                            )}
                          </div>
                          <div className="text-xs mt-1" style={{ color: muted }}>
                            {t.stake} {coinName} · odd total {Number(t.total_odd).toFixed(2)} · retorno {t.potential_return} {coinName}
                          </div>
                        </div>
                        <div className="text-right shrink-0 flex items-start gap-2">
                          <div>
                            <div className="text-sm font-bold" style={{ color: statusColor[t.status] }}>{statusLabel[t.status]}</div>
                            {t.status === 'won' && (
                              <div className="text-xs" style={{ color: muted }}>+{t.payout_coins}</div>
                            )}
                          </div>
                          {cfg.ticketEnabled !== false && ['pending', 'won', 'lost'].includes(t.status) && (
                            <button
                              onClick={async () => {
                                const copyUrl = await createShortShareLink(
                                  tag,
                                  sels.map(s => ({ e: s.event_id, o: s.outcome_id }))
                                );
                                setShareMultiple({
                                  userId: authed?.account_id || authed?.id,
                                  wagerCode: t.public_code,
                                  selections: sels.map(s => ({
                                    eventTitle: s.event_title,
                                    marketTitle: s.market_title,
                                    outcomeLabel: s.selection_label,
                                    odd: Number(s.odd),
                                    status: s.status as any,
                                  })),
                                  totalOdd: Number(t.total_odd),
                                  amount: t.stake,
                                  payout: t.status === 'won' ? t.payout_coins : t.status === 'lost' ? 0 : t.potential_return,
                                  status: t.status as any,
                                  coinName,
                                  createdAt: t.created_at,
                                  copyUrl,
                                });
                              }}
                              title="Compartilhar bilhete"
                              className="p-2 rounded-lg transition hover:opacity-80"
                              style={{ background: `${accent}22`, border: `1px solid ${accent}55`, color: accent }}
                            >
                              <Share2 size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setExpandedTickets(prev => {
                                const next = new Set(prev);
                                if (next.has(t.id)) next.delete(t.id); else next.add(t.id);
                                return next;
                              });
                            }}
                            title={expandedTickets.has(t.id) ? 'Recolher' : 'Expandir'}
                            className="p-2 rounded-lg transition hover:opacity-80"
                            style={{ background: `${accent}22`, border: `1px solid ${accent}55`, color: accent }}
                          >
                            {expandedTickets.has(t.id) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </div>
                      </div>
                      {expandedTickets.has(t.id) ? (
                        <div className="space-y-1.5 pt-2" style={{ borderTop: `1px solid ${accent}22` }}>
                          {sels.map(s => (
                            <div key={s.id} className="flex items-center justify-between gap-2 text-xs">
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-medium">{s.event_title}</div>
                                <div className="truncate" style={{ color: muted }}>
                                  {translatePt(s.market_title)} · <span style={{ color: accent }}>{translateOutcomeLabel(s.selection_label)}</span> · {Number(s.odd).toFixed(2)}
                                </div>
                              </div>
                              <span className="text-[10px] font-bold shrink-0" style={{ color: selStatusColor[s.status] }}>
                                {statusLabel[s.status]}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <button
                          onClick={() => setExpandedTickets(prev => { const n = new Set(prev); n.add(t.id); return n; })}
                          className="w-full text-[11px] pt-2 text-left hover:opacity-80 transition"
                          style={{ borderTop: `1px solid ${accent}22`, color: muted }}
                        >
                          {sels.length} seleções · clique para ver detalhes
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {myWagers.length > 0 && myTickets.length > 0 && (
              <div className="text-xs font-bold uppercase tracking-wider px-1 pt-2" style={{ color: accent }}>
                Apostas simples
              </div>
            )}
            {myWagers.map(w => {
              const ev = myEvents.find(e => e.id === w.event_id);
              const statusLabel: Record<string, string> = {
                pending: 'Pendente', won: 'Ganhou', lost: 'Perdeu', refunded: 'Devolvida', cancelled: 'Cancelada',
              };
              const statusColor: Record<string, string> = {
                pending: muted, won: '#22c55e', lost: '#ef4444', refunded: '#eab308', cancelled: muted,
              };
              const outcome = (page?.outcomes || []).find((o: OutcomeRow) => o.id === w.outcome_id)
                || myOutcomes.find((o: any) => o.id === w.outcome_id);
              const canShare = cfg.ticketEnabled !== false && (w.status === 'won' || w.status === 'lost' || w.status === 'pending');
              const openShare = async () => {
                if (!ev) return;
                const payout = w.status === 'won'
                  ? w.payout_coins
                  : w.status === 'lost'
                    ? 0
                    : Math.round(w.amount_coins * Number(w.odd_snapshot));
                const copyUrl = await createShortShareLink(tag, [{ e: w.event_id, o: w.outcome_id }]);
                setShareWager({
                  userId: authed?.account_id || authed?.id,
                  wagerCode: w.public_code,
                  eventTitle: ev.title,
                  outcomeLabel: outcome?.label || '—',
                  odd: Number(w.odd_snapshot),
                  amount: w.amount_coins,
                  payout,
                  status: w.status,
                  payoutMode: w.payout_mode,
                  coinName,
                  createdAt: w.created_at,
                  copyUrl,
                });
              };
              return (
                <div key={w.id} className="rounded-xl p-4 flex items-center justify-between gap-3"
                  style={{ background: cardBg, border: `1px solid ${accent}22` }}>
                  {(() => {
                    const mk = outcome?.market_id
                      ? ((page?.markets || []).find((m: MarketRow) => m.id === outcome.market_id)
                          || myMarkets.find((m: any) => m.id === outcome.market_id))
                      : null;
                    const marketTitle = mk?.title || 'Resultado Final';
                    return (
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{ev?.title || w.event_id.slice(0, 8)}</div>
                        <div className="text-xs mt-1 flex flex-wrap items-center gap-1.5">
                          <span
                            className="inline-block px-2 py-0.5 rounded-md font-bold"
                            style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}55` }}
                          >
                            {outcome?.label || '—'}
                          </span>
                          <span style={{ color: muted }}>{marketTitle}</span>
                        </div>
                        <div className="text-xs mt-1" style={{ color: muted }}>
                          {w.amount_coins} {coinName} · odd {Number(w.odd_snapshot).toFixed(2)}
                          {w.payout_mode === 'case' ? ' · Prêmio: caixa' : ` · Retorno: ${Math.round(w.amount_coins * Number(w.odd_snapshot))} ${coinName}`}
                        </div>
                        {w.public_code && (
                          <div className="text-[10px] mt-1 font-mono tracking-wider" style={{ color: accent }}>
                            ID: {w.public_code}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="text-sm font-bold" style={{ color: statusColor[w.status] }}>{statusLabel[w.status]}</div>
                      {w.status === 'won' && w.payout_mode === 'coins' && (
                        <div className="text-xs" style={{ color: muted }}>+{w.payout_coins}</div>
                      )}
                    </div>
                    {canShare && (
                      <button
                        onClick={openShare}
                        title="Compartilhar bilhete"
                        className="p-2 rounded-lg transition hover:opacity-80"
                        style={{ background: `${accent}22`, border: `1px solid ${accent}55`, color: accent }}
                      >
                        <Share2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {shareWager && (
        <Suspense fallback={null}>
          <ShareTicket
            open={!!shareWager}
            onClose={() => setShareWager(null)}
            data={shareWager}
            config={cfg.ticket || {}}
          />
        </Suspense>
      )}

      {shareMultiple && (
        <Suspense fallback={null}>
          <ShareTicketMultiple
            open={!!shareMultiple}
            onClose={() => setShareMultiple(null)}
            data={shareMultiple}
            config={cfg.ticket || {}}
          />
        </Suspense>
      )}

      {/* Bet slip */}
      {slip && (
        <div className="fixed inset-0 z-30 bg-black/75 flex items-end sm:items-center justify-center p-4"
          onClick={() => setSlip(null)}>
          <div
            className="w-full max-w-sm rounded-2xl p-5 relative overflow-hidden"
            style={{
              background: `linear-gradient(160deg, ${bg} 0%, ${cardBg} 100%)`,
              border: `2px solid ${accent}55`,
              boxShadow: `0 0 60px ${accent}26`,
              color: text,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div aria-hidden className="absolute -top-24 -right-24 w-44 h-44 rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, ${accent}18, transparent 70%)` }} />
            <div className="relative flex items-center justify-center mb-5 pt-1">
              <div className="flex w-full items-center justify-center min-w-0 px-9">
                {cfg.logoUrl ? (
                  <img src={optimizedImage(cfg.logoUrl, { width: 440, quality: 80 })} alt="" loading="lazy" decoding="async" className="h-20 w-full max-w-[220px] object-contain" />
                ) : (
                  <span className="font-black text-base truncate" style={{ color: accent }}>{cfg.title || 'Apostas'}</span>
                )}
              </div>
              <div className="absolute right-0 top-0 text-[10px] font-bold tracking-[0.2em] px-2 py-1 rounded-full" style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}55` }}>
                BILHETE
              </div>
              <button onClick={() => setSlip(null)} className="absolute left-0 top-0 p-1.5 rounded-full" style={{ background: '#00000044', color: text }}>
                <X size={15} />
              </button>
            </div>

            <h2 className="relative text-center text-2xl font-black leading-tight mb-4" style={{ color: accent, textShadow: `0 0 16px ${accent}55` }}>
              Cupom de aposta
            </h2>

            <div className="relative flex items-center justify-between gap-2 mb-3 px-1 text-[11px] font-semibold" style={{ color: text }}>
              <div className="flex items-center gap-1.5 min-w-0">
                <Calendar size={13} />
                <span className="truncate tabular-nums">{formatBetDateTime(new Date().toISOString())}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 pl-2" style={{ borderLeft: `1px solid ${text}22` }}>
                <Ticket size={13} />
                <span className="tracking-wider">PRÉVIA</span>
              </div>
            </div>

            <div className="relative rounded-xl p-3 mb-3" style={{ background: cardBg, border: `1px solid ${text}11` }}>
              <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: muted }}>Evento</div>
              <div className="font-bold text-sm leading-snug mb-2">{slip.event.title}</div>
              <div className="inline-block px-2.5 py-1 rounded-md font-bold text-xs" style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}55` }}>
                {translateOutcomeLabel(slip.outcome.label)}
              </div>
            </div>

            <div className="relative mb-2">
              <label className="block text-[10px] uppercase tracking-[0.18em] font-bold mb-1.5" style={{ color: accent }}>Valor da aposta</label>
              <div className="flex gap-2">
                <div className="flex-1 relative rounded-xl overflow-hidden" style={{ background: cardBg, border: `2px solid ${accent}`, boxShadow: `0 0 18px ${accent}33` }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    value={amount}
                    onFocus={e => e.currentTarget.select()}
                    onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Digite o valor"
                    className="w-full bg-transparent outline-none font-black text-2xl tabular-nums px-3 py-3"
                    style={{ color: accent }}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-wider pointer-events-none" style={{ color: muted }}>{coinName}</span>
                </div>
                <div className="w-24 rounded-xl px-3 py-3 flex flex-col justify-center" style={{ background: cardBg, border: `1px solid ${text}15` }}>
                  <div className="text-[9px] uppercase tracking-[0.15em] font-bold" style={{ color: muted }}>Cota</div>
                  <div className="font-black text-xl tabular-nums leading-none mt-0.5" style={{ color: text }}>{Number(slip.outcome.odd).toFixed(2).replace('.', ',')}</div>
                </div>
              </div>
            </div>

            <div className="relative flex items-center justify-between gap-2 mb-3 px-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: muted }}>
              <span>Mín: <span className="tabular-nums" style={{ color: text }}>{SIMPLE_MIN_BET} {coinName}</span></span>
              <span>Máx: <span className="tabular-nums" style={{ color: text }}>{SIMPLE_MAX_BET} {coinName}</span></span>
            </div>

            <div className="relative grid grid-cols-5 gap-2 mb-3">
              {[10, 50, 100, 500].map(v => (
                <button key={v} type="button" onClick={() => setAmount(String(Math.min(v, SIMPLE_MAX_BET)))}
                  className="py-2 rounded-lg text-xs font-bold transition hover:opacity-90" style={{ background: '#00000044', color: text, border: `1px solid ${text}10` }}>
                  {v}
                </button>
              ))}
              <button type="button" onClick={() => setAmount(String(Math.min(authed?.tokens_balance ?? 0, SIMPLE_MAX_BET)))}
                className="py-2 rounded-lg text-xs font-bold transition hover:opacity-90" style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}44` }}>
                Tudo
              </button>
            </div>

            <div className="relative rounded-xl px-4 py-3 mb-4 space-y-2" style={{ background: cardBg, border: `1px solid ${text}11` }}>
              <div className="flex items-center justify-between text-sm"><span style={{ color: muted }}>Saldo</span><span className="tabular-nums font-semibold">{authed?.tokens_balance ?? 0} {coinName}</span></div>
              <div className="flex items-center justify-between text-sm"><span style={{ color: muted }}>Aposta</span><span className="tabular-nums font-semibold">{Math.floor(Number(amount) || 0)} {coinName}</span></div>
              <div className="flex items-center justify-between gap-3 pt-2 border-t" style={{ borderColor: `${text}11` }}>
                <span className="text-[11px] uppercase tracking-wider font-bold" style={{ color: muted }}>Retorno potencial</span>
                <span className="font-black text-lg tabular-nums text-right" style={{ color: accent }}>
                  {slip.event.payout_mode === 'case'
                    ? `${Math.max(1, Math.floor((Number(amount) || 0) * slip.event.payout_case_qty_per_unit))}× caixa`
                    : `${Math.round((Number(amount) || 0) * Number(slip.outcome.odd)).toLocaleString('pt-BR')} ${coinName}`}
                </span>
              </div>
            </div>

            <button onClick={placeBet} disabled={placing}
              className="relative w-full py-3 rounded-xl font-black flex items-center justify-center gap-2 disabled:opacity-50 transition hover:opacity-90"
              style={{ background: accent, color: '#000' }}>
              {placing ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
              Confirmar aposta
            </button>
          </div>
        </div>
      )}

      {/* Floating ticket button */}
      {authed && ticketDraft.length > 0 && !ticketOpen && (
        <button
          onClick={() => setTicketOpen(true)}
          className="fixed bottom-4 right-4 z-40 px-4 py-3 rounded-full shadow-xl font-bold flex items-center gap-2 transition hover:scale-105"
          style={{ background: accent, color: '#000' }}
        >
          <Ticket size={18} />
          Meu Bilhete
          <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-black tabular-nums" style={{ background: '#000', color: accent }}>
            {ticketDraft.length} · {totalOdd.toFixed(2).replace('.', ',')}
          </span>
        </button>
      )}

      {/* Ticket modal */}
      {ticketOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4" onClick={() => setTicketOpen(false)}>
          <div
            className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 max-h-[90vh] overflow-y-auto"
            style={{ background: cardBg, color: text, border: `1px solid ${accent}55` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-black text-lg flex items-center gap-2">
                <Ticket size={20} style={{ color: accent }} /> Meu Bilhete
              </h2>
              <button onClick={() => setTicketOpen(false)} className="p-1.5 rounded-full" style={{ background: '#00000044' }}>
                <X size={18} />
              </button>
            </div>

            {ticketDraft.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: muted }}>Nenhuma seleção. Use o botão + nas odds.</p>
            ) : (
              <>
                <div className="space-y-2 mb-4">
                  {ticketDraft.map(s => {
                    const ev = events.find(e => e.id === s.eventId);
                    const mk = s.marketId ? (marketsByEvent[s.eventId] || []).find(m => m.id === s.marketId) : null;
                    const evClosed = !ev || (ev.status !== 'open' && ev.status !== 'scheduled') || isBetDateTimeExpired(ev.closes_at);
                    const mkClosed = mk ? (mk.status !== 'open' || isBetDateTimeExpired(mk.closes_at)) : false;
                    const closed = evClosed || mkClosed;
                    return (
                      <div key={s.outcomeId} className="rounded-lg p-3 flex items-start justify-between gap-2" style={{ background: closed ? 'rgba(239,68,68,0.10)' : 'rgba(0,0,0,0.4)', border: `1px solid ${closed ? '#ef4444' : `${accent}33`}` }}>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold truncate">{s.eventTitle}</div>
                          <div className="text-[10px] uppercase tracking-wider" style={{ color: muted }}>{translatePt(s.marketTitle)}</div>
                          <div className="text-sm mt-1">
                            <span className="font-semibold">{translateOutcomeLabel(s.outcomeLabel)}</span>
                            <span className="ml-2 font-black tabular-nums" style={{ color: closed ? '#f87171' : accent, textDecoration: closed ? 'line-through' : undefined }}>{Number(s.odd).toFixed(2).replace('.', ',')}</span>
                          </div>
                          {closed && (
                            <div className="mt-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: '#f87171' }}>
                              {mkClosed && !evClosed ? 'Mercado encerrado · remova para continuar' : 'Evento encerrado · remova para continuar'}
                            </div>
                          )}
                        </div>
                        <button onClick={() => removeFromTicket(s.outcomeId)} className="p-1.5 rounded-md shrink-0" style={{ background: '#ef444422', color: '#f87171' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="rounded-lg p-3 mb-3 space-y-1 text-sm" style={{ background: 'rgba(0,0,0,0.35)' }}>
                  <div className="flex justify-between"><span style={{ color: muted }}>Seleções</span><b>{ticketDraft.length}</b></div>
                  <div className="flex justify-between">
                    <span style={{ color: muted }}>Odd base</span>
                    <b className="tabular-nums">{oddBreakdown.base.toFixed(2).replace('.', ',')}</b>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: muted }}>
                      Fator casa{oddBreakdown.hasSameFixture ? ' (mesmo jogo)' : ''}
                    </span>
                    <b className="tabular-nums">×{oddBreakdown.houseFactor.toFixed(2).replace('.', ',')}</b>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: muted }}>Bônus múltipla</span>
                    <b className="tabular-nums" style={{ color: oddBreakdown.bonus > 1 ? '#4ade80' : undefined }}>
                      {oddBreakdown.bonus > 1 ? `+${Math.round((oddBreakdown.bonus - 1) * 100)}%` : '—'}
                    </b>
                  </div>
                  <div className="flex justify-between pt-1 mt-1 border-t" style={{ borderColor: `${accent}33` }}>
                    <span className="font-bold">Odd final</span>
                    <b className="tabular-nums text-base" style={{ color: accent }}>{totalOdd.toFixed(2).replace('.', ',')}</b>
                  </div>
                </div>

                <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: muted }}>
                  Valor ({coinName}) · min {minBetAllowed} / max {maxBetAllowed}
                </label>
                <input
                  type="number" min={minBetAllowed} max={maxBetAllowed} value={ticketAmount}
                  onChange={(e) => setTicketAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg mb-3 text-lg font-bold tabular-nums"
                  style={{ background: '#00000066', border: `1px solid ${accent}55`, color: text }}
                />

                <div className="rounded-lg p-3 mb-3 flex items-center justify-between" style={{ background: `${accent}22`, border: `1px solid ${accent}55` }}>
                  <span className="text-sm font-bold">Retorno possível</span>
                  <span className="font-black tabular-nums text-lg" style={{ color: accent }}>{ticketReturn.toLocaleString('pt-BR')} {coinName}</span>
                </div>

                {ticketBlockReason && (
                  <div className="rounded-lg p-3 mb-3 text-xs font-bold" style={{ background: '#7f1d1d33', border: '1px solid #ef4444', color: '#fecaca' }}>
                    {ticketBlockReason}
                  </div>
                )}

                {authed && (
                  <div className="text-xs mb-3" style={{ color: muted }}>
                    Saldo: <b style={{ color: text }}>{authed.tokens_balance.toLocaleString('pt-BR')}</b> {coinName}
                  </div>
                )}

                <div className="flex gap-2">
                  <button onClick={clearTicket} className="px-3 py-2.5 rounded-xl font-bold text-sm" style={{ background: '#00000055', color: text, border: `1px solid ${text}22` }}>
                    Limpar
                  </button>
                  <button onClick={placeTicket} disabled={placingTicket || ticketDraft.length < 1 || !!ticketBlockReason}
                    className="flex-1 py-2.5 rounded-xl font-black flex items-center justify-center gap-2 disabled:opacity-50 transition hover:opacity-90"
                    style={{ background: accent, color: '#000' }}>
                    {placingTicket ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                    Confirmar bilhete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Bets;
