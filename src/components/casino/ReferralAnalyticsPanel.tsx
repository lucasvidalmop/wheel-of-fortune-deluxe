import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Users, Trophy, DollarSign, Search, Download, Mail, CalendarDays, Crown, Link2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  ownerId: string;
  /** When provided, scopes analytics to a single referral link. Otherwise, aggregates ALL links (incl. deleted). */
  linkId?: string;
  /** Optional label shown in header (e.g. link name). */
  scopeLabel?: string;
  /** Code of the gorjeta link to EXCLUDE from analytics (general view only). */
  gorjetaRef?: string;
  /** When 'gorjeta', INVERTS the filter and shows ONLY gorjeta redemptions. */
  mode?: 'general' | 'gorjeta';
}

interface Redemption {
  id: string;
  email: string;
  account_id: string;
  cpf: string;
  created_at: string;
  referral_link_id: string | null;
  link_code: string | null;
  link_label: string | null;
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
  links: Set<string>;
}

const ReferralAnalyticsPanel = ({ ownerId, linkId, scopeLabel, gorjetaRef, mode = 'general' }: Props) => {
  const isGorjetaMode = mode === 'gorjeta';
  const [loading, setLoading] = useState(true);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [spins, setSpins] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [linkFilter, setLinkFilter] = useState<string>('__all__');
  const [sortBy, setSortBy] = useState<'redemptions' | 'amount' | 'spins' | 'recent'>('redemptions');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const normalize = (value?: string | null) => (value || '').trim().toLowerCase();

        const { data: links } = await (supabase as any)
          .from('referral_links')
          .select('id, code, label')
          .eq('owner_id', ownerId);

        const linkMap = new Map<string, { code: string; label: string }>();
        const nonGorjetaLinkIds = new Set<string>();
        const nonGorjetaByNormalized = new Map<string, { id: string; code: string; label: string }>();
        const gorjetaLinkIds = new Set<string>();
        const gorjetaTokens = new Set<string>();

        (links || []).forEach((l: any) => {
          linkMap.set(l.id, { code: l.code, label: l.label });
          const isGorjeta = normalize(l.label) === 'gorjeta' || (gorjetaRef && normalize(l.code) === normalize(gorjetaRef));
          if (isGorjeta) {
            gorjetaLinkIds.add(l.id);
            gorjetaTokens.add(normalize(l.code));
            gorjetaTokens.add(normalize(l.label));
          } else {
            nonGorjetaLinkIds.add(l.id);
            nonGorjetaByNormalized.set(normalize(l.code), { id: l.id, code: l.code, label: l.label });
            nonGorjetaByNormalized.set(normalize(l.label), { id: l.id, code: l.code, label: l.label });
          }
        });

        let q = (supabase as any)
          .from('referral_redemptions')
          .select('*')
          .order('created_at', { ascending: false });
        if (linkId) q = q.eq('referral_link_id', linkId);
        else q = q.eq('owner_id', ownerId);
        const { data: reds } = await q;

        const { data: allUsers } = await (supabase as any)
          .from('wheel_users')
          .select('id, name, email, account_id, phone, referral_link_id, user_type, created_at, responsible')
          .eq('owner_id', ownerId)
          .eq('user_type', 'Real');

        const covered = new Set<string>();
        (reds || []).forEach((r: any) => {
          covered.add(`${r.account_id}|${normalize(r.email)}`);
        });

        const synthetic: any[] = [];
        (allUsers || []).forEach((u: any) => {
          const key = `${u.account_id}|${normalize(u.email)}`;
          if (covered.has(key)) return;

          const responsible = normalize(u.responsible);
          const directLink = u.referral_link_id ? linkMap.get(u.referral_link_id) : null;
          const matchedHistoricalLink = nonGorjetaByNormalized.get(responsible);

          const isDirectNonGorjeta = !!(u.referral_link_id && nonGorjetaLinkIds.has(u.referral_link_id));
          const isHistoricalNonGorjeta = !!(
            !u.referral_link_id &&
            responsible &&
            !gorjetaTokens.has(responsible)
          );
          const isDirectGorjeta = !!(u.referral_link_id && gorjetaLinkIds.has(u.referral_link_id));
          const isHistoricalGorjeta = !!(
            !u.referral_link_id &&
            responsible &&
            gorjetaTokens.has(responsible)
          );

          if (isGorjetaMode) {
            if (!isDirectGorjeta && !isHistoricalGorjeta) return;
          } else if (!isDirectNonGorjeta && !isHistoricalNonGorjeta) return;

          const syntheticLinkId = isDirectNonGorjeta ? u.referral_link_id : matchedHistoricalLink?.id || null;
          const syntheticCode = directLink?.code || matchedHistoricalLink?.code || u.responsible?.trim() || null;
          const syntheticLabel = directLink?.label || matchedHistoricalLink?.label || 'Link antigo';

          if (linkId && syntheticLinkId !== linkId) return;

          synthetic.push({
            id: `synth-${u.id}`,
            email: u.email,
            account_id: u.account_id,
            cpf: '',
            created_at: u.created_at || new Date().toISOString(),
            referral_link_id: syntheticLinkId,
            link_code: syntheticCode,
            link_label: syntheticLabel,
          });
        });

        const allReds = [...(reds || []), ...synthetic];
        setRedemptions(allReds);

        const accountIds = Array.from(new Set(allReds.map((r: any) => r.account_id).filter(Boolean)));

        setUsers(allUsers || []);

        if (accountIds.length) {
          const { data: sp } = await (supabase as any)
            .from('spin_results')
            .select('id, account_id, user_email, prize, spun_at')
            .eq('owner_id', ownerId)
            .in('account_id', accountIds);
          setSpins(sp || []);

          const { data: pp } = await (supabase as any)
            .from('prize_payments')
            .select('id, account_id, user_email, amount, status, created_at')
            .eq('owner_id', ownerId)
            .in('account_id', accountIds);
          setPayments(pp || []);
        } else {
          setSpins([]); setPayments([]);
        }
      } catch (err: any) {
        toast.error('Erro ao carregar analytics: ' + (err.message || ''));
      }
      setLoading(false);
    })();
  }, [linkId, ownerId, gorjetaRef, isGorjetaMode]);

  const linkOptions = useMemo(() => {
    const map = new Map<string, { value: string; label: string; count: number }>();
    for (const r of redemptions) {
      const code = r.link_code || (r.referral_link_id ? r.referral_link_id.slice(0, 6) : '_deleted_');
      const label = r.link_label || (r.referral_link_id ? '(sem nome)' : '(link excluído)');
      const value = code;
      const existing = map.get(value);
      if (existing) existing.count += 1;
      else map.set(value, { value, label: `${label} • ${code}`, count: 1 });
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [redemptions]);

  const scopedRedemptions = useMemo(() => {
    let base = redemptions;
    if (!linkId) {
      const g = (gorjetaRef || '').toLowerCase();
      base = base.filter(r => {
        const code = (r.link_code || '').toLowerCase();
        const label = (r.link_label || '').toLowerCase();
        const isGorjetaRow = (g && code === g) || label === 'gorjeta';
        return isGorjetaMode ? isGorjetaRow : !isGorjetaRow;
      });
    }
    if (linkId || linkFilter === '__all__') return base;
    return base.filter(r => (r.link_code || '_deleted_') === linkFilter);
  }, [redemptions, linkFilter, linkId, gorjetaRef, isGorjetaMode]);

  const stats = useMemo<UserStats[]>(() => {
    const map = new Map<string, UserStats>();
    for (const r of scopedRedemptions) {
      const key = (r.email || '').toLowerCase() + '|' + r.account_id;
      const u = users.find(x => x.account_id === r.account_id && x.email?.toLowerCase() === r.email?.toLowerCase())
        || users.find(x => x.account_id === r.account_id)
        || users.find(x => x.email?.toLowerCase() === r.email?.toLowerCase());

      if (!u || u.user_type !== 'Real') continue;

      const userPayments = payments.filter(p => p.account_id === r.account_id || p.user_email?.toLowerCase() === r.email?.toLowerCase());
      const paidPayments = userPayments.filter(p => p.status === 'paid');

      const existing = map.get(key);
      if (existing) {
        existing.redemptions += 1;
        if (r.created_at < existing.firstRedemption) existing.firstRedemption = r.created_at;
        if (r.created_at > existing.lastRedemption) existing.lastRedemption = r.created_at;
        if (r.link_code) existing.links.add(r.link_code);
      } else {
        const userSpins = spins.filter(s => s.account_id === r.account_id || s.user_email?.toLowerCase() === r.email?.toLowerCase());
        const totalAmount = userPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        const paidAmount = paidPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
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
          links: new Set(r.link_code ? [r.link_code] : []),
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
  }, [scopedRedemptions, users, spins, payments, sortBy]);

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
    const totalRedemptions = scopedRedemptions.length;
    const totalSpins = stats.reduce((s, u) => s + u.spinsTotal, 0);
    const totalWon = stats.reduce((s, u) => s + u.totalAmountWon, 0);
    const totalPaid = stats.reduce((s, u) => s + u.totalAmountPaid, 0);
    return { uniqueUsers, totalRedemptions, totalSpins, totalWon, totalPaid };
  }, [stats, scopedRedemptions]);

  const linkBreakdown = useMemo(() => {
    if (linkId) return [];
    const map = new Map<string, { code: string; label: string; count: number; deleted: boolean }>();
    for (const r of scopedRedemptions) {
      const code = r.link_code || '_deleted_';
      const label = r.link_label || (r.referral_link_id ? '(sem nome)' : '(link excluído)');
      const existing = map.get(code);
      if (existing) existing.count += 1;
      else map.set(code, { code, label, count: 1, deleted: !r.referral_link_id });
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [scopedRedemptions, linkId]);

  const exportCsv = () => {
    const header = ['Posição', 'Nome', 'Email', 'ID', 'Telefone', 'CPF', 'Resgates', 'Giros usados', 'Prêmios', 'Total ganho (R$)', 'Total pago (R$)', 'Links', 'Primeiro resgate', 'Último resgate'];
    const rows = filtered.map((u, i) => [
      i + 1, u.name, u.email, u.account_id, u.phone, u.cpf,
      u.redemptions, u.spinsTotal, u.prizesCount,
      u.totalAmountWon.toFixed(2), u.totalAmountPaid.toFixed(2),
      Array.from(u.links).join(' | '),
      new Date(u.firstRedemption).toLocaleString('pt-BR'),
      new Date(u.lastRedemption).toLocaleString('pt-BR'),
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-referencias-${new Date().toISOString().split('T')[0]}.csv`;
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <BarChart3 size={16} className="text-primary" />
            {linkId ? 'Analytics do Link' : (isGorjetaMode ? 'Analytics de Inscrições (Gorjeta)' : 'Analytics Geral de Referências')}
          </h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {scopeLabel || (linkId ? 'Link de referência' : (isGorjetaMode ? 'Inscrições realizadas via página de gorjeta' : 'Inclui histórico de todos os links — mesmo os já excluídos'))}
          </p>
        </div>
        <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 text-primary text-xs hover:bg-primary/25 transition">
          <Download size={14} /> Exportar CSV
        </button>
      </div>

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

      {/* Link breakdown (general view only) */}
      {!linkId && linkBreakdown.length > 0 && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Link2 size={16} className="text-sky-400" />
            <h3 className="text-xs font-bold text-foreground">Resgates por link</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {linkBreakdown.map(l => (
              <button
                key={l.code}
                onClick={() => setLinkFilter(linkFilter === l.code ? '__all__' : l.code)}
                className={`text-left rounded-lg border p-2 transition ${
                  linkFilter === l.code
                    ? 'border-primary/40 bg-primary/10'
                    : 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-foreground truncate">{l.label}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-bold shrink-0">{l.count}</span>
                </div>
                <p className="text-[10px] text-muted-foreground font-mono truncate">
                  {l.code === '_deleted_' ? '— sem código —' : l.code}
                  {l.deleted && <span className="ml-1 text-red-400/70">(excluído)</span>}
                </p>
              </button>
            ))}
          </div>
          {linkFilter !== '__all__' && (
            <button onClick={() => setLinkFilter('__all__')} className="mt-2 text-[10px] text-muted-foreground hover:text-foreground transition">
              ✕ Limpar filtro de link
            </button>
          )}
        </div>
      )}

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
                  <div className="flex items-center gap-3 mt-2 text-[10px] flex-wrap">
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
                  {!linkId && <th className="px-3 py-2 font-semibold">Links</th>}
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
                    {!linkId && (
                      <td className="px-3 py-2 text-muted-foreground font-mono text-[10px] truncate max-w-[140px]">
                        {Array.from(u.links).join(', ') || '—'}
                      </td>
                    )}
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
  );
};

export default ReferralAnalyticsPanel;
