import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EventRow {
  id: string;
  tag: string;
  name: string;
  description: string;
  rules: string;
  cover_url: string;
  status: string;
  opens_at: string | null;
  closes_at: string | null;
  max_participants: number | null;
  require_pix: boolean;
  is_active: boolean;
  theme: Record<string, string>;
}

const STATUSES = [
  { value: 'draft', label: 'Rascunho' },
  { value: 'published', label: 'Publicado' },
  { value: 'live', label: 'Ao vivo' },
  { value: 'finished', label: 'Encerrado' },
];

const emptyEvent = (): Partial<EventRow> => ({
  tag: '',
  name: '',
  description: '',
  rules: '',
  cover_url: '',
  status: 'draft',
  opens_at: null,
  closes_at: null,
  max_participants: null,
  require_pix: true,
  is_active: true,
  theme: { accent: '#22c55e', bg: '#07090d' },
});

const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const GorjetaEventHost = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<Partial<EventRow> | null>(null);
  const [saving, setSaving] = useState(false);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) loadEvents(s.user.id); else setLoading(false);
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) loadEvents(s.user.id); else setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadEvents = async (uid: string) => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('gorjeta_events')
      .select('*')
      .eq('owner_id', uid)
      .order('created_at', { ascending: false });
    const rows: EventRow[] = data || [];
    setEvents(rows);

    const map: Record<string, number> = {};
    await Promise.all(
      rows.map(async (ev) => {
        const { count } = await (supabase as any)
          .from('gorjeta_event_participants')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', ev.id);
        map[ev.id] = count ?? 0;
      }),
    );
    setCounts(map);
    setLoading(false);
  };

  const signIn = async () => {
    setLoginLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
    setLoginLoading(false);
    if (error) toast.error('E-mail ou senha inválidos');
  };

  const save = async () => {
    if (!editing || !session?.user?.id) return;
    const tag = (editing.tag || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!tag) { toast.error('Informe o link (tag) do evento.'); return; }
    if (!(editing.name || '').trim()) { toast.error('Informe o nome do evento.'); return; }

    setSaving(true);
    const payload = {
      owner_id: session.user.id,
      tag,
      name: editing.name,
      description: editing.description || '',
      rules: editing.rules || '',
      cover_url: editing.cover_url || '',
      status: editing.status || 'draft',
      opens_at: editing.opens_at || null,
      closes_at: editing.closes_at || null,
      max_participants: editing.max_participants || null,
      require_pix: editing.require_pix ?? true,
      is_active: editing.is_active ?? true,
      theme: editing.theme || { accent: '#22c55e', bg: '#07090d' },
    };

    const res = editing.id
      ? await (supabase as any).from('gorjeta_events').update(payload).eq('id', editing.id)
      : await (supabase as any).from('gorjeta_events').insert(payload);

    setSaving(false);
    if (res.error) {
      toast.error(res.error.message.includes('duplicate') ? 'Já existe um evento com esse link.' : 'Erro ao salvar.');
      return;
    }
    toast.success('Evento salvo!');
    setEditing(null);
    loadEvents(session.user.id);
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from('gorjeta_events').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir.'); return; }
    toast.success('Evento excluído.');
    loadEvents(session.user.id);
  };

  const field = 'w-full h-11 rounded-xl bg-white/[0.04] border border-white/10 px-3.5 text-white placeholder:text-white/30 text-sm outline-none focus:border-white/25';
  const label = 'block text-[10px] uppercase tracking-widest text-white/40 mb-1.5';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07090d] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#07090d] flex items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <h1 className="text-white text-xl font-bold mb-1">Painel de eventos</h1>
          <p className="text-white/45 text-sm mb-5">Entre com sua conta de operador.</p>
          <div className="space-y-3">
            <input className={field} placeholder="E-mail" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
            <input className={field} type="password" placeholder="Senha" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
            <button onClick={signIn} disabled={loginLoading} className="w-full h-11 rounded-xl bg-emerald-500 text-emerald-950 font-bold text-sm disabled:opacity-50">
              {loginLoading ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07090d] text-white">
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 py-8">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black">Eventos de gorjeta</h1>
            <p className="text-white/45 text-sm">Crie um evento por live e gerencie as inscrições.</p>
          </div>
          <button
            onClick={() => setEditing(emptyEvent())}
            className="h-10 px-4 rounded-xl bg-emerald-500 text-emerald-950 font-bold text-sm"
          >
            + Novo evento
          </button>
        </header>

        {events.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 py-16 text-center text-white/45 text-sm">
            Nenhum evento criado ainda.
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((ev) => (
              <div key={ev.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/10 text-white/60">
                        {STATUSES.find((s) => s.value === ev.status)?.label || ev.status}
                      </span>
                      <span className="text-[11px] text-white/35">/evento={ev.tag}</span>
                    </div>
                    <h2 className="text-lg font-bold truncate">{ev.name}</h2>
                    <p className="text-white/45 text-xs mt-0.5">
                      {counts[ev.id] ?? 0} inscritos
                      {ev.closes_at ? ` · fecha ${new Date(ev.closes_at).toLocaleString('pt-BR')}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigator.clipboard.writeText(`${window.location.origin}/evento=${ev.tag}`).then(() => toast.success('Link copiado!'))}
                      className="h-9 px-3 rounded-lg border border-white/15 text-xs font-semibold text-white/70"
                    >
                      Copiar link
                    </button>
                    <button onClick={() => setEditing({ ...ev })} className="h-9 px-3 rounded-lg border border-white/15 text-xs font-semibold text-white/70">
                      Editar
                    </button>
                    <button onClick={() => remove(ev.id)} className="h-9 px-3 rounded-lg border border-red-500/30 text-xs font-semibold text-red-400">
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-white/10 bg-[#0c1016] p-5">
            <h2 className="text-lg font-bold mb-4">{editing.id ? 'Editar evento' : 'Novo evento'}</h2>
            <div className="space-y-4">
              <div>
                <label className={label}>Nome do evento</label>
                <input className={field} value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Live de sexta — Plinko da sorte" />
              </div>
              <div>
                <label className={label}>Link (tag)</label>
                <input className={field} value={editing.tag || ''} onChange={(e) => setEditing({ ...editing, tag: e.target.value })} placeholder="live-sexta" />
                <p className="text-[11px] text-white/30 mt-1">{window.location.origin}/evento={(editing.tag || 'sua-tag')}</p>
              </div>
              <div>
                <label className={label}>Descrição</label>
                <textarea className={`${field} h-24 py-2.5`} value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div>
                <label className={label}>Capa (URL da imagem)</label>
                <input className={field} value={editing.cover_url || ''} onChange={(e) => setEditing({ ...editing, cover_url: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Inscrições abrem</label>
                  <input type="datetime-local" className={field} value={toLocalInput(editing.opens_at || null)}
                    onChange={(e) => setEditing({ ...editing, opens_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
                </div>
                <div>
                  <label className={label}>Inscrições fecham</label>
                  <input type="datetime-local" className={field} value={toLocalInput(editing.closes_at || null)}
                    onChange={(e) => setEditing({ ...editing, closes_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Limite de inscritos</label>
                  <input type="number" className={field} value={editing.max_participants ?? ''} onChange={(e) => setEditing({ ...editing, max_participants: e.target.value ? Number(e.target.value) : null })} placeholder="Sem limite" />
                </div>
                <div>
                  <label className={label}>Status</label>
                  <select className={field} value={editing.status || 'draft'} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                    {STATUSES.map((s) => <option key={s.value} value={s.value} className="bg-neutral-900">{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Cor de destaque</label>
                  <input type="color" className="w-full h-11 rounded-xl bg-white/[0.04] border border-white/10 px-2" value={editing.theme?.accent || '#22c55e'}
                    onChange={(e) => setEditing({ ...editing, theme: { ...(editing.theme || {}), accent: e.target.value } })} />
                </div>
                <div>
                  <label className={label}>Cor de fundo</label>
                  <input type="color" className="w-full h-11 rounded-xl bg-white/[0.04] border border-white/10 px-2" value={editing.theme?.bg || '#07090d'}
                    onChange={(e) => setEditing({ ...editing, theme: { ...(editing.theme || {}), bg: e.target.value } })} />
                </div>
              </div>
              <label className="flex items-center gap-2.5 text-sm text-white/70">
                <input type="checkbox" checked={editing.require_pix ?? true} onChange={(e) => setEditing({ ...editing, require_pix: e.target.checked })} />
                Exigir chave PIX na inscrição
              </label>
              <div>
                <label className={label}>Regras</label>
                <textarea className={`${field} h-24 py-2.5`} value={editing.rules || ''} onChange={(e) => setEditing({ ...editing, rules: e.target.value })} />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditing(null)} className="flex-1 h-11 rounded-xl border border-white/15 text-sm font-semibold text-white/70">Cancelar</button>
              <button onClick={save} disabled={saving} className="flex-1 h-11 rounded-xl bg-emerald-500 text-emerald-950 font-bold text-sm disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GorjetaEventHost;
