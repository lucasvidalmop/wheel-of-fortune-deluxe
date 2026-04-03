import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import CustomizationPanel from '@/components/casino/CustomizationPanel';
import AuthConfigPanel from '@/components/casino/AuthConfigPanel';
import { WheelConfig, defaultConfig } from '@/components/casino/types';

interface WheelUser {
  id: string;
  account_id: string;
  email: string;
  phone: string;
  name: string;
  spins_available: number;
  created_at: string;
  fixed_prize_enabled: boolean;
  fixed_prize_segment: number | null;
}

const Dashboard = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<'inscritos' | 'wheel' | 'auth' | 'history' | 'email' | 'sms' | 'whatsapp'>('inscritos');
  const [users, setUsers] = useState<WheelUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<WheelUser | null>(null);
  const [form, setForm] = useState({ account_id: '', email: '', name: '', phone: '', fixed_prize_enabled: false, fixed_prize_segment: null as number | null });
  const [spinResults, setSpinResults] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [viewingUserData, setViewingUserData] = useState<WheelUser | null>(null);
  const [viewingUserLoading, setViewingUserLoading] = useState(false);

  const [emailSubject, setEmailSubject] = useState('🎰 Você tem um giro disponível!');
  const [emailBody, setEmailBody] = useState('Olá! Você foi convidado para girar a roleta e concorrer a prêmios incríveis. Acesse o link abaixo e boa sorte!');
  const [emailSending, setEmailSending] = useState(false);
  const [emailTarget, setEmailTarget] = useState<'all' | 'selected'>('all');
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [emailTemplate, setEmailTemplate] = useState<'original' | 'custom'>('original');
  const [emailBannerUrl, setEmailBannerUrl] = useState('');
  const [emailBannerUploading, setEmailBannerUploading] = useState(false);
  const [emailSenderName, setEmailSenderName] = useState('Royal Spin Wheel');

  // SMS state
  const [smsMessage, setSmsMessage] = useState('');
  const [smsSending, setSmsSending] = useState(false);
  const [smsTarget, setSmsTarget] = useState<'all' | 'selected'>('all');
  const [selectedPhones, setSelectedPhones] = useState<string[]>([]);
  const [showSmsConfig, setShowSmsConfig] = useState(false);
  const [twilioAccountSid, setTwilioAccountSid] = useState(() => localStorage.getItem('twilio_account_sid') || '');
  const [twilioAuthToken, setTwilioAuthToken] = useState(() => localStorage.getItem('twilio_auth_token') || '');
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState(() => localStorage.getItem('twilio_phone_number') || '');

  // WhatsApp state
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [whatsappSending, setWhatsappSending] = useState(false);
  const [whatsappTarget, setWhatsappTarget] = useState<'all' | 'selected'>('all');
  const [selectedWhatsappPhones, setSelectedWhatsappPhones] = useState<string[]>([]);
  const [showWhatsappConfig, setShowWhatsappConfig] = useState(false);
  const [evolutionApiUrl, setEvolutionApiUrl] = useState(() => localStorage.getItem('evolution_api_url') || '');
  const [evolutionApiKey, setEvolutionApiKey] = useState(() => localStorage.getItem('evolution_api_key') || '');
  const [evolutionInstance, setEvolutionInstance] = useState(() => localStorage.getItem('evolution_instance') || '');

  const [slug, setSlug] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
    let { data: cfg } = await (supabase as any)
      .from('wheel_configs')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!cfg) {
      const generatedSlug = `roleta-${userId.slice(0, 8)}`;
      const { data: created } = await (supabase as any)
        .from('wheel_configs')
        .insert({ user_id: userId, slug: generatedSlug, config: {} })
        .select('*')
        .maybeSingle();
      cfg = created || null;
    }

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

    const { data, error } = await (supabase as any)
      .from('spin_results')
      .select('*')
      .eq('owner_id', uid)
      .order('spun_at', { ascending: false });

    if (error) {
      toast.error('Erro ao carregar histórico');
      setSpinResults([]);
    } else {
      setSpinResults(data || []);
    }
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

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      const { error } = await (supabase as any)
        .from('wheel_users')
        .update({ account_id: form.account_id, email: form.email, name: form.name, phone: form.phone, fixed_prize_enabled: form.fixed_prize_enabled, fixed_prize_segment: form.fixed_prize_enabled ? form.fixed_prize_segment : null })
        .eq('id', editingUser.id);
      if (error) { toast.error('Erro: ' + error.message); return; }
      toast.success('Atualizado!');
    } else {
      const { error } = await (supabase as any)
        .from('wheel_users')
        .insert({ account_id: form.account_id, email: form.email, name: form.name, phone: form.phone, owner_id: session.user.id });
      if (error) { toast.error('Erro: ' + error.message); return; }
      toast.success('Inscrito criado!');
    }
    setShowForm(false);
    setEditingUser(null);
    setForm({ account_id: '', email: '', name: '', phone: '', fixed_prize_enabled: false, fixed_prize_segment: null });
    fetchUsers();
  };

  const openEdit = (user: WheelUser) => {
    setEditingUser(user);
    setForm({ account_id: user.account_id, email: user.email, name: user.name, phone: user.phone || '', fixed_prize_enabled: user.fixed_prize_enabled ?? false, fixed_prize_segment: user.fixed_prize_segment ?? null });
    setShowForm(true);
  };

  const openNew = () => {
    setEditingUser(null);
    setForm({ account_id: '', email: '', name: '', phone: '', fixed_prize_enabled: false, fixed_prize_segment: null });
    setShowForm(true);
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

  const handleViewUserData = async (accountId: string) => {
    setViewingUserLoading(true);
    setViewingUserData(null);
    const uid = session?.user?.id;
    const { data } = await (supabase as any)
      .from('wheel_users')
      .select('*')
      .eq('owner_id', uid)
      .eq('account_id', accountId)
      .maybeSingle();
    setViewingUserData(data || null);
    setViewingUserLoading(false);
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

  const menuItems: { key: typeof activeTab; icon: string; label: string }[] = [
    { key: 'inscritos', icon: '👥', label: 'Inscritos' },
    { key: 'wheel', icon: '🎡', label: 'Roleta' },
    { key: 'auth', icon: '🔐', label: 'Login' },
    { key: 'history', icon: '🏆', label: 'Histórico' },
    { key: 'email', icon: '✉️', label: 'Email' },
    { key: 'sms', icon: '📱', label: 'SMS' },
    { key: 'whatsapp', icon: '💬', label: 'WhatsApp' },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar - Desktop */}
      <aside className={`hidden lg:flex fixed top-0 left-0 h-full bg-card border-r border-border flex-col z-30 transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
        <div className={`border-b border-border flex items-center ${sidebarCollapsed ? 'p-3 justify-center' : 'p-6 justify-between'}`}>
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-foreground">🎰 Painel</h1>
              <p className="text-xs text-muted-foreground mt-1 truncate">{session.user.email}</p>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-all shrink-0"
            title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {sidebarCollapsed ? '▶' : '◀'}
          </button>
        </div>
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {menuItems.map(item => (
            <button
              key={item.key}
              onClick={() => { setActiveTab(item.key); if (item.key === 'history') fetchHistory(); }}
              title={sidebarCollapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200 ${sidebarCollapsed ? 'justify-center px-2 py-3' : 'px-4 py-3'} ${
                activeTab === item.key
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-border">
          <button onClick={handleLogout} className={`w-full rounded-xl bg-muted text-foreground text-sm hover:bg-destructive/10 hover:text-destructive transition-all duration-200 font-medium ${sidebarCollapsed ? 'px-2 py-2.5' : 'px-4 py-2.5'}`} title={sidebarCollapsed ? 'Sair' : undefined}>
            {sidebarCollapsed ? '🚪' : '🚪 Sair'}
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-foreground">🎰 Painel</h1>
          <button onClick={handleLogout} className="px-3 py-1.5 rounded-lg bg-muted text-foreground text-xs hover:bg-muted/80 transition">Sair</button>
        </div>
        <div className="flex gap-1 px-3 pb-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {menuItems.map(item => (
            <button
              key={item.key}
              onClick={() => { setActiveTab(item.key); if (item.key === 'history') fetchHistory(); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === item.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted/60'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className={`flex-1 pt-24 lg:pt-0 p-4 md:p-8 transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        <div className="max-w-6xl mx-auto">

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
                <button onClick={openNew} className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition whitespace-nowrap">+ Novo Inscrito</button>
              </div>
            </div>

            {showForm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                <form onSubmit={handleSaveUser} className="w-full max-w-md mx-4 p-6 rounded-2xl border border-border bg-card shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-foreground">{editingUser ? 'Editar Inscrito' : 'Novo Inscrito'}</h2>
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
                    <input type="text" value={form.phone} placeholder="(00) 90000-0000" onChange={e => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                      let masked = '';
                      if (digits.length > 0) masked += '(' + digits.slice(0, 2);
                      if (digits.length >= 2) masked += ') ';
                      if (digits.length > 2) masked += digits.slice(2, 7);
                      if (digits.length > 7) masked += '-' + digits.slice(7, 11);
                      setForm({ ...form, phone: masked });
                    }} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Account ID</label>
                    <input type="text" required value={form.account_id} onChange={e => setForm({ ...form, account_id: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" />
                  </div>

                  {/* Fixed prize toggle */}
                  <div className="space-y-2 pt-2 border-t border-border">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-muted-foreground font-medium">🎯 Prêmio pré-definido</label>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, fixed_prize_enabled: !form.fixed_prize_enabled, fixed_prize_segment: !form.fixed_prize_enabled ? (form.fixed_prize_segment ?? 0) : form.fixed_prize_segment })}
                        className="w-10 h-5 rounded-full relative transition-colors"
                        style={{ background: form.fixed_prize_enabled ? 'hsl(var(--primary))' : 'hsl(var(--muted))' }}
                      >
                        <div className="w-4 h-4 rounded-full bg-foreground absolute top-0.5 transition-all" style={{ left: form.fixed_prize_enabled ? '22px' : '2px' }} />
                      </button>
                    </div>
                    {form.fixed_prize_enabled && (
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Selecione o prêmio</label>
                        <select
                          value={form.fixed_prize_segment ?? 0}
                          onChange={e => setForm({ ...form, fixed_prize_segment: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
                        >
                          {wheelConfig.segments.map((seg, i) => (
                            <option key={seg.id} value={i}>{seg.title} — {seg.reward}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg bg-muted text-foreground text-sm">Cancelar</button>
                    <button type="submit" className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground font-bold text-sm">{editingUser ? 'Salvar' : 'Criar'}</button>
                  </div>
                </form>
              </div>
            )}

            {usersLoading ? (
              <div className="text-center py-12 text-muted-foreground animate-pulse">Carregando...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">{searchTerm ? 'Nenhum resultado' : 'Nenhum inscrito'}</div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border">
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
            <div className="mt-4 text-xs text-muted-foreground">{filteredUsers.length} inscrito(s)</div>
          </>
        )}

        {/* Wheel config */}
        {activeTab === 'wheel' && (
          <div className="max-w-2xl space-y-4">
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

        {/* Auth config */}
        {activeTab === 'auth' && (
          <div className="max-w-lg space-y-4">
            <AuthConfigPanel config={wheelConfig} onChange={setWheelConfig} />
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
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left px-3 py-3 text-muted-foreground font-medium w-10">#</th>
                      <th className="text-left px-3 py-3 text-muted-foreground font-medium">Nome</th>
                      <th className="text-left px-3 py-3 text-muted-foreground font-medium">Email</th>
                      <th className="text-left px-3 py-3 text-muted-foreground font-medium">Account ID</th>
                      <th className="text-left px-3 py-3 text-muted-foreground font-medium">🏆 Prêmio</th>
                      <th className="text-left px-3 py-3 text-muted-foreground font-medium">Data/Hora</th>
                      <th className="text-left px-3 py-3 text-muted-foreground font-medium">Ações</th>
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
                        <td className="px-3 py-3">
                          <button
                            onClick={() => handleViewUserData(r.account_id)}
                            className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition"
                          >
                            👤 Ver Dados
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4 text-xs text-muted-foreground">{spinResults.length} resultado(s)</div>

            {/* User data modal */}
            {(viewingUserData !== null || viewingUserLoading) && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                <div className="w-full max-w-md mx-4 p-6 rounded-2xl border border-border bg-card shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-foreground">Dados do Usuário</h2>
                    <button onClick={() => { setViewingUserData(null); setViewingUserLoading(false); }} className="text-muted-foreground hover:text-foreground">✕</button>
                  </div>
                  {viewingUserLoading ? (
                    <div className="text-center py-8 text-muted-foreground animate-pulse">Carregando...</div>
                  ) : viewingUserData ? (
                    <div className="space-y-3">
                      <div><span className="text-xs text-muted-foreground">Nome</span><p className="text-foreground font-medium">{viewingUserData.name}</p></div>
                      <div><span className="text-xs text-muted-foreground">Email</span><p className="text-foreground">{viewingUserData.email}</p></div>
                      <div><span className="text-xs text-muted-foreground">Celular</span><p className="text-foreground">{viewingUserData.phone || '—'}</p></div>
                      <div><span className="text-xs text-muted-foreground">ID da Conta</span><p className="text-foreground font-mono text-sm">{viewingUserData.account_id}</p></div>
                      <div><span className="text-xs text-muted-foreground">Giros Disponíveis</span><p className="text-foreground font-bold">{viewingUserData.spins_available}</p></div>
                      <div><span className="text-xs text-muted-foreground">Prêmio Fixo</span><p className="text-foreground">{viewingUserData.fixed_prize_enabled ? `Ativado (Segmento ${viewingUserData.fixed_prize_segment})` : 'Desativado'}</p></div>
                      <div><span className="text-xs text-muted-foreground">Cadastrado em</span><p className="text-foreground text-sm">{new Date(viewingUserData.created_at).toLocaleString('pt-BR')}</p></div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">Usuário não encontrado na base de inscritos</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Email tab */}
        {activeTab === 'email' && (
          <div className="max-w-2xl space-y-6">
            <h2 className="text-lg font-bold text-foreground">Disparo de Email</h2>

            {/* Target selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Destinatários</label>
              <div className="flex gap-3">
                <button
                  onClick={() => { setEmailTarget('all'); setSelectedEmails([]); }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${emailTarget === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/80'}`}
                >
                  Todos os inscritos ({users.length})
                </button>
                <button
                  onClick={() => setEmailTarget('selected')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${emailTarget === 'selected' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/80'}`}
                >
                  Selecionar inscritos
                </button>
              </div>
            </div>

            {/* User selection */}
            {emailTarget === 'selected' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Selecione os inscritos ({selectedEmails.length} selecionado{selectedEmails.length !== 1 ? 's' : ''})</label>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-background p-2 space-y-1">
                  {users.map(u => (
                    <label key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedEmails.includes(u.email)}
                        onChange={e => {
                          if (e.target.checked) setSelectedEmails([...selectedEmails, u.email]);
                          else setSelectedEmails(selectedEmails.filter(em => em !== u.email));
                        }}
                        className="rounded border-border"
                      />
                      <span className="text-sm text-foreground">{u.name}</span>
                      <span className="text-xs text-muted-foreground">({u.email})</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Template choice */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Template</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setEmailTemplate('original')}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${emailTemplate === 'original' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/80'}`}
                >
                  🎰 Original
                </button>
                <button
                  onClick={() => setEmailTemplate('custom')}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${emailTemplate === 'custom' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/80'}`}
                >
                  🖼️ Personalizado
                </button>
              </div>
            </div>

            {/* Banner image (only for custom) */}
            {emailTemplate === 'custom' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Imagem do Banner</label>
                <div className="flex gap-2">
                  <label className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-border bg-background text-foreground text-sm hover:bg-muted/50 transition">
                      {emailBannerUploading ? '⏳ Enviando...' : '📤 Fazer upload de imagem'}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={emailBannerUploading}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 5 * 1024 * 1024) { toast.error('Imagem deve ter no máximo 5MB'); return; }
                        setEmailBannerUploading(true);
                        const ext = file.name.split('.').pop() || 'png';
                        const path = `email-banners/${Date.now()}.${ext}`;
                        const { error } = await supabase.storage.from('app-assets').upload(path, file, { upsert: true });
                        if (error) { toast.error('Erro ao enviar imagem'); setEmailBannerUploading(false); return; }
                        const { data: urlData } = supabase.storage.from('app-assets').getPublicUrl(path);
                        setEmailBannerUrl(urlData.publicUrl);
                        setEmailBannerUploading(false);
                        toast.success('Imagem enviada!');
                      }}
                    />
                  </label>
                </div>
                <div className="flex gap-2 items-center">
                  <span className="text-xs text-muted-foreground">ou cole a URL:</span>
                  <input
                    value={emailBannerUrl}
                    onChange={e => setEmailBannerUrl(e.target.value)}
                    placeholder="https://exemplo.com/imagem.png"
                    className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs"
                  />
                </div>
                {emailBannerUrl && (
                  <div className="relative mt-2 rounded-lg overflow-hidden border border-border">
                    <img src={emailBannerUrl} alt="Preview" className="w-full max-h-40 object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
                    <button
                      onClick={() => setEmailBannerUrl('')}
                      className="absolute top-2 right-2 bg-background/80 text-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-destructive hover:text-destructive-foreground transition"
                    >✕</button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Recomendado: 600x200px. Máximo 5MB.</p>
              </div>
            )}

            {/* Sender Name */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Nome do Remetente</label>
              <input
                value={emailSenderName}
                onChange={e => setEmailSenderName(e.target.value)}
                placeholder="Ex: Minha Marca"
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm"
              />
              <p className="text-xs text-muted-foreground">Nome que aparecerá como remetente do email.</p>
            </div>

            {/* Subject */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Assunto</label>
              <input
                value={emailSubject}
                onChange={e => setEmailSubject(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm"
              />
            </div>

            {/* Body */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Mensagem</label>
              <textarea
                value={emailBody}
                onChange={e => setEmailBody(e.target.value)}
                rows={5}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm resize-y"
              />
              <p className="text-xs text-muted-foreground">O link da roleta será incluído automaticamente no email.</p>
            </div>

            {/* Send button */}
            <button
              onClick={async () => {
                const recipients = emailTarget === 'all' ? users.map(u => u.email) : selectedEmails;
                if (recipients.length === 0) { toast.error('Nenhum destinatário selecionado'); return; }
                if (!emailSubject.trim()) { toast.error('Preencha o assunto'); return; }
                setEmailSending(true);
                const roletaLink = `${baseUrl}/roleta/${slug}`;
                const { data: { session: freshSession } } = await supabase.auth.getSession();
                if (!freshSession?.access_token) { toast.error('Sessão expirada, faça login novamente'); setEmailSending(false); return; }
                let sent = 0, errors = 0;
                for (const email of recipients) {
                  const user = users.find(u => u.email === email);
                  const templateName = emailTemplate === 'custom' ? 'wheel-invite-custom' : 'wheel-invite';
                  const { error } = await supabase.functions.invoke('send-transactional-email', {
                    body: {
                      templateName,
                      recipientEmail: email,
                      idempotencyKey: `wheel-invite-${email}-${Date.now()}`,
                      templateData: {
                        name: user?.name || '',
                        subject: emailSubject,
                        body: emailBody,
                        roletaLink,
                        senderName: emailSenderName || undefined,
                        ...(emailTemplate === 'custom' && emailBannerUrl ? { bannerImageUrl: emailBannerUrl } : {}),
                      },
                    },
                  });
                  if (error) errors++; else sent++;
                }
                setEmailSending(false);
                if (errors > 0) toast.error(`${sent} enviado(s), ${errors} erro(s)`);
                else toast.success(`${sent} email(s) enviado(s) com sucesso!`);
              }}
              disabled={emailSending}
              className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50"
            >
              {emailSending ? 'Enviando...' : `✉️ Enviar Email${emailTarget === 'all' ? ` para ${users.length} inscrito(s)` : selectedEmails.length > 0 ? ` para ${selectedEmails.length} inscrito(s)` : ''}`}
            </button>
          </div>
        )}

        {/* SMS tab */}
        {activeTab === 'sms' && (
          <div className="max-w-2xl space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Disparo de SMS</h2>
              <button
                onClick={() => setShowSmsConfig(!showSmsConfig)}
                className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition"
                title="Configurações do Twilio"
              >
                ⚙️
              </button>
            </div>

            {/* Twilio config panel */}
            {showSmsConfig && (
              <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-3">
                <h3 className="text-sm font-bold text-foreground">🔑 Configuração do Twilio</h3>
                <p className="text-xs text-muted-foreground">Crie uma conta em <a href="https://www.twilio.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">twilio.com</a> e obtenha suas credenciais no console.</p>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Account SID</label>
                  <input
                    type="text"
                    value={twilioAccountSid}
                    onChange={e => { setTwilioAccountSid(e.target.value); localStorage.setItem('twilio_account_sid', e.target.value); }}
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Auth Token</label>
                  <input
                    type="password"
                    value={twilioAuthToken}
                    onChange={e => { setTwilioAuthToken(e.target.value); localStorage.setItem('twilio_auth_token', e.target.value); }}
                    placeholder="••••••••••••••••"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Número do Twilio (remetente)</label>
                  <input
                    type="text"
                    value={twilioPhoneNumber}
                    onChange={e => { setTwilioPhoneNumber(e.target.value); localStorage.setItem('twilio_phone_number', e.target.value); }}
                    placeholder="+5511999999999"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-mono"
                  />
                </div>
                <div className={`text-xs font-medium ${twilioAccountSid && twilioAuthToken && twilioPhoneNumber ? 'text-green-500' : 'text-yellow-500'}`}>
                  {twilioAccountSid && twilioAuthToken && twilioPhoneNumber ? '✅ Credenciais configuradas' : '⚠️ Preencha todas as credenciais para enviar SMS'}
                </div>
              </div>
            )}

            {/* Recipients */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Destinatários</label>
              <div className="flex gap-3">
                <button
                  onClick={() => { setSmsTarget('all'); setSelectedPhones([]); }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${smsTarget === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/80'}`}
                >
                  Todos com celular ({users.filter(u => u.phone && u.phone.replace(/\D/g, '').length >= 10).length})
                </button>
                <button
                  onClick={() => setSmsTarget('selected')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${smsTarget === 'selected' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/80'}`}
                >
                  Selecionar
                </button>
              </div>
            </div>

            {smsTarget === 'selected' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Selecione os inscritos ({selectedPhones.length} selecionado{selectedPhones.length !== 1 ? 's' : ''})</label>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-background p-2 space-y-1">
                  {users.filter(u => u.phone && u.phone.replace(/\D/g, '').length >= 10).map(u => (
                    <label key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPhones.includes(u.phone)}
                        onChange={e => {
                          if (e.target.checked) setSelectedPhones([...selectedPhones, u.phone]);
                          else setSelectedPhones(selectedPhones.filter(p => p !== u.phone));
                        }}
                        className="rounded border-border"
                      />
                      <span className="text-sm text-foreground">{u.name}</span>
                      <span className="text-xs text-muted-foreground">({u.phone})</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Message */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Mensagem</label>
              <textarea
                value={smsMessage}
                onChange={e => setSmsMessage(e.target.value)}
                rows={4}
                placeholder="Digite a mensagem do SMS..."
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm resize-y"
              />
              <p className="text-xs text-muted-foreground">{smsMessage.length}/160 caracteres</p>
            </div>

            {/* Send */}
            <button
              onClick={async () => {
                if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
                  toast.error('Configure as credenciais do Twilio primeiro (clique na ⚙️)');
                  setShowSmsConfig(true);
                  return;
                }
                const usersWithPhone = users.filter(u => u.phone && u.phone.replace(/\D/g, '').length >= 10);
                const phones = smsTarget === 'all' ? usersWithPhone.map(u => u.phone) : selectedPhones;
                if (phones.length === 0) { toast.error('Nenhum destinatário com celular válido'); return; }
                if (!smsMessage.trim()) { toast.error('Digite a mensagem'); return; }
                setSmsSending(true);
                let sent = 0, errors = 0;
                for (const phone of phones) {
                  const { error } = await supabase.functions.invoke('send-sms', {
                    body: {
                      recipientPhone: phone,
                      message: smsMessage,
                      twilioAccountSid,
                      twilioAuthToken,
                      twilioPhoneNumber,
                    },
                  });
                  if (error) errors++; else sent++;
                }
                setSmsSending(false);
                if (errors > 0) toast.error(`${sent} enviado(s), ${errors} erro(s)`);
                else toast.success(`${sent} SMS enviado(s) com sucesso!`);
              }}
              disabled={smsSending}
              className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50"
            >
              {smsSending ? 'Enviando...' : `📱 Enviar SMS${smsTarget === 'all' ? ` para ${users.filter(u => u.phone && u.phone.replace(/\D/g, '').length >= 10).length} inscrito(s)` : selectedPhones.length > 0 ? ` para ${selectedPhones.length} inscrito(s)` : ''}`}
            </button>
          </div>
        )}

        {/* WhatsApp tab */}
        {activeTab === 'whatsapp' && (
          <div className="max-w-2xl space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Disparo de WhatsApp</h2>
              <button
                onClick={() => setShowWhatsappConfig(!showWhatsappConfig)}
                className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition"
                title="Configurações da Evolution API"
              >
                ⚙️
              </button>
            </div>

            {/* Evolution API config panel */}
            {showWhatsappConfig && (
              <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-3">
                <h3 className="text-sm font-bold text-foreground">🔑 Configuração da Evolution API</h3>
                <p className="text-xs text-muted-foreground">Configure sua instância da <a href="https://doc.evolution-api.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">Evolution API</a> para enviar mensagens via WhatsApp.</p>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">URL da API</label>
                  <input
                    type="text"
                    value={evolutionApiUrl}
                    onChange={e => { setEvolutionApiUrl(e.target.value); localStorage.setItem('evolution_api_url', e.target.value); }}
                    placeholder="https://sua-evolution-api.com"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">API Key (Global ou Instance)</label>
                  <input
                    type="password"
                    value={evolutionApiKey}
                    onChange={e => { setEvolutionApiKey(e.target.value); localStorage.setItem('evolution_api_key', e.target.value); }}
                    placeholder="••••••••••••••••"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Nome da Instância</label>
                  <input
                    type="text"
                    value={evolutionInstance}
                    onChange={e => { setEvolutionInstance(e.target.value); localStorage.setItem('evolution_instance', e.target.value); }}
                    placeholder="minha-instancia"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-mono"
                  />
                </div>
                <div className={`text-xs font-medium ${evolutionApiUrl && evolutionApiKey && evolutionInstance ? 'text-green-500' : 'text-yellow-500'}`}>
                  {evolutionApiUrl && evolutionApiKey && evolutionInstance ? '✅ Credenciais configuradas' : '⚠️ Preencha todas as credenciais para enviar WhatsApp'}
                </div>
              </div>
            )}

            {/* Recipients */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Destinatários</label>
              <div className="flex gap-3">
                <button
                  onClick={() => { setWhatsappTarget('all'); setSelectedWhatsappPhones([]); }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${whatsappTarget === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/80'}`}
                >
                  Todos com celular ({users.filter(u => u.phone && u.phone.replace(/\D/g, '').length >= 10).length})
                </button>
                <button
                  onClick={() => setWhatsappTarget('selected')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${whatsappTarget === 'selected' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/80'}`}
                >
                  Selecionar
                </button>
              </div>
            </div>

            {whatsappTarget === 'selected' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Selecione os inscritos ({selectedWhatsappPhones.length} selecionado{selectedWhatsappPhones.length !== 1 ? 's' : ''})</label>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-background p-2 space-y-1">
                  {users.filter(u => u.phone && u.phone.replace(/\D/g, '').length >= 10).map(u => (
                    <label key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedWhatsappPhones.includes(u.phone)}
                        onChange={e => {
                          if (e.target.checked) setSelectedWhatsappPhones([...selectedWhatsappPhones, u.phone]);
                          else setSelectedWhatsappPhones(selectedWhatsappPhones.filter(p => p !== u.phone));
                        }}
                        className="rounded border-border"
                      />
                      <span className="text-sm text-foreground">{u.name}</span>
                      <span className="text-xs text-muted-foreground">({u.phone})</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Message */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Mensagem</label>
              <textarea
                value={whatsappMessage}
                onChange={e => setWhatsappMessage(e.target.value)}
                rows={4}
                placeholder="Digite a mensagem do WhatsApp..."
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm resize-y"
              />
            </div>

            {/* Send */}
            <button
              onClick={async () => {
                if (!evolutionApiUrl || !evolutionApiKey || !evolutionInstance) {
                  toast.error('Configure as credenciais da Evolution API primeiro (clique na ⚙️)');
                  setShowWhatsappConfig(true);
                  return;
                }
                const usersWithPhone = users.filter(u => u.phone && u.phone.replace(/\D/g, '').length >= 10);
                const phones = whatsappTarget === 'all' ? usersWithPhone.map(u => u.phone) : selectedWhatsappPhones;
                if (phones.length === 0) { toast.error('Nenhum destinatário com celular válido'); return; }
                if (!whatsappMessage.trim()) { toast.error('Digite a mensagem'); return; }
                setWhatsappSending(true);
                let sent = 0, errors = 0;
                for (const phone of phones) {
                  const { error } = await supabase.functions.invoke('send-whatsapp', {
                    body: {
                      recipientPhone: phone,
                      message: whatsappMessage,
                      evolutionApiUrl,
                      evolutionApiKey,
                      evolutionInstance,
                    },
                  });
                  if (error) errors++; else sent++;
                }
                setWhatsappSending(false);
                if (errors > 0) toast.error(`${sent} enviado(s), ${errors} erro(s)`);
                else toast.success(`${sent} mensagem(ns) WhatsApp enviada(s) com sucesso!`);
              }}
              disabled={whatsappSending}
              className="w-full py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold text-sm disabled:opacity-50 transition"
            >
              {whatsappSending ? 'Enviando...' : `💬 Enviar WhatsApp${whatsappTarget === 'all' ? ` para ${users.filter(u => u.phone && u.phone.replace(/\D/g, '').length >= 10).length} inscrito(s)` : selectedWhatsappPhones.length > 0 ? ` para ${selectedWhatsappPhones.length} inscrito(s)` : ''}`}
            </button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
