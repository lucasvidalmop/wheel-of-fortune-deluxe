import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Plus, Save, Trash2, Copy, ExternalLink, Users, ShieldAlert, Trophy,
  Search, Ban, CheckCircle2, Radio, Download, RefreshCw, Loader2, X,
} from 'lucide-react';
import {
  RAFFLE_STATUS_LABEL, PARTICIPANT_STATUS_LABEL, RAFFLE_FLAG_LABEL,
  formatDateTime, maskAccount, type RaffleStatus, type ParticipantStatus,
} from '@/lib/raffle';

const db = supabase as any;

interface RaffleEventRow {
  id: string;
  owner_id: string;
  tag: string;
  name: string;
  description: string;
  banner_url: string;
  rules: string;
  prize_label: string;
  signup_url: string;
  min_participants: number;
  max_participants: number | null;
  winners_count: number;
  opens_at: string | null;
  closes_at: string | null;
  draw_at: string | null;
  status: RaffleStatus;
  locked_at: string | null;
  locked_count: number;
  is_active: boolean;
  created_at: string;
}

interface ParticipantRow {
  id: string;
  account_id: string;
  email: string;
  display_name: string;
  public_code: string;
  status: ParticipantStatus;
  flags: string[];
  ip_address: string | null;
  city: string | null;
  country: string | null;
  device_type: string | null;
  internal_note: string;
  created_at: string;
}

interface DrawRow {
  id: string;
  round: number;
  participants_snapshot_count: number;
  winners: { name: string; maskedName: string; code: string; position: number }[];
  executed_at: string;
  redraw_reason: string;
  superseded: boolean;
}

const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

const STATUSES: RaffleStatus[] = ['draft', 'scheduled', 'open', 'closed', 'live', 'finished', 'cancelled'];

const emptyEvent = (ownerId: string): Partial<RaffleEventRow> => ({
  owner_id: ownerId,
  tag: '',
  name: 'Novo sorteio',
  description: '',
  banner_url: '',
  rules: '',
  prize_label: '',
  signup_url: '',
  min_participants: 0,
  max_participants: null,
  winners_count: 1,
  status: 'draft',
  is_active: true,
});

const inputCls =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary';

const RafflePanel = ({ ownerId }: { ownerId: string }) => {
  const [tab, setTab] = useState<'eventos' | 'participantes' | 'seguranca' | 'sorteio'>('eventos');
  const [events, setEvents] = useState<RaffleEventRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [draft, setDraft] = useState<Partial<RaffleEventRow> | null>(null);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [draws, setDraws] = useState<DrawRow[]>([]);
  const [restrictions, setRestrictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ParticipantStatus>('all');
  const [redrawReason, setRedrawReason] = useState('');
  const [newRestriction, setNewRestriction] = useState({ kind: 'email', value: '', reason: '' });

  const selected = useMemo(() => events.find((e) => e.id === selectedId) || null, [events, selectedId]);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const { data, error } = await db
      .from('raffle_events').select('*').eq('owner_id', ownerId)
      .order('created_at', { ascending: false });
    if (error) toast.error('Erro ao carregar eventos');
    setEvents(data || []);
    setSelectedId((prev) => prev || data?.[0]?.id || '');
    setLoading(false);
  }, [ownerId]);

  const loadDetails = useCallback(async (eventId: string) => {
    if (!eventId) { setParticipants([]); setDraws([]); setRestrictions([]); return; }
    const [{ data: p }, { data: d }, { data: r }] = await Promise.all([
      db.from('raffle_participants').select('*').eq('event_id', eventId).order('created_at', { ascending: false }),
      db.from('raffle_draws').select('*').eq('event_id', eventId).order('round', { ascending: false }),
      db.from('raffle_restrictions').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false }),
    ]);
    setParticipants(p || []);
    setDraws(d || []);
    setRestrictions(r || []);
  }, [ownerId]);

  useEffect(() => { void loadEvents(); }, [loadEvents]);
  useEffect(() => { void loadDetails(selectedId); }, [selectedId, loadDetails]);
  useEffect(() => { setDraft(selected ? { ...selected } : null); }, [selected]);

  // Realtime: inscrições chegando durante o evento.
  useEffect(() => {
    if (!selectedId) return;
    const channel = supabase
      .channel(`raffle_admin_${selectedId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'raffle_participants', filter: `event_id=eq.${selectedId}` },
        () => { void loadDetails(selectedId); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedId, loadDetails]);

  const counts = useMemo(() => ({
    total: participants.length,
    approved: participants.filter((p) => p.status === 'approved').length,
    review: participants.filter((p) => p.status === 'review').length,
    blocked: participants.filter((p) => p.status === 'blocked').length,
  }), [participants]);

  const createEvent = async () => {
    const tag = `sorteio-${Date.now().toString(36)}`;
    const { data, error } = await db.from('raffle_events')
      .insert({ ...emptyEvent(ownerId), tag }).select('*').maybeSingle();
    if (error) { toast.error('Erro ao criar evento'); return; }
    toast.success('Evento criado');
    setEvents((prev) => [data, ...prev]);
    setSelectedId(data.id);
    setTab('eventos');
  };

  const duplicateEvent = async () => {
    if (!selected) return;
    const { id, created_at, locked_at, locked_count, ...rest } = selected as any;
    const { data, error } = await db.from('raffle_events').insert({
      ...rest,
      tag: `${selected.tag}-copia-${Date.now().toString(36).slice(-4)}`,
      name: `${selected.name} (cópia)`,
      status: 'draft',
      locked_count: 0,
    }).select('*').maybeSingle();
    if (error) { toast.error('Erro ao duplicar'); return; }
    toast.success('Evento duplicado');
    setEvents((prev) => [data, ...prev]);
    setSelectedId(data.id);
  };

  const saveEvent = async () => {
    if (!draft?.id) return;
    const tag = String(draft.tag || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (!tag) { toast.error('Informe a tag (link público)'); return; }
    if (!String(draft.name || '').trim()) { toast.error('Informe o nome do evento'); return; }
    setSaving(true);
    const { error } = await db.from('raffle_events').update({
      tag,
      name: draft.name,
      description: draft.description || '',
      banner_url: draft.banner_url || '',
      rules: draft.rules || '',
      prize_label: draft.prize_label || '',
      signup_url: draft.signup_url || '',
      min_participants: Number(draft.min_participants) || 0,
      max_participants: draft.max_participants ? Number(draft.max_participants) : null,
      winners_count: Math.max(1, Number(draft.winners_count) || 1),
      opens_at: draft.opens_at || null,
      closes_at: draft.closes_at || null,
      draw_at: draft.draw_at || null,
      status: draft.status,
      is_active: draft.is_active !== false,
    }).eq('id', draft.id);
    setSaving(false);
    if (error) {
      toast.error(String(error.message).includes('duplicate') ? 'Já existe um evento com essa tag' : 'Erro ao salvar');
      return;
    }
    toast.success('Evento salvo');
    void loadEvents();
  };

  const deleteEvent = async () => {
    if (!selected) return;
    if (!window.confirm(`Excluir "${selected.name}" e todas as inscrições? Esta ação é irreversível.`)) return;
    const { error } = await db.from('raffle_events').delete().eq('id', selected.id);
    if (error) { toast.error('Erro ao excluir'); return; }
    toast.success('Evento excluído');
    setSelectedId('');
    void loadEvents();
  };

  const setStatus = async (status: RaffleStatus) => {
    if (!selected) return;
    const patch: Record<string, unknown> = { status };
    if (status === 'closed') {
      patch.locked_at = new Date().toISOString();
      patch.locked_count = counts.approved;
    }
    const { error } = await db.from('raffle_events').update(patch).eq('id', selected.id);
    if (error) { toast.error('Erro ao atualizar status'); return; }
    toast.success(`Status: ${RAFFLE_STATUS_LABEL[status]}`);
    void loadEvents();
  };

  const setParticipantStatus = async (id: string, status: ParticipantStatus) => {
    const { error } = await db.from('raffle_participants')
      .update({ status, reviewed_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast.error('Erro ao atualizar participante'); return; }
    void loadDetails(selectedId);
  };

  const removeParticipant = async (id: string) => {
    if (!window.confirm('Remover esta inscrição?')) return;
    const { error } = await db.from('raffle_participants').delete().eq('id', id);
    if (error) { toast.error('Erro ao remover'); return; }
    void loadDetails(selectedId);
  };

  const saveNote = async (id: string, note: string) => {
    await db.from('raffle_participants').update({ internal_note: note }).eq('id', id);
  };

  const addRestriction = async () => {
    const value = newRestriction.value.trim();
    if (!value) { toast.error('Informe o valor'); return; }
    const { error } = await db.from('raffle_restrictions').insert({
      owner_id: ownerId, event_id: selectedId || null,
      kind: newRestriction.kind, value, reason: newRestriction.reason,
    });
    if (error) { toast.error('Erro ao adicionar restrição'); return; }
    setNewRestriction({ kind: 'email', value: '', reason: '' });
    void loadDetails(selectedId);
  };

  const removeRestriction = async (id: string) => {
    await db.from('raffle_restrictions').delete().eq('id', id);
    void loadDetails(selectedId);
  };

  const runDraw = async () => {
    if (!selected) return;
    const hasPrevious = draws.some((d) => !d.superseded);
    if (hasPrevious && !redrawReason.trim()) {
      toast.error('Informe a justificativa para refazer o sorteio');
      return;
    }
    if (!window.confirm(
      hasPrevious
        ? 'Refazer o sorteio? O resultado anterior será substituído.'
        : `Executar o sorteio com ${counts.approved} participantes válidos?`,
    )) return;
    setDrawing(true);
    const { data, error } = await supabase.functions.invoke('run-raffle-draw', {
      body: { eventId: selected.id, redrawReason: redrawReason.trim() },
    });
    setDrawing(false);
    const payload: any = data ?? (error as any)?.context?.body ?? null;
    if (!payload?.ok) { toast.error(payload?.error || 'Falha ao executar o sorteio'); return; }
    toast.success('Sorteio executado!');
    setRedrawReason('');
    void loadEvents();
    void loadDetails(selected.id);
  };

  const exportCsv = () => {
    const rows = [
      ['codigo', 'nome', 'email', 'id_conta', 'status', 'sinais', 'cidade', 'pais', 'data'],
      ...participants.map((p) => [
        p.public_code, p.display_name, p.email, p.account_id, p.status,
        (p.flags || []).join('|'), p.city || '', p.country || '', formatDateTime(p.created_at),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `sorteio-${selected?.tag || 'participantes'}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = participants.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [p.display_name, p.email, p.account_id, p.public_code]
      .some((v) => String(v || '').toLowerCase().includes(q));
  });

  const publicUrl = selected ? `${window.location.origin}/sorteio=${selected.tag}` : '';
  const liveUrl = selected ? `${window.location.origin}/live=${selected.tag}` : '';
  const activeDraw = draws.find((d) => !d.superseded) || null;

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-5">
      {/* Header + seletor de evento */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedId} onChange={(e) => setSelectedId(e.target.value)}
          className={`${inputCls} max-w-xs`}
        >
          <option value="">Selecione um evento</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>{e.name} · {RAFFLE_STATUS_LABEL[e.status]}</option>
          ))}
        </select>
        <button onClick={createEvent} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
          <Plus size={15} /> Novo sorteio
        </button>
        {selected && (
          <>
            <button onClick={duplicateEvent} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm">
              <Copy size={15} /> Duplicar
            </button>
            <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm">
              <ExternalLink size={15} /> Página pública
            </a>
            <a href={liveUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm">
              <Radio size={15} /> Tela ao vivo
            </a>
            <button onClick={() => { void loadEvents(); void loadDetails(selectedId); }} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm">
              <RefreshCw size={15} />
            </button>
          </>
        )}
      </div>

      {!selected ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nenhum evento selecionado. Crie um novo sorteio para começar.
        </div>
      ) : (
        <>
          {/* Indicadores */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { l: 'Inscrições', v: counts.total },
              { l: 'Aprovados', v: counts.approved },
              { l: 'Em análise', v: counts.review },
              { l: 'Bloqueados', v: counts.blocked },
              { l: 'Meta', v: `${selected.min_participants ? Math.min(100, Math.round((counts.approved / selected.min_participants) * 100)) : 0}%` },
            ].map((k) => (
              <div key={k.l} className="rounded-xl border border-border bg-card p-3">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{k.l}</p>
                <p className="text-xl font-bold">{k.v}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-2 border-b border-border pb-2">
            {([
              ['eventos', 'Evento', <Save key="i" size={14} />],
              ['participantes', 'Participantes', <Users key="i" size={14} />],
              ['seguranca', 'Análise de Segurança', <ShieldAlert key="i" size={14} />],
              ['sorteio', 'Sorteio / Resultado', <Trophy key="i" size={14} />],
            ] as const).map(([key, label, icon]) => (
              <button
                key={key} onClick={() => setTab(key as any)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm ${
                  tab === key ? 'bg-primary text-primary-foreground font-semibold' : 'border border-border'
                }`}
              >
                {icon} {label}
              </button>
            ))}
          </div>

          {/* ═══ EVENTO ═══ */}
          {tab === 'eventos' && draft && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">Nome do evento</span>
                  <input className={inputCls} value={draft.name || ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">Tag (link público)</span>
                  <input className={inputCls} value={draft.tag || ''} onChange={(e) => setDraft({ ...draft, tag: e.target.value })} />
                </label>
                <label className="space-y-1 sm:col-span-2">
                  <span className="text-xs text-muted-foreground">Descrição curta</span>
                  <input className={inputCls} value={draft.description || ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">Prêmio</span>
                  <input className={inputCls} value={draft.prize_label || ''} onChange={(e) => setDraft({ ...draft, prize_label: e.target.value })} />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">Banner (URL)</span>
                  <input className={inputCls} value={draft.banner_url || ''} onChange={(e) => setDraft({ ...draft, banner_url: e.target.value })} />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">Link de cadastro (sem conta)</span>
                  <input className={inputCls} placeholder="/gorjeta ou link do seu ref" value={draft.signup_url || ''} onChange={(e) => setDraft({ ...draft, signup_url: e.target.value })} />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">Ganhadores</span>
                  <input type="number" min={1} className={inputCls} value={draft.winners_count ?? 1} onChange={(e) => setDraft({ ...draft, winners_count: Number(e.target.value) })} />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">Mínimo de participantes</span>
                  <input type="number" min={0} className={inputCls} value={draft.min_participants ?? 0} onChange={(e) => setDraft({ ...draft, min_participants: Number(e.target.value) })} />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">Máximo (opcional)</span>
                  <input type="number" min={0} className={inputCls} value={draft.max_participants ?? ''} onChange={(e) => setDraft({ ...draft, max_participants: e.target.value ? Number(e.target.value) : null })} />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">Abertura das inscrições</span>
                  <input type="datetime-local" className={inputCls} value={toLocalInput(draft.opens_at || null)} onChange={(e) => setDraft({ ...draft, opens_at: fromLocalInput(e.target.value) })} />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">Encerramento das inscrições</span>
                  <input type="datetime-local" className={inputCls} value={toLocalInput(draft.closes_at || null)} onChange={(e) => setDraft({ ...draft, closes_at: fromLocalInput(e.target.value) })} />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">Data do sorteio</span>
                  <input type="datetime-local" className={inputCls} value={toLocalInput(draft.draw_at || null)} onChange={(e) => setDraft({ ...draft, draw_at: fromLocalInput(e.target.value) })} />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">Status</span>
                  <select className={inputCls} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as RaffleStatus })}>
                    {STATUSES.map((s) => <option key={s} value={s}>{RAFFLE_STATUS_LABEL[s]}</option>)}
                  </select>
                </label>
                <label className="space-y-1 sm:col-span-2">
                  <span className="text-xs text-muted-foreground">Regulamento</span>
                  <textarea rows={5} className={inputCls} value={draft.rules || ''} onChange={(e) => setDraft({ ...draft, rules: e.target.value })} />
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button onClick={saveEvent} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Salvar
                </button>
                <button onClick={() => setStatus('open')} className="rounded-lg border border-border px-3 py-2 text-sm">Abrir inscrições</button>
                <button onClick={() => setStatus('closed')} className="rounded-lg border border-border px-3 py-2 text-sm">Encerrar inscrições</button>
                <button onClick={() => setStatus('live')} className="rounded-lg border border-border px-3 py-2 text-sm">Colocar ao vivo</button>
                <button onClick={deleteEvent} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive">
                  <Trash2 size={15} /> Excluir
                </button>
              </div>

              {selected.locked_at && (
                <p className="text-xs text-muted-foreground">
                  Lista travada em {formatDateTime(selected.locked_at)} com {selected.locked_count} participantes válidos.
                </p>
              )}
            </div>
          )}

          {/* ═══ PARTICIPANTES ═══ */}
          {tab === 'participantes' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input className={`${inputCls} pl-9`} placeholder="Buscar por nome, e-mail, ID ou código" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <select className={`${inputCls} max-w-[180px]`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
                  <option value="all">Todos</option>
                  <option value="approved">Aprovados</option>
                  <option value="review">Em análise</option>
                  <option value="blocked">Bloqueados</option>
                </select>
                <button onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm">
                  <Download size={15} /> CSV
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Código</th>
                      <th className="px-3 py-2">Participante</th>
                      <th className="px-3 py-2">ID</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Sinais</th>
                      <th className="px-3 py-2">Inscrição</th>
                      <th className="px-3 py-2 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => (
                      <tr key={p.id} className="border-t border-border/60">
                        <td className="px-3 py-2 font-mono text-xs">{p.public_code}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium">{p.display_name || '—'}</div>
                          <div className="text-xs text-muted-foreground">{p.email}</div>
                        </td>
                        <td className="px-3 py-2 text-xs">{p.account_id}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] ${
                            p.status === 'approved' ? 'bg-emerald-500/15 text-emerald-500'
                              : p.status === 'review' ? 'bg-amber-500/15 text-amber-500'
                                : 'bg-destructive/15 text-destructive'
                          }`}>
                            {PARTICIPANT_STATUS_LABEL[p.status]}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {(p.flags || []).length ? (p.flags || []).length : '—'}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{formatDateTime(p.created_at)}</td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-1">
                            {p.status !== 'approved' && (
                              <button title="Aprovar" onClick={() => setParticipantStatus(p.id, 'approved')} className="rounded-md border border-border p-1.5"><CheckCircle2 size={14} /></button>
                            )}
                            {p.status !== 'blocked' && (
                              <button title="Bloquear" onClick={() => setParticipantStatus(p.id, 'blocked')} className="rounded-md border border-border p-1.5"><Ban size={14} /></button>
                            )}
                            <button title="Remover" onClick={() => removeParticipant(p.id)} className="rounded-md border border-destructive/40 p-1.5 text-destructive"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Nenhum participante encontrado.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═══ SEGURANÇA ═══ */}
          {tab === 'seguranca' && (
            <div className="space-y-5">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Inscrições em análise ou bloqueadas</h3>
                {participants.filter((p) => p.status !== 'approved').length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhuma inscrição pendente de análise.</p>
                )}
                {participants.filter((p) => p.status !== 'approved').map((p) => (
                  <div key={p.id} className="rounded-xl border border-border p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{p.display_name || p.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.email} · ID {maskAccount(p.account_id)} · {p.city || '—'}/{p.country || '—'} · {p.device_type || '—'}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => setParticipantStatus(p.id, 'approved')} className="rounded-md border border-border px-2 py-1 text-xs">Aprovar</button>
                        <button onClick={() => setParticipantStatus(p.id, 'blocked')} className="rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive">Bloquear</button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(p.flags || []).map((f) => (
                        <span key={f} className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-500">
                          {RAFFLE_FLAG_LABEL[f] || f}
                        </span>
                      ))}
                    </div>
                    <input
                      className={inputCls} defaultValue={p.internal_note} placeholder="Observação interna"
                      onBlur={(e) => saveNote(p.id, e.target.value)}
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Lista de restrição</h3>
                <div className="flex flex-wrap gap-2">
                  <select className={`${inputCls} max-w-[160px]`} value={newRestriction.kind} onChange={(e) => setNewRestriction({ ...newRestriction, kind: e.target.value })}>
                    <option value="email">E-mail</option>
                    <option value="account_id">ID da conta</option>
                    <option value="ip">Endereço de acesso</option>
                  </select>
                  <input className={`${inputCls} flex-1 min-w-[180px]`} placeholder="Valor" value={newRestriction.value} onChange={(e) => setNewRestriction({ ...newRestriction, value: e.target.value })} />
                  <input className={`${inputCls} flex-1 min-w-[160px]`} placeholder="Motivo" value={newRestriction.reason} onChange={(e) => setNewRestriction({ ...newRestriction, reason: e.target.value })} />
                  <button onClick={addRestriction} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Adicionar</button>
                </div>
                <div className="space-y-1">
                  {restrictions.map((r) => (
                    <div key={r.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                      <span>
                        <span className="text-muted-foreground">{r.kind}:</span> {r.value}
                        {r.reason && <span className="text-xs text-muted-foreground"> · {r.reason}</span>}
                      </span>
                      <button onClick={() => removeRestriction(r.id)} className="text-muted-foreground hover:text-destructive"><X size={15} /></button>
                    </div>
                  ))}
                  {restrictions.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma restrição cadastrada.</p>}
                </div>
              </div>
            </div>
          )}

          {/* ═══ SORTEIO ═══ */}
          {tab === 'sorteio' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border p-4 space-y-3">
                <p className="text-sm">
                  Participantes válidos: <strong>{counts.approved}</strong>
                  {selected.min_participants > 0 && <> · mínimo exigido: <strong>{selected.min_participants}</strong></>}
                </p>
                {selected.status !== 'closed' && selected.status !== 'live' && selected.status !== 'finished' && (
                  <p className="text-xs text-amber-500">
                    Encerre as inscrições antes de sortear para travar a lista de participantes.
                  </p>
                )}
                {activeDraw && (
                  <input
                    className={inputCls} placeholder="Justificativa para refazer o sorteio"
                    value={redrawReason} onChange={(e) => setRedrawReason(e.target.value)}
                  />
                )}
                <button
                  onClick={runDraw}
                  disabled={drawing || counts.approved < Math.max(1, selected.min_participants)}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
                >
                  {drawing ? <Loader2 size={16} className="animate-spin" /> : <Trophy size={16} />}
                  {activeDraw ? 'Refazer sorteio' : 'Executar sorteio'}
                </button>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Histórico de sorteios</h3>
                {draws.length === 0 && <p className="text-sm text-muted-foreground">Nenhum sorteio realizado ainda.</p>}
                {draws.map((d) => (
                  <div key={d.id} className={`rounded-xl border p-3 ${d.superseded ? 'border-border/50 opacity-60' : 'border-primary/40'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">
                        Rodada {d.round} {d.superseded && <span className="text-xs text-muted-foreground">(substituída)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(d.executed_at)} · {d.participants_snapshot_count} participantes
                      </p>
                    </div>
                    <div className="mt-2 space-y-1">
                      {(d.winners || []).map((w) => (
                        <div key={w.code} className="flex items-center justify-between text-sm">
                          <span>{w.position}º — {w.name} <span className="text-xs text-muted-foreground">({w.maskedName})</span></span>
                          <span className="font-mono text-xs text-muted-foreground">{w.code}</span>
                        </div>
                      ))}
                    </div>
                    {d.redraw_reason && (
                      <p className="mt-2 text-xs text-amber-500">Justificativa: {d.redraw_reason}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default RafflePanel;
