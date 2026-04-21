import { useEffect, useMemo, useState } from 'react';
import { X, BarChart3, Users, Trophy, DollarSign, Search, Download, Mail, CalendarDays, Crown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  linkId: string;
  linkLabel: string;
  linkCode: string;
  ownerId: string;
  onClose: () => void;
}

interface Redemption {
  id: string;
  email: string;
  account_id: string;
  cpf: string;
  created_at: string;
}

interface UserStats {
  email: string;
  account_id: string;
  name: string;
  phone: string;
  cpf: string;
  redemptions: number;
  firstRedemption: string;
  lastRedemption: string;
  spinsTotal: number;
  prizesCount: number;
  totalAmountWon: number;
  totalAmountPaid: number;
}

const ReferralAnalyticsModal = ({ linkId, linkLabel, linkCode, ownerId, onClose }: Props) => {
  const [loading, setLoading] = useState(true);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [spins, setSpins] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'redemptions' | 'amount' | 'spins' | 'recent'>('redemptions');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: reds } = await (supabase as any)
          .from('referral_redemptions')
          .select('*')
          .eq('referral_link_id', linkId)
          .order('created_at', { ascending: false });
        setRedemptions(reds || []);

        const accountIds = Array.from(new Set((reds || []).map((r: any) => r.account_id).filter(Boolean)));
        const emails = Array.from(new Set((reds || []).map((r: any) => (r.email || '').toLowerCase()).filter(Boolean)));

        if (accountIds.length || emails.length) {
          // Fetch wheel users for this owner that match referral link or accounts
          const { data: wu } = await (supabase as any)
            .from('wheel_users')
            .select('id, name, email, account_id, phone, referral_link_id')
            .eq('owner_id', ownerId)
            .or(`referral_link_id.eq.${linkId},account_id.in.(${accountIds.map(id => `"${id}"`).join(',') || '""'})`);
          setUsers(wu || []);

          const { data: sp } = await (supabase as any)
            .from('spin_results')
            .select('id, account_id, user_email, prize, spun_at')
            .eq('owner_id', ownerId)
            .in('account_id', accountIds.length ? accountIds : ['__none__']);
          setSpins(sp || []);

          const { data: pp } = await (supabase as any)
            .from('prize_payments')
            .select('id, account_id, user_email, amount, status, created_at')
            .eq('owner_id', ownerId)
            .in('account_id', accountIds.length ? accountIds : ['__none__']);
          setPayments(pp || []);
        }
      } catch (err: any) {
        toast.error('Erro ao carregar analytics: ' + (err.message || ''));
      }
      setLoading(false);
    })();
  }, [linkId, ownerId]);

  const stats = useMemo<UserStats[]>(() => {
    const map = new Map<string, UserStats>();
    for (const r of redemptions) {
      const key = (r.email || '').toLowerCase() + '|' + r.account_id;
      const u = users.find(x => x.account_id === r.account_id && x.email?.toLowerCase() === r.email?.toLowerCase())
        || users.find(x => x.account_id === r.account_id)
        || users.find(x => x.email?.toLowerCase() === r.email?.toLowerCase());
      const userSpins = spins.filter(s => s.account_id === r.account_id || s.user_email?.toLowerCase() === r.email?.toLowerCase());
      const userPayments = payments.filter(p => p.account_id === r.account_id || p.user_email?.toLowerCase() === r.email?.toLowerCase());
      const totalAmount = userPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const paidAmount = userPayments.filter(p => p.status === 'paid').reduce((sum, p) => sum + Number(p.amount || 0), 0);

      const existing = map.get(key);
      if (existing) {
        existing.redemptions += 1;
        existing.firstRedemption = r.created_at < existing.firstRedemption ? r.created_at : existing.firstRedemption;
        existing.lastRedemption = r.created_at > existing.lastRedemption ? r.created_at : existing.lastRedemption;
      } else {
        map.set(key, {
          email: r.email,
          account_id: r.account_id,
          name: u?.name || '—',
          phone: u?.phone || '',
          cpf: r.cpf || '',
          redemptions: 1,
          firstRedemption: r.created_at,
          lastRedemption: r.created_at,
          spinsTotal: userSpins.length,
          prizesCount: userPayments.length,
          totalAmountWon: totalAmount,
          totalAmountPaid: paidAmount,
        });
      }
    }
    const arr = Array.from(map.values());
    arr.sort((a, b) => {
      if (sortBy === 'redemptions') return b.redemptions - a.redemptions;
      if (sortBy === 'amount') return b.totalAmountWon - a.totalAmountWon;
      if (sortBy === 'spins') return b.spinsTotal - a.spinsTotal;
      return b.lastRedemption.localeCompare(a.lastRedemption);
    });
    return arr;
  }, [redemptions, users, spins, payments, sortBy]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stats;
    return stats.filter(s =>
      s.email.toLowerCase().includes(q)
      || s.account_id.toLowerCase().includes(q)
      || s.name.toLowerCase().includes(q)
      || s.cpf.includes(q)
      || s.phone.includes(q)
    );
  }, [stats, search]);

  const totals = useMemo(() => {
    const uniqueUsers = stats.length;
    const totalRedemptions = redemptions.length;
    const totalSpins = stats.reduce((s, u) => s + u.spinsTotal, 0);
    const totalWon = stats.reduce((s, u) => s + u.totalAmountWon, 0);
    const totalPaid = stats.reduce((s, u) => s + u.totalAmountPaid, 0);
    return { uniqueUsers, totalRedemptions, totalSpins, totalWon, totalPaid };
  }, [stats, redemptions]);

  const exportCsv = () => {
    const header = ['Posição', 'Nome', 'Email', 'ID', 'Telefone', 'CPF', 'Resgates', 'Giros usados', 'Prêmios', 'Total ganho (R$)', 'Total pago (R$)', 'Primeiro resgate', 'Último resgate'];
    const rows = filtered.map((u, i) => [
      i + 1, u.name, u.email, u.account_id, u.phone, u.cpf,
      u.redemptions, u.spinsTotal, u.prizesCount,
      u.totalAmountWon.toFixed(2), u.totalAmountPaid.toFixed(2),
      new Date(u.firstRedemption).toLocaleString('pt-BR'),
      new Date(u.lastRedemption).toLocaleString('pt-BR'),
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-ref-${linkCode}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado!');
  };

  const fmtCurrency = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const summaryCards = [
    { label: 'Usuários únicos', value: totals.uniqueUsers, icon: <Users size={18} />, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Total resgates', value: totals.totalRedemptions, icon: <CalendarDays size={18} />, color: 'text-sky-400', bg: 'bg-sky-400/10' },
    { label: 'Giros usados', value: totals.totalSpins, icon: <Trophy size={18} />, color: 'text-amber-400', bg: 'bg-amber-400/10' },
    { label: 'Total ganho', value: fmtCurrency(totals.totalWon), icon: <DollarSign size={18} />, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { label: 'Total pago', value: fmtCurrency(totals.totalPaid), icon: <DollarSign size={18} />, color: 'text-violet-400', bg: 'bg-violet-400/10' },
  ];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-background border border-white/[0.08] rounded-2xl shadow-2xl overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-xl border-b border-white/[0.06] p-5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <BarChart3 size={16} className="text-primary" />
              Analytics do Link
            </h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">{linkLabel || 'Link de Referência'} • <span className="font-mono text-primary">{linkCode}</span></p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 text-primary text-xs hover:bg-primary/25 transition">
              <Download size={14} /> CSV
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {summaryCards.map(c => (
              <div key={c.label} className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-4 space-y-2">
                <div className={`inline-flex p-2 rounded-lg ${c.bg} ${c.color}`}>{c.icon}</div>
                <div>
                  <p className="text-[10px] text-muted-foreground">{c.label}</p>
                  <p className="text-lg font-bold text-foreground">{c.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Top 3 podium */}
          {stats.length > 0 && (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Crown size={16} className="text-amber-400" />
                <h3 className="text-xs font-bold text-foreground">Top 3 que mais resgataram</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {stats.slice(0, 3).map((u, i) => {
                  const colors = ['border-amber-400/40 bg-amber-400/5', 'border-slate-300/40 bg-slate-300/5', 'border-orange-500/40 bg-orange-500/5'];
                  const medals = ['🥇', '🥈', '🥉'];
                  return (
                    <div key={u.account_id + u.email} className={`rounded-lg border p-3 ${colors[i]}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">{medals[i]}</span>
                        <p className="text-sm font-bold text-foreground truncate">{u.name}</p>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">ID: {u.account_id}</p>
                      <div className="flex items-center gap-3 mt-2 text-[10px]">
                        <span className="text-primary font-bold">{u.redemptions} resgates</span>
                        <span className="text-amber-400">{u.spinsTotal} giros</span>
                        <span className="text-emerald-400">{fmtCurrency(u.totalAmountWon)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar nome, email, ID, CPF, telefone..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-sm focus:outline-none focus:border-primary/50"
              />
            </div>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-sm focus:outline-none focus:border-primary/50"
            >
              <option value="redemptions">Mais resgates</option>
              <option value="amount">Maior valor ganho</option>
              <option value="spins">Mais giros</option>
              <option value="recent">Mais recente</option>
            </select>
          </div>

          {/* Table */}
          {loading ? (
            <div className="text-center py-12 text-sm text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Mail size={36} className="text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum resgate registrado ainda</p>
            </div>
          ) : (
            <div className="rounded-xl border border-white/[0.08] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-white/[0.04] border-b border-white/[0.06]">
                    <tr className="text-left text-muted-foreground">
                      <th className="px-3 py-2 font-semibold">#</th>
                      <th className="px-3 py-2 font-semibold">Nome</th>
                      <th className="px-3 py-2 font-semibold">Email</th>
                      <th className="px-3 py-2 font-semibold">ID</th>
                      <th className="px-3 py-2 font-semibold text-center">Resgates</th>
                      <th className="px-3 py-2 font-semibold text-center">Giros</th>
                      <th className="px-3 py-2 font-semibold text-center">Prêmios</th>
                      <th className="px-3 py-2 font-semibold text-right">Ganho</th>
                      <th className="px-3 py-2 font-semibold text-right">Pago</th>
                      <th className="px-3 py-2 font-semibold">Último</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((u, i) => (
                      <tr key={u.account_id + u.email} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition">
                        <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-2 text-foreground font-medium">{u.name}</td>
                        <td className="px-3 py-2 text-muted-foreground truncate max-w-[180px]">{u.email}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">{u.account_id}</td>
                        <td className="px-3 py-2 text-center"><span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary font-semibold">{u.redemptions}</span></td>
                        <td className="px-3 py-2 text-center text-amber-400">{u.spinsTotal}</td>
                        <td className="px-3 py-2 text-center text-foreground">{u.prizesCount}</td>
                        <td className="px-3 py-2 text-right text-emerald-400 font-semibold">{fmtCurrency(u.totalAmountWon)}</td>
                        <td className="px-3 py-2 text-right text-violet-400 font-semibold">{fmtCurrency(u.totalAmountPaid)}</td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{new Date(u.lastRedemption).toLocaleString('pt-BR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReferralAnalyticsModal;
