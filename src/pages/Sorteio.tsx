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
  const [gorjetaRef, setGorjetaRef] = useState('');
  const [now, setNow] = useState(Date.now());

  const session = getLobbySession();
  const [email, setEmail] = useState(session?.email || '');
  const [accountId, setAccountId] = useState(session?.account_id || '');
  const [joining, setJoining] = useState(false);
  const winnersRef = useRef<HTMLDivElement>(null);

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
      setWinners(data.winners || []);
      setParticipantsCount(data.participantsCount || 0);
      setEntryNumber(data.me?.entry_number ?? null);
      setGorjetaRef(data.gorjetaRef || '');
      setNotFound(false);
    } catch (err) {
      console.error(err);
      if (!silent) setNotFound(true);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [tag]);

  useEffect(() => { load(); }, [load]);

  // Live refresh + clock
  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    const poll = window.setInterval(() => load(true), 5000);
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
  const iWon = winners.some(w => isRegistered && w.accountId.startsWith(accountId.slice(0, 4)) && accountId);

  return (
    <div className="min-h-screen pb-16" style={{ background: bg, color: textColor }}>
      {/* Cover */}
      <div className="relative w-full h-44 sm:h-64 overflow-hidden">
        {event.coverUrl ? (
          <img src={event.coverUrl} alt={event.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${accent}33, ${bg})` }} />
        )}
        <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${bg}, transparent 70%)` }} />
        <div className="absolute bottom-3 left-0 right-0 px-5">
          <span
            className="inline-block text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
            style={{ background: accent, color: '#04121a' }}
          >
            Sorteio ao Vivo
          </span>
          <h1 className="mt-2 text-2xl sm:text-4xl font-extrabold leading-tight">{event.name || 'Sorteio'}</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 space-y-4 -mt-1">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Prêmio', value: fmtBRL(event.prizeAmount), icon: <Trophy size={14} /> },
            { label: 'Premiados', value: `${winners.length}/${event.winnersCount}`, icon: <PartyPopper size={14} /> },
            { label: 'Inscritos', value: String(participantsCount), icon: <Users size={14} /> },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-3 text-center border" style={{ background: cardBg, borderColor: `${accent}26` }}>
              <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide opacity-60">{s.icon}{s.label}</div>
              <div className="mt-1 text-base font-bold" style={{ color: accent }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Countdown / status */}
        <div className="rounded-2xl p-4 border" style={{ background: cardBg, borderColor: `${accent}26` }}>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide opacity-70">
            <Clock size={14} />
            {phase === 'waiting' && 'Abre em'}
            {phase === 'open' && (event.closesAt ? 'Encerra em' : 'Inscrições abertas')}
            {phase === 'closed' && 'Inscrições encerradas'}
            {phase === 'finished' && 'Evento finalizado'}
          </div>
          {(phase === 'waiting' || (phase === 'open' && event.closesAt)) ? (
            <div className="mt-2 flex gap-2">
              {[{ v: cd.d, l: 'd' }, { v: cd.h, l: 'h' }, { v: cd.m, l: 'm' }, { v: cd.s, l: 's' }].map(u => (
                <div key={u.l} className="flex-1 rounded-xl py-2 text-center" style={{ background: `${accent}14` }}>
                  <div className="text-xl font-extrabold tabular-nums" style={{ color: accent }}>{String(u.v).padStart(2, '0')}</div>
                  <div className="text-[10px] opacity-60">{u.l}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-sm opacity-70">
              {phase === 'open' ? 'Participe agora para concorrer.' : 'Acompanhe os ganhadores abaixo.'}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] opacity-60">
            {event.opensAt && <span>Abertura: {fmtDateTime(event.opensAt)}</span>}
            {event.closesAt && <span>Fechamento: {fmtDateTime(event.closesAt)}</span>}
            {spotsLeft !== null && <span>Vagas restantes: {spotsLeft}</span>}
          </div>
        </div>

        {event.description && (
          <div className="rounded-2xl p-4 border text-sm leading-relaxed whitespace-pre-line" style={{ background: cardBg, borderColor: `${accent}26` }}>
            {event.description}
          </div>
        )}

        {/* Join */}
        {isRegistered ? (
          <div className="rounded-2xl p-4 border text-center" style={{ background: `${accent}12`, borderColor: accent }}>
            <div className="text-xs uppercase tracking-wide opacity-70">Você está participando</div>
            <div className="mt-1 text-3xl font-extrabold" style={{ color: accent }}>#{entryNumber}</div>
            <div className="text-xs opacity-60 mt-1">Seu número de participação</div>
            {iWon && (
              <div className="mt-3 text-sm font-bold" style={{ color: accent }}>
                🎉 Você foi sorteado! O PIX será enviado para a chave do seu cadastro.
              </div>
            )}
            <button onClick={signOut} className="mt-3 inline-flex items-center gap-1 text-[11px] opacity-60 hover:opacity-100">
              <LogOut size={12} /> Sair desta conta
            </button>
          </div>
        ) : (
          <div className="rounded-2xl p-4 border space-y-3" style={{ background: cardBg, borderColor: `${accent}26` }}>
            <div className="text-sm font-bold">Participar do sorteio</div>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Seu e-mail"
              className="w-full rounded-xl px-3 py-3 text-sm bg-black/30 border outline-none"
              style={{ borderColor: `${accent}40`, color: textColor }}
            />
            <input
              type="text"
              value={accountId}
              onChange={e => setAccountId(e.target.value)}
              placeholder="ID da sua conta"
              className="w-full rounded-xl px-3 py-3 text-sm bg-black/30 border outline-none"
              style={{ borderColor: `${accent}40`, color: textColor }}
            />
            <button
              onClick={handleJoin}
              disabled={joining || phase !== 'open'}
              className="w-full rounded-xl py-3 text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: accent, color: '#04121a' }}
            >
              {joining && <Loader2 size={16} className="animate-spin" />}
              {phase === 'waiting' ? 'Aguarde a abertura' : phase === 'open' ? 'Quero participar' : 'Inscrições encerradas'}
            </button>
            {gorjetaRef && (
              <a
                href={`/gorjeta?ref=${gorjetaRef}&return=${encodeURIComponent(`/sorteio=${event.tag}`)}`}
                className="block text-center text-xs underline opacity-70 hover:opacity-100"
              >
                Não tenho cadastro — quero me inscrever
              </a>
            )}
          </div>
        )}

        {/* Winners */}
        <div className="rounded-2xl p-4 border" style={{ background: cardBg, borderColor: `${accent}26` }}>
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold">Ganhadores</div>
            <div className="text-[11px] opacity-60">{winners.length} de {event.winnersCount}</div>
          </div>
          {winners.length === 0 ? (
            <p className="mt-3 text-xs opacity-60">Nenhum ganhador sorteado ainda. Fique de olho na live!</p>
          ) : (
            <div ref={winnersRef} className="mt-3 space-y-2 max-h-72 overflow-y-auto scroll-smooth">
              {winners.map((w, i) => (
                <div key={w.id} className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: `${accent}0f` }}>
                  <div className="w-6 text-center text-xs font-bold opacity-60">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{w.name}</div>
                    <div className="text-[11px] opacity-60">ID {w.accountId}</div>
                  </div>
                  <div className="text-sm font-bold" style={{ color: accent }}>{fmtBRL(w.amount)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {event.rules && (
          <div className="rounded-2xl p-4 border text-xs leading-relaxed opacity-70 whitespace-pre-line" style={{ background: cardBg, borderColor: `${accent}1a` }}>
            <div className="font-bold mb-1 opacity-100">Regras</div>
            {event.rules}
          </div>
        )}
      </div>
    </div>
  );
}
