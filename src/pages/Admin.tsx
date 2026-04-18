import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Users, Shield, Trophy, LogOut, Search, Plus, FileDown, FileUp, Pencil, Trash2, ChevronLeft, ChevronRight, RotateCcw, UserPlus, Eye, X, AlertTriangle, KeyRound, Globe, Upload, Copy, Monitor, ToggleLeft, RotateCw } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

const TOOL_DEFS: { key: 'roleta' | 'sms' | 'email' | 'whatsapp' | 'financeiro' | 'gorjeta' | 'referral'; label: string }[] = [
  { key: 'roleta', label: 'Roleta' },
  { key: 'sms', label: 'SMS' },
  { key: 'email', label: 'E-mail' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'financeiro', label: 'Sistema de Pagamento' },
  { key: 'gorjeta', label: 'Gorjeta' },
  { key: 'referral', label: 'Link de Referência' },
];
type ToolKey = typeof TOOL_DEFS[number]['key'];
type Perms = Record<ToolKey, boolean>;
const DEFAULT_PERMS: Perms = { roleta: true, sms: true, email: true, whatsapp: true, financeiro: true, gorjeta: true, referral: true };
import { uploadAppAsset } from '@/lib/uploadAppAsset';
import ThemeSettingsPanel from '@/components/casino/ThemeSettingsPanel';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

interface WheelUser {
  id: string;
  account_id: string;
  email: string;
  phone: string;
  name: string;
  spins_available: number;
  created_at: string;
}

const GlassCard = ({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] ${className}`} {...props}>{children}</div>
);

const Admin = () => {
  const { confirm: confirmDialog, ConfirmDialog } = useConfirmDialog();
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
  const [activeTab, setActiveTab] = useState<'users' | 'admins' | 'history' | 'site' | 'dashboards' | 'permissions'>('users');
  // Operator permissions
  const [permDefaults, setPermDefaults] = useState<Perms>(DEFAULT_PERMS);
  const [permRows, setPermRows] = useState<Record<string, Perms>>({});
  const [permLoading, setPermLoading] = useState(false);
  const [permSavingKey, setPermSavingKey] = useState<string | null>(null);
  const [editingPermsUser, setEditingPermsUser] = useState<any>(null);
  const [siteSettings, setSiteSettings] = useState({ bg_image_url: '', site_title: '', site_description: '', favicon_url: '', home_mode: 'text' as 'text' | 'image' | 'image_text' });
  const [apiBackendUrl, setApiBackendUrl] = useState(() => localStorage.getItem('wheel_api_url') || '');
  const [siteSaving, setSiteSaving] = useState(false);
  const [siteUploading, setSiteUploading] = useState(false);
  const [siteFaviconUploading, setSiteFaviconUploading] = useState(false);
  const [spinResults, setSpinResults] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [showAdminForm, setShowAdminForm] = useState(false);
  const [adminForm, setAdminForm] = useState({ email: '', password: '', name: '' });
  const [adminCreating, setAdminCreating] = useState(false);
  const [systemUsers, setSystemUsers] = useState<any[]>([]);
  const [systemUsersLoading, setSystemUsersLoading] = useState(false);
  const [editingSystemUser, setEditingSystemUser] = useState<any>(null);
  const [editSystemForm, setEditSystemForm] = useState({ email: '', password: '', name: '' });
  const [editSystemSaving, setEditSystemSaving] = useState(false);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [editingAdminUser, setEditingAdminUser] = useState<any>(null);
  const [editAdminForm, setEditAdminForm] = useState({ email: '', password: '', name: '' });
  const [editAdminSaving, setEditAdminSaving] = useState(false);

  // Dashboard cloning state
  const [dashboardConfigs, setDashboardConfigs] = useState<any[]>([]);
  const [dashboardsLoading, setDashboardsLoading] = useState(false);
  const [cloneSource, setCloneSource] = useState<string | null>(null);
  const [cloneTarget, setCloneTarget] = useState<string>('');
  const [cloning, setCloning] = useState(false);

  useSiteSettings();

  useEffect(() => {
    let isMounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      setSession(session);
      if (session?.user) checkAdminRole(session.user.id);
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setSession(session);
      if (session?.user) checkAdminRole(session.user.id);
      else { setIsAdmin(false); setLoading(false); }
    });
    return () => { isMounted = false; subscription.unsubscribe(); };
  }, []);

  const checkAdminRole = async (userId: string) => {
    const { data } = await (supabase as any).from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
    setIsAdmin(!!data);
    setLoading(false);
    if (data) { fetchUsers(); fetchHistory(); fetchSiteSettings(); }
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    const { data, error } = await (supabase as any).from('wheel_users').select('*').order('created_at', { ascending: false });
    if (error) toast.error('Erro ao carregar usuários');
    else setUsers(data || []);
    setUsersLoading(false);
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    const [resultsRes, configsRes] = await Promise.all([
      (supabase as any).from('spin_results').select('*').order('spun_at', { ascending: false }),
      (supabase as any).from('wheel_configs').select('user_id, slug'),
    ]);
    const configs = configsRes.data || [];
    const configMap: Record<string, string> = {};
    configs.forEach((c: any) => { configMap[c.user_id] = c.slug; });
    const results = (resultsRes.data || []).map((r: any) => ({ ...r, owner_slug: r.owner_id ? configMap[r.owner_id] || 'N/A' : 'N/A' }));
    if (!resultsRes.error) setSpinResults(results);
    setHistoryLoading(false);
  };

  const fetchSiteSettings = async () => {
    const { data } = await (supabase as any).from('site_settings').select('*').eq('id', 1).maybeSingle();
    if (data) setSiteSettings({ bg_image_url: data.bg_image_url || '', site_title: data.site_title || '', site_description: data.site_description || '', favicon_url: data.favicon_url || '', home_mode: data.home_mode || 'text' });
  };

  const handleSaveSiteSettings = async () => {
    setSiteSaving(true);
    const { error } = await (supabase as any).from('site_settings').update(siteSettings).eq('id', 1);
    if (error) toast.error('Erro ao salvar: ' + error.message);
    else toast.success('Configurações salvas!');
    setSiteSaving(false);
  };

  const handleSiteBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setSiteUploading(true);
    try {
      const { publicUrl } = await uploadAppAsset(file, 'site-bg');
      setSiteSettings(s => ({ ...s, bg_image_url: publicUrl }));
      toast.success('Background enviado!');
    } catch (err: any) { toast.error('Erro: ' + (err.message || 'Tente novamente')); }
    setSiteUploading(false);
    e.target.value = '';
  };

  const handleSiteFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setSiteFaviconUploading(true);
    try {
      const { publicUrl } = await uploadAppAsset(file, 'site-favicon');
      setSiteSettings(s => ({ ...s, favicon_url: publicUrl }));
      toast.success('Favicon enviado!');
    } catch (err: any) { toast.error('Erro: ' + (err.message || 'Tente novamente')); }
    setSiteFaviconUploading(false);
    e.target.value = '';
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
    if (error) toast.error(error.message);
    setLoginLoading(false);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); setSession(null); setIsAdmin(false); };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      const { error } = await (supabase as any).from('wheel_users').update({ account_id: form.account_id, email: form.email, name: form.name, phone: form.phone }).eq('id', editingUser.id);
      if (error) { toast.error('Erro: ' + error.message); return; }
      toast.success('Atualizado!');
    } else {
      const { error } = await (supabase as any).from('wheel_users').insert({ account_id: form.account_id, email: form.email, name: form.name, phone: form.phone });
      if (error) { toast.error('Erro: ' + error.message); return; }
      toast.success('Criado!');
    }
    setShowForm(false); setEditingUser(null);
    setForm({ account_id: '', email: '', name: '', phone: '', spins_available: 0 });
    fetchUsers();
  };

  const handleGrantSpin = async (user: WheelUser) => {
    const newSpins = user.spins_available >= 1 ? 0 : 1;
    const { error } = await (supabase as any).from('wheel_users').update({ spins_available: newSpins }).eq('id', user.id);
    if (error) { toast.error('Erro ao atualizar giro'); return; }
    toast.success(newSpins === 1 ? `1 giro liberado para ${user.name}!` : `Giro removido de ${user.name}`);
    fetchUsers();
  };

  const handleToggleAllSpins = async (grant: boolean) => {
    if (!await confirmDialog({ title: grant ? 'Liberar Giros' : 'Remover Giros', message: `Tem certeza que deseja ${grant ? 'liberar giros para todos' : 'remover giros de todos'}?`, variant: 'warning', confirmLabel: grant ? 'Liberar' : 'Remover' })) return;
    const { error } = await (supabase as any).from('wheel_users').update({ spins_available: grant ? 1 : 0 }).gte('id', '00000000-0000-0000-0000-000000000000');
    if (error) { toast.error('Erro ao atualizar'); return; }
    toast.success(grant ? 'Giros liberados!' : 'Giros removidos!');
    fetchUsers();
  };

  const handleDeleteAll = async () => {
    if (!await confirmDialog({ title: '⚠️ Excluir Todos', message: 'Tem certeza que deseja EXCLUIR TODOS os cadastros? Esta ação é permanente.', variant: 'danger', confirmLabel: 'Excluir Todos' })) return;
    const { error } = await (supabase as any).from('wheel_users').delete().gte('id', '00000000-0000-0000-0000-000000000000');
    if (error) { toast.error('Erro'); return; }
    toast.success('Todos excluídos!');
    fetchUsers();
  };

  const handleDeleteUser = async (id: string) => {
    if (!await confirmDialog({ title: 'Excluir Usuário', message: 'Tem certeza que deseja excluir este usuário?', variant: 'danger', confirmLabel: 'Excluir' })) return;
    await (supabase as any).from('wheel_users').delete().eq('id', id);
    toast.success('Excluído!');
    fetchUsers();
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminCreating(true);
    try {
      const res = await supabase.functions.invoke('create-admin-user', {
        body: { email: adminForm.email, password: adminForm.password, name: adminForm.name },
      });
      if (res.error || res.data?.error) {
        toast.error(res.data?.error || res.error?.message || 'Erro');
      } else {
        toast.success(`Usuário ${adminForm.email} criado!`);
        setAdminForm({ email: '', password: '', name: '' });
        setShowAdminForm(false);
      }
    } catch (err: any) { toast.error(err.message || 'Erro'); }
    setAdminCreating(false);
  };

  const fetchSystemUsers = async () => {
    setSystemUsersLoading(true);
    try { const res = await supabase.functions.invoke('list-system-users'); if (res.data?.users) setSystemUsers(res.data.users); } catch {}
    setSystemUsersLoading(false);
  };

  const fetchAdminUsers = async () => {
    setAdminUsersLoading(true);
    try { const res = await supabase.functions.invoke('update-system-user', { body: { action: 'list_admins' } }); if (res.data?.users) setAdminUsers(res.data.users); } catch {}
    setAdminUsersLoading(false);
  };

  // ═══ OPERATOR PERMISSIONS ═══
  const fetchPermissions = async () => {
    setPermLoading(true);
    try {
      const res = await supabase.functions.invoke('manage-operator-permissions', { body: { action: 'list' } });
      if (res.data?.error) { toast.error(res.data.error); }
      else {
        const d = res.data?.defaults;
        if (d) {
          const next: Perms = { ...DEFAULT_PERMS };
          for (const t of TOOL_DEFS) (next as any)[t.key] = d[t.key] !== false;
          setPermDefaults(next);
        }
        const map: Record<string, Perms> = {};
        for (const r of (res.data?.permissions || [])) {
          const p: Perms = { ...DEFAULT_PERMS };
          for (const t of TOOL_DEFS) (p as any)[t.key] = r[t.key] !== false;
          map[r.user_id] = p;
        }
        setPermRows(map);
      }
    } catch (err: any) { toast.error(err.message || 'Erro ao carregar permissões'); }
    setPermLoading(false);
  };

  const updateDefaultPerm = async (key: ToolKey, value: boolean) => {
    const next = { ...permDefaults, [key]: value };
    setPermDefaults(next);
    setPermSavingKey('__defaults__');
    try {
      const res = await supabase.functions.invoke('manage-operator-permissions', { body: { action: 'update_defaults', permissions: { [key]: value } } });
      if (res.data?.error) toast.error(res.data.error);
    } catch (err: any) { toast.error(err.message); }
    setPermSavingKey(null);
  };

  const getEffectivePerms = (userId: string): Perms => {
    return permRows[userId] || permDefaults;
  };

  const updateUserPerm = async (userId: string, key: ToolKey, value: boolean) => {
    const current = getEffectivePerms(userId);
    const next: Perms = { ...current, [key]: value };
    setPermRows(prev => ({ ...prev, [userId]: next }));
    setPermSavingKey(userId);
    try {
      const res = await supabase.functions.invoke('manage-operator-permissions', { body: { action: 'update_user', user_id: userId, permissions: next } });
      if (res.data?.error) toast.error(res.data.error);
    } catch (err: any) { toast.error(err.message); }
    setPermSavingKey(null);
  };

  const resetUserPerms = async (userId: string) => {
    setPermSavingKey(userId);
    try {
      const res = await supabase.functions.invoke('manage-operator-permissions', { body: { action: 'reset_user', user_id: userId } });
      if (res.data?.error) toast.error(res.data.error);
      else {
        setPermRows(prev => { const c = { ...prev }; delete c[userId]; return c; });
        toast.success('Permissões resetadas para o padrão');
      }
    } catch (err: any) { toast.error(err.message); }
    setPermSavingKey(null);
  };


  const handleUpdateSystemUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSystemUser) return;
    setEditSystemSaving(true);
    try {
      const body: any = { action: 'update', user_id: editingSystemUser.id };
      if (editSystemForm.email && editSystemForm.email !== editingSystemUser.email) body.email = editSystemForm.email;
      if (editSystemForm.name && editSystemForm.name !== editingSystemUser.name) body.name = editSystemForm.name;
      if (editSystemForm.password) body.password = editSystemForm.password;
      const res = await supabase.functions.invoke('update-system-user', { body });
      if (res.data?.error) { toast.error(res.data.error); } else { toast.success('Operador atualizado!'); setEditingSystemUser(null); fetchSystemUsers(); }
    } catch (err: any) { toast.error(err.message); }
    setEditSystemSaving(false);
  };

  const handleDeleteSystemUser = async (userId: string) => {
    if (!await confirmDialog({ title: 'Excluir Operador', message: 'Excluir este operador? Todos os dados serão removidos.', variant: 'danger', confirmLabel: 'Excluir' })) return;
    try {
      const res = await supabase.functions.invoke('update-system-user', { body: { action: 'delete', user_id: userId } });
      if (res.data?.error) { toast.error(res.data.error); } else { toast.success('Operador excluído!'); fetchSystemUsers(); }
    } catch (err: any) { toast.error(err.message); }
  };

  const handleUpdateAdminUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdminUser) return;
    setEditAdminSaving(true);
    try {
      const body: any = { action: 'update', user_id: editingAdminUser.id };
      if (editAdminForm.email && editAdminForm.email !== editingAdminUser.email) body.email = editAdminForm.email;
      if (editAdminForm.name && editAdminForm.name !== editingAdminUser.name) body.name = editAdminForm.name;
      if (editAdminForm.password) body.password = editAdminForm.password;
      const res = await supabase.functions.invoke('update-system-user', { body });
      if (res.data?.error) { toast.error(res.data.error); } else { toast.success('Admin atualizado!'); setEditingAdminUser(null); fetchAdminUsers(); }
    } catch (err: any) { toast.error(err.message); }
    setEditAdminSaving(false);
  };

  const handleDeleteAdminUser = async (userId: string) => {
    if (!await confirmDialog({ title: 'Excluir Admin', message: 'Excluir este admin? Todos os dados serão removidos.', variant: 'danger', confirmLabel: 'Excluir' })) return;
    try {
      const res = await supabase.functions.invoke('update-system-user', { body: { action: 'delete', user_id: userId } });
      if (res.data?.error) { toast.error(res.data.error); } else { toast.success('Admin excluído!'); fetchAdminUsers(); }
    } catch (err: any) { toast.error(err.message); }
  };

  const openEdit = (user: WheelUser) => {
    setEditingUser(user);
    setForm({ account_id: user.account_id, email: user.email, name: user.name, phone: user.phone || '', spins_available: user.spins_available });
    setShowForm(true);
  };

  const openNew = () => {
    setEditingUser(null);
    setForm({ account_id: '', email: '', name: '', phone: '', spins_available: 0 });
    setShowForm(true);
  };

  const handleExportCSV = () => {
    const header = 'Nome,E-mail,Celular,ID da Conta,Data\n';
    const rows = filteredUsers.map(u => `"${u.name}","${u.email}","${u.phone || ''}","${u.account_id}","${u.created_at || ''}"`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `usuarios_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url); toast.success('CSV exportado!');
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
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
        const { error } = await (supabase as any).from('wheel_users').insert({ name, email, phone: phone || '', account_id });
        if (error) errors++; else imported++;
      }
      toast.success(`${imported} importado(s)${errors > 0 ? `, ${errors} erro(s)` : ''}`);
      fetchUsers();
    };
    reader.readAsText(file); e.target.value = '';
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.account_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ═══ DASHBOARD CLONING ═══
  const fetchDashboards = async () => {
    setDashboardsLoading(true);
    try {
      const { data: configs } = await (supabase as any).from('wheel_configs').select('*').order('created_at', { ascending: false });
      // Fetch user info for each config
      const res = await supabase.functions.invoke('list-system-users');
      const sysUsers = res.data?.users || [];
      const userMap: Record<string, any> = {};
      sysUsers.forEach((u: any) => { userMap[u.id] = u; });
      const enriched = (configs || []).map((c: any) => ({
        ...c,
        user_email: userMap[c.user_id]?.email || '—',
        user_name: userMap[c.user_id]?.name || '—',
      }));
      setDashboardConfigs(enriched);
    } catch { }
    setDashboardsLoading(false);
  };

  const handleCloneConfig = async () => {
    if (!cloneSource || !cloneTarget) { toast.error('Informe o código de destino'); return; }
    setCloning(true);
    try {
      const source = dashboardConfigs.find((c: any) => c.id === cloneSource);
      if (!source) { toast.error('Configuração de origem não encontrada'); setCloning(false); return; }
      // Find target by clone_code
      const target = dashboardConfigs.find((c: any) => c.clone_code === cloneTarget.toUpperCase().trim());
      if (!target) { toast.error('Código de destino não encontrado'); setCloning(false); return; }
      if (target.id === cloneSource) { toast.error('Origem e destino devem ser diferentes'); setCloning(false); return; }
      const clonedConfig = JSON.parse(JSON.stringify(source.config || {}));
      const { error } = await (supabase as any)
        .from('wheel_configs')
        .update({ config: clonedConfig, updated_at: new Date().toISOString() })
        .eq('id', target.id);
      if (error) { toast.error('Erro ao clonar: ' + error.message); } else {
        toast.success('Dashboard clonado com sucesso!');
        setCloneSource(null);
        setCloneTarget('');
        fetchDashboards();
      }
    } catch (err: any) { toast.error(err.message); }
    setCloning(false);
  };


  // ═══ LOADING ═══
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground animate-pulse">Carregando...</p>
        </div>
      </div>
    );
  }

  // ═══ LOGIN ═══
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
        <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-destructive/10 blur-[120px]" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full bg-primary/10 blur-[120px]" />
        <GlassCard className="w-full max-w-sm mx-4 p-8 space-y-6 relative">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-destructive/20 border border-destructive/30 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-7 h-7 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Admin Login</h1>
            <p className="text-sm text-muted-foreground">Acesso restrito a administradores</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</label>
              <input type="email" placeholder="admin@email.com" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-destructive/40 focus:border-destructive/40 transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Senha</label>
              <input type="password" placeholder="••••••••" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-destructive/40 focus:border-destructive/40 transition-all" />
            </div>
            <button type="submit" disabled={loginLoading} className="w-full py-3.5 rounded-xl bg-destructive text-destructive-foreground font-bold text-sm disabled:opacity-50 hover:brightness-110 transition-all shadow-lg shadow-destructive/25">
              {loginLoading ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-destructive-foreground border-t-transparent rounded-full animate-spin" /> Entrando...</span> : 'Entrar'}
            </button>
          </form>
        </GlassCard>
      </div>
    );
  }

  // ═══ ACCESS DENIED ═══
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"><div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-destructive/[0.06] blur-[150px]" /></div>
        <GlassCard className="p-8 text-center space-y-4 max-w-sm mx-4 relative">
          <div className="w-16 h-16 rounded-2xl bg-destructive/20 border border-destructive/30 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Acesso Negado</h2>
          <p className="text-sm text-muted-foreground">Você não possui permissão de administrador.</p>
          <button onClick={handleLogout} className="w-full py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm hover:bg-white/[0.08] transition flex items-center justify-center gap-2">
            <LogOut size={16} /> Sair
          </button>
        </GlassCard>
      </div>
    );
  }

  const menuItems: { key: typeof activeTab; icon: React.ReactNode; label: string }[] = [
    { key: 'site', icon: <Globe size={20} />, label: 'Site' },
    { key: 'users', icon: <Users size={20} />, label: 'Inscritos' },
    { key: 'admins', icon: <UserPlus size={20} />, label: 'Usuários' },
    { key: 'permissions', icon: <ToggleLeft size={20} />, label: 'Permissões' },
    { key: 'dashboards', icon: <Monitor size={20} />, label: 'Dashboards' },
    { key: 'history', icon: <Trophy size={20} />, label: 'Histórico' },
  ];

  const tabTitles: Record<string, string> = {
    site: 'Configurações do Site',
    users: 'Todos os Inscritos',
    admins: 'Gerenciar Usuários',
    permissions: 'Permissões dos Operadores',
    dashboards: 'Clonagem de Dashboards',
    history: 'Histórico Global',
  };

  return (
    <div className="min-h-screen bg-background flex relative overflow-x-hidden">
      <ThemeSettingsPanel storageKey="admin_theme" />
      <div id="theme-bg-layer" className="fixed inset-0 pointer-events-none z-0 bg-cover bg-center bg-no-repeat opacity-15" style={{ backgroundImage: 'var(--theme-bg-image, none)' }} />
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-destructive/[0.03] blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-primary/[0.03] blur-[120px]" />
      </div>

      {/* ═══ SIDEBAR ═══ */}
      <aside className={`hidden lg:flex fixed top-0 left-0 h-full z-30 flex-col transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${sidebarCollapsed ? 'w-[72px]' : 'w-[260px]'}`}>
        <div className="flex-1 m-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-2xl shadow-[0_8px_40px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden">
          {/* Logo */}
          <div className={`flex items-center border-b border-white/[0.06] ${sidebarCollapsed ? 'p-3 justify-center' : 'px-5 py-5'}`}>
            {!sidebarCollapsed && (
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-destructive/20 border border-destructive/30 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5 text-destructive" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-sm font-bold text-foreground truncate">Admin</h1>
                  <p className="text-[10px] text-muted-foreground truncate">{session.user.email}</p>
                </div>
              </div>
            )}
            {sidebarCollapsed && (
              <div className="w-9 h-9 rounded-xl bg-destructive/20 border border-destructive/30 flex items-center justify-center">
                <Shield className="w-5 h-5 text-destructive" />
              </div>
            )}
          </div>

          {/* Nav */}
          <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
            {menuItems.map(item => (
              <button
                key={item.key}
                onClick={() => { setActiveTab(item.key); if (item.key === 'history') fetchHistory(); if (item.key === 'admins') { fetchSystemUsers(); fetchAdminUsers(); } if (item.key === 'dashboards') fetchDashboards(); if (item.key === 'permissions') { fetchSystemUsers(); fetchPermissions(); } }}
                title={sidebarCollapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 rounded-xl text-sm transition-all duration-200 group relative ${sidebarCollapsed ? 'justify-center px-0 py-3' : 'px-4 py-2.5'} ${
                  activeTab === item.key
                    ? 'bg-primary/15 text-primary font-semibold'
                    : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground'
                }`}
              >
                {activeTab === item.key && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />}
                <span className={`shrink-0 transition-transform duration-200 ${activeTab === item.key ? 'scale-110' : 'group-hover:scale-105'}`}>{item.icon}</span>
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            ))}
          </nav>

          {/* Bottom */}
          <div className="p-2 space-y-1 border-t border-white/[0.06]">
            <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className={`w-full flex items-center gap-3 rounded-xl text-sm text-muted-foreground hover:bg-white/[0.04] hover:text-foreground transition-all ${sidebarCollapsed ? 'justify-center py-2.5' : 'px-4 py-2.5'}`}>
              {sidebarCollapsed ? <ChevronRight size={18} /> : <><ChevronLeft size={18} /><span>Recolher</span></>}
            </button>
            <button onClick={handleLogout} className={`w-full flex items-center gap-3 rounded-xl text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all ${sidebarCollapsed ? 'justify-center py-2.5' : 'px-4 py-2.5'}`}>
              <LogOut size={18} />{!sidebarCollapsed && <span>Sair</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* ═══ MOBILE NAV ═══ */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30">
        <div className="border-b border-white/[0.06] bg-background/80 backdrop-blur-2xl">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-destructive/20 border border-destructive/30 flex items-center justify-center">
                <Shield className="w-4 h-4 text-destructive" />
              </div>
              <h1 className="text-sm font-bold text-foreground">Admin</h1>
            </div>
            <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-white/[0.05] text-muted-foreground hover:text-foreground transition-all">
              <LogOut size={18} />
            </button>
          </div>
          <div className="flex gap-1 px-3 pb-2.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {menuItems.map(item => (
              <button
                key={item.key}
                onClick={() => { setActiveTab(item.key); if (item.key === 'history') fetchHistory(); if (item.key === 'admins') { fetchSystemUsers(); fetchAdminUsers(); } if (item.key === 'dashboards') fetchDashboards(); if (item.key === 'permissions') { fetchSystemUsers(); fetchPermissions(); } }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                  activeTab === item.key
                    ? 'bg-primary/15 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                {item.icon}<span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ MAIN ═══ */}
      <div className={`flex-1 min-w-0 pt-28 lg:pt-0 p-4 md:p-6 transition-all duration-500 relative z-10 ${sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-[260px]'}`}>
        <div className="max-w-6xl mx-auto lg:py-6 space-y-5">

          {/* Title bar */}
          <div>
            <h2 className="text-xl font-bold text-foreground">{tabTitles[activeTab]}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{users.length} inscritos globais • {spinResults.length} giros totais</p>
          </div>

          {/* ══════ SITE TAB ══════ */}
          {activeTab === 'site' && (
            <GlassCard className="p-6 space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2"><Globe size={16} className="text-primary" /> Configurações Globais</h3>
                <p className="text-xs text-muted-foreground">Estas configurações são aplicadas na página principal e como padrão para operadores que não definiram configurações próprias.</p>
              </div>

              {/* Home Mode Selector */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Modo da Página Principal</label>
                <div className="flex gap-2">
                  {([['text', 'Título + Descrição'], ['image', 'Somente Imagem'], ['image_text', 'Imagem + Texto']] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      onClick={() => setSiteSettings(s => ({ ...s, home_mode: mode }))}
                      className="flex-1 py-2.5 rounded-xl border text-xs font-semibold transition-all"
                      style={{
                        borderColor: siteSettings.home_mode === mode ? 'hsl(var(--primary))' : 'rgba(255,255,255,0.08)',
                        background: siteSettings.home_mode === mode ? 'hsl(var(--primary) / 0.15)' : 'rgba(255,255,255,0.04)',
                        color: siteSettings.home_mode === mode ? 'hsl(var(--primary))' : 'inherit',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title (shown for 'text' and 'image_text') */}
              {(siteSettings.home_mode === 'text' || siteSettings.home_mode === 'image_text') && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Título do Site</label>
                  <input type="text" value={siteSettings.site_title} onChange={e => setSiteSettings(s => ({ ...s, site_title: e.target.value }))} placeholder="Wheel of Fortune" className="w-full px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all" />
                </div>
              )}

              {/* Description (shown for 'text' and 'image_text') */}
              {(siteSettings.home_mode === 'text' || siteSettings.home_mode === 'image_text') && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Descrição</label>
                  <textarea value={siteSettings.site_description} onChange={e => setSiteSettings(s => ({ ...s, site_description: e.target.value }))} placeholder="Descrição do site..." rows={3} className="w-full px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all resize-none" />
                </div>
              )}

              {/* Favicon */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Favicon</label>
                <div className="flex items-center gap-4">
                  {siteSettings.favicon_url && (
                    <div className="w-12 h-12 rounded-xl border border-white/[0.08] bg-white/[0.04] flex items-center justify-center overflow-hidden">
                      <img src={siteSettings.favicon_url} alt="Favicon" className="w-8 h-8 object-contain" />
                    </div>
                  )}
                  <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm cursor-pointer hover:bg-white/[0.08] transition">
                    <Upload size={15} />
                    {siteFaviconUploading ? 'Enviando...' : siteSettings.favicon_url ? 'Trocar' : 'Enviar Favicon'}
                    <input type="file" accept="image/*" onChange={handleSiteFaviconUpload} className="hidden" disabled={siteFaviconUploading} />
                  </label>
                  {siteSettings.favicon_url && (
                    <button onClick={() => setSiteSettings(s => ({ ...s, favicon_url: '' }))} className="px-3 py-2 rounded-xl border border-destructive/20 text-destructive text-xs hover:bg-destructive/10 transition">Remover</button>
                  )}
                </div>
              </div>

              {/* Background */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Background da Página Principal</label>
                {siteSettings.bg_image_url ? (
                  <div className="space-y-3">
                    <div className="relative rounded-xl overflow-hidden border border-white/[0.08]">
                      <img src={siteSettings.bg_image_url} alt="Background" className="w-full h-40 object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    </div>
                    <div className="flex gap-2">
                      <label className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm cursor-pointer hover:bg-white/[0.08] transition">
                        <Upload size={14} /> Trocar
                        <input type="file" accept="image/*" onChange={handleSiteBgUpload} className="hidden" />
                      </label>
                      <button onClick={() => setSiteSettings(s => ({ ...s, bg_image_url: '' }))} className="flex-1 py-2.5 rounded-xl border border-destructive/20 text-destructive text-sm hover:bg-destructive/10 transition">Remover</button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-2 py-10 rounded-xl border-2 border-dashed border-white/[0.1] hover:border-primary/30 cursor-pointer transition group">
                    <Upload size={28} className="text-muted-foreground group-hover:text-primary transition" />
                    <span className="text-sm text-muted-foreground group-hover:text-foreground transition">
                      {siteUploading ? 'Enviando...' : 'Clique para enviar imagem de fundo'}
                    </span>
                    <input type="file" accept="image/*" onChange={handleSiteBgUpload} className="hidden" disabled={siteUploading} />
                  </label>
                )}
              </div>

              {/* API Backend */}
              <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">🔗 API Backend (Laravel)</label>
                <input type="text" value={apiBackendUrl} onChange={e => { setApiBackendUrl(e.target.value); localStorage.setItem('wheel_api_url', e.target.value); }} placeholder="https://seusite.com" className="w-full px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all" />
                <p className="text-[10px] text-muted-foreground">URL base da API Laravel. Aplicada globalmente para todos os operadores.</p>
              </div>

              <button onClick={handleSaveSiteSettings} disabled={siteSaving} className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 hover:brightness-110 transition-all shadow-lg shadow-primary/20">
                {siteSaving ? 'Salvando...' : 'Salvar Configurações'}
              </button>
            </GlassCard>
          )}

          {/* ══════ USERS TAB ══════ */}
          {activeTab === 'users' && (
            <>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="text" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all" />
                </div>
                <div className="flex gap-2">
                  <label className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm hover:bg-white/[0.08] transition cursor-pointer">
                    <FileUp size={15} /><span className="hidden sm:inline">Importar</span>
                    <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
                  </label>
                  <button onClick={handleExportCSV} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm hover:bg-white/[0.08] transition">
                    <FileDown size={15} /><span className="hidden sm:inline">Exportar</span>
                  </button>
                  <button onClick={openNew} className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:brightness-110 transition shadow-lg shadow-primary/20">
                    <Plus size={15} /><span className="hidden sm:inline">Novo</span>
                  </button>
                </div>
              </div>

              {/* Bulk actions */}
              <GlassCard className="p-3 flex flex-wrap items-center gap-2">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mr-1">Ações em massa:</span>
                <button onClick={() => handleToggleAllSpins(true)} className="px-3 py-1.5 rounded-lg bg-primary/15 text-primary border border-primary/20 text-xs font-medium hover:bg-primary/25 transition">
                  Liberar giros
                </button>
                <button onClick={() => handleToggleAllSpins(false)} className="px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] text-foreground text-xs font-medium hover:bg-white/[0.08] transition">
                  Remover giros
                </button>
                <div className="flex-1" />
                <button onClick={handleDeleteAll} className="px-3 py-1.5 rounded-lg border border-destructive/20 text-destructive text-xs font-medium hover:bg-destructive/10 transition flex items-center gap-1">
                  <Trash2 size={12} /> Excluir todos
                </button>
              </GlassCard>

              {/* Modal */}
              {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                  <GlassCard className="w-full max-w-md mx-4 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-bold text-foreground">{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</h2>
                      <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-white/[0.08] text-muted-foreground hover:text-foreground transition"><X size={18} /></button>
                    </div>
                    <form onSubmit={handleSaveUser} className="space-y-3">
                      {[
                        { label: 'Nome', key: 'name', type: 'text', required: true },
                        { label: 'Email', key: 'email', type: 'email', required: true },
                        { label: 'Celular', key: 'phone', type: 'text', required: false },
                        { label: 'Account ID', key: 'account_id', type: 'text', required: true },
                      ].map(f => (
                        <div key={f.key} className="space-y-1">
                          <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{f.label}</label>
                          <input type={f.type} required={f.required} value={(form as any)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
                        </div>
                      ))}
                      <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm hover:bg-white/[0.08] transition">Cancelar</button>
                        <button type="submit" className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:brightness-110 transition shadow-lg shadow-primary/20">{editingUser ? 'Salvar' : 'Criar'}</button>
                      </div>
                    </form>
                  </GlassCard>
                </div>
              )}

              {/* Table */}
              {usersLoading ? (
                <div className="text-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" /><span className="text-muted-foreground">Carregando...</span></div>
              ) : filteredUsers.length === 0 ? (
                <GlassCard className="text-center py-16">
                  <Users size={40} className="text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">{searchTerm ? 'Nenhum resultado' : 'Nenhum inscrito'}</p>
                </GlassCard>
              ) : (
                <GlassCard className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[760px]">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left px-4 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider w-10">#</th>
                        <th className="text-left px-4 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Nome</th>
                        <th className="text-left px-4 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Email</th>
                        <th className="text-left px-4 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider w-28">Celular</th>
                        <th className="text-left px-4 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider w-32">Account ID</th>
                        <th className="text-center px-4 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider w-48">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user, index) => (
                        <tr key={user.id} className="border-t border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                          <td className="px-4 py-3 text-muted-foreground text-xs">{index + 1}</td>
                          <td className="px-4 py-3 text-foreground font-medium truncate">{user.name}</td>
                          <td className="px-4 py-3 text-muted-foreground truncate">{user.email}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{user.phone}</td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground truncate">{user.account_id}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1.5">
                              <button onClick={() => handleGrantSpin(user)} className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${user.spins_available >= 1 ? 'bg-primary/15 text-primary border border-primary/20 hover:bg-destructive/15 hover:text-destructive hover:border-destructive/20' : 'bg-white/[0.06] text-foreground hover:bg-primary/15 hover:text-primary border border-white/[0.08]'}`}>
                                {user.spins_available >= 1 ? '1 giro ✓' : 'Liberar'}
                              </button>
                              <button onClick={() => openEdit(user)} className="p-1.5 rounded-lg bg-white/[0.06] text-muted-foreground hover:text-foreground hover:bg-white/[0.1] transition border border-white/[0.06]" title="Editar"><Pencil size={13} /></button>
                              <button onClick={() => handleDeleteUser(user.id)} className="p-1.5 rounded-lg bg-white/[0.06] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition border border-white/[0.06]" title="Excluir"><Trash2 size={13} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </GlassCard>
              )}
              <p className="text-xs text-muted-foreground">{filteredUsers.length} usuário(s){searchTerm && ` de ${users.length} total`}</p>
            </>
          )}


          {/* ══════ ADMINS / CREATE USERS ══════ */}
          {activeTab === 'admins' && (
            <div className="space-y-6">
              <GlassCard className="p-6 max-w-md space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                    <UserPlus className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Criar Novo Operador</h3>
                    <p className="text-[10px] text-muted-foreground">Operadores podem personalizar sua roleta</p>
                  </div>
                </div>

                {!showAdminForm ? (
                  <button onClick={() => setShowAdminForm(true)} className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:brightness-110 transition shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                    <Plus size={16} /> Novo Operador
                  </button>
                ) : (
                  <form onSubmit={handleCreateAdmin} className="space-y-3 pt-2 border-t border-white/[0.06]">
                    {[
                      { label: 'Nome', key: 'name', type: 'text', placeholder: 'Nome do operador' },
                      { label: 'Email', key: 'email', type: 'email', placeholder: 'operador@email.com' },
                      { label: 'Senha', key: 'password', type: 'password', placeholder: 'Mínimo 6 caracteres' },
                    ].map(f => (
                      <div key={f.key} className="space-y-1">
                        <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{f.label}</label>
                        <input type={f.type} required={f.key !== 'name'} minLength={f.key === 'password' ? 6 : undefined} value={(adminForm as any)[f.key]} onChange={e => setAdminForm({ ...adminForm, [f.key]: e.target.value })} placeholder={f.placeholder} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
                      </div>
                    ))}
                    <div className="flex gap-3 pt-2">
                      <button type="button" onClick={() => setShowAdminForm(false)} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm hover:bg-white/[0.08] transition">Cancelar</button>
                      <button type="submit" disabled={adminCreating} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 hover:brightness-110 transition shadow-lg shadow-primary/20">
                        {adminCreating ? 'Criando...' : 'Criar'}
                      </button>
                    </div>
                  </form>
                )}
              </GlassCard>

              {/* ══ Edit System User Modal ══ */}
              {editingSystemUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                  <GlassCard className="w-full max-w-md mx-4 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-bold text-foreground flex items-center gap-2"><KeyRound size={18} /> Editar Operador</h2>
                      <button onClick={() => setEditingSystemUser(null)} className="p-1.5 rounded-lg hover:bg-white/[0.08] text-muted-foreground hover:text-foreground transition"><X size={18} /></button>
                    </div>
                    <p className="text-xs text-muted-foreground">Editando: {editingSystemUser.email}</p>
                    <form onSubmit={handleUpdateSystemUser} className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Nome</label>
                        <input type="text" value={editSystemForm.name} onChange={e => setEditSystemForm({ ...editSystemForm, name: e.target.value })} placeholder={editingSystemUser.name} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Email</label>
                        <input type="email" value={editSystemForm.email} onChange={e => setEditSystemForm({ ...editSystemForm, email: e.target.value })} placeholder={editingSystemUser.email} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Nova Senha</label>
                        <input type="password" value={editSystemForm.password} onChange={e => setEditSystemForm({ ...editSystemForm, password: e.target.value })} placeholder="Deixe vazio para manter" minLength={6} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setEditingSystemUser(null)} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm hover:bg-white/[0.08] transition">Cancelar</button>
                        <button type="submit" disabled={editSystemSaving} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 hover:brightness-110 transition shadow-lg shadow-primary/20">
                          {editSystemSaving ? 'Salvando...' : 'Salvar'}
                        </button>
                      </div>
                    </form>
                  </GlassCard>
                </div>
              )}

              {/* ══ Edit Admin User Modal ══ */}
              {editingAdminUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                  <GlassCard className="w-full max-w-md mx-4 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-bold text-foreground flex items-center gap-2"><KeyRound size={18} /> Editar Admin</h2>
                      <button onClick={() => setEditingAdminUser(null)} className="p-1.5 rounded-lg hover:bg-white/[0.08] text-muted-foreground hover:text-foreground transition"><X size={18} /></button>
                    </div>
                    <p className="text-xs text-muted-foreground">Editando: {editingAdminUser.email}</p>
                    <form onSubmit={handleUpdateAdminUser} className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Nome</label>
                        <input type="text" value={editAdminForm.name} onChange={e => setEditAdminForm({ ...editAdminForm, name: e.target.value })} placeholder={editingAdminUser.name} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Email</label>
                        <input type="email" value={editAdminForm.email} onChange={e => setEditAdminForm({ ...editAdminForm, email: e.target.value })} placeholder={editingAdminUser.email} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Nova Senha</label>
                        <input type="password" value={editAdminForm.password} onChange={e => setEditAdminForm({ ...editAdminForm, password: e.target.value })} placeholder="Deixe vazio para manter" minLength={6} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setEditingAdminUser(null)} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm hover:bg-white/[0.08] transition">Cancelar</button>
                        <button type="submit" disabled={editAdminSaving} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 hover:brightness-110 transition shadow-lg shadow-primary/20">
                          {editAdminSaving ? 'Salvando...' : 'Salvar'}
                        </button>
                      </div>
                    </form>
                  </GlassCard>
                </div>
              )}

              {/* ══ Operators List ══ */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground">Operadores</h3>
                  <button onClick={fetchSystemUsers} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm hover:bg-white/[0.08] transition">
                    <RotateCcw size={14} /> Carregar
                  </button>
                </div>
                {systemUsersLoading ? (
                  <div className="text-center py-8"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
                ) : systemUsers.length === 0 ? (
                  <GlassCard className="text-center py-12">
                    <UserPlus size={36} className="text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">Clique em "Carregar" para ver os operadores</p>
                  </GlassCard>
                ) : (
                  <GlassCard className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[640px]">
                      <thead>
                        <tr className="border-b border-white/[0.06]">
                          <th className="text-left px-4 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider w-10">#</th>
                          <th className="text-left px-4 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Nome</th>
                          <th className="text-left px-4 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Email</th>
                          <th className="text-left px-4 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Criado em</th>
                          <th className="text-center px-4 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider w-32">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {systemUsers.map((u: any, i: number) => (
                          <tr key={u.id} className="border-t border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                            <td className="px-4 py-3 text-muted-foreground text-xs">{i + 1}</td>
                            <td className="px-4 py-3 text-foreground font-medium">{u.name}</td>
                            <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">{u.created_at ? new Date(u.created_at).toLocaleString('pt-BR') : '—'}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-1.5">
                                <button onClick={() => { setEditingSystemUser(u); setEditSystemForm({ email: u.email, name: u.name, password: '' }); }} className="p-1.5 rounded-lg bg-white/[0.06] text-muted-foreground hover:text-foreground hover:bg-white/[0.1] transition border border-white/[0.06]" title="Editar"><Pencil size={13} /></button>
                                <button onClick={() => { fetchPermissions(); setEditingPermsUser(u); }} className="p-1.5 rounded-lg bg-white/[0.06] text-muted-foreground hover:text-primary hover:bg-primary/10 transition border border-white/[0.06]" title="Permissões"><ToggleLeft size={13} /></button>
                                <button onClick={() => handleDeleteSystemUser(u.id)} className="p-1.5 rounded-lg bg-white/[0.06] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition border border-white/[0.06]" title="Excluir"><Trash2 size={13} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </GlassCard>
                )}
                <p className="text-xs text-muted-foreground">{systemUsers.length} operador(es)</p>
              </div>

              {/* ══ Admins List ══ */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Shield size={16} className="text-destructive" /> Administradores</h3>
                  <button onClick={fetchAdminUsers} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm hover:bg-white/[0.08] transition">
                    <RotateCcw size={14} /> Carregar
                  </button>
                </div>
                {adminUsersLoading ? (
                  <div className="text-center py-8"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
                ) : adminUsers.length === 0 ? (
                  <GlassCard className="text-center py-12">
                    <Shield size={36} className="text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">Clique em "Carregar" para ver os admins</p>
                  </GlassCard>
                ) : (
                  <GlassCard className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[640px]">
                      <thead>
                        <tr className="border-b border-white/[0.06]">
                          <th className="text-left px-4 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider w-10">#</th>
                          <th className="text-left px-4 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Nome</th>
                          <th className="text-left px-4 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Email</th>
                          <th className="text-left px-4 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Criado em</th>
                          <th className="text-center px-4 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider w-32">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminUsers.map((u: any, i: number) => (
                          <tr key={u.id} className="border-t border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                            <td className="px-4 py-3 text-muted-foreground text-xs">{i + 1}</td>
                            <td className="px-4 py-3 text-foreground font-medium">{u.name}</td>
                            <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">{u.created_at ? new Date(u.created_at).toLocaleString('pt-BR') : '—'}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-1.5">
                                <button onClick={() => { setEditingAdminUser(u); setEditAdminForm({ email: u.email, name: u.name, password: '' }); }} className="p-1.5 rounded-lg bg-white/[0.06] text-muted-foreground hover:text-foreground hover:bg-white/[0.1] transition border border-white/[0.06]" title="Editar"><Pencil size={13} /></button>
                                <button onClick={() => handleDeleteAdminUser(u.id)} className="p-1.5 rounded-lg bg-white/[0.06] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition border border-white/[0.06]" title="Excluir"><Trash2 size={13} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </GlassCard>
                )}
                <p className="text-xs text-muted-foreground">{adminUsers.length} admin(s)</p>
              </div>
            </div>
          )}

          {/* ══════ DASHBOARDS TAB ══════ */}
          {activeTab === 'permissions' && (
            <div className="space-y-6">
              {/* Per-operator modal */}
              {editingPermsUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                  <GlassCard className="w-full max-w-md p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-bold text-foreground flex items-center gap-2"><ToggleLeft size={18} /> Permissões</h2>
                      <button onClick={() => setEditingPermsUser(null)} className="p-1.5 rounded-lg hover:bg-white/[0.08] text-muted-foreground hover:text-foreground transition"><X size={18} /></button>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Operador</p>
                      <p className="text-sm font-medium text-foreground">{editingPermsUser.name} <span className="text-muted-foreground">· {editingPermsUser.email}</span></p>
                      {!permRows[editingPermsUser.id] && (
                        <p className="text-[10px] text-muted-foreground italic">Usando padrão global. Alterar abaixo cria override.</p>
                      )}
                    </div>
                    <div className="space-y-2.5 pt-2 border-t border-white/[0.06]">
                      {TOOL_DEFS.map(t => {
                        const eff = getEffectivePerms(editingPermsUser.id);
                        return (
                          <div key={t.key} className="flex items-center justify-between gap-3 py-1">
                            <span className="text-sm text-foreground">{t.label}</span>
                            <Switch checked={eff[t.key]} onCheckedChange={(v) => updateUserPerm(editingPermsUser.id, t.key, v)} disabled={permSavingKey === editingPermsUser.id} />
                          </div>
                        );
                      })}
                    </div>
                    {permRows[editingPermsUser.id] && (
                      <button onClick={() => resetUserPerms(editingPermsUser.id)} disabled={permSavingKey === editingPermsUser.id} className="w-full py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-xs hover:bg-white/[0.08] transition flex items-center justify-center gap-2">
                        <RotateCw size={13} /> Voltar ao padrão global
                      </button>
                    )}
                  </GlassCard>
                </div>
              )}

              {/* Global defaults */}
              <GlassCard className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                    <Globe className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Padrão Global</h3>
                    <p className="text-[10px] text-muted-foreground">Aplica-se a todos os operadores sem override</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-white/[0.06]">
                  {TOOL_DEFS.map(t => (
                    <div key={t.key} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                      <span className="text-sm text-foreground">{t.label}</span>
                      <Switch checked={permDefaults[t.key]} onCheckedChange={(v) => updateDefaultPerm(t.key, v)} disabled={permSavingKey === '__defaults__'} />
                    </div>
                  ))}
                </div>
              </GlassCard>

              {/* Per-operator overview */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground">Por Operador</h3>
                  <button onClick={() => { fetchSystemUsers(); fetchPermissions(); }} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm hover:bg-white/[0.08] transition">
                    <RotateCcw size={14} /> Recarregar
                  </button>
                </div>
                {permLoading || systemUsersLoading ? (
                  <div className="text-center py-8"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
                ) : systemUsers.length === 0 ? (
                  <GlassCard className="text-center py-12">
                    <Users size={36} className="text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">Nenhum operador encontrado.</p>
                  </GlassCard>
                ) : (
                  <GlassCard className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[720px]">
                      <thead>
                        <tr className="border-b border-white/[0.06]">
                          <th className="text-left px-4 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Operador</th>
                          {TOOL_DEFS.map(t => (
                            <th key={t.key} className="text-center px-2 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{t.label}</th>
                          ))}
                          <th className="text-center px-4 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider w-24">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {systemUsers.map((u: any) => {
                          const eff = getEffectivePerms(u.id);
                          const hasOverride = !!permRows[u.id];
                          return (
                            <tr key={u.id} className="border-t border-white/[0.04] hover:bg-white/[0.03]">
                              <td className="px-4 py-3">
                                <div className="text-foreground font-medium text-sm">{u.name}</div>
                                <div className="text-muted-foreground text-xs">{u.email}</div>
                                {hasOverride && <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] bg-primary/15 text-primary border border-primary/20">Override</span>}
                              </td>
                              {TOOL_DEFS.map(t => (
                                <td key={t.key} className="px-2 py-3 text-center">
                                  <Switch checked={eff[t.key]} onCheckedChange={(v) => updateUserPerm(u.id, t.key, v)} disabled={permSavingKey === u.id} />
                                </td>
                              ))}
                              <td className="px-4 py-3 text-center">
                                {hasOverride && (
                                  <button onClick={() => resetUserPerms(u.id)} disabled={permSavingKey === u.id} className="p-1.5 rounded-lg bg-white/[0.06] text-muted-foreground hover:text-foreground hover:bg-white/[0.1] transition border border-white/[0.06]" title="Resetar para padrão"><RotateCw size={13} /></button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </GlassCard>
                )}
              </div>
            </div>
          )}

          {activeTab === 'dashboards' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Gerencie e clone configurações visuais entre dashboards</p>
                <button onClick={fetchDashboards} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm hover:bg-white/[0.08] transition">
                  <RotateCcw size={14} /> Atualizar
                </button>
              </div>

              {/* Clone Panel */}
              {cloneSource && (
                <GlassCard className="p-5 space-y-4 border-primary/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                      <Copy className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Clonar Dashboard</h3>
                      <p className="text-[10px] text-muted-foreground">
                        Origem: <span className="text-primary font-semibold font-mono">{dashboardConfigs.find(c => c.id === cloneSource)?.clone_code || '—'}</span>
                        {' '}({dashboardConfigs.find(c => c.id === cloneSource)?.user_name})
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Código do Dashboard Destino</label>
                    <input
                      type="text"
                      value={cloneTarget}
                      onChange={e => setCloneTarget(e.target.value.toUpperCase())}
                      placeholder="Cole o código do dashboard destino..."
                      className="w-full px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm font-mono tracking-wider focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all placeholder:text-muted-foreground/40"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => { setCloneSource(null); setCloneTarget(''); }} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm hover:bg-white/[0.08] transition">Cancelar</button>
                    <button onClick={handleCloneConfig} disabled={cloning || !cloneTarget.trim()} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 hover:brightness-110 transition shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                      {cloning ? <><div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> Clonando...</> : <><Copy size={14} /> Clonar Visual</>}
                    </button>
                  </div>
                </GlassCard>
              )}

              {/* Dashboard List */}
              {dashboardsLoading ? (
                <div className="text-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" /><span className="text-muted-foreground">Carregando...</span></div>
              ) : dashboardConfigs.length === 0 ? (
                <GlassCard className="text-center py-16">
                  <Monitor size={40} className="text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">Nenhum dashboard encontrado</p>
                </GlassCard>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {dashboardConfigs.map((cfg: any) => {
                    const segments = (cfg.config as any)?.segments || [];
                    const segCount = segments.length;
                    return (
                      <GlassCard key={cfg.id} className={`p-5 space-y-4 transition-all ${cloneSource === cfg.id ? 'ring-2 ring-primary/40' : ''}`}>
                        {/* Code badge */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center">
                              <Monitor size={14} className="text-primary" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-foreground">{cfg.user_name}</p>
                              <p className="text-[10px] text-muted-foreground">{cfg.user_email}</p>
                            </div>
                          </div>
                        </div>

                        {/* Clone Code */}
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Código de Clonagem</label>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-primary font-mono text-sm font-bold tracking-widest text-center">{cfg.clone_code}</code>
                            <button
                              onClick={() => { navigator.clipboard.writeText(cfg.clone_code); toast.success('Código copiado!'); }}
                              className="p-2 rounded-lg bg-white/[0.06] text-muted-foreground hover:text-foreground hover:bg-white/[0.1] transition border border-white/[0.06]"
                              title="Copiar código"
                            >
                              <Copy size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Slug */}
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <Globe size={10} /> <span className="truncate">/{cfg.slug}</span>
                        </div>

                        {/* Info */}
                        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                          <span>{segCount} segmento(s)</span>
                          <span>Criado: {new Date(cfg.created_at).toLocaleDateString('pt-BR')}</span>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <a
                            href={`/roleta/${cfg.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-xs font-medium hover:bg-white/[0.08] transition"
                          >
                            <Eye size={12} /> Ver
                          </a>
                          <button
                            onClick={() => { setCloneSource(cfg.id); setCloneTarget(''); }}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition ${
                              cloneSource === cfg.id
                                ? 'bg-primary/20 text-primary border border-primary/30'
                                : 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20'
                            }`}
                          >
                            <Copy size={12} /> Clonar
                          </button>
                        </div>
                      </GlassCard>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-muted-foreground">{dashboardConfigs.length} dashboard(s)</p>
            </div>
          )}

          {/* ══════ HISTORY ══════ */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-end">
                <button onClick={fetchHistory} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm hover:bg-white/[0.08] transition">
                  <RotateCcw size={14} /> Atualizar
                </button>
              </div>
              {historyLoading ? (
                <div className="text-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" /><span className="text-muted-foreground">Carregando...</span></div>
              ) : spinResults.length === 0 ? (
                <GlassCard className="text-center py-16">
                  <Trophy size={40} className="text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">Nenhum resultado registrado</p>
                </GlassCard>
              ) : (
                <GlassCard className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[820px]">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left px-4 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider w-10">#</th>
                        <th className="text-left px-4 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Operador</th>
                        <th className="text-left px-4 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Nome</th>
                        <th className="text-left px-4 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Email</th>
                        <th className="text-left px-4 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Account ID</th>
                        <th className="text-left px-4 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Prêmio</th>
                        <th className="text-left px-4 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {spinResults.map((r: any, i: number) => (
                        <tr key={r.id} className="border-t border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                          <td className="px-4 py-3 text-muted-foreground text-xs">{i + 1}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 rounded-lg bg-accent/10 text-accent text-xs font-medium border border-accent/20">{r.owner_slug}</span>
                          </td>
                          <td className="px-4 py-3 text-foreground font-medium">{r.user_name}</td>
                          <td className="px-4 py-3 text-muted-foreground">{r.user_email}</td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.account_id}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 rounded-lg bg-primary/15 text-primary text-xs font-bold border border-primary/20">{r.prize}</span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(r.spun_at).toLocaleString('pt-BR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </GlassCard>
              )}
              <p className="text-xs text-muted-foreground">{spinResults.length} resultado(s)</p>
            </div>
          )}

        </div>
      </div>
      {ConfirmDialog}
    </div>
  );
};

export default Admin;
