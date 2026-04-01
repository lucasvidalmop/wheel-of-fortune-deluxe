import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import CustomizationPanel from '@/components/casino/CustomizationPanel';
import { WheelConfig, defaultConfig } from '@/components/casino/types';

interface WheelUser {
  id: string;
  account_id: string;
  email: string;
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
  const [form, setForm] = useState({ account_id: '', email: '', name: '', spins_available: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'wheel' | 'admins'>('users');

  // Admin user creation
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [adminForm, setAdminForm] = useState({ email: '', password: '', name: '' });
  const [adminCreating, setAdminCreating] = useState(false);

  // Wheel config state
  const [wheelConfig, setWheelConfig] = useState<WheelConfig>(() => {
    const saved = localStorage.getItem('wheel_config');
    return saved ? { ...defaultConfig, ...JSON.parse(saved) } : defaultConfig;
  });

  useEffect(() => {
    localStorage.setItem('wheel_config', JSON.stringify(wheelConfig));
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
    if (data) fetchUsers();
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
        .update({
          account_id: form.account_id,
          email: form.email,
          name: form.name,
          spins_available: form.spins_available,
        })
        .eq('id', editingUser.id);
      if (error) { toast.error('Erro ao atualizar: ' + error.message); return; }
      toast.success('Usuário atualizado!');
    } else {
      const { error } = await (supabase as any)
        .from('wheel_users')
        .insert({
          account_id: form.account_id,
          email: form.email,
          name: form.name,
          spins_available: form.spins_available,
        });
      if (error) { toast.error('Erro ao criar: ' + error.message); return; }
      toast.success('Usuário criado!');
    }
    setShowForm(false);
    setEditingUser(null);
    setForm({ account_id: '', email: '', name: '', spins_available: 0 });
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
        toast.error(res.data?.error || res.error?.message || 'Erro ao criar admin');
      } else {
        toast.success(`Admin ${adminForm.email} criado com sucesso!`);
        setAdminForm({ email: '', password: '', name: '' });
        setShowAdminForm(false);
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar admin');
    }
    setAdminCreating(false);
  };

  const openEdit = (user: WheelUser) => {
    setEditingUser(user);
    setForm({
      account_id: user.account_id,
      email: user.email,
      name: user.name,
      spins_available: user.spins_available,
    });
    setShowForm(true);
  };

  const openNew = () => {
    setEditingUser(null);
    setForm({ account_id: '', email: '', name: '', spins_available: 0 });
    setShowForm(true);
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
            👥 Usuários
          </button>
          <button
            onClick={() => setActiveTab('wheel')}
            className={`px-6 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === 'wheel' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            🎡 Configurar Roleta
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
              <button onClick={openNew} className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition whitespace-nowrap">
                + Novo Usuário
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
                    <label className="text-xs text-muted-foreground">Account ID</label>
                    <input type="text" required value={form.account_id} onChange={e => setForm({ ...form, account_id: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Giros Disponíveis</label>
                    <input type="number" min={0} required value={form.spins_available} onChange={e => setForm({ ...form, spins_available: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" />
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
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">Nome</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">Email</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">Account ID</th>
                      <th className="text-center px-4 py-3 text-muted-foreground font-medium">Giros</th>
                      <th className="text-center px-4 py-3 text-muted-foreground font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(user => (
                      <tr key={user.id} className="border-t border-border hover:bg-muted/30 transition">
                        <td className="px-4 py-3 text-foreground font-medium">{user.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{user.account_id}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${user.spins_available > 0 ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                            {user.spins_available}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => openEdit(user)} className="px-3 py-1.5 rounded-md bg-muted text-foreground text-xs hover:bg-muted/80 transition">Editar</button>
                            <button onClick={() => handleDeleteUser(user.id)} className="px-3 py-1.5 rounded-md bg-destructive/10 text-destructive text-xs hover:bg-destructive/20 transition">Excluir</button>
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
      </div>
    </div>
  );
};

export default Admin;
