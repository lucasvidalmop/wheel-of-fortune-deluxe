import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Save, Loader2, Copy, Check, X, Edit2, Play, Ban, Trophy, Download, BarChart3, TrendingUp, TrendingDown, Users, Coins, ArrowUp, ArrowDown, Share2 } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { uploadAppAsset } from '@/lib/uploadAppAsset';
import { betIsoToDateTimeLocal, dateTimeLocalToBetIso, formatBetDateTime } from '@/lib/betsDateTime';
import { confirmDialog, promptDialog } from '@/components/ui/imperative-dialog';
import BolaoAdminPanel from '@/components/casino/BolaoAdminPanel';
import ShareEvent, { type ShareEventData } from '@/components/casino/ShareEvent';

interface BetsPanelProps { ownerId: string }

interface BetsConfig {
  id: string; owner_id: string; tag: string; is_active: boolean;
  page_config: any; coin_name: string; coin_icon_url: string;
}
interface BetEvent {
  id: string; bets_config_id: string; title: string; subtitle: string; category: string;
  category_id: string | null;
  image_url: string; starts_at: string | null; closes_at: string | null;
  home_image_url?: string | null; away_image_url?: string | null;
  status: 'scheduled'|'open'|'closed'|'resolved'|'cancelled';
  payout_mode: 'coins'|'case'; payout_case_id: string | null; payout_case_qty_per_unit: number;
  min_bet: number; max_bet: number; max_bets_per_user: number; position: number; winning_outcome_id: string | null;
  is_hot?: boolean;
  external_fixture_id?: string | null;
}
interface BetOutcome { id: string; event_id: string; market_id: string | null; owner_id: string; label: string; odd: number; position: number; is_winner: boolean }
interface BetMarket {
  id: string; event_id: string; owner_id: string; title: string; position: number;
  status: 'open'|'closed'|'resolved'|'cancelled';
  closes_at: string | null; winning_outcome_id: string | null; resolved_at: string | null;
  min_bet: number; max_bet: number; max_bets_per_user: number;
  payout_mode: 'coins'|'case'; payout_case_id: string | null; payout_case_qty_per_unit: number;
}
interface BetCategory { id: string; bets_config_id: string; name: string; color: string; icon: string; position: number; background_url?: string }
interface LbCase { id: string; name: string; image_url: string }

type EditingMarket = {
  id?: string; title: string; position: number;
  status: 'open'|'closed'|'resolved'|'cancelled';
  closes_at: string | null;
  min_bet: number; max_bet: number; max_bets_per_user: number;
  payout_mode: 'coins'|'case'; payout_case_id: string | null; payout_case_qty_per_unit: number;
  outcomes: Array<{ id?: string; label: string; odd: number }>;
};

const BetsPanel = ({ ownerId }: BetsPanelProps) => {
  const [tab, setTab] = useState<'config'|'events'|'categories'|'wagers'|'analytics'|'bolao'>('config');
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<BetsConfig | null>(null);
  const [events, setEvents] = useState<BetEvent[]>([]);
  const [outcomes, setOutcomes] = useState<BetOutcome[]>([]);
  const [markets, setMarkets] = useState<BetMarket[]>([]);
  const [categories, setCategories] = useState<BetCategory[]>([]);
  const [cases, setCases] = useState<LbCase[]>([]);
  const [wagers, setWagers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // event modal state
  const [editingEvent, setEditingEvent] = useState<Partial<BetEvent> | null>(null);
  const [editingMarkets, setEditingMarkets] = useState<EditingMarket[]>([]);
  const [resolvingEvent, setResolvingEvent] = useState<BetEvent | null>(null);
  const [importerOpen, setImporterOpen] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [{ data: cfg }, { data: cs }] = await Promise.all([
        supabase.from('bets_configs').select('id,owner_id,tag,is_active,coin_name,coin_icon_url,page_config').eq('owner_id', ownerId).maybeSingle(),
        supabase.from('luckybox_cases').select('id, name, image_url').eq('owner_id', ownerId).order('position'),
      ]);
      setConfig(cfg as any);
      setCases((cs || []) as LbCase[]);
      if (cfg?.id) {
        // Limit events to most recent 500 — historical events accumulate over time.
        const { data: evs } = await supabase
          .from('bet_events')
          .select('*')
          .eq('bets_config_id', cfg.id)
          .order('created_at', { ascending: false })
          .limit(500);
        const eventList = (evs || []) as BetEvent[];
        const eventIds = eventList.map(e => e.id);

        // Scope outcomes/markets to loaded events. Chunk + raise limit to bypass
        // PostgREST's default 1000-row cap (football fixtures have ~60 outcomes each).
        const chunk = <T,>(arr: T[], size: number) => {
          const out: T[][] = [];
          for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
          return out;
        };
        const eventChunks = eventIds.length ? chunk(eventIds, 50) : [];
        const [outsArrays, mksArrays, { data: catz }] = await Promise.all([
          Promise.all(eventChunks.map(ids =>
            supabase.from('bet_outcomes').select('*').in('event_id', ids).order('position').limit(50000)
          )),
          Promise.all(eventChunks.map(ids =>
            supabase.from('bet_markets').select('*').in('event_id', ids).order('position').limit(10000)
          )),
          supabase.from('bet_categories').select('*').eq('bets_config_id', cfg.id).order('position'),
        ]);
        const outs = outsArrays.flatMap(r => (r.data || []) as any[]);
        const mks = mksArrays.flatMap(r => (r.data || []) as any[]);
        setEvents(eventList);
        setOutcomes(outs as BetOutcome[]);
        setMarkets(mks as BetMarket[]);
        setCategories((catz || []) as BetCategory[]);
      }
    } catch (e: any) {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => { loadAll(); }, [ownerId]);

  const createConfig = async () => {
    const tag = (await promptDialog({
      title: 'Criar página de apostas',
      description: 'Defina uma tag pública para acessar sua página.',
      placeholder: 'ex.: apostas-1',
    }))?.trim();
    if (!tag) return;
    if (!/^[a-z0-9-]+$/i.test(tag)) { toast.error('Use apenas letras, números e -'); return; }
    setSaving(true);
    const { data, error } = await supabase.from('bets_configs').insert({
      owner_id: ownerId, tag, is_active: true,
      page_config: { title: 'Apostas', subtitle: 'Aposte e ganhe', bgColor: '#0b0b14', accentColor: '#22d3ee', cardBg: '#141425', textColor: '#ffffff', mutedColor: '#a0a0c0' },
      coin_name: 'Coins',
    }).select().single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setConfig(data as any);
    toast.success('Página criada!');
  };

  const saveConfig = async () => {
    if (!config) return;
    setSaving(true);
    const { error } = await supabase.from('bets_configs').update({
      tag: config.tag, is_active: config.is_active, page_config: config.page_config,
      coin_name: config.coin_name, coin_icon_url: config.coin_icon_url,
    }).eq('id', config.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Salvo');
  };

  const publicUrl = config ? `${window.location.origin}/odds=${config.tag}` : '';
  const copyUrl = async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const defaultMarketDefaults = (): Omit<EditingMarket, 'title'|'position'|'outcomes'> => ({
    status: 'open', closes_at: null,
    min_bet: 1, max_bet: 0, max_bets_per_user: 0,
    payout_mode: 'coins', payout_case_id: null, payout_case_qty_per_unit: 1,
  });

  const openNewEvent = () => {
    setEditingEvent({
      title: '', subtitle: '', category: '', category_id: null, image_url: '',
      starts_at: null, closes_at: null, status: 'open',
      payout_mode: 'coins', payout_case_id: null, payout_case_qty_per_unit: 1,
      min_bet: 10, max_bet: 0, max_bets_per_user: 1, is_hot: false,
    });
    setEditingMarkets([{
      title: 'Principal', position: 0, ...defaultMarketDefaults(),
      outcomes: [{ label: 'Casa', odd: 1.8 }, { label: 'Empate', odd: 3.2 }, { label: 'Visitante', odd: 4.0 }],
    }]);
  };

  const openEditEvent = (ev: BetEvent) => {
    setEditingEvent({ ...ev });
    const evMarkets = markets.filter(m => m.event_id === ev.id).sort((a, b) => a.position - b.position);
    const evOuts = outcomes.filter(o => o.event_id === ev.id).sort((a, b) => a.position - b.position);
    if (evMarkets.length === 0) {
      setEditingMarkets([{
        title: 'Principal', position: 0, ...defaultMarketDefaults(),
        outcomes: evOuts.map(o => ({ id: o.id, label: o.label, odd: Number(o.odd) })),
      }]);
    } else {
      setEditingMarkets(evMarkets.map((m, idx) => ({
        id: m.id, title: m.title, position: idx,
        status: m.status, closes_at: m.closes_at,
        min_bet: m.min_bet ?? 1, max_bet: m.max_bet ?? 0, max_bets_per_user: m.max_bets_per_user ?? 0,
        payout_mode: (m as any).payout_mode || 'coins',
        payout_case_id: (m as any).payout_case_id || null,
        payout_case_qty_per_unit: (m as any).payout_case_qty_per_unit ?? 1,
        outcomes: evOuts.filter(o => o.market_id === m.id).map(o => ({ id: o.id, label: o.label, odd: Number(o.odd) })),
      })));
    }
  };

  const saveEvent = async () => {
    if (!config || !editingEvent) return;
    if (!editingEvent.title?.trim()) { toast.error('Título obrigatório'); return; }
    if (editingMarkets.length === 0) { toast.error('Adicione ao menos 1 mercado'); return; }
    for (const m of editingMarkets) {
      if (!m.title.trim()) { toast.error('Cada mercado precisa de um título'); return; }
      // Allow 0 outcomes (API will populate later). If any outcomes are present, require ≥2 and valid.
      if (m.outcomes.length > 0 && m.outcomes.length < 2) { toast.error(`Mercado "${m.title}" precisa de no mínimo 2 resultados (ou deixe vazio para a API preencher)`); return; }
      if (m.outcomes.length > 0 && m.outcomes.some(o => !o.label.trim() || !(o.odd > 1))) {
        toast.error(`Mercado "${m.title}": cada resultado precisa de label e odd > 1`); return;
      }
    }
    setSaving(true);
    try {
      let eventId = (editingEvent as BetEvent).id;
      const catObj = editingEvent.category_id ? categories.find(c => c.id === editingEvent.category_id) : null;
      const startsAtIso = editingEvent.starts_at || null;
      let status = editingEvent.status || 'open';
      if (startsAtIso && new Date(startsAtIso).getTime() > Date.now() && status === 'open') {
        status = 'scheduled' as any;
      }
      const payload = {
        owner_id: ownerId,
        bets_config_id: config.id,
        title: editingEvent.title.trim(),
        subtitle: editingEvent.subtitle?.trim() || '',
        category: catObj?.name || editingEvent.category?.trim() || '',
        category_id: editingEvent.category_id || null,
        image_url: editingEvent.image_url || '',
        starts_at: startsAtIso,
        closes_at: editingEvent.closes_at || null,
        status,
        payout_mode: editingEvent.payout_mode || 'coins',
        payout_case_id: editingEvent.payout_mode === 'case' ? (editingEvent.payout_case_id || null) : null,
        payout_case_qty_per_unit: editingEvent.payout_case_qty_per_unit ?? 1,
        min_bet: editingEvent.min_bet ?? 1,
        max_bet: editingEvent.max_bet ?? 0,
        max_bets_per_user: editingEvent.max_bets_per_user ?? 0,
        position: editingEvent.position ?? 0,
        is_hot: !!editingEvent.is_hot,
        external_fixture_id: (editingEvent as any).external_fixture_id || null,
        home_image_url: (editingEvent as any).home_image_url || null,
        away_image_url: (editingEvent as any).away_image_url || null,
      };
      if (eventId) {
        const { error } = await supabase.from('bet_events').update(payload).eq('id', eventId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('bet_events').insert(payload).select().single();
        if (error) throw error;
        eventId = (data as any).id;
      }

      // Sync markets
      const existingMarkets = markets.filter(m => m.event_id === eventId);
      const keepMarketIds = editingMarkets.filter(m => m.id).map(m => m.id);
      const marketsToDelete = existingMarkets.filter(m => !keepMarketIds.includes(m.id));
      if (marketsToDelete.length) {
        // outcomes are cascade-deleted via FK? Safer: delete outcomes first
        await supabase.from('bet_outcomes').delete().in('market_id', marketsToDelete.map(m => m.id));
        await supabase.from('bet_markets').delete().in('id', marketsToDelete.map(m => m.id));
      }

      for (let mi = 0; mi < editingMarkets.length; mi++) {
        const em = editingMarkets[mi];
        let marketId = em.id;
        const marketPayload = {
          title: em.title.trim(), position: mi,
          status: em.status || 'open',
          closes_at: em.closes_at || null,
          min_bet: em.min_bet ?? 1,
          max_bet: em.max_bet ?? 0,
          max_bets_per_user: em.max_bets_per_user ?? 0,
          payout_mode: em.payout_mode || 'coins',
          payout_case_id: em.payout_mode === 'case' ? (em.payout_case_id || null) : null,
          payout_case_qty_per_unit: em.payout_case_qty_per_unit ?? 1,
        };
        if (marketId) {
          const { error } = await supabase.from('bet_markets').update(marketPayload).eq('id', marketId);
          if (error) throw error;
        } else {
          const { data, error } = await supabase.from('bet_markets').insert({
            event_id: eventId, owner_id: ownerId, ...marketPayload,
          }).select().single();
          if (error) throw error;
          marketId = (data as any).id;
        }

        // Sync outcomes for this market
        const existingOuts = outcomes.filter(o => o.market_id === marketId);
        const keepOutIds = em.outcomes.filter(o => o.id).map(o => o.id);
        const outsToDelete = existingOuts.filter(o => !keepOutIds.includes(o.id));
        if (outsToDelete.length) {
          await supabase.from('bet_outcomes').delete().in('id', outsToDelete.map(o => o.id));
        }
        for (let oi = 0; oi < em.outcomes.length; oi++) {
          const o = em.outcomes[oi];
          if (o.id) {
            await supabase.from('bet_outcomes').update({ label: o.label, odd: o.odd, position: oi, market_id: marketId }).eq('id', o.id);
          } else {
            await supabase.from('bet_outcomes').insert({
              event_id: eventId, market_id: marketId, owner_id: ownerId,
              label: o.label, odd: o.odd, position: oi,
            });
          }
        }
      }

      toast.success('Evento salvo!');
      setEditingEvent(null);
      setEditingMarkets([]);
      loadAll();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = async (ev: BetEvent) => {
    const ok = await confirmDialog({
      title: 'Excluir evento?',
      description: `O evento "${ev.title}" será removido. Apostas associadas também serão excluídas.`,
      confirmText: 'Excluir',
      destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase.from('bet_events').delete().eq('id', ev.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Evento removido');
    loadAll();
  };

  const setEventStatus = async (ev: BetEvent, status: BetEvent['status']) => {
    const { error } = await supabase.from('bet_events').update({ status }).eq('id', ev.id);
    if (error) { toast.error(error.message); return; }
    loadAll();
  };

  const sortedEvents = React.useMemo(
    () => [...events].sort((a, b) =>
      ((a.position ?? 0) - (b.position ?? 0)) ||
      String((b as any).created_at || '').localeCompare(String((a as any).created_at || ''))
    ),
    [events],
  );
  const [eventsSourceFilter, setEventsSourceFilter] = useState<'all' | 'manual' | 'api'>('all');
  const [eventsSearch, setEventsSearch] = useState('');


  const filteredEvents = React.useMemo(() => {
    const q = eventsSearch.trim().toLowerCase();
    return sortedEvents.filter((ev: any) => {
      if (eventsSourceFilter === 'api' && !ev.external_fixture_id) return false;
      if (eventsSourceFilter === 'manual' && ev.external_fixture_id) return false;
      if (!q) return true;
      const hay = [
        ev.title, ev.subtitle, ev.category,
        ev.competition_name, ev.competition_country,
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [sortedEvents, eventsSourceFilter, eventsSearch]);

  const moveHotEvent = async (eventId: string, dir: -1 | 1) => {
    const hots = sortedEvents.filter(e => e.is_hot);
    const idx = hots.findIndex(e => e.id === eventId);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= hots.length) return;
    const a = hots[idx];
    const b = hots[j];
    const posA = a.position ?? 0;
    const posB = b.position ?? 0;
    // Optimistic UI: swap positions between the two hot events
    setEvents(prev => prev.map(e => {
      if (e.id === a.id) return { ...e, position: posB };
      if (e.id === b.id) return { ...e, position: posA };
      return e;
    }));
    const results = await Promise.all([
      supabase.from('bet_events').update({ position: posB }).eq('id', a.id),
      supabase.from('bet_events').update({ position: posA }).eq('id', b.id),
    ]);
    const err = results.find(r => r.error);
    if (err?.error) { toast.error(err.error.message); loadAll(); }
  };

  const resolveEvent = async (winningOutcomeId: string) => {
    if (!resolvingEvent) return;
    setSaving(true);
    const eventId = resolvingEvent.id;
    const { data, error } = await supabase.rpc('resolve_bet_event', {
      p_event_id: eventId, p_winning_outcome_id: winningOutcomeId,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    if ((data as any)?.success) {
      toast.success(`Resolvido: ${(data as any).processed} apostas processadas`);
      setResolvingEvent(null);
      supabase.functions.invoke('notify-event-resolved', { body: { event_id: eventId } })
        .catch((e) => console.error('notify-event-resolved failed', e));
      loadAll();
    } else {
      toast.error(`Falha: ${(data as any)?.error || 'erro'}`);
    }
  };

  const resolveMarket = async (marketId: string, winningOutcomeId: string) => {
    setSaving(true);
    const { data, error } = await supabase.rpc('resolve_bet_market', {
      p_market_id: marketId, p_winning_outcome_id: winningOutcomeId,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    if ((data as any)?.success) {
      toast.success(`Mercado resolvido: ${(data as any).processed} apostas processadas`);
      supabase.functions.invoke('notify-event-resolved', { body: { market_id: marketId } })
        .catch((e) => console.error('notify-event-resolved failed', e));
      loadAll();
    } else {
      toast.error(`Falha: ${(data as any)?.error || 'erro'}`);
    }
  };

  const cancelMarket = async (marketId: string, title: string) => {
    const ok = await confirmDialog({
      title: 'Cancelar mercado?',
      description: `O mercado "${title}" será cancelado e as apostas pendentes devolvidas.`,
      confirmText: 'Cancelar mercado', cancelText: 'Voltar', destructive: true,
    });
    if (!ok) return;
    setSaving(true);
    const { data, error } = await supabase.rpc('cancel_bet_market', { p_market_id: marketId });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    if ((data as any)?.success) {
      toast.success(`Cancelado. ${(data as any).refunded} apostas devolvidas`);
      loadAll();
    } else {
      toast.error(`Falha: ${(data as any)?.error || 'erro'}`);
    }
  };


  const cancelEvent = async (ev: BetEvent) => {
    const ok = await confirmDialog({
      title: 'Cancelar evento?',
      description: `O evento "${ev.title}" será cancelado e todas as apostas pendentes serão devolvidas.`,
      confirmText: 'Cancelar evento',
      cancelText: 'Voltar',
      destructive: true,
    });
    if (!ok) return;
    setSaving(true);
    const { data, error } = await supabase.rpc('cancel_bet_event', { p_event_id: ev.id });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    if ((data as any)?.success) {
      toast.success(`Cancelado. ${(data as any).refunded} apostas devolvidas`);
      loadAll();
    } else {
      toast.error(`Falha: ${(data as any)?.error || 'erro'}`);
    }
  };

  // ------- Categories CRUD -------
  const addCategory = async () => {
    if (!config) return;
    const name = (await promptDialog({
      title: 'Nova categoria',
      description: 'Dê um nome para a categoria de eventos.',
      placeholder: 'ex.: Futebol, eSports',
      confirmText: 'Criar',
    }))?.trim();
    if (!name) return;
    const { error } = await supabase.from('bet_categories').insert({
      owner_id: ownerId, bets_config_id: config.id, name,
      color: '#22d3ee', icon: '', position: categories.length,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Categoria criada');
    loadAll();
  };
  const updateCategory = async (id: string, patch: Partial<BetCategory>) => {
    setCategories(arr => arr.map(c => c.id === id ? { ...c, ...patch } : c));
    const { error } = await supabase.from('bet_categories').update(patch).eq('id', id);
    if (error) toast.error(error.message);
  };
  const deleteCategory = async (c: BetCategory) => {
    const ok = await confirmDialog({
      title: 'Excluir categoria?',
      description: `A categoria "${c.name}" será removida. Eventos vinculados ficarão sem categoria.`,
      confirmText: 'Excluir',
      destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase.from('bet_categories').delete().eq('id', c.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Removida');
    loadAll();
  };

  const loadWagers = async () => {
    if (!config) return;
    const { data } = await supabase
      .from('bet_wagers')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(500);
    const list = data || [];
    setWagers(list);

    // Backfill events/outcomes/markets referenced by wagers but missing from
    // the initial scope (events list is capped at 500 newest; outcomes may have
    // been re-synced for football fixtures). Without this, the "Apostas deste
    // usuário" detail row renders "—" for the selection label.
    const missingEventIds = Array.from(new Set(
      list.map((w: any) => w.event_id).filter((id: string) => id && !events.some(e => e.id === id))
    )) as string[];
    const missingOutcomeIds = Array.from(new Set(
      list.map((w: any) => w.outcome_id).filter((id: string) => id && !outcomes.some(o => o.id === id))
    )) as string[];
    const missingMarketIds = Array.from(new Set(
      list.map((w: any) => w.market_id).filter((id: string) => id && !markets.some(m => m.id === id))
    )) as string[];

    const [evRes, outRes, mkRes] = await Promise.all([
      missingEventIds.length
        ? supabase.from('bet_events').select('*').in('id', missingEventIds)
        : Promise.resolve({ data: [] as any[] }),
      missingOutcomeIds.length
        ? supabase.from('bet_outcomes').select('*').in('id', missingOutcomeIds)
        : Promise.resolve({ data: [] as any[] }),
      missingMarketIds.length
        ? supabase.from('bet_markets').select('*').in('id', missingMarketIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    if (evRes.data?.length) setEvents(prev => [...prev, ...(evRes.data as BetEvent[]).filter(e => !prev.some(p => p.id === e.id))]);
    if (outRes.data?.length) setOutcomes(prev => [...prev, ...(outRes.data as BetOutcome[]).filter(o => !prev.some(p => p.id === o.id))]);
    if (mkRes.data?.length) setMarkets(prev => [...prev, ...(mkRes.data as BetMarket[]).filter(m => !prev.some(p => p.id === m.id))]);
  };

  useEffect(() => { if (tab === 'wagers' || tab === 'analytics') loadWagers(); }, [tab, config?.id]);

  // Analytics filters
  const [aFilter, setAFilter] = useState<{ eventId: string; status: string; days: number }>({ eventId: '', status: '', days: 30 });
  const [wFilter, setWFilter] = useState<{ eventId: string; marketId: string; status: string }>({ eventId: '', marketId: '', status: '' });
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});
  const [sharingEvent, setSharingEvent] = useState<ShareEventData | null>(null);

  const openShareEvent = (ev: BetEvent) => {
    const evMarkets = markets.filter(m => m.event_id === ev.id).sort((a, b) => a.position - b.position);
    const evOuts = outcomes.filter(o => o.event_id === ev.id).sort((a, b) => a.position - b.position);
    const cat = ev.category_id ? categories.find(x => x.id === ev.category_id) : null;
    const splitEventTeams = (title: string): [string, string] | null => {
      const m = title.match(/^(.+?)\s+(?:vs\.?|x|×|-|–)\s+(.+)$/i);
      return m ? [m[1].trim(), m[2].trim()] : null;
    };
    const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const [homeName, awayName] = splitEventTeams(ev.title) || ['', ''];
    const outcomeSlot = (label: string): 'home' | 'draw' | 'away' | null => {
      const low = norm(label).replace(/\s+/g, ' ');
      const home = norm(homeName);
      const away = norm(awayName);
      if (['home', 'casa', '1'].includes(low) || (home && (low === home || low === `${home} vence`))) return 'home';
      if (['draw', 'tie', 'empate', 'x'].includes(low)) return 'draw';
      if (['away', 'fora', 'visitante', '2'].includes(low) || (away && (low === away || low === `${away} vence`))) return 'away';
      return null;
    };
    const marketPriority = (title: string) => /match winner|vencedor|resultado final|full time result|\b1x2\b/i.test(title) ? 0 : 1;
    const toShareOutcomes = (outs: BetOutcome[]) => {
      const picked: Partial<Record<'home' | 'draw' | 'away', BetOutcome>> = {};
      outs.forEach(o => {
        const slot = outcomeSlot(o.label);
        if (slot && !picked[slot] && Number(o.odd) > 1) picked[slot] = o;
      });
      if (picked.home && picked.draw && picked.away) {
        return [picked.home, picked.draw, picked.away].map(o => ({ label: o.label, odd: Number(o.odd) }));
      }
      return outs.filter(o => Number(o.odd) > 1).slice(0, 3).map(o => ({ label: o.label, odd: Number(o.odd) }));
    };
    const marketSources: Array<{ id: string | null; title: string; position: number }> = evMarkets.length
      ? evMarkets.map(m => ({ id: m.id, title: m.title, position: m.position }))
      : [{ id: null, title: 'Resultado Final', position: 0 }];
    const candidates = marketSources
      .map(m => {
        const marketOuts = evOuts.filter(o => (m.id ? o.market_id === m.id : true));
        return { market: m, outcomes: toShareOutcomes(marketOuts), canonicalCount: marketOuts.filter(o => outcomeSlot(o.label)).length };
      })
      .filter(c => c.outcomes.length > 0)
      .sort((a, b) =>
        (b.outcomes.length >= 3 ? 1 : 0) - (a.outcomes.length >= 3 ? 1 : 0) ||
        (b.canonicalCount >= 3 ? 1 : 0) - (a.canonicalCount >= 3 ? 1 : 0) ||
        marketPriority(a.market.title || '') - marketPriority(b.market.title || '') ||
        (a.market.position ?? 0) - (b.market.position ?? 0)
      );
    const shareMarkets = candidates.length ? [{ title: candidates[0].market.title || 'Resultado Final', outcomes: candidates[0].outcomes }] : [];
    const tag = config?.tag || '';
    const copyUrl = tag ? `${window.location.origin}/odds=${tag}#ev=${ev.id}` : '';
    setSharingEvent({
      eventTitle: ev.title,
      subtitle: ev.subtitle || undefined,
      category: cat?.name || ev.category || undefined,
      startsAt: ev.starts_at,
      closesAt: ev.closes_at,
      isHot: !!ev.is_hot,
      markets: shareMarkets,
      copyUrl,
      homeImageUrl: ev.home_image_url || undefined,
      awayImageUrl: ev.away_image_url || undefined,
      eventImageUrl: ev.image_url || undefined,
    });
  };

  if (loading) {
    return <div className="p-8 flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }

  if (!config) {
    return (
      <div className="max-w-xl p-6 rounded-2xl bg-card border border-border">
        <h3 className="text-lg font-bold mb-2">Página de Apostas</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Crie sua página pública de apostas com odds. Você definirá uma tag única (ex.: <code>apostas-1</code>) e a URL será <code>{window.location.origin}/odds=&lt;sua-tag&gt;</code>.
        </p>
        <button onClick={createConfig} disabled={saving}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium flex items-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} Criar página
        </button>
      </div>
    );
  }

  const cfg = config.page_config || {};
  const setCfgField = (k: string, v: any) => setConfig(c => c ? { ...c, page_config: { ...c.page_config, [k]: v } } : c);

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-border overflow-x-auto [touch-action:pan-x] -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
        {([
          ['config', 'Configuração'],
          ['events', `Eventos (${events.length})`],
          ['categories', `Categorias (${categories.length})`],
          ['wagers', 'Apostas'],
          ['analytics', 'Analytics'],
          ['bolao', 'Bolão da Copa'],
        ] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as any)}
            className={`shrink-0 px-4 py-2 text-sm font-medium border-b-2 transition whitespace-nowrap ${tab === k ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'bolao' && <BolaoAdminPanel ownerId={ownerId} />}

      {tab === 'config' && (
        <div className="space-y-4 max-w-2xl">
          <div className="p-4 rounded-xl bg-card border border-border space-y-3">
            <h3 className="font-bold">URL pública</h3>
            <div className="flex items-center gap-2">
              <input value={publicUrl} readOnly className="flex-1 px-3 py-2 rounded-lg bg-muted text-sm" />
              <button onClick={copyUrl} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground flex items-center gap-1.5 text-sm font-medium">
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={config.is_active} onChange={e => setConfig({ ...config, is_active: e.target.checked })} />
              Página ativa
            </label>
            <div>
              <label className="text-sm font-medium block mb-1">Tag</label>
              <input value={config.tag} onChange={e => setConfig({ ...config, tag: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-muted" />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border space-y-3">
            <h3 className="font-bold">Visual</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Título" value={cfg.title || ''} onChange={v => setCfgField('title', v)} />
              <Field label="Subtítulo" value={cfg.subtitle || ''} onChange={v => setCfgField('subtitle', v)} />
              <ImageUploadField label="Logo" hint="200×60 px PNG" value={cfg.logoUrl || ''} onChange={v => setCfgField('logoUrl', v)}
                upload={async f => { const r = await uploadAppAsset(f, 'bets-logo'); setCfgField('logoUrl', r.publicUrl); }} />
              <ColorField label="Fundo" value={cfg.bgColor || '#0b0b14'} onChange={v => setCfgField('bgColor', v)} />
              <ColorField label="Card" value={cfg.cardBg || '#141425'} onChange={v => setCfgField('cardBg', v)} />
              <ColorField label="Destaque (odd)" value={cfg.accentColor || '#22d3ee'} onChange={v => setCfgField('accentColor', v)} />
              <ColorField label="Texto" value={cfg.textColor || '#ffffff'} onChange={v => setCfgField('textColor', v)} />
              <ColorField label="Texto suave" value={cfg.mutedColor || '#a0a0c0'} onChange={v => setCfgField('mutedColor', v)} />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border space-y-3">
            <h3 className="font-bold">Moeda</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome da moeda" value={config.coin_name} onChange={v => setConfig({ ...config, coin_name: v })} />
              <ImageUploadField label="Ícone da moeda" hint="64×64 px PNG" value={config.coin_icon_url} onChange={v => setConfig({ ...config, coin_icon_url: v })}
                upload={async f => { const r = await uploadAppAsset(f, 'bets-coin'); setConfig(c => c ? { ...c, coin_icon_url: r.publicUrl } : c); }} />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border space-y-3">
            <h3 className="font-bold">Plano de fundo</h3>
            <div className="grid grid-cols-2 gap-3">
              <ImageUploadField label="Imagem de fundo" hint="1920×1080 px" value={cfg.bgImage || ''} onChange={v => setCfgField('bgImage', v)}
                upload={async f => { const r = await uploadAppAsset(f, 'bets-bg'); setCfgField('bgImage', r.publicUrl); }} />
              <div />
              <ColorField label="Gradiente (topo)" value={cfg.bgGradientFrom || '#1a1230'} onChange={v => setCfgField('bgGradientFrom', v)} />
              <ColorField label="Gradiente (base)" value={cfg.bgGradientTo || '#05040a'} onChange={v => setCfgField('bgGradientTo', v)} />
            </div>
            <p className="text-[11px] text-muted-foreground">Se a imagem estiver definida, ela tem prioridade. Senão, usa o gradiente (ou a cor sólida "Fundo" acima).</p>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border space-y-3">
            <h3 className="font-bold">Bolão da Copa</h3>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!cfg.hideBolao} onChange={e => setCfgField('hideBolao', e.target.checked)} />
              Esconder botão "Bolão da Copa" nesta página
            </label>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border space-y-3">
            <h3 className="font-bold">Tela de login</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Título do login" value={cfg.loginTitle || ''} onChange={v => setCfgField('loginTitle', v)} />
              <Field label="Texto do botão" value={cfg.loginBtnText || ''} onChange={v => setCfgField('loginBtnText', v)} />
              <Field label="Subtítulo do login" value={cfg.loginSubtitle || ''} onChange={v => setCfgField('loginSubtitle', v)} />
              <ColorField label="Cor do título" value={cfg.titleColor || '#ffffff'} onChange={v => setCfgField('titleColor', v)} />
              <ColorField label="Cor do subtítulo" value={cfg.subtitleColor || '#a0a0c0'} onChange={v => setCfgField('subtitleColor', v)} />
              <ColorField label="Cor do texto do botão" value={cfg.btnTextColor || '#000000'} onChange={v => setCfgField('btnTextColor', v)} />
            </div>
            <div className="pt-2 border-t border-border space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!cfg.hideSignup} onChange={e => setCfgField('hideSignup', e.target.checked)} />
                Ocultar link "Não tem conta?"
              </label>
              {!cfg.hideSignup && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label='Texto antes do link' value={cfg.signupText || ''} onChange={v => setCfgField('signupText', v)} />
                  <Field label='Texto do link' value={cfg.signupCtaText || ''} onChange={v => setCfgField('signupCtaText', v)} />
                  <div className="col-span-2">
                    <Field label='URL de cadastro (vazio = /gorjeta?ref=tag)' value={cfg.signupUrl || ''} onChange={v => setCfgField('signupUrl', v)} />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">Bilhetinho compartilhável</h3>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox"
                  checked={cfg.ticketEnabled !== false}
                  onChange={e => setCfgField('ticketEnabled', e.target.checked)} />
                Habilitar
              </label>
            </div>
            <p className="text-[11px] text-muted-foreground -mt-1">
              Cada apostador poderá baixar e compartilhar um "bilhetinho" estilizado com a aposta (ganho, perda ou pendente).
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome da marca" value={cfg.ticket?.brandName || ''}
                onChange={v => setCfgField('ticket', { ...(cfg.ticket || {}), brandName: v })} />
              <ImageUploadField label="Logo do bilhete" hint="200×60 px PNG" value={cfg.ticket?.logoUrl || ''}
                onChange={v => setCfgField('ticket', { ...(cfg.ticket || {}), logoUrl: v })}
                upload={async f => { const r = await uploadAppAsset(f, 'bets-ticket-logo'); setCfgField('ticket', { ...(cfg.ticket || {}), logoUrl: r.publicUrl }); }} />
              <Field label='Título — Ganhou' value={cfg.ticket?.titleWin || ''}
                onChange={v => setCfgField('ticket', { ...(cfg.ticket || {}), titleWin: v })} />
              <Field label='Título — Perdeu' value={cfg.ticket?.titleLoss || ''}
                onChange={v => setCfgField('ticket', { ...(cfg.ticket || {}), titleLoss: v })} />
              <Field label='Título — Pendente' value={cfg.ticket?.titlePending || ''}
                onChange={v => setCfgField('ticket', { ...(cfg.ticket || {}), titlePending: v })} />
              <Field label='Rodapé (chamada)' value={cfg.ticket?.footer || ''}
                onChange={v => setCfgField('ticket', { ...(cfg.ticket || {}), footer: v })} />
              <Field label='Texto do CTA' value={cfg.ticket?.ctaText || ''}
                onChange={v => setCfgField('ticket', { ...(cfg.ticket || {}), ctaText: v })} />
              <Field label='URL do CTA' value={cfg.ticket?.ctaUrl || ''}
                onChange={v => setCfgField('ticket', { ...(cfg.ticket || {}), ctaUrl: v })} />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
              <ColorField label="Fundo (topo)" value={cfg.ticket?.bgFrom || '#0b0b14'}
                onChange={v => setCfgField('ticket', { ...(cfg.ticket || {}), bgFrom: v })} />
              <ColorField label="Fundo (base)" value={cfg.ticket?.bgTo || '#1a1230'}
                onChange={v => setCfgField('ticket', { ...(cfg.ticket || {}), bgTo: v })} />
              <ColorField label="Destaque (pendente)" value={cfg.ticket?.accent || '#22d3ee'}
                onChange={v => setCfgField('ticket', { ...(cfg.ticket || {}), accent: v })} />
              <ColorField label="Destaque (ganhou)" value={cfg.ticket?.accentWin || '#22c55e'}
                onChange={v => setCfgField('ticket', { ...(cfg.ticket || {}), accentWin: v })} />
              <ColorField label="Destaque (perdeu)" value={cfg.ticket?.accentLoss || '#ef4444'}
                onChange={v => setCfgField('ticket', { ...(cfg.ticket || {}), accentLoss: v })} />
              <ColorField label="Texto" value={cfg.ticket?.textColor || '#ffffff'}
                onChange={v => setCfgField('ticket', { ...(cfg.ticket || {}), textColor: v })} />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border space-y-3">
            <h3 className="font-bold">SEO & Pixels</h3>
            <p className="text-[11px] text-muted-foreground -mt-1">Meta tags e pixels de rastreamento aplicados apenas na página de apostas.</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Título da aba" value={cfg.seo?.pageTitle || ''} onChange={v => setCfgField('seo', { ...(cfg.seo || {}), pageTitle: v })} />
              <Field label="Palavras-chave" value={cfg.seo?.keywords || ''} onChange={v => setCfgField('seo', { ...(cfg.seo || {}), keywords: v })} />
              <ImageUploadField label="Favicon" hint="32×32 .ico/.png" value={cfg.seo?.faviconUrl || ''}
                onChange={v => setCfgField('seo', { ...(cfg.seo || {}), faviconUrl: v })}
                upload={async f => { const r = await uploadAppAsset(f, 'favicon'); setCfgField('seo', { ...(cfg.seo || {}), faviconUrl: r.publicUrl }); }} />
              <ImageUploadField label="Imagem social (og:image)" hint="1200×630 px" value={cfg.seo?.ogImage || ''}
                onChange={v => setCfgField('seo', { ...(cfg.seo || {}), ogImage: v })}
                upload={async f => { const r = await uploadAppAsset(f, 'og-images'); setCfgField('seo', { ...(cfg.seo || {}), ogImage: r.publicUrl }); }} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Descrição (meta description)</label>
              <textarea rows={2} value={cfg.seo?.pageDescription || ''}
                onChange={e => setCfgField('seo', { ...(cfg.seo || {}), pageDescription: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-muted text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
              <Field label="Facebook Pixel ID" value={cfg.seo?.facebookPixelId || ''} onChange={v => setCfgField('seo', { ...(cfg.seo || {}), facebookPixelId: v })} />
              <Field label="Google Analytics (GA4)" value={cfg.seo?.googleAnalyticsId || ''} onChange={v => setCfgField('seo', { ...(cfg.seo || {}), googleAnalyticsId: v })} />
              <Field label="Google Tag Manager" value={cfg.seo?.gtmId || ''} onChange={v => setCfgField('seo', { ...(cfg.seo || {}), gtmId: v })} />
              <Field label="TikTok Pixel ID" value={cfg.seo?.tiktokPixelId || ''} onChange={v => setCfgField('seo', { ...(cfg.seo || {}), tiktokPixelId: v })} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Script personalizado (head)</label>
              <textarea rows={3} value={cfg.seo?.customHeadScript || ''}
                onChange={e => setCfgField('seo', { ...(cfg.seo || {}), customHeadScript: e.target.value })}
                placeholder="<!-- script personalizado -->"
                className="w-full px-3 py-2 rounded-lg bg-muted text-xs font-mono" />
            </div>
          </div>

          <button onClick={saveConfig} disabled={saving}
            className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium flex items-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Salvar
          </button>
        </div>
      )}

      {tab === 'events' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={openNewEvent}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium flex items-center gap-2">
              <Plus size={16} /> Novo evento
            </button>
            <button onClick={() => setImporterOpen(true)}
              className="px-4 py-2 bg-muted hover:bg-muted/70 rounded-lg font-medium flex items-center gap-2 border border-border">
              ⚽ Importador de Football
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-border overflow-hidden text-xs">
              {([['all', 'Todos'], ['manual', 'Manuais'], ['api', 'API']] as const).map(([k, label]) => {
                const active = eventsSourceFilter === k;
                const count = k === 'all'
                  ? events.length
                  : k === 'api'
                    ? events.filter((e: any) => e.external_fixture_id).length
                    : events.filter((e: any) => !e.external_fixture_id).length;
                return (
                  <button key={k} onClick={() => setEventsSourceFilter(k)}
                    className={`px-3 py-1.5 font-medium transition ${active ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/70'}`}>
                    {label} ({count})
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={eventsSearch}
              onChange={e => setEventsSearch(e.target.value)}
              placeholder="🔎 Pesquisar eventos..."
              className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg bg-muted text-sm border border-border focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {eventsSearch && (
              <button onClick={() => setEventsSearch('')} className="px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground">Limpar</button>
            )}
          </div>
          {events.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">Nenhum evento criado ainda.</p>}
          {events.length > 0 && filteredEvents.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">Nenhum evento encontrado com esses filtros.</p>}
          {filteredEvents.map((ev, evIndex) => {
            const evOuts = outcomes.filter(o => o.event_id === ev.id).sort((a, b) => a.position - b.position);
            const c = ev.payout_case_id ? cases.find(x => x.id === ev.payout_case_id) : null;
            const cat = ev.category_id ? categories.find(x => x.id === ev.category_id) : null;
            const catLabel = cat?.name || ev.category;
            const catColor = cat?.color || 'hsl(var(--primary))';
            const statusLabels: Record<string,string> = { scheduled: 'Agendado', open: 'Aberto', closed: 'Fechado', resolved: 'Resolvido', cancelled: 'Cancelado' };
            return (
              <div key={ev.id} className="p-4 rounded-xl bg-card border border-border">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    {catLabel && <div className="text-xs uppercase mb-0.5 flex items-center gap-1" style={{ color: catColor }}>{cat?.icon && <span>{cat.icon}</span>}{catLabel}</div>}
                    <div className="font-bold">{ev.title}</div>
                    {ev.subtitle && <div className="text-sm text-muted-foreground">{ev.subtitle}</div>}
                    <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <span className="px-2 py-0.5 rounded-full bg-muted">{statusLabels[ev.status] || ev.status}</span>
                      {ev.is_hot && <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-500 font-semibold">🔥 Quente</span>}
                      <span>{ev.payout_mode === 'case' ? `Caixa: ${c?.name || '?'} (${ev.payout_case_qty_per_unit}×)` : `Coins × odd`}</span>
                      {ev.starts_at && ev.status === 'scheduled' && <span>Abre: {formatBetDateTime(ev.starts_at)}</span>}
                      {ev.closes_at && <span>Encerra: {formatBetDateTime(ev.closes_at)}</span>}
                      <span>Min: {ev.min_bet}{ev.max_bet > 0 ? ` · Max: ${ev.max_bet}` : ''}{ev.max_bets_per_user > 0 ? ` · ${ev.max_bets_per_user}/usuário` : ''}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {ev.is_hot && (() => {
                      const hots = sortedEvents.filter(e => e.is_hot);
                      const hotIdx = hots.findIndex(e => e.id === ev.id);
                      return (
                        <>
                          <button onClick={() => moveHotEvent(ev.id, -1)} disabled={hotIdx === 0} title="Mover quente para cima" className="p-1.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed text-orange-500"><ArrowUp size={14} /></button>
                          <button onClick={() => moveHotEvent(ev.id, 1)} disabled={hotIdx === hots.length - 1} title="Mover quente para baixo" className="p-1.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed text-orange-500"><ArrowDown size={14} /></button>
                        </>
                      );
                    })()}
                    <button onClick={() => openShareEvent(ev)} title="Compartilhar evento" className="p-1.5 rounded hover:bg-muted text-cyan-500"><Share2 size={14} /></button>
                    <button onClick={() => openEditEvent(ev)} title="Editar" className="p-1.5 rounded hover:bg-muted"><Edit2 size={14} /></button>
                    {ev.status === 'scheduled' && (
                      <button onClick={() => setEventStatus(ev, 'open')} title="Abrir agora" className="p-1.5 rounded hover:bg-muted text-green-500"><Play size={14} /></button>
                    )}
                    {ev.status === 'open' && (
                      <button onClick={() => setEventStatus(ev, 'closed')} title="Fechar apostas" className="p-1.5 rounded hover:bg-muted"><Ban size={14} /></button>
                    )}
                    {ev.status === 'closed' && (
                      <button onClick={() => setEventStatus(ev, 'open')} title="Reabrir" className="p-1.5 rounded hover:bg-muted"><Play size={14} /></button>
                    )}
                    {(ev.status === 'open' || ev.status === 'closed') && (
                      <>
                        <button onClick={() => setResolvingEvent(ev)} title="Resolver" className="p-1.5 rounded hover:bg-muted text-green-500"><Trophy size={14} /></button>
                        <button onClick={() => cancelEvent(ev)} title="Cancelar" className="p-1.5 rounded hover:bg-muted text-yellow-500"><X size={14} /></button>
                      </>
                    )}
                    <button onClick={() => deleteEvent(ev)} title="Excluir" className="p-1.5 rounded hover:bg-muted text-red-500"><Trash2 size={14} /></button>
                  </div>
                </div>
                {(() => {
                  const evMarkets = markets.filter(m => m.event_id === ev.id).sort((a, b) => a.position - b.position);
                  if (evMarkets.length === 0) {
                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {evOuts.map(o => (
                          <div key={o.id} className={`px-3 py-2 rounded-lg text-sm ${o.is_winner ? 'bg-green-500/20 border border-green-500' : 'bg-muted'}`}>
                            <div className="text-xs text-muted-foreground">{o.label}</div>
                            <div className="font-bold tabular-nums">{Number(o.odd).toFixed(2)}</div>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  const isExpanded = !!expandedEvents[ev.id];
                  const visibleMarkets = isExpanded ? evMarkets : evMarkets.slice(0, 1);
                  const hiddenCount = evMarkets.length - visibleMarkets.length;
                  return (
                    <div className="space-y-2">
                      {visibleMarkets.map(m => {
                        const mOuts = evOuts.filter(o => o.market_id === m.id);
                        return (
                          <div key={m.id} className="space-y-1">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-semibold text-foreground/80">{m.title}</span>
                              {m.status === 'resolved' && <span className="px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-600">Resolvido</span>}
                              {m.status === 'cancelled' && <span className="px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-600">Cancelado</span>}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {mOuts.map(o => {
                                const isWin = m.winning_outcome_id === o.id;
                                return (
                                  <div key={o.id} className={`px-3 py-2 rounded-lg text-sm ${isWin ? 'bg-green-500/20 border border-green-500' : 'bg-muted'}`}>
                                    <div className="text-xs text-muted-foreground">{isWin ? '🏆 ' : ''}{o.label}</div>
                                    <div className="font-bold tabular-nums">{Number(o.odd).toFixed(2)}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      {evMarkets.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setExpandedEvents(s => ({ ...s, [ev.id]: !isExpanded }))}
                          className="w-full mt-1 px-3 py-1.5 rounded-lg bg-muted/60 hover:bg-muted text-xs text-muted-foreground font-medium transition"
                        >
                          {isExpanded ? `Recolher mercados` : `+${hiddenCount} mercado${hiddenCount > 1 ? 's' : ''}`}
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'categories' && (
        <div className="space-y-3 max-w-3xl">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Crie categorias para agrupar seus eventos (ex.: Futebol, eSports, Política).</p>
            <button onClick={addCategory}
              className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2">
              <Plus size={14} /> Nova categoria
            </button>
          </div>
          {categories.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma categoria ainda.</p>}
          {categories.map((c, idx) => (
            <div key={c.id} className="p-3 rounded-xl bg-card border border-border space-y-3">
              <div className="flex items-end gap-3 flex-wrap">
                <div className="flex-1 min-w-[180px]">
                  <label className="text-xs font-medium block mb-1">Nome</label>
                  <input value={c.name} onChange={e => updateCategory(c.id, { name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-muted text-sm" />
                </div>
                <div className="w-24">
                  <label className="text-xs font-medium block mb-1">Ícone</label>
                  <input value={c.icon} placeholder="⚽" onChange={e => updateCategory(c.id, { icon: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-muted text-sm text-center" />
                </div>
                <div className="w-32">
                  <label className="text-xs font-medium block mb-1">Cor</label>
                  <div className="flex gap-1">
                    <input type="color" value={c.color} onChange={e => updateCategory(c.id, { color: e.target.value })}
                      className="w-10 h-10 rounded cursor-pointer" />
                    <input value={c.color} onChange={e => updateCategory(c.id, { color: e.target.value })}
                      className="flex-1 px-2 py-2 rounded bg-muted text-xs tabular-nums w-0" />
                  </div>
                </div>
                <div className="w-20">
                  <label className="text-xs font-medium block mb-1">Ordem</label>
                  <input type="number" value={c.position}
                    onChange={e => updateCategory(c.id, { position: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg bg-muted text-sm tabular-nums" />
                </div>
                <button onClick={() => deleteCategory(c)} className="p-2 rounded hover:bg-muted text-red-500"><Trash2 size={16} /></button>
              </div>
              <div>
                <ImageUploadField
                  label="Imagem de fundo do bilhete"
                  hint="1200×300 px (proporção ~4:1) · JPG/PNG · usada como fundo dos cards de eventos desta categoria"
                  value={c.background_url || ''}
                  onChange={v => updateCategory(c.id, { background_url: v })}
                  upload={async f => { const r = await uploadAppAsset(f, 'bet-category-bg'); await updateCategory(c.id, { background_url: r.publicUrl }); }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'wagers' && (() => {
        const filtered = wagers.filter(w =>
          (!wFilter.eventId || w.event_id === wFilter.eventId) &&
          (!wFilter.marketId || w.market_id === wFilter.marketId) &&
          (!wFilter.status || w.status === wFilter.status)
        );
        const availableMarkets = wFilter.eventId
          ? markets.filter(m => m.event_id === wFilter.eventId)
          : markets;
        return (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 items-end">
              <div>
                <label className="text-xs font-medium block mb-1">Evento</label>
                <select value={wFilter.eventId}
                  onChange={e => setWFilter(f => ({ ...f, eventId: e.target.value, marketId: '' }))}
                  className="px-3 py-2 rounded-lg bg-muted text-sm min-w-[200px]">
                  <option value="">Todos</option>
                  {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Mercado</label>
                <select value={wFilter.marketId}
                  onChange={e => setWFilter(f => ({ ...f, marketId: e.target.value }))}
                  className="px-3 py-2 rounded-lg bg-muted text-sm min-w-[180px]">
                  <option value="">Todos</option>
                  {availableMarkets.map(m => {
                    const ev = events.find(e => e.id === m.event_id);
                    return <option key={m.id} value={m.id}>{wFilter.eventId ? m.title : `${ev?.title || '?'} → ${m.title}`}</option>;
                  })}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Status</label>
                <select value={wFilter.status}
                  onChange={e => setWFilter(f => ({ ...f, status: e.target.value }))}
                  className="px-3 py-2 rounded-lg bg-muted text-sm">
                  <option value="">Todos</option>
                  <option value="pending">Pendente</option>
                  <option value="won">Ganhou</option>
                  <option value="lost">Perdeu</option>
                  <option value="refunded">Devolvida</option>
                  <option value="cancelled">Cancelada</option>
                </select>
              </div>
              <button onClick={() => setWFilter({ eventId: '', marketId: '', status: '' })}
                className="px-3 py-2 rounded-lg bg-muted text-sm hover:bg-muted/80">Limpar</button>
              <div className="ml-auto text-xs text-muted-foreground">{filtered.length} aposta(s)</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2">Data</th><th>Usuário</th><th>Evento</th><th>Mercado</th><th>Resultado</th>
                  <th className="text-right">Valor</th><th className="text-right">Odd</th><th>Status</th><th className="text-right">Retorno</th>
                </tr></thead>
                <tbody>
                  {filtered.map(w => {
                    const ev = events.find(e => e.id === w.event_id);
                    const out = outcomes.find(o => o.id === w.outcome_id);
                    const mk = w.market_id ? markets.find(m => m.id === w.market_id) : null;
                    return (
                      <tr key={w.id} className="border-b border-border/50">
                        <td className="py-2 text-xs">{new Date(w.created_at).toLocaleString('pt-BR')}</td>
                        <td>{w.user_name || w.user_email}<div className="text-xs text-muted-foreground">{w.account_id}</div></td>
                        <td className="text-xs">{ev?.title || w.event_id.slice(0, 8)}</td>
                        <td className="text-xs text-muted-foreground">{mk?.title || '—'}</td>
                        <td className="text-xs">{out?.label || '?'}</td>
                        <td className="text-right tabular-nums">{w.amount_coins}</td>
                        <td className="text-right tabular-nums">{Number(w.odd_snapshot).toFixed(2)}</td>
                        <td><span className="text-xs px-2 py-0.5 rounded bg-muted">{w.status}</span></td>
                        <td className="text-right tabular-nums text-xs">{w.payout_mode === 'case' ? '— caixa' : (w.payout_coins || '—')}</td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">Nenhuma aposta.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {tab === 'analytics' && (
        <AnalyticsTab
          wagers={wagers}
          events={events}
          outcomes={outcomes}
          coinName={config.coin_name || 'Coins'}
          filter={aFilter}
          setFilter={setAFilter}
          onRefresh={loadWagers}
        />
      )}



      {/* Event editor modal */}
      {editingEvent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditingEvent(null)}>
          <div className="bg-card border border-border rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">{(editingEvent as any).id ? 'Editar evento' : 'Novo evento'}</h3>
              <button onClick={() => setEditingEvent(null)} className="p-1.5 rounded hover:bg-muted"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Título" value={editingEvent.title || ''} onChange={v => setEditingEvent(p => ({ ...p!, title: v }))} />
              <div>
                <label className="text-xs font-medium block mb-1">Categoria</label>
                <select value={editingEvent.category_id || ''}
                  onChange={e => setEditingEvent(p => ({ ...p!, category_id: e.target.value || null }))}
                  className="w-full px-3 py-2 rounded-lg bg-muted text-sm">
                  <option value="">— Sem categoria —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ''}{c.name}</option>)}
                </select>
              </div>
              <Field label="Subtítulo" value={editingEvent.subtitle || ''} onChange={v => setEditingEvent(p => ({ ...p!, subtitle: v }))} />
              <ImageUploadField label="Imagem do evento" hint="800×450 px (16:9)" value={editingEvent.image_url || ''} onChange={v => setEditingEvent(p => ({ ...p!, image_url: v }))}
                upload={async f => { const r = await uploadAppAsset(f, 'bet-event'); setEditingEvent(p => ({ ...p!, image_url: r.publicUrl })); }} />
              <Field label="Abre apostas em (vazio = agora)" type="datetime-local"
                value={betIsoToDateTimeLocal(editingEvent.starts_at)}
                onChange={v => setEditingEvent(p => ({ ...p!, starts_at: v ? dateTimeLocalToBetIso(v) : null }))} />
              <Field label="Encerra apostas em" type="datetime-local"
                value={betIsoToDateTimeLocal(editingEvent.closes_at)}
                onChange={v => setEditingEvent(p => ({ ...p!, closes_at: v ? dateTimeLocalToBetIso(v) : null }))} />
              <div>
                <label className="text-xs font-medium block mb-1">Status</label>
                <select value={editingEvent.status || 'open'}
                  onChange={e => setEditingEvent(p => ({ ...p!, status: e.target.value as any }))}
                  className="w-full px-3 py-2 rounded-lg bg-muted text-sm">
                  <option value="scheduled">Agendado (abre na data)</option>
                  <option value="open">Aberto</option>
                  <option value="closed">Fechado</option>
                </select>
                <p className="text-[10px] text-muted-foreground mt-1">Se "Abre em" for futura, será agendado automaticamente.</p>
              </div>
              <NumberField label="Aposta mínima" value={editingEvent.min_bet ?? null}
                onChange={n => setEditingEvent(p => ({ ...p!, min_bet: n ?? 1 }))} />
              <NumberField label="Aposta máxima (0=sem)" value={editingEvent.max_bet ?? null}
                onChange={n => setEditingEvent(p => ({ ...p!, max_bet: n ?? 0 }))} />
              <NumberField label="Apostas por usuário (0=ilimitado)" value={editingEvent.max_bets_per_user ?? null}
                onChange={n => setEditingEvent(p => ({ ...p!, max_bets_per_user: n == null ? 0 : Math.max(0, Math.floor(n)) }))} />
              <div className="col-span-2">
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted cursor-pointer">
                  <input type="checkbox" checked={!!editingEvent.is_hot}
                    onChange={e => setEditingEvent(p => ({ ...p!, is_hot: e.target.checked }))} />
                  <span className="text-sm font-medium">🔥 Evento quente</span>
                  <span className="text-xs text-muted-foreground">(aparece em destaque, fora do filtro de categoria)</span>
                </label>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 space-y-2">
              <label className="text-sm font-medium">Tipo de prêmio</label>
              <div className="flex gap-2">
                {(['coins', 'case'] as const).map(m => (
                  <button key={m} onClick={() => setEditingEvent(p => ({ ...p!, payout_mode: m }))}
                    className={`px-3 py-1.5 rounded text-sm ${editingEvent.payout_mode === m ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    {m === 'coins' ? `Coins × odd` : 'Caixa Luckybox'}
                  </button>
                ))}
              </div>
              {editingEvent.payout_mode === 'case' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs block mb-1">Caixa</label>
                    <select value={editingEvent.payout_case_id || ''} onChange={e => setEditingEvent(p => ({ ...p!, payout_case_id: e.target.value || null }))}
                      className="w-full px-2 py-1.5 rounded bg-background border border-border text-sm">
                      <option value="">Selecione…</option>
                      {cases.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <NumberField label="Caixas por unidade"
                    value={editingEvent.payout_case_qty_per_unit ?? null}
                    onChange={n => setEditingEvent(p => ({ ...p!, payout_case_qty_per_unit: n ?? 1 }))} />
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Mercados de aposta</label>
                <button onClick={() => setEditingMarkets(arr => [...arr, {
                  title: `Mercado ${arr.length + 1}`, position: arr.length, ...defaultMarketDefaults(),
                  outcomes: [{ label: 'Sim', odd: 1.9 }, { label: 'Não', odd: 1.9 }],
                }])}
                  className="px-2 py-1 text-xs rounded bg-primary/15 text-primary hover:bg-primary/25 flex items-center gap-1">
                  <Plus size={12} /> Adicionar mercado
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground -mt-1">
                Crie sub-apostas dentro do mesmo evento (ex.: <em>Resultado Final</em>, <em>Total de Gols</em>, <em>Ambas Marcam</em>). Cada mercado tem seus próprios resultados, odds e é resolvido separadamente.
              </p>
              {editingMarkets.map((m, mi) => (
                <div key={mi} className="p-3 rounded-lg bg-muted/40 border border-border space-y-2">
                  <div className="flex items-center gap-2">
                    <input value={m.title} placeholder="Título do mercado"
                      onChange={e => setEditingMarkets(arr => arr.map((x, j) => j === mi ? { ...x, title: e.target.value } : x))}
                      className="flex-1 px-3 py-1.5 rounded bg-background border border-border text-sm font-medium" />
                    <button onClick={() => setEditingMarkets(arr => arr.filter((_, j) => j !== mi))}
                      disabled={editingMarkets.length <= 1}
                      title={editingMarkets.length <= 1 ? 'Mantenha ao menos 1 mercado' : 'Excluir mercado'}
                      className="p-1.5 rounded hover:bg-muted text-red-500 disabled:opacity-30 disabled:cursor-not-allowed">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="space-y-1.5 pl-2 border-l-2 border-primary/30">
                    {m.outcomes.map((o, oi) => (
                      <div key={oi} className="flex gap-2 items-center">
                        <input value={o.label} placeholder="Resultado (ex.: Sim)"
                          onChange={e => setEditingMarkets(arr => arr.map((x, j) => j === mi
                            ? { ...x, outcomes: x.outcomes.map((y, k) => k === oi ? { ...y, label: e.target.value } : y) }
                            : x))}
                          className="flex-1 px-3 py-1.5 rounded bg-background border border-border text-sm" />
                        <NumberField value={o.odd}
                          onChange={n => setEditingMarkets(arr => arr.map((x, j) => j === mi
                            ? { ...x, outcomes: x.outcomes.map((y, k) => k === oi ? { ...y, odd: n ?? 0 } : y) }
                            : x))}
                          className="w-24 px-3 py-1.5 rounded bg-background border border-border text-sm tabular-nums" />
                        <button onClick={() => setEditingMarkets(arr => arr.map((x, j) => j === mi
                          ? { ...x, outcomes: x.outcomes.filter((_, k) => k !== oi) }
                          : x))}
                          className="p-1.5 rounded hover:bg-muted text-red-500"><Trash2 size={14} /></button>
                      </div>
                    ))}
                    <button onClick={() => setEditingMarkets(arr => arr.map((x, j) => j === mi
                      ? { ...x, outcomes: [...x.outcomes, { label: '', odd: 2 }] }
                      : x))}
                      className="text-xs text-primary hover:underline flex items-center gap-1 mt-1">
                      <Plus size={11} /> Adicionar resultado
                    </button>
                  </div>

                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none py-1">
                      ⚙️ Configurações avançadas do mercado
                    </summary>
                    <div className="mt-2 grid grid-cols-2 gap-2 p-2 rounded bg-background/60 border border-border">
                      <div>
                        <label className="text-[10px] font-medium block mb-1">Status</label>
                        <select value={m.status}
                          onChange={e => setEditingMarkets(arr => arr.map((x, j) => j === mi ? { ...x, status: e.target.value as any } : x))}
                          className="w-full px-2 py-1.5 rounded bg-muted text-xs" disabled={m.status === 'resolved' || m.status === 'cancelled'}>
                          <option value="open">Aberto</option>
                          <option value="closed">Fechado</option>
                          {m.status === 'resolved' && <option value="resolved">Resolvido</option>}
                          {m.status === 'cancelled' && <option value="cancelled">Cancelado</option>}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-medium block mb-1">Encerra apostas em (vazio = usa do evento)</label>
                        <input type="datetime-local" value={betIsoToDateTimeLocal(m.closes_at)}
                          onChange={e => setEditingMarkets(arr => arr.map((x, j) => j === mi ? { ...x, closes_at: e.target.value ? dateTimeLocalToBetIso(e.target.value) : null } : x))}
                          className="w-full px-2 py-1.5 rounded bg-muted text-xs" />
                      </div>
                      <NumberField label="Mín. aposta" value={m.min_bet}
                        onChange={n => setEditingMarkets(arr => arr.map((x, j) => j === mi ? { ...x, min_bet: n ?? 1 } : x))} />
                      <NumberField label="Máx. aposta (0=sem)" value={m.max_bet}
                        onChange={n => setEditingMarkets(arr => arr.map((x, j) => j === mi ? { ...x, max_bet: n ?? 0 } : x))} />
                      <NumberField label="Apostas/usuário (0=ilim.)" value={m.max_bets_per_user}
                        onChange={n => setEditingMarkets(arr => arr.map((x, j) => j === mi ? { ...x, max_bets_per_user: n == null ? 0 : Math.max(0, Math.floor(n)) } : x))} />
                      <div>
                        <label className="text-[10px] font-medium block mb-1">Prêmio</label>
                        <div className="flex gap-1">
                          {(['coins', 'case'] as const).map(mode => (
                            <button key={mode} type="button"
                              onClick={() => setEditingMarkets(arr => arr.map((x, j) => j === mi ? { ...x, payout_mode: mode } : x))}
                              className={`flex-1 px-2 py-1.5 rounded text-xs ${m.payout_mode === mode ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                              {mode === 'coins' ? 'Coins×odd' : 'Caixa'}
                            </button>
                          ))}
                        </div>
                      </div>
                      {m.payout_mode === 'case' && (
                        <>
                          <div className="col-span-2">
                            <label className="text-[10px] font-medium block mb-1">Caixa Luckybox</label>
                            <select value={m.payout_case_id || ''}
                              onChange={e => setEditingMarkets(arr => arr.map((x, j) => j === mi ? { ...x, payout_case_id: e.target.value || null } : x))}
                              className="w-full px-2 py-1.5 rounded bg-muted text-xs">
                              <option value="">Selecione…</option>
                              {cases.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          </div>
                          <NumberField label="Caixas por unidade" value={m.payout_case_qty_per_unit}
                            onChange={n => setEditingMarkets(arr => arr.map((x, j) => j === mi ? { ...x, payout_case_qty_per_unit: n ?? 1 } : x))} />
                        </>
                      )}
                    </div>
                  </details>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditingEvent(null)} className="px-4 py-2 rounded bg-muted">Cancelar</button>
              <button onClick={saveEvent} disabled={saving}
                className="px-4 py-2 rounded bg-primary text-primary-foreground font-medium flex items-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} Salvar evento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve modal */}
      {resolvingEvent && (() => {
        const evMarkets = markets.filter(m => m.event_id === resolvingEvent.id).sort((a, b) => a.position - b.position);
        const evOuts = outcomes.filter(o => o.event_id === resolvingEvent.id).sort((a, b) => a.position - b.position);
        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setResolvingEvent(null)}>
            <div className="bg-card border border-border rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 space-y-3" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold text-lg">Resolver "{resolvingEvent.title}"</h3>
              <p className="text-sm text-muted-foreground">Escolha o resultado vencedor de cada mercado. Esta ação é definitiva e processa pagamentos.</p>

              {evMarkets.length === 0 && (
                // Legacy event without markets — keep event-level resolve
                <div className="space-y-2">
                  {evOuts.map(o => (
                    <button key={o.id} onClick={() => resolveEvent(o.id)} disabled={saving}
                      className="w-full px-4 py-3 rounded-lg bg-muted hover:bg-primary hover:text-primary-foreground transition flex items-center justify-between disabled:opacity-50">
                      <span className="font-medium">{o.label}</span>
                      <span className="tabular-nums">{Number(o.odd).toFixed(2)}</span>
                    </button>
                  ))}
                </div>
              )}

              {evMarkets.map(m => {
                const mOuts = evOuts.filter(o => o.market_id === m.id);
                const isResolved = m.status === 'resolved';
                const isCancelled = m.status === 'cancelled';
                return (
                  <div key={m.id} className="p-3 rounded-lg bg-muted/40 border border-border space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-sm">{m.title}</div>
                      <div className="flex items-center gap-2">
                        {isResolved && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-600">Resolvido</span>}
                        {isCancelled && <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-600">Cancelado</span>}
                        {!isResolved && !isCancelled && (
                          <button onClick={() => cancelMarket(m.id, m.title)} disabled={saving}
                            className="text-[11px] text-yellow-600 hover:underline">Cancelar mercado</button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {mOuts.map(o => {
                        const isWinner = m.winning_outcome_id === o.id;
                        return (
                          <button key={o.id}
                            onClick={() => !isResolved && !isCancelled && resolveMarket(m.id, o.id)}
                            disabled={saving || isResolved || isCancelled}
                            className={`w-full px-3 py-2 rounded-lg transition flex items-center justify-between text-sm ${
                              isWinner ? 'bg-green-500/20 border border-green-500'
                              : (isResolved || isCancelled) ? 'bg-muted opacity-60 cursor-not-allowed'
                              : 'bg-background border border-border hover:bg-primary hover:text-primary-foreground'
                            }`}>
                            <span className="font-medium">{isWinner ? '🏆 ' : ''}{o.label}</span>
                            <span className="tabular-nums">{Number(o.odd).toFixed(2)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <button onClick={() => setResolvingEvent(null)} className="w-full px-4 py-2 rounded bg-muted">Fechar</button>
            </div>
          </div>
        );
      })()}

      {importerOpen && (
        <ApiFootballImporter
          existingFixtureIds={events.map(e => (e as any).external_fixture_id).filter(Boolean) as string[]}
          categories={categories}
          onClose={() => setImporterOpen(false)}
          onPick={async (fx) => {
            // Build event prefilled from fixture
            const homeName = fx.teams?.home?.name || 'Casa';
            const awayName = fx.teams?.away?.name || 'Visitante';
            const homeLogo = fx.teams?.home?.logo || '';
            const awayLogo = fx.teams?.away?.logo || '';
            const startsAtIso = fx.fixture?.date || null;
            const closesAtIso = startsAtIso
              ? new Date(new Date(startsAtIso).getTime() - 5 * 60_000).toISOString()
              : null;
            const futCat = categories.find(c => /futebol|soccer|football/i.test(c.name));
            const fixtureId = String(fx.fixture?.id || '');
            setEditingEvent({
              title: `${homeName} x ${awayName}`,
              subtitle: fx.league?.name ? `${fx.league.name}${fx.league.round ? ' · ' + fx.league.round : ''}` : '',
              category: 'Futebol',
              category_id: futCat?.id || null,
              image_url: '',
              home_image_url: homeLogo || null,
              away_image_url: awayLogo || null,
              starts_at: startsAtIso,
              closes_at: closesAtIso,
              status: 'open',
              payout_mode: 'coins', payout_case_id: null, payout_case_qty_per_unit: 1,
              min_bet: 10, max_bet: 0, max_bets_per_user: 1, is_hot: false,
              external_fixture_id: fixtureId,
            } as any);

            // Try to fetch odds for this fixture and build markets dynamically
            const fallbackMarkets = [{
              title: 'Resultado Final', position: 0, ...defaultMarketDefaults(),
              outcomes: [
                { label: `${homeName} vence`, odd: 1.9 },
                { label: 'Empate', odd: 3.2 },
                { label: `${awayName} vence`, odd: 3.8 },
              ],
            }];

            // PT-BR translations for known market names
            const MARKET_NAME_PTBR: Record<string, string> = {
              'match winner': 'Resultado Final',
              'both teams score': 'Ambos marcam',
              'goals over/under': 'Mais/Menos gols',
              'double chance': 'Dupla chance',
              'asian handicap': 'Handicap asiático',
              'handicap result': 'Handicap',
              'first half winner': 'Vencedor 1º tempo',
              'second half winner': 'Vencedor 2º tempo',
              'exact score': 'Placar exato',
              'total - home': 'Total gols mandante',
              'total - away': 'Total gols visitante',
              // Escanteios
              'corners over under': 'Escanteios Mais/Menos',
              'corners over/under': 'Escanteios Mais/Menos',
              'corners 1x2': 'Resultado em Escanteios',
              'corners asian handicap': 'Handicap Asiático de Escanteios',
              'home corners over/under': 'Escanteios Casa Mais/Menos',
              'away corners over/under': 'Escanteios Fora Mais/Menos',
              'total corners (3 way)': 'Total de Escanteios',
              'total corners (1st half)': 'Escanteios 1º Tempo',
              'total corners (2nd half)': 'Escanteios 2º Tempo',
              'corners. odd/even': 'Escanteios Ímpar/Par',
              'corners odd/even': 'Escanteios Ímpar/Par',
              'corners. double chance': 'Dupla Chance Escanteios',
              'corners double chance': 'Dupla Chance Escanteios',
              'corners 1x2 (1st half)': 'Resultado Escanteios 1º Tempo',
              'corners 1x2 (2nd half)': 'Resultado Escanteios 2º Tempo',
              // Cartões
              'cards over/under': 'Cartões Mais/Menos',
              'cards over under': 'Cartões Mais/Menos',
              'total cards': 'Total de Cartões',
              'asian cards': 'Handicap Asiático de Cartões',
              'cards handicap': 'Handicap de Cartões',
              'yellow cards': 'Cartões Amarelos',
              'red cards': 'Cartões Vermelhos',
              'booking points': 'Pontos de Cartões',
              'team cards': 'Cartões por Time',
              'home cards over/under': 'Cartões Casa Mais/Menos',
              'away cards over/under': 'Cartões Fora Mais/Menos',
            };

            // Markets allowed to use fallback bookmakers when Bet365 doesn't offer them
            const FALLBACK_ALLOWED_KEYS = new Set<string>([
              'corners over under', 'corners over/under',
              'corners 1x2',
              'corners asian handicap',
              'home corners over/under',
              'away corners over/under',
              'total corners (3 way)',
              'total corners (1st half)',
              'total corners (2nd half)',
              'corners. odd/even', 'corners odd/even',
              'corners. double chance', 'corners double chance',
              'corners 1x2 (1st half)',
              'corners 1x2 (2nd half)',
              'cards over/under', 'cards over under',
              'total cards',
              'asian cards',
              'cards handicap',
              'yellow cards',
              'red cards',
              'booking points',
              'team cards',
              'home cards over/under',
              'away cards over/under',
            ]);
            const isFallbackKey = (key: string) => {
              if (FALLBACK_ALLOWED_KEYS.has(key)) return true;
              return /corner|card/i.test(key);
            };

            // Bookmaker fallback priority (Bet365 is primary; others only for corners/cards)
            const FALLBACK_BOOKMAKERS = ['betano', '1xbet', 'marathonbet', '10bet', 'superbet'];

            const translateValue = (raw: string, homeName: string, awayName: string): string => {
              const v = String(raw || '').trim();
              const low = v.toLowerCase();
              if (low === 'home' || low === '1') return `${homeName} vence`;
              if (low === 'away' || low === '2') return `${awayName} vence`;
              if (low === 'draw' || low === 'x') return 'Empate';
              if (low === 'yes') return 'Sim';
              if (low === 'no') return 'Não';
              if (low === 'home/draw' || low === '1x') return `${homeName} ou empate`;
              if (low === 'draw/away' || low === 'x2') return `Empate ou ${awayName}`;
              if (low === 'home/away' || low === '12') return `${homeName} ou ${awayName}`;
              if (low === 'odd') return 'Ímpar';
              if (low === 'even') return 'Par';
              const ov = v.match(/^over\s+([\d.]+)$/i);
              if (ov) return `Mais de ${ov[1]}`;
              const un = v.match(/^under\s+([\d.]+)$/i);
              if (un) return `Menos de ${un[1]}`;
              return v;
            };

            const buildOutcomesFromBet = (bet: any) => {
              if (!bet || !Array.isArray(bet.values) || bet.values.length < 2) return null;
              const seen = new Set<string>();
              const outs = bet.values
                .map((v: any) => ({
                  label: translateValue(String(v.value), homeName, awayName),
                  odd: Number(v.odd),
                }))
                .filter((o: any) => {
                  if (!o.label || !(o.odd > 1)) return false;
                  const k = o.label.toLowerCase();
                  if (seen.has(k)) return false;
                  seen.add(k);
                  return true;
                });
              if (outs.length < 2) return null;
              return outs;
            };

            try {
              const r = await fetch(`https://sportsapi.tipspayroleta.com/odds?fixture=${encodeURIComponent(String(fixtureId))}`);
              const oddsRes = await r.json().catch(() => ({}));
              const responses = (oddsRes as any)?.response || [];
              const bookmakers: any[] = responses[0]?.bookmakers || [];
              const findBM = (name: string) =>
                bookmakers.find((b: any) => String(b?.name || '').toLowerCase() === name);
              const bet365 = findBM('bet365');

              const built: EditingMarket[] = [];
              const usedKeys = new Set<string>();

              const addBetsFrom = (bets: any[], { fallbackOnly }: { fallbackOnly: boolean }) => {
                const ordered = [...bets].sort((a, b) => {
                  const aw = (a.name || '').toLowerCase() === 'match winner' ? -1 : 0;
                  const bw = (b.name || '').toLowerCase() === 'match winner' ? -1 : 0;
                  return aw - bw;
                });
                ordered.forEach((bet) => {
                  const key = (bet?.name || '').toLowerCase();
                  if (!key || usedKeys.has(key)) return;
                  if (fallbackOnly && !isFallbackKey(key)) return;
                  const outs = buildOutcomesFromBet(bet);
                  if (!outs) return;
                  const title = MARKET_NAME_PTBR[key] || bet.name;
                  built.push({
                    title, position: built.length, ...defaultMarketDefaults(),
                    outcomes: outs,
                  });
                  usedKeys.add(key);
                });
              };

              if (bet365) {
                console.log('Using bookmaker: Bet365');
                addBetsFrom(bet365.bets || [], { fallbackOnly: false });
              } else {
                console.warn(`Bet365 not available for fixture ${fixtureId}`);
              }

              // Fallback ONLY for corners/cards
              const orderedFallback = [
                ...FALLBACK_BOOKMAKERS.map(findBM).filter(Boolean),
                ...bookmakers.filter(
                  (b: any) =>
                    String(b?.name || '').toLowerCase() !== 'bet365' &&
                    !FALLBACK_BOOKMAKERS.includes(String(b?.name || '').toLowerCase()),
                ),
              ];
              for (const bm of orderedFallback) {
                addBetsFrom(bm?.bets || [], { fallbackOnly: true });
              }

              if (built.length === 0) {
                setEditingMarkets(fallbackMarkets);
                toast.info('Sem odds disponíveis na API — usando mercado padrão.');
              } else {
                setEditingMarkets(built);
                toast.success(`${built.length} mercado(s) importado(s)`);
              }
            } catch (err: any) {
              console.error('odds fetch error', err);
              setEditingMarkets(fallbackMarkets);
              toast.info('Não foi possível buscar odds — usando mercado padrão.');
            }


            setImporterOpen(false);
          }}
        />
      )}
      {sharingEvent && (
        <ShareEvent
          open={!!sharingEvent}
          onClose={() => setSharingEvent(null)}
          data={sharingEvent}
          config={config?.page_config?.ticket || {}}
        />
      )}
    </div>
  );
};

function ApiFootballImporter({ existingFixtureIds, categories, onClose, onPick }: {
  existingFixtureIds: string[];
  categories: Array<{ id: string; name: string }>;
  onClose: () => void;
  onPick: (fixture: any) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [league, setLeague] = useState('');
  const [season, setSeason] = useState(String(new Date().getFullYear()));
  const [date, setDate] = useState(today);
  const [team, setTeam] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [errored, setErrored] = useState<string>('');

  const runSearch = async (overrides?: { league?: string; season?: string; date?: string; team?: string; nsOnly?: boolean }) => {
    const l = overrides?.league ?? league;
    const s = overrides?.season ?? season;
    const d = overrides?.date ?? date;
    const t = overrides?.team ?? team;
    setLoading(true); setErrored(''); setResults([]);
    try {
      const qs = new URLSearchParams();
      if (l.trim()) qs.set('league', l.trim());
      if (s.trim()) qs.set('season', s.trim());
      if (d.trim()) qs.set('date', d.trim());
      if (t.trim()) qs.set('team', t.trim());
      const r = await fetch(`https://sportsapi.tipspayroleta.com/fixtures?${qs.toString()}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      if ((data as any)?.error) throw new Error((data as any).error);
      let list: any[] = (data as any)?.response || [];
      if (overrides?.nsOnly) {
        list = list.filter((fx: any) => fx?.fixture?.status?.short === 'NS');
      }
      list.sort((a: any, b: any) => {
        const da = a?.fixture?.date ? new Date(a.fixture.date).getTime() : 0;
        const db = b?.fixture?.date ? new Date(b.fixture.date).getTime() : 0;
        return da - db;
      });
      setResults(list);
      if (list.length === 0) toast.info('Nenhum jogo encontrado para esses filtros');
    } catch (e: any) {
      const msg = e?.message || 'Falha ao buscar';
      setErrored(msg); toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const search = () => runSearch();

  const loadCopa2026 = () => {
    setLeague('1');
    setSeason('2026');
    setDate('');
    setTeam('');
    runSearch({ league: '1', season: '2026', date: '', team: '', nsOnly: true });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">⚽ Importador de Football</h3>
          <div className="flex items-center gap-2">
            <button onClick={loadCopa2026} disabled={loading}
              className="px-3 py-1.5 rounded bg-amber-500 text-black text-xs font-bold disabled:opacity-50">
              🏆 Carregar Copa 2026
            </button>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-muted"><X size={16} /></button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div>
            <label className="text-xs font-medium block mb-1">Liga (ID)</label>
            <input value={league} onChange={e => setLeague(e.target.value)} placeholder="ex: 71"
              className="w-full px-3 py-2 rounded-lg bg-muted text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Temporada</label>
            <input value={season} onChange={e => setSeason(e.target.value)} placeholder="2025"
              className="w-full px-3 py-2 rounded-lg bg-muted text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1 flex items-center justify-between gap-2">
              <span>Data</span>
              {date && (
                <button type="button" onClick={() => setDate('')}
                  className="text-[10px] text-muted-foreground hover:text-foreground underline">limpar</button>
              )}
            </label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-muted text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Time (ID)</label>
            <input value={team} onChange={e => setTeam(e.target.value)} placeholder="ex: 131"
              className="w-full px-3 py-2 rounded-lg bg-muted text-sm" />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Use IDs numéricos da API-Football (league/team). Data no formato AAAA-MM-DD. Pelo menos um filtro é recomendado.
        </p>

        <div className="flex justify-end gap-2">
          <button onClick={() => { setLeague(''); setTeam(''); setDate(''); setSeason(String(new Date().getFullYear())); setResults([]); }}
            className="px-3 py-2 rounded bg-muted text-sm">Limpar</button>
          <button onClick={search} disabled={loading}
            className="px-4 py-2 rounded bg-primary text-primary-foreground font-medium text-sm flex items-center gap-2 disabled:opacity-50">
            {loading ? <Loader2 className="animate-spin" size={14} /> : '🔍'} Buscar jogos
          </button>
        </div>

        {errored && <p className="text-sm text-destructive">{errored}</p>}

        <div className="space-y-2">
          {results.map((fx: any) => {
            const fid = String(fx.fixture?.id || '');
            const already = existingFixtureIds.includes(fid);
            const home = fx.teams?.home; const away = fx.teams?.away;
            const dt = fx.fixture?.date ? new Date(fx.fixture.date) : null;
            return (
              <div key={fid} className="p-3 rounded-xl bg-muted/50 border border-border flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-muted-foreground mb-1">
                    {fx.league?.name} {fx.league?.country ? `· ${fx.league.country}` : ''} {fx.league?.round ? `· ${fx.league.round}` : ''}
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {home?.logo && <img src={home.logo} alt="" className="w-5 h-5 object-contain" />}
                    <span className="truncate">{home?.name}</span>
                    <span className="text-muted-foreground">x</span>
                    {away?.logo && <img src={away.logo} alt="" className="w-5 h-5 object-contain" />}
                    <span className="truncate">{away?.name}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {dt ? dt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : ''}
                    {' · fixture #' + fid}
                  </div>
                </div>
                {already ? (
                  <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">Já importado</span>
                ) : (
                  <button onClick={() => onPick(fx)}
                    className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium">
                    Importar evento
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', upload }: { label: string; value: string; onChange: (v: string) => void; type?: string; upload?: (f: File) => Promise<void> }) {
  const isNumber = type === 'number';
  return (
    <div>
      <label className="text-xs font-medium block mb-1">{label}</label>
      <div className="flex gap-1">
        <input
          type={isNumber ? 'text' : type}
          inputMode={isNumber ? 'decimal' : undefined}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg bg-muted text-sm w-full"
        />
        {upload && (
          <label className="px-2 py-2 rounded-lg bg-muted cursor-pointer text-xs hover:bg-muted/80 flex items-center">
            Upload
            <input type="file" accept="image/*" className="hidden"
              onChange={async e => { const f = e.target.files?.[0]; if (f) await upload(f); e.target.value = ''; }} />
          </label>
        )}
      </div>
    </div>
  );
}

/** Free-typing number input: stores raw string locally, emits numeric value to parent only when parseable.
 *  Never overwrites what the user is typing (so "1.", "", "-" are allowed mid-edit). */
function NumberField({ label, value, onChange, placeholder, className, allowEmpty = true }: {
  label?: string; value: number | null | undefined; onChange: (n: number | null) => void;
  placeholder?: string; className?: string; allowEmpty?: boolean;
}) {
  const [raw, setRaw] = useState<string>(value == null ? '' : String(value));
  const [focused, setFocused] = useState(false);
  // Sync from parent when not focused (avoids overwrite while typing)
  useEffect(() => {
    if (!focused) setRaw(value == null ? '' : String(value));
  }, [value, focused]);
  const input = (
    <input
      type="text"
      inputMode="decimal"
      value={raw}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        if (raw.trim() === '') {
          if (allowEmpty) onChange(null);
          else { setRaw(value == null ? '' : String(value)); }
          return;
        }
        const n = Number(raw.replace(',', '.'));
        if (isNaN(n)) { setRaw(value == null ? '' : String(value)); return; }
        onChange(n);
        setRaw(String(n));
      }}
      onChange={e => {
        const v = e.target.value;
        setRaw(v);
        if (v.trim() === '') { if (allowEmpty) onChange(null); return; }
        const n = Number(v.replace(',', '.'));
        if (!isNaN(n)) onChange(n);
      }}
      className={className || 'flex-1 px-3 py-2 rounded-lg bg-muted text-sm w-full'}
    />
  );
  if (!label) return input;
  return (
    <div>
      <label className="text-xs font-medium block mb-1">{label}</label>
      {input}
    </div>
  );
}

function ImageUploadField({ label, value, onChange, upload, hint }: { label: string; value: string; onChange: (v: string) => void; upload: (f: File) => Promise<void>; hint?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <label className="text-xs font-medium block mb-1">
        {label}
        {hint && <span className="ml-2 text-[10px] font-normal text-muted-foreground">({hint})</span>}
      </label>
      <div className="flex items-center gap-2">
        {value ? (
          <img src={value} alt="" className="w-12 h-12 rounded object-cover bg-muted border border-border" />
        ) : (
          <div className="w-12 h-12 rounded bg-muted border border-dashed border-border" />
        )}
        <label className={`px-3 py-2 rounded-lg bg-muted cursor-pointer text-xs hover:bg-muted/80 flex items-center gap-1 ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
          {busy ? 'Enviando...' : value ? 'Trocar' : 'Upload'}
          <input type="file" accept="image/*" className="hidden"
            onChange={async e => {
              const f = e.target.files?.[0]; if (!f) return;
              setBusy(true); try { await upload(f); } finally { setBusy(false); e.currentTarget.value = ''; }
            }} />
        </label>
        {value && (
          <button type="button" onClick={() => onChange('')} className="px-2 py-2 text-xs text-muted-foreground hover:text-foreground">Remover</button>
        )}
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-medium block mb-1">{label}</label>
      <div className="flex gap-1">
        <input type="color" value={value} onChange={e => onChange(e.target.value)} className="w-12 h-10 rounded cursor-pointer" />
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg bg-muted text-sm tabular-nums" />
      </div>
    </div>
  );
}

// ============================================================
// Analytics Tab
// ============================================================
interface AnalyticsTabProps {
  wagers: any[];
  events: BetEvent[];
  outcomes: BetOutcome[];
  coinName: string;
  filter: { eventId: string; status: string; days: number };
  setFilter: (f: { eventId: string; status: string; days: number }) => void;
  onRefresh: () => void | Promise<void>;
}

const COLORS = ['#22d3ee', '#a78bfa', '#f472b6', '#facc15', '#34d399', '#fb7185', '#60a5fa'];

function AnalyticsTab({ wagers, events, outcomes, coinName, filter, setFilter, onRefresh }: AnalyticsTabProps) {
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const cancelWager = async (wagerId: string, userName: string) => {
    const ok = await confirmDialog({
      title: 'Cancelar aposta?',
      description: `A aposta de ${userName} será cancelada e os ${coinName} serão devolvidos ao saldo do usuário.`,
      confirmText: 'Cancelar aposta',
      cancelText: 'Voltar',
      destructive: true,
    });
    if (!ok) return;
    setCancelling(wagerId);
    try {
      const { data, error } = await supabase.rpc('cancel_bet_wager' as any, { p_wager_id: wagerId });
      if (error) throw error;
      const res = data as any;
      if (!res?.success) {
        toast.error(res?.error === 'not_pending' ? 'Aposta não pode ser cancelada (já resolvida)' : 'Falha ao cancelar');
        return;
      }
      toast.success(`Aposta cancelada. ${res.refunded} ${coinName} devolvidos.`);
      await onRefresh();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao cancelar aposta');
    } finally {
      setCancelling(null);
    }
  };

  // Apply filters
  const cutoff = filter.days > 0 ? Date.now() - filter.days * 86400_000 : 0;
  const filtered = wagers.filter(w => {
    if (filter.eventId && w.event_id !== filter.eventId) return false;
    if (filter.status && w.status !== filter.status) return false;
    if (cutoff && new Date(w.created_at).getTime() < cutoff) return false;
    return true;
  });

  // KPIs
  const totalWagers = filtered.length;
  const totalStaked = filtered.reduce((s, w) => s + (w.amount_coins || 0), 0);
  const totalPaidCoins = filtered.filter(w => w.status === 'won' && w.payout_mode !== 'case').reduce((s, w) => s + (w.payout_coins || 0), 0);
  const totalPaidCases = filtered.filter(w => w.status === 'won' && w.payout_mode === 'case').length;
  const refunded = filtered.filter(w => w.status === 'refunded').reduce((s, w) => s + (w.amount_coins || 0), 0);
  const won = filtered.filter(w => w.status === 'won').length;
  const lost = filtered.filter(w => w.status === 'lost').length;
  const pending = filtered.filter(w => w.status === 'pending').length;
  const uniqueUsers = new Set(filtered.map(w => `${w.user_email}|${w.account_id}`)).size;
  const houseEdge = totalStaked - totalPaidCoins - refunded;
  const winRate = (won + lost) > 0 ? (won / (won + lost)) * 100 : 0;
  const avgBet = totalWagers > 0 ? totalStaked / totalWagers : 0;

  // By status (pie)
  const byStatus = ['pending', 'won', 'lost', 'refunded', 'cancelled'].map(s => ({
    name: s, value: filtered.filter(w => w.status === s).length,
  })).filter(x => x.value > 0);

  // By day (line)
  const byDayMap = new Map<string, { date: string; apostas: number; valor: number; pago: number }>();
  filtered.forEach(w => {
    const d = new Date(w.created_at).toISOString().slice(0, 10);
    const e = byDayMap.get(d) || { date: d, apostas: 0, valor: 0, pago: 0 };
    e.apostas += 1;
    e.valor += w.amount_coins || 0;
    if (w.status === 'won' && w.payout_mode !== 'case') e.pago += w.payout_coins || 0;
    byDayMap.set(d, e);
  });
  const byDay = Array.from(byDayMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  // By event (bar)
  const byEventMap = new Map<string, { title: string; apostas: number; valor: number; pago: number }>();
  filtered.forEach(w => {
    const ev = events.find(e => e.id === w.event_id);
    const title = ev?.title || w.event_id.slice(0, 8);
    const e = byEventMap.get(w.event_id) || { title, apostas: 0, valor: 0, pago: 0 };
    e.apostas += 1;
    e.valor += w.amount_coins || 0;
    if (w.status === 'won' && w.payout_mode !== 'case') e.pago += w.payout_coins || 0;
    byEventMap.set(w.event_id, e);
  });
  const byEvent = Array.from(byEventMap.values()).sort((a, b) => b.valor - a.valor).slice(0, 10);

  // By outcome (top picks)
  const byOutcomeMap = new Map<string, { label: string; event: string; apostas: number; valor: number }>();
  filtered.forEach(w => {
    const out = outcomes.find(o => o.id === w.outcome_id);
    const ev = events.find(e => e.id === w.event_id);
    const key = w.outcome_id;
    const e = byOutcomeMap.get(key) || { label: out?.label || '?', event: ev?.title || '', apostas: 0, valor: 0 };
    e.apostas += 1;
    e.valor += w.amount_coins || 0;
    byOutcomeMap.set(key, e);
  });
  const byOutcome = Array.from(byOutcomeMap.values()).sort((a, b) => b.valor - a.valor).slice(0, 10);

  // Top users
  type UserPick = { id: string; event: string; outcome: string; amount: number; odd: number; status: string; createdAt: string };
  const byUserMap = new Map<string, { name: string; email: string; account: string; apostas: number; valor: number; pago: number; ganhas: number; perdidas: number; picks: UserPick[] }>();
  filtered.forEach(w => {
    const key = `${w.user_email}|${w.account_id}`;
    const e = byUserMap.get(key) || { name: w.user_name || w.user_email, email: w.user_email, account: w.account_id, apostas: 0, valor: 0, pago: 0, ganhas: 0, perdidas: 0, picks: [] };
    e.apostas += 1;
    e.valor += w.amount_coins || 0;
    if (w.status === 'won') {
      e.ganhas += 1;
      if (w.payout_mode !== 'case') e.pago += w.payout_coins || 0;
    }
    if (w.status === 'lost') e.perdidas += 1;
    const ev = events.find(x => x.id === w.event_id);
    const out = outcomes.find(o => o.id === w.outcome_id);
    e.picks.push({
      id: w.id,
      event: ev?.title || '—',
      outcome: out?.label || '—',
      amount: w.amount_coins || 0,
      odd: Number(w.odd_snapshot) || 0,
      status: w.status,
      createdAt: w.created_at,
    });
    byUserMap.set(key, e);
  });

  const topUsers = Array.from(byUserMap.values()).sort((a, b) => b.valor - a.valor).slice(0, 20);

  const exportCsv = () => {
    const rows = [
      ['data', 'usuario', 'email', 'account_id', 'evento', 'resultado', 'valor', 'odd', 'status', 'modo', 'pago_coins', 'grant_id'],
      ...filtered.map(w => {
        const ev = events.find(e => e.id === w.event_id);
        const out = outcomes.find(o => o.id === w.outcome_id);
        return [
          new Date(w.created_at).toISOString(),
          w.user_name || '', w.user_email || '', w.account_id || '',
          ev?.title || w.event_id, out?.label || '',
          w.amount_coins, w.odd_snapshot, w.status, w.payout_mode,
          w.payout_coins || 0, w.payout_grant_id || '',
        ];
      }),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `apostas-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-end p-3 rounded-xl bg-card border border-border">
        <div>
          <label className="text-xs block mb-1 text-muted-foreground">Período</label>
          <select value={filter.days} onChange={e => setFilter({ ...filter, days: Number(e.target.value) })}
            className="px-3 py-1.5 rounded bg-muted text-sm border border-border">
            <option value={1}>Últimas 24h</option>
            <option value={7}>7 dias</option>
            <option value={30}>30 dias</option>
            <option value={90}>90 dias</option>
            <option value={0}>Tudo</option>
          </select>
        </div>
        <div>
          <label className="text-xs block mb-1 text-muted-foreground">Evento</label>
          <select value={filter.eventId} onChange={e => setFilter({ ...filter, eventId: e.target.value })}
            className="px-3 py-1.5 rounded bg-muted text-sm border border-border min-w-[180px]">
            <option value="">Todos</option>
            {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs block mb-1 text-muted-foreground">Status</label>
          <select value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })}
            className="px-3 py-1.5 rounded bg-muted text-sm border border-border">
            <option value="">Todos</option>
            <option value="pending">Pendente</option>
            <option value="won">Ganhou</option>
            <option value="lost">Perdeu</option>
            <option value="refunded">Devolvida</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </div>
        <div className="ml-auto">
          <button onClick={exportCsv} disabled={!filtered.length}
            className="px-3 py-2 rounded bg-primary text-primary-foreground text-sm font-medium flex items-center gap-1.5 disabled:opacity-50">
            <Download size={14} /> Exportar CSV
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={<BarChart3 size={16} />} label="Apostas" value={totalWagers.toLocaleString('pt-BR')} sub={`${uniqueUsers} apostadores`} />
        <Kpi icon={<Coins size={16} />} label={`${coinName} apostados`} value={totalStaked.toLocaleString('pt-BR')} sub={`Ticket médio ${avgBet.toFixed(0)}`} />
        <Kpi icon={<TrendingDown size={16} />} label={`${coinName} pagos`} value={totalPaidCoins.toLocaleString('pt-BR')} sub={totalPaidCases > 0 ? `+${totalPaidCases} caixas` : 'em prêmios'} />
        <Kpi icon={<TrendingUp size={16} />} label="Resultado da casa" value={houseEdge.toLocaleString('pt-BR')}
          sub={`${totalStaked > 0 ? ((houseEdge / totalStaked) * 100).toFixed(1) : '0'}% margem`}
          accent={houseEdge >= 0 ? 'positive' : 'negative'} />
        <Kpi icon={<Trophy size={16} />} label="Ganhas" value={won.toLocaleString('pt-BR')} sub={`${winRate.toFixed(1)}% win rate`} accent="positive" />
        <Kpi icon={<X size={16} />} label="Perdidas" value={lost.toLocaleString('pt-BR')} sub={`${(100 - winRate).toFixed(1)}% lose rate`} />
        <Kpi icon={<Loader2 size={16} />} label="Pendentes" value={pending.toLocaleString('pt-BR')} sub="aguardando resolução" />
        <Kpi icon={<Users size={16} />} label="Devolvido" value={refunded.toLocaleString('pt-BR')} sub={`${filtered.filter(w => w.status === 'refunded').length} apostas`} />
      </div>

      {/* Volume por dia */}
      <div className="p-4 rounded-xl bg-card border border-border">
        <h4 className="font-semibold text-sm mb-3">Volume por dia</h4>
        {byDay.length === 0 ? <p className="text-xs text-muted-foreground py-8 text-center">Sem dados no período.</p> : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={byDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <ReTooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="apostas" stroke="#22d3ee" name="Nº apostas" strokeWidth={2} />
              <Line type="monotone" dataKey="valor" stroke="#a78bfa" name={`Valor (${coinName})`} strokeWidth={2} />
              <Line type="monotone" dataKey="pago" stroke="#f472b6" name={`Pago (${coinName})`} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status pie */}
        <div className="p-4 rounded-xl bg-card border border-border">
          <h4 className="font-semibold text-sm mb-3">Distribuição por status</h4>
          {byStatus.length === 0 ? <p className="text-xs text-muted-foreground py-8 text-center">—</p> : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(d: any) => `${d.name}: ${d.value}`}>
                  {byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <ReTooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* By event */}
        <div className="p-4 rounded-xl bg-card border border-border">
          <h4 className="font-semibold text-sm mb-3">Top eventos por valor</h4>
          {byEvent.length === 0 ? <p className="text-xs text-muted-foreground py-8 text-center">—</p> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byEvent} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis type="category" dataKey="title" stroke="hsl(var(--muted-foreground))" fontSize={11} width={120} />
                <ReTooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="valor" fill="#22d3ee" name={`Valor (${coinName})`} />
                <Bar dataKey="pago" fill="#f472b6" name={`Pago (${coinName})`} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top outcomes */}
      <div className="p-4 rounded-xl bg-card border border-border">
        <h4 className="font-semibold text-sm mb-3">Resultados mais apostados</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground border-b border-border">
              <th className="py-2">Resultado</th><th>Evento</th>
              <th className="text-right">Apostas</th><th className="text-right">Valor</th>
            </tr></thead>
            <tbody>
              {byOutcome.map((o, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-2 font-medium">{o.label}</td>
                  <td className="text-xs text-muted-foreground">{o.event}</td>
                  <td className="text-right tabular-nums">{o.apostas}</td>
                  <td className="text-right tabular-nums">{o.valor.toLocaleString('pt-BR')}</td>
                </tr>
              ))}
              {byOutcome.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">—</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top users */}
      <div className="p-4 rounded-xl bg-card border border-border">
        <h4 className="font-semibold text-sm mb-3">Top apostadores</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground border-b border-border">
              <th className="py-2 w-8"></th>
              <th>Usuário</th><th>ID</th>
              <th className="text-right">Apostas</th><th className="text-right">Valor</th>
              <th className="text-right">Ganhas</th><th className="text-right">Perdidas</th>
              <th className="text-right">Pago</th><th className="text-right">Saldo casa</th>
            </tr></thead>
            <tbody>
              {topUsers.map((u, i) => {
                const balance = u.valor - u.pago;
                const isOpen = expandedUser === `${u.email}|${u.account}`;
                return (
                  <React.Fragment key={i}>
                    <tr className="border-b border-border/50 hover:bg-muted/30 cursor-pointer" onClick={() => setExpandedUser(isOpen ? null : `${u.email}|${u.account}`)}>
                      <td className="py-2 text-center text-muted-foreground">{isOpen ? '▾' : '▸'}</td>
                      <td className="py-2">{u.name}<div className="text-xs text-muted-foreground">{u.email}</div></td>
                      <td className="text-xs">{u.account}</td>
                      <td className="text-right tabular-nums">{u.apostas}</td>
                      <td className="text-right tabular-nums">{u.valor.toLocaleString('pt-BR')}</td>
                      <td className="text-right tabular-nums text-green-500">{u.ganhas}</td>
                      <td className="text-right tabular-nums text-red-500">{u.perdidas}</td>
                      <td className="text-right tabular-nums">{u.pago.toLocaleString('pt-BR')}</td>
                      <td className={`text-right tabular-nums font-medium ${balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>{balance.toLocaleString('pt-BR')}</td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-muted/20 border-b border-border/50">
                        <td></td>
                        <td colSpan={8} className="py-3">
                          <div className="text-xs font-medium text-muted-foreground mb-2">Apostas deste usuário ({u.picks.length})</div>
                          <div className="space-y-1.5">
                            {u.picks.map((p, j) => (
                              <div key={j} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs px-2 py-1.5 rounded bg-card/50">
                                <span className="font-medium">{p.event}</span>
                                <span className="text-muted-foreground">→</span>
                                <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{p.outcome}</span>
                                <span className="tabular-nums">{p.amount.toLocaleString('pt-BR')} {coinName}</span>
                                <span className="text-muted-foreground">@ {p.odd.toFixed(2)}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  p.status === 'won' ? 'bg-green-500/15 text-green-500' :
                                  p.status === 'lost' ? 'bg-red-500/15 text-red-500' :
                                  p.status === 'refunded' ? 'bg-amber-500/15 text-amber-500' :
                                  'bg-muted text-muted-foreground'
                                }`}>{p.status}</span>
                                <span className="text-muted-foreground ml-auto">{new Date(p.createdAt).toLocaleString('pt-BR')}</span>
                                {p.status === 'pending' && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); cancelWager(p.id, u.name); }}
                                    disabled={cancelling === p.id}
                                    className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/15 text-red-500 hover:bg-red-500/25 disabled:opacity-50 flex items-center gap-1"
                                    title="Cancelar aposta e devolver coins"
                                  >
                                    {cancelling === p.id ? <Loader2 size={10} className="animate-spin" /> : <Ban size={10} />}
                                    Cancelar
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {topUsers.length === 0 && <tr><td colSpan={9} className="py-6 text-center text-muted-foreground">Nenhum apostador no período.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub?: string; accent?: 'positive' | 'negative' }) {
  return (
    <div className="p-3 rounded-xl bg-card border border-border">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">{icon}{label}</div>
      <div className={`text-xl font-bold tabular-nums ${accent === 'positive' ? 'text-green-500' : accent === 'negative' ? 'text-red-500' : ''}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

export default BetsPanel;
