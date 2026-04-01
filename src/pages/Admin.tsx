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

const Admin = () => {
  const [session, setSession] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [users, setUsers] = useState<WheelUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<WheelUser | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ account_id: '', email: '', name: '', phone: '', spins_available: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'wheel' | 'admins' | 'history'>('users');
  const [spinResults, setSpinResults] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Admin user creation
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [adminForm, setAdminForm] = useState({ email: '', password: '', name: '' });
  const [adminCreating, setAdminCreating] = useState(false);
  const [systemUsers, setSystemUsers] = useState<any[]>([]);
  const [systemUsersLoading, setSystemUsersLoading] = useState(false);

  // Wheel config state
  const [wheelConfig, setWheelConfig] = useState<WheelConfig>(() => {
    const saved = localStorage.getItem('wheel_config');
    return saved ? { ...defaultConfig, ...JSON.parse(saved) } : defaultConfig;
  });

  useEffect(() => {
    try {
      const { segments, ...rest } = wheelConfig;
      const cleanSegments = segments?.map(({ imageUrl, ...s }: any) => ({
        ...s,
        imageUrl: typeof imageUrl === 'string' && imageUrl.startsWith('data:') ? '' : imageUrl,
      }));
      const clean = {
        ...rest,
        segments: cleanSegments,
        authLogoUrl: typeof rest.authLogoUrl === 'string' && rest.authLogoUrl.startsWith('data:') ? '' : rest.authLogoUrl,
        authBgImageUrl: typeof rest.authBgImageUrl === 'string' && rest.authBgImageUrl.startsWith('data:') ? '' : rest.authBgImageUrl,
      };
      localStorage.setItem('wheel_config', JSON.stringify(clean));
    } catch {
      localStorage.removeItem('wheel_config');
    }
  }, [wheelConfig]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        checkAdminRole(session.user.id);
      } else {
        setIsAdmin(false);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        checkAdminRole(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAdminRole = async (userId: string) => {
    const { data } = await (supabase as any)
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();
    setIsAdmin(!!data);
    setLoading(false);
    if (data) { fetchUsers(); fetchHistory(); }
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    const { data, error } = await (supabase as any)
      .from('wheel_users')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Erro ao carregar usuários');
    } else {
      setUsers(data || []);
    }
    setUsersLoading(false);
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    const { data, error } = await (supabase as any)
      .from('spin_results')
      .select('*')
      .order('spun_at', { ascending: false });
    if (!error) setSpinResults(data || []);
    setHistoryLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    if (error) toast.error(error.message);
    setLoginLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setIsAdmin(false);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      const { error } = await (supabase as any)
        .from('wheel_users')
        .update({ account_id: form.account_id, email: form.email, name: form.name, phone: form.phone })
        .eq('id', editingUser.id);
      if (error) { toast.error('Erro ao atualizar: ' + error.message); return; }
      toast.success('Usuário atualizado!');
    } else {
      const { error } = await (supabase as any)
        .from('wheel_users')
        .insert({ account_id: form.account_id, email: form.email, name: form.name, phone: form.phone });
      if (error) { toast.error('Erro ao criar: ' + error.message); return; }
      toast.success('Usuário criado!');
    }
    setShowForm(false);
    setEditingUser(null);
    setForm({ account_id: '', email: '', name: '', phone: '', spins_available: 0 });
    fetchUsers();
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

  const handleToggleAllSpins = async (grant: boolean) => {
    const label = grant ? 'liberar giros para todos' : 'remover giros de todos';
    if (!confirm(`Tem certeza que deseja ${label}?`)) return;
    const { error } = await (supabase as any)
      .from('wheel_users')
      .update({ spins_available: grant ? 1 : 0 })
      .gte('id', '00000000-0000-0000-0000-000000000000');
    if (error) { toast.error('Erro ao atualizar'); return; }
    toast.success(grant ? 'Giros liberados para todos!' : 'Giros removidos de todos!');
    fetchUsers();
  };

  const handleDeleteAll = async () => {
    if (!confirm('Tem certeza que deseja EXCLUIR TODOS os cadastros? Esta ação não pode ser desfeita.')) return;
    if (!confirm('CONFIRMAR: Todos os usuários serão excluídos permanentemente.')) return;
    const { error } = await (supabase as any)
      .from('wheel_users')
      .delete()
      .gte('id', '00000000-0000-0000-0000-000000000000');
    if (error) { toast.error('Erro ao excluir'); return; }
    toast.success('Todos os cadastros foram excluídos!');
    fetchUsers();
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;
    const { error } = await (supabase as any).from('wheel_users').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir'); return; }
    toast.success('Usuário excluído!');
    fetchUsers();
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminCreating(true);
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('create-admin-user', {
        body: { email: adminForm.email, password: adminForm.password, name: adminForm.name },
      });
      if (res.error || res.data?.error) {
        toast.error(res.data?.error || res.error?.message || 'Erro ao criar usuário');
      } else {
        toast.success(`Usuário ${adminForm.email} criado com sucesso!`);
        setAdminForm({ email: '', password: '', name: '' });
        setShowAdminForm(false);
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar usuário');
    }
    setAdminCreating(false);
  };

  const openEdit = (user: WheelUser) => {
    setEditingUser(user);
    setForm({
      account_id: user.account_id,
      email: user.email,
      name: user.name,
      phone: user.phone || '',
      spins_available: user.spins_available,
    });
    setShowForm(true);
  };

  const openNew = () => {
    setEditingUser(null);
    setForm({ account_id: '', email: '', name: '', phone: '', spins_available: 0 });
    setShowForm(true);
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
    a.download = `usuarios_${new Date().toISOString().slice(0, 10)}.csv`;
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
      if (lines.length < 2) { toast.error('CSV vazio ou inválido'); return; }
      const header = lines[0].toLowerCase();
      const hasHeader = header.includes('nome') || header.includes('email') || header.includes('name');
      const dataLines = hasHeader ? lines.slice(1) : lines;
      let imported = 0, errors = 0;
      for (const line of dataLines) {
        const cols = line.match(/(".*?"|[^,]+)/g)?.map(c => c.replace(/^"|"$/g, '').trim()) || [];
        if (cols.length < 4) { errors++; continue; }
        const [name, email, phone, account_id] = cols;
        if (!name || !email || !account_id) { errors++; continue; }
        const { error } = await (supabase as any).from('wheel_users').insert({
          name, email, phone: phone || '', account_id,
        });
        if (error) errors++; else imported++;
      }
      toast.success(`${imported} usuário(s) importado(s)${errors > 0 ? `, ${errors} erro(s)` : ''}`);
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
          <h1 className="text-2xl font-bold text-center text-foreground">Admin Login</h1>
          <input type="email" placeholder="Email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground text-sm" />
          <input type="password" placeholder="Senha" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground text-sm" />
          <button type="submit" disabled={loginLoading} className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50">
            {loginLoading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <p className="text-destructive font-bold text-lg">Acesso negado. Você não é administrador.</p>
        <button onClick={handleLogout} className="px-6 py-2 rounded-lg bg-muted text-foreground text-sm">Sair</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Painel Admin</h1>
            <p className="text-sm text-muted-foreground">Gerenciamento da roleta</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{session.user.email}</span>
            <button onClick={handleLogout} className="px-4 py-2 rounded-lg bg-muted text-foreground text-sm hover:bg-muted/80 transition">Sair</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === 'users' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            👥 Inscritos
          </button>
          <button
            onClick={() => setActiveTab('wheel')}
            className={`px-6 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === 'wheel' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            🎡 Configurar Roleta
          </button>
          <button
            onClick={() => setActiveTab('admins')}
            className={`px-6 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === 'admins' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            👤 Criar Usuários
          </button>
          <button
            onClick={() => { setActiveTab('history'); fetchHistory(); }}
            className={`px-6 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === 'history' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            🏆 Histórico
          </button>
        </div>

        {/* Users tab */}
        {activeTab === 'users' && (
          <>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
              <input
                type="text"
                placeholder="Buscar por nome, email ou ID..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm"
              />
              <div className="flex gap-2">
                <label className="px-6 py-2.5 rounded-lg bg-muted text-foreground font-bold text-sm hover:bg-muted/80 transition whitespace-nowrap cursor-pointer">
                  📤 Importar CSV
                  <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
                </label>
                <button onClick={handleExportCSV} className="px-6 py-2.5 rounded-lg bg-muted text-foreground font-bold text-sm hover:bg-muted/80 transition whitespace-nowrap">
                  📥 Exportar CSV
                </button>
                <button onClick={openNew} className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition whitespace-nowrap">
                  + Novo Usuário
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-6 p-3 rounded-xl border border-border bg-card">
              <span className="text-xs text-muted-foreground font-medium mr-1">Ações em massa:</span>
              <button onClick={() => handleToggleAllSpins(true)} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-xs hover:opacity-90 transition">
                🎰 Liberar giros para todos
              </button>
              <button onClick={() => handleToggleAllSpins(false)} className="px-4 py-2 rounded-lg border border-border bg-background text-foreground font-medium text-xs hover:bg-muted transition">
                ⛔ Remover giros de todos
              </button>
              <div className="flex-1" />
              <button onClick={handleDeleteAll} className="px-4 py-2 rounded-lg border border-destructive/30 text-destructive font-medium text-xs hover:bg-destructive/10 transition">
                🗑️ Excluir todos
              </button>
            </div>

            {showForm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                <form onSubmit={handleSaveUser} className="w-full max-w-md mx-4 p-6 rounded-2xl border border-border bg-card shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-foreground">{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</h2>
                    <button type="button" onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">✕</button>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Nome</label>
                    <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Email</label>
                    <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Celular</label>
                    <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Account ID</label>
                    <input type="text" required value={form.account_id} onChange={e => setForm({ ...form, account_id: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg bg-muted text-foreground text-sm">Cancelar</button>
                    <button type="submit" className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground font-bold text-sm">{editingUser ? 'Salvar' : 'Criar'}</button>
                  </div>
                </form>
              </div>
            )}

            {usersLoading ? (
              <div className="text-center py-12 text-muted-foreground animate-pulse">Carregando usuários...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">{searchTerm ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado'}</div>
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
                      <th className="text-center px-3 py-3 text-muted-foreground font-medium w-52">Ações</th>
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
                              type="button"
                              onClick={() => handleGrantSpin(user)}
                              className={`px-2.5 py-1 rounded text-xs font-semibold transition whitespace-nowrap ${user.spins_available >= 1 ? 'bg-primary/15 text-primary hover:bg-destructive/15 hover:text-destructive' : 'bg-accent text-accent-foreground hover:opacity-80'}`}
                            >
                              {user.spins_available >= 1 ? '1 giro ✓' : 'Liberar'}
                            </button>
                            <button onClick={() => openEdit(user)} className="px-2.5 py-1 rounded bg-muted text-foreground text-xs hover:bg-muted/80 transition">Editar</button>
                            <button onClick={() => handleDeleteUser(user.id)} className="px-2.5 py-1 rounded bg-destructive/10 text-destructive text-xs hover:bg-destructive/20 transition">Excluir</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 text-xs text-muted-foreground">
              {filteredUsers.length} usuário(s) {searchTerm && `encontrado(s) de ${users.length} total`}
            </div>
          </>
        )}

        {/* Wheel config tab */}
        {activeTab === 'wheel' && (
          <div className="max-w-lg">
            <CustomizationPanel config={wheelConfig} onChange={setWheelConfig} />
          </div>
        )}

        {/* Create users tab */}
        {activeTab === 'admins' && (
          <div className="max-w-md space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Criar Novo Usuário</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Usuários podem personalizar sua própria roleta e ver as inscrições.
            </p>

            {!showAdminForm ? (
              <button onClick={() => setShowAdminForm(true)} className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition">
                + Novo Usuário
              </button>
            ) : (
              <form onSubmit={handleCreateAdmin} className="p-6 rounded-2xl border border-border bg-card space-y-4">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Nome</label>
                  <input type="text" value={adminForm.name} onChange={e => setAdminForm({ ...adminForm, name: e.target.value })} placeholder="Nome do usuário" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Email</label>
                  <input type="email" required value={adminForm.email} onChange={e => setAdminForm({ ...adminForm, email: e.target.value })} placeholder="usuario@email.com" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Senha</label>
                  <input type="password" required minLength={6} value={adminForm.password} onChange={e => setAdminForm({ ...adminForm, password: e.target.value })} placeholder="Mínimo 6 caracteres" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowAdminForm(false)} className="flex-1 py-2 rounded-lg bg-muted text-foreground text-sm">Cancelar</button>
                  <button type="submit" disabled={adminCreating} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50">
                    {adminCreating ? 'Criando...' : 'Criar Usuário'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* History tab */}
        {activeTab === 'history' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground">Histórico de Prêmios</h2>
              <button onClick={fetchHistory} className="px-4 py-2 rounded-lg bg-muted text-foreground text-sm hover:bg-muted/80 transition">🔄 Atualizar</button>
            </div>
            {historyLoading ? (
              <div className="text-center py-12 text-muted-foreground animate-pulse">Carregando histórico...</div>
            ) : spinResults.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nenhum resultado registrado ainda</div>
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

export default Admin;
