import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Save, Loader2, Copy, Check, X, Edit2, Play, Ban, Trophy, Download, BarChart3, TrendingUp, TrendingDown, Users, Coins } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { uploadAppAsset } from '@/lib/uploadAppAsset';
import { betIsoToDateTimeLocal, dateTimeLocalToBetIso, formatBetDateTime } from '@/lib/betsDateTime';

interface BetsPanelProps { ownerId: string }

interface BetsConfig {
  id: string; owner_id: string; tag: string; is_active: boolean;
  page_config: any; coin_name: string; coin_icon_url: string;
}
interface BetEvent {
  id: string; bets_config_id: string; title: string; subtitle: string; category: string;
  image_url: string; starts_at: string | null; closes_at: string | null;
  status: 'open'|'closed'|'resolved'|'cancelled';
  payout_mode: 'coins'|'case'; payout_case_id: string | null; payout_case_qty_per_unit: number;
  min_bet: number; max_bet: number; max_bets_per_user: number; position: number; winning_outcome_id: string | null;
}
interface BetOutcome { id: string; event_id: string; owner_id: string; label: string; odd: number; position: number; is_winner: boolean }
interface LbCase { id: string; name: string; image_url: string }

const emptyOutcome = () => ({ id: '', label: '', odd: 1.5, position: 0 });

const BetsPanel = ({ ownerId }: BetsPanelProps) => {
  const [tab, setTab] = useState<'config'|'events'|'wagers'|'analytics'>('config');
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<BetsConfig | null>(null);
  const [events, setEvents] = useState<BetEvent[]>([]);
  const [outcomes, setOutcomes] = useState<BetOutcome[]>([]);
  const [cases, setCases] = useState<LbCase[]>([]);
  const [wagers, setWagers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // event modal state
  const [editingEvent, setEditingEvent] = useState<Partial<BetEvent> | null>(null);
  const [editingOutcomes, setEditingOutcomes] = useState<Array<{ id?: string; label: string; odd: number }>>([]);
  const [resolvingEvent, setResolvingEvent] = useState<BetEvent | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [{ data: cfg }, { data: cs }] = await Promise.all([
        supabase.from('bets_configs').select('*').eq('owner_id', ownerId).maybeSingle(),
        supabase.from('luckybox_cases').select('id, name, image_url').eq('owner_id', ownerId).order('position'),
      ]);
      setConfig(cfg as any);
      setCases((cs || []) as LbCase[]);
      if (cfg?.id) {
        const [{ data: evs }, { data: outs }] = await Promise.all([
          supabase.from('bet_events').select('*').eq('bets_config_id', cfg.id).order('created_at', { ascending: false }),
          supabase.from('bet_outcomes').select('*').eq('owner_id', ownerId).order('position'),
        ]);
        setEvents((evs || []) as BetEvent[]);
        setOutcomes((outs || []) as BetOutcome[]);
      }
    } catch (e: any) {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, [ownerId]);

  const createConfig = async () => {
    const tag = prompt('Defina a tag pública (ex.: apostas-1):')?.trim();
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

  const openNewEvent = () => {
    setEditingEvent({
      title: '', subtitle: '', category: '', image_url: '',
      starts_at: null, closes_at: null, status: 'open',
      payout_mode: 'coins', payout_case_id: null, payout_case_qty_per_unit: 1,
      min_bet: 10, max_bet: 0, max_bets_per_user: 1,
    });
    setEditingOutcomes([{ label: 'Casa', odd: 1.8 }, { label: 'Empate', odd: 3.2 }, { label: 'Visitante', odd: 4.0 }]);
  };

  const openEditEvent = (ev: BetEvent) => {
    setEditingEvent({ ...ev });
    const evOuts = outcomes.filter(o => o.event_id === ev.id).sort((a, b) => a.position - b.position);
    setEditingOutcomes(evOuts.map(o => ({ id: o.id, label: o.label, odd: Number(o.odd) })));
  };

  const saveEvent = async () => {
    if (!config || !editingEvent) return;
    if (!editingEvent.title?.trim()) { toast.error('Título obrigatório'); return; }
    if (editingOutcomes.length < 2) { toast.error('Mínimo 2 resultados'); return; }
    if (editingOutcomes.some(o => !o.label.trim() || !(o.odd > 1))) { toast.error('Cada resultado precisa de label e odd > 1'); return; }
    setSaving(true);
    try {
      let eventId = (editingEvent as BetEvent).id;
      const payload = {
        owner_id: ownerId,
        bets_config_id: config.id,
        title: editingEvent.title.trim(),
        subtitle: editingEvent.subtitle?.trim() || '',
        category: editingEvent.category?.trim() || '',
        image_url: editingEvent.image_url || '',
        starts_at: editingEvent.starts_at || null,
        closes_at: editingEvent.closes_at || null,
        status: editingEvent.status || 'open',
        payout_mode: editingEvent.payout_mode || 'coins',
        payout_case_id: editingEvent.payout_mode === 'case' ? (editingEvent.payout_case_id || null) : null,
        payout_case_qty_per_unit: editingEvent.payout_case_qty_per_unit ?? 1,
        min_bet: editingEvent.min_bet ?? 1,
        max_bet: editingEvent.max_bet ?? 0,
        max_bets_per_user: editingEvent.max_bets_per_user ?? 0,
        position: editingEvent.position ?? 0,
      };
      if (eventId) {
        const { error } = await supabase.from('bet_events').update(payload).eq('id', eventId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('bet_events').insert(payload).select().single();
        if (error) throw error;
        eventId = (data as any).id;
      }
      // Sync outcomes: delete missing, upsert provided
      const existing = outcomes.filter(o => o.event_id === eventId);
      const keepIds = editingOutcomes.filter(o => o.id).map(o => o.id);
      const toDelete = existing.filter(o => !keepIds.includes(o.id));
      if (toDelete.length) {
        await supabase.from('bet_outcomes').delete().in('id', toDelete.map(o => o.id));
      }
      for (let i = 0; i < editingOutcomes.length; i++) {
        const o = editingOutcomes[i];
        if (o.id) {
          await supabase.from('bet_outcomes').update({ label: o.label, odd: o.odd, position: i }).eq('id', o.id);
        } else {
          await supabase.from('bet_outcomes').insert({ event_id: eventId, owner_id: ownerId, label: o.label, odd: o.odd, position: i });
        }
      }
      toast.success('Evento salvo!');
      setEditingEvent(null);
      setEditingOutcomes([]);
      loadAll();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = async (ev: BetEvent) => {
    if (!confirm(`Excluir evento "${ev.title}"? Apostas associadas também serão removidas.`)) return;
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

  const resolveEvent = async (winningOutcomeId: string) => {
    if (!resolvingEvent) return;
    setSaving(true);
    const { data, error } = await supabase.rpc('resolve_bet_event', {
      p_event_id: resolvingEvent.id, p_winning_outcome_id: winningOutcomeId,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    if ((data as any)?.success) {
      toast.success(`Resolvido: ${(data as any).processed} apostas processadas`);
      setResolvingEvent(null);
      loadAll();
    } else {
      toast.error(`Falha: ${(data as any)?.error || 'erro'}`);
    }
  };

  const cancelEvent = async (ev: BetEvent) => {
    if (!confirm(`Cancelar evento "${ev.title}"? Apostas pendentes serão devolvidas.`)) return;
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

  const loadWagers = async () => {
    if (!config) return;
    const { data } = await supabase
      .from('bet_wagers')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(500);
    setWagers(data || []);
  };

  useEffect(() => { if (tab === 'wagers') loadWagers(); }, [tab, config?.id]);

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
      <div className="flex flex-wrap gap-1 border-b border-border">
        {([
          ['config', 'Configuração'],
          ['events', `Eventos (${events.length})`],
          ['wagers', 'Apostas'],
        ] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${tab === k ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {l}
          </button>
        ))}
      </div>

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
          <button onClick={openNewEvent}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium flex items-center gap-2">
            <Plus size={16} /> Novo evento
          </button>
          {events.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">Nenhum evento criado ainda.</p>}
          {events.map(ev => {
            const evOuts = outcomes.filter(o => o.event_id === ev.id).sort((a, b) => a.position - b.position);
            const c = ev.payout_case_id ? cases.find(x => x.id === ev.payout_case_id) : null;
            return (
              <div key={ev.id} className="p-4 rounded-xl bg-card border border-border">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    {ev.category && <div className="text-xs uppercase text-primary mb-0.5">{ev.category}</div>}
                    <div className="font-bold">{ev.title}</div>
                    {ev.subtitle && <div className="text-sm text-muted-foreground">{ev.subtitle}</div>}
                    <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <span className="px-2 py-0.5 rounded-full bg-muted">{ev.status}</span>
                      <span>{ev.payout_mode === 'case' ? `Caixa: ${c?.name || '?'} (${ev.payout_case_qty_per_unit}×)` : `Coins × odd`}</span>
                      {ev.closes_at && <span>Encerra: {formatBetDateTime(ev.closes_at)}</span>}
                      <span>Min: {ev.min_bet}{ev.max_bet > 0 ? ` · Max: ${ev.max_bet}` : ''}{ev.max_bets_per_user > 0 ? ` · ${ev.max_bets_per_user}/usuário` : ''}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEditEvent(ev)} title="Editar" className="p-1.5 rounded hover:bg-muted"><Edit2 size={14} /></button>
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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {evOuts.map(o => (
                    <div key={o.id} className={`px-3 py-2 rounded-lg text-sm ${o.is_winner ? 'bg-green-500/20 border border-green-500' : 'bg-muted'}`}>
                      <div className="text-xs text-muted-foreground">{o.label}</div>
                      <div className="font-bold tabular-nums">{Number(o.odd).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'wagers' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground border-b border-border">
              <th className="py-2">Data</th><th>Usuário</th><th>Evento</th><th>Resultado</th>
              <th className="text-right">Valor</th><th className="text-right">Odd</th><th>Status</th><th className="text-right">Retorno</th>
            </tr></thead>
            <tbody>
              {wagers.map(w => {
                const ev = events.find(e => e.id === w.event_id);
                const out = outcomes.find(o => o.id === w.outcome_id);
                return (
                  <tr key={w.id} className="border-b border-border/50">
                    <td className="py-2 text-xs">{new Date(w.created_at).toLocaleString('pt-BR')}</td>
                    <td>{w.user_name || w.user_email}<div className="text-xs text-muted-foreground">{w.account_id}</div></td>
                    <td className="text-xs">{ev?.title || w.event_id.slice(0, 8)}</td>
                    <td className="text-xs">{out?.label || '?'}</td>
                    <td className="text-right tabular-nums">{w.amount_coins}</td>
                    <td className="text-right tabular-nums">{Number(w.odd_snapshot).toFixed(2)}</td>
                    <td><span className="text-xs px-2 py-0.5 rounded bg-muted">{w.status}</span></td>
                    <td className="text-right tabular-nums text-xs">{w.payout_mode === 'case' ? '— caixa' : (w.payout_coins || '—')}</td>
                  </tr>
                );
              })}
              {wagers.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">Nenhuma aposta ainda.</td></tr>}
            </tbody>
          </table>
        </div>
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
              <Field label="Categoria" value={editingEvent.category || ''} onChange={v => setEditingEvent(p => ({ ...p!, category: v }))} />
              <Field label="Subtítulo" value={editingEvent.subtitle || ''} onChange={v => setEditingEvent(p => ({ ...p!, subtitle: v }))} />
              <ImageUploadField label="Imagem do evento" hint="800×450 px (16:9)" value={editingEvent.image_url || ''} onChange={v => setEditingEvent(p => ({ ...p!, image_url: v }))}
                upload={async f => { const r = await uploadAppAsset(f, 'bet-event'); setEditingEvent(p => ({ ...p!, image_url: r.publicUrl })); }} />
              <Field label="Encerra apostas em" type="datetime-local"
                value={betIsoToDateTimeLocal(editingEvent.closes_at)}
                onChange={v => setEditingEvent(p => ({ ...p!, closes_at: v ? dateTimeLocalToBetIso(v) : null }))} />
              <NumberField label="Aposta mínima" value={editingEvent.min_bet ?? null}
                onChange={n => setEditingEvent(p => ({ ...p!, min_bet: n ?? 1 }))} />
              <NumberField label="Aposta máxima (0=sem)" value={editingEvent.max_bet ?? null}
                onChange={n => setEditingEvent(p => ({ ...p!, max_bet: n ?? 0 }))} />
              <NumberField label="Apostas por usuário (0=ilimitado)" value={editingEvent.max_bets_per_user ?? null}
                onChange={n => setEditingEvent(p => ({ ...p!, max_bets_per_user: n == null ? 0 : Math.max(0, Math.floor(n)) }))} />
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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Resultados (mín. 2)</label>
                <button onClick={() => setEditingOutcomes(o => [...o, { label: '', odd: 2 }])}
                  className="px-2 py-1 text-xs rounded bg-muted hover:bg-muted/80 flex items-center gap-1"><Plus size={12} /> Adicionar</button>
              </div>
              {editingOutcomes.map((o, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input value={o.label} placeholder="Resultado (ex.: Casa)"
                    onChange={e => setEditingOutcomes(arr => arr.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                    className="flex-1 px-3 py-1.5 rounded bg-muted text-sm" />
                  <NumberField value={o.odd}
                    onChange={n => setEditingOutcomes(arr => arr.map((x, j) => j === i ? { ...x, odd: n ?? 0 } : x))}
                    className="w-24 px-3 py-1.5 rounded bg-muted text-sm tabular-nums" />
                  <button onClick={() => setEditingOutcomes(arr => arr.filter((_, j) => j !== i))} className="p-1.5 rounded hover:bg-muted text-red-500"><Trash2 size={14} /></button>
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
      {resolvingEvent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setResolvingEvent(null)}>
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg">Resolver "{resolvingEvent.title}"</h3>
            <p className="text-sm text-muted-foreground">Selecione o resultado vencedor. Esta ação é definitiva e processa pagamentos.</p>
            <div className="space-y-2">
              {outcomes.filter(o => o.event_id === resolvingEvent.id).sort((a, b) => a.position - b.position).map(o => (
                <button key={o.id} onClick={() => resolveEvent(o.id)} disabled={saving}
                  className="w-full px-4 py-3 rounded-lg bg-muted hover:bg-primary hover:text-primary-foreground transition flex items-center justify-between disabled:opacity-50">
                  <span className="font-medium">{o.label}</span>
                  <span className="tabular-nums">{Number(o.odd).toFixed(2)}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setResolvingEvent(null)} className="w-full px-4 py-2 rounded bg-muted">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
};

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

export default BetsPanel;
