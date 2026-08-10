import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, RefreshCw, Loader2, MessageCircle } from 'lucide-react';

const db = supabase as any;

interface EventRow {
  id: string;
  owner_id: string;
  name: string;
  evolution_instance: string;
  group_jid: string;
  group_name: string;
  scope: 'individual' | 'group' | 'both';
  status: 'draft' | 'active' | 'finished';
  is_active: boolean;
  created_at: string;
}

interface TierRow {
  id: string;
  event_id: string;
  scope: 'individual' | 'group';
  threshold_messages: number;
  reward_type: 'spin' | 'box' | 'coin' | 'cash';
  reward_amount: number;
  reward_label: string;
  reward_case_id: string | null;
  position: number;
}

interface LuckyboxCaseRow {
  id: string;
  name: string;
}

interface ProgressRow {
  id: string;
  scope: string;
  sender_phone: string;
  sender_name: string;
  message_count: number;
}

interface UnlockRow {
  id: string;
  scope: string;
  sender_phone: string;
  sender_name: string;
  reward_type: string;
  reward_amount: number;
  status: string;
  created_at: string;
}

interface MessageRow {
  id: string;
  sender_phone: string;
  sender_name: string;
  message_type: string;
  text_content: string;
  created_at: string;
}

const inputCls =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary';

const REWARD_LABEL: Record<string, string> = { spin: 'Giro grátis', box: 'Caixa (Luckybox)', coin: 'Coins', cash: 'R$ (aprovação)' };
const UNLOCK_STATUS_LABEL: Record<string, string> = {
  granted: 'Liberado', pending_approval: 'Aguardando aprovação (Financeiro)',
  pending_manual: 'Ação manual necessária', unmatched: 'Sem cadastro vinculado', pending: 'Processando',
};

const INSTANCE_OPTIONS = [
  { value: 'notify', label: 'Notificações (recomendado)' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'whatsapp2', label: 'WhatsApp 2' },
];

export default function WhatsappActivityPanel({ ownerId }: { ownerId: string }) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<Partial<EventRow> | null>(null);
  const [tiers, setTiers] = useState<TierRow[]>([]);
  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [unlocks, setUnlocks] = useState<UnlockRow[]>([]);
  const [tab, setTab] = useState<'evento' | 'progresso' | 'desbloqueios'>('evento');
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [messagesFor, setMessagesFor] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [luckyboxCases, setLuckyboxCases] = useState<LuckyboxCaseRow[]>([]);

  const selected = events.find((e) => e.id === selectedId) || null;

  const loadEvents = useCallback(async () => {
    const { data } = await db.from('whatsapp_activity_events').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false });
    setEvents(data || []);
  }, [ownerId]);

  useEffect(() => { void loadEvents(); }, [loadEvents]);

  useEffect(() => {
    (async () => {
      const { data } = await db.from('luckybox_cases').select('id, name').eq('owner_id', ownerId).eq('is_active', true).order('position', { ascending: true });
      setLuckyboxCases(data || []);
    })();
  }, [ownerId]);

  useEffect(() => {
    if (!selected) { setDraft(null); setTiers([]); setProgress([]); setUnlocks([]); return; }
    setDraft(selected);
    void loadDetails(selected.id);
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadDetails = async (eventId: string) => {
    const [{ data: t }, { data: p }, { data: u }] = await Promise.all([
      db.from('whatsapp_activity_tiers').select('*').eq('event_id', eventId).order('threshold_messages', { ascending: true }),
      db.from('whatsapp_activity_progress').select('*').eq('event_id', eventId).order('message_count', { ascending: false }),
      db.from('whatsapp_activity_unlocks').select('*').eq('event_id', eventId).order('created_at', { ascending: false }),
    ]);
    setTiers(t || []);
    setProgress(p || []);
    setUnlocks(u || []);
  };

  const createEvent = async () => {
    const { data, error } = await db.from('whatsapp_activity_events').insert({
      owner_id: ownerId, name: 'Novo evento WhatsApp', evolution_instance: 'notify',
      group_jid: '', group_name: '', scope: 'individual', status: 'draft', is_active: true,
    }).select('*').maybeSingle();
    if (error) { toast.error('Erro ao criar evento'); return; }
    toast.success('Evento criado');
    setEvents((prev) => [data, ...prev]);
    setSelectedId(data.id);
  };

  const deleteEvent = async () => {
    if (!selected) return;
    if (!window.confirm(`Excluir "${selected.name}"? Todo o histórico será perdido.`)) return;
    const { error } = await db.from('whatsapp_activity_events').delete().eq('id', selected.id);
    if (error) { toast.error('Erro ao excluir'); return; }
    toast.success('Evento excluído');
    setSelectedId('');
    void loadEvents();
  };

  const saveEvent = async () => {
    if (!draft?.id) return;
    if (!String(draft.name || '').trim()) { toast.error('Informe o nome do evento'); return; }
    if (!draft.group_jid) { toast.error('Selecione o grupo do WhatsApp'); return; }
    setSaving(true);
    const { error } = await db.from('whatsapp_activity_events').update({
      name: draft.name,
      evolution_instance: draft.evolution_instance,
      group_jid: draft.group_jid,
      group_name: draft.group_name || '',
      scope: draft.scope,
      status: draft.status,
      is_active: draft.is_active !== false,
    }).eq('id', draft.id);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar'); return; }
    toast.success('Evento salvo');
    void loadEvents();
  };

  const activateWebhook = async () => {
    if (!draft?.id || !draft.evolution_instance) return;
    setSaving(true);
    const { data, error } = await supabase.functions.invoke('whatsapp-configure-webhook', {
      body: { instanceLabel: draft.evolution_instance },
    });
    setSaving(false);
    const payload: any = data ?? (error as any)?.context?.body ?? null;
    if (!payload?.ok) { toast.error(payload?.error || 'Falha ao configurar webhook'); return; }
    toast.success('Webhook configurado na Evolution API');
    await db.from('whatsapp_activity_events').update({ status: 'active' }).eq('id', draft.id);
    setDraft((d) => (d ? { ...d, status: 'active' } : d));
    void loadEvents();
  };

  const fetchGroups = async () => {
    if (!draft?.evolution_instance) return;
    setLoadingGroups(true);
    const { data, error } = await supabase.functions.invoke('whatsapp-list-groups', {
      body: { instanceLabel: draft.evolution_instance },
    });
    setLoadingGroups(false);
    const payload: any = data ?? (error as any)?.context?.body ?? null;
    if (!payload?.ok) { toast.error(payload?.error || 'Falha ao buscar grupos'); return; }
    setGroups(payload.groups || []);
    if ((payload.groups || []).length === 0) toast.error('Nenhum grupo encontrado para esse número');
  };

  const addTier = async () => {
    if (!selected) return;
    const { data, error } = await db.from('whatsapp_activity_tiers').insert({
      event_id: selected.id, scope: selected.scope === 'group' ? 'group' : 'individual',
      threshold_messages: 10, reward_type: 'spin', reward_amount: 1, reward_label: '', position: tiers.length,
    }).select('*').maybeSingle();
    if (error) { toast.error('Erro ao adicionar meta'); return; }
    setTiers((prev) => [...prev, data]);
  };

  const updateTier = (id: string, patch: Partial<TierRow>) => {
    setTiers((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const saveTier = async (tier: TierRow) => {
    await db.from('whatsapp_activity_tiers').update({
      scope: tier.scope, threshold_messages: tier.threshold_messages, reward_type: tier.reward_type,
      reward_amount: tier.reward_amount, reward_label: tier.reward_label,
      reward_case_id: tier.reward_type === 'box' ? (tier.reward_case_id || null) : null,
    }).eq('id', tier.id);
  };

  const removeTier = async (id: string) => {
    await db.from('whatsapp_activity_tiers').delete().eq('id', id);
    setTiers((prev) => prev.filter((t) => t.id !== id));
  };

  const viewMessages = async (phone: string) => {
    if (!selected) return;
    setMessagesFor(phone);
    const { data } = await db.from('whatsapp_activity_messages').select('*')
      .eq('event_id', selected.id).eq('sender_phone', phone)
      .order('created_at', { ascending: false }).limit(200);
    setMessages(data || []);
  };

  const markUnlockManual = async (id: string, status: 'granted' | 'rejected') => {
    await db.from('whatsapp_activity_unlocks').update({ status }).eq('id', id);
    if (selected) void loadDetails(selected.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <select className={inputCls + ' max-w-xs'} value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          <option value="">Selecione o evento...</option>
          {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <button onClick={createEvent} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
          <Plus size={16} /> Novo evento
        </button>
        {selected && (
          <button onClick={() => void loadDetails(selected.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm">
            <RefreshCw size={15} /> Atualizar
          </button>
        )}
      </div>

      {!selected && (
        <p className="text-sm text-muted-foreground">
          Crie um evento de atividade no WhatsApp: participantes acumulam mensagens em um grupo e desbloqueiam prêmios
          por camadas (giro, caixa, coin ou R$). Prêmios em R$ sempre vão para aprovação manual no Financeiro.
        </p>
      )}

      {selected && draft && (
        <>
          <div className="flex gap-2 border-b border-border">
            {(['evento', 'progresso', 'desbloqueios'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-2 text-sm font-semibold capitalize border-b-2 -mb-px ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>
                {t}
              </button>
            ))}
          </div>

          {tab === 'evento' && (
            <div className="space-y-4 max-w-2xl">
              <label className="space-y-1 block">
                <span className="text-xs text-muted-foreground">Nome do evento</span>
                <input className={inputCls} value={draft.name || ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </label>

              <label className="space-y-1 block">
                <span className="text-xs text-muted-foreground">Número / instância que vai monitorar o grupo</span>
                <select className={inputCls} value={draft.evolution_instance || 'notify'} onChange={(e) => setDraft({ ...draft, evolution_instance: e.target.value })}>
                  {INSTANCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>

              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Grupo do WhatsApp</span>
                <div className="flex gap-2">
                  <select className={inputCls} value={draft.group_jid || ''} onChange={(e) => {
                    const g = groups.find((x) => x.id === e.target.value);
                    setDraft({ ...draft, group_jid: e.target.value, group_name: g?.name || draft.group_name });
                  }}>
                    <option value="">{draft.group_jid ? draft.group_name || draft.group_jid : 'Selecione...'}</option>
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  <button onClick={fetchGroups} disabled={loadingGroups} className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50">
                    {loadingGroups ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Buscar grupos
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">O número selecionado precisa já estar dentro do grupo.</p>
              </div>

              <label className="space-y-1 block">
                <span className="text-xs text-muted-foreground">Tipo de barra de progresso</span>
                <select className={inputCls} value={draft.scope || 'individual'} onChange={(e) => setDraft({ ...draft, scope: e.target.value as any })}>
                  <option value="individual">Individual (cada participante)</option>
                  <option value="group">Em grupo (meta coletiva)</option>
                  <option value="both">Ambos</option>
                </select>
              </label>

              <div className="flex items-center gap-2 text-sm">
                <span className="text-xs text-muted-foreground">Status:</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${draft.status === 'active' ? 'bg-green-500/15 text-green-500' : 'bg-muted text-muted-foreground'}`}>
                  {draft.status === 'active' ? 'Ativo (monitorando)' : draft.status === 'finished' ? 'Encerrado' : 'Rascunho'}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Metas / camadas de prêmio</h3>
                  <button onClick={addTier} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold">
                    <Plus size={14} /> Adicionar meta
                  </button>
                </div>
                {tiers.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma meta cadastrada ainda.</p>}
                {tiers.map((t) => (
                  <div key={t.id} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end rounded-xl border border-border p-3">
                    <label className="space-y-1">
                      <span className="text-[11px] text-muted-foreground">Mensagens</span>
                      <input type="number" onFocus={(e) => e.target.select()} min={1} className={inputCls} value={t.threshold_messages}
                        onChange={(e) => updateTier(t.id, { threshold_messages: Number(e.target.value) || 0 })}
                        onBlur={() => saveTier(t)} />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[11px] text-muted-foreground">Escopo</span>
                      <select className={inputCls} value={t.scope} onChange={(e) => { updateTier(t.id, { scope: e.target.value as any }); void saveTier({ ...t, scope: e.target.value as any }); }}>
                        <option value="individual">Individual</option>
                        <option value="group">Grupo</option>
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-[11px] text-muted-foreground">Prêmio</span>
                      <select className={inputCls} value={t.reward_type} onChange={(e) => { updateTier(t.id, { reward_type: e.target.value as any }); void saveTier({ ...t, reward_type: e.target.value as any }); }}>
                        <option value="spin">Giro grátis</option>
                        <option value="box">Caixa (Luckybox)</option>
                        <option value="coin">Coins</option>
                        <option value="cash">R$ (dinheiro)</option>
                      </select>
                    </label>
                    {t.reward_type === 'box' && (
                      <label className="space-y-1">
                        <span className="text-[11px] text-muted-foreground">Qual caixa</span>
                        <select className={inputCls} value={t.reward_case_id || ''} onChange={(e) => { updateTier(t.id, { reward_case_id: e.target.value || null }); void saveTier({ ...t, reward_case_id: e.target.value || null }); }}>
                          <option value="">Selecione...</option>
                          {luckyboxCases.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </label>
                    )}
                    <label className="space-y-1">
                      <span className="text-[11px] text-muted-foreground">{t.reward_type === 'cash' ? 'Valor R$' : 'Quantidade'}</span>
                      <input type="number" onFocus={(e) => e.target.select()} min={0} step="0.01" className={inputCls} value={t.reward_amount}
                        onChange={(e) => updateTier(t.id, { reward_amount: Number(e.target.value) || 0 })}
                        onBlur={() => saveTier(t)} />
                    </label>
                    <div className="flex gap-2">
                      <input placeholder="Rótulo (opcional)" className={inputCls} value={t.reward_label}
                        onChange={(e) => updateTier(t.id, { reward_label: e.target.value })}
                        onBlur={() => saveTier(t)} />
                      <button onClick={() => removeTier(t.id)} className="shrink-0 text-muted-foreground hover:text-destructive"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button onClick={saveEvent} disabled={saving} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">
                  Salvar
                </button>
                {draft.status !== 'active' && (
                  <button onClick={activateWebhook} disabled={saving || !draft.group_jid} className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
                    Salvar e ativar monitoramento
                  </button>
                )}
                {draft.status === 'active' && (
                  <button onClick={async () => { await db.from('whatsapp_activity_events').update({ status: 'finished' }).eq('id', draft.id); void loadEvents(); setDraft((d) => d ? { ...d, status: 'finished' } : d); }}
                    className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold">
                    Encerrar monitoramento
                  </button>
                )}
                <button onClick={deleteEvent} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive">
                  <Trash2 size={15} /> Excluir
                </button>
              </div>
            </div>
          )}

          {tab === 'progresso' && (
            <div className="space-y-2">
              {progress.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma atividade registrada ainda.</p>}
              {progress.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <div>
                    <span className="font-semibold">{p.scope === 'group' ? 'Meta do grupo' : (p.sender_name || p.sender_phone)}</span>
                    {p.scope === 'individual' && <span className="text-xs text-muted-foreground ml-2">{p.sender_phone}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground">{p.message_count} msgs</span>
                    {p.scope === 'individual' && (
                      <button onClick={() => void viewMessages(p.sender_phone)} className="text-muted-foreground hover:text-foreground" title="Ver mensagens">
                        <MessageCircle size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'desbloqueios' && (
            <div className="space-y-2">
              {unlocks.length === 0 && <p className="text-sm text-muted-foreground">Nenhum prêmio desbloqueado ainda.</p>}
              {unlocks.map((u) => (
                <div key={u.id} className="rounded-lg border border-border px-3 py-2 text-sm space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{u.scope === 'group' ? 'Meta do grupo' : (u.sender_name || u.sender_phone)}</span>
                    <span className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs">{REWARD_LABEL[u.reward_type] || u.reward_type} · {u.reward_amount}</span>
                    <span className="text-xs font-semibold">{UNLOCK_STATUS_LABEL[u.status] || u.status}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {u.scope === 'individual' && (
                      <button onClick={() => void viewMessages(u.sender_phone)} className="text-xs text-muted-foreground hover:text-foreground underline">
                        Ver histórico de mensagens
                      </button>
                    )}
                    {u.status === 'pending_manual' && (
                      <>
                        <button onClick={() => void markUnlockManual(u.id, 'granted')} className="text-xs text-green-500 underline">Marcar liberado</button>
                        <button onClick={() => void markUnlockManual(u.id, 'rejected')} className="text-xs text-destructive underline">Rejeitar</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {messagesFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setMessagesFor(null)}>
          <div className="max-w-lg w-full max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-background p-4 space-y-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Mensagens de {messagesFor}</h3>
              <button onClick={() => setMessagesFor(null)} className="text-muted-foreground hover:text-foreground text-sm">Fechar</button>
            </div>
            {messages.length === 0 && <p className="text-sm text-muted-foreground">Sem mensagens registradas.</p>}
            {messages.map((m) => (
              <div key={m.id} className="text-sm border-b border-border/50 pb-1.5">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{m.message_type}</span>
                  <span>{new Date(m.created_at).toLocaleString('pt-BR')}</span>
                </div>
                <p>{m.text_content || <span className="text-muted-foreground italic">(sem texto)</span>}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
