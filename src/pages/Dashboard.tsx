import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import CustomizationPanel from '@/components/casino/CustomizationPanel';
import { WheelConfig, defaultConfig } from '@/components/casino/types';

interface WheelUser {
  id: string;
  account_id: string;
  email: string;
  phone: string;
  name: string;
  spins_available: number;
  created_at: string;
}

const Dashboard = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<'inscritos' | 'wheel' | 'history'>('inscritos');
  const [users, setUsers] = useState<WheelUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<WheelUser | null>(null);
  const [form, setForm] = useState({ account_id: '', email: '', name: '', phone: '' });
  const [historyLoading, setHistoryLoading] = useState(false);

  const [slug, setSlug] = useState('');
  const [editingSlug, setEditingSlug] = useState(false);
  const [newSlug, setNewSlug] = useState('');

  const [wheelConfig, setWheelConfig] = useState<WheelConfig>(defaultConfig);
  const [configId, setConfigId] = useState<string | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        loadData(s.user.id);
      } else {
        setLoading(false);
      }
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) loadData(s.user.id);
      else setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadData = async (userId: string) => {
    setLoading(true);
    // Load config
    const { data: cfg } = await (supabase as any)
      .from('wheel_configs')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (cfg) {
      setSlug(cfg.slug);
      setNewSlug(cfg.slug);
      setConfigId(cfg.id);
      if (cfg.config && Object.keys(cfg.config).length > 0) {
        setWheelConfig({ ...defaultConfig, ...cfg.config });
      }
    }

    setLoading(false);
    fetchUsers(userId);
    fetchHistory(userId);
  };

  const fetchUsers = async (userId?: string) => {
    const uid = userId || session?.user?.id;
    if (!uid) return;
    setUsersLoading(true);
    const { data } = await (supabase as any)
      .from('wheel_users')
      .select('*')
      .eq('owner_id', uid)
      .order('created_at', { ascending: false });
    setUsers(data || []);
    setUsersLoading(false);
  };

  const fetchHistory = async (userId?: string) => {
    const uid = userId || session?.user?.id;
    if (!uid) return;
    setHistoryLoading(true);
    const { data } = await (supabase as any)
      .from('spin_results')
      .select('*')
      .eq('owner_id', uid)
      .order('spun_at', { ascending: false });
    setSpinResults(data || []);
    setHistoryLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
    if (error) toast.error(error.message);
    setLoginLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  const handleSaveSlug = async () => {
    const cleaned = newSlug.toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!cleaned) { toast.error('Slug inválido'); return; }
    const { error } = await (supabase as any)
      .from('wheel_configs')
      .update({ slug: cleaned })
      .eq('user_id', session.user.id);
    if (error) {
      toast.error(error.message.includes('unique') ? 'Esse link já está em uso' : error.message);
      return;
    }
    setSlug(cleaned);
    setEditingSlug(false);
    toast.success('Link atualizado!');
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    // Strip base64 images to avoid huge payloads
    const { segments, ...rest } = wheelConfig;
    const cleanSegments = segments?.map(({ imageUrl, ...s }: any) => ({
      ...s,
      imageUrl: typeof imageUrl === 'string' && imageUrl.startsWith('data:') ? '' : imageUrl,
    }));
    const cleanConfig = {
      ...rest,
      segments: cleanSegments,
      authLogoUrl: typeof rest.authLogoUrl === 'string' && rest.authLogoUrl.startsWith('data:') ? '' : rest.authLogoUrl,
      authBgImageUrl: typeof rest.authBgImageUrl === 'string' && rest.authBgImageUrl.startsWith('data:') ? '' : rest.authBgImageUrl,
    };

    const { error } = await (supabase as any)
      .from('wheel_configs')
      .update({ config: cleanConfig, updated_at: new Date().toISOString() })
      .eq('user_id', session.user.id);
    if (error) toast.error('Erro ao salvar: ' + error.message);
    else toast.success('Configuração salva!');
    setSavingConfig(false);
  };

  const handleGrantSpin = async (user: WheelUser) => {
    const newSpins = user.spins_available >= 1 ? 0 : 1;
    const { error } = await (supabase as any)
      .from('wheel_users')
      .update({ spins_available: newSpins })
      .eq('id', user.id);
    if (error) { toast.error('Erro ao atualizar giro'); return; }
    toast.success(newSpins === 1 ? `1 giro liberado para ${user.name}!` : `Giro removido de ${user.name}`);
    fetchUsers();
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Excluir este usuário?')) return;
    await (supabase as any).from('wheel_users').delete().eq('id', id);
    toast.success('Excluído!');
    fetchUsers();
  };

  const handleExportCSV = () => {
    const header = 'Nome,E-mail,Celular,ID da Conta,Data\n';
    const rows = filteredUsers.map(u =>
      `"${u.name}","${u.email}","${u.phone || ''}","${u.account_id}","${u.created_at || ''}"`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inscritos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado!');
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) { toast.error('CSV vazio'); return; }
      const hasHeader = lines[0].toLowerCase().includes('nome') || lines[0].toLowerCase().includes('email');
      const dataLines = hasHeader ? lines.slice(1) : lines;
      let imported = 0, errors = 0;
      for (const line of dataLines) {
        const cols = line.match(/(".*?"|[^,]+)/g)?.map(c => c.replace(/^"|"$/g, '').trim()) || [];
        if (cols.length < 4) { errors++; continue; }
        const [name, email, phone, account_id] = cols;
        if (!name || !email || !account_id) { errors++; continue; }
        const { error } = await (supabase as any).from('wheel_users').insert({
          name, email, phone: phone || '', account_id, owner_id: session.user.id,
        });
        if (error) errors++; else imported++;
      }
      toast.success(`${imported} importado(s)${errors > 0 ? `, ${errors} erro(s)` : ''}`);
      fetchUsers();
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.account_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <form onSubmit={handleLogin} className="w-full max-w-sm mx-4 space-y-4 p-8 rounded-2xl border border-border bg-card shadow-lg">
          <h1 className="text-2xl font-bold text-center text-foreground">Painel do Operador</h1>
          <input type="email" placeholder="Email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground text-sm" />
          <input type="password" placeholder="Senha" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground text-sm" />
          <button type="submit" disabled={loginLoading} className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50">
            {loginLoading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    );
  }

  const baseUrl = window.location.origin;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Meu Painel</h1>
            <p className="text-sm text-muted-foreground">{session.user.email}</p>
          </div>
          <button onClick={handleLogout} className="px-4 py-2 rounded-lg bg-muted text-foreground text-sm hover:bg-muted/80 transition">Sair</button>
        </div>

        {/* Slug / link */}
        <div className="mb-6 p-4 rounded-xl border border-border bg-card">
          <label className="text-xs text-muted-foreground font-medium block mb-1">Link da sua roleta</label>
          {editingSlug ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{baseUrl}/roleta/</span>
              <input
                value={newSlug}
                onChange={e => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm"
              />
              <button onClick={handleSaveSlug} className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold">Salvar</button>
              <button onClick={() => { setEditingSlug(false); setNewSlug(slug); }} className="px-3 py-1.5 rounded-lg bg-muted text-foreground text-sm">Cancelar</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <code className="text-sm text-primary font-mono bg-primary/10 px-3 py-1.5 rounded">{baseUrl}/roleta/{slug}</code>
              <button onClick={() => setEditingSlug(true)} className="px-3 py-1.5 rounded-lg bg-muted text-foreground text-xs hover:bg-muted/80 transition">✏️ Editar</button>
              <button onClick={() => { navigator.clipboard.writeText(`${baseUrl}/roleta/${slug}`); toast.success('Link copiado!'); }} className="px-3 py-1.5 rounded-lg bg-muted text-foreground text-xs hover:bg-muted/80 transition">📋 Copiar</button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border">
          <button onClick={() => setActiveTab('inscritos')} className={`px-6 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === 'inscritos' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            👥 Inscritos
          </button>
          <button onClick={() => setActiveTab('wheel')} className={`px-6 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === 'wheel' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            🎡 Configurar Roleta
          </button>
          <button onClick={() => { setActiveTab('history'); fetchHistory(); }} className={`px-6 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === 'history' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            🏆 Histórico
          </button>
        </div>

        {/* Inscritos tab */}
        {activeTab === 'inscritos' && (
          <>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
              <input
                type="text" placeholder="Buscar por nome, email ou ID..."
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm"
              />
              <div className="flex gap-2">
                <label className="px-5 py-2.5 rounded-lg bg-muted text-foreground font-bold text-sm hover:bg-muted/80 transition whitespace-nowrap cursor-pointer">
                  📤 Importar CSV
                  <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
                </label>
                <button onClick={handleExportCSV} className="px-5 py-2.5 rounded-lg bg-muted text-foreground font-bold text-sm hover:bg-muted/80 transition whitespace-nowrap">📥 Exportar CSV</button>
              </div>
            </div>

            {usersLoading ? (
              <div className="text-center py-12 text-muted-foreground animate-pulse">Carregando...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">{searchTerm ? 'Nenhum resultado' : 'Nenhum inscrito'}</div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm table-fixed">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left px-3 py-3 text-muted-foreground font-medium w-10">#</th>
                      <th className="text-left px-3 py-3 text-muted-foreground font-medium">Nome</th>
                      <th className="text-left px-3 py-3 text-muted-foreground font-medium">Email</th>
                      <th className="text-left px-3 py-3 text-muted-foreground font-medium w-28">Celular</th>
                      <th className="text-left px-3 py-3 text-muted-foreground font-medium w-36">Account ID</th>
                      <th className="text-center px-3 py-3 text-muted-foreground font-medium w-44">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user, index) => (
                      <tr key={user.id} className="border-t border-border hover:bg-muted/30 transition">
                        <td className="px-3 py-3 text-muted-foreground text-xs">{index + 1}</td>
                        <td className="px-3 py-3 text-foreground font-medium truncate">{user.name}</td>
                        <td className="px-3 py-3 text-muted-foreground truncate">{user.email}</td>
                        <td className="px-3 py-3 text-muted-foreground text-xs">{user.phone}</td>
                        <td className="px-3 py-3 font-mono text-xs text-muted-foreground truncate">{user.account_id}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleGrantSpin(user)}
                              className={`px-2.5 py-1 rounded text-xs font-semibold transition whitespace-nowrap ${user.spins_available >= 1 ? 'bg-primary/15 text-primary hover:bg-destructive/15 hover:text-destructive' : 'bg-accent text-accent-foreground hover:opacity-80'}`}
                            >
                              {user.spins_available >= 1 ? '1 giro ✓' : 'Liberar'}
                            </button>
                            <button onClick={() => handleDeleteUser(user.id)} className="px-2.5 py-1 rounded bg-destructive/10 text-destructive text-xs hover:bg-destructive/20 transition">Excluir</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4 text-xs text-muted-foreground">{filteredUsers.length} inscrito(s)</div>
          </>
        )}

        {/* Wheel config */}
        {activeTab === 'wheel' && (
          <div className="max-w-lg space-y-4">
            <CustomizationPanel config={wheelConfig} onChange={setWheelConfig} />
            <button
              onClick={handleSaveConfig}
              disabled={savingConfig}
              className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50"
            >
              {savingConfig ? 'Salvando...' : '💾 Salvar Configuração'}
            </button>
          </div>
        )}

        {/* History */}
        {activeTab === 'history' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground">Histórico de Prêmios</h2>
              <button onClick={() => fetchHistory()} className="px-4 py-2 rounded-lg bg-muted text-foreground text-sm hover:bg-muted/80 transition">🔄 Atualizar</button>
            </div>
            {historyLoading ? (
              <div className="text-center py-12 text-muted-foreground animate-pulse">Carregando...</div>
            ) : spinResults.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nenhum resultado registrado</div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left px-3 py-3 text-muted-foreground font-medium w-10">#</th>
                      <th className="text-left px-3 py-3 text-muted-foreground font-medium">Nome</th>
                      <th className="text-left px-3 py-3 text-muted-foreground font-medium">Email</th>
                      <th className="text-left px-3 py-3 text-muted-foreground font-medium">Account ID</th>
                      <th className="text-left px-3 py-3 text-muted-foreground font-medium">🏆 Prêmio</th>
                      <th className="text-left px-3 py-3 text-muted-foreground font-medium">Data/Hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {spinResults.map((r: any, i: number) => (
                      <tr key={r.id} className="border-t border-border hover:bg-muted/30 transition">
                        <td className="px-3 py-3 text-muted-foreground text-xs">{i + 1}</td>
                        <td className="px-3 py-3 text-foreground font-medium">{r.user_name}</td>
                        <td className="px-3 py-3 text-muted-foreground">{r.user_email}</td>
                        <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{r.account_id}</td>
                        <td className="px-3 py-3 text-primary font-bold">{r.prize}</td>
                        <td className="px-3 py-3 text-muted-foreground text-xs">{new Date(r.spun_at).toLocaleString('pt-BR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4 text-xs text-muted-foreground">{spinResults.length} resultado(s)</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
