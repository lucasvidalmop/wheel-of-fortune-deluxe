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
  page_config: Record<string, any>;
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

interface RevealRow {
  key: string;
  name: string;
  accountId: string;
  email: string;
  amount: number;
  isGhost: boolean;
  participantId: string | null;
  entryNumber: number | null;
  status: 'hidden' | 'revealed' | 'paid';
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

  // Live draw dynamics (same model as the influencer raffle)
  const [drawQty, setDrawQty] = useState(1);
  const [ghostText, setGhostText] = useState('');
  const [probability, setProbability] = useState(100);
  const [minReal, setMinReal] = useState(0);
  const [reveals, setReveals] = useState<RevealRow[]>([]);
  const [savingDraw, setSavingDraw] = useState(false);
  const revealEndRef = useRef<HTMLDivElement>(null);

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
      message: 'Isso remove o evento, os inscritos e os resultados. Os pagamentos já criados são mantidos no Financeiro.',
      confirmLabel: 'Excluir',
      variant: 'danger',
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

  const ghostNames = useMemo(
    () => ghostText.split('\n').map(s => s.trim()).filter(Boolean),
    [ghostText],
  );

  // Hydrate the draw settings stored on the event
  useEffect(() => {
    const ev = events.find(e => e.id === selectedId);
    const cfg = (ev?.page_config as any)?.draw || {};
    setGhostText(Array.isArray(cfg.ghosts) ? cfg.ghosts.join('\n') : '');
    setProbability(typeof cfg.probability === 'number' ? cfg.probability : 100);
    setMinReal(typeof cfg.minReal === 'number' ? cfg.minReal : 0);
    setDrawQty(1);
    setReveals([]);
  }, [selectedId, events]);

  const saveDrawSettings = async () => {
    if (!draft) return;
    setSavingDraw(true);
    const page_config = {
      ...(draft.page_config || {}),
      draw: { ghosts: ghostNames, probability, minReal },
    };
    const { error } = await (supabase as any).from('gorjeta_events').update({ page_config }).eq('id', draft.id);
    setSavingDraw(false);
    if (error) { toast.error('Erro ao salvar ajustes'); return; }
    setEvents(prev => prev.map(e => (e.id === draft.id ? { ...e, page_config } : e)));
    toast.success('Ajustes do sorteio salvos');
  };

  const delay = (ms: number) => new Promise<void>(r => window.setTimeout(r, ms));
  const fakeAccountId = () => Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join('');

  const persistWinner = async (row: RevealRow) => {
    if (!draft) return;
    let paymentId: string | null = null;
    let wheelUserId: string | null = null;

    if (!row.isGhost) {
      const { data: wu } = await (supabase as any)
        .from('wheel_users')
        .select('id, auto_payment')
        .eq('owner_id', ownerId)
        .eq('account_id', row.accountId)
        .maybeSingle();
      wheelUserId = wu?.id || null;

      if (row.amount > 0) {
        const { data: pay, error: payErr } = await (supabase as any).rpc('create_prize_payment', {
          p_owner_id: ownerId,
          p_account_id: row.accountId,
          p_user_name: row.name,
          p_user_email: row.email,
          p_prize: `Sorteio ao Vivo — ${draft.name} (${fmtBRL(row.amount)})`,
          p_amount: row.amount,
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
    }

    const { error: resErr } = await (supabase as any).from('gorjeta_event_results').insert({
      event_id: draft.id,
      owner_id: ownerId,
      participant_id: row.participantId,
      wheel_user_id: wheelUserId,
      user_name: row.name,
      user_email: row.email,
      account_id: row.accountId,
      game: 'live_draw',
      outcome: { entry_number: row.entryNumber },
      is_winner: true,
      prize_type: 'pix',
      prize_label: fmtBRL(row.amount),
      prize_amount: row.amount,
      prize_payment_id: paymentId,
      is_ghost: row.isGhost,
    });
    if (resErr) throw resErr;

    if (row.participantId) {
      await (supabase as any).from('gorjeta_event_participants').update({ has_won: true }).eq('id', row.participantId);
    }
  };

  const executeDraw = async () => {
    if (!draft) return;
    if (remaining <= 0) { toast.error('Todos os premiados já foram sorteados'); return; }
    if (eligible.length === 0 && ghostNames.length === 0) { toast.error('Nenhum participante elegível'); return; }

    const qty = Math.max(1, Math.min(drawQty, remaining));
    const amount = Number(draft.prize_amount || 0);
    const realPool = [...eligible].sort(() => Math.random() - 0.5);
    const ghostPool = [...ghostNames].sort(() => Math.random() - 0.5);

    const picked: RevealRow[] = [];
    let ri = 0;
    let gi = 0;

    const pushReal = () => {
      const p = realPool[ri++];
      picked.push({
        key: p.id, name: p.user_name, accountId: p.account_id, email: p.user_email,
        amount, isGhost: false, participantId: p.id, entryNumber: p.entry_number, status: 'hidden',
      });
    };
    const pushGhost = () => {
      const name = ghostPool[gi++];
      picked.push({
        key: `ghost-${gi}-${Math.random().toString(36).slice(2, 8)}`, name,
        accountId: fakeAccountId(), email: '', amount,
        isGhost: true, participantId: null, entryNumber: null, status: 'hidden',
      });
    };

    const forcedReal = Math.min(minReal, realPool.length, qty);
    for (let i = 0; i < forcedReal; i++) pushReal();

    while (picked.length < qty) {
      const wantReal = Math.random() * 100 < probability;
      if (wantReal && ri < realPool.length) pushReal();
      else if (gi < ghostPool.length) pushGhost();
      else if (ri < realPool.length) pushReal();
      else break;
    }

    if (!picked.length) { toast.error('Sem participantes suficientes'); return; }
    picked.sort(() => Math.random() - 0.5);

    setDrawing(true);
    setReveals(picked);
    try {
      await (supabase as any).from('gorjeta_events').update({ status: 'running' }).eq('id', draft.id);

      // Suspense: cycle through every candidate name
      const spinNames = [...eligible.map(e => e.user_name), ...ghostNames];
      const spinMs = 2200;
      const start = Date.now();
      await new Promise<void>(resolve => {
        const timer = window.setInterval(() => {
          setRolling(spinNames[Math.floor(Math.random() * spinNames.length)] || '');
          if (Date.now() - start >= spinMs) { window.clearInterval(timer); resolve(); }
        }, 70);
      });
      setRolling('');

      for (let i = 0; i < picked.length; i++) {
        setReveals(prev => prev.map((r, idx) => (idx === i ? { ...r, status: 'revealed' } : r)));
        await delay(650);
        await persistWinner(picked[i]);
        setReveals(prev => prev.map((r, idx) => (idx === i ? { ...r, status: 'paid' } : r)));
        await delay(180);
      }

      const total = results.length + picked.length;
      await (supabase as any).from('gorjeta_events')
        .update({ drawn_count: total, status: total >= draft.winners_count ? 'finished' : 'running' })
        .eq('id', draft.id);

      toast.success(`🎉 ${picked.length} ganhador(es) sorteado(s)!`);
      await loadEntries(draft.id);
      setEvents(prev => prev.map(e => (e.id === draft.id ? { ...e, drawn_count: total } : e)));
    } catch (err: any) {
      toast.error('Erro ao sortear: ' + (err?.message || ''));
    } finally {
      setDrawing(false);
      setRolling('');
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
              {/* Draw dynamics */}
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className={label}>Sortear quantos por rodada</label>
                  <input
                    type="number" min={1} className={field}
                    value={drawQty}
                    onChange={e => setDrawQty(Math.max(1, Number(e.target.value) || 1))}
                  />
                </div>
                <div>
                  <label className={label}>Chance de ganhador real (%)</label>
                  <input
                    type="number" min={0} max={100} className={field}
                    value={probability}
                    onChange={e => setProbability(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                  />
                </div>
                <div>
                  <label className={label}>Mínimo de ganhadores reais</label>
                  <input
                    type="number" min={0} className={field}
                    value={minReal}
                    onChange={e => setMinReal(Math.max(0, Number(e.target.value) || 0))}
                  />
                </div>
              </div>
              <div>
                <label className={label}>Participantes fantasmas (um nome por linha)</label>
                <textarea
                  className={`${field} min-h-[90px] font-mono text-xs`}
                  placeholder={'Maria Souza\nJoão Pedro'}
                  value={ghostText}
                  onChange={e => setGhostText(e.target.value)}
                />
                <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{ghostNames.length} fantasma(s) · somam na contagem pública de inscritos</span>
                  <button onClick={saveDrawSettings} disabled={savingDraw} className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1">
                    {savingDraw ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Salvar ajustes
                  </button>
                </div>
              </div>

              {/* Stage */}
              <div className="rounded-xl p-6 text-center" style={{ background: `${accent}12`, border: `1px solid ${accent}40` }}>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  {drawing ? (rolling ? 'Sorteando...' : 'Revelando ganhadores') : 'Pronto para sortear'}
                </div>
                <div className="mt-2 text-2xl font-extrabold min-h-[2rem]" style={{ color: accent }}>
                  {rolling || (remaining > 0 ? `${remaining} prêmio(s) restante(s)` : 'Sorteio concluído')}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {eligible.length} inscrito(s) elegível(is) + {ghostNames.length} fantasma(s) · {fmtBRL(Number(draft.prize_amount || 0))} por premiado
                </div>

                {reveals.length > 0 && (
                  <div className="mt-4 space-y-2 max-h-64 overflow-y-auto text-left">
                    {reveals.map(r => (
                      <div
                        key={r.key}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all ${r.status === 'hidden' ? 'opacity-40' : 'animate-scale-in'}`}
                        style={{ borderColor: `${accent}40`, background: r.status === 'hidden' ? 'transparent' : `${accent}14` }}
                      >
                        <Trophy size={14} style={{ color: accent }} />
                        <span className="flex-1 min-w-0 truncate font-semibold">
                          {r.status === 'hidden' ? '• • • • •' : r.name}
                        </span>
                        {r.status !== 'hidden' && (
                          <span className="text-xs font-bold" style={{ color: accent }}>{fmtBRL(r.amount)}</span>
                        )}
                        {r.status === 'revealed' && <Loader2 size={13} className="animate-spin text-muted-foreground" />}
                        {r.status === 'paid' && <span className="text-[10px] text-emerald-400">ok</span>}
                      </div>
                    ))}
                    <div ref={revealEndRef} />
                  </div>
                )}

                <button
                  onClick={executeDraw}
                  disabled={drawing || remaining <= 0 || (eligible.length === 0 && ghostNames.length === 0)}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold disabled:opacity-50"
                  style={{ background: accent, color: '#04121a' }}
                >
                  {drawing ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                  Sortear agora
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
