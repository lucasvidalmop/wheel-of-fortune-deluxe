import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BarChart3, MessageCircle, Smartphone, CheckCircle2, X, Clock, RotateCcw, ChevronDown, ChevronUp, TrendingUp, Send, AlertTriangle, Calendar as CalendarIcon, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

const GlassCard = ({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] ${className}`} {...props}>
    {children}
  </div>
);

interface LogEntry {
  id: string;
  created_at: string;
  status: string;
  recipient_phone: string;
  recipient_name: string;
  message: string;
  error_message?: string;
  batch_id?: string;
}

interface Props {
  ownerId: string;
}

type ChannelFilter = 'all' | 'sms' | 'whatsapp' | 'email';
type PeriodFilter = '7d' | '30d' | '90d' | 'all';

export default function MessagingAnalytics({ ownerId }: Props) {
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [smsLogs, setSmsLogs] = useState<LogEntry[]>([]);
  const [waLogs, setWaLogs] = useState<LogEntry[]>([]);
  const [emailLogs, setEmailLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingFailures, setDeletingFailures] = useState(false);
  const [channel, setChannel] = useState<ChannelFilter>('all');
  const [period, setPeriod] = useState<PeriodFilter>('30d');
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const fetchAll = async () => {
    setLoading(true);
    const PAGE = 1000;

    const fetchPaginated = async (table: string, ownerFilter: 'owner_id' | 'metadata_owner' | 'none') => {
      let all: any[] = [];
      let from = 0;
      while (true) {
        let q = (supabase as any)
          .from(table)
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + PAGE - 1);
        if (ownerFilter === 'owner_id') {
          q = q.eq('owner_id', ownerId);
        }
        const { data } = await q;
        if (!data || data.length === 0) break;
        const filteredData = ownerFilter === 'metadata_owner'
          ? data.filter((row: any) => row?.metadata?.owner_id === ownerId)
          : data;
        all = all.concat(filteredData);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      return all;
    };

    const [sms, wa, emails] = await Promise.all([
      fetchPaginated('sms_message_log', 'owner_id'),
      fetchPaginated('whatsapp_message_log', 'owner_id'),
      fetchPaginated('email_send_log', 'metadata_owner'),
    ]);

    // Deduplicate emails by message_id (latest status per message wins; data is ordered DESC)
    const emailDedupMap = new Map<string, any>();
    for (const e of emails) {
      const key = e.message_id || e.id;
      if (!emailDedupMap.has(key)) emailDedupMap.set(key, e);
    }
    const emailsMapped: LogEntry[] = Array.from(emailDedupMap.values()).map((e: any) => ({
      id: e.id,
      created_at: e.created_at,
      // Treat 'sent' as success; everything else (pending/failed/dlq/suppressed/bounced) as not-sent for the success rate
      status: e.status === 'sent' ? 'sent' : 'failed',
      recipient_phone: e.recipient_email,
      recipient_name: e.template_name || '',
      message: e.template_name || '',
      error_message: e.error_message || undefined,
      batch_id: undefined,
    }));

    setSmsLogs(sms);
    setWaLogs(wa);
    setEmailLogs(emailsMapped);
    setLoading(false);
  };

  useEffect(() => { if (ownerId) fetchAll(); }, [ownerId]);

  const cutoffDate = useMemo(() => {
    if (selectedDate) return null; // selectedDate overrides period
    if (period === 'all') return null;
    const d = new Date();
    d.setDate(d.getDate() - (period === '7d' ? 7 : period === '30d' ? 30 : 90));
    return d;
  }, [period, selectedDate]);

  const filterByDate = (logs: LogEntry[]) => {
    let result = logs;
    if (selectedDate) {
      const dayStr = selectedDate.toISOString().split('T')[0];
      result = result.filter(l => new Date(l.created_at).toISOString().split('T')[0] === dayStr);
    } else if (cutoffDate) {
      result = result.filter(l => new Date(l.created_at) >= cutoffDate);
    }
    return result;
  };

  const filteredSms = useMemo(() => filterByDate(smsLogs), [smsLogs, cutoffDate, selectedDate]);
  const filteredWa = useMemo(() => filterByDate(waLogs), [waLogs, cutoffDate, selectedDate]);
  const filteredEmail = useMemo(() => filterByDate(emailLogs), [emailLogs, cutoffDate, selectedDate]);

  const showSms = channel === 'all' || channel === 'sms';
  const showWa = channel === 'all' || channel === 'whatsapp';
  const showEmail = channel === 'all' || channel === 'email';

  const allFiltered = useMemo(() => {
    const arr = [
      ...(showSms ? filteredSms.map(l => ({ ...l, _channel: 'sms' as const })) : []),
      ...(showWa ? filteredWa.map(l => ({ ...l, _channel: 'whatsapp' as const })) : []),
      ...(showEmail ? filteredEmail.map(l => ({ ...l, _channel: 'email' as const })) : []),
    ];
    arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return arr;
  }, [filteredSms, filteredWa, filteredEmail, showSms, showWa, showEmail]);

  const stats = useMemo(() => {
    const total = allFiltered.length;
    const sent = allFiltered.filter(l => l.status === 'sent').length;
    const failed = total - sent;
    const rate = total > 0 ? ((sent / total) * 100).toFixed(1) : '0';
    const smsTotal = showSms ? filteredSms.length : 0;
    const waTotal = showWa ? filteredWa.length : 0;
    const emailTotal = showEmail ? filteredEmail.length : 0;
    return { total, sent, failed, rate, smsTotal, waTotal, emailTotal };
  }, [allFiltered, filteredSms, filteredWa, filteredEmail, showSms, showWa, showEmail]);

  // Daily chart data (last 14 days or period)
  const dailyData = useMemo(() => {
    const days = period === '7d' ? 7 : period === '30d' ? 14 : period === '90d' ? 30 : 14;
    const result: { date: string; label: string; sms_sent: number; sms_fail: number; wa_sent: number; wa_fail: number; email_sent: number; email_fail: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      result.push({ date: dateStr, label, sms_sent: 0, sms_fail: 0, wa_sent: 0, wa_fail: 0, email_sent: 0, email_fail: 0 });
    }
    const dateMap = new Map(result.map((r, i) => [r.date, i]));

    if (showSms) {
      filteredSms.forEach(l => {
        const d = new Date(l.created_at).toISOString().split('T')[0];
        const idx = dateMap.get(d);
        if (idx !== undefined) {
          if (l.status === 'sent') result[idx].sms_sent++;
          else result[idx].sms_fail++;
        }
      });
    }
    if (showWa) {
      filteredWa.forEach(l => {
        const d = new Date(l.created_at).toISOString().split('T')[0];
        const idx = dateMap.get(d);
        if (idx !== undefined) {
          if (l.status === 'sent') result[idx].wa_sent++;
          else result[idx].wa_fail++;
        }
      });
    }
    if (showEmail) {
      filteredEmail.forEach(l => {
        const d = new Date(l.created_at).toISOString().split('T')[0];
        const idx = dateMap.get(d);
        if (idx !== undefined) {
          if (l.status === 'sent') result[idx].email_sent++;
          else result[idx].email_fail++;
        }
      });
    }
    return result;
  }, [filteredSms, filteredWa, filteredEmail, showSms, showWa, showEmail, period]);

  const maxDaily = useMemo(() => {
    return Math.max(1, ...dailyData.map(d => d.sms_sent + d.sms_fail + d.wa_sent + d.wa_fail + d.email_sent + d.email_fail));
  }, [dailyData]);

  // Batch grouping
  const batches = useMemo(() => {
    const batchMap = new Map<string, { channel: string; messages: (LogEntry & { _channel: string })[]; date: string; sent: number; failed: number }>();
    allFiltered.forEach(l => {
      const bid = (l as any).batch_id;
      if (!bid) return;
      if (!batchMap.has(bid)) {
        batchMap.set(bid, { channel: l._channel, messages: [], date: l.created_at, sent: 0, failed: 0 });
      }
      const b = batchMap.get(bid)!;
      b.messages.push(l);
      if (l.status === 'sent') b.sent++;
      else b.failed++;
    });
    return Array.from(batchMap.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allFiltered]);

  // Top errors
  const topErrors = useMemo(() => {
    const errMap = new Map<string, number>();
    allFiltered.filter(l => l.status !== 'sent' && l.error_message).forEach(l => {
      const key = l.error_message!.slice(0, 80);
      errMap.set(key, (errMap.get(key) || 0) + 1);
    });
    return Array.from(errMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [allFiltered]);

  const failedForSelectedDay = useMemo(() => {
    if (!selectedDate) return 0;
    return allFiltered.filter(l => l.status !== 'sent').length;
  }, [allFiltered, selectedDate]);

  const handleDeleteFailures = async () => {
    if (!selectedDate || failedForSelectedDay === 0) return;

    const readableChannel = channel === 'all'
      ? 'todos os canais'
      : channel === 'whatsapp'
        ? 'WhatsApp'
        : channel === 'sms'
          ? 'SMS'
          : 'Email';

    const confirmed = await confirm({
      title: 'Excluir histórico de falhas',
      message: `Excluir ${failedForSelectedDay} falha(s) de ${readableChannel} em ${format(selectedDate, 'dd/MM/yyyy')}?\nEssa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir falhas',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });

    if (!confirmed) return;

    setDeletingFailures(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-message-failures', {
        body: {
          date: format(selectedDate, 'yyyy-MM-dd'),
          channel,
        },
      });

      if (error || data?.error) throw new Error(data?.error || error?.message || 'Erro ao excluir falhas');

      const deletedCount = Number(data?.deleted_count || 0);
      toast.success(`${deletedCount} falha(s) excluída(s) de ${format(selectedDate, 'dd/MM/yyyy')}.`);
      await fetchAll();
    } catch (err: any) {
      toast.error(err.message || 'Não foi possível excluir as falhas.');
    } finally {
      setDeletingFailures(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {ConfirmDialog}
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {([
          { key: 'all', label: 'Todos', icon: <BarChart3 size={14} /> },
          { key: 'sms', label: 'SMS', icon: <Smartphone size={14} /> },
          { key: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle size={14} /> },
          { key: 'email', label: 'Email', icon: <Mail size={14} /> },
        ] as const).map(f => (
          <button key={f.key} onClick={() => setChannel(f.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${channel === f.key ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'bg-white/[0.06] border border-white/[0.08] text-muted-foreground hover:bg-white/[0.1]'}`}>
            {f.icon} {f.label}
          </button>
        ))}
        <div className="w-px h-6 bg-white/[0.1] mx-1 hidden sm:block" />
        {([
          { key: '7d', label: '7 dias' },
          { key: '30d', label: '30 dias' },
          { key: '90d', label: '90 dias' },
          { key: 'all', label: 'Tudo' },
        ] as const).map(p => (
          <button key={p.key} onClick={() => { setPeriod(p.key); setSelectedDate(undefined); }}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${period === p.key && !selectedDate ? 'bg-primary/15 text-primary border border-primary/20' : 'bg-white/[0.04] border border-white/[0.08] text-muted-foreground hover:bg-white/[0.08]'}`}>
            {p.label}
          </button>
        ))}
        {/* Calendar picker */}
        <Popover>
          <PopoverTrigger asChild>
            <button className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all border',
              selectedDate
                ? 'bg-primary/15 text-primary border-primary/20'
                : 'bg-white/[0.04] border-white/[0.08] text-muted-foreground hover:bg-white/[0.08]'
            )}>
              <CalendarIcon size={12} />
              {selectedDate ? format(selectedDate, 'dd/MM/yyyy') : 'Dia específico'}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => { setSelectedDate(d); }}
              disabled={(date) => date > new Date()}
              locale={ptBR}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
        {selectedDate && (
          <button onClick={() => setSelectedDate(undefined)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.08] transition" title="Limpar filtro de data">
            <X size={14} />
          </button>
        )}
        {selectedDate && failedForSelectedDay > 0 && (
          <button
            onClick={handleDeleteFailures}
            disabled={deletingFailures}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all border border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/15 disabled:opacity-50 disabled:pointer-events-none"
            title="Excluir histórico de falhas do dia selecionado"
          >
            <AlertTriangle size={12} />
            {deletingFailures ? 'Excluindo...' : `Excluir falhas (${failedForSelectedDay})`}
          </button>
        )}
        <button onClick={fetchAll} className="ml-auto p-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground hover:bg-white/[0.08] transition" title="Atualizar">
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Enviados', value: stats.total, icon: <Send size={18} />, color: 'text-blue-400', bg: 'bg-blue-400/10' },
          { label: 'Sucesso', value: stats.sent, icon: <CheckCircle2 size={18} />, color: 'text-green-400', bg: 'bg-green-400/10' },
          { label: 'Falharam', value: stats.failed, icon: <AlertTriangle size={18} />, color: 'text-red-400', bg: 'bg-red-400/10' },
          { label: 'Taxa de Sucesso', value: `${stats.rate}%`, icon: <TrendingUp size={18} />, color: 'text-amber-400', bg: 'bg-amber-400/10' },
        ].map(s => (
          <GlassCard key={s.label} className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${s.bg}`}>
                <span className={s.color}>{s.icon}</span>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold text-foreground">{s.value}</p>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Channel breakdown */}
      {channel === 'all' && (
        <div className="grid grid-cols-3 gap-3">
          <GlassCard className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10"><Smartphone size={16} className="text-blue-400" /></div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">SMS</p>
              <p className="text-lg font-bold text-foreground">{filteredSms.length}</p>
              <p className="text-[10px] text-muted-foreground">
                {filteredSms.filter(l => l.status === 'sent').length} ✓ / {filteredSms.filter(l => l.status !== 'sent').length} ✗
              </p>
            </div>
          </GlassCard>
          <GlassCard className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-green-500/10"><MessageCircle size={16} className="text-green-400" /></div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">WhatsApp</p>
              <p className="text-lg font-bold text-foreground">{filteredWa.length}</p>
              <p className="text-[10px] text-muted-foreground">
                {filteredWa.filter(l => l.status === 'sent').length} ✓ / {filteredWa.filter(l => l.status !== 'sent').length} ✗
              </p>
            </div>
          </GlassCard>
          <GlassCard className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10"><Mail size={16} className="text-purple-400" /></div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Email</p>
              <p className="text-lg font-bold text-foreground">{filteredEmail.length}</p>
              <p className="text-[10px] text-muted-foreground">
                {filteredEmail.filter(l => l.status === 'sent').length} ✓ / {filteredEmail.filter(l => l.status !== 'sent').length} ✗
              </p>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Daily bar chart */}
      <GlassCard className="p-5 space-y-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
         <CalendarIcon size={16} className="text-primary" /> Envios por Dia
         {selectedDate && <span className="text-[10px] text-primary font-normal ml-1">— {format(selectedDate, 'dd/MM/yyyy')}</span>}
        </h3>
        <div className="flex items-end gap-1 h-[140px]">
          {dailyData.map((d, i) => {
            const total = d.sms_sent + d.sms_fail + d.wa_sent + d.wa_fail + d.email_sent + d.email_fail;
            const sentH = ((d.sms_sent + d.wa_sent + d.email_sent) / maxDaily) * 100;
            const failH = ((d.sms_fail + d.wa_fail + d.email_fail) / maxDaily) * 100;
            const isSelected = selectedDate && d.date === selectedDate.toISOString().split('T')[0];
            return (
              <div key={i} className={cn(
                "flex-1 flex flex-col items-center gap-1 group relative cursor-pointer transition-all",
                isSelected && "ring-1 ring-primary/40 rounded-lg bg-primary/[0.06]"
              )} onClick={() => {
                const clickDate = new Date(d.date + 'T12:00:00');
                if (selectedDate && d.date === selectedDate.toISOString().split('T')[0]) {
                  setSelectedDate(undefined);
                } else {
                  setSelectedDate(clickDate);
                }
              }}>
                <div className="w-full flex flex-col justify-end" style={{ height: 120 }}>
                  {failH > 0 && <div className="w-full rounded-t bg-red-400/60 transition-all" style={{ height: `${failH}%`, minHeight: failH > 0 ? 2 : 0 }} />}
                  {sentH > 0 && <div className={`w-full ${failH > 0 ? '' : 'rounded-t'} rounded-b bg-primary/70 transition-all`} style={{ height: `${sentH}%`, minHeight: sentH > 0 ? 2 : 0 }} />}
                </div>
                <span className={cn("text-[8px] leading-none", isSelected ? "text-primary font-bold" : "text-muted-foreground/60")}>{d.label}</span>
                {total > 0 && (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-background border border-white/[0.12] rounded-lg px-2 py-1 text-[10px] text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                    {total} msg{total > 1 ? 's' : ''} — clique para filtrar
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-primary/70" /> Sucesso</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-red-400/60" /> Falha</span>
        </div>
      </GlassCard>

      {/* Top errors */}
      {topErrors.length > 0 && (
        <GlassCard className="p-5 space-y-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-400" /> Erros Mais Frequentes
          </h3>
          <div className="space-y-2">
            {topErrors.map(([msg, count], i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-red-400/[0.06] border border-red-400/10">
                <span className="text-xs font-bold text-red-400 w-8 text-center">{count}x</span>
                <p className="text-xs text-muted-foreground flex-1 truncate">{msg}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Batch history */}
      {batches.length > 0 && (
        <GlassCard className="p-5 space-y-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Clock size={16} className="text-primary" /> Histórico de Lotes ({batches.length})
          </h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/[0.1] [&::-webkit-scrollbar-thumb]:rounded-full">
            {batches.map(b => (
              <div key={b.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <button
                  onClick={() => setExpandedBatch(expandedBatch === b.id ? null : b.id)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-white/[0.03] transition rounded-xl"
                >
                  <div className={`p-1.5 rounded-lg ${b.channel === 'sms' ? 'bg-blue-400/10' : 'bg-green-400/10'}`}>
                    {b.channel === 'sms' ? <Smartphone size={14} className="text-blue-400" /> : <MessageCircle size={14} className="text-green-400" />}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">{b.messages.length} mensagens</span>
                      <span className="text-[10px] text-green-400">{b.sent} ✓</span>
                      {b.failed > 0 && <span className="text-[10px] text-red-400">{b.failed} ✗</span>}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(b.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })} {new Date(b.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {/* Success bar */}
                  <div className="w-16 h-2 rounded-full bg-white/[0.06] overflow-hidden flex-shrink-0">
                    <div className="h-full bg-green-400 rounded-full" style={{ width: `${(b.sent / b.messages.length) * 100}%` }} />
                  </div>
                  {expandedBatch === b.id ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                </button>
                {expandedBatch === b.id && (
                  <div className="px-3 pb-3 space-y-1.5 border-t border-white/[0.04] pt-2">
                    {b.messages.map(m => (
                      <div key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.03] transition">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${m.status === 'sent' ? 'bg-green-400' : 'bg-red-400'}`} />
                        <span className="text-[11px] text-foreground truncate flex-1">{m.recipient_name || m.recipient_phone}</span>
                        <span className="text-[10px] text-muted-foreground font-mono flex-shrink-0">{m.recipient_phone}</span>
                        {m.status !== 'sent' && m.error_message && (
                          <span className="text-[9px] text-red-400 truncate max-w-[150px]" title={m.error_message}>{m.error_message}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Recent individual messages (non-batch) */}
      <GlassCard className="p-5 space-y-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Send size={16} className="text-primary" /> Mensagens Recentes
        </h3>
        {allFiltered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Nenhuma mensagem no período selecionado.</div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto space-y-1.5 pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/[0.1] [&::-webkit-scrollbar-thumb]:rounded-full">
            {allFiltered.slice(0, 200).map(l => (
              <div key={l.id} className="flex items-start gap-2.5 p-2.5 rounded-xl border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03] transition">
                <div className={`mt-0.5 p-1 rounded-md ${l._channel === 'sms' ? 'bg-blue-400/10' : l._channel === 'email' ? 'bg-purple-400/10' : 'bg-green-400/10'}`}>
                  {l._channel === 'sms' ? <Smartphone size={10} className="text-blue-400" /> : l._channel === 'email' ? <Mail size={10} className="text-purple-400" /> : <MessageCircle size={10} className="text-green-400" />}
                </div>
                <div className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${l.status === 'sent' ? 'bg-green-400' : 'bg-red-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-foreground truncate">{l.recipient_name || 'Sem nome'}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{l.recipient_phone}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground line-clamp-1">{l.message}</p>
                  {l.error_message && <p className="text-[9px] text-red-400 mt-0.5">Erro: {l.error_message}</p>}
                </div>
                <span className="text-[9px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                  {new Date(l.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} {new Date(l.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
