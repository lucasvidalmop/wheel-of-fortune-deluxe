import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Clock, Users, Trophy, Loader2, PartyPopper, LogOut } from 'lucide-react';
import { getLobbySession, setLobbySession, clearLobbySession } from '@/lib/lobbySession';

interface LiveEvent {
  id: string;
  ownerId: string;
  tag: string;
  name: string;
  description: string;
  rules: string;
  coverUrl: string;
  theme: Record<string, any>;
  pageConfig: Record<string, any>;
  status: string;
  opensAt: string | null;
  closesAt: string | null;
  maxParticipants: number | null;
  prizeAmount: number;
  winnersCount: number;
}

interface LiveWinner {
  id: string;
  name: string;
  accountId: string;
  amount: number;
  createdAt: string;
}

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDateTime = (iso: string | null) => {
  if (!iso) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
};

const countdownParts = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return { d, h, m, s };
};

export default function Sorteio({ tag }: { tag: string }) {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [event, setEvent] = useState<LiveEvent | null>(null);
  const [winners, setWinners] = useState<LiveWinner[]>([]);
  const [participantsCount, setParticipantsCount] = useState(0);
  const [entryNumber, setEntryNumber] = useState<number | null>(null);
  const [meWon, setMeWon] = useState(false);
  const [gorjetaRef, setGorjetaRef] = useState('');
  const [now, setNow] = useState(Date.now());
  const [reveal, setReveal] = useState<LiveWinner | null>(null);
  const seenWinnersRef = useRef<Set<string>>(new Set());
  const bootstrappedRef = useRef(false);
  const revealQueueRef = useRef<LiveWinner[]>([]);
  const revealBusyRef = useRef(false);

  const session = getLobbySession();
  const hasSavedAccount = !!(session?.email && session?.account_id);
  const [manualEntry, setManualEntry] = useState(!hasSavedAccount);
  const [email, setEmail] = useState(session?.email || '');
  const [accountId, setAccountId] = useState(session?.account_id || '');
  const [joining, setJoining] = useState(false);

  const winnersRef = useRef<HTMLDivElement>(null);

  const pumpReveals = useCallback(() => {
    if (revealBusyRef.current) return;
    const next = revealQueueRef.current.shift();
    if (!next) return;
    revealBusyRef.current = true;
    setReveal(next);
    window.setTimeout(() => {
      setReveal(null);
      revealBusyRef.current = false;
      window.setTimeout(pumpReveals, 350);
    }, 3800);
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const s = getLobbySession();
      const { data, error } = await supabase.functions.invoke('get-live-event', {
        body: { tag, email: s?.email || '', account_id: s?.account_id || '' },
      });
      if (error) throw error;
      if (!data?.found) { setNotFound(true); return; }
      setEvent(data.event);
      const list: LiveWinner[] = data.winners || [];
      // Queue live reveals for winners drawn while the page is open
      if (bootstrappedRef.current) {
        const fresh = list.filter(w => !seenWinnersRef.current.has(w.id));
        if (fresh.length) {
          revealQueueRef.current.push(...fresh);
          pumpReveals();
        }
      }
      list.forEach(w => seenWinnersRef.current.add(w.id));
      bootstrappedRef.current = true;
      setWinners(list);
      setParticipantsCount(data.participantsCount || 0);
      setEntryNumber(data.me?.entry_number ?? null);
      setMeWon(!!data.me?.has_won);
      setGorjetaRef(data.gorjetaRef || '');
      setNotFound(false);
    } catch (err) {
      console.error(err);
      if (!silent) setNotFound(true);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [tag, pumpReveals]);

  useEffect(() => { load(); }, [load]);

  // Live refresh + clock
  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    const poll = window.setInterval(() => load(true), 2500);
    return () => { window.clearInterval(clock); window.clearInterval(poll); };
  }, [load]);

  useEffect(() => {
    if (event) {
      document.title = event.name ? `${event.name} — Sorteio ao Vivo` : 'Sorteio ao Vivo';
    }
  }, [event]);

  useEffect(() => {
    if (winnersRef.current) {
      winnersRef.current.scrollTop = winnersRef.current.scrollHeight;
    }
  }, [winners.length]);


  const theme = event?.theme || {};
  const accent = theme.accentColor || '#22d3ee';
  const bg = theme.bgColor || '#080b14';
  const cardBg = theme.cardBgColor || '#111827';
  const textColor = theme.textColor || '#ffffff';

  const phase = useMemo(() => {
    if (!event) return 'loading';
    const opens = event.opensAt ? new Date(event.opensAt).getTime() : null;
    const closes = event.closesAt ? new Date(event.closesAt).getTime() : null;
    if (event.status === 'finished') return 'finished';
    if (opens && now < opens) return 'waiting';
    if (closes && now > closes) return 'closed';
    return 'open';
  }, [event, now]);

  const targetMs = phase === 'waiting'
    ? (event?.opensAt ? new Date(event.opensAt).getTime() - now : 0)
    : (event?.closesAt ? new Date(event.closesAt).getTime() - now : 0);
  const cd = countdownParts(targetMs);

  const handleJoin = async () => {
    const mail = email.trim().toLowerCase();
    const acc = accountId.trim();
    if (!mail || !acc) { toast.error('Informe o e-mail e o ID da conta'); return; }
    setJoining(true);
    try {
      const { data, error } = await supabase.functions.invoke('join-live-event', {
        body: { tag, email: mail, account_id: acc },
      });
      if (error) {
        const msg = (data as any)?.error || 'Não foi possível concluir sua inscrição';
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      setLobbySession({
        account_id: acc,
        email: mail,
        lobby_tag: getLobbySession()?.lobby_tag || '',
        owner_id: event?.ownerId,
        signed_in_at: Date.now(),
      });
      setEntryNumber((data as any).entryNumber ?? null);
      toast.success((data as any).already ? 'Você já estava inscrito!' : 'Inscrição confirmada!');
      load(true);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao participar');
    } finally {
      setJoining(false);
    }
  };

  const signOut = () => {
    clearLobbySession();
    setEntryNumber(null);
    setMeWon(false);
    setEmail(''); setAccountId('');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: bg }}>
        <Loader2 className="animate-spin" size={28} style={{ color: accent }} />
      </div>
    );
  }

  if (notFound || !event) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center" style={{ background: bg, color: textColor }}>
        <h1 className="text-2xl font-bold">Evento não encontrado</h1>
        <p className="opacity-70 text-sm">Verifique o link do sorteio com o organizador.</p>
      </div>
    );
  }

  const spotsLeft = event.maxParticipants ? Math.max(0, event.maxParticipants - participantsCount) : null;
  const isRegistered = entryNumber !== null;
  const iWon = isRegistered && meWon;

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: bg, color: textColor }}>
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[420px] w-[820px] rounded-full blur-[120px] opacity-40"
        style={{ background: accent }}
      />
      <div
        className="pointer-events-none absolute bottom-0 right-[-10%] h-[360px] w-[520px] rounded-full blur-[130px] opacity-20"
        style={{ background: accent }}
      />

      {/* LIVE REVEAL OVERLAY */}
      {reveal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6 backdrop-blur-md animate-fade-in" style={{ background: `${bg}e6` }}>
          <div className="text-center animate-scale-in">
            <div className="text-6xl animate-bounce">🏆</div>
            <div className="mt-4 text-[11px] uppercase tracking-[0.25em] opacity-70">Ganhador sorteado</div>
            <div className="mt-2 text-4xl sm:text-6xl font-extrabold" style={{ color: accent, textShadow: `0 0 60px ${accent}80` }}>
              {reveal.name}
            </div>
            <div className="mt-2 text-sm opacity-60">ID {reveal.accountId}</div>
            <div className="mt-5 inline-block rounded-2xl px-6 py-3 text-2xl font-extrabold" style={{ background: `${accent}22`, color: accent }}>
              {fmtBRL(reveal.amount)}
            </div>
          </div>
        </div>
      )}

      {/* DRAW IN PROGRESS BANNER */}
      {event.status === 'running' && winners.length < event.winnersCount && (
        <div className="relative z-10 text-center py-2 text-[11px] font-bold uppercase tracking-[0.2em] animate-pulse" style={{ background: `${accent}22`, color: accent }}>
          Sorteio acontecendo agora — fique nesta tela
        </div>
      )}


      {/* HERO */}
      <header className="relative">
        {event.coverUrl && (
          <>
            <img src={event.coverUrl} alt={event.name} className="absolute inset-0 w-full h-full object-cover opacity-45" />
            <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, ${bg}99, ${bg})` }} />
          </>
        )}
        <div className="relative max-w-5xl mx-auto px-5 pt-10 pb-8 sm:pt-16 sm:pb-12 text-center">
          <span
            className="inline-flex items-center gap-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.18em] px-3 py-1.5 rounded-full border backdrop-blur"
            style={{ borderColor: `${accent}55`, background: `${accent}1a`, color: accent }}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full animate-ping opacity-75" style={{ background: accent }} />
              <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: accent }} />
            </span>
            Sorteio ao vivo
          </span>

          <h1 className="mt-5 text-[2.1rem] leading-[1.05] sm:text-6xl font-extrabold tracking-tight">
            {event.name || 'Sorteio'}
          </h1>

          <div className="mt-6 inline-flex flex-col items-center">
            <span className="text-[11px] uppercase tracking-[0.2em] opacity-60">Prêmio por ganhador</span>
            <span
              className="mt-1 text-5xl sm:text-7xl font-extrabold tabular-nums"
              style={{ color: accent, textShadow: `0 0 48px ${accent}66` }}
            >
              {fmtBRL(event.prizeAmount)}
            </span>
          </div>

          {event.description && (
            <p className="mt-5 mx-auto max-w-xl text-sm sm:text-base leading-relaxed opacity-70 whitespace-pre-line">
              {event.description}
            </p>
          )}

          <div className="mt-7 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 max-w-2xl mx-auto">
            {[
              { label: 'Premiados', value: `${winners.length}/${event.winnersCount}`, icon: <PartyPopper size={13} /> },
              { label: 'Inscritos', value: String(participantsCount), icon: <Users size={13} /> },
              { label: 'Vagas', value: spotsLeft === null ? 'Ilimitadas' : String(spotsLeft), icon: <Trophy size={13} /> },
              {
                label: phase === 'waiting' ? 'Abre em' : phase === 'open' ? 'Encerra em' : 'Status',
                value:
                  phase === 'waiting' || (phase === 'open' && event.closesAt)
                    ? `${cd.d > 0 ? `${cd.d}d ` : ''}${String(cd.h).padStart(2, '0')}:${String(cd.m).padStart(2, '0')}:${String(cd.s).padStart(2, '0')}`
                    : phase === 'open' ? 'Aberto' : phase === 'finished' ? 'Finalizado' : 'Encerrado',
                icon: <Clock size={13} />,
              },
            ].map(s => (
              <div
                key={s.label}
                className="rounded-2xl px-3 py-3 border backdrop-blur-sm"
                style={{ background: `${cardBg}cc`, borderColor: `${accent}26` }}
              >
                <div className="flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-wide opacity-55">
                  {s.icon}{s.label}
                </div>
                <div className="mt-1 text-sm sm:text-base font-bold tabular-nums truncate">{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* BODY */}
      <main className="relative max-w-5xl mx-auto px-4 sm:px-5 pb-20 grid gap-4 lg:grid-cols-[1fr_1fr] lg:items-start">
        {/* Join / status card */}
        {isRegistered ? (
          <section
            className="rounded-3xl p-6 border text-center relative overflow-hidden"
            style={{ background: `${accent}12`, borderColor: `${accent}66` }}
          >
            <div className="text-[11px] uppercase tracking-[0.2em] opacity-70">Você está participando</div>
            <div className="mt-2 text-6xl font-extrabold tabular-nums" style={{ color: accent, textShadow: `0 0 40px ${accent}55` }}>
              #{entryNumber}
            </div>
            <div className="text-xs opacity-60 mt-1">Seu número de participação</div>
            {iWon && (
              <div className="mt-4 rounded-2xl px-4 py-3 text-sm font-bold" style={{ background: `${accent}22`, color: accent }}>
                🎉 Você foi sorteado! O PIX será enviado para a chave do seu cadastro.
              </div>
            )}
            <button onClick={signOut} className="mt-5 inline-flex items-center gap-1.5 text-[11px] opacity-55 hover:opacity-100 transition-opacity">
              <LogOut size={12} /> Sair desta conta
            </button>
          </section>
        ) : (
          <section
            className="rounded-3xl p-6 border space-y-3 backdrop-blur"
            style={{ background: `${cardBg}e6`, borderColor: `${accent}33` }}
          >
            <div>
              <h2 className="text-lg font-bold">Participar do sorteio</h2>
              <p className="text-xs opacity-60 mt-1">
                {hasSavedAccount && !manualEntry
                  ? 'Sua conta já está reconhecida. É só confirmar.'
                  : 'Use o e-mail e o ID da sua conta cadastrada.'}
              </p>
            </div>
            {hasSavedAccount && !manualEntry ? (
              <div className="rounded-2xl px-4 py-3 border" style={{ borderColor: `${accent}3a`, background: 'rgba(0,0,0,0.25)' }}>
                <div className="text-sm font-semibold truncate">{session?.email}</div>
                <div className="text-[11px] opacity-55">ID {session?.account_id}</div>
              </div>
            ) : (
              <>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Seu e-mail"
                  className="w-full rounded-2xl px-4 py-3.5 text-sm bg-black/35 border outline-none transition-colors focus:bg-black/50"
                  style={{ borderColor: `${accent}3a`, color: textColor }}
                />
                <input
                  type="text"
                  value={accountId}
                  onChange={e => setAccountId(e.target.value)}
                  placeholder="ID da sua conta"
                  className="w-full rounded-2xl px-4 py-3.5 text-sm bg-black/35 border outline-none transition-colors focus:bg-black/50"
                  style={{ borderColor: `${accent}3a`, color: textColor }}
                />
              </>
            )}

            <button
              onClick={handleJoin}
              disabled={joining || phase !== 'open'}
              className="w-full rounded-2xl py-4 text-sm font-extrabold uppercase tracking-wide disabled:opacity-45 flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
              style={{ background: accent, color: '#04121a', boxShadow: `0 12px 40px -12px ${accent}` }}
            >
              {joining && <Loader2 size={16} className="animate-spin" />}
              {phase === 'waiting'
                ? 'Aguarde a abertura'
                : phase !== 'open'
                  ? 'Inscrições encerradas'
                  : hasSavedAccount && !manualEntry
                    ? 'Confirmar participação'
                    : 'Quero participar'}
            </button>
            {hasSavedAccount && !manualEntry && (
              <button
                onClick={() => { setManualEntry(true); setEmail(''); setAccountId(''); }}
                className="block w-full text-center text-[11px] opacity-55 hover:opacity-100"
              >
                Usar outra conta
              </button>
            )}
            {gorjetaRef && (
              <a
                href={`/gorjeta?ref=${gorjetaRef}&return=${encodeURIComponent(`sorteio:${event.tag}`)}`}
                className="block text-center text-xs opacity-65 hover:opacity-100 underline underline-offset-4"
              >
                Não tenho cadastro — quero me inscrever
              </a>
            )}

            <div className="pt-1 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] opacity-45">
              {event.opensAt && <span>Abre {fmtDateTime(event.opensAt)}</span>}
              {event.closesAt && <span>Fecha {fmtDateTime(event.closesAt)}</span>}
            </div>
          </section>
        )}

        {/* Winners */}
        <section
          className="rounded-3xl p-6 border backdrop-blur"
          style={{ background: `${cardBg}e6`, borderColor: `${accent}33` }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Ganhadores</h2>
            <span className="text-[11px] px-2.5 py-1 rounded-full" style={{ background: `${accent}1a`, color: accent }}>
              {winners.length} de {event.winnersCount}
            </span>
          </div>
          {winners.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed px-4 py-10 text-center text-xs opacity-55" style={{ borderColor: `${accent}33` }}>
              Nenhum ganhador sorteado ainda.<br />Fique de olho na live!
            </div>
          ) : (
            <div ref={winnersRef} className="mt-4 space-y-2 max-h-[22rem] overflow-y-auto scroll-smooth pr-1">
              {winners.map((w, i) => (
                <div
                  key={w.id}
                  className="flex items-center gap-3 rounded-2xl px-3.5 py-3 border"
                  style={{ background: `${accent}0f`, borderColor: `${accent}1f` }}
                >
                  <div
                    className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: `${accent}26`, color: accent }}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{w.name}</div>
                    <div className="text-[11px] opacity-55">ID {w.accountId}</div>
                  </div>
                  <div className="text-sm font-bold tabular-nums" style={{ color: accent }}>{fmtBRL(w.amount)}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        {event.rules && (
          <section
            className="rounded-3xl p-6 border text-xs leading-relaxed whitespace-pre-line lg:col-span-2"
            style={{ background: `${cardBg}99`, borderColor: `${accent}1f` }}
          >
            <div className="font-bold text-sm mb-2">Regras</div>
            <div className="opacity-65">{event.rules}</div>
          </section>
        )}
      </main>
    </div>
  );
}

