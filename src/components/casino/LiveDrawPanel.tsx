import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Plus, Trash2, Save, Copy, Users, Trophy, Play, Loader2, RefreshCw, Sparkles, Search,
} from 'lucide-react';
import MoneyInput from '@/components/casino/MoneyInput';
import { dateTimeLocalToBetIso, betIsoToDateTimeLocal, formatBetDateTime } from '@/lib/betsDateTime';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

interface LiveEventRow {
  id: string;
  owner_id: string;
  tag: string;
  name: string;
  description: string;
  rules: string;
  cover_url: string;
  theme: Record<string, any>;
  status: string;
  opens_at: string | null;
  closes_at: string | null;
  max_participants: number | null;
  prize_amount: number;
  winners_count: number;
  block_by_ip: boolean;
  require_pix: boolean;
  is_active: boolean;
  drawn_count: number;
}

interface ParticipantRow {
  id: string;
  user_name: string;
  user_email: string;
  account_id: string;
  entry_number: number;
  has_won: boolean;
  ip_address: string | null;
  created_at: string;
}

interface ResultRow {
  id: string;
  user_name: string;
  account_id: string;
  prize_amount: number;
  prize_payment_id: string | null;
  created_at: string;
}

const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

export default function LiveDrawPanel({ ownerId }: { ownerId: string }) {
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [events, setEvents] = useState<LiveEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'config' | 'participantes' | 'sorteio'>('config');

  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [search, setSearch] = useState('');
  const [drawing, setDrawing] = useState(false);
  const [rolling, setRolling] = useState<string>('');
  const winnersRef = useRef<HTMLDivElement>(null);

  const [draft, setDraft] = useState<LiveEventRow | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('gorjeta_events')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) { toast.error('Erro ao carregar eventos'); return; }
    const rows = (data || []) as LiveEventRow[];
    setEvents(rows);
    if (!selectedId && rows.length) setSelectedId(rows[0].id);
  }, [ownerId, selectedId]);

  useEffect(() => { loadEvents(); }, [ownerId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ev = events.find(e => e.id === selectedId);
    setDraft(ev ? { ...ev } : null);
  }, [selectedId, events]);

  const loadEntries = useCallback(async (eventId: string) => {
    if (!eventId) return;
    const [{ data: parts }, { data: res }] = await Promise.all([
      (supabase as any).from('gorjeta_event_participants').select('id, user_name, user_email, account_id, entry_number, has_won, ip_address, created_at').eq('event_id', eventId).order('entry_number', { ascending: true }),
      (supabase as any).from('gorjeta_event_results').select('id, user_name, account_id, prize_amount, prize_payment_id, created_at').eq('event_id', eventId).eq('is_winner', true).order('created_at', { ascending: true }),
    ]);
    setParticipants((parts || []) as ParticipantRow[]);
    setResults((res || []) as ResultRow[]);
  }, []);

  useEffect(() => { if (selectedId) loadEntries(selectedId); }, [selectedId, loadEntries]);

  useEffect(() => {
    if (winnersRef.current) winnersRef.current.scrollTop = winnersRef.current.scrollHeight;
  }, [results.length]);

  const createEvent = async () => {
    const name = 'Novo Sorteio';
    let tag = `sorteio-${Math.random().toString(36).slice(2, 7)}`;
    const { data, error } = await (supabase as any).from('gorjeta_events').insert({
      owner_id: ownerId,
      tag,
      name,
      status: 'draft',
      prize_amount: 10,
      winners_count: 1,
      require_pix: false,
      block_by_ip: true,
      theme: { accentColor: '#22d3ee', bgColor: '#080b14', cardBgColor: '#111827', textColor: '#ffffff' },
    }).select('*').maybeSingle();
    if (error) { toast.error('Erro ao criar evento: ' + error.message); return; }
    toast.success('Evento criado');
    setEvents(prev => [data as LiveEventRow, ...prev]);
    setSelectedId((data as LiveEventRow).id);
    setTab('config');
  };

  const saveEvent = async () => {
    if (!draft) return;
    if (!draft.tag.trim()) { toast.error('Informe a tag do evento'); return; }
    setSaving(true);
    const { error } = await (supabase as any).from('gorjeta_events').update({
      tag: slugify(draft.tag),
      name: draft.name,
      description: draft.description,
      rules: draft.rules,
      cover_url: draft.cover_url,
      theme: draft.theme,
      status: draft.status,
      opens_at: draft.opens_at,
      closes_at: draft.closes_at,
      max_participants: draft.max_participants,
      prize_amount: draft.prize_amount,
      winners_count: draft.winners_count,
      block_by_ip: draft.block_by_ip,
      require_pix: draft.require_pix,
      is_active: draft.is_active,
    }).eq('id', draft.id);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    toast.success('Evento salvo');
    setEvents(prev => prev.map(e => (e.id === draft.id ? { ...draft, tag: slugify(draft.tag) } : e)));
  };

  const deleteEvent = async () => {
    if (!draft) return;
    const ok = await confirm({
      title: 'Excluir evento',
      description: 'Isso remove o evento, os inscritos e os resultados. Os pagamentos já criados são mantidos no Financeiro.',
      confirmText: 'Excluir',
    });
    if (!ok) return;
    const { error } = await (supabase as any).from('gorjeta_events').delete().eq('id', draft.id);
    if (error) { toast.error('Erro ao excluir'); return; }
    toast.success('Evento excluído');
    setEvents(prev => prev.filter(e => e.id !== draft.id));
    setSelectedId('');
  };

  const eligible = useMemo(
    () => participants.filter(p => !p.has_won),
    [participants],
  );
  const remaining = draft ? Math.max(0, draft.winners_count - results.length) : 0;

  const drawNext = async () => {
    if (!draft) return;
    if (remaining <= 0) { toast.error('Todos os premiados já foram sorteados'); return; }
    if (eligible.length === 0) { toast.error('Nenhum participante elegível'); return; }

    setDrawing(true);
    try {
      // Suspense animation cycling through candidate names
      const spinMs = 2200;
      const start = Date.now();
      await new Promise<void>(resolve => {
        const timer = window.setInterval(() => {
          const rnd = eligible[Math.floor(Math.random() * eligible.length)];
          setRolling(rnd?.user_name || '');
          if (Date.now() - start >= spinMs) {
            window.clearInterval(timer);
            resolve();
          }
        }, 80);
      });

      const winner = eligible[Math.floor(Math.random() * eligible.length)];
      setRolling(winner.user_name);

      const amount = Number(draft.prize_amount || 0);

      const { data: wu } = await (supabase as any)
        .from('wheel_users')
        .select('id, auto_payment')
        .eq('owner_id', ownerId)
        .eq('account_id', winner.account_id)
        .maybeSingle();

      let paymentId: string | null = null;
      if (amount > 0) {
        const { data: pay, error: payErr } = await (supabase as any).rpc('create_prize_payment', {
          p_owner_id: ownerId,
          p_account_id: winner.account_id,
          p_user_name: winner.user_name,
          p_user_email: winner.user_email,
          p_prize: `Sorteio ao Vivo — ${draft.name} (${fmtBRL(amount)})`,
          p_amount: amount,
          p_force_auto: !!wu?.auto_payment,
        });
        if (payErr) throw payErr;
        paymentId = pay?.id || null;
        if (paymentId && (pay?.auto_payment || wu?.auto_payment)) {
          supabase.functions.invoke('edpay-pix-transfer', {
            body: { paymentId, autoPayment: true },
          }).catch(console.error);
        }
      }

      const { error: resErr } = await (supabase as any).from('gorjeta_event_results').insert({
        event_id: draft.id,
        owner_id: ownerId,
        participant_id: winner.id,
        wheel_user_id: wu?.id || null,
        user_name: winner.user_name,
        user_email: winner.user_email,
        account_id: winner.account_id,
        game: 'live_draw',
        outcome: { entry_number: winner.entry_number },
        is_winner: true,
        prize_type: 'pix',
        prize_label: fmtBRL(amount),
        prize_amount: amount,
        prize_payment_id: paymentId,
      });
      if (resErr) throw resErr;

      await (supabase as any).from('gorjeta_event_participants').update({ has_won: true }).eq('id', winner.id);
      await (supabase as any).from('gorjeta_events')
        .update({ drawn_count: results.length + 1, status: results.length + 1 >= draft.winners_count ? 'finished' : 'running' })
        .eq('id', draft.id);

      toast.success(`🎉 ${winner.user_name} foi sorteado!`);
      await loadEntries(draft.id);
      setEvents(prev => prev.map(e => (e.id === draft.id ? { ...e, drawn_count: results.length + 1 } : e)));
    } catch (err: any) {
      toast.error('Erro ao sortear: ' + (err?.message || ''));
    } finally {
      setDrawing(false);
      window.setTimeout(() => setRolling(''), 1500);
    }
  };

  const publicUrl = draft ? `${window.location.origin}/sorteio=${draft.tag}` : '';
  const accent = draft?.theme?.accentColor || '#22d3ee';

  const filteredParticipants = participants.filter(p => {
    const t = search.trim().toLowerCase();
    if (!t) return true;
    return p.user_name.toLowerCase().includes(t) || p.account_id.toLowerCase().includes(t) || p.user_email.toLowerCase().includes(t);
  });

  const field = 'w-full rounded-lg bg-background border border-border px-3 py-2 text-sm outline-none focus:border-primary';
  const label = 'text-xs font-medium text-muted-foreground';

  return (
    <div className="space-y-5 max-w-4xl">
      {ConfirmDialog}

      {/* Event selector */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          className="rounded-lg bg-background border border-border px-3 py-2 text-sm min-w-[220px]"
        >
          <option value="">{loading ? 'Carregando...' : 'Selecione um evento'}</option>
          {events.map(e => (
            <option key={e.id} value={e.id}>{e.name || e.tag} {e.is_active ? '' : '(inativo)'}</option>
          ))}
        </select>
        <button onClick={createEvent} className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-medium">
          <Plus size={15} /> Novo evento
        </button>
        <button onClick={() => { loadEvents(); if (selectedId) loadEntries(selectedId); }} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm">
          <RefreshCw size={15} /> Atualizar
        </button>
      </div>

      {!draft ? (
        <div className="rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">
          Crie um evento de sorteio para começar.
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Prêmio', value: fmtBRL(Number(draft.prize_amount || 0)) },
              { label: 'Premiados', value: `${results.length}/${draft.winners_count}` },
              { label: 'Inscritos', value: String(participants.length) },
              { label: 'Status', value: draft.status },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-border p-3">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</div>
                <div className="text-sm font-bold mt-0.5">{s.value}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-border p-3">
            <input readOnly value={publicUrl} className="flex-1 bg-transparent text-xs text-muted-foreground outline-none" />
            <button
              onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success('Link copiado'); }}
              className="inline-flex items-center gap-1 text-xs rounded-lg border border-border px-2 py-1.5"
            >
              <Copy size={13} /> Copiar
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {([
              { key: 'config' as const, label: '⚙️ Configuração' },
              { key: 'participantes' as const, label: `👥 Inscritos (${participants.length})` },
              { key: 'sorteio' as const, label: '🎲 Sortear ao vivo' },
            ]).map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium border ${tab === t.key ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'config' && (
            <div className="space-y-4 rounded-xl border border-border p-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className={label}>Nome do evento</label>
                  <input className={field} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
                </div>
                <div>
                  <label className={label}>Tag do link (/sorteio=...)</label>
                  <input className={field} value={draft.tag} onChange={e => setDraft({ ...draft, tag: e.target.value })} />
                </div>
                <div>
                  <label className={label}>Valor da gorjeta por premiado</label>
                  <MoneyInput
                    value={Number(draft.prize_amount || 0)}
                    onChange={v => setDraft({ ...draft, prize_amount: v })}
                    className={field}
                  />
                </div>
                <div>
                  <label className={label}>Quantidade de premiados</label>
                  <input
                    type="number" min={1} className={field}
                    value={draft.winners_count}
                    onChange={e => setDraft({ ...draft, winners_count: Math.max(1, Number(e.target.value) || 1) })}
                  />
                </div>
                <div>
                  <label className={label}>Abre em</label>
                  <input
                    type="datetime-local" className={field}
                    value={betIsoToDateTimeLocal(draft.opens_at)}
                    onChange={e => setDraft({ ...draft, opens_at: e.target.value ? dateTimeLocalToBetIso(e.target.value) : null })}
                  />
                </div>
                <div>
                  <label className={label}>Fecha em</label>
                  <input
                    type="datetime-local" className={field}
                    value={betIsoToDateTimeLocal(draft.closes_at)}
                    onChange={e => setDraft({ ...draft, closes_at: e.target.value ? dateTimeLocalToBetIso(e.target.value) : null })}
                  />
                </div>
                <div>
                  <label className={label}>Máximo de participantes (vazio = ilimitado)</label>
                  <input
                    type="number" min={0} className={field}
                    value={draft.max_participants ?? ''}
                    onChange={e => setDraft({ ...draft, max_participants: e.target.value ? Number(e.target.value) : null })}
                  />
                </div>
                <div>
                  <label className={label}>Imagem de capa (URL)</label>
                  <input className={field} value={draft.cover_url} onChange={e => setDraft({ ...draft, cover_url: e.target.value })} />
                </div>
              </div>

              <div>
                <label className={label}>Descrição</label>
                <textarea className={`${field} min-h-[80px]`} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} />
              </div>
              <div>
                <label className={label}>Regras</label>
                <textarea className={`${field} min-h-[80px]`} value={draft.rules} onChange={e => setDraft({ ...draft, rules: e.target.value })} />
              </div>

              <div className="grid sm:grid-cols-4 gap-3">
                {([
                  ['accentColor', 'Cor de destaque'],
                  ['bgColor', 'Fundo'],
                  ['cardBgColor', 'Cartões'],
                  ['textColor', 'Texto'],
                ] as const).map(([key, lbl]) => (
                  <div key={key}>
                    <label className={label}>{lbl}</label>
                    <input
                      type="color"
                      className="w-full h-9 rounded-lg bg-background border border-border"
                      value={draft.theme?.[key] || '#000000'}
                      onChange={e => setDraft({ ...draft, theme: { ...(draft.theme || {}), [key]: e.target.value } })}
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                {([
                  ['is_active', 'Evento ativo (página pública acessível)'],
                  ['block_by_ip', 'Bloquear mais de uma inscrição por IP'],
                  ['require_pix', 'Exigir chave PIX cadastrada para participar'],
                ] as const).map(([key, lbl]) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!(draft as any)[key]}
                      onChange={e => setDraft({ ...draft, [key]: e.target.checked } as LiveEventRow)}
                    />
                    {lbl}
                  </label>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button onClick={saveEvent} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-60">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Salvar
                </button>
                <button onClick={deleteEvent} className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 text-destructive px-3 py-2 text-sm">
                  <Trash2 size={15} /> Excluir
                </button>
              </div>
            </div>
          )}

          {tab === 'participantes' && (
            <div className="rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Search size={15} className="text-muted-foreground" />
                <input className={field} placeholder="Buscar por nome, ID ou e-mail" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              {filteredParticipants.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Nenhum inscrito ainda.</p>
              ) : (
                <div className="max-h-[420px] overflow-y-auto divide-y divide-border">
                  {filteredParticipants.map(p => (
                    <div key={p.id} className="flex items-center gap-3 py-2 text-sm">
                      <span className="w-10 text-xs text-muted-foreground">#{p.entry_number}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{p.user_name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{p.account_id} · {p.user_email}</div>
                      </div>
                      {p.has_won && <span className="text-[10px] rounded-full px-2 py-0.5 bg-primary/15 text-primary">Premiado</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'sorteio' && (
            <div className="rounded-xl border border-border p-4 space-y-4">
              <div className="rounded-xl p-6 text-center" style={{ background: `${accent}12`, border: `1px solid ${accent}40` }}>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  {drawing ? 'Sorteando...' : rolling ? 'Ganhador' : 'Pronto para sortear'}
                </div>
                <div className="mt-2 text-2xl font-extrabold min-h-[2rem]" style={{ color: accent }}>
                  {rolling || (remaining > 0 ? `${remaining} prêmio(s) restante(s)` : 'Sorteio concluído')}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {eligible.length} participante(s) elegível(is) · {fmtBRL(Number(draft.prize_amount || 0))} por premiado
                </div>
                <button
                  onClick={drawNext}
                  disabled={drawing || remaining <= 0 || eligible.length === 0}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold disabled:opacity-50"
                  style={{ background: accent, color: '#04121a' }}
                >
                  {drawing ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                  Sortear próximo
                </button>
              </div>

              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Trophy size={15} /> Ganhadores ({results.length}/{draft.winners_count})
                </div>
                {results.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">Nenhum ganhador sorteado ainda.</p>
                ) : (
                  <div ref={winnersRef} className="mt-2 max-h-72 overflow-y-auto scroll-smooth space-y-2">
                    {results.map((r, i) => (
                      <div key={r.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                        <span className="w-6 text-center text-xs text-muted-foreground">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{r.user_name}</div>
                          <div className="text-[11px] text-muted-foreground">ID {r.account_id} · {formatBetDateTime(r.created_at)}</div>
                        </div>
                        <span className="font-bold" style={{ color: accent }}>{fmtBRL(Number(r.prize_amount || 0))}</span>
                        <span className={`text-[10px] rounded-full px-2 py-0.5 ${r.prize_payment_id ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                          {r.prize_payment_id ? 'Pagamento criado' : 'Sem pagamento'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                <Sparkles size={13} className="mt-0.5 shrink-0" />
                Cada ganhador gera um pagamento PIX no Financeiro. Quem tem pagamento automático ativo recebe na hora; os demais ficam pendentes para você aprovar.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
