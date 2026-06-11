import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Send, Search, Check, Copy, MessageCircle, Trash2, RefreshCw } from 'lucide-react';
import ForcedPrizePicker, { ForcedEntry, ForcedMode, buildForcedPrizes, buildPoolDistribution } from './ForcedPrizePicker';

interface Props {
  ownerId: string;
  cases: any[];
  cfg: any;
}

interface WheelUser {
  id: string;
  account_id: string;
  email: string;
  name: string;
  phone: string;
}

interface Grant {
  id: string;
  case_id: string;
  case_name: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_email: string;
  recipient_account_id: string;
  code: string;
  quantity: number;
  status: string;
  whatsapp_status: string;
  whatsapp_error?: string;
  created_at: string;
  redeemed_at?: string;
  redeemed_ip?: string | null;
  redeemed_user_agent?: string | null;
  redeemed_city?: string | null;
  redeemed_region?: string | null;
  redeemed_country?: string | null;
  redeemed_device?: string | null;
  redeemed_os?: string | null;
  redeemed_browser?: string | null;
}

const DEFAULT_TEMPLATE = '🎁 Olá {nome}! Você recebeu uma *{caixa}* de presente!\n\nResgate o seu código exclusivo:\n*{codigo}*\n\nOu abra direto pelo link:\n{link}';

const SendCasesTab = ({ ownerId, cases, cfg }: Props) => {
  const [users, setUsers] = useState<WheelUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [caseId, setCaseId] = useState<string>(cases[0]?.id || '');
  const [quantity, setQuantity] = useState(1);
  const [sending, setSending] = useState(false);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [grantsLoading, setGrantsLoading] = useState(false);
  const [template, setTemplate] = useState<string>(() => localStorage.getItem('luckybox_grant_template') || DEFAULT_TEMPLATE);
  const [sendWhats, setSendWhats] = useState(true);

  // Forced prize selection (send-to-users)
  const [randomMode, setRandomMode] = useState<boolean>(false);
  const [forcedMode, setForcedMode] = useState<ForcedMode>('fixed');
  const [forcedFixed, setForcedFixed] = useState<ForcedEntry | null>(null);
  const [forcedList, setForcedList] = useState<(ForcedEntry | null)[]>([]);
  const selectedCaseObj = useMemo(() => cases.find(c => c.id === caseId), [cases, caseId]);
  // Reset forced state when case changes
  useEffect(() => { setForcedFixed(null); setForcedList([]); }, [caseId]);

  // Forced prize selection (bulk codes)
  const [bulkRandomMode, setBulkRandomMode] = useState<boolean>(false);
  const [bulkForcedMode, setBulkForcedMode] = useState<ForcedMode>('fixed');
  const [bulkForcedFixed, setBulkForcedFixed] = useState<ForcedEntry | null>(null);
  const [bulkForcedList, setBulkForcedList] = useState<(ForcedEntry | null)[]>([]);
  const [bulkForcedPool, setBulkForcedPool] = useState<ForcedEntry[]>([]);

  const baseUrl = window.location.origin;

  const [evolutionApiUrl, setEvolutionApiUrl] = useState('');
  const [evolutionApiKey, setEvolutionApiKey] = useState('');
  const [evolutionInstance, setEvolutionInstance] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from('wheel_configs')
        .select('config')
        .eq('user_id', ownerId)
        .limit(1)
        .maybeSingle();
      const ds = data?.config?.dashboardSettings || {};
      setEvolutionApiUrl(ds.evolutionApiUrl || localStorage.getItem('evolution_api_url') || '');
      setEvolutionApiKey(ds.evolutionApiKey || localStorage.getItem('evolution_api_key') || '');
      setEvolutionInstance(ds.evolutionInstance || localStorage.getItem('evolution_instance') || '');
    })();
  }, [ownerId]);

  const loadUsers = async () => {
    setUsersLoading(true);
    const { data } = await (supabase as any)
      .from('wheel_users')
      .select('id,account_id,email,name,phone')
      .eq('owner_id', ownerId)
      .eq('archived', false)
      .order('updated_at', { ascending: false })
      .limit(2000);
    setUsers((data || []) as WheelUser[]);
    setUsersLoading(false);
  };

  const loadGrants = async () => {
    setGrantsLoading(true);
    const { data } = await (supabase as any)
      .from('luckybox_grants')
      .select('id,owner_id,case_id,case_name,code,status,quantity,recipient_name,recipient_email,recipient_phone,recipient_account_id,whatsapp_status,whatsapp_error,redeemed_at,created_at,forced_prizes,one_per_user,batch_id,redeemed_ip,redeemed_user_agent,redeemed_city,redeemed_region,redeemed_country,redeemed_device,redeemed_os,redeemed_browser')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(200);
    setGrants((data || []) as Grant[]);
    setGrantsLoading(false);
  };

  useEffect(() => {
    loadUsers();
    loadGrants();
  }, [ownerId]);

  useEffect(() => {
    localStorage.setItem('luckybox_grant_template', template);
  }, [template]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.account_id || '').toLowerCase().includes(q) ||
      (u.phone || '').includes(q),
    );
  }, [users, search]);

  const allSelected = filtered.length > 0 && filtered.every(u => selected.has(u.id));
  const toggleAll = () => {
    if (allSelected) {
      const next = new Set(selected);
      filtered.forEach(u => next.delete(u.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      filtered.forEach(u => next.add(u.id));
      setSelected(next);
    }
  };
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  };

  const handleSend = async () => {
    if (!caseId) { toast.error('Selecione uma caixa'); return; }
    if (selected.size === 0) { toast.error('Selecione ao menos um inscrito'); return; }
    const selectedCase = cases.find(c => c.id === caseId);
    if (!selectedCase) { toast.error('Caixa inválida'); return; }
    if (sendWhats && (!evolutionApiUrl || !evolutionApiKey || !evolutionInstance)) {
      toast.error('Configure a API do WhatsApp na aba WhatsApp antes de enviar');
      return;
    }

    const qty = Math.max(1, Number(quantity) || 1);
    const forcedPrizes = randomMode ? [] : buildForcedPrizes(forcedMode, forcedFixed, forcedList, qty);
    if (!randomMode) {
      if (forcedPrizes.length !== qty || forcedPrizes.some(e => !e || (Object.keys(e).length === 0))) {
        setSending(false);
        toast.error('Defina o prêmio garantido para todas as aberturas antes de enviar');
        return;
      }
    }
    setSending(true);
    const targets = users.filter(u => selected.has(u.id));
    let okCount = 0, waOk = 0, waErr = 0;

    for (const u of targets) {
      const code = generateCode();
      const { data: ins, error } = await (supabase as any).from('luckybox_grants').insert({
        owner_id: ownerId,
        case_id: caseId,
        case_name: selectedCase.name,
        wheel_user_id: u.id,
        recipient_name: u.name,
        recipient_phone: u.phone || '',
        recipient_email: u.email,
        recipient_account_id: u.account_id,
        code,
        quantity: qty,
        status: 'pending',
        forced_prizes: forcedPrizes,
      }).select().single();

      if (error) { console.error(error); continue; }
      okCount++;

      if (sendWhats && u.phone) {
        const link = `${baseUrl}/luckybox=${cfg.tag}`;
        const msg = template
          .replace(/\{nome\}/g, u.name || '')
          .replace(/\{caixa\}/g, selectedCase.name)
          .replace(/\{codigo\}/g, code)
          .replace(/\{quantidade\}/g, String(qty))
          .replace(/\{link\}/g, link);
        let sendError: string | null = null;
        try {
          const { error: waError } = await supabase.functions.invoke('send-whatsapp', {
            body: { recipientPhone: u.phone, message: msg, evolutionApiUrl, evolutionApiKey, evolutionInstance },
          });
          if (waError) sendError = waError.message;
        } catch (e: any) {
          sendError = e?.message || 'Erro';
        }
        if (sendError) {
          waErr++;
          await (supabase as any).from('luckybox_grants').update({
            whatsapp_status: 'error', whatsapp_error: sendError,
          }).eq('id', ins.id);
        } else {
          waOk++;
          await (supabase as any).from('luckybox_grants').update({ whatsapp_status: 'sent' }).eq('id', ins.id);
        }
      }
    }

    setSending(false);
    toast.success(`${okCount} caixa(s) enviada(s)${sendWhats ? ` · WhatsApp: ${waOk} ok / ${waErr} erro` : ''}`);
    setSelected(new Set());
    loadGrants();
  };

  // ===== Bulk standalone codes (first-come-first-served) =====
  const [bulkCount, setBulkCount] = useState(10);
  const [bulkQty, setBulkQty] = useState(1);
  const [bulkCaseId, setBulkCaseId] = useState<string>(cases[0]?.id || '');
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkOnePerUser, setBulkOnePerUser] = useState(false);
  const [bulkOnePerDay, setBulkOnePerDay] = useState(false);
  const [lastBulkCodes, setLastBulkCodes] = useState<{ code: string; prizes: string[] }[]>([]);

  const describeForcedEntry = (entry: any, caseObj: any): string => {
    if (!entry) return '—';
    if (Array.isArray(entry.case_ids) && entry.case_ids.length > 0) {
      return entry.case_ids
        .map((id: string) => cases.find(c => c.id === id)?.name || 'caixa')
        .join(' + ');
    }
    const prizes = caseObj?.prizes || [];
    const p = prizes[entry.prize_index ?? 0];
    if (!p) return `Prêmio ${(entry.prize_index ?? 0) + 1}`;
    let label = p.label || `Prêmio ${(entry.prize_index ?? 0) + 1}`;
    if (p.amount) label += ` (R$ ${Number(p.amount).toFixed(2)})`;
    if (p.scratch && Array.isArray(p.scratchPrizes) && entry.scratch_index !== undefined) {
      const sp = p.scratchPrizes[entry.scratch_index];
      if (sp) {
        label += ` · ${sp.label || `Sub ${entry.scratch_index + 1}`}`;
        if (sp.amount) label += ` (R$ ${Number(sp.amount).toFixed(2)})`;
      }
    }
    return label;
  };
  const [selectedGrants, setSelectedGrants] = useState<Set<string>>(new Set());
  const bulkSelectedCase = useMemo(() => cases.find(c => c.id === bulkCaseId), [cases, bulkCaseId]);
  useEffect(() => { setBulkForcedFixed(null); setBulkForcedList([]); setBulkForcedPool([]); }, [bulkCaseId]);

  const toggleGrant = (id: string) => {
    const next = new Set(selectedGrants);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedGrants(next);
  };
  const allGrantsSelected = grants.length > 0 && grants.every(g => selectedGrants.has(g.id));
  const toggleAllGrants = () => {
    if (allGrantsSelected) setSelectedGrants(new Set());
    else setSelectedGrants(new Set(grants.map(g => g.id)));
  };
  const deleteSelectedGrants = async () => {
    if (selectedGrants.size === 0) return;
    if (!confirm(`Excluir ${selectedGrants.size} código(s) selecionado(s)?`)) return;
    const ids = Array.from(selectedGrants);
    const { error } = await (supabase as any).from('luckybox_grants').delete().in('id', ids);
    if (error) { toast.error(error.message); return; }
    toast.success(`${ids.length} excluído(s)`);
    setSelectedGrants(new Set());
    loadGrants();
  };

  const handleGenerateBulk = async () => {
    if (!bulkCaseId) { toast.error('Selecione uma caixa'); return; }
    const selectedCase = cases.find(c => c.id === bulkCaseId);
    if (!selectedCase) { toast.error('Caixa inválida'); return; }
    const qty = Math.max(1, Number(bulkQty) || 1);

    // In pool mode, the number of codes = sum of per-prize counts (shuffled distribution)
    let perCodeForcedEntry: ForcedEntry[] | null = null;
    let totalCodes = Math.max(1, Math.min(2000, Number(bulkCount) || 0));
    if (!bulkRandomMode && bulkForcedMode === 'pool') {
      perCodeForcedEntry = buildPoolDistribution(bulkForcedPool);
      if (!perCodeForcedEntry || perCodeForcedEntry.length === 0) {
        toast.error('Adicione ao menos um prêmio possível ao sorteio');
        return;
      }
      totalCodes = perCodeForcedEntry.length;
      if (totalCodes > 2000) {
        toast.error('Limite de 2000 códigos por lote');
        return;
      }
    }

    setBulkGenerating(true);
    const batchId = (crypto as any)?.randomUUID ? (crypto as any).randomUUID() : undefined;
    const rows = Array.from({ length: totalCodes }).map((_, idx) => {
      let forcedPrizes: ForcedEntry[];
      if (bulkRandomMode) {
        forcedPrizes = [];
      } else if (bulkForcedMode === 'pool' && perCodeForcedEntry) {
        const entry = perCodeForcedEntry[idx];
        forcedPrizes = Array.from({ length: qty }).map(() => ({ ...entry }));
      } else {
        forcedPrizes = buildForcedPrizes(bulkForcedMode, bulkForcedFixed, bulkForcedList, qty, bulkForcedPool);
      }
      return {
        owner_id: ownerId,
        case_id: bulkCaseId,
        case_name: selectedCase.name,
        wheel_user_id: null,
        recipient_name: '',
        recipient_phone: '',
        recipient_email: '',
        recipient_account_id: '',
        code: generateCode(),
        quantity: qty,
        status: 'pending',
        forced_prizes: forcedPrizes,
        batch_id: batchId,
        one_per_user: bulkOnePerUser,
        one_per_day: bulkOnePerDay,
      };
    });

    // Validate that every row got valid forced prizes (skip in random mode)
    if (!bulkRandomMode) {
      const invalid = rows.find(r => r.forced_prizes.length !== qty || r.forced_prizes.some((e: any) => !e || Object.keys(e).length === 0));
      if (invalid) {
        setBulkGenerating(false);
        toast.error('Defina o prêmio garantido para todas as aberturas antes de gerar');
        return;
      }
    }

    const { data, error } = await (supabase as any).from('luckybox_grants').insert(rows).select('code, forced_prizes');
    setBulkGenerating(false);
    if (error) { toast.error(error.message); return; }
    const items = (data || []).map((r: any) => ({
      code: r.code,
      prizes: (r.forced_prizes || []).map((e: any) => describeForcedEntry(e, selectedCase)),
    }));
    setLastBulkCodes(items);
    toast.success(`${items.length} código(s) gerado(s)`);
    loadGrants();
  };

  const copyAllBulk = () => {
    if (lastBulkCodes.length === 0) return;
    navigator.clipboard.writeText(lastBulkCodes.map(c => c.code).join('\n'));
    toast.success('Códigos copiados');
  };

  const exportBulkCsv = () => {
    if (lastBulkCodes.length === 0) return;
    const link = `${baseUrl}/luckybox=${cfg.tag}`;
    const csv = ['code,link,prizes', ...lastBulkCodes.map(c => `${c.code},${link}?code=${c.code},"${c.prizes.join(' | ').replace(/"/g, '""')}"`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `codigos-${cfg.tag}-${Date.now()}.csv`; a.click();
  };

  const cancelGrant = async (id: string) => {
    if (!confirm('Cancelar este código?')) return;
    const { error } = await (supabase as any).from('luckybox_grants').update({ status: 'cancelled' }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Cancelado');
    loadGrants();
  };

  const deleteGrant = async (id: string) => {
    if (!confirm('Excluir este envio?')) return;
    const { error } = await (supabase as any).from('luckybox_grants').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    loadGrants();
  };

  const resendWhats = async (g: Grant) => {
    if (!g.recipient_phone) { toast.error('Sem telefone'); return; }
    if (!evolutionApiUrl || !evolutionApiKey || !evolutionInstance) {
      toast.error('Configure a API do WhatsApp');
      return;
    }
    const link = `${baseUrl}/luckybox=${cfg.tag}`;
    const msg = template
      .replace(/\{nome\}/g, g.recipient_name || '')
      .replace(/\{caixa\}/g, g.case_name)
      .replace(/\{codigo\}/g, g.code)
      .replace(/\{quantidade\}/g, String(g.quantity))
      .replace(/\{link\}/g, link);
    try {
      const { error } = await supabase.functions.invoke('send-whatsapp', {
        body: { recipientPhone: g.recipient_phone, message: msg, evolutionApiUrl, evolutionApiKey, evolutionInstance },
      });
      if (error) throw error;
      await (supabase as any).from('luckybox_grants').update({ whatsapp_status: 'sent', whatsapp_error: null }).eq('id', g.id);
      toast.success('WhatsApp reenviado');
      loadGrants();
    } catch (e: any) {
      toast.error('Erro: ' + (e?.message || 'desconhecido'));
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Código copiado');
  };
  const copyLink = (code: string) => {
    navigator.clipboard.writeText(`${baseUrl}/luckybox=${cfg.tag}`);
    toast.success('Link copiado');
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Send size={18} className="text-cyan-400" />
          <h3 className="font-semibold">Enviar caixas como presente</h3>
        </div>
        <p className="text-xs opacity-60">
          Selecione uma caixa, escolha os inscritos e envie. Cada inscrito recebe um código único de resgate
          (não custa tokens). O código pode ser usado uma única vez na página da Caixa Misteriosa.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1 opacity-70">Caixa</label>
            <select value={caseId} onChange={e => setCaseId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-sm">
              {cases.length === 0 && <option value="">Nenhuma caixa</option>}
              {cases.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 opacity-70">Quantidade por inscrito</label>
            <input type="number" min={1} value={quantity}
              onChange={e => setQuantity(Math.max(1, Number(e.target.value) || 1))}
              className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-sm" />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm px-3 py-2 rounded-xl border border-white/10 bg-white/5 w-full">
              <input type="checkbox" checked={sendWhats} onChange={e => setSendWhats(e.target.checked)} />
              Notificar pelo WhatsApp
            </label>
          </div>
        </div>

        {selectedCaseObj && (
          <ForcedPrizePicker
            selectedCase={selectedCaseObj}
            allCases={cases}
            openingsCount={Math.max(1, Number(quantity) || 1)}
            mode={forcedMode} setMode={setForcedMode}
            fixed={forcedFixed} setFixed={setForcedFixed}
            list={forcedList} setList={setForcedList}
          />
        )}

        {sendWhats && (
          <div>
            <label className="block text-xs font-medium mb-1 opacity-70">
              Mensagem · variáveis: <code className="px-1 bg-white/10 rounded">{'{nome}'}</code> <code className="px-1 bg-white/10 rounded">{'{caixa}'}</code> <code className="px-1 bg-white/10 rounded">{'{codigo}'}</code> <code className="px-1 bg-white/10 rounded">{'{link}'}</code> <code className="px-1 bg-white/10 rounded">{'{quantidade}'}</code>
            </label>
            <textarea value={template} onChange={e => setTemplate(e.target.value)} rows={5}
              className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-sm font-mono" />
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/5">
          <div className="text-sm">
            <span className="font-bold text-cyan-300">{selected.size}</span> inscrito(s) selecionado(s)
          </div>
          <button onClick={handleSend} disabled={sending || selected.size === 0 || !caseId}
            className="px-5 py-2.5 rounded-xl bg-cyan-500 text-black font-semibold text-sm flex items-center gap-2 disabled:opacity-40 hover:brightness-110">
            <Send size={14} /> {sending ? 'Enviando...' : `Enviar para ${selected.size}`}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, email, ID ou telefone..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-white/10 bg-white/5 text-sm" />
          </div>
          <button onClick={toggleAll} className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-xs whitespace-nowrap">
            {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
          </button>
          <button onClick={loadUsers} className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-xs">
            <RefreshCw size={12} />
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto rounded-xl border border-white/5">
          {usersLoading ? (
            <div className="p-6 text-center text-sm opacity-60 animate-pulse">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm opacity-60">Nenhum inscrito</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-black/40 backdrop-blur">
                <tr className="text-left text-xs opacity-60">
                  <th className="p-2 w-8"></th>
                  <th className="p-2">Nome</th>
                  <th className="p-2">Email</th>
                  <th className="p-2">Telefone</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id} onClick={() => toggle(u.id)}
                    className={`border-t border-white/5 cursor-pointer ${selected.has(u.id) ? 'bg-cyan-500/10' : 'hover:bg-white/5'}`}>
                    <td className="p-2">
                      <input type="checkbox" checked={selected.has(u.id)} readOnly />
                    </td>
                    <td className="p-2 truncate max-w-[160px]">{u.name}</td>
                    <td className="p-2 truncate max-w-[200px] text-xs opacity-80">{u.email}</td>
                    <td className="p-2 text-xs opacity-80">
                      {u.phone || <span className="opacity-40">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Bulk standalone codes */}
      <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/[0.04] p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Copy size={18} className="text-fuchsia-400" />
          <h3 className="font-semibold">Gerar códigos avulsos (quem pegar, pegou)</h3>
        </div>
        <p className="text-xs opacity-60">
          Gera códigos sem destinatário. Distribua como quiser (post, grupo, stream) — qualquer usuário logado na página da Caixa pode resgatar, mas cada código só funciona uma vez.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1 opacity-70">Caixa</label>
            <select value={bulkCaseId} onChange={e => setBulkCaseId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-sm">
              {cases.length === 0 && <option value="">Nenhuma caixa</option>}
              {cases.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 opacity-70">
              Qtd. de códigos {bulkForcedMode === 'pool' && <span className="text-cyan-400">(definido pelo sorteio)</span>}
            </label>
            <input type="number" min={1} max={2000} value={bulkCount}
              disabled={bulkForcedMode === 'pool'}
              onChange={e => setBulkCount(Math.max(1, Number(e.target.value) || 1))}
              className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-sm disabled:opacity-40" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 opacity-70">Caixas por código</label>
            <input type="number" min={1} value={bulkQty}
              onChange={e => setBulkQty(Math.max(1, Number(e.target.value) || 1))}
              className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-sm" />
          </div>
          <div className="flex items-end">
            <button onClick={handleGenerateBulk} disabled={bulkGenerating || !bulkCaseId}
              className="w-full px-4 py-2.5 rounded-xl bg-fuchsia-500 text-black font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40 hover:brightness-110">
              {bulkGenerating ? 'Gerando...' : 'Gerar códigos'}
            </button>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={bulkOnePerUser}
              onChange={e => setBulkOnePerUser(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-fuchsia-500"
            />
            <div>
              <div className="text-sm font-medium">Limitar a 1 código por pessoa neste lote</div>
              <div className="text-xs opacity-60 mt-0.5">
                {bulkOnePerUser
                  ? 'Cada usuário (e-mail/ID) só conseguirá resgatar 1 código deste lote. Os demais códigos do lote ficam bloqueados para essa pessoa.'
                  : 'A mesma pessoa pode resgatar vários códigos deste lote.'}
              </div>
            </div>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={bulkOnePerDay}
              onChange={e => setBulkOnePerDay(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-fuchsia-500"
            />
            <div>
              <div className="text-sm font-medium">Limitar a 1 resgate por dia por pessoa</div>
              <div className="text-xs opacity-60 mt-0.5">
                {bulkOnePerDay
                  ? 'Cada usuário só conseguirá resgatar 1 código deste lote por dia. O limite reseta todo dia às 00h (horário de Brasília).'
                  : 'Sem limite diário — a pessoa pode resgatar vários códigos deste lote no mesmo dia.'}
              </div>
            </div>
          </label>
        </div>
        {bulkSelectedCase && (
          <ForcedPrizePicker
            selectedCase={bulkSelectedCase}
            allCases={cases}
            openingsCount={Math.max(1, Number(bulkQty) || 1)}
            mode={bulkForcedMode} setMode={setBulkForcedMode}
            fixed={bulkForcedFixed} setFixed={setBulkForcedFixed}
            list={bulkForcedList} setList={setBulkForcedList}
            allowPool
            pool={bulkForcedPool} setPool={setBulkForcedPool}
            poolLabel={`Cada um dos ${Math.max(1, Number(bulkCount) || 1)} código(s) sorteia ${Math.max(1, Number(bulkQty) || 1) > 1 ? `${Math.max(1, Number(bulkQty) || 1)} prêmios` : '1 prêmio'} aleatório(s) desta lista no momento da geração:`}
          />
        )}
        {lastBulkCodes.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs opacity-70">{lastBulkCodes.length} código(s) gerado(s) agora</div>
              <div className="flex gap-2">
                <button onClick={copyAllBulk} className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-xs flex items-center gap-1">
                  <Copy size={12} /> Copiar todos
                </button>
                <button onClick={exportBulkCsv} className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-xs">
                  Exportar CSV
                </button>
              </div>
            </div>
            <div className="max-h-60 overflow-auto text-xs grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {lastBulkCodes.map(c => (
                <div key={c.code} className="px-2 py-1.5 rounded bg-fuchsia-500/10 border border-fuchsia-500/20">
                  <div className="font-mono text-fuchsia-200 font-semibold">{c.code}</div>
                  {c.prizes.length > 0 && (
                    <div className="text-[10px] opacity-80 text-fuchsia-100/80 mt-0.5">
                      🎁 {c.prizes.join(' + ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-semibold text-sm">Histórico de envios</h3>
          <div className="flex items-center gap-2">
            <button onClick={toggleAllGrants} className="text-xs px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10">
              {allGrantsSelected ? 'Desmarcar todos' : 'Selecionar todos'}
            </button>
            {selectedGrants.size > 0 && (
              <button onClick={deleteSelectedGrants} className="text-xs px-2 py-1 rounded border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 flex items-center gap-1">
                <Trash2 size={12} /> Excluir {selectedGrants.size}
              </button>
            )}
            <button onClick={loadGrants} className="text-xs opacity-70 hover:opacity-100 flex items-center gap-1">
              <RefreshCw size={12} /> Atualizar
            </button>
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {grantsLoading ? (
            <div className="p-6 text-center text-sm opacity-60 animate-pulse">Carregando...</div>
          ) : grants.length === 0 ? (
            <div className="p-6 text-center text-sm opacity-60">Nenhum envio ainda</div>
          ) : (
            <div className="space-y-2">
              {grants.map(g => (
                <div key={g.id} className={`rounded-xl border p-3 ${selectedGrants.has(g.id) ? 'border-cyan-500/40 bg-cyan-500/5' : 'border-white/10 bg-black/20'}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <input type="checkbox" checked={selectedGrants.has(g.id)} onChange={() => toggleGrant(g.id)} className="cursor-pointer" />
                    <div className="flex-1 min-w-[200px]">
                      <div className="text-sm font-semibold">{g.recipient_name || g.recipient_email || <span className="opacity-50">— avulso —</span>}</div>
                      <div className="text-xs opacity-60 truncate">{g.case_name} · qtd {g.quantity}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <code className="px-2 py-1 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 font-mono text-xs">{g.code}</code>
                      <button onClick={() => copyCode(g.code)} className="p-1.5 rounded hover:bg-white/10" title="Copiar código">
                        <Copy size={12} />
                      </button>
                      <button onClick={() => copyLink(g.code)} className="p-1.5 rounded hover:bg-white/10" title="Copiar link direto">
                        🔗
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      {g.status === 'redeemed' ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 border border-green-500/30 text-green-300 flex items-center gap-1">
                          <Check size={10} /> Resgatado
                        </span>
                      ) : g.status === 'cancelled' ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-300">Cancelado</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300">Pendente</span>
                      )}
                      {g.whatsapp_status === 'sent' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center gap-1">
                          <MessageCircle size={10} /> Enviado
                        </span>
                      )}
                      {g.whatsapp_status === 'error' && (
                        <span title={g.whatsapp_error || ''} className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-300">WA erro</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {g.recipient_phone && (
                        <button onClick={() => resendWhats(g)} className="p-1.5 rounded border border-white/10 hover:bg-white/10" title="Reenviar WhatsApp">
                          <MessageCircle size={12} />
                        </button>
                      )}
                      {g.status === 'pending' && (
                        <button onClick={() => cancelGrant(g.id)} className="p-1.5 rounded border border-amber-500/30 text-amber-300 hover:bg-amber-500/10" title="Cancelar código">
                          <X size={12} />
                        </button>
                      )}
                      <button onClick={() => deleteGrant(g.id)} className="p-1.5 rounded border border-red-500/30 text-red-300 hover:bg-red-500/10" title="Excluir">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  {g.status === 'redeemed' && (
                    <div className="mt-2 pt-2 border-t border-white/5 text-[11px] opacity-80 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1">
                      <div><span className="opacity-50">Email:</span> <span className="font-mono">{g.recipient_email || '—'}</span></div>
                      <div><span className="opacity-50">IP:</span> <span className="font-mono">{g.redeemed_ip || '—'}</span></div>
                      <div><span className="opacity-50">Local:</span> {[g.redeemed_city, g.redeemed_region, g.redeemed_country].filter(Boolean).join(', ') || '—'}</div>
                      <div><span className="opacity-50">Dispositivo:</span> {g.redeemed_device || '—'}</div>
                      <div><span className="opacity-50">OS:</span> {g.redeemed_os || '—'}</div>
                      <div><span className="opacity-50">Navegador:</span> {g.redeemed_browser || '—'}</div>
                      <div><span className="opacity-50">Data:</span> {g.redeemed_at ? new Date(g.redeemed_at).toLocaleDateString('pt-BR') : '—'}</div>
                      <div><span className="opacity-50">Hora:</span> {g.redeemed_at ? new Date(g.redeemed_at).toLocaleTimeString('pt-BR') : '—'}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const X = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
  </svg>
);

export default SendCasesTab;
