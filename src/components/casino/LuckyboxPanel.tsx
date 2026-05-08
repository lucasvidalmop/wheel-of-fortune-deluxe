import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil, Save, X, Copy, ExternalLink, Coins, Package, Upload, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { uploadAppAsset } from '@/lib/uploadAppAsset';
import SendCasesTab from './LuckyboxSendCases';
import LuckyboxHistoryTab from './LuckyboxHistoryTab';

interface ScratchPrize {
  label: string;
  amount?: number;
  image?: string;
  weight?: number;
}
interface CasePrize {
  label: string;
  amount?: number;
  image?: string;
  rarity?: string;
  weight?: number;
  count?: number;
  scratch?: boolean;
  scratchPrizes?: ScratchPrize[];
}

interface LuckyCase {
  id: string;
  owner_id: string;
  name: string;
  price_tokens: number;
  image_url: string;
  rarity: string;
  mode: 'probability' | 'pool';
  prizes: CasePrize[];
  position: number;
  is_active: boolean;
}

const RARITIES = [
  { key: 'common', label: 'Comum', color: '#9CA3AF' },
  { key: 'uncommon', label: 'Incomum', color: '#22C55E' },
  { key: 'rare', label: 'Raro', color: '#3B82F6' },
  { key: 'epic', label: 'Épico', color: '#60A5FA' },
  { key: 'legendary', label: 'Lendário', color: '#A855F7' },
  { key: 'mythic', label: 'Mítico', color: '#EF4444' },
  { key: 'supreme', label: 'Supremo', color: '#FACC15' },
  { key: 'mystery', label: 'Misterioso', color: '#EC4899' },
];

const newPrize = (): CasePrize => ({ label: 'Prêmio', amount: 0, image: '', rarity: 'common', weight: 1, count: 1 });

const LuckyboxPanel = ({ ownerId }: { ownerId: string }) => {
  const [cfg, setCfg] = useState<any>(null);
  const [cases, setCases] = useState<LuckyCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCfg, setSavingCfg] = useState(false);
  const [editingCase, setEditingCase] = useState<LuckyCase | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [collapsedPrizes, setCollapsedPrizes] = useState<Set<number>>(new Set());
  const [tab, setTab] = useState<'cases' | 'tag' | 'visual' | 'tokens' | 'send'>('cases');
  const [tokenUsers, setTokenUsers] = useState<any[]>([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [tokensSearch, setTokensSearch] = useState('');
  const [adjustModal, setAdjustModal] = useState<{ user: any; value: string } | null>(null);

  const baseUrl = window.location.origin;

  const load = async () => {
    setLoading(true);
    const [{ data: c }, { data: cs }] = await Promise.all([
      (supabase as any).from('luckybox_configs').select('*').eq('owner_id', ownerId).maybeSingle(),
      (supabase as any).from('luckybox_cases').select('*').eq('owner_id', ownerId).order('position').order('created_at'),
    ]);
    if (!c) {
      // create default
      const defaultTag = `op${Math.random().toString(36).slice(2, 8)}`;
      const { data: created } = await (supabase as any).from('luckybox_configs').insert({
        owner_id: ownerId,
        tag: defaultTag,
        is_active: true,
        tokens_symbol: 'C',
        coin_name: 'Coins',
        coin_icon_url: '',
        page_config: {},
      }).select().single();
      setCfg(created);
    } else {
      setCfg(c);
    }
    setCases((cs || []) as LuckyCase[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [ownerId]);

  const saveCfg = async (patch: any) => {
    if (!cfg) return;
    setSavingCfg(true);
    const { data, error } = await (supabase as any).from('luckybox_configs').update(patch).eq('id', cfg.id).select().single();
    if (error) toast.error(error.message);
    else { setCfg(data); toast.success('Salvo'); }
    setSavingCfg(false);
  };

  const updatePageConfig = (patch: any) => {
    saveCfg({ page_config: { ...(cfg.page_config || {}), ...patch } });
  };

  const startNewCase = () => {
    setEditingCase({
      id: '',
      owner_id: ownerId,
      name: 'Nova Caixa',
      price_tokens: 10,
      image_url: '',
      rarity: 'common',
      mode: 'probability',
      prizes: [newPrize()],
      position: cases.length,
      is_active: true,
    });
    setShowForm(true);
  };

  const editCase = (c: LuckyCase) => {
    setEditingCase({ ...c, prizes: c.prizes || [] });
    setShowForm(true);
  };

  const saveCase = async () => {
    if (!editingCase) return;
    const payload: any = {
      owner_id: ownerId,
      name: editingCase.name,
      price_tokens: Number(editingCase.price_tokens) || 0,
      image_url: editingCase.image_url || '',
      rarity: editingCase.rarity || 'common',
      mode: editingCase.mode || 'probability',
      prizes: editingCase.prizes || [],
      position: editingCase.position ?? 0,
      is_active: editingCase.is_active !== false,
    };
    if (editingCase.id) {
      // reset pool when prizes change for pool mode
      if (editingCase.mode === 'pool') payload.prize_pool = null;
      const { error } = await (supabase as any).from('luckybox_cases').update(payload).eq('id', editingCase.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Caixa atualizada');
    } else {
      const { error } = await (supabase as any).from('luckybox_cases').insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success('Caixa criada');
    }
    setShowForm(false);
    setEditingCase(null);
    load();
  };

  const deleteCase = async (id: string) => {
    if (!confirm('Excluir esta caixa?')) return;
    const { error } = await (supabase as any).from('luckybox_cases').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Excluída'); load(); }
  };

  const loadTokenUsers = async () => {
    setTokensLoading(true);
    const { data } = await (supabase as any).from('wheel_users')
      .select('id,name,email,account_id,tokens_balance')
      .eq('owner_id', ownerId)
      .order('updated_at', { ascending: false })
      .limit(200);
    setTokenUsers(data || []);
    setTokensLoading(false);
  };

  useEffect(() => { if (tab === 'tokens') loadTokenUsers(); }, [tab]);

  const adjustTokens = async (userId: string, delta: number) => {
    const { data, error } = await (supabase as any).rpc('adjust_luckybox_tokens', {
      p_owner_id: ownerId, p_wheel_user_id: userId, p_delta: delta,
    });
    if (error) { toast.error(error.message); return; }
    setTokenUsers(prev => prev.map(u => u.id === userId ? { ...u, tokens_balance: data } : u));
    const lbl = cfg?.coin_name || 'Coins';
    toast.success(delta > 0 ? `+${delta} ${lbl}` : `${delta} ${lbl}`);
  };

  const handleUploadCoinIcon = async (file: File) => {
    try {
      const res = await uploadAppAsset(file, 'luckybox');
      await saveCfg({ coin_icon_url: res.publicUrl });
    } catch (e: any) { toast.error(e.message || 'Falha no upload'); }
  };

  const handleUploadPageAsset = async (file: File, key: string) => {
    try {
      const res = await uploadAppAsset(file, 'luckybox');
      updatePageConfig({ [key]: res.publicUrl });
    } catch (e: any) { toast.error(e.message || 'Falha no upload'); }
  };

  const filteredTokenUsers = useMemo(() => {
    const q = tokensSearch.trim().toLowerCase();
    if (!q) return tokenUsers;
    return tokenUsers.filter(u =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.account_id || '').toLowerCase().includes(q));
  }, [tokenUsers, tokensSearch]);

  const handleUploadCaseImage = async (file: File) => {
    if (!editingCase) return;
    try {
      const res = await uploadAppAsset(file, 'luckybox');
      setEditingCase({ ...editingCase, image_url: res.publicUrl });
    } catch (e: any) { toast.error(e.message || 'Falha no upload'); }
  };

  const handleUploadPrizeImage = async (file: File, idx: number) => {
    if (!editingCase) return;
    try {
      const res = await uploadAppAsset(file, 'luckybox');
      const prizes = [...editingCase.prizes];
      prizes[idx] = { ...prizes[idx], image: res.publicUrl };
      setEditingCase({ ...editingCase, prizes });
    } catch (e: any) { toast.error(e.message || 'Falha no upload'); }
  };

  if (loading) return <div className="p-6 text-muted-foreground animate-pulse">Carregando...</div>;
  if (!cfg) return <div className="p-6 text-destructive">Não foi possível carregar a configuração.</div>;

  const publicUrl = `${baseUrl}/luckybox=${cfg.tag}`;
  const pc = cfg.page_config || {};

  return (
    <div className="space-y-6">
      {/* Top URL bar */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Coins size={18} className="text-cyan-400 shrink-0" />
          <span className="text-sm font-mono truncate flex-1">{publicUrl}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success('Link copiado'); }} className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm flex items-center gap-1">
            <Copy size={14} /> Copiar
          </button>
          <a href={publicUrl} target="_blank" rel="noreferrer" className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm flex items-center gap-1">
            <ExternalLink size={14} /> Abrir
          </a>
          <label className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg border border-white/10 bg-white/5">
            <input type="checkbox" checked={cfg.is_active} onChange={e => saveCfg({ is_active: e.target.checked })} />
            Ativo
          </label>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { k: 'cases', l: 'Caixas' },
          { k: 'send', l: 'Enviar caixas' },
          { k: 'history', l: 'Histórico' },
          { k: 'tag', l: 'Tag e Moeda' },
          { k: 'visual', l: 'Visual' },
          { k: 'tokens', l: 'Saldo de usuários' },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as any)} className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${tab === t.k ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'send' && <SendCasesTab ownerId={ownerId} cases={cases} cfg={cfg} />}
      {tab === 'history' && <LuckyboxHistoryTab ownerId={ownerId} />}

      {/* === CASES === */}
      {tab === 'cases' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">{cases.length} caixa(s) cadastrada(s)</div>
            <button onClick={startNewCase} className="px-4 py-2 rounded-xl bg-cyan-500 text-black font-semibold text-sm flex items-center gap-2 hover:brightness-110">
              <Plus size={16} /> Nova caixa
            </button>
          </div>

          {cases.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl text-muted-foreground">
              <Package size={40} className="mx-auto mb-2" />
              Nenhuma caixa criada. Clique em "Nova caixa" para começar.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cases.map(c => (
                 <div key={c.id} className={`rounded-2xl border bg-white/[0.04] p-4 space-y-3 transition ${c.is_active === false ? 'border-white/5 opacity-60' : 'border-white/10'}`}>
                   <div className="flex items-start gap-3">
                     <div className="w-20 h-20 rounded-xl border border-white/10 bg-black/40 flex items-center justify-center overflow-hidden shrink-0">
                       {c.image_url
                         ? <img src={c.image_url} alt={c.name} className="max-w-full max-h-full object-contain" />
                         : <Package size={32} className="text-muted-foreground" />}
                     </div>
                     <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-2">
                         <div className="font-bold truncate">{c.name}</div>
                         <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 ${c.is_active === false ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                           {c.is_active === false ? 'Off' : 'On'}
                         </span>
                       </div>
                       <div className="text-xs opacity-70 mt-1 flex items-center gap-1">
                         {cfg.coin_icon_url
                           ? <img src={cfg.coin_icon_url} alt="" className="w-3 h-3 object-contain" />
                           : <Coins size={12} />}
                         {c.price_tokens} {cfg.coin_name || 'Coins'}
                       </div>
                       <div className="text-[10px] uppercase tracking-wider mt-1 opacity-60">
                         {c.mode === 'pool' ? 'Pool fixo' : 'Probabilidade'} · {(c.prizes || []).length} prêmios
                       </div>
                     </div>
                   </div>
                   <div className="flex items-center gap-2">
                     <button
                       onClick={async () => {
                         const next = !(c.is_active !== false);
                         const { error } = await (supabase as any).from('luckybox_cases').update({ is_active: next }).eq('id', c.id);
                         if (error) { toast.error(error.message); return; }
                         setCases(prev => prev.map(x => x.id === c.id ? { ...x, is_active: next } : x));
                         toast.success(next ? 'Caixa ativada' : 'Caixa desativada');
                       }}
                       className={`px-3 py-2 rounded-lg border text-xs font-medium transition ${c.is_active === false ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20' : 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'}`}
                       title={c.is_active === false ? 'Ativar caixa' : 'Desativar caixa'}
                     >
                       {c.is_active === false ? 'Ativar' : 'Desativar'}
                     </button>
                     <button onClick={() => editCase(c)} className="flex-1 px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs flex items-center justify-center gap-1">
                       <Pencil size={12} /> Editar
                     </button>
                     <button onClick={() => deleteCase(c.id)} className="px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 text-xs">
                       <Trash2 size={12} />
                     </button>
                   </div>
                 </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === TAG === */}
      {tab === 'tag' && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 space-y-4 max-w-xl">
          <div>
            <label className="block text-xs font-medium mb-1 opacity-70">Tag (URL)</label>
            <input
              defaultValue={cfg.tag}
              onBlur={e => { const v = e.target.value.trim(); if (v && v !== cfg.tag) saveCfg({ tag: v }); }}
              className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm font-mono"
            />
            <p className="text-xs opacity-60 mt-1">A URL pública será /luckybox={cfg.tag}</p>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 opacity-70">Nome da moeda</label>
            <input
              defaultValue={cfg.coin_name || 'Coins'}
              onBlur={e => { const v = e.target.value.trim() || 'Coins'; if (v !== (cfg.coin_name || 'Coins')) saveCfg({ coin_name: v }); }}
              className="w-full max-w-xs px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm"
              placeholder="Ex: Coins, Gemas, Fichas..."
            />
            <p className="text-xs opacity-60 mt-1">Substitui o termo padrão "Coins" em toda a página.</p>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 opacity-70">
              Ícone da moeda <span className="opacity-50 font-normal">· ideal 128×128px (PNG transparente)</span>
            </label>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl border border-white/10 bg-black/40 flex items-center justify-center overflow-hidden shrink-0">
                {cfg.coin_icon_url
                  ? <img src={cfg.coin_icon_url} alt="" className="max-w-full max-h-full object-contain" />
                  : <Coins size={22} className="opacity-40" />}
              </div>
              <input
                value={cfg.coin_icon_url || ''}
                onChange={e => setCfg({ ...cfg, coin_icon_url: e.target.value })}
                onBlur={e => { const v = e.target.value.trim(); if (v !== (cfg.coin_icon_url || '')) saveCfg({ coin_icon_url: v }); }}
                placeholder="URL da imagem"
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm"
              />
              <label className="px-3 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm flex items-center gap-1 cursor-pointer hover:bg-white/10">
                <Upload size={14} /> Upload
                <input type="file" accept="image/png,image/webp,image/svg+xml,image/*" hidden onChange={e => e.target.files?.[0] && handleUploadCoinIcon(e.target.files[0])} />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* === VISUAL === */}
      {tab === 'visual' && (
        <div className="space-y-6 max-w-3xl">
          {/* Section: Page identity / SEO */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-300">Identidade da página</h3>
              <p className="text-xs opacity-60 mt-1">Nome que aparece na aba do navegador, descrição para SEO e favicon.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1 opacity-70">Título da aba (SEO)</label>
                <input
                  defaultValue={pc.seoTitle || ''}
                  onBlur={e => { const v = e.target.value; if (v !== (pc.seoTitle || '')) updatePageConfig({ seoTitle: v }); }}
                  placeholder="Ex: Luckybox · Minha Casa"
                  className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 opacity-70">Descrição (SEO)</label>
                <input
                  defaultValue={pc.seoDescription || ''}
                  onBlur={e => { const v = e.target.value; if (v !== (pc.seoDescription || '')) updatePageConfig({ seoDescription: v }); }}
                  placeholder="Descrição curta do que é a página"
                  className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium mb-1 opacity-70">
                  Favicon <span className="opacity-50 font-normal">· ideal 64×64px (PNG ou ICO)</span>
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg border border-white/10 bg-black/40 flex items-center justify-center overflow-hidden shrink-0">
                    {pc.seoFaviconUrl
                      ? <img src={pc.seoFaviconUrl} alt="" className="max-w-full max-h-full object-contain" />
                      : <span className="text-xs opacity-40">—</span>}
                  </div>
                  <input
                    defaultValue={pc.seoFaviconUrl || ''}
                    onBlur={e => { const v = e.target.value; if (v !== (pc.seoFaviconUrl || '')) updatePageConfig({ seoFaviconUrl: v }); }}
                    placeholder="URL do favicon"
                    className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm"
                  />
                  <label className="px-3 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm flex items-center gap-1 cursor-pointer hover:bg-white/10">
                    <Upload size={14} /> Upload
                    <input type="file" accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml" hidden onChange={e => e.target.files?.[0] && handleUploadPageAsset(e.target.files[0], 'seoFaviconUrl')} />
                  </label>
                </div>
              </div>
            </div>
          </section>

          {/* Section: Textos da página */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-300">Textos da página</h3>
              <p className="text-xs opacity-60 mt-1">Títulos exibidos para os usuários.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { k: 'title', l: 'Título principal', ph: 'Ex: LUCKYBOX' },
                { k: 'subtitle', l: 'Subtítulo da tela de login', ph: 'Ex: Faça login para abrir caixas' },
                { k: 'gridTitle', l: 'Título da grade de caixas', ph: 'Ex: Escolha sua caixa' },
                { k: 'gridSubtitle', l: 'Subtítulo da grade', ph: 'Texto secundário' },
                { k: 'loginBtnText', l: 'Texto do botão de login', ph: 'Ex: Entrar' },
              ].map(f => (
                <div key={f.k}>
                  <label className="block text-xs font-medium mb-1 opacity-70">{f.l}</label>
                  <input
                    defaultValue={pc[f.k] || ''}
                    onBlur={e => { const v = e.target.value; if (v !== (pc[f.k] || '')) updatePageConfig({ [f.k]: v }); }}
                    placeholder={f.ph}
                    className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Section: Imagens */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-300">Imagens</h3>
              <p className="text-xs opacity-60 mt-1">Logo da página e imagem de fundo.</p>
            </div>

            {/* Logo */}
            <div>
              <label className="block text-xs font-medium mb-1 opacity-70">
                Logo <span className="opacity-50 font-normal">· ideal 512×512px (PNG transparente)</span>
              </label>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl border border-white/10 bg-black/40 flex items-center justify-center overflow-hidden shrink-0">
                  {pc.logoUrl
                    ? <img src={pc.logoUrl} alt="" className="max-w-full max-h-full object-contain" />
                    : <span className="text-xs opacity-40">—</span>}
                </div>
                <input
                  defaultValue={pc.logoUrl || ''}
                  onBlur={e => { const v = e.target.value; if (v !== (pc.logoUrl || '')) updatePageConfig({ logoUrl: v }); }}
                  placeholder="URL do logo"
                  className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm"
                />
                <label className="px-3 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm flex items-center gap-1 cursor-pointer hover:bg-white/10">
                  <Upload size={14} /> Upload
                  <input type="file" accept="image/*" hidden onChange={e => e.target.files?.[0] && handleUploadPageAsset(e.target.files[0], 'logoUrl')} />
                </label>
              </div>
            </div>

            {/* Background image */}
            <div>
              <label className="block text-xs font-medium mb-1 opacity-70">
                Imagem de fundo <span className="opacity-50 font-normal">· ideal 1920×1080px</span>
              </label>
              <div className="flex items-center gap-3">
                <div className="w-24 h-14 rounded-xl border border-white/10 bg-black/40 overflow-hidden shrink-0">
                  {pc.bgImage && <img src={pc.bgImage} alt="" className="w-full h-full object-cover" />}
                </div>
                <input
                  defaultValue={pc.bgImage || ''}
                  onBlur={e => { const v = e.target.value; if (v !== (pc.bgImage || '')) updatePageConfig({ bgImage: v }); }}
                  placeholder="URL da imagem"
                  className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm"
                />
                <label className="px-3 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm flex items-center gap-1 cursor-pointer hover:bg-white/10">
                  <Upload size={14} /> Upload
                  <input type="file" accept="image/*" hidden onChange={e => e.target.files?.[0] && handleUploadPageAsset(e.target.files[0], 'bgImage')} />
                </label>
              </div>
              {pc.bgImage && (
                <button
                  onClick={() => updatePageConfig({ bgImage: '' })}
                  className="mt-2 text-xs text-rose-300 hover:underline"
                >Remover imagem de fundo</button>
              )}
            </div>
          </section>

          {/* Section: Cores */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-300">Cores</h3>
              <p className="text-xs opacity-60 mt-1">Paleta de cores da página. Use o seletor ou cole um valor (hex/rgb/hsl).</p>
            </div>

            <div>
              <h4 className="text-[11px] uppercase tracking-wider opacity-60 mb-2">Fundo</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { k: 'bgColor', l: 'Cor sólida' },
                  { k: 'bgGradientFrom', l: 'Gradiente — início' },
                  { k: 'bgGradientTo', l: 'Gradiente — fim' },
                ].map(f => (
                  <div key={f.k}>
                    <label className="block text-[11px] font-medium mb-1 opacity-70">{f.l}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={(pc[f.k] && /^#[0-9a-f]{6}$/i.test(pc[f.k])) ? pc[f.k] : '#000000'}
                        onChange={e => updatePageConfig({ [f.k]: e.target.value })}
                        className="w-10 h-10 rounded-lg border border-white/10 bg-transparent cursor-pointer shrink-0"
                      />
                      <input
                        defaultValue={pc[f.k] || ''}
                        onBlur={e => { const v = e.target.value; if (v !== (pc[f.k] || '')) updatePageConfig({ [f.k]: v }); }}
                        placeholder="#000000"
                        className="flex-1 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-xs font-mono"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] opacity-50 mt-2">Se a imagem de fundo estiver definida, ela tem prioridade sobre as cores.</p>
            </div>

            <div>
              <h4 className="text-[11px] uppercase tracking-wider opacity-60 mb-2">Texto e destaque</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { k: 'accentColor', l: 'Cor de destaque (botões/preço)' },
                  { k: 'titleColor', l: 'Cor do título' },
                  { k: 'subtitleColor', l: 'Cor do subtítulo' },
                  { k: 'btnTextColor', l: 'Cor do texto dos botões' },
                ].map(f => (
                  <div key={f.k}>
                    <label className="block text-[11px] font-medium mb-1 opacity-70">{f.l}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={(pc[f.k] && /^#[0-9a-f]{6}$/i.test(pc[f.k])) ? pc[f.k] : '#ffffff'}
                        onChange={e => updatePageConfig({ [f.k]: e.target.value })}
                        className="w-10 h-10 rounded-lg border border-white/10 bg-transparent cursor-pointer shrink-0"
                      />
                      <input
                        defaultValue={pc[f.k] || ''}
                        onBlur={e => { const v = e.target.value; if (v !== (pc[f.k] || '')) updatePageConfig({ [f.k]: v }); }}
                        placeholder="#ffffff"
                        className="flex-1 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-xs font-mono"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {savingCfg && <div className="text-xs opacity-60">Salvando...</div>}
        </div>
      )}

      {/* === TOKENS === */}
      {tab === 'tokens' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input value={tokensSearch} onChange={e => setTokensSearch(e.target.value)} placeholder="Buscar por nome, email ou ID" className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm" />
            <button onClick={loadTokenUsers} className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm hover:bg-white/10">Recarregar</button>
          </div>
          {tokensLoading ? (
            <div className="p-6 text-muted-foreground animate-pulse">Carregando usuários...</div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left p-3">Nome</th>
                    <th className="text-left p-3">Email</th>
                    <th className="text-left p-3">ID</th>
                    <th className="text-right p-3">Tokens</th>
                    <th className="text-right p-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTokenUsers.map(u => (
                    <tr key={u.id} className="border-t border-white/5">
                      <td className="p-3">{u.name}</td>
                      <td className="p-3 opacity-70">{u.email}</td>
                      <td className="p-3 font-mono text-xs">{u.account_id}</td>
                      <td className="p-3 text-right font-bold tabular-nums">{u.tokens_balance ?? 0} {cfg.coin_name || 'Coins'}</td>
                      <td className="p-3 text-right">
                        <div className="inline-flex gap-1">
                          {[10, 50, 100].map(v => (
                            <button key={v} onClick={() => adjustTokens(u.id, v)} className="px-2 py-1 rounded border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 text-xs hover:bg-emerald-400/20">+{v}</button>
                          ))}
                          <button onClick={() => setAdjustModal({ user: u, value: '' })} className="px-2 py-1 rounded border border-white/10 bg-white/5 text-xs hover:bg-white/10">±</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredTokenUsers.length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center opacity-60">Nenhum usuário encontrado</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* === CASE EDITOR MODAL === */}
      {showForm && editingCase && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-background border border-white/10 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 relative">
            <button onClick={() => { setShowForm(false); setEditingCase(null); }} className="absolute top-3 right-3 p-2 rounded-lg bg-white/5 hover:bg-white/10"><X size={18} /></button>
            <h3 className="text-lg font-bold">{editingCase.id ? 'Editar' : 'Nova'} caixa</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1 opacity-70">Nome</label>
                <input value={editingCase.name} onChange={e => setEditingCase({ ...editingCase, name: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 opacity-70">Preço ({cfg.coin_name || 'Coins'})</label>
                <input type="number" min={0} value={editingCase.price_tokens} onChange={e => setEditingCase({ ...editingCase, price_tokens: parseInt(e.target.value) || 0 })} className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 opacity-70">Raridade da caixa</label>
                <select value={editingCase.rarity} onChange={e => setEditingCase({ ...editingCase, rarity: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm">
                  {RARITIES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                </select>
              </div>
              <div className="md:col-span-2 rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-3 py-2 text-[11px] opacity-80 leading-relaxed">
                💡 <b>Como funciona o sorteio:</b> cada prêmio tem uma <b>Chance (%)</b>. Use <b>0</b> para o prêmio nunca sair, ou valores muito pequenos como <b>0.00000001</b> para raridade máxima. Não precisa somar 100 — o sistema normaliza automaticamente entre todos os prêmios.
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium mb-1 opacity-70">Imagem da caixa <span className="opacity-50 font-normal">· ideal 512×512px (PNG transparente)</span></label>
                <div className="flex items-center gap-3">
                  <input value={editingCase.image_url} onChange={e => setEditingCase({ ...editingCase, image_url: e.target.value })} placeholder="URL da imagem" className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm" />
                  <label className="px-3 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm flex items-center gap-1 cursor-pointer hover:bg-white/10">
                    <Upload size={14} /> Upload
                    <input type="file" accept="image/*" hidden onChange={e => e.target.files?.[0] && handleUploadCaseImage(e.target.files[0])} />
                  </label>
                </div>
                {editingCase.image_url && <img src={editingCase.image_url} alt="" className="mt-2 max-h-24 rounded-lg border border-white/10" />}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">Prêmios</h4>
                <button onClick={() => setEditingCase({ ...editingCase, prizes: [...editingCase.prizes, newPrize()] })} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs flex items-center gap-1">
                  <Plus size={12} /> Prêmio
                </button>
              </div>
              {(() => {
                const totalWeight = editingCase.prizes.reduce((s, x) => s + (Number(x.weight) || 0), 0);
                return editingCase.prizes.map((p, i) => {
                  const w = Number(p.weight) || 0;
                  const pct = totalWeight > 0 ? (w / totalWeight) * 100 : 0;
                  return (
                    <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          onClick={() => {
                            const next = new Set(collapsedPrizes);
                            if (next.has(i)) next.delete(i); else next.add(i);
                            setCollapsedPrizes(next);
                          }}
                          className="flex items-center gap-2 text-xs font-mono opacity-80 hover:opacity-100"
                          title={collapsedPrizes.has(i) ? 'Expandir' : 'Minimizar'}
                        >
                          {collapsedPrizes.has(i) ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                          <span>Prêmio #{i + 1}</span>
                          {collapsedPrizes.has(i) && (
                            <span className="opacity-70 truncate max-w-[180px]">· {p.label}</span>
                          )}
                        </button>
                        <div className="flex items-center gap-1">
                          <button
                            disabled={i === 0}
                            onClick={() => {
                              const arr = [...editingCase.prizes];
                              [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
                              setEditingCase({ ...editingCase, prizes: arr });
                            }}
                            className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Mover para cima"
                          ><ChevronUp size={14} /></button>
                          <button
                            disabled={i === editingCase.prizes.length - 1}
                            onClick={() => {
                              const arr = [...editingCase.prizes];
                              [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
                              setEditingCase({ ...editingCase, prizes: arr });
                            }}
                            className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Mover para baixo"
                          ><ChevronDown size={14} /></button>
                          <button onClick={() => setEditingCase({ ...editingCase, prizes: editingCase.prizes.filter((_, j) => j !== i) })} className="text-red-400 text-xs hover:underline ml-2">Remover</button>
                        </div>
                      </div>
                      {!collapsedPrizes.has(i) && (<>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div className="md:col-span-2">
                          <label className="block text-[10px] uppercase tracking-wider opacity-50 mb-1">Nome do prêmio</label>
                          <input value={p.label} onChange={e => { const arr = [...editingCase.prizes]; arr[i] = { ...arr[i], label: e.target.value }; setEditingCase({ ...editingCase, prizes: arr }); }} placeholder="Ex: R$ 50, Camisa, etc" className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm" />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider opacity-50 mb-1">Raridade (visual)</label>
                          <select value={p.rarity || 'common'} onChange={e => { const arr = [...editingCase.prizes]; arr[i] = { ...arr[i], rarity: e.target.value }; setEditingCase({ ...editingCase, prizes: arr }); }} className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm">
                            {RARITIES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider opacity-50 mb-1">Valor em dinheiro (R$) <span className="opacity-70">— deixe vazio se não pagar</span></label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={p.amount ? String(p.amount).replace('.', ',') : ''}
                            onChange={e => {
                              const raw = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
                              const num = raw === '' ? 0 : parseFloat(raw);
                              const arr = [...editingCase.prizes];
                              arr[i] = { ...arr[i], amount: Number.isFinite(num) ? num : 0 };
                              setEditingCase({ ...editingCase, prizes: arr });
                            }}
                            placeholder="Ex: 10 ou 10,50"
                            className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider opacity-50 mb-1">
                            Chance de sair <span className="opacity-70">— vazio = nunca · 0,00000001 = raríssimo</span>
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={p.weight ? String(p.weight).replace('.', ',') : ''}
                              onChange={e => {
                                const raw = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
                                const num = raw === '' ? 0 : parseFloat(raw);
                                const arr = [...editingCase.prizes];
                                arr[i] = { ...arr[i], weight: Number.isFinite(num) ? num : 0 };
                                setEditingCase({ ...editingCase, prizes: arr });
                              }}
                              placeholder="Ex: 50, 0,5 ou 0,00000001"
                              className="w-full px-3 py-2 pr-16 rounded-lg border border-white/10 bg-white/5 text-sm"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono opacity-60">
                              ≈ {pct < 0.0001 && pct > 0 ? pct.toExponential(2) : pct.toFixed(4)}%
                            </span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider opacity-50 mb-1">Imagem do prêmio · ideal 256×256px (PNG transparente)</label>
                        <div className="flex items-center gap-2">
                          <input value={p.image || ''} onChange={e => { const arr = [...editingCase.prizes]; arr[i] = { ...arr[i], image: e.target.value }; setEditingCase({ ...editingCase, prizes: arr }); }} placeholder="URL da imagem" className="flex-1 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm" />
                          <label className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-xs cursor-pointer hover:bg-white/10 flex items-center gap-1">
                            <Upload size={12} /> Upload
                            <input type="file" accept="image/*" hidden onChange={e => e.target.files?.[0] && handleUploadPrizeImage(e.target.files[0], i)} />
                          </label>
                        </div>
                      </div>

                      {/* Mystery scratch toggle */}
                      <div className="rounded-lg border border-purple-400/20 bg-purple-400/5 p-3 space-y-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!p.scratch}
                            onChange={e => {
                              const arr = [...editingCase.prizes];
                              arr[i] = { ...arr[i], scratch: e.target.checked, scratchPrizes: arr[i].scratchPrizes || [{ label: 'Sub-prêmio', amount: 0, image: '', weight: 1 }] };
                              setEditingCase({ ...editingCase, prizes: arr });
                            }}
                          />
                          <span className="text-sm font-semibold">🎟️ Prêmio misterioso (raspadinha)</span>
                          <span className="text-[10px] opacity-60">Ao ganhar este prêmio, abre uma raspadinha 3×3 com sub-prêmios.</span>
                        </label>
                        {p.scratch && (
                          <div className="space-y-2 pt-2 border-t border-white/5">
                            <div className="text-[10px] opacity-70 leading-relaxed">
                              Defina a <b>% de chance</b> de cada sub-prêmio. <b>0 = nunca vai sair</b>. O ideal é que a soma dê 100%.
                            </div>
                            {(() => {
                              const subs = p.scratchPrizes || [];
                              const subTotal = subs.reduce((s, x) => s + (Number(x.weight) || 0), 0);
                              return (
                                <>
                                  <div className={`text-[10px] font-mono px-2 py-1 rounded ${Math.abs(subTotal - 100) < 0.01 ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'}`}>
                                    Soma das chances: {subTotal.toFixed(2)}% {Math.abs(subTotal - 100) < 0.01 ? '✓' : '(recomendado: 100%)'}
                                  </div>
                                  {subs.map((sp, si) => {
                                    const sw = Number(sp.weight) || 0;
                                    const sPct = subTotal > 0 ? (sw / subTotal) * 100 : 0;
                                    return (
                                      <div key={si} className={`rounded-md border p-2 space-y-2 ${sw === 0 ? 'border-red-400/30 bg-red-500/5' : 'border-white/10 bg-black/20'}`}>
                                        <div className="flex items-center justify-between">
                                          <span className="text-[10px] font-mono opacity-60">
                                            Sub #{si + 1} · {sw === 0 ? <span className="text-red-300">desativado (0%)</span> : <>chance real ≈ {sPct.toFixed(2)}%</>}
                                          </span>
                                          <button
                                            onClick={() => {
                                              const arr = [...editingCase.prizes];
                                              const next = [...subs]; next.splice(si, 1);
                                              arr[i] = { ...arr[i], scratchPrizes: next };
                                              setEditingCase({ ...editingCase, prizes: arr });
                                            }}
                                            className="text-red-400 text-[10px] hover:underline"
                                          >Remover</button>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                          <div className="space-y-1">
                                            <div className="text-[9px] uppercase tracking-wide opacity-60">Nome</div>
                                            <input
                                              value={sp.label}
                                              onChange={e => {
                                                const arr = [...editingCase.prizes];
                                                const next = [...subs]; next[si] = { ...next[si], label: e.target.value };
                                                arr[i] = { ...arr[i], scratchPrizes: next };
                                                setEditingCase({ ...editingCase, prizes: arr });
                                              }}
                                              placeholder="Nome"
                                              className="w-full px-2 py-1.5 rounded border border-white/10 bg-white/5 text-xs"
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <div className="text-[9px] uppercase tracking-wide opacity-60">Valor (R$)</div>
                                            <input
                                              type="text"
                                              inputMode="decimal"
                                              value={sp.amount ? String(sp.amount).replace('.', ',') : ''}
                                              onChange={e => {
                                                const raw = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
                                                const num = raw === '' ? 0 : parseFloat(raw);
                                                const arr = [...editingCase.prizes];
                                                const next = [...subs]; next[si] = { ...next[si], amount: Number.isFinite(num) ? num : 0 };
                                                arr[i] = { ...arr[i], scratchPrizes: next };
                                                setEditingCase({ ...editingCase, prizes: arr });
                                              }}
                                              placeholder="0,00"
                                              className="w-full px-2 py-1.5 rounded border border-white/10 bg-white/5 text-xs"
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <div className="text-[9px] uppercase tracking-wide opacity-60">% Chance</div>
                                            <div className="relative">
                                              <input
                                                type="text"
                                                inputMode="decimal"
                                                value={sp.weight !== undefined && sp.weight !== null ? String(sp.weight).replace('.', ',') : ''}
                                                onChange={e => {
                                                  const raw = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
                                                  const num = raw === '' ? 0 : parseFloat(raw);
                                                  const arr = [...editingCase.prizes];
                                                  const next = [...subs]; next[si] = { ...next[si], weight: Number.isFinite(num) ? num : 0 };
                                                  arr[i] = { ...arr[i], scratchPrizes: next };
                                                  setEditingCase({ ...editingCase, prizes: arr });
                                                }}
                                                placeholder="0 = nunca"
                                                title="% de chance deste sub-prêmio. 0 = nunca sai."
                                                className="w-full px-2 py-1.5 pr-6 rounded border border-white/10 bg-white/5 text-xs"
                                              />
                                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] opacity-50 pointer-events-none">%</span>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="text-[10px] opacity-60 -mb-1">Imagem · ideal 256×256px (PNG transparente)</div>
                                        <div className="flex items-center gap-2">
                                          <input
                                            value={sp.image || ''}
                                            onChange={e => {
                                              const arr = [...editingCase.prizes];
                                              const next = [...subs]; next[si] = { ...next[si], image: e.target.value };
                                              arr[i] = { ...arr[i], scratchPrizes: next };
                                              setEditingCase({ ...editingCase, prizes: arr });
                                            }}
                                            placeholder="URL imagem (opcional)"
                                            className="flex-1 px-2 py-1.5 rounded border border-white/10 bg-white/5 text-xs"
                                          />
                                          <label className="px-2 py-1.5 rounded border border-white/10 bg-white/5 text-[10px] cursor-pointer hover:bg-white/10 flex items-center gap-1">
                                            <Upload size={10} />
                                            <input type="file" accept="image/*" hidden onChange={async e => {
                                              const file = e.target.files?.[0]; if (!file) return;
                                              try {
                                                const res = await uploadAppAsset(file, 'luckybox');
                                                const arr = [...editingCase.prizes];
                                                const next = [...subs]; next[si] = { ...next[si], image: res.publicUrl };
                                                arr[i] = { ...arr[i], scratchPrizes: next };
                                                setEditingCase({ ...editingCase, prizes: arr });
                                              } catch (err: any) { toast.error(err.message || 'Falha no upload'); }
                                            }} />
                                          </label>
                                        </div>
                                      </div>
                                    );
                                  })}
                                  <button
                                    onClick={() => {
                                      const arr = [...editingCase.prizes];
                                      arr[i] = { ...arr[i], scratchPrizes: [...subs, { label: 'Sub-prêmio', amount: 0, image: '', weight: 1 }] };
                                      setEditingCase({ ...editingCase, prizes: arr });
                                    }}
                                    className="w-full px-3 py-1.5 rounded-lg bg-purple-500/15 border border-purple-400/30 text-purple-200 text-xs hover:bg-purple-500/25 flex items-center justify-center gap-1"
                                  >
                                    <Plus size={12} /> Sub-prêmio
                                  </button>
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                      </>)}
                    </div>
                  );
                });
              })()}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button onClick={() => { setShowForm(false); setEditingCase(null); }} className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-sm hover:bg-white/10">Cancelar</button>
              <button onClick={saveCase} className="px-4 py-2 rounded-xl bg-cyan-500 text-black font-semibold text-sm hover:brightness-110 flex items-center gap-1"><Save size={14} /> Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* === ADJUST TOKENS MODAL === */}
      {adjustModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" onClick={() => setAdjustModal(null)}>
          <div onClick={e => e.stopPropagation()} className="relative w-full max-w-md rounded-2xl border border-white/10 bg-gradient-to-b from-background to-background/80 p-6 shadow-[0_8px_60px_rgba(0,0,0,0.6)]">
            <button onClick={() => setAdjustModal(null)} className="absolute top-3 right-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition">
              <X size={18} />
            </button>
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
                <Coins size={20} className="text-primary" />
              </div>
              <div>
                <h3 className="text-base font-bold">Ajustar Tokens</h3>
                <p className="text-xs opacity-70">{adjustModal.user.name} · saldo atual: <span className="font-bold">{adjustModal.user.tokens_balance ?? 0} {cfg.coin_name || 'Coins'}</span></p>
              </div>
            </div>
            <label className="block text-xs font-medium mb-2 opacity-80">Quantidade (use valores negativos para remover)</label>
            <input
              type="number"
              autoFocus
              value={adjustModal.value}
              onChange={e => setAdjustModal({ ...adjustModal, value: e.target.value })}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const n = parseInt(adjustModal.value, 10);
                  if (Number.isFinite(n) && n !== 0) { adjustTokens(adjustModal.user.id, n); setAdjustModal(null); }
                }
              }}
              placeholder="Ex: 100 ou -50"
              className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-base font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <div className="flex flex-wrap gap-2 mt-3">
              {[-100, -50, -10, 10, 50, 100, 500].map(v => (
                <button
                  key={v}
                  onClick={() => setAdjustModal({ ...adjustModal, value: String(v) })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${v > 0 ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20' : 'border-rose-400/30 bg-rose-400/10 text-rose-300 hover:bg-rose-400/20'}`}
                >
                  {v > 0 ? `+${v}` : v}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setAdjustModal(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm font-medium hover:bg-white/10 transition">
                Cancelar
              </button>
              <button
                onClick={() => {
                  const n = parseInt(adjustModal.value, 10);
                  if (!Number.isFinite(n) || n === 0) { toast.error('Informe um valor válido'); return; }
                  adjustTokens(adjustModal.user.id, n);
                  setAdjustModal(null);
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LuckyboxPanel;
