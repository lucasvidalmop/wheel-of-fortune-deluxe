import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { History, RefreshCw, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  ownerId: string;
}

interface Opening {
  id: string;
  created_at: string;
  case_name: string;
  user_name: string;
  user_email: string;
  account_id: string;
  prize_label: string;
  prize_image: string;
  prize_amount: number;
  price_tokens: number;
}

const LuckyboxHistoryTab = ({ ownerId }: Props) => {
  const [items, setItems] = useState<Opening[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('luckybox_openings')
      .select('id,created_at,case_name,user_name,user_email,account_id,prize_label,prize_image,prize_amount,price_tokens')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(1000);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setItems((data || []) as Opening[]);
  };

  useEffect(() => { load(); }, [ownerId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i =>
      (i.case_name || '').toLowerCase().includes(q) ||
      (i.user_name || '').toLowerCase().includes(q) ||
      (i.user_email || '').toLowerCase().includes(q) ||
      (i.account_id || '').toLowerCase().includes(q) ||
      (i.prize_label || '').toLowerCase().includes(q),
    );
  }, [items, search]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };
  const allSelected = filtered.length > 0 && filtered.every(i => selected.has(i.id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map(i => i.id)));
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Excluir ${selected.size} registro(s) do histórico?`)) return;
    const ids = Array.from(selected);
    const { error } = await (supabase as any).from('luckybox_openings').delete().in('id', ids);
    if (error) { toast.error(error.message); return; }
    toast.success(`${ids.length} excluído(s)`);
    setSelected(new Set());
    load();
  };

  const totalAmount = filtered.reduce((s, i) => s + (Number(i.prize_amount) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <History size={18} className="text-cyan-400" />
          <h3 className="font-semibold">Histórico de aberturas de caixas</h3>
        </div>
        <p className="text-xs opacity-60">
          Todas as caixas abertas pelos usuários (resgates de códigos e compras com tokens).
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por caixa, usuário, prêmio..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-white/10 bg-white/5 text-sm" />
          </div>
          <button onClick={toggleAll} className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-xs whitespace-nowrap">
            {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
          </button>
          {selected.size > 0 && (
            <button onClick={deleteSelected} className="px-3 py-2 rounded-xl border border-red-500/40 bg-red-500/10 text-red-300 text-xs flex items-center gap-1 hover:bg-red-500/20">
              <Trash2 size={12} /> Excluir {selected.size}
            </button>
          )}
          <button onClick={load} className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-xs flex items-center gap-1">
            <RefreshCw size={12} /> Atualizar
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
          <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/10">
            <div className="opacity-60">Total de aberturas</div>
            <div className="font-bold text-cyan-300 text-base">{filtered.length}</div>
          </div>
          <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/10">
            <div className="opacity-60">Soma dos prêmios</div>
            <div className="font-bold text-emerald-300 text-base">R$ {totalAmount.toFixed(2)}</div>
          </div>
          <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/10">
            <div className="opacity-60">Selecionados</div>
            <div className="font-bold text-fuchsia-300 text-base">{selected.size}</div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
        {loading ? (
          <div className="p-6 text-center text-sm opacity-60 animate-pulse">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-sm opacity-60">Nenhuma abertura registrada</div>
        ) : (
          <div className="max-h-[600px] overflow-y-auto space-y-2">
            {filtered.map(i => (
              <div key={i.id} className={`rounded-xl border p-3 flex flex-wrap items-center gap-3 ${selected.has(i.id) ? 'border-cyan-500/40 bg-cyan-500/5' : 'border-white/10 bg-black/20'}`}>
                <input type="checkbox" checked={selected.has(i.id)} onChange={() => toggle(i.id)} className="cursor-pointer" />
                {i.prize_image ? (
                  <img src={i.prize_image} alt="" className="w-10 h-10 rounded-lg object-cover border border-white/10" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10" />
                )}
                <div className="flex-1 min-w-[200px]">
                  <div className="text-sm font-semibold truncate">{i.user_name || i.user_email || <span className="opacity-50">— anônimo —</span>}</div>
                  <div className="text-xs opacity-60 truncate">{i.case_name} · {i.account_id || '—'}</div>
                </div>
                <div className="text-xs">
                  <div className="opacity-60">Prêmio</div>
                  <div className="font-semibold text-cyan-200">{i.prize_label}</div>
                </div>
                {Number(i.prize_amount) > 0 && (
                  <div className="text-xs">
                    <div className="opacity-60">Valor</div>
                    <div className="font-bold text-emerald-300">R$ {Number(i.prize_amount).toFixed(2)}</div>
                  </div>
                )}
                <div className="text-xs opacity-60 whitespace-nowrap">
                  {new Date(i.created_at).toLocaleString('pt-BR')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LuckyboxHistoryTab;
