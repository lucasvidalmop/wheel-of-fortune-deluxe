import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EventData {
  found: boolean;
  id?: string;
  owner_id?: string;
  tag?: string;
  name?: string;
  description?: string;
  rules?: string;
  cover_url?: string;
  theme?: Record<string, string>;
  status?: string;
  opens_at?: string | null;
  closes_at?: string | null;
  max_participants?: number | null;
  require_pix?: boolean;
  participants_count?: number;
  winners?: Array<{
    name: string;
    account_id: string;
    prize_label: string;
    prize_amount: number;
    game: string;
    created_at: string;
  }>;
}

const PIX_TYPES = [
  { value: '', label: 'Tipo da chave' },
  { value: 'cpf', label: 'CPF' },
  { value: 'email', label: 'E-mail' },
  { value: 'phone', label: 'Celular' },
  { value: 'random', label: 'Aleatória' },
];

const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};
const maskCpf = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const storageKey = (tag: string) => `gorjeta_event_${tag}`;

const useCountdown = (target?: string | null) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  if (!target) return null;
  const diff = new Date(target).getTime() - now;
  if (diff <= 0) return null;
  const s = Math.floor(diff / 1000);
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
};

const GorjetaEvent = ({ tag }: { tag: string }) => {
  const [loading, setLoading] = useState(true);
  const [ev, setEv] = useState<EventData | null>(null);
  const [joined, setJoined] = useState<{ entry_number: number; user_name: string } | null>(null);
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [accountId, setAccountId] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [pixKeyType, setPixKeyType] = useState('');

  const accent = ev?.theme?.accent || '#22c55e';
  const bg = ev?.theme?.bg || '#07090d';

  const load = async () => {
    const { data, error } = await supabase.functions.invoke('get-event-page', { body: { tag } });
    if (error || !data?.found) {
      setEv({ found: false });
    } else {
      setEv(data as EventData);
      document.title = `${data.name || 'Evento'} — Gorjeta ao vivo`;
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    try {
      const raw = localStorage.getItem(storageKey(tag));
      if (raw) setJoined(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [tag]);

  // Feed ao vivo
  useEffect(() => {
    if (!ev?.id) return;
    const channel = supabase
      .channel(`gorjeta_event_${ev.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gorjeta_event_results', filter: `event_id=eq.${ev.id}` }, () => load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gorjeta_event_participants', filter: `event_id=eq.${ev.id}` }, () => {
        setEv((prev) => (prev ? { ...prev, participants_count: (prev.participants_count || 0) + 1 } : prev));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [ev?.id]);

  const openState = useMemo(() => {
    if (!ev?.found) return 'missing';
    const now = Date.now();
    if (ev.status === 'draft') return 'draft';
    if (ev.status === 'finished') return 'finished';
    if (ev.opens_at && now < new Date(ev.opens_at).getTime()) return 'scheduled';
    if (ev.closes_at && now > new Date(ev.closes_at).getTime()) return 'closed';
    return 'open';
  }, [ev]);

  const countdown = useCountdown(openState === 'scheduled' ? ev?.opens_at : ev?.closes_at);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke('join-event', {
      body: {
        tag,
        mode,
        name,
        email,
        account_id: accountId,
        phone,
        cpf,
        pix_key: pixKey,
        pix_key_type: pixKeyType,
      },
    });
    setSubmitting(false);
    const err = (data as any)?.error || (error ? 'Não foi possível concluir a inscrição.' : '');
    if (err) { toast.error(err); return; }
    const p = (data as any).participant;
    const info = { entry_number: p.entry_number, user_name: p.user_name };
    setJoined(info);
    try { localStorage.setItem(storageKey(tag), JSON.stringify(info)); } catch { /* ignore */ }
    toast.success((data as any).already ? 'Você já estava inscrito!' : 'Inscrição confirmada!');
    load();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: bg }}>
        <div className="h-9 w-9 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${accent} transparent ${accent} ${accent}` }} />
      </div>
    );
  }

  if (!ev?.found) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center" style={{ background: bg }}>
        <div>
          <h1 className="text-white text-2xl font-bold mb-2">Evento não encontrado</h1>
          <p className="text-white/50 text-sm">Confira o link informado pelo organizador.</p>
        </div>
      </div>
    );
  }

  const field = 'w-full h-12 rounded-xl bg-white/[0.04] border border-white/10 px-4 text-white placeholder:text-white/30 text-sm outline-none focus:border-white/30 transition-colors';

  return (
    <div className="min-h-screen text-white" style={{ background: bg }}>
      <div
        className="absolute inset-x-0 top-0 h-[380px] pointer-events-none"
        style={{ background: `radial-gradient(90% 100% at 50% 0%, ${accent}22, transparent 70%)` }}
      />
      <div className="relative mx-auto w-full max-w-[560px] px-4 sm:px-6 py-8 sm:py-12">
        {ev.cover_url && (
          <img
            src={ev.cover_url}
            alt={ev.name || 'Capa do evento'}
            loading="lazy"
            className="w-full aspect-[16/9] object-cover rounded-2xl border border-white/10 mb-6"
          />
        )}

        <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-white/50 mb-3">
          <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: accent }} />
          {openState === 'open' ? 'Inscrições abertas' : openState === 'scheduled' ? 'Em breve' : openState === 'finished' ? 'Encerrado' : 'Inscrições fechadas'}
        </div>

        <h1 className="text-3xl sm:text-4xl font-black leading-tight mb-2">{ev.name}</h1>
        {ev.description && <p className="text-white/60 text-sm leading-relaxed mb-5">{ev.description}</p>}

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
            <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Inscritos</div>
            <div className="text-2xl font-bold" style={{ color: accent }}>{ev.participants_count ?? 0}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
            <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">
              {openState === 'scheduled' ? 'Abre em' : 'Fecha em'}
            </div>
            <div className="text-2xl font-bold tabular-nums">
              {countdown
                ? `${countdown.d > 0 ? `${countdown.d}d ` : ''}${String(countdown.h).padStart(2, '0')}:${String(countdown.m).padStart(2, '0')}:${String(countdown.s).padStart(2, '0')}`
                : '--:--'}
            </div>
          </div>
        </div>

        {joined ? (
          <div className="rounded-2xl border p-6 text-center mb-6" style={{ borderColor: `${accent}55`, background: `${accent}0f` }}>
            <div className="text-4xl mb-2">🎉</div>
            <h2 className="text-xl font-bold mb-1">Você está participando!</h2>
            <p className="text-white/60 text-sm mb-4">Fique de olho na live — o organizador joga por você.</p>
            <div className="inline-flex flex-col items-center rounded-xl bg-black/30 px-6 py-3">
              <span className="text-[10px] uppercase tracking-widest text-white/40">Sua inscrição</span>
              <span className="text-2xl font-black tabular-nums" style={{ color: accent }}>
                #{String(joined.entry_number).padStart(4, '0')}
              </span>
            </div>
          </div>
        ) : openState === 'open' ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 mb-6">
            <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] mb-5">
              {(['signup', 'login'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="flex-1 h-9 rounded-lg text-xs font-semibold transition-colors"
                  style={mode === m ? { background: accent, color: '#04150a' } : { color: 'rgba(255,255,255,0.55)' }}
                >
                  {m === 'signup' ? 'Quero me inscrever' : 'Já tenho cadastro'}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {mode === 'signup' && (
                <input className={field} placeholder="Nome completo" value={name} onChange={(e) => setName(e.target.value)} />
              )}
              <input className={field} placeholder="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input className={field} placeholder="Seu ID na plataforma" value={accountId} onChange={(e) => setAccountId(e.target.value)} />
              {mode === 'signup' && (
                <>
                  <input className={field} placeholder="Celular" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} />
                  <input className={field} placeholder="CPF" value={cpf} onChange={(e) => setCpf(maskCpf(e.target.value))} />
                  {ev.require_pix && (
                    <div className="grid grid-cols-[130px_1fr] gap-3">
                      <select className={field} value={pixKeyType} onChange={(e) => setPixKeyType(e.target.value)}>
                        {PIX_TYPES.map((t) => (
                          <option key={t.value} value={t.value} className="bg-neutral-900">{t.label}</option>
                        ))}
                      </select>
                      <input className={field} placeholder="Chave PIX" value={pixKey} onChange={(e) => setPixKey(e.target.value)} />
                    </div>
                  )}
                </>
              )}

              <button
                onClick={submit}
                disabled={submitting}
                className="w-full h-13 py-4 rounded-xl font-bold text-sm uppercase tracking-wider transition-transform active:scale-[0.98] disabled:opacity-50"
                style={{ background: accent, color: '#04150a' }}
              >
                {submitting ? 'Enviando...' : mode === 'signup' ? 'Entrar no evento' : 'Confirmar participação'}
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-white/55 text-sm mb-6">
            {openState === 'scheduled' && 'As inscrições ainda não abriram. Volte no horário combinado.'}
            {openState === 'closed' && 'As inscrições deste evento foram encerradas.'}
            {openState === 'finished' && 'Este evento já terminou. Obrigado por participar!'}
            {openState === 'draft' && 'Este evento ainda não foi publicado.'}
          </div>
        )}

        {(ev.winners?.length ?? 0) > 0 && (
          <section className="mb-6">
            <h2 className="text-[11px] uppercase tracking-[0.28em] text-white/40 mb-3">Ganhadores ao vivo</h2>
            <div className="space-y-2">
              {ev.winners!.map((w, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold">{w.name}</div>
                    <div className="text-[11px] text-white/40">{w.account_id} · {w.game}</div>
                  </div>
                  <div className="text-sm font-bold" style={{ color: accent }}>{w.prize_label}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {ev.rules && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h2 className="text-[11px] uppercase tracking-[0.28em] text-white/40 mb-2">Regras</h2>
            <p className="text-white/55 text-sm whitespace-pre-line leading-relaxed">{ev.rules}</p>
          </section>
        )}
      </div>
    </div>
  );
};

export default GorjetaEvent;
