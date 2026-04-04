import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import CustomizationPanel from '@/components/casino/CustomizationPanel';
import DialogConfigPanel from '@/components/casino/DialogConfigPanel';
import AuthConfigPanel from '@/components/casino/AuthConfigPanel';
import { WheelConfig, defaultConfig } from '@/components/casino/types';
import { Users, Target, Shield, Trophy, Mail, Smartphone, MessageCircle, LogOut, Search, Plus, FileDown, FileUp, Pencil, Trash2, Copy, ExternalLink, ChevronLeft, ChevronRight, RotateCcw, Eye, Settings, Send, X, BarChart3, Globe, Monitor, Clock, MapPin } from 'lucide-react';
import ThemeSettingsPanel, { ThemeSettings, defaultTheme } from '@/components/casino/ThemeSettingsPanel';
import { uploadAppAsset } from '@/lib/uploadAppAsset';

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

const GlassCard = ({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] ${className}`} {...props}>
    {children}
  </div>
);

const Dashboard = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<'inscritos' | 'wheel' | 'auth' | 'history' | 'email' | 'sms' | 'whatsapp' | 'analytics'>('inscritos');
  const [pageViews, setPageViews] = useState<any[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
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

  // Grant spin modal
  const [grantSpinUser, setGrantSpinUser] = useState<WheelUser | null>(null);
  const [grantSpinMode, setGrantSpinMode] = useState<'random' | 'fixed'>('random');
  const [grantSpinSegment, setGrantSpinSegment] = useState<number>(0);
  const [dashboardTheme, setDashboardTheme] = useState<ThemeSettings | undefined>(undefined);

  useEffect(() => {
    let dataLoaded = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user && !dataLoaded) {
        dataLoaded = true;
        loadData(s.user.id);
      } else if (!s) {
        setLoading(false);
      }
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user && !dataLoaded) {
        dataLoaded = true;
        loadData(s.user.id);
      } else if (!s) {
        setLoading(false);
      }
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
        if (cfg.config.dashboardTheme) {
          setDashboardTheme({ ...defaultTheme, ...cfg.config.dashboardTheme });
        }
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

  const fetchAnalytics = async (userId?: string) => {
    const uid = userId || session?.user?.id;
    if (!uid) return;
    setAnalyticsLoading(true);
    const { data, error } = await (supabase as any)
      .from('page_views')
      .select('*')
      .eq('owner_id', uid)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) {
      toast.error('Erro ao carregar analytics');
      setPageViews([]);
    } else {
      setPageViews(data || []);
    }
    setAnalyticsLoading(false);
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
    if (user.spins_available >= 1) {
      // Remove spin
      const { error } = await (supabase as any).from('wheel_users').update({ spins_available: 0, fixed_prize_enabled: false, fixed_prize_segment: null }).eq('id', user.id);
      if (error) { toast.error('Erro ao remover giro'); return; }
      toast.success(`Giro removido de ${user.name}`);
      fetchUsers();
      return;
    }
    // Open modal to choose prize
    setGrantSpinUser(user);
    setGrantSpinMode('random');
    setGrantSpinSegment(0);
  };

  const confirmGrantSpin = async () => {
    if (!grantSpinUser) return;
    const isFixed = grantSpinMode === 'fixed';
    const { error } = await (supabase as any).from('wheel_users').update({
      spins_available: 1,
      fixed_prize_enabled: isFixed,
      fixed_prize_segment: isFixed ? grantSpinSegment : null,
    }).eq('id', grantSpinUser.id);
    if (error) { toast.error('Erro ao liberar giro'); return; }
    toast.success(`1 giro liberado para ${grantSpinUser.name}!`);
    setGrantSpinUser(null);
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

  const handleThemeChange = async (newTheme: ThemeSettings) => {
    setDashboardTheme(newTheme);
    if (!session?.user?.id) return;
    try {
      const { data: cfg } = await (supabase as any)
        .from('wheel_configs')
        .select('config')
        .eq('user_id', session.user.id)
        .maybeSingle();
      const currentConfig = cfg?.config || {};
      await (supabase as any)
        .from('wheel_configs')
        .update({ config: { ...currentConfig, dashboardTheme: newTheme }, updated_at: new Date().toISOString() })
        .eq('user_id', session.user.id);
    } catch {}
  };


  /* ═══════════════════════════════════════════
     LOADING
     ═══════════════════════════════════════════ */
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

  /* ═══════════════════════════════════════════
     LOGIN SCREEN
     ═══════════════════════════════════════════ */
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full bg-accent/10 blur-[120px]" />

        <GlassCard className="w-full max-w-sm mx-4 p-8 space-y-6 relative">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto mb-4">
              <Target className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Painel do Operador</h1>
            <p className="text-sm text-muted-foreground">Acesse sua conta para gerenciar a roleta</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</label>
              <input type="email" placeholder="seu@email.com" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Senha</label>
              <input type="password" placeholder="••••••••" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all" />
            </div>
            <button type="submit" disabled={loginLoading} className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 hover:brightness-110 transition-all shadow-lg shadow-primary/25">
              {loginLoading ? (
                <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> Entrando...</span>
              ) : 'Entrar'}
            </button>
          </form>
        </GlassCard>
      </div>
    );
  }

  const baseUrl = window.location.origin;

  const menuItems: { key: typeof activeTab; icon: React.ReactNode; label: string }[] = [
    { key: 'inscritos', icon: <Users size={20} />, label: 'Inscritos' },
    { key: 'wheel', icon: <Target size={20} />, label: 'Roleta' },
    { key: 'auth', icon: <Shield size={20} />, label: 'Login' },
    { key: 'history', icon: <Trophy size={20} />, label: 'Histórico' },
    { key: 'analytics', icon: <BarChart3 size={20} />, label: 'Analytics' },
    { key: 'email', icon: <Mail size={20} />, label: 'Email' },
    { key: 'sms', icon: <Smartphone size={20} />, label: 'SMS' },
    { key: 'whatsapp', icon: <MessageCircle size={20} />, label: 'WhatsApp' },
  ];

  const tabTitles: Record<string, string> = {
    inscritos: 'Inscritos',
    wheel: 'Configuração da Roleta',
    auth: 'Página de Login',
    history: 'Histórico de Prêmios',
    analytics: 'Web Analytics',
    email: 'Disparo de Email',
    sms: 'Disparo de SMS',
    whatsapp: 'Disparo de WhatsApp',
  };

  return (
    <div className="min-h-screen bg-background flex relative overflow-hidden">
      <ThemeSettingsPanel storageKey="dashboard_theme" initialTheme={dashboardTheme} onThemeChange={handleThemeChange} />
      <div id="theme-bg-layer" className="fixed inset-0 pointer-events-none z-0 bg-cover bg-center bg-no-repeat opacity-15" style={{ backgroundImage: 'var(--theme-bg-image, none)' }} />
      {/* Background ambient glow */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-primary/[0.04] blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-accent/[0.03] blur-[120px]" />
      </div>

      {/* ═══ SIDEBAR ═══ */}
      <aside className={`hidden lg:flex fixed top-0 left-0 h-full z-30 flex-col transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${sidebarCollapsed ? 'w-[72px]' : 'w-[260px]'}`}>
        <div className="flex-1 m-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-2xl shadow-[0_8px_40px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden">
          {/* Logo area */}
          <div className={`flex items-center border-b border-white/[0.06] ${sidebarCollapsed ? 'p-3 justify-center' : 'px-5 py-5'}`}>
            {!sidebarCollapsed && (
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                  <Target className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-sm font-bold text-foreground truncate">Painel</h1>
                  <p className="text-[10px] text-muted-foreground truncate">{session.user.email}</p>
                </div>
              </div>
            )}
            {sidebarCollapsed && (
              <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                <Target className="w-5 h-5 text-primary" />
              </div>
            )}
          </div>

          {/* Nav items */}
          <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
            {menuItems.map(item => (
              <button
                key={item.key}
                onClick={() => { setActiveTab(item.key); if (item.key === 'history') fetchHistory(); if (item.key === 'analytics') fetchAnalytics(); }}
                title={sidebarCollapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 rounded-xl text-sm transition-all duration-200 group relative ${sidebarCollapsed ? 'justify-center px-0 py-3' : 'px-4 py-2.5'} ${
                  activeTab === item.key
                    ? 'bg-primary/15 text-primary font-semibold'
                    : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground'
                }`}
              >
                {activeTab === item.key && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
                )}
                <span className={`shrink-0 transition-transform duration-200 ${activeTab === item.key ? 'scale-110' : 'group-hover:scale-105'}`}>{item.icon}</span>
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            ))}
          </nav>

          {/* Collapse toggle & logout */}
          <div className="p-2 space-y-1 border-t border-white/[0.06]">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={`w-full flex items-center gap-3 rounded-xl text-sm text-muted-foreground hover:bg-white/[0.04] hover:text-foreground transition-all ${sidebarCollapsed ? 'justify-center py-2.5' : 'px-4 py-2.5'}`}
              title={sidebarCollapsed ? 'Expandir' : 'Recolher'}
            >
              {sidebarCollapsed ? <ChevronRight size={18} /> : <><ChevronLeft size={18} /><span>Recolher</span></>}
            </button>
            <button
              onClick={handleLogout}
              className={`w-full flex items-center gap-3 rounded-xl text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all ${sidebarCollapsed ? 'justify-center py-2.5' : 'px-4 py-2.5'}`}
              title={sidebarCollapsed ? 'Sair' : undefined}
            >
              <LogOut size={18} />
              {!sidebarCollapsed && <span>Sair</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* ═══ MOBILE NAV ═══ */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30">
        <div className="border-b border-white/[0.06] bg-background/80 backdrop-blur-2xl">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
                <Target className="w-4 h-4 text-primary" />
              </div>
              <h1 className="text-sm font-bold text-foreground">Painel</h1>
            </div>
            <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-white/[0.05] text-muted-foreground hover:text-foreground transition-all">
              <LogOut size={18} />
            </button>
          </div>
          <div className="flex gap-1 px-3 pb-2.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {menuItems.map(item => (
              <button
                key={item.key}
                onClick={() => { setActiveTab(item.key); if (item.key === 'history') fetchHistory(); if (item.key === 'analytics') fetchAnalytics(); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                  activeTab === item.key
                    ? 'bg-primary/15 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className={`flex-1 pt-28 lg:pt-0 p-4 md:p-6 transition-all duration-500 relative z-10 ${sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-[260px]'}`}>
        <div className="max-w-6xl mx-auto lg:py-6 space-y-5">

          {/* Page title bar */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground">{tabTitles[activeTab]}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{users.length} inscritos • {spinResults.length} giros realizados</p>
            </div>
          </div>

          {/* Slug / link */}
          <GlassCard className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <ExternalLink size={14} className="text-primary" />
              <label className="text-xs text-muted-foreground font-medium">Link da sua roleta</label>
            </div>
            {editingSlug ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{baseUrl}/</span>
                <input
                  value={newSlug}
                  onChange={e => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className="flex-1 px-3 py-1.5 rounded-lg border border-white/[0.1] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
                <button onClick={handleSaveSlug} className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:brightness-110 transition">Salvar</button>
                <button onClick={() => { setEditingSlug(false); setNewSlug(slug); }} className="px-3 py-1.5 rounded-lg bg-white/[0.06] text-foreground text-sm hover:bg-white/[0.1] transition">Cancelar</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <code className="text-sm text-primary font-mono bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-lg">{baseUrl}/{slug}</code>
                <button onClick={() => setEditingSlug(true)} className="p-2 rounded-lg bg-white/[0.06] text-muted-foreground hover:text-foreground hover:bg-white/[0.1] transition" title="Editar">
                  <Pencil size={14} />
                </button>
                <button onClick={() => { navigator.clipboard.writeText(`${baseUrl}/${slug}`); toast.success('Link copiado!'); }} className="p-2 rounded-lg bg-white/[0.06] text-muted-foreground hover:text-foreground hover:bg-white/[0.1] transition" title="Copiar">
                  <Copy size={14} />
                </button>
              </div>
            )}
          </GlassCard>

          {/* ══════ INSCRITOS TAB ══════ */}
          {activeTab === 'inscritos' && (
            <>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text" placeholder="Buscar por nome, email ou ID..."
                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
                  />
                </div>
                <div className="flex gap-2">
                  <label className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm hover:bg-white/[0.08] transition cursor-pointer">
                    <FileUp size={15} />
                    <span className="hidden sm:inline">Importar</span>
                    <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
                  </label>
                  <button onClick={handleExportCSV} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm hover:bg-white/[0.08] transition">
                    <FileDown size={15} />
                    <span className="hidden sm:inline">Exportar</span>
                  </button>
                  <button onClick={openNew} className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:brightness-110 transition shadow-lg shadow-primary/20">
                    <Plus size={15} />
                    <span className="hidden sm:inline">Novo</span>
                  </button>
                </div>
              </div>

              {/* User form modal */}
              {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                  <GlassCard className="w-full max-w-md mx-4 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-bold text-foreground">{editingUser ? 'Editar Inscrito' : 'Novo Inscrito'}</h2>
                      <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-white/[0.08] text-muted-foreground hover:text-foreground transition">
                        <X size={18} />
                      </button>
                    </div>
                    <form onSubmit={handleSaveUser} className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Nome</label>
                        <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Email</label>
                        <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Celular</label>
                        <input type="text" value={form.phone} placeholder="(00) 90000-0000" onChange={e => {
                          const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                          let masked = '';
                          if (digits.length > 0) masked += '(' + digits.slice(0, 2);
                          if (digits.length >= 2) masked += ') ';
                          if (digits.length > 2) masked += digits.slice(2, 7);
                          if (digits.length > 7) masked += '-' + digits.slice(7, 11);
                          setForm({ ...form, phone: masked });
                        }} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Account ID</label>
                        <input type="text" required value={form.account_id} onChange={e => setForm({ ...form, account_id: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
                      </div>

                      {/* Fixed prize */}
                      <div className="space-y-2 pt-2 border-t border-white/[0.06]">
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-muted-foreground font-medium">🎯 Prêmio pré-definido</label>
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, fixed_prize_enabled: !form.fixed_prize_enabled, fixed_prize_segment: !form.fixed_prize_enabled ? (form.fixed_prize_segment ?? 0) : form.fixed_prize_segment })}
                            className={`w-11 h-6 rounded-full relative transition-all duration-300 ${form.fixed_prize_enabled ? 'bg-primary' : 'bg-white/[0.1]'}`}
                          >
                            <div className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5 transition-all duration-300 ${form.fixed_prize_enabled ? 'left-[22px]' : 'left-0.5'}`} />
                          </button>
                        </div>
                        {form.fixed_prize_enabled && (
                          <select
                            value={form.fixed_prize_segment ?? 0}
                            onChange={e => setForm({ ...form, fixed_prize_segment: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
                          >
                            {wheelConfig.segments.map((seg, i) => (
                              <option key={seg.id} value={i}>{seg.title} — {seg.reward}</option>
                            ))}
                          </select>
                        )}
                      </div>

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
                <div className="text-center py-12 text-muted-foreground">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  Carregando...
                </div>
              ) : filteredUsers.length === 0 ? (
                <GlassCard className="text-center py-16">
                  <Users size={40} className="text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">{searchTerm ? 'Nenhum resultado encontrado' : 'Nenhum inscrito ainda'}</p>
                </GlassCard>
              ) : (
                <GlassCard className="overflow-hidden">
                  <table className="w-full text-sm table-fixed">
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
                        <tr key={user.id} className="border-t border-white/[0.04] hover:bg-white/[0.03] transition-colors group">
                          <td className="px-4 py-3 text-muted-foreground text-xs">{index + 1}</td>
                          <td className="px-4 py-3 text-foreground font-medium truncate">{user.name}</td>
                          <td className="px-4 py-3 text-muted-foreground truncate">{user.email}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{user.phone}</td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground truncate">{user.account_id}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleGrantSpin(user)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${user.spins_available >= 1 ? 'bg-primary/15 text-primary border border-primary/20 hover:bg-destructive/15 hover:text-destructive hover:border-destructive/20' : 'bg-white/[0.06] text-foreground hover:bg-primary/15 hover:text-primary border border-white/[0.08]'}`}
                              >
                                {user.spins_available >= 1 ? '1 giro ✓' : 'Liberar'}
                              </button>
                              <button onClick={() => openEdit(user)} className="p-1.5 rounded-lg bg-white/[0.06] text-muted-foreground hover:text-foreground hover:bg-white/[0.1] transition border border-white/[0.06]" title="Editar">
                                <Pencil size={13} />
                              </button>
                              <button onClick={() => handleDeleteUser(user.id)} className="p-1.5 rounded-lg bg-white/[0.06] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition border border-white/[0.06]" title="Excluir">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </GlassCard>
              )}
              <p className="text-xs text-muted-foreground">{filteredUsers.length} inscrito(s)</p>
            </>
          )}

          {/* ══════ WHEEL CONFIG ══════ */}
          {activeTab === 'wheel' && (
            <div className="max-w-2xl space-y-4">
              <CustomizationPanel config={wheelConfig} onChange={setWheelConfig} />
              <DialogConfigPanel config={wheelConfig} onChange={setWheelConfig} />
              <button
                onClick={handleSaveConfig}
                disabled={savingConfig}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 hover:brightness-110 transition-all shadow-lg shadow-primary/20"
              >
                {savingConfig ? 'Salvando...' : '💾 Salvar Configuração'}
              </button>
            </div>
          )}

          {/* ══════ AUTH CONFIG ══════ */}
          {activeTab === 'auth' && (
            <div className="max-w-lg space-y-4">
              <AuthConfigPanel config={wheelConfig} onChange={setWheelConfig} />
              <button
                onClick={handleSaveConfig}
                disabled={savingConfig}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 hover:brightness-110 transition-all shadow-lg shadow-primary/20"
              >
                {savingConfig ? 'Salvando...' : '💾 Salvar Configuração'}
              </button>
            </div>
          )}

          {/* ══════ HISTORY ══════ */}
          {activeTab === 'history' && (() => {
            const totalSpins = spinResults.length;
            const uniqueUsers = new Set(spinResults.map((r: any) => r.account_id)).size;
            const uniqueEmails = new Set(spinResults.map((r: any) => r.user_email)).size;

            // Prize distribution
            const prizeCounts: Record<string, number> = {};
            spinResults.forEach((r: any) => { prizeCounts[r.prize] = (prizeCounts[r.prize] || 0) + 1; });
            const topPrizes = Object.entries(prizeCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

            // Spins per day (last 7 days)
            const now = new Date();
            const last7 = Array.from({ length: 7 }, (_, i) => {
              const d = new Date(now);
              d.setDate(d.getDate() - (6 - i));
              return d.toISOString().split('T')[0];
            });
            const spinsPerDay: Record<string, number> = {};
            last7.forEach(d => { spinsPerDay[d] = 0; });
            spinResults.forEach((r: any) => {
              const day = new Date(r.spun_at).toISOString().split('T')[0];
              if (spinsPerDay[day] !== undefined) spinsPerDay[day]++;
            });
            const maxDaySpins = Math.max(...Object.values(spinsPerDay), 1);

            // Today vs yesterday
            const todayStr = now.toISOString().split('T')[0];
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            const todayCount = spinResults.filter((r: any) => new Date(r.spun_at).toISOString().split('T')[0] === todayStr).length;
            const yesterdayCount = spinResults.filter((r: any) => new Date(r.spun_at).toISOString().split('T')[0] === yesterdayStr).length;
            const trend = yesterdayCount === 0 ? (todayCount > 0 ? 100 : 0) : Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 100);

            return (
            <div className="space-y-4">
              {/* Analytics Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: 'Total de Giros', value: totalSpins, icon: <Target size={18} />, color: 'text-primary', bg: 'bg-primary/10' },
                  { label: 'Usuários Únicos', value: uniqueUsers, icon: <Users size={18} />, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
                  { label: 'Emails Únicos', value: uniqueEmails, icon: <Mail size={18} />, color: 'text-sky-400', bg: 'bg-sky-400/10' },
                  { label: 'Hoje', value: todayCount, icon: <Trophy size={18} />, color: 'text-amber-400', bg: 'bg-amber-400/10', trend },
                ].map((card) => (
                  <GlassCard key={card.label} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className={`p-2 rounded-xl ${card.bg}`}>
                        <span className={card.color}>{card.icon}</span>
                      </div>
                      {'trend' in card && card.trend !== undefined && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${card.trend >= 0 ? 'bg-emerald-400/10 text-emerald-400' : 'bg-red-400/10 text-red-400'}`}>
                          {card.trend >= 0 ? '↑' : '↓'} {Math.abs(card.trend)}%
                        </span>
                      )}
                    </div>
                    <p className="text-2xl font-bold text-foreground">{card.value}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{card.label}</p>
                  </GlassCard>
                ))}
              </div>

              {/* Charts row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Spins per day mini chart */}
                <GlassCard className="p-4 space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Giros por Dia (7 dias)</h4>
                  <div className="flex items-end gap-1.5 h-24">
                    {last7.map(day => {
                      const count = spinsPerDay[day];
                      const height = Math.max((count / maxDaySpins) * 100, 4);
                      const isToday = day === todayStr;
                      return (
                        <div key={day} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[9px] text-muted-foreground font-medium">{count}</span>
                          <div
                            className={`w-full rounded-md transition-all ${isToday ? 'bg-primary shadow-lg shadow-primary/30' : 'bg-white/[0.1]'}`}
                            style={{ height: `${height}%`, minHeight: '3px' }}
                          />
                          <span className="text-[8px] text-muted-foreground">{day.slice(8)}/{day.slice(5, 7)}</span>
                        </div>
                      );
                    })}
                  </div>
                </GlassCard>

                {/* Prize distribution */}
                <GlassCard className="p-4 space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Top Prêmios</h4>
                  {topPrizes.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sem dados</p>
                  ) : (
                    <div className="space-y-2">
                      {topPrizes.map(([prize, count], i) => {
                        const pct = Math.round((count / totalSpins) * 100);
                        const colors = ['bg-primary', 'bg-emerald-400', 'bg-sky-400', 'bg-amber-400', 'bg-purple-400'];
                        return (
                          <div key={prize} className="space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-foreground font-medium truncate max-w-[60%]">{prize}</span>
                              <span className="text-[10px] text-muted-foreground">{count}x ({pct}%)</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                              <div className={`h-full rounded-full ${colors[i % colors.length]} transition-all`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </GlassCard>
              </div>

              <div className="flex items-center justify-end">
                <button onClick={() => fetchHistory()} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm hover:bg-white/[0.08] transition">
                  <RotateCcw size={14} /> Atualizar
                </button>
              </div>
              {historyLoading ? (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  Carregando...
                </div>
              ) : spinResults.length === 0 ? (
                <GlassCard className="text-center py-16">
                  <Trophy size={40} className="text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">Nenhum resultado registrado</p>
                </GlassCard>
              ) : (
                <GlassCard className="overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left px-4 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider w-10">#</th>
                        <th className="text-left px-4 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Nome</th>
                        <th className="text-left px-4 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Email</th>
                        <th className="text-left px-4 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Account ID</th>
                        <th className="text-left px-4 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Prêmio</th>
                        <th className="text-left px-4 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Data</th>
                        <th className="text-left px-4 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider w-24">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {spinResults.map((r: any, i: number) => (
                        <tr key={r.id} className="border-t border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                          <td className="px-4 py-3 text-muted-foreground text-xs">{i + 1}</td>
                          <td className="px-4 py-3 text-foreground font-medium">{r.user_name}</td>
                          <td className="px-4 py-3 text-muted-foreground">{r.user_email}</td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.account_id}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 rounded-lg bg-primary/15 text-primary text-xs font-bold border border-primary/20">{r.prize}</span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(r.spun_at).toLocaleString('pt-BR')}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleViewUserData(r.account_id)}
                              className="p-1.5 rounded-lg bg-white/[0.06] text-muted-foreground hover:text-primary hover:bg-primary/10 transition border border-white/[0.06]"
                              title="Ver dados"
                            >
                              <Eye size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </GlassCard>
              )}
              <p className="text-xs text-muted-foreground">{spinResults.length} resultado(s)</p>

              {/* User data modal */}
              {(viewingUserData !== null || viewingUserLoading) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                  <GlassCard className="w-full max-w-md mx-4 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-bold text-foreground">Dados do Usuário</h2>
                      <button onClick={() => { setViewingUserData(null); setViewingUserLoading(false); }} className="p-1.5 rounded-lg hover:bg-white/[0.08] text-muted-foreground hover:text-foreground transition">
                        <X size={18} />
                      </button>
                    </div>
                    {viewingUserLoading ? (
                      <div className="text-center py-8"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
                    ) : viewingUserData ? (
                      <div className="space-y-3">
                        {[
                          { label: 'Nome', value: viewingUserData.name },
                          { label: 'Email', value: viewingUserData.email },
                          { label: 'Celular', value: viewingUserData.phone || '—' },
                          { label: 'ID da Conta', value: viewingUserData.account_id, mono: true },
                          { label: 'Giros Disponíveis', value: String(viewingUserData.spins_available), bold: true },
                          { label: 'Prêmio Fixo', value: viewingUserData.fixed_prize_enabled ? `Ativado (Segmento ${viewingUserData.fixed_prize_segment})` : 'Desativado' },
                          { label: 'Cadastrado em', value: new Date(viewingUserData.created_at).toLocaleString('pt-BR') },
                        ].map(({ label, value, mono, bold }) => (
                          <div key={label} className="flex justify-between items-center py-2 border-b border-white/[0.04] last:border-0">
                            <span className="text-xs text-muted-foreground">{label}</span>
                            <span className={`text-sm text-foreground ${mono ? 'font-mono' : ''} ${bold ? 'font-bold' : ''}`}>{value}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">Usuário não encontrado</div>
                    )}
                  </GlassCard>
                </div>
              )}
            </div>
            );
          })()}

          {/* ══════ ANALYTICS TAB ══════ */}
          {activeTab === 'analytics' && (() => {
            const total = pageViews.length;
            const uniqueIPs = new Set(pageViews.map((v: any) => v.ip_address)).size;
            const avgDuration = total > 0 ? Math.round(pageViews.reduce((s: number, v: any) => s + (v.duration_seconds || 0), 0) / total) : 0;
            const formatDuration = (s: number) => s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;

            // Device breakdown
            const devices: Record<string, number> = {};
            pageViews.forEach((v: any) => { devices[v.device_type || 'Desconhecido'] = (devices[v.device_type || 'Desconhecido'] || 0) + 1; });
            const deviceEntries = Object.entries(devices).sort((a, b) => b[1] - a[1]);

            // Browser breakdown
            const browsers: Record<string, number> = {};
            pageViews.forEach((v: any) => { browsers[v.browser || 'Desconhecido'] = (browsers[v.browser || 'Desconhecido'] || 0) + 1; });
            const browserEntries = Object.entries(browsers).sort((a, b) => b[1] - a[1]);

            // OS breakdown
            const osStat: Record<string, number> = {};
            pageViews.forEach((v: any) => { osStat[v.os || 'Desconhecido'] = (osStat[v.os || 'Desconhecido'] || 0) + 1; });
            const osEntries = Object.entries(osStat).sort((a, b) => b[1] - a[1]);

            // Country/City breakdown
            const locations: Record<string, number> = {};
            pageViews.forEach((v: any) => {
              const loc = [v.city, v.country].filter(Boolean).join(', ') || 'Desconhecido';
              locations[loc] = (locations[loc] || 0) + 1;
            });
            const locationEntries = Object.entries(locations).sort((a, b) => b[1] - a[1]).slice(0, 10);

            // Visits per day (last 7)
            const now = new Date();
            const last7 = Array.from({ length: 7 }, (_, i) => {
              const d = new Date(now); d.setDate(d.getDate() - (6 - i));
              return d.toISOString().split('T')[0];
            });
            const visitsPerDay: Record<string, number> = {};
            last7.forEach(d => { visitsPerDay[d] = 0; });
            pageViews.forEach((v: any) => {
              const day = new Date(v.created_at).toISOString().split('T')[0];
              if (visitsPerDay[day] !== undefined) visitsPerDay[day]++;
            });
            const maxDayVisits = Math.max(...Object.values(visitsPerDay), 1);

            const todayStr = now.toISOString().split('T')[0];

            const deviceIcons: Record<string, React.ReactNode> = {
              'Desktop': <Monitor size={14} />,
              'Mobile': <Smartphone size={14} />,
              'Tablet': <Smartphone size={12} />,
            };
            const deviceColors = ['text-primary', 'text-emerald-400', 'text-amber-400', 'text-sky-400'];
            const barColors = ['bg-primary', 'bg-emerald-400', 'bg-sky-400', 'bg-amber-400', 'bg-purple-400'];

            return (
            <div className="space-y-4">
              {/* Top stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: 'Total de Acessos', value: total, icon: <Globe size={18} />, color: 'text-primary', bg: 'bg-primary/10' },
                  { label: 'IPs Únicos', value: uniqueIPs, icon: <MapPin size={18} />, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
                  { label: 'Tempo Médio', value: formatDuration(avgDuration), icon: <Clock size={18} />, color: 'text-sky-400', bg: 'bg-sky-400/10' },
                  { label: 'Hoje', value: pageViews.filter((v: any) => new Date(v.created_at).toISOString().split('T')[0] === todayStr).length, icon: <BarChart3 size={18} />, color: 'text-amber-400', bg: 'bg-amber-400/10' },
                ].map(card => (
                  <GlassCard key={card.label} className="p-4 space-y-2">
                    <div className={`p-2 rounded-xl ${card.bg} w-fit`}>
                      <span className={card.color}>{card.icon}</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{card.value}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{card.label}</p>
                  </GlassCard>
                ))}
              </div>

              {/* Charts row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Visits per day */}
                <GlassCard className="p-4 space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Acessos por Dia (7 dias)</h4>
                  <div className="flex items-end gap-1.5 h-24">
                    {last7.map(day => {
                      const count = visitsPerDay[day];
                      const height = Math.max((count / maxDayVisits) * 100, 4);
                      const isToday = day === todayStr;
                      return (
                        <div key={day} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[9px] text-muted-foreground font-medium">{count}</span>
                          <div className={`w-full rounded-md transition-all ${isToday ? 'bg-primary shadow-lg shadow-primary/30' : 'bg-white/[0.1]'}`} style={{ height: `${height}%`, minHeight: '3px' }} />
                          <span className="text-[8px] text-muted-foreground">{day.slice(8)}/{day.slice(5, 7)}</span>
                        </div>
                      );
                    })}
                  </div>
                </GlassCard>

                {/* Device breakdown */}
                <GlassCard className="p-4 space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dispositivos</h4>
                  <div className="space-y-2">
                    {deviceEntries.map(([device, count], i) => {
                      const pct = Math.round((count / total) * 100) || 0;
                      return (
                        <div key={device} className="flex items-center gap-3">
                          <span className={`${deviceColors[i % deviceColors.length]}`}>{deviceIcons[device] || <Monitor size={14} />}</span>
                          <div className="flex-1 space-y-1">
                            <div className="flex justify-between">
                              <span className="text-xs text-foreground font-medium">{device}</span>
                              <span className="text-[10px] text-muted-foreground">{count} ({pct}%)</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                              <div className={`h-full rounded-full ${barColors[i % barColors.length]}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {deviceEntries.length === 0 && <p className="text-xs text-muted-foreground">Sem dados</p>}
                  </div>
                </GlassCard>
              </div>

              {/* Browser + OS + Locations */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <GlassCard className="p-4 space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><Globe size={13} /> Navegadores</h4>
                  <div className="space-y-2">
                    {browserEntries.slice(0, 5).map(([b, count], i) => {
                      const pct = Math.round((count / total) * 100) || 0;
                      return (
                        <div key={b} className="space-y-1">
                          <div className="flex justify-between"><span className="text-xs text-foreground">{b}</span><span className="text-[10px] text-muted-foreground">{count} ({pct}%)</span></div>
                          <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden"><div className={`h-full rounded-full ${barColors[i % barColors.length]}`} style={{ width: `${pct}%` }} /></div>
                        </div>
                      );
                    })}
                    {browserEntries.length === 0 && <p className="text-xs text-muted-foreground">Sem dados</p>}
                  </div>
                </GlassCard>

                <GlassCard className="p-4 space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><Monitor size={13} /> Sistemas</h4>
                  <div className="space-y-2">
                    {osEntries.slice(0, 5).map(([o, count], i) => {
                      const pct = Math.round((count / total) * 100) || 0;
                      return (
                        <div key={o} className="space-y-1">
                          <div className="flex justify-between"><span className="text-xs text-foreground">{o}</span><span className="text-[10px] text-muted-foreground">{count} ({pct}%)</span></div>
                          <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden"><div className={`h-full rounded-full ${barColors[i % barColors.length]}`} style={{ width: `${pct}%` }} /></div>
                        </div>
                      );
                    })}
                    {osEntries.length === 0 && <p className="text-xs text-muted-foreground">Sem dados</p>}
                  </div>
                </GlassCard>

                <GlassCard className="p-4 space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><MapPin size={13} /> Localizações</h4>
                  <div className="space-y-2">
                    {locationEntries.map(([loc, count], i) => {
                      const pct = Math.round((count / total) * 100) || 0;
                      return (
                        <div key={loc} className="space-y-1">
                          <div className="flex justify-between"><span className="text-xs text-foreground truncate max-w-[65%]">{loc}</span><span className="text-[10px] text-muted-foreground">{count} ({pct}%)</span></div>
                          <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden"><div className={`h-full rounded-full ${barColors[i % barColors.length]}`} style={{ width: `${pct}%` }} /></div>
                        </div>
                      );
                    })}
                    {locationEntries.length === 0 && <p className="text-xs text-muted-foreground">Sem dados</p>}
                  </div>
                </GlassCard>
              </div>

              {/* Refresh + Access log table */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{total} acesso(s) rastreados</p>
                <button onClick={() => fetchAnalytics()} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm hover:bg-white/[0.08] transition">
                  <RotateCcw size={14} /> Atualizar
                </button>
              </div>

              {analyticsLoading ? (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  Carregando...
                </div>
              ) : pageViews.length === 0 ? (
                <GlassCard className="text-center py-16">
                  <BarChart3 size={40} className="text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">Nenhum acesso registrado ainda</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Os acessos à sua roleta aparecerão aqui</p>
                </GlassCard>
              ) : (
                <GlassCard className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/[0.06]">
                          <th className="text-left px-4 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">IP</th>
                          <th className="text-left px-4 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Localização</th>
                          <th className="text-left px-4 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Dispositivo</th>
                          <th className="text-left px-4 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">OS</th>
                          <th className="text-left px-4 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Navegador</th>
                          <th className="text-left px-4 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Tempo</th>
                          <th className="text-left px-4 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageViews.slice(0, 50).map((v: any) => (
                          <tr key={v.id} className="border-t border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{v.ip_address || '—'}</td>
                            <td className="px-4 py-3 text-xs text-foreground">{[v.city, v.country].filter(Boolean).join(', ') || '—'}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium border ${v.device_type === 'Mobile' ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' : v.device_type === 'Tablet' ? 'bg-amber-400/10 text-amber-400 border-amber-400/20' : 'bg-primary/10 text-primary border-primary/20'}`}>
                                {deviceIcons[v.device_type] || <Monitor size={12} />} {v.device_type || '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{v.os || '—'}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{v.browser || '—'}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{formatDuration(v.duration_seconds || 0)}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(v.created_at).toLocaleString('pt-BR')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </GlassCard>
              )}
            </div>
            );
          })()}

          {/* ══════ EMAIL TAB ══════ */}
          {activeTab === 'email' && (
            <div className="max-w-2xl space-y-5">
              <GlassCard className="p-5 space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Users size={16} className="text-primary" /> Destinatários</h3>
                <div className="flex gap-2">
                  <button onClick={() => { setEmailTarget('all'); setSelectedEmails([]); }} className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${emailTarget === 'all' ? 'bg-primary/15 text-primary border-primary/20' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground'}`}>
                    Todos ({users.length})
                  </button>
                  <button onClick={() => setEmailTarget('selected')} className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${emailTarget === 'selected' ? 'bg-primary/15 text-primary border-primary/20' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground'}`}>
                    Selecionar ({selectedEmails.length})
                  </button>
                </div>
                {emailTarget === 'selected' && (
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-white/[0.08] bg-white/[0.02] p-2 space-y-0.5">
                    {users.map(u => (
                      <label key={u.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.04] cursor-pointer transition">
                        <input type="checkbox" checked={selectedEmails.includes(u.email)} onChange={e => { if (e.target.checked) setSelectedEmails([...selectedEmails, u.email]); else setSelectedEmails(selectedEmails.filter(em => em !== u.email)); }} className="rounded border-white/20 bg-white/[0.05]" />
                        <span className="text-sm text-foreground">{u.name}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{u.email}</span>
                      </label>
                    ))}
                  </div>
                )}
              </GlassCard>

              <GlassCard className="p-5 space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Mail size={16} className="text-primary" /> Conteúdo</h3>

                {/* Template */}
                <div className="flex gap-2">
                  <button onClick={() => setEmailTemplate('original')} className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${emailTemplate === 'original' ? 'bg-primary/15 text-primary border-primary/20' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground'}`}>
                    🎰 Original
                  </button>
                  <button onClick={() => setEmailTemplate('custom')} className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${emailTemplate === 'custom' ? 'bg-primary/15 text-primary border-primary/20' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground'}`}>
                    🖼️ Personalizado
                  </button>
                </div>

                {/* Banner */}
                {emailTemplate === 'custom' && (
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Banner</label>
                    <div className="flex gap-2">
                      <label className="flex-1 cursor-pointer">
                        <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-white/[0.15] bg-white/[0.02] text-muted-foreground text-sm hover:bg-white/[0.05] transition">
                          {emailBannerUploading ? '⏳ Enviando...' : '📤 Upload de imagem'}
                        </div>
                        <input type="file" accept="image/*" className="hidden" disabled={emailBannerUploading} onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 5 * 1024 * 1024) { toast.error('Imagem deve ter no máximo 5MB'); return; }
                          setEmailBannerUploading(true);
                          try {
                            const { publicUrl } = await uploadAppAsset(file, 'email-banners');
                            setEmailBannerUrl(publicUrl);
                            toast.success('Banner enviado!');
                          } catch (error: any) {
                            toast.error('Erro ao enviar imagem: ' + (error.message || 'Tente novamente'));
                          } finally {
                            setEmailBannerUploading(false);
                            e.target.value = '';
                          }
                        }} />
                      </label>
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className="text-xs text-muted-foreground">ou URL:</span>
                      <input value={emailBannerUrl} onChange={e => setEmailBannerUrl(e.target.value)} placeholder="https://..." className="flex-1 px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary/40" />
                    </div>
                    {emailBannerUrl && (
                      <div className="relative rounded-xl overflow-hidden border border-white/[0.08]">
                        <img src={emailBannerUrl} alt="Preview" className="w-full max-h-40 object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
                        <button onClick={() => setEmailBannerUrl('')} className="absolute top-2 right-2 p-1 rounded-lg bg-black/60 text-white hover:bg-destructive transition">
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Sender */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Remetente</label>
                  <input value={emailSenderName} onChange={e => setEmailSenderName(e.target.value)} placeholder="Nome da marca" className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
                </div>

                {/* Subject */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Assunto</label>
                  <input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
                </div>

                {/* Body */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Mensagem</label>
                  <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} rows={5} className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm resize-y focus:outline-none focus:ring-1 focus:ring-primary/40" />
                  <p className="text-[10px] text-muted-foreground">O link da roleta será incluído automaticamente.</p>
                </div>
              </GlassCard>

              <button
                onClick={async () => {
                  const recipients = emailTarget === 'all' ? users.map(u => u.email) : selectedEmails;
                  if (recipients.length === 0) { toast.error('Nenhum destinatário selecionado'); return; }
                  if (!emailSubject.trim()) { toast.error('Preencha o assunto'); return; }
                  setEmailSending(true);
                  const roletaLink = `${baseUrl}/${slug}`;
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
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 hover:brightness-110 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
              >
                {emailSending ? (
                  <><div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> Enviando...</>
                ) : (
                  <><Send size={16} /> Enviar Email{emailTarget === 'all' ? ` para ${users.length}` : selectedEmails.length > 0 ? ` para ${selectedEmails.length}` : ''}</>
                )}
              </button>
            </div>
          )}

          {/* ══════ SMS TAB ══════ */}
          {activeTab === 'sms' && (
            <div className="max-w-2xl space-y-5">
              <div className="flex items-center justify-end">
                <button onClick={() => setShowSmsConfig(!showSmsConfig)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground hover:bg-white/[0.08] transition text-sm" title="Configurações">
                  <Settings size={15} /> Configurar API
                </button>
              </div>

              {showSmsConfig && (
                <GlassCard className="p-5 space-y-3">
                  <h3 className="text-sm font-bold text-foreground">🔑 Twilio</h3>
                  <p className="text-[10px] text-muted-foreground">Crie uma conta em <a href="https://www.twilio.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">twilio.com</a></p>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Account SID</label>
                    <input type="text" value={twilioAccountSid} onChange={e => { setTwilioAccountSid(e.target.value); localStorage.setItem('twilio_account_sid', e.target.value); }} placeholder="ACxxxxxxxx" className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/40" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Auth Token</label>
                    <input type="password" value={twilioAuthToken} onChange={e => { setTwilioAuthToken(e.target.value); localStorage.setItem('twilio_auth_token', e.target.value); }} placeholder="••••••••" className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/40" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Número remetente</label>
                    <input type="text" value={twilioPhoneNumber} onChange={e => { setTwilioPhoneNumber(e.target.value); localStorage.setItem('twilio_phone_number', e.target.value); }} placeholder="+5511999999999" className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/40" />
                  </div>
                  <div className={`text-xs font-medium ${twilioAccountSid && twilioAuthToken && twilioPhoneNumber ? 'text-green-400' : 'text-yellow-400'}`}>
                    {twilioAccountSid && twilioAuthToken && twilioPhoneNumber ? '✅ Configurado' : '⚠️ Preencha todas as credenciais'}
                  </div>
                </GlassCard>
              )}

              <GlassCard className="p-5 space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Users size={16} className="text-primary" /> Destinatários</h3>
                <div className="flex gap-2">
                  <button onClick={() => { setSmsTarget('all'); setSelectedPhones([]); }} className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${smsTarget === 'all' ? 'bg-primary/15 text-primary border-primary/20' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground'}`}>
                    Todos ({users.filter(u => u.phone && u.phone.replace(/\D/g, '').length >= 10).length})
                  </button>
                  <button onClick={() => setSmsTarget('selected')} className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${smsTarget === 'selected' ? 'bg-primary/15 text-primary border-primary/20' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground'}`}>
                    Selecionar ({selectedPhones.length})
                  </button>
                </div>
                {smsTarget === 'selected' && (
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-white/[0.08] bg-white/[0.02] p-2 space-y-0.5">
                    {users.filter(u => u.phone && u.phone.replace(/\D/g, '').length >= 10).map(u => (
                      <label key={u.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.04] cursor-pointer transition">
                        <input type="checkbox" checked={selectedPhones.includes(u.phone)} onChange={e => { if (e.target.checked) setSelectedPhones([...selectedPhones, u.phone]); else setSelectedPhones(selectedPhones.filter(p => p !== u.phone)); }} className="rounded border-white/20" />
                        <span className="text-sm text-foreground">{u.name}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{u.phone}</span>
                      </label>
                    ))}
                  </div>
                )}
              </GlassCard>

              <GlassCard className="p-5 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Smartphone size={16} className="text-primary" /> Mensagem</h3>
                <textarea value={smsMessage} onChange={e => setSmsMessage(e.target.value)} rows={4} placeholder="Digite a mensagem..." className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm resize-y focus:outline-none focus:ring-1 focus:ring-primary/40" />
                <p className="text-[10px] text-muted-foreground">{smsMessage.length}/160 caracteres</p>
              </GlassCard>

              <button
                onClick={async () => {
                  if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) { toast.error('Configure as credenciais do Twilio'); setShowSmsConfig(true); return; }
                  const usersWithPhone = users.filter(u => u.phone && u.phone.replace(/\D/g, '').length >= 10);
                  const phones = smsTarget === 'all' ? usersWithPhone.map(u => u.phone) : selectedPhones;
                  if (phones.length === 0) { toast.error('Nenhum destinatário'); return; }
                  if (!smsMessage.trim()) { toast.error('Digite a mensagem'); return; }
                  setSmsSending(true);
                  let sent = 0, errors = 0;
                  for (const phone of phones) {
                    const { error } = await supabase.functions.invoke('send-sms', { body: { recipientPhone: phone, message: smsMessage, twilioAccountSid, twilioAuthToken, twilioPhoneNumber } });
                    if (error) errors++; else sent++;
                  }
                  setSmsSending(false);
                  if (errors > 0) toast.error(`${sent} enviado(s), ${errors} erro(s)`);
                  else toast.success(`${sent} SMS enviado(s)!`);
                }}
                disabled={smsSending}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 hover:brightness-110 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
              >
                {smsSending ? <><div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> Enviando...</> : <><Send size={16} /> Enviar SMS</>}
              </button>
            </div>
          )}

          {/* ══════ WHATSAPP TAB ══════ */}
          {activeTab === 'whatsapp' && (
            <div className="max-w-2xl space-y-5">
              <div className="flex items-center justify-end">
                <button onClick={() => setShowWhatsappConfig(!showWhatsappConfig)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground hover:bg-white/[0.08] transition text-sm">
                  <Settings size={15} /> Configurar API
                </button>
              </div>

              {showWhatsappConfig && (
                <GlassCard className="p-5 space-y-3">
                  <h3 className="text-sm font-bold text-foreground">🔑 Evolution API</h3>
                  <p className="text-[10px] text-muted-foreground">Configure sua instância da <a href="https://doc.evolution-api.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">Evolution API</a></p>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">URL da API</label>
                    <input type="text" value={evolutionApiUrl} onChange={e => { setEvolutionApiUrl(e.target.value); localStorage.setItem('evolution_api_url', e.target.value); }} placeholder="https://sua-api.com" className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/40" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">API Key</label>
                    <input type="password" value={evolutionApiKey} onChange={e => { setEvolutionApiKey(e.target.value); localStorage.setItem('evolution_api_key', e.target.value); }} placeholder="••••••••" className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/40" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Instância</label>
                    <input type="text" value={evolutionInstance} onChange={e => { setEvolutionInstance(e.target.value); localStorage.setItem('evolution_instance', e.target.value); }} placeholder="minha-instancia" className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/40" />
                  </div>
                  <div className={`text-xs font-medium ${evolutionApiUrl && evolutionApiKey && evolutionInstance ? 'text-green-400' : 'text-yellow-400'}`}>
                    {evolutionApiUrl && evolutionApiKey && evolutionInstance ? '✅ Configurado' : '⚠️ Preencha todas as credenciais'}
                  </div>
                </GlassCard>
              )}

              <GlassCard className="p-5 space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Users size={16} className="text-primary" /> Destinatários</h3>
                <div className="flex gap-2">
                  <button onClick={() => { setWhatsappTarget('all'); setSelectedWhatsappPhones([]); }} className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${whatsappTarget === 'all' ? 'bg-primary/15 text-primary border-primary/20' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground'}`}>
                    Todos ({users.filter(u => u.phone && u.phone.replace(/\D/g, '').length >= 10).length})
                  </button>
                  <button onClick={() => setWhatsappTarget('selected')} className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${whatsappTarget === 'selected' ? 'bg-primary/15 text-primary border-primary/20' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground'}`}>
                    Selecionar ({selectedWhatsappPhones.length})
                  </button>
                </div>
                {whatsappTarget === 'selected' && (
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-white/[0.08] bg-white/[0.02] p-2 space-y-0.5">
                    {users.filter(u => u.phone && u.phone.replace(/\D/g, '').length >= 10).map(u => (
                      <label key={u.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.04] cursor-pointer transition">
                        <input type="checkbox" checked={selectedWhatsappPhones.includes(u.phone)} onChange={e => { if (e.target.checked) setSelectedWhatsappPhones([...selectedWhatsappPhones, u.phone]); else setSelectedWhatsappPhones(selectedWhatsappPhones.filter(p => p !== u.phone)); }} className="rounded border-white/20" />
                        <span className="text-sm text-foreground">{u.name}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{u.phone}</span>
                      </label>
                    ))}
                  </div>
                )}
              </GlassCard>

              <GlassCard className="p-5 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><MessageCircle size={16} className="text-green-400" /> Mensagem</h3>
                <textarea value={whatsappMessage} onChange={e => setWhatsappMessage(e.target.value)} rows={4} placeholder="Digite a mensagem..." className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm resize-y focus:outline-none focus:ring-1 focus:ring-primary/40" />
              </GlassCard>

              <button
                onClick={async () => {
                  if (!evolutionApiUrl || !evolutionApiKey || !evolutionInstance) { toast.error('Configure as credenciais da Evolution API'); setShowWhatsappConfig(true); return; }
                  const usersWithPhone = users.filter(u => u.phone && u.phone.replace(/\D/g, '').length >= 10);
                  const phones = whatsappTarget === 'all' ? usersWithPhone.map(u => u.phone) : selectedWhatsappPhones;
                  if (phones.length === 0) { toast.error('Nenhum destinatário'); return; }
                  if (!whatsappMessage.trim()) { toast.error('Digite a mensagem'); return; }
                  setWhatsappSending(true);
                  let sent = 0, errors = 0;
                  for (const phone of phones) {
                    const { error } = await supabase.functions.invoke('send-whatsapp', { body: { recipientPhone: phone, message: whatsappMessage, evolutionApiUrl, evolutionApiKey, evolutionInstance } });
                    if (error) errors++; else sent++;
                  }
                  setWhatsappSending(false);
                  if (errors > 0) toast.error(`${sent} enviado(s), ${errors} erro(s)`);
                  else toast.success(`${sent} mensagem(ns) enviada(s)!`);
                }}
                disabled={whatsappSending}
                className="w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-sm disabled:opacity-50 transition-all shadow-lg shadow-green-600/20 flex items-center justify-center gap-2"
              >
                {whatsappSending ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Enviando...</> : <><Send size={16} /> Enviar WhatsApp</>}
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Grant Spin Modal */}
      {grantSpinUser && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setGrantSpinUser(null)}>
          <div className="w-full max-w-md mx-4 rounded-2xl border border-white/[0.08] bg-[#1a1a2e] p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-foreground">Liberar Giro — {grantSpinUser.name}</h3>
              <button onClick={() => setGrantSpinUser(null)} className="p-1 rounded-lg hover:bg-white/10 text-muted-foreground"><X size={18} /></button>
            </div>

            <p className="text-sm text-muted-foreground mb-4">Escolha como o prêmio será definido para este giro:</p>

            {/* Mode selection */}
            <div className="flex gap-2 mb-5">
              <button
                onClick={() => setGrantSpinMode('random')}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all border ${grantSpinMode === 'random' ? 'bg-primary/20 text-primary border-primary/30' : 'bg-white/[0.04] text-muted-foreground border-white/[0.08] hover:bg-white/[0.08]'}`}
              >
                🎲 Aleatório (%)
              </button>
              <button
                onClick={() => setGrantSpinMode('fixed')}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all border ${grantSpinMode === 'fixed' ? 'bg-primary/20 text-primary border-primary/30' : 'bg-white/[0.04] text-muted-foreground border-white/[0.08] hover:bg-white/[0.08]'}`}
              >
                🎯 Pré-definir
              </button>
            </div>

            {grantSpinMode === 'random' ? (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 mb-5">
                <p className="text-xs text-muted-foreground mb-3">O prêmio será sorteado automaticamente baseado nas probabilidades dos segmentos:</p>
                <div className="space-y-1.5">
                  {wheelConfig.segments.map((seg, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: seg.color }} />
                      <span className="text-foreground flex-1">{seg.title}</span>
                      <span className="text-muted-foreground font-mono">{seg.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mb-5">
                <label className="text-xs text-muted-foreground mb-2 block">Selecione o prêmio garantido:</label>
                <div className="space-y-1.5">
                  {wheelConfig.segments.map((seg, i) => (
                    <button
                      key={i}
                      onClick={() => setGrantSpinSegment(i)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all border ${grantSpinSegment === i ? 'bg-primary/15 border-primary/30 text-primary' : 'bg-white/[0.02] border-white/[0.06] text-foreground hover:bg-white/[0.06]'}`}
                    >
                      <div className="w-4 h-4 rounded-sm flex-shrink-0" style={{ background: seg.color }} />
                      <span className="flex-1 text-left font-medium">{seg.title}</span>
                      <span className="text-xs text-muted-foreground">{seg.percentage}%</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setGrantSpinUser(null)} className="flex-1 py-3 rounded-xl text-sm font-semibold bg-white/[0.06] text-muted-foreground hover:bg-white/[0.1] transition-all border border-white/[0.08]">
                Cancelar
              </button>
              <button onClick={confirmGrantSpin} className="flex-1 py-3 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:brightness-110 transition-all shadow-lg shadow-primary/20">
                Liberar Giro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
