import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Copy, Power, KeyRound, Link2 } from 'lucide-react';

interface Props {
  ownerId: string;
}

interface RedemptionPage {
  id: string;
  tag: string;
  mode: 'shared' | 'unique';
  shared_code: string;
  is_active: boolean;
  referral_link_id: string;
  created_at: string;
}

const RedemptionPagesPanel = ({ ownerId }: Props) => {
  const [pages, setPages] = useState<RedemptionPage[]>([]);
  const [refLinks, setRefLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ tag: '', mode: 'shared' as 'shared' | 'unique', shared_code: '', referral_link_id: '' });
  const [codesByPage, setCodesByPage] = useState<Record<string, any[]>>({});
  const [bulkCount, setBulkCount] = useState<Record<string, number>>({});

  const load = async () => {
    setLoading(true);
    const [pagesRes, linksRes] = await Promise.all([
      (supabase as any).from('redemption_pages').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false }),
      (supabase as any).from('referral_links').select('id, label, code, spins_per_registration, is_active').eq('owner_id', ownerId).order('created_at', { ascending: false }),
    ]);
    setPages(pagesRes.data || []);
    setRefLinks(linksRes.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [ownerId]);

  const loadCodes = async (pageId: string) => {
    const { data } = await (supabase as any)
      .from('redemption_codes').select('*').eq('redemption_page_id', pageId).order('created_at', { ascending: false });
    setCodesByPage(prev => ({ ...prev, [pageId]: data || [] }));
  };

  const handleCreate = async () => {
    if (!form.tag.trim() || !form.referral_link_id) { toast.error('Tag e link de referência são obrigatórios'); return; }
    if (form.mode === 'shared' && !form.shared_code.trim()) { toast.error('Informe o código compartilhado'); return; }
    const tagClean = form.tag.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!tagClean) { toast.error('Tag inválida'); return; }
    const { error } = await (supabase as any).from('redemption_pages').insert({
      owner_id: ownerId, tag: tagClean, mode: form.mode,
      shared_code: form.mode === 'shared' ? form.shared_code.trim().toUpperCase() : '',
      referral_link_id: form.referral_link_id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Página criada!');
    setShowForm(false);
    setForm({ tag: '', mode: 'shared', shared_code: '', referral_link_id: '' });
    load();
  };

  const handleToggle = async (p: RedemptionPage) => {
    await (supabase as any).from('redemption_pages').update({ is_active: !p.is_active, updated_at: new Date().toISOString() }).eq('id', p.id);
    load();
  };

  const handleDelete = async (p: RedemptionPage) => {
    if (!confirm(`Excluir página /resgate=${p.tag}?`)) return;
    await (supabase as any).from('redemption_pages').delete().eq('id', p.id);
    toast.success('Excluída');
    load();
  };

  const handleGenerateCodes = async (p: RedemptionPage) => {
    const n = bulkCount[p.id] || 10;
    if (n <= 0 || n > 5000) { toast.error('Quantidade entre 1 e 5000'); return; }
    const rows = Array.from({ length: n }).map(() => ({
      redemption_page_id: p.id, owner_id: ownerId,
      code: Math.random().toString(36).substring(2, 10).toUpperCase(),
    }));
    const { error } = await (supabase as any).from('redemption_codes').insert(rows);
    if (error) { toast.error(error.message); return; }
    toast.success(`${n} códigos gerados`);
    loadCodes(p.id);
  };

  const handleDeleteCode = async (id: string, pageId: string) => {
    await (supabase as any).from('redemption_codes').delete().eq('id', id);
    loadCodes(pageId);
  };

  const copyUrl = (tag: string) => {
    const url = `${window.location.origin}/resgate=${tag}`;
    navigator.clipboard.writeText(url);
    toast.success('URL copiada');
  };

  const exportCodes = (p: RedemptionPage) => {
    const codes = codesByPage[p.id] || [];
    const csv = ['code,used_at,used_by_email,used_by_account_id', ...codes.map(c => `${c.code},${c.used_at || ''},${c.used_by_email || ''},${c.used_by_account_id || ''}`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `codigos-${p.tag}.csv`; a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><KeyRound size={16} /> Páginas de Resgate por Código</h3>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 text-primary border border-primary/20 text-xs font-semibold hover:bg-primary/25 transition">
          <Plus size={14} /> Nova Página
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Crie URLs como <code className="bg-white/5 px-1.5 py-0.5 rounded">/resgate=SUA_TAG</code>. O usuário precisa do código de resgate para receber os giros, seguindo a mesma lógica de distribuição do link de referência selecionado.
      </p>

      {showForm && (
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">Tag (URL)</label>
              <input value={form.tag} onChange={e => setForm({ ...form, tag: e.target.value })} placeholder="bsb" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm" />
              <p className="text-[10px] text-muted-foreground mt-1">/resgate={form.tag || 'tag'}</p>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">Link de Referência (motor de prêmios)</label>
              <select value={form.referral_link_id} onChange={e => setForm({ ...form, referral_link_id: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm">
                <option value="">— selecione —</option>
                {refLinks.map(l => (<option key={l.id} value={l.id}>{l.label} ({l.spins_per_registration} giros){!l.is_active ? ' [inativo]' : ''}</option>))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">Modo</label>
              <select value={form.mode} onChange={e => setForm({ ...form, mode: e.target.value as any })} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm">
                <option value="shared">Código compartilhado (1 código, vários usos)</option>
                <option value="unique">Códigos únicos (1 uso cada)</option>
              </select>
            </div>
            {form.mode === 'shared' && (
              <div>
                <label className="block text-xs font-medium mb-1 text-muted-foreground">Código compartilhado</label>
                <input value={form.shared_code} onChange={e => setForm({ ...form, shared_code: e.target.value.toUpperCase() })} placeholder="EX: BSB2026" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm uppercase font-mono" />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold">Criar</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg bg-white/5 text-muted-foreground text-xs">Cancelar</button>
          </div>
        </div>
      )}

      {loading && <div className="text-xs text-muted-foreground">Carregando...</div>}

      {pages.length === 0 && !loading && (
        <div className="text-center py-8 text-xs text-muted-foreground">Nenhuma página criada ainda.</div>
      )}

      {pages.map(p => {
        const link = refLinks.find(l => l.id === p.referral_link_id);
        const codes = codesByPage[p.id];
        return (
          <div key={p.id} className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono text-primary">/resgate={p.tag}</code>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${p.is_active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/5 text-muted-foreground'}`}>
                    {p.is_active ? 'ATIVA' : 'PAUSADA'}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground">
                    {p.mode === 'shared' ? 'CÓDIGO ÚNICO' : 'CÓDIGOS INDIVIDUAIS'}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Link2 size={10} /> {link?.label || '—'} ({link?.spins_per_registration || 0} giros/resgate)
                </div>
                {p.mode === 'shared' && p.shared_code && (
                  <div className="text-[11px]">Código: <span className="font-mono text-foreground">{p.shared_code}</span></div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => copyUrl(p.tag)} title="Copiar URL" className="p-1.5 rounded-md hover:bg-white/5 text-muted-foreground"><Copy size={14} /></button>
                <button onClick={() => handleToggle(p)} title="Ativar/Pausar" className="p-1.5 rounded-md hover:bg-white/5 text-muted-foreground"><Power size={14} /></button>
                <button onClick={() => handleDelete(p)} title="Excluir" className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive"><Trash2 size={14} /></button>
              </div>
            </div>

            {p.mode === 'unique' && (
              <div className="border-t border-white/5 pt-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <input type="number" min={1} max={5000} value={bulkCount[p.id] || 10} onChange={e => setBulkCount({ ...bulkCount, [p.id]: parseInt(e.target.value) || 0 })} className="w-20 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-xs" />
                  <button onClick={() => handleGenerateCodes(p)} className="px-3 py-1 rounded-md bg-primary/15 text-primary border border-primary/20 text-xs font-semibold">Gerar códigos</button>
                  <button onClick={() => loadCodes(p.id)} className="px-3 py-1 rounded-md bg-white/5 text-xs">Ver códigos</button>
                  {codes && codes.length > 0 && (<button onClick={() => exportCodes(p)} className="px-3 py-1 rounded-md bg-white/5 text-xs">Exportar CSV</button>)}
                </div>
                {codes && (
                  <div className="max-h-64 overflow-auto rounded-md bg-black/20 border border-white/5">
                    <table className="w-full text-[11px]">
                      <thead className="bg-white/5"><tr><th className="text-left px-2 py-1">Código</th><th className="text-left px-2 py-1">Usado em</th><th className="text-left px-2 py-1">Por</th><th></th></tr></thead>
                      <tbody>
                        {codes.length === 0 && (<tr><td colSpan={4} className="px-2 py-3 text-center text-muted-foreground">Nenhum código gerado.</td></tr>)}
                        {codes.map(c => (
                          <tr key={c.id} className="border-t border-white/5">
                            <td className="px-2 py-1 font-mono">{c.code}</td>
                            <td className="px-2 py-1 text-muted-foreground">{c.used_at ? new Date(c.used_at).toLocaleString('pt-BR') : '—'}</td>
                            <td className="px-2 py-1 text-muted-foreground">{c.used_by_email || '—'}</td>
                            <td className="px-2 py-1 text-right"><button onClick={() => handleDeleteCode(c.id, p.id)} className="text-destructive/70 hover:text-destructive"><Trash2 size={11} /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default RedemptionPagesPanel;
