import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil, Save, X, Copy, ExternalLink, Coins, Package, Upload } from 'lucide-react';
import { uploadAppAsset } from '@/lib/uploadAppAsset';

interface CasePrize {
  label: string;
  amount?: number;
  image?: string;
  rarity?: string;
  weight?: number;
  count?: number;
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
  { key: 'epic', label: 'Épico', color: '#A855F7' },
  { key: 'legendary', label: 'Lendário', color: '#F59E0B' },
  { key: 'mythic', label: 'Mítico', color: '#EF4444' },
  { key: 'supreme', label: 'Supremo', color: '#22D3EE' },
];

const newPrize = (): CasePrize => ({ label: 'Prêmio', amount: 0, image: '', rarity: 'common', weight: 1, count: 1 });

const LuckyboxPanel = ({ ownerId }: { ownerId: string }) => {
  const [cfg, setCfg] = useState<any>(null);
  const [cases, setCases] = useState<LuckyCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCfg, setSavingCfg] = useState(false);
  const [editingCase, setEditingCase] = useState<LuckyCase | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState<'cases' | 'tag' | 'visual' | 'tokens'>('cases');
  const [tokenUsers, setTokenUsers] = useState<any[]>([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [tokensSearch, setTokensSearch] = useState('');

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
        tokens_symbol: 'T',
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
    toast.success(delta > 0 ? `+${delta} T` : `${delta} T`);
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
          { k: 'tag', l: 'Tag e Tokens' },
          { k: 'visual', l: 'Visual' },
          { k: 'tokens', l: 'Saldo de usuários' },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as any)} className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${tab === t.k ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
            {t.l}
          </button>
        ))}
      </div>

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
                <div key={c.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-20 h-20 rounded-xl border border-white/10 bg-black/40 flex items-center justify-center overflow-hidden shrink-0">
                      {c.image_url
                        ? <img src={c.image_url} alt={c.name} className="max-w-full max-h-full object-contain" />
                        : <Package size={32} className="text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold truncate">{c.name}</div>
                      <div className="text-xs opacity-70 mt-1 flex items-center gap-1">
                        <Coins size={12} /> {c.price_tokens} {cfg.tokens_symbol}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider mt-1 opacity-60">
                        {c.mode === 'pool' ? 'Pool fixo' : 'Probabilidade'} · {(c.prizes || []).length} prêmios
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
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
            <label className="block text-xs font-medium mb-1 opacity-70">Símbolo dos Tokens</label>
            <input
              defaultValue={cfg.tokens_symbol}
              onBlur={e => { const v = e.target.value.trim() || 'T'; if (v !== cfg.tokens_symbol) saveCfg({ tokens_symbol: v }); }}
              className="w-32 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm font-mono"
            />
          </div>
        </div>
      )}

      {/* === VISUAL === */}
      {tab === 'visual' && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 space-y-4 max-w-2xl">
          {[
            { k: 'title', l: 'Título', type: 'text' },
            { k: 'subtitle', l: 'Subtítulo (login)', type: 'text' },
            { k: 'gridTitle', l: 'Título da grade de caixas', type: 'text' },
            { k: 'gridSubtitle', l: 'Subtítulo da grade', type: 'text' },
            { k: 'loginBtnText', l: 'Texto do botão de login', type: 'text' },
            { k: 'logoUrl', l: 'URL do logo', type: 'text' },
            { k: 'bgImage', l: 'URL da imagem de fundo', type: 'text' },
            { k: 'bgColor', l: 'Cor de fundo (CSS)', type: 'text' },
            { k: 'bgGradientFrom', l: 'Gradiente — cor inicial', type: 'color' },
            { k: 'bgGradientTo', l: 'Gradiente — cor final', type: 'color' },
            { k: 'accentColor', l: 'Cor de destaque', type: 'color' },
            { k: 'titleColor', l: 'Cor do título', type: 'color' },
            { k: 'subtitleColor', l: 'Cor do subtítulo', type: 'color' },
            { k: 'btnTextColor', l: 'Cor do texto dos botões', type: 'color' },
            { k: 'seoTitle', l: 'SEO — Título da aba', type: 'text' },
            { k: 'seoDescription', l: 'SEO — Descrição', type: 'text' },
            { k: 'seoFaviconUrl', l: 'SEO — URL do favicon', type: 'text' },
          ].map(f => (
            <div key={f.k}>
              <label className="block text-xs font-medium mb-1 opacity-70">{f.l}</label>
              <input
                type={f.type}
                defaultValue={pc[f.k] || ''}
                onBlur={e => { const v = e.target.value; if (v !== (pc[f.k] || '')) updatePageConfig({ [f.k]: v }); }}
                className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm"
              />
            </div>
          ))}
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
                      <td className="p-3 text-right font-bold tabular-nums">{u.tokens_balance ?? 0} {cfg.tokens_symbol}</td>
                      <td className="p-3 text-right">
                        <div className="inline-flex gap-1">
                          {[10, 50, 100].map(v => (
                            <button key={v} onClick={() => adjustTokens(u.id, v)} className="px-2 py-1 rounded border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 text-xs hover:bg-emerald-400/20">+{v}</button>
                          ))}
                          <button onClick={() => {
                            const v = prompt('Quantidade de tokens (use - para remover):', '0');
                            if (v == null) return;
                            const n = parseInt(v, 10); if (!Number.isFinite(n) || n === 0) return;
                            adjustTokens(u.id, n);
                          }} className="px-2 py-1 rounded border border-white/10 bg-white/5 text-xs hover:bg-white/10">±</button>
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
                <label className="block text-xs font-medium mb-1 opacity-70">Preço ({cfg.tokens_symbol})</label>
                <input type="number" min={0} value={editingCase.price_tokens} onChange={e => setEditingCase({ ...editingCase, price_tokens: parseInt(e.target.value) || 0 })} className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 opacity-70">Raridade da caixa</label>
                <select value={editingCase.rarity} onChange={e => setEditingCase({ ...editingCase, rarity: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm">
                  {RARITIES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 opacity-70">Modo de sorteio</label>
                <select value={editingCase.mode} onChange={e => setEditingCase({ ...editingCase, mode: e.target.value as any })} className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm">
                  <option value="probability">Probabilidade (peso)</option>
                  <option value="pool">Pool fixo (estoque garantido)</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium mb-1 opacity-70">Imagem da caixa</label>
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
              {editingCase.prizes.map((p, i) => (
                <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono opacity-60">#{i}</span>
                    <button onClick={() => setEditingCase({ ...editingCase, prizes: editingCase.prizes.filter((_, j) => j !== i) })} className="text-red-400 text-xs hover:underline">Remover</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <input value={p.label} onChange={e => { const arr = [...editingCase.prizes]; arr[i] = { ...arr[i], label: e.target.value }; setEditingCase({ ...editingCase, prizes: arr }); }} placeholder="Nome do prêmio" className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm md:col-span-2" />
                    <input type="number" step="0.01" value={p.amount ?? 0} onChange={e => { const arr = [...editingCase.prizes]; arr[i] = { ...arr[i], amount: parseFloat(e.target.value) || 0 }; setEditingCase({ ...editingCase, prizes: arr }); }} placeholder="R$ (se for $)" className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm" />
                    <select value={p.rarity || 'common'} onChange={e => { const arr = [...editingCase.prizes]; arr[i] = { ...arr[i], rarity: e.target.value }; setEditingCase({ ...editingCase, prizes: arr }); }} className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm">
                      {RARITIES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="md:col-span-2 flex items-center gap-2">
                      <input value={p.image || ''} onChange={e => { const arr = [...editingCase.prizes]; arr[i] = { ...arr[i], image: e.target.value }; setEditingCase({ ...editingCase, prizes: arr }); }} placeholder="URL da imagem" className="flex-1 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm" />
                      <label className="px-2 py-2 rounded-lg border border-white/10 bg-white/5 text-xs cursor-pointer hover:bg-white/10">
                        <Upload size={12} />
                        <input type="file" accept="image/*" hidden onChange={e => e.target.files?.[0] && handleUploadPrizeImage(e.target.files[0], i)} />
                      </label>
                    </div>
                    {editingCase.mode === 'probability' ? (
                      <input type="number" step="0.01" min={0} value={p.weight ?? 1} onChange={e => { const arr = [...editingCase.prizes]; arr[i] = { ...arr[i], weight: parseFloat(e.target.value) || 0 }; setEditingCase({ ...editingCase, prizes: arr }); }} placeholder="Peso (probabilidade)" className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm" />
                    ) : (
                      <input type="number" min={0} value={p.count ?? 0} onChange={e => { const arr = [...editingCase.prizes]; arr[i] = { ...arr[i], count: parseInt(e.target.value) || 0 }; setEditingCase({ ...editingCase, prizes: arr }); }} placeholder="Quantidade no pool" className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button onClick={() => { setShowForm(false); setEditingCase(null); }} className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-sm hover:bg-white/10">Cancelar</button>
              <button onClick={saveCase} className="px-4 py-2 rounded-xl bg-cyan-500 text-black font-semibold text-sm hover:brightness-110 flex items-center gap-1"><Save size={14} /> Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LuckyboxPanel;
