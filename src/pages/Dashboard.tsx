import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import CustomizationPanel from '@/components/casino/CustomizationPanel';
import DialogConfigPanel from '@/components/casino/DialogConfigPanel';
import AuthConfigPanel from '@/components/casino/AuthConfigPanel';
import { WheelConfig, defaultConfig } from '@/components/casino/types';
import { Users, Target, Shield, Trophy, Mail, Smartphone, MessageCircle, LogOut, Search, Plus, FileDown, FileUp, Pencil, Trash2, Copy, ExternalLink, ChevronLeft, ChevronRight, RotateCcw, Eye, Settings, Send, X, BarChart3, Globe, Monitor, Clock, MapPin, Wallet, DollarSign, Ban, Link2 } from 'lucide-react';
import ThemeSettingsPanel, { ThemeSettings, defaultTheme } from '@/components/casino/ThemeSettingsPanel';
import { uploadAppAsset } from '@/lib/uploadAppAsset';
import { useSiteSettings } from '@/hooks/useSiteSettings';

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
  pix_key_type: string;
  pix_key: string;
  user_type: string;
  responsible: string;
  auto_payment: boolean;
}

interface PersistedDashboardSettings {
  emailSubject: string;
  emailBody: string;
  emailTemplate: 'original' | 'custom';
  emailBannerUrl: string;
  emailSenderName: string;
  smsMessage: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioPhoneNumber: string;
  whatsappMessage: string;
  whatsappDelaySeconds: number;
  evolutionApiUrl: string;
  evolutionApiKey: string;
  evolutionInstance: string;
  spinWhatsappEnabled: boolean;
  spinWhatsappTemplate: string;
  spinWhatsappCustomMsg: string;
  batchWhatsappEnabled: boolean;
  batchWhatsappTemplate: string;
  batchWhatsappCustomMsg: string;
  excludeBulkSent: boolean;
  edpayPublicKey: string;
  edpaySecretKey: string;
  notifyEvolutionApiUrl: string;
  notifyEvolutionApiKey: string;
  notifyEvolutionInstance: string;
  notifyWhatsappPhone: string;
  notifyAutoPaymentEnabled: boolean;
}

const DEFAULT_PERSISTED_DASHBOARD_SETTINGS: PersistedDashboardSettings = {
  emailSubject: '🎰 Você tem um giro disponível!',
  emailBody: 'Olá! Você foi convidado para girar a roleta e concorrer a prêmios incríveis. Acesse o link abaixo e boa sorte!',
  emailTemplate: 'original',
  emailBannerUrl: '',
  emailSenderName: 'Royal Spin Wheel',
  smsMessage: '',
  twilioAccountSid: '',
  twilioAuthToken: '',
  twilioPhoneNumber: '',
  whatsappMessage: '',
  whatsappDelaySeconds: 2,
  evolutionApiUrl: '',
  evolutionApiKey: '',
  evolutionInstance: '',
  spinWhatsappEnabled: false,
  spinWhatsappTemplate: 'welcome',
  spinWhatsappCustomMsg: '',
  batchWhatsappEnabled: false,
  batchWhatsappTemplate: 'welcome',
  batchWhatsappCustomMsg: '',
  excludeBulkSent: false,
  edpayPublicKey: '',
  edpaySecretKey: '',
  notifyEvolutionApiUrl: '',
  notifyEvolutionApiKey: '',
  notifyEvolutionInstance: '',
  notifyWhatsappPhone: '',
  notifyAutoPaymentEnabled: false,
};

const GlassCard = ({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] ${className}`} {...props}>
    {children}
  </div>
);

const WHATSAPP_SPIN_TEMPLATES = [
  { id: 'welcome', label: '🎉 Boas-vindas', message: 'Olá {nome}! Você recebeu {giros} giro(s) na nossa roleta! Acesse agora: {link}' },
  { id: 'vip', label: '⭐ VIP', message: '🌟 Parabéns {nome}! Como cliente VIP, você ganhou {giros} giro(s) exclusivo(s)! Jogue agora: {link}' },
  { id: 'promo', label: '🔥 Promoção', message: '🔥 {nome}, aproveite! Você acaba de receber {giros} giro(s) especiais na nossa roleta de prêmios! Gire já: {link}' },
  { id: 'birthday', label: '🎂 Aniversário', message: '🎂 Feliz aniversário, {nome}! Presente especial: {giros} giro(s) grátis na roleta! Aproveite: {link}' },
  { id: 'loyalty', label: '💎 Fidelidade', message: '💎 Obrigado pela fidelidade, {nome}! Você ganhou {giros} giro(s) como recompensa. Jogue aqui: {link}' },
  { id: 'custom', label: '✏️ Personalizado', message: '' },
];

const Dashboard = () => {
  useSiteSettings();
  const configHydratedRef = useRef(false);
  const lastPersistedSettingsRef = useRef('');
  const lastConfigUpdatedAtRef = useRef<string | null>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<'inscritos' | 'wheel' | 'auth' | 'history' | 'email' | 'sms' | 'whatsapp' | 'analytics' | 'financeiro' | 'referral'>('inscritos');
  const [referralLinks, setReferralLinks] = useState<any[]>([]);
  const [referralLoading, setReferralLoading] = useState(false);
  const [showReferralForm, setShowReferralForm] = useState(false);
  const [referralForm, setReferralForm] = useState({ label: '', spins_per_registration: 1 });
  const [editingReferral, setEditingReferral] = useState<any>(null);
  const [pageViews, setPageViews] = useState<any[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [users, setUsers] = useState<WheelUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [spinsFilter, setSpinsFilter] = useState<'all' | 'with' | 'without' | 'auto_pay'>('all');

  const [showDisableAutoPayModal, setShowDisableAutoPayModal] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<WheelUser | null>(null);
  const [form, setForm] = useState({ account_id: '', email: '', name: '', phone: '', fixed_prize_enabled: false, fixed_prize_segment: null as number | null, pix_key_type: '', pix_key: '', user_type: '', responsible: '', auto_payment: false });
  const [spinResults, setSpinResults] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [viewingUserData, setViewingUserData] = useState<WheelUser | null>(null);
  const [viewingUserLoading, setViewingUserLoading] = useState(false);

  const [emailSubject, setEmailSubject] = useState('🎰 Você tem um giro disponível!');
  const [emailBody, setEmailBody] = useState('Olá! Você foi convidado para girar a roleta e concorrer a prêmios incríveis. Acesse o link abaixo e boa sorte!');
  const [emailSending, setEmailSending] = useState(false);
  const [emailTarget, setEmailTarget] = useState<'all' | 'selected'>('all');
  const [emailSearchTerm, setEmailSearchTerm] = useState('');
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
  const [whatsappDelaySeconds, setWhatsappDelaySeconds] = useState(2);
  const [whatsappTarget, setWhatsappTarget] = useState<'all' | 'selected'>('all');
  const [selectedWhatsappPhones, setSelectedWhatsappPhones] = useState<string[]>([]);
  const [whatsappSearch, setWhatsappSearch] = useState('');
  const [showWhatsappConfig, setShowWhatsappConfig] = useState(false);
  const [evolutionApiUrl, setEvolutionApiUrl] = useState(() => localStorage.getItem('evolution_api_url') || '');
  const [evolutionApiKey, setEvolutionApiKey] = useState(() => localStorage.getItem('evolution_api_key') || '');
  const [evolutionInstance, setEvolutionInstance] = useState(() => localStorage.getItem('evolution_instance') || '');
  const [instanceStatus, setInstanceStatus] = useState<'unknown' | 'loading' | 'open' | 'close' | 'connecting' | 'error'>('unknown');
  const [instanceQrCode, setInstanceQrCode] = useState<string | null>(null);
  const [creatingInstance, setCreatingInstance] = useState(false);
  const [whatsappLogs, setWhatsappLogs] = useState<any[]>([]);
  const [whatsappLogsLoading, setWhatsappLogsLoading] = useState(false);
  const [showWhatsappHistory, setShowWhatsappHistory] = useState(false);
  const [excludeBulkSent, setExcludeBulkSent] = useState(false);
  const [edpayPublicKey, setEdpayPublicKey] = useState('');
  const [edpaySecretKey, setEdpaySecretKey] = useState('');
  const [showEdpaySecret, setShowEdpaySecret] = useState(false);
  const [notifyEvolutionApiUrl, setNotifyEvolutionApiUrl] = useState('');
  const [notifyEvolutionApiKey, setNotifyEvolutionApiKey] = useState('');
  const [notifyEvolutionInstance, setNotifyEvolutionInstance] = useState('');
  const [notifyWhatsappPhone, setNotifyWhatsappPhone] = useState('');
  const [notifyAutoPaymentEnabled, setNotifyAutoPaymentEnabled] = useState(false);
  const [showNotifySecret, setShowNotifySecret] = useState(false);
  const [financeiroSubTab, setFinanceiroSubTab] = useState<'credenciais' | 'deposito' | 'aprovacoes' | 'saldo' | 'crypto' | 'withdraw' | 'historico'>('credenciais');
  const [edpayBalance, setEdpayBalance] = useState<number | null>(null);
  const [edpayBalanceLoading, setEdpayBalanceLoading] = useState(false);
  const [cryptoAmount, setCryptoAmount] = useState('');
  const [cryptoDescription, setCryptoDescription] = useState('');
  const [cryptoLoading, setCryptoLoading] = useState(false);
  const [cryptoData, setCryptoData] = useState<any>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawDescription, setWithdrawDescription] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawData, setWithdrawData] = useState<any>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositDescription, setDepositDescription] = useState('');
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositQrData, setDepositQrData] = useState<any>(null);
  const [prizePayments, setPrizePayments] = useState<any[]>([]);
  const [prizePaymentsLoading, setPrizePaymentsLoading] = useState(false);
  const [payingPaymentId, setPayingPaymentId] = useState<string | null>(null);
  const [paidHistory, setPaidHistory] = useState<any[]>([]);
  const [paidHistoryLoading, setPaidHistoryLoading] = useState(false);
  const [bulkSentPhones, setBulkSentPhones] = useState<Set<string>>(new Set());
  const [bulkSentOldestTime, setBulkSentOldestTime] = useState<Date | null>(null);
  const [bulkSentCountdown, setBulkSentCountdown] = useState('');

  const fetchReferralLinks = async () => {
    if (!session?.user?.id) return;
    setReferralLoading(true);
    const { data } = await (supabase as any)
      .from('referral_links')
      .select('*')
      .eq('owner_id', session.user.id)
      .order('created_at', { ascending: false });
    setReferralLinks(data || []);
    setReferralLoading(false);
  };

  const handleSaveReferral = async () => {
    if (!referralForm.label.trim()) { toast.error('Preencha o nome do link'); return; }
    if (editingReferral) {
      const { error } = await (supabase as any)
        .from('referral_links')
        .update({ label: referralForm.label, spins_per_registration: referralForm.spins_per_registration, updated_at: new Date().toISOString() })
        .eq('id', editingReferral.id);
      if (error) { toast.error('Erro ao atualizar'); return; }
      toast.success('Link atualizado!');
    } else {
      const { error } = await (supabase as any)
        .from('referral_links')
        .insert({ owner_id: session.user.id, label: referralForm.label, spins_per_registration: referralForm.spins_per_registration });
      if (error) { toast.error('Erro ao criar link'); return; }
      toast.success('Link criado!');
    }
    setShowReferralForm(false);
    setEditingReferral(null);
    setReferralForm({ label: '', spins_per_registration: 1 });
    fetchReferralLinks();
  };

  const handleToggleReferral = async (id: string, currentActive: boolean) => {
    await (supabase as any).from('referral_links').update({ is_active: !currentActive, updated_at: new Date().toISOString() }).eq('id', id);
    fetchReferralLinks();
  };

  const handleDeleteReferral = async (id: string) => {
    if (!confirm('Excluir este link?')) return;
    await (supabase as any).from('referral_links').delete().eq('id', id);
    toast.success('Link excluído');
    fetchReferralLinks();
  };

  const fetchWhatsappLogs = async () => {
    if (!session?.user?.id) return;
    setWhatsappLogsLoading(true);
    const { data } = await (supabase as any)
      .from('whatsapp_message_log')
      .select('*')
      .eq('owner_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setWhatsappLogs(data || []);
    setWhatsappLogsLoading(false);
  };

  const fetchBulkSentPhones = async () => {
    if (!session?.user?.id) return;
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await (supabase as any)
      .from('whatsapp_message_log')
      .select('recipient_phone, created_at')
      .eq('owner_id', session.user.id)
      .eq('status', 'sent')
      .gte('created_at', since24h);
    const rows = data || [];
    const phones = new Set<string>(rows.map((d: any) => d.recipient_phone));
    setBulkSentPhones(phones);
    if (rows.length > 0) {
      const oldest = rows.reduce((min: string, d: any) => d.created_at < min ? d.created_at : min, rows[0].created_at);
      setBulkSentOldestTime(new Date(oldest));
    } else {
      setBulkSentOldestTime(null);
    }
  };

  useEffect(() => {
    if (!excludeBulkSent || !bulkSentOldestTime) { setBulkSentCountdown(''); return; }
    const update = () => {
      const expiresAt = bulkSentOldestTime.getTime() + 24 * 60 * 60 * 1000;
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        setBulkSentCountdown('');
        fetchBulkSentPhones();
        return;
      }
      const h = Math.floor(remaining / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setBulkSentCountdown(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [excludeBulkSent, bulkSentOldestTime]);

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
  const [grantSpinCount, setGrantSpinCount] = useState<number>(1);
  const [dashboardTheme, setDashboardTheme] = useState<ThemeSettings | undefined>(undefined);

  // Multi-select for batch grant
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [showBatchGrantModal, setShowBatchGrantModal] = useState(false);
  const [batchGrantMode, setBatchGrantMode] = useState<'random' | 'fixed'>('random');
  const [batchGrantSegment, setBatchGrantSegment] = useState<number>(0);
  const [batchGrantSpinCount, setBatchGrantSpinCount] = useState<number>(1);
  const [spinWhatsappEnabled, setSpinWhatsappEnabled] = useState(false);
  const [spinWhatsappTemplate, setSpinWhatsappTemplate] = useState('welcome');
  const [spinWhatsappCustomMsg, setSpinWhatsappCustomMsg] = useState('');
  const [batchWhatsappEnabled, setBatchWhatsappEnabled] = useState(false);
  const [batchWhatsappTemplate, setBatchWhatsappTemplate] = useState('welcome');
  const [batchWhatsappCustomMsg, setBatchWhatsappCustomMsg] = useState('');
  const [savingUser, setSavingUser] = useState(false);

  const syncLegacyIntegrationStorage = (settings: PersistedDashboardSettings) => {
    const legacyEntries: Array<[string, string]> = [
      ['twilio_account_sid', settings.twilioAccountSid],
      ['twilio_auth_token', settings.twilioAuthToken],
      ['twilio_phone_number', settings.twilioPhoneNumber],
      ['evolution_api_url', settings.evolutionApiUrl],
      ['evolution_api_key', settings.evolutionApiKey],
      ['evolution_instance', settings.evolutionInstance],
    ];

    legacyEntries.forEach(([key, value]) => {
      if (value) localStorage.setItem(key, value);
      else localStorage.removeItem(key);
    });
  };

  const buildPersistedDashboardSettings = (): PersistedDashboardSettings => ({
    emailSubject,
    emailBody,
    emailTemplate,
    emailBannerUrl,
    emailSenderName,
    smsMessage,
    twilioAccountSid,
    twilioAuthToken,
    twilioPhoneNumber,
    whatsappMessage,
    whatsappDelaySeconds,
    evolutionApiUrl,
    evolutionApiKey,
    evolutionInstance,
    spinWhatsappEnabled,
    spinWhatsappTemplate,
    spinWhatsappCustomMsg,
    batchWhatsappEnabled,
    batchWhatsappTemplate,
    batchWhatsappCustomMsg,
    excludeBulkSent,
    edpayPublicKey,
    edpaySecretKey,
    notifyEvolutionApiUrl,
    notifyEvolutionApiKey,
    notifyEvolutionInstance,
    notifyWhatsappPhone,
    notifyAutoPaymentEnabled,
  });

  const applyPersistedDashboardSettings = (rawSettings?: Partial<PersistedDashboardSettings>) => {
    const settings: PersistedDashboardSettings = {
      ...DEFAULT_PERSISTED_DASHBOARD_SETTINGS,
      twilioAccountSid: localStorage.getItem('twilio_account_sid') || '',
      twilioAuthToken: localStorage.getItem('twilio_auth_token') || '',
      twilioPhoneNumber: localStorage.getItem('twilio_phone_number') || '',
      evolutionApiUrl: localStorage.getItem('evolution_api_url') || '',
      evolutionApiKey: localStorage.getItem('evolution_api_key') || '',
      evolutionInstance: localStorage.getItem('evolution_instance') || '',
      ...(rawSettings || {}),
    };

    setEmailSubject(settings.emailSubject);
    setEmailBody(settings.emailBody);
    setEmailTemplate(settings.emailTemplate === 'custom' ? 'custom' : 'original');
    setEmailBannerUrl(settings.emailBannerUrl || '');
    setEmailSenderName(settings.emailSenderName || DEFAULT_PERSISTED_DASHBOARD_SETTINGS.emailSenderName);
    setSmsMessage(settings.smsMessage || '');
    setTwilioAccountSid(settings.twilioAccountSid || '');
    setTwilioAuthToken(settings.twilioAuthToken || '');
    setTwilioPhoneNumber(settings.twilioPhoneNumber || '');
    setWhatsappMessage(settings.whatsappMessage || '');
    setWhatsappDelaySeconds(Number(settings.whatsappDelaySeconds) > 0 ? Number(settings.whatsappDelaySeconds) : 2);
    setEvolutionApiUrl(settings.evolutionApiUrl || '');
    setEvolutionApiKey(settings.evolutionApiKey || '');
    setEvolutionInstance(settings.evolutionInstance || '');
    setSpinWhatsappEnabled(!!settings.spinWhatsappEnabled);
    setSpinWhatsappTemplate(settings.spinWhatsappTemplate || 'welcome');
    setSpinWhatsappCustomMsg(settings.spinWhatsappCustomMsg || '');
    setBatchWhatsappEnabled(!!settings.batchWhatsappEnabled);
    setBatchWhatsappTemplate(settings.batchWhatsappTemplate || 'welcome');
    setBatchWhatsappCustomMsg(settings.batchWhatsappCustomMsg || '');
    setExcludeBulkSent(!!settings.excludeBulkSent);
    setEdpayPublicKey(settings.edpayPublicKey || '');
    setEdpaySecretKey(settings.edpaySecretKey || '');
    setNotifyEvolutionApiUrl(settings.notifyEvolutionApiUrl || '');
    setNotifyEvolutionApiKey(settings.notifyEvolutionApiKey || '');
    setNotifyEvolutionInstance(settings.notifyEvolutionInstance || '');
    setNotifyWhatsappPhone(settings.notifyWhatsappPhone || '');
    setNotifyAutoPaymentEnabled(!!settings.notifyAutoPaymentEnabled);

    syncLegacyIntegrationStorage(settings);
    lastPersistedSettingsRef.current = JSON.stringify(settings);
  };

  const hydrateDashboardConfig = (cfg?: { id?: string; slug?: string; config?: Record<string, any>; updated_at?: string } | null) => {
    if (cfg?.id) setConfigId(cfg.id);
    if (cfg?.slug) {
      setSlug(cfg.slug);
      setNewSlug(cfg.slug);
    }

    const rawConfig = cfg?.config || {};
    const loadedConfig = rawConfig && Object.keys(rawConfig).length > 0
      ? { ...defaultConfig, ...rawConfig }
      : defaultConfig;

    setWheelConfig(loadedConfig);
    setDashboardTheme({ ...defaultTheme, ...(rawConfig?.dashboardTheme || {}) });
    applyPersistedDashboardSettings(rawConfig?.dashboardSettings || {});
    lastConfigUpdatedAtRef.current = cfg?.updated_at || null;
  };

  const syncDashboardConfig = async (userId: string, force = false) => {
    const { data: latest } = await (supabase as any)
      .from('wheel_configs')
      .select('id, slug, config, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (!latest) return;
    if (!force && lastConfigUpdatedAtRef.current && latest.updated_at === lastConfigUpdatedAtRef.current) return;

    configHydratedRef.current = false;
    hydrateDashboardConfig(latest);
    configHydratedRef.current = true;
  };

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
    configHydratedRef.current = false;
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

    if (cfg) hydrateDashboardConfig(cfg);
    else hydrateDashboardConfig(null);

    configHydratedRef.current = true;

    setLoading(false);
    fetchUsers(userId);
    fetchHistory(userId);
  };

  useEffect(() => {
    if (!session?.user?.id || !configHydratedRef.current || !configId) return;

    const settings = buildPersistedDashboardSettings();
    const serialized = JSON.stringify(settings);
    syncLegacyIntegrationStorage(settings);

    if (serialized === lastPersistedSettingsRef.current) return;

    const timeoutId = window.setTimeout(async () => {
      const latestSettings = buildPersistedDashboardSettings();
      const latestSerialized = JSON.stringify(latestSettings);
      if (latestSerialized === lastPersistedSettingsRef.current) return;

      const { data: dbRow } = await (supabase as any)
        .from('wheel_configs')
        .select('config')
        .eq('id', configId)
        .maybeSingle();

      const dbConfig = dbRow?.config || {};
      const newUpdatedAt = new Date().toISOString();
      const { error } = await (supabase as any)
        .from('wheel_configs')
        .update({
          config: { ...dbConfig, dashboardSettings: latestSettings },
          updated_at: newUpdatedAt,
        })
        .eq('id', configId);

      if (!error) {
        lastPersistedSettingsRef.current = latestSerialized;
        lastConfigUpdatedAtRef.current = newUpdatedAt;
      }
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [
    session?.user?.id,
    configId,
    emailSubject,
    emailBody,
    emailTemplate,
    emailBannerUrl,
    emailSenderName,
    smsMessage,
    twilioAccountSid,
    twilioAuthToken,
    twilioPhoneNumber,
    whatsappMessage,
    whatsappDelaySeconds,
    evolutionApiUrl,
    evolutionApiKey,
    evolutionInstance,
    spinWhatsappEnabled,
    spinWhatsappTemplate,
    spinWhatsappCustomMsg,
    batchWhatsappEnabled,
    batchWhatsappTemplate,
    batchWhatsappCustomMsg,
    excludeBulkSent,
    edpayPublicKey,
    edpaySecretKey,
    notifyEvolutionApiUrl,
    notifyEvolutionApiKey,
    notifyEvolutionInstance,
    notifyWhatsappPhone,
    notifyAutoPaymentEnabled,
  ]);

  useEffect(() => {
    if (!session?.user?.id || !configId) return;

    const syncIfNeeded = () => {
      if (document.visibilityState === 'hidden') return;
      void syncDashboardConfig(session.user.id);
    };

    const intervalId = window.setInterval(syncIfNeeded, 5000);
    window.addEventListener('focus', syncIfNeeded);
    document.addEventListener('visibilitychange', syncIfNeeded);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', syncIfNeeded);
      document.removeEventListener('visibilitychange', syncIfNeeded);
    };
  }, [session?.user?.id, configId]);

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
    try {
      const { segments, ...rest } = wheelConfig;
      const cleanSegments = segments?.map(({ imageUrl, ...s }: any) => ({
        ...s,
        imageUrl: typeof imageUrl === 'string' && imageUrl.startsWith('data:') ? '' : imageUrl,
      }));

      // Build config from local state only (source of truth)
      const cleanConfig: Record<string, any> = {
        ...rest,
        segments: cleanSegments,
        dashboardTheme: dashboardTheme || undefined,
        dashboardSettings: buildPersistedDashboardSettings(),
      };

      // Strip data: URLs for image fields
      ['authLogoUrl', 'authBgImageUrl', 'authBgImageMobileUrl', 'headerImageUrl', 'backgroundImageUrl', 'centerImageUrl'].forEach(key => {
        if (typeof cleanConfig[key] === 'string' && cleanConfig[key].startsWith('data:')) {
          cleanConfig[key] = '';
        }
      });

      // Remove undefined keys so they don't erase DB values
      Object.keys(cleanConfig).forEach(k => {
        if (cleanConfig[k] === undefined) delete cleanConfig[k];
      });

      // Read current DB config to preserve any keys not in local state (e.g. dashboardTheme set by admin)
      const { data: dbRow } = await (supabase as any)
        .from('wheel_configs')
        .select('config')
        .eq('user_id', session.user.id)
        .maybeSingle();
      const dbConfig = dbRow?.config || {};

      // Merge: DB values as base, local changes on top
      const mergedConfig = { ...dbConfig, ...cleanConfig };

      const { data: updated, error } = await (supabase as any)
        .from('wheel_configs')
        .update({ config: mergedConfig, updated_at: new Date().toISOString() })
        .eq('user_id', session.user.id)
        .select('config, updated_at')
        .maybeSingle();

      if (error) {
        toast.error('Erro ao salvar: ' + error.message);
      } else if (!updated) {
        toast.error('Erro: configuração não foi atualizada. Recarregue a página.');
      } else {
        toast.success('Configuração salva!');
        lastConfigUpdatedAtRef.current = updated.updated_at || lastConfigUpdatedAtRef.current;
        // Sync local state with what was actually saved in DB
        setWheelConfig({ ...defaultConfig, ...updated.config });
        setDashboardTheme({ ...defaultTheme, ...(updated.config?.dashboardTheme || {}) });
        applyPersistedDashboardSettings(updated.config?.dashboardSettings || {});
      }
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err?.message || 'desconhecido'));
    }
    setSavingConfig(false);
  };


  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingUser) return;
    setSavingUser(true);
    try {
      if (editingUser) {
        const { error } = await (supabase as any)
          .from('wheel_users')
          .update({ account_id: form.account_id, email: form.email, name: form.name, phone: form.phone, fixed_prize_enabled: form.fixed_prize_enabled, fixed_prize_segment: form.fixed_prize_enabled ? form.fixed_prize_segment : null, pix_key_type: form.pix_key_type, pix_key: form.pix_key, user_type: form.user_type, responsible: form.responsible, auto_payment: form.auto_payment })
          .eq('id', editingUser.id);
        if (error) {
          if (error.message?.includes('duplicate') || error.code === '23505') {
            toast.error('Já existe um inscrito com esse e-mail ou ID de conta.');
          } else {
            toast.error('Erro: ' + error.message);
          }
          return;
        }
        toast.success('Atualizado!');
      } else {
        const { error } = await (supabase as any)
          .from('wheel_users')
          .insert({ account_id: form.account_id, email: form.email, name: form.name, phone: form.phone, owner_id: session.user.id, pix_key_type: form.pix_key_type, pix_key: form.pix_key, user_type: form.user_type, responsible: form.responsible, auto_payment: form.auto_payment });
        if (error) {
          if (error.message?.includes('duplicate') || error.code === '23505') {
            toast.error('Já existe um inscrito com esse e-mail ou ID de conta.');
          } else {
            toast.error('Erro: ' + error.message);
          }
          return;
        }
        toast.success('Inscrito criado!');
      }
      setShowForm(false);
      setEditingUser(null);
      setForm({ account_id: '', email: '', name: '', phone: '', fixed_prize_enabled: false, fixed_prize_segment: null, pix_key_type: '', pix_key: '', user_type: '', responsible: '', auto_payment: false });
      fetchUsers();
    } finally {
      setSavingUser(false);
    }
  };

  const openEdit = (user: WheelUser) => {
    setEditingUser(user);
    setForm({ account_id: user.account_id, email: user.email, name: user.name, phone: user.phone || '', fixed_prize_enabled: user.fixed_prize_enabled ?? false, fixed_prize_segment: user.fixed_prize_segment ?? null, pix_key_type: user.pix_key_type || '', pix_key: user.pix_key || '', user_type: user.user_type || '', responsible: user.responsible || '', auto_payment: user.auto_payment ?? false });
    setShowForm(true);
  };

  const openNew = () => {
    setEditingUser(null);
    setForm({ account_id: '', email: '', name: '', phone: '', fixed_prize_enabled: false, fixed_prize_segment: null, pix_key_type: '', pix_key: '', user_type: '', responsible: '', auto_payment: false });
    setShowForm(true);
  };

  const fetchPaidHistory = async () => {
    if (!session?.user?.id) return;
    setPaidHistoryLoading(true);
    const { data } = await (supabase as any)
      .from('prize_payments')
      .select('*')
      .eq('owner_id', session.user.id)
      .in('status', ['paid', 'rejected'])
      .order('created_at', { ascending: false });
    setPaidHistory(data || []);
    setPaidHistoryLoading(false);
  };

  const fetchPrizePayments = async () => {
    if (!session?.user?.id) return;
    setPrizePaymentsLoading(true);
    const { data } = await (supabase as any)
      .from('prize_payments')
      .select('*')
      .eq('owner_id', session.user.id)
      .in('status', ['pending', 'auto_pending', 'approved', 'failed'])
      .order('created_at', { ascending: false });
    setPrizePayments(data || []);
    setPrizePaymentsLoading(false);
  };

  const handlePayPrize = async (paymentId: string) => {
    if (!edpayPublicKey || !edpaySecretKey) {
      toast.error('Configure as credenciais EdPay na aba Financeiro > Credenciais');
      return;
    }
    setPayingPaymentId(paymentId);
    try {
      const { data, error } = await supabase.functions.invoke('edpay-pix-transfer', {
        body: { paymentId, edpayPublicKey, edpaySecretKey },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
      } else {
        toast.success('Pagamento realizado com sucesso!');
        fetchPrizePayments();
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao processar pagamento');
    } finally {
      setPayingPaymentId(null);
    }
  };

  const handleApprovePrize = async (paymentId: string) => {
    await (supabase as any).from('prize_payments').update({ status: 'approved', updated_at: new Date().toISOString() }).eq('id', paymentId);
    toast.success('Prêmio aprovado!');
    fetchPrizePayments();
  };

  const handleRejectPrize = async (paymentId: string) => {
    await (supabase as any).from('prize_payments').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', paymentId);
    toast.success('Prêmio rejeitado');
    fetchPrizePayments();
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
    setGrantSpinCount(1);
  };

  const sendSpinWhatsapp = async (user: WheelUser, count: number, templateId: string, customMsg: string) => {
    if (!evolutionApiUrl || !evolutionApiKey || !evolutionInstance) return;
    if (!user.phone || user.phone.replace(/\D/g, '').length < 10) return;
    const tpl = WHATSAPP_SPIN_TEMPLATES.find(t => t.id === templateId);
    if (!tpl) return;
    const baseMsg = templateId === 'custom' ? customMsg : tpl.message;
    if (!baseMsg.trim()) return;
    const wheelLink = `${window.location.origin}/${slug}`;
    const finalMsg = baseMsg
      .replace(/\{nome\}/g, user.name)
      .replace(/\{giros\}/g, String(count))
      .replace(/\{link\}/g, wheelLink);
    let sendError: string | null = null;
    try {
      const { error } = await supabase.functions.invoke('send-whatsapp', {
        body: { recipientPhone: user.phone, message: finalMsg, evolutionApiUrl, evolutionApiKey, evolutionInstance }
      });
      if (error) sendError = error.message;
    } catch (e: any) {
      sendError = e?.message || 'Erro desconhecido';
      console.error('WhatsApp send error:', e);
    }
    try {
      await (supabase as any).from('whatsapp_message_log').insert({
        owner_id: session?.user?.id,
        recipient_phone: user.phone,
        recipient_name: user.name,
        message: finalMsg,
        status: sendError ? 'error' : 'sent',
        error_message: sendError,
      });
    } catch (e) { /* silent */ }
  };

  const confirmGrantSpin = async () => {
    if (!grantSpinUser) return;
    const count = Math.max(1, grantSpinCount);
    const isFixed = grantSpinMode === 'fixed';
    const { error } = await (supabase as any).from('wheel_users').update({
      spins_available: count,
      fixed_prize_enabled: isFixed,
      fixed_prize_segment: isFixed ? grantSpinSegment : null,
    }).eq('id', grantSpinUser.id);
    if (error) { toast.error('Erro ao liberar giro'); return; }
    toast.success(`${count} giro(s) liberado(s) para ${grantSpinUser.name}!`);
    if (spinWhatsappEnabled) {
      sendSpinWhatsapp(grantSpinUser, count, spinWhatsappTemplate, spinWhatsappCustomMsg);
      toast.info(`📱 WhatsApp enviado para ${grantSpinUser.name}`);
    }
    setGrantSpinUser(null);
    fetchUsers();
  };

  const confirmBatchGrantSpin = async () => {
    if (selectedUserIds.size === 0) return;
    const count = Math.max(1, batchGrantSpinCount);
    const isFixed = batchGrantMode === 'fixed';
    const selectedUsers = users.filter(u => selectedUserIds.has(u.id));
    let success = 0;
    for (const user of selectedUsers) {
      const { error } = await (supabase as any).from('wheel_users').update({
        spins_available: count,
        fixed_prize_enabled: isFixed,
        fixed_prize_segment: isFixed ? batchGrantSegment : null,
      }).eq('id', user.id);
      if (!error) {
        success++;
        if (batchWhatsappEnabled) {
          await sendSpinWhatsapp(user, count, batchWhatsappTemplate, batchWhatsappCustomMsg);
        }
      }
    }
    toast.success(`${success} inscrito(s) receberam ${count} giro(s)!`);
    if (batchWhatsappEnabled) toast.info(`📱 WhatsApp enviado para ${success} inscrito(s)`);
    setShowBatchGrantModal(false);
    setSelectedUserIds(new Set());
    fetchUsers();
  };

  const handleClearHistory = async () => {
    if (!confirm('Tem certeza que deseja limpar todo o histórico de sorteio?')) return;
    const uid = session?.user?.id;
    if (!uid) return;
    const { error } = await (supabase as any).from('spin_results').delete().eq('owner_id', uid);
    if (error) { toast.error('Erro ao limpar histórico'); return; }
    toast.success('Histórico limpo!');
    setSpinResults([]);
  };

  const handleClearAnalytics = async () => {
    if (!confirm('Tem certeza que deseja limpar todo o histórico de analytics?')) return;
    const uid = session?.user?.id;
    if (!uid) return;
    const { error } = await (supabase as any).from('page_views').delete().eq('owner_id', uid);
    if (error) { toast.error('Erro ao limpar analytics'); return; }
    toast.success('Analytics limpo!');
    setPageViews([]);
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Excluir este usuário?')) return;
    await (supabase as any).from('wheel_users').delete().eq('id', id);
    toast.success('Excluído!');
    fetchUsers();
  };

  const handleDeleteSelectedUsers = async () => {
    if (selectedUserIds.size === 0) return;
    if (!confirm(`Excluir ${selectedUserIds.size} inscrito(s) selecionado(s)?`)) return;
    const ids = Array.from(selectedUserIds);
    const { error } = await (supabase as any).from('wheel_users').delete().in('id', ids);
    if (error) { toast.error('Erro ao excluir inscritos'); return; }
    toast.success(`${ids.length} inscrito(s) excluído(s)!`);
    setSelectedUserIds(new Set());
    fetchUsers();
  };

  const handleExportCSV = () => {
    const escapeCsvValue = (value: string) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const header = '#,"Nome","E-mail","Celular","ID da Conta","Tipo Chave PIX","Chave PIX","Data de Inscrição","Tipo","Responsável",\n';
    const rows = filteredUsers.map((u, i) =>
      [
        i + 1,
        escapeCsvValue(u.name),
        escapeCsvValue(u.email),
        escapeCsvValue(u.phone || ''),
        escapeCsvValue(u.account_id),
        escapeCsvValue(u.pix_key_type || ''),
        escapeCsvValue(u.pix_key || ''),
        escapeCsvValue(u.created_at || ''),
        escapeCsvValue(u.user_type || ''),
        escapeCsvValue(u.responsible || ''),
        '',
      ].join(',')
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

  const parseCsvText = (text: string) => {
    const rows: string[][] = [];
    let row: string[] = [];
    let current = '';
    let inQuotes = false;

    const pushField = () => {
      row.push(current.trim());
      current = '';
    };

    const pushRow = () => {
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
    };

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === ',' && !inQuotes) {
        pushField();
        continue;
      }

      if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') i++;
        pushField();
        pushRow();
        continue;
      }

      current += char;
    }

    if (current.length > 0 || row.length > 0) {
      pushField();
      pushRow();
    }

    return rows;
  };

  const normalizeCsvHeader = (value: string) =>
    value
      .replace(/^#(?:\(.+\))?$/i, 'numero')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session?.user?.id) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = String(ev.target?.result || '').replace(/^\uFEFF/, '');
      const records = parseCsvText(text);

      if (records.length < 2) {
        toast.error('CSV vazio');
        return;
      }

      const headerColumns = records[0].map(normalizeCsvHeader);
      const headerMap = new Map(headerColumns.map((column, index) => [column, index]));
      const getColumnIndex = (...keys: string[]) => {
        for (const key of keys) {
          const index = headerMap.get(key);
          if (typeof index === 'number') return index;
        }
        return -1;
      };

      const columnIndex = {
        name: getColumnIndex('nome'),
        email: getColumnIndex('e_mail', 'email'),
        phone: getColumnIndex('celular'),
        accountId: getColumnIndex('id_da_conta'),
        pixKeyType: getColumnIndex('tipo_chave_pix'),
        pixKey: getColumnIndex('chave_pix'),
        createdAt: getColumnIndex('data_de_inscricao'),
        userType: getColumnIndex('tipo'),
        responsible: getColumnIndex('responsavel'),
      };

      const hasExpectedHeader = [columnIndex.name, columnIndex.email, columnIndex.accountId].every(index => index >= 0);
      const dataRows = hasExpectedHeader ? records.slice(1) : records;
      const getValue = (cols: string[], index: number, fallbackIndex: number) => {
        const finalIndex = index >= 0 ? index : fallbackIndex;
        return finalIndex >= 0 ? String(cols[finalIndex] ?? '').trim() : '';
      };

      const rowsToInsert = dataRows
        .filter((cols) => cols.some(col => col !== ''))
        .map((cols) => {
          const row: Record<string, string> = {
            name: getValue(cols, columnIndex.name, 1),
            email: getValue(cols, columnIndex.email, 2),
            phone: getValue(cols, columnIndex.phone, 3),
            account_id: getValue(cols, columnIndex.accountId, 4),
            pix_key_type: getValue(cols, columnIndex.pixKeyType, 5),
            pix_key: getValue(cols, columnIndex.pixKey, 6),
            user_type: getValue(cols, columnIndex.userType, 8),
            responsible: getValue(cols, columnIndex.responsible, 9),
            owner_id: session.user.id,
          };

          const createdAt = getValue(cols, columnIndex.createdAt, 7);
          if (createdAt) {
            const parsedDate = new Date(createdAt);
            if (!Number.isNaN(parsedDate.getTime())) row.created_at = parsedDate.toISOString();
          }

          return row;
        })
        .filter((row) => row.name && row.email && row.account_id && row.name.toLowerCase() !== 'nome');

      if (rowsToInsert.length === 0) {
        toast.error('Nenhuma linha válida encontrada no CSV');
        return;
      }

      const chunkSize = 100;
      let imported = 0;
      let errors = 0;

      let duplicates = 0;
      for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
        const chunk = rowsToInsert.slice(i, i + chunkSize);
        const { error, data } = await (supabase as any)
          .from('wheel_users')
          .insert(chunk)
          .select('id');

        if (!error) {
          imported += data?.length || chunk.length;
          continue;
        }

        for (const row of chunk) {
          const { error: rowError } = await (supabase as any).from('wheel_users').insert(row);
          if (rowError) {
            if (rowError.message?.includes('duplicate') || rowError.code === '23505') {
              // Try to find existing user by email and update their account_id
              const { data: existing } = await (supabase as any)
                .from('wheel_users')
                .select('id, account_id, email')
                .eq('owner_id', row.owner_id)
                .ilike('email', row.email)
                .maybeSingle();

              if (existing) {
                const updates: Record<string, any> = {};
                if (existing.account_id !== row.account_id) updates.account_id = row.account_id;
                if (row.name) updates.name = row.name;
                if (row.phone) updates.phone = row.phone;
                if (row.pix_key_type) updates.pix_key_type = row.pix_key_type;
                if (row.pix_key) updates.pix_key = row.pix_key;
                if (row.user_type) updates.user_type = row.user_type;
                if (row.responsible) updates.responsible = row.responsible;

                if (Object.keys(updates).length > 0) {
                  updates.updated_at = new Date().toISOString();
                  const { error: updateError } = await (supabase as any)
                    .from('wheel_users')
                    .update(updates)
                    .eq('id', existing.id);
                  if (!updateError) {
                    duplicates++;
                  } else {
                    errors++;
                  }
                } else {
                  duplicates++;
                }
              } else {
                duplicates++;
              }
            } else {
              errors++;
            }
          } else {
            imported++;
          }
        }
      }

      let msg = `${imported} importado(s)`;
      if (duplicates > 0) msg += `, ${duplicates} atualizado(s)`;
      if (errors > 0) msg += `, ${errors} erro(s)`;
      toast.success(msg);
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

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.account_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSpins = spinsFilter === 'all' ? true
      : spinsFilter === 'with' ? u.spins_available >= 1
      : spinsFilter === 'without' ? u.spins_available < 1
      : spinsFilter === 'auto_pay' ? !!u.auto_payment
      : true;
    return matchesSearch && matchesSpins;
  });

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
    { key: 'financeiro', icon: <Wallet size={20} />, label: 'Financeiro' },
    { key: 'referral', icon: <Link2 size={20} />, label: 'Links Ref.' },
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
    financeiro: 'Financeiro',
  };

  return (
    <div className="min-h-screen bg-background flex relative overflow-hidden">
      <ThemeSettingsPanel
        storageKey={session?.user?.id ? `dashboard_theme_${session.user.id}` : 'dashboard_theme'}
        initialTheme={dashboardTheme ?? defaultTheme}
        onThemeChange={handleThemeChange}
      />
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
                  <button onClick={async () => { await fetchUsers(); toast.success('Inscritos atualizados!'); }} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm hover:bg-white/[0.08] transition">
                    <RotateCcw size={15} />
                    <span className="hidden sm:inline">Atualizar</span>
                  </button>
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

              <div className="flex flex-wrap gap-2 mt-2">
                {([
                  { value: 'all' as const, label: 'Todos' },
                  { value: 'with' as const, label: 'Com giros' },
                  { value: 'without' as const, label: 'Sem giros' },
                  { value: 'auto_pay' as const, label: '💰 Auto Pay' },
                ]).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setSpinsFilter(opt.value); setSearchTerm(''); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      spinsFilter === opt.value
                        ? 'bg-primary/20 text-primary border border-primary/30'
                        : 'bg-white/[0.04] text-muted-foreground border border-white/[0.08] hover:bg-white/[0.08]'
                    }`}
                  >
                    {opt.label}
                    {opt.value === 'with' && ` (${users.filter(u => u.spins_available >= 1).length})`}
                    {opt.value === 'without' && ` (${users.filter(u => u.spins_available < 1).length})`}
                    {opt.value === 'auto_pay' && ` (${users.filter(u => u.auto_payment).length})`}
                  </button>
                ))}
                {spinsFilter === 'auto_pay' && users.filter(u => u.auto_payment).length > 0 && (
                  <button
                    onClick={() => setShowDisableAutoPayModal(true)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive/20 text-destructive border border-destructive/30 hover:bg-destructive/30 transition-all"
                  >
                    🚫 Desativar Todos
                  </button>
                )}
              </div>

              {/* Disable Auto Pay Confirmation Modal */}
              {showDisableAutoPayModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md" onClick={() => setShowDisableAutoPayModal(false)}>
                  <div
                    className="w-full max-w-sm mx-4 rounded-2xl border border-white/[0.1] shadow-[0_24px_80px_rgba(0,0,0,0.6)] overflow-hidden"
                    style={{ background: `linear-gradient(to bottom, var(--theme-modal-bg, #1a1a2e), color-mix(in srgb, var(--theme-modal-bg, #1a1a2e) 85%, black))` }}
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="px-6 pt-6 pb-4 border-b border-white/[0.06]">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-destructive/15 flex items-center justify-center">
                          <Ban size={18} className="text-destructive" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-foreground">Desativar Auto Pay</h3>
                          <p className="text-xs text-muted-foreground">Esta ação não pode ser desfeita</p>
                        </div>
                      </div>
                    </div>
                    <div className="px-6 py-5">
                      <p className="text-sm text-muted-foreground">
                        Desativar pagamento automático de <span className="font-bold text-foreground">{users.filter(u => u.auto_payment).length}</span> inscrito(s)?
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-2">Todos os inscritos com auto pay ativado terão essa opção desativada.</p>
                    </div>
                    <div className="flex gap-3 px-6 pb-6">
                      <button
                        onClick={() => setShowDisableAutoPayModal(false)}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm font-medium hover:bg-white/[0.08] transition"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={async () => {
                          const autoPayUsers = users.filter(u => u.auto_payment);
                          const ids = autoPayUsers.map(u => u.id);
                          const { error } = await (supabase as any)
                            .from('wheel_users')
                            .update({ auto_payment: false, updated_at: new Date().toISOString() })
                            .in('id', ids);
                          setShowDisableAutoPayModal(false);
                          if (error) { toast.error('Erro ao desativar auto pay'); return; }
                          toast.success(`Auto pay desativado para ${ids.length} inscrito(s)!`);
                          fetchUsers();
                        }}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:brightness-110 transition shadow-lg shadow-destructive/20"
                      >
                        🚫 Desativar Todos
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* User form modal */}
              {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md" onClick={() => setShowForm(false)}>
                  <div
                    className="w-full max-w-lg mx-4 rounded-2xl border border-white/[0.1] shadow-[0_24px_80px_rgba(0,0,0,0.6)] overflow-hidden"
                    style={{ background: `linear-gradient(to bottom, var(--theme-modal-bg, #1a1a2e), color-mix(in srgb, var(--theme-modal-bg, #1a1a2e) 85%, black))` }}
                    onClick={e => e.stopPropagation()}
                  >
                    {/* Header */}
                    <div className="relative px-6 pt-6 pb-4 border-b border-white/[0.06]">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--theme-modal-icon, #f59e0b) 15%, transparent)', color: 'var(--theme-modal-icon, #f59e0b)' }}>
                          {editingUser ? <Pencil size={18} /> : <Plus size={18} />}
                        </div>
                        <div>
                          <h2 className="text-lg font-bold text-white">{editingUser ? 'Editar Inscrito' : 'Novo Inscrito'}</h2>
                          <p className="text-xs text-white/40">{editingUser ? 'Atualize as informações do usuário' : 'Preencha os dados para cadastrar'}</p>
                        </div>
                      </div>
                      <button onClick={() => setShowForm(false)} className="absolute top-5 right-5 p-2 rounded-xl hover:bg-white/[0.08] text-white/40 hover:text-white transition-all">
                        <X size={18} />
                      </button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSaveUser} className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                      
                      {/* Section: Dados Pessoais */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-xs font-semibold text-white/50 uppercase tracking-widest">
                          <Users size={12} />
                          <span>Dados Pessoais</span>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                          <div>
                            <label className="block text-[11px] text-white/40 font-medium mb-1.5 uppercase tracking-wider">Nome *</label>
                            <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nome completo"
                              className="w-full px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.03] text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/50 focus:bg-white/[0.05] transition-all" />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] text-white/40 font-medium mb-1.5 uppercase tracking-wider">Email *</label>
                              <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com"
                                className="w-full px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.03] text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/50 focus:bg-white/[0.05] transition-all" />
                            </div>
                            <div>
                              <label className="block text-[11px] text-white/40 font-medium mb-1.5 uppercase tracking-wider">Celular</label>
                              <input type="text" value={form.phone} placeholder="(00) 90000-0000" onChange={e => {
                                const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                                let masked = '';
                                if (digits.length > 0) masked += '(' + digits.slice(0, 2);
                                if (digits.length >= 2) masked += ') ';
                                if (digits.length > 2) masked += digits.slice(2, 7);
                                if (digits.length > 7) masked += '-' + digits.slice(7, 11);
                                setForm({ ...form, phone: masked });
                              }} className="w-full px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.03] text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/50 focus:bg-white/[0.05] transition-all" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] text-white/40 font-medium mb-1.5 uppercase tracking-wider">Account ID *</label>
                              <input type="text" required value={form.account_id} onChange={e => setForm({ ...form, account_id: e.target.value })} placeholder="ID da conta"
                                className="w-full px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.03] text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/50 focus:bg-white/[0.05] transition-all" />
                            </div>
                            <div>
                              <label className="block text-[11px] text-white/40 font-medium mb-1.5 uppercase tracking-wider">Tipo</label>
                              <input type="text" value={form.user_type} onChange={e => setForm({ ...form, user_type: e.target.value })} placeholder="Ex: VIP, Comum"
                                className="w-full px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.03] text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/50 focus:bg-white/[0.05] transition-all" />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[11px] text-white/40 font-medium mb-1.5 uppercase tracking-wider">Responsável</label>
                            <input type="text" value={form.responsible} onChange={e => setForm({ ...form, responsible: e.target.value })} placeholder="Nome do responsável"
                              className="w-full px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.03] text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/50 focus:bg-white/[0.05] transition-all" />
                          </div>
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-white/[0.06]" />

                      {/* Section: Chave PIX */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-xs font-semibold text-white/50 uppercase tracking-widest">
                          <DollarSign size={12} />
                          <span>Chave PIX</span>
                        </div>
                        <div className="grid grid-cols-5 gap-3">
                          <div className="col-span-2">
                            <label className="block text-[11px] text-white/40 font-medium mb-1.5 uppercase tracking-wider">Tipo</label>
                            <select value={form.pix_key_type} onChange={e => setForm({ ...form, pix_key_type: e.target.value })}
                              className="w-full px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.03] text-white text-sm focus:outline-none focus:border-primary/50 focus:bg-white/[0.05] transition-all appearance-none">
                              <option value="" className="bg-[#1a1a2e]">Selecione</option>
                              <option value="CPF" className="bg-[#1a1a2e]">CPF</option>
                              <option value="Email" className="bg-[#1a1a2e]">Email</option>
                              <option value="Telefone" className="bg-[#1a1a2e]">Telefone</option>
                              <option value="Aleatória" className="bg-[#1a1a2e]">Aleatória</option>
                            </select>
                          </div>
                          <div className="col-span-3">
                            <label className="block text-[11px] text-white/40 font-medium mb-1.5 uppercase tracking-wider">Chave</label>
                            <input type="text" value={form.pix_key} onChange={e => setForm({ ...form, pix_key: e.target.value })} placeholder="Informe a chave PIX"
                              className="w-full px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.03] text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/50 focus:bg-white/[0.05] transition-all" />
                          </div>
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-white/[0.06]" />

                      {/* Section: Configurações */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-xs font-semibold text-white/50 uppercase tracking-widest">
                          <Settings size={12} />
                          <span>Configurações</span>
                        </div>

                        {/* Fixed Prize Toggle */}
                        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                <Target size={14} className="text-amber-400" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-white">Prêmio pré-definido</p>
                                <p className="text-[10px] text-white/30">Definir qual prêmio o inscrito irá ganhar</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setForm({ ...form, fixed_prize_enabled: !form.fixed_prize_enabled, fixed_prize_segment: !form.fixed_prize_enabled ? (form.fixed_prize_segment ?? 0) : form.fixed_prize_segment })}
                              className={`w-12 h-7 rounded-full relative transition-all duration-300 ${form.fixed_prize_enabled ? 'bg-amber-500 shadow-lg shadow-amber-500/30' : 'bg-white/[0.1]'}`}
                            >
                              <div className={`w-5 h-5 rounded-full bg-white shadow-md absolute top-1 transition-all duration-300 ${form.fixed_prize_enabled ? 'left-[26px]' : 'left-1'}`} />
                            </button>
                          </div>
                          {form.fixed_prize_enabled && (
                            <select
                              value={form.fixed_prize_segment ?? 0}
                              onChange={e => setForm({ ...form, fixed_prize_segment: parseInt(e.target.value) })}
                              className="w-full px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] text-white text-sm focus:outline-none focus:border-amber-500/40 transition-all appearance-none"
                            >
                              {wheelConfig.segments.map((seg, i) => (
                                <option key={seg.id} value={i} className="bg-[#1a1a2e]">{seg.title} — {seg.reward}</option>
                              ))}
                            </select>
                          )}
                        </div>

                        {/* Auto Payment Toggle */}
                        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                <Wallet size={14} className="text-emerald-400" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-white">Pagamento Automático</p>
                                <p className="text-[10px] text-white/30">Pagar automaticamente via PIX (EdPay)</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setForm({ ...form, auto_payment: !form.auto_payment })}
                              className={`w-12 h-7 rounded-full relative transition-all duration-300 ${form.auto_payment ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30' : 'bg-white/[0.1]'}`}
                            >
                              <div className={`w-5 h-5 rounded-full bg-white shadow-md absolute top-1 transition-all duration-300 ${form.auto_payment ? 'left-[26px]' : 'left-1'}`} />
                            </button>
                          </div>
                          {form.auto_payment && (
                            <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/[0.08] border border-emerald-500/20">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              <p className="text-[11px] text-emerald-300">Prêmios com valor serão pagos automaticamente via PIX</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </form>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-white/[0.06] bg-white/[0.02] flex gap-3">
                      <button type="button" onClick={() => setShowForm(false)}
                        className="flex-1 py-3 rounded-xl border border-white/[0.08] bg-transparent text-white/60 text-sm font-medium hover:bg-white/[0.06] hover:text-white transition-all">
                        Cancelar
                      </button>
                      <button type="submit" form="" disabled={savingUser} onClick={(e) => {
                        e.preventDefault();
                        const formEl = e.currentTarget.closest('.overflow-hidden')?.querySelector('form');
                        if (formEl) formEl.requestSubmit();
                      }}
                        className="flex-1 py-3 rounded-xl font-bold text-sm transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110"
                        style={{ backgroundColor: 'var(--theme-modal-btn, #f59e0b)', color: 'var(--theme-modal-btn-text, #ffffff)', boxShadow: '0 10px 25px -5px color-mix(in srgb, var(--theme-modal-btn, #f59e0b) 30%, transparent)' }}>
                        {savingUser ? (
                          <span className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            Salvando...
                          </span>
                        ) : editingUser ? '✏️ Salvar Alterações' : '✅ Criar Inscrito'}
                      </button>
                    </div>
                  </div>
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
                  <p className="text-muted-foreground">{searchTerm || spinsFilter !== 'all' ? 'Nenhum resultado encontrado' : 'Nenhum inscrito ainda'}</p>
                </GlassCard>
              ) : (
                <GlassCard className="overflow-hidden">
                  {/* Batch action bar */}
                  {selectedUserIds.size > 0 && (
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-primary/20 bg-primary/[0.05]">
                      <span className="text-xs text-primary font-semibold">{selectedUserIds.size} selecionado(s)</span>
                      <button
                        onClick={() => { setBatchGrantMode('random'); setBatchGrantSegment(0); setBatchGrantSpinCount(1); setShowBatchGrantModal(true); }}
                        className="px-3 py-1.5 rounded-lg bg-primary/20 text-primary border border-primary/30 text-xs font-semibold hover:bg-primary/30 transition"
                      >
                        🎰 Liberar Giros
                      </button>
                      <button
                        onClick={handleDeleteSelectedUsers}
                        className="px-3 py-1.5 rounded-lg bg-destructive/20 text-destructive border border-destructive/30 text-xs font-semibold hover:bg-destructive/30 transition"
                      >
                        🗑️ Excluir Selecionados
                      </button>
                      <button
                        onClick={() => setSelectedUserIds(new Set())}
                        className="px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] text-muted-foreground text-xs hover:bg-white/[0.08] transition"
                      >
                        Limpar seleção
                      </button>
                    </div>
                  )}
                  <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-sm table-fixed">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="px-2 py-3 w-8">
                          <input
                            type="checkbox"
                            checked={filteredUsers.length > 0 && filteredUsers.every(u => selectedUserIds.has(u.id))}
                            onChange={e => {
                              if (e.target.checked) {
                                setSelectedUserIds(new Set(filteredUsers.map(u => u.id)));
                              } else {
                                setSelectedUserIds(new Set());
                              }
                            }}
                            className="rounded border-white/20 bg-white/[0.05]"
                          />
                        </th>
                        <th className="text-left px-1 py-3 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider w-6">#</th>
                        <th className="text-left px-2 py-3 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Nome</th>
                        <th className="text-left px-2 py-3 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Email</th>
                        <th className="text-left px-2 py-3 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider w-[90px]">Celular</th>
                        <th className="text-left px-2 py-3 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider w-[80px]">Acc ID</th>
                        <th className="text-left px-2 py-3 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider w-[60px]">PIX</th>
                        <th className="text-left px-2 py-3 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider w-[90px]">Chave</th>
                        <th className="text-left px-2 py-3 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider w-[70px]">Data</th>
                        {spinsFilter !== 'with' && (
                          <>
                            <th className="text-left px-2 py-3 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider w-[50px]">Tipo</th>
                            <th className="text-left px-2 py-3 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider w-[70px]">Resp.</th>
                          </>
                        )}
                        {spinsFilter === 'with' && (
                          <th className="text-left px-2 py-3 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider w-[110px]">Prêmio</th>
                        )}
                        <th className="text-center px-1 py-3 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider w-[140px]">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user, index) => (
                        <tr key={user.id} className={`border-t border-white/[0.04] hover:bg-white/[0.03] transition-colors group ${selectedUserIds.has(user.id) ? 'bg-primary/[0.04]' : ''}`}>
                          <td className="px-2 py-2">
                            <input
                              type="checkbox"
                              checked={selectedUserIds.has(user.id)}
                              onChange={e => {
                                const next = new Set(selectedUserIds);
                                if (e.target.checked) next.add(user.id); else next.delete(user.id);
                                setSelectedUserIds(next);
                              }}
                              className="rounded border-white/20 bg-white/[0.05]"
                            />
                          </td>
                          <td className="px-1 py-2 text-muted-foreground text-[11px]">{index + 1}</td>
                          <td className="px-2 py-2 text-foreground font-medium text-xs truncate max-w-0">{user.name}</td>
                          <td className="px-2 py-2 text-muted-foreground text-xs truncate max-w-0">{user.email}</td>
                          <td className="px-2 py-2 text-muted-foreground text-[11px] truncate">{user.phone}</td>
                          <td className="px-2 py-2 font-mono text-[10px] text-muted-foreground truncate">{user.account_id?.slice(0, 8)}...</td>
                          <td className="px-2 py-2 text-muted-foreground text-[11px] truncate">{user.pix_key_type || '—'}</td>
                          <td className="px-2 py-2 text-muted-foreground text-[11px] truncate">{user.pix_key || '—'}</td>
                          <td className="px-2 py-2 text-muted-foreground text-[11px]">{user.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : '—'}</td>
                          {spinsFilter !== 'with' && (
                            <>
                              <td className="px-2 py-2 text-muted-foreground text-[11px] truncate">{user.user_type || '—'}</td>
                              <td className="px-2 py-2 text-muted-foreground text-[11px] truncate">{user.responsible || '—'}</td>
                            </>
                          )}
                          {spinsFilter === 'with' && (
                            <td className="px-2 py-2">
                              {user.fixed_prize_enabled && user.fixed_prize_segment != null && wheelConfig.segments[user.fixed_prize_segment] ? (
                                <span className="text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-md inline-block truncate max-w-full">
                                  🎯 {wheelConfig.segments[user.fixed_prize_segment].title}
                                </span>
                              ) : (
                                <span className="text-[10px] text-muted-foreground/60 italic">Aleatório</span>
                              )}
                            </td>
                          )}
                          <td className="px-1 py-2">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleGrantSpin(user)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${user.spins_available >= 1 ? 'bg-primary/15 text-primary border border-primary/20 hover:bg-destructive/15 hover:text-destructive hover:border-destructive/20' : 'bg-white/[0.06] text-foreground hover:bg-primary/15 hover:text-primary border border-white/[0.08]'}`}
                              >
                                {user.spins_available >= 1 ? `${user.spins_available} ✓` : 'Giro'}
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
                  </div>

                  {/* Mobile/tablet card layout */}
                  <div className="lg:hidden space-y-2">
                    <div className="flex items-center gap-2 px-1 pb-2">
                      <input
                        type="checkbox"
                        checked={filteredUsers.length > 0 && filteredUsers.every(u => selectedUserIds.has(u.id))}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedUserIds(new Set(filteredUsers.map(u => u.id)));
                          } else {
                            setSelectedUserIds(new Set());
                          }
                        }}
                        className="rounded border-white/20 bg-white/[0.05]"
                      />
                      <span className="text-xs text-muted-foreground">Selecionar todos</span>
                    </div>
                    {filteredUsers.map((user, index) => (
                      <div key={user.id} className={`p-3 rounded-xl border transition-colors ${selectedUserIds.has(user.id) ? 'bg-primary/[0.06] border-primary/20' : 'bg-white/[0.02] border-white/[0.06]'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <input
                              type="checkbox"
                              checked={selectedUserIds.has(user.id)}
                              onChange={e => {
                                const next = new Set(selectedUserIds);
                                if (e.target.checked) next.add(user.id); else next.delete(user.id);
                                setSelectedUserIds(next);
                              }}
                              className="rounded border-white/20 bg-white/[0.05] shrink-0 mt-0.5"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">#{index + 1} {user.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleGrantSpin(user)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${user.spins_available >= 1 ? 'bg-primary/15 text-primary border border-primary/20' : 'bg-white/[0.06] text-foreground border border-white/[0.08]'}`}
                            >
                              {user.spins_available >= 1 ? `${user.spins_available} ✓` : 'Giro'}
                            </button>
                            <button onClick={() => openEdit(user)} className="p-1.5 rounded-lg bg-white/[0.06] text-muted-foreground hover:text-foreground transition border border-white/[0.06]">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => handleDeleteUser(user.id)} className="p-1.5 rounded-lg bg-white/[0.06] text-muted-foreground hover:text-destructive transition border border-white/[0.06]">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-[11px]">
                          <div><span className="text-muted-foreground">Cel:</span> <span className="text-foreground">{user.phone || '—'}</span></div>
                          <div><span className="text-muted-foreground">Acc:</span> <span className="text-foreground font-mono">{user.account_id?.slice(0, 10)}...</span></div>
                          <div><span className="text-muted-foreground">PIX:</span> <span className="text-foreground">{user.pix_key_type || '—'} {user.pix_key ? `/ ${user.pix_key}` : ''}</span></div>
                          <div><span className="text-muted-foreground">Data:</span> <span className="text-foreground">{user.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : '—'}</span></div>
                          {spinsFilter !== 'with' && (
                            <>
                              <div><span className="text-muted-foreground">Tipo:</span> <span className="text-foreground">{user.user_type || '—'}</span></div>
                              <div><span className="text-muted-foreground">Resp:</span> <span className="text-foreground">{user.responsible || '—'}</span></div>
                            </>
                          )}
                          {spinsFilter === 'with' && (
                            <div className="col-span-2">
                              <span className="text-muted-foreground">Prêmio:</span>{' '}
                              {user.fixed_prize_enabled && user.fixed_prize_segment != null && wheelConfig.segments[user.fixed_prize_segment] ? (
                                <span className="text-amber-400 font-medium">🎯 {wheelConfig.segments[user.fixed_prize_segment].title}</span>
                              ) : (
                                <span className="text-muted-foreground/60 italic">Aleatório</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
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

              <div className="flex items-center justify-end gap-2">
                <button onClick={handleClearHistory} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-destructive/20 text-destructive text-sm hover:bg-destructive/10 transition">
                  <Trash2 size={14} /> Limpar Histórico
                </button>
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
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">{total} acesso(s) rastreados</p>
                <div className="flex gap-2">
                  <button onClick={handleClearAnalytics} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-destructive/20 text-destructive text-sm hover:bg-destructive/10 transition">
                    <Trash2 size={14} /> Limpar Analytics
                  </button>
                  <button onClick={() => fetchAnalytics()} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm hover:bg-white/[0.08] transition">
                    <RotateCcw size={14} /> Atualizar
                  </button>
                </div>
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
                  <div className="space-y-2">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Pesquisar por nome ou email..."
                        value={emailSearchTerm}
                        onChange={e => setEmailSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto rounded-xl border border-white/[0.08] bg-white/[0.02] p-2 space-y-0.5">
                      {users.filter(u => {
                        if (!emailSearchTerm.trim()) return true;
                        const term = emailSearchTerm.toLowerCase();
                        return u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term);
                      }).map(u => (
                        <label key={u.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.04] cursor-pointer transition">
                          <input type="checkbox" checked={selectedEmails.includes(u.email)} onChange={e => { if (e.target.checked) setSelectedEmails([...selectedEmails, u.email]); else setSelectedEmails(selectedEmails.filter(em => em !== u.email)); }} className="rounded border-white/20 bg-white/[0.05]" />
                          <span className="text-sm text-foreground">{u.name}</span>
                          <span className="text-xs text-muted-foreground ml-auto">{u.email}</span>
                        </label>
                      ))}
                      {users.filter(u => {
                        if (!emailSearchTerm.trim()) return true;
                        const term = emailSearchTerm.toLowerCase();
                        return u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term);
                      }).length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-3">Nenhum resultado encontrado</p>
                      )}
                    </div>
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
              <div className="flex items-center gap-2 justify-end">
                <button onClick={() => { setShowWhatsappHistory(!showWhatsappHistory); if (!showWhatsappHistory) fetchWhatsappLogs(); }} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm transition ${showWhatsappHistory ? 'border-primary/30 bg-primary/10 text-primary' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground hover:bg-white/[0.08]'}`}>
                  <Clock size={15} /> Histórico
                </button>
                <button onClick={() => setShowWhatsappConfig(!showWhatsappConfig)} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm transition ${showWhatsappConfig ? 'border-primary/30 bg-primary/10 text-primary' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground hover:bg-white/[0.08]'}`}>
                  <Settings size={15} /> Configurar API
                </button>
              </div>

              {showWhatsappConfig && (
                <GlassCard className="p-5 space-y-4">
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
                    <label className="text-xs text-muted-foreground">Nome da Instância</label>
                    <input type="text" value={evolutionInstance} onChange={e => { setEvolutionInstance(e.target.value); localStorage.setItem('evolution_instance', e.target.value); }} placeholder="minha-instancia" className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/40" />
                  </div>

                  <div className="border-t border-white/[0.06] pt-4 space-y-3">
                    <h4 className="text-xs font-semibold text-foreground">📱 Gerenciar Instância</h4>

                    <div className="flex gap-2 flex-wrap">
                      {/* Criar Instância */}
                      <button
                        disabled={!evolutionApiUrl || !evolutionApiKey || !evolutionInstance || creatingInstance}
                        onClick={async () => {
                          setCreatingInstance(true);
                          try {
                            const { data, error } = await supabase.functions.invoke('evolution-proxy', {
                              body: { action: 'create', evolutionApiUrl, evolutionApiKey, evolutionInstance }
                            });
                            const msg = data?.error || data?.data?.error || data?.data?.response?.message || data?.data?.message || error?.message || 'Erro ao criar instância';
                            if (error || !data?.ok) {
                              toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
                              setInstanceStatus('error');
                              return;
                            }
                            const d = data.data;
                            toast.success('Instância criada com sucesso!');
                            if (d?.qrcode?.base64) {
                              setInstanceQrCode(d.qrcode.base64);
                              setInstanceStatus('connecting');
                            } else {
                              setInstanceStatus('close');
                            }
                          } catch (err: any) {
                            toast.error(err.message || 'Erro de conexão');
                            setInstanceStatus('error');
                          } finally {
                            setCreatingInstance(false);
                          }
                        }}
                        className="flex-1 min-w-[120px] px-3 py-2.5 rounded-xl text-xs font-semibold border border-white/[0.08] bg-white/[0.04] text-foreground hover:bg-white/[0.08] disabled:opacity-40 transition flex items-center justify-center gap-1.5"
                      >
                        <Plus size={14} /> {creatingInstance ? 'Criando...' : 'Criar Instância'}
                      </button>

                      {/* Conectar / QR Code */}
                      <button
                        disabled={!evolutionApiUrl || !evolutionApiKey || !evolutionInstance || instanceStatus === 'loading'}
                        onClick={async () => {
                          setInstanceStatus('loading');
                          setInstanceQrCode(null);
                          try {
                            const { data, error } = await supabase.functions.invoke('evolution-proxy', {
                              body: { action: 'connect', evolutionApiUrl, evolutionApiKey, evolutionInstance }
                            });
                            const msg = data?.error || data?.data?.error || data?.data?.response?.message || data?.data?.message || error?.message || 'Erro ao conectar';
                            if (error || !data?.ok) {
                              toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
                              setInstanceStatus('error');
                              return;
                            }
                            const d = data.data;
                            if (d?.base64) {
                              setInstanceQrCode(d.base64);
                              setInstanceStatus('connecting');
                              toast.info('Escaneie o QR Code no WhatsApp');
                            } else if (d?.instance?.state === 'open') {
                              setInstanceStatus('open');
                              toast.success('WhatsApp já está conectado!');
                            } else {
                              setInstanceStatus('close');
                              toast.info('Instância desconectada. Tente novamente.');
                            }
                          } catch (err: any) {
                            toast.error(err.message || 'Erro de conexão');
                            setInstanceStatus('error');
                          }
                        }}
                        className="flex-1 min-w-[120px] px-3 py-2.5 rounded-xl text-xs font-semibold border border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20 disabled:opacity-40 transition flex items-center justify-center gap-1.5"
                      >
                        <Smartphone size={14} /> {instanceStatus === 'loading' ? 'Conectando...' : 'Conectar (QR Code)'}
                      </button>

                      {/* Verificar Status */}
                      <button
                        disabled={!evolutionApiUrl || !evolutionApiKey || !evolutionInstance}
                        onClick={async () => {
                          setInstanceStatus('loading');
                          try {
                            const { data, error } = await supabase.functions.invoke('evolution-proxy', {
                              body: { action: 'status', evolutionApiUrl, evolutionApiKey, evolutionInstance }
                            });
                            const msg = data?.error || data?.data?.error || data?.data?.response?.message || data?.data?.message || error?.message || 'Erro ao verificar';
                            if (error || !data?.ok) {
                              toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
                              setInstanceStatus('error');
                              return;
                            }
                            const d = data.data;
                            const state = d?.instance?.state || d?.state || 'unknown';
                            if (state === 'open') {
                              setInstanceStatus('open');
                              toast.success('Status: 🟢 Conectado');
                            } else if (state === 'connecting') {
                              setInstanceStatus('connecting');
                              toast.info('Status: 🟡 Aguardando leitura do QR Code');
                            } else {
                              setInstanceStatus('close');
                              toast.info('Status: 🔴 Desconectado');
                            }
                          } catch (err: any) {
                            toast.error(err.message || 'Erro');
                            setInstanceStatus('error');
                          }
                        }}
                        className="flex-1 min-w-[120px] px-3 py-2.5 rounded-xl text-xs font-semibold border border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground hover:bg-white/[0.08] disabled:opacity-40 transition flex items-center justify-center gap-1.5"
                      >
                        <RotateCcw size={14} /> Verificar Status
                      </button>

                      {/* Desconectar */}
                      <button
                        disabled={!evolutionApiUrl || !evolutionApiKey || !evolutionInstance}
                        onClick={async () => {
                          try {
                            const { data, error } = await supabase.functions.invoke('evolution-proxy', {
                              body: { action: 'logout', evolutionApiUrl, evolutionApiKey, evolutionInstance }
                            });
                            const msg = data?.error || data?.data?.error || data?.data?.response?.message || data?.data?.message || error?.message || 'Erro ao desconectar';
                            if (error || !data?.ok) {
                              toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
                              setInstanceStatus('error');
                              return;
                            }
                            toast.success('WhatsApp desconectado');
                            setInstanceStatus('close');
                            setInstanceQrCode(null);
                          } catch (err: any) {
                            toast.error(err.message || 'Erro');
                            setInstanceStatus('error');
                          }
                        }}
                        className="flex-1 min-w-[120px] px-3 py-2.5 rounded-xl text-xs font-semibold border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-40 transition flex items-center justify-center gap-1.5"
                      >
                        <LogOut size={14} /> Desconectar
                      </button>
                    </div>

                    {/* Status badge */}
                    <div className={`text-xs font-medium flex items-center gap-1.5 ${
                      instanceStatus === 'open' ? 'text-green-400' :
                      instanceStatus === 'connecting' ? 'text-yellow-400' :
                      instanceStatus === 'error' ? 'text-red-400' :
                      instanceStatus === 'close' ? 'text-orange-400' :
                      'text-muted-foreground'
                    }`}>
                      {instanceStatus === 'open' && '🟢 WhatsApp conectado'}
                      {instanceStatus === 'connecting' && '🟡 Aguardando leitura do QR Code...'}
                      {instanceStatus === 'close' && '🔴 Desconectado'}
                      {instanceStatus === 'error' && '❌ Erro na conexão'}
                      {instanceStatus === 'loading' && '⏳ Verificando...'}
                      {instanceStatus === 'unknown' && (evolutionApiUrl && evolutionApiKey && evolutionInstance ? '⚪ Clique em "Verificar Status"' : '⚠️ Preencha todas as credenciais')}
                    </div>

                    {/* QR Code display */}
                    {instanceQrCode && (
                      <div className="flex flex-col items-center gap-3 p-4 rounded-xl border border-white/[0.08] bg-white/[0.02]">
                        <p className="text-xs text-muted-foreground font-medium">Escaneie o QR Code com o WhatsApp</p>
                        <div className="bg-white p-3 rounded-xl">
                          <img src={instanceQrCode.startsWith('data:') ? instanceQrCode : `data:image/png;base64,${instanceQrCode}`} alt="QR Code WhatsApp" className="w-56 h-56" />
                        </div>
                        <p className="text-[10px] text-muted-foreground">Abra o WhatsApp → Menu (⋮) → Aparelhos conectados → Conectar aparelho</p>
                        <button onClick={() => { setInstanceQrCode(null); setInstanceStatus('unknown'); }} className="text-xs text-muted-foreground hover:text-foreground transition">
                          Fechar QR Code
                        </button>
                      </div>
                    )}
                  </div>
                </GlassCard>
              )}

              {showWhatsappHistory && (
                <GlassCard className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Clock size={16} className="text-primary" /> Histórico de Mensagens</h3>
                    <button onClick={fetchWhatsappLogs} className="text-xs text-muted-foreground hover:text-foreground transition flex items-center gap-1"><RotateCcw size={12} /> Atualizar</button>
                  </div>
                  {whatsappLogsLoading ? (
                    <div className="text-center py-8 text-muted-foreground text-sm animate-pulse">Carregando histórico...</div>
                  ) : whatsappLogs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">Nenhuma mensagem enviada ainda.</div>
                  ) : (
                    <div className="max-h-[400px] overflow-y-auto space-y-2 pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/[0.1] [&::-webkit-scrollbar-thumb]:rounded-full">
                      {whatsappLogs.map((log: any) => (
                        <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition">
                          <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${log.status === 'sent' ? 'bg-green-400' : 'bg-red-400'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-foreground truncate">{log.recipient_name || 'Sem nome'}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">{log.recipient_phone}</span>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">{log.message}</p>
                            {log.error_message && <p className="text-[10px] text-red-400 mt-1">Erro: {log.error_message}</p>}
                          </div>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                            {new Date(log.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} {new Date(log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </GlassCard>
              )}

              <GlassCard className="p-5 space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Users size={16} className="text-primary" /> Destinatários</h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={excludeBulkSent} onChange={e => { setExcludeBulkSent(e.target.checked); if (e.target.checked) fetchBulkSentPhones(); }} className="rounded border-white/20" />
                  <span className="text-xs text-muted-foreground">Excluir quem já recebeu disparo (24h)</span>
                  {excludeBulkSent && bulkSentPhones.size > 0 && <span className="text-xs text-yellow-400">({bulkSentPhones.size} excluídos)</span>}
                  {excludeBulkSent && bulkSentCountdown && (
                    <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20">⏱ {bulkSentCountdown}</span>
                  )}
                </label>
                <div className="flex gap-2">
                  <button onClick={() => { setWhatsappTarget('all'); setSelectedWhatsappPhones([]); }} className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${whatsappTarget === 'all' ? 'bg-primary/15 text-primary border-primary/20' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground'}`}>
                    Todos ({users.filter(u => u.phone && u.phone.replace(/\D/g, '').length >= 10 && (!excludeBulkSent || !bulkSentPhones.has(u.phone))).length})
                  </button>
                  <button onClick={() => setWhatsappTarget('selected')} className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${whatsappTarget === 'selected' ? 'bg-primary/15 text-primary border-primary/20' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground'}`}>
                    Selecionar ({selectedWhatsappPhones.length})
                  </button>
                </div>
                {whatsappTarget === 'selected' && (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        value={whatsappSearch}
                        onChange={e => setWhatsappSearch(e.target.value)}
                        placeholder="Buscar por nome ou telefone..."
                        className="w-full pl-8 pr-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground"
                      />
                    </div>
                    {(() => {
                      const filteredWhatsappUsers = users.filter(u => u.phone && u.phone.replace(/\D/g, '').length >= 10 && (!excludeBulkSent || !bulkSentPhones.has(u.phone))).filter(u => {
                        if (!whatsappSearch.trim()) return true;
                        const q = whatsappSearch.toLowerCase();
                        return u.name.toLowerCase().includes(q) || u.phone.includes(q);
                      });
                      const filteredPhones = filteredWhatsappUsers.map(u => u.phone);
                      const allFilteredSelected = filteredPhones.length > 0 && filteredPhones.every(p => selectedWhatsappPhones.includes(p));
                      return (
                        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
                          <label className="flex items-center gap-2.5 px-3 py-2.5 border-b border-white/[0.08] bg-white/[0.04] cursor-pointer hover:bg-white/[0.06] transition">
                            <input type="checkbox" checked={allFilteredSelected} onChange={e => {
                              if (e.target.checked) {
                                setSelectedWhatsappPhones(prev => [...new Set([...prev, ...filteredPhones])]);
                              } else {
                                setSelectedWhatsappPhones(prev => prev.filter(p => !filteredPhones.includes(p)));
                              }
                            }} className="rounded border-white/20" />
                            <span className="text-sm font-medium text-foreground">Selecionar todos</span>
                            <span className="text-xs text-muted-foreground ml-auto">{filteredPhones.length} contatos</span>
                          </label>
                          <div className="max-h-48 overflow-y-auto p-2 space-y-0.5">
                            {filteredWhatsappUsers.map(u => (
                              <label key={u.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.04] cursor-pointer transition">
                                <input type="checkbox" checked={selectedWhatsappPhones.includes(u.phone)} onChange={e => { if (e.target.checked) setSelectedWhatsappPhones([...selectedWhatsappPhones, u.phone]); else setSelectedWhatsappPhones(selectedWhatsappPhones.filter(p => p !== u.phone)); }} className="rounded border-white/20" />
                                <span className="text-sm text-foreground">{u.name}</span>
                                <span className="text-xs text-muted-foreground ml-auto">{u.phone}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </GlassCard>

              <GlassCard className="p-5 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><MessageCircle size={16} className="text-green-400" /> Mensagem</h3>
                <textarea value={whatsappMessage} onChange={e => setWhatsappMessage(e.target.value)} rows={4} placeholder="Digite a mensagem..." className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm resize-y focus:outline-none focus:ring-1 focus:ring-primary/40" />
                <div className="flex items-center gap-3 pt-1">
                  <label className="text-xs text-muted-foreground whitespace-nowrap">Intervalo entre envios:</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={whatsappDelaySeconds}
                    onChange={e => setWhatsappDelaySeconds(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
                    className="w-20 px-2 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] text-foreground text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                  <span className="text-xs text-muted-foreground">segundos</span>
                </div>
              </GlassCard>

              <button
                onClick={async () => {
                  if (!evolutionApiUrl || !evolutionApiKey || !evolutionInstance) { toast.error('Configure as credenciais da Evolution API'); setShowWhatsappConfig(true); return; }
                  const usersWithPhone = users.filter(u => u.phone && u.phone.replace(/\D/g, '').length >= 10 && (!excludeBulkSent || !bulkSentPhones.has(u.phone)));
                  const phones = whatsappTarget === 'all' ? usersWithPhone.map(u => u.phone) : selectedWhatsappPhones.filter(p => !excludeBulkSent || !bulkSentPhones.has(p));
                  if (phones.length === 0) { toast.error('Nenhum destinatário'); return; }
                  if (!whatsappMessage.trim()) { toast.error('Digite a mensagem'); return; }
                  setWhatsappSending(true);
                  let sent = 0, errors = 0;
                  const allUsers = users.filter(u => u.phone && u.phone.replace(/\D/g, '').length >= 10);
                  for (let i = 0; i < phones.length; i++) {
                    const phone = phones[i];
                    const matchedUser = allUsers.find(u => u.phone === phone);
                    try {
                      const { data: respData, error } = await supabase.functions.invoke('send-whatsapp', { body: { recipientPhone: phone, message: whatsappMessage, evolutionApiUrl, evolutionApiKey, evolutionInstance } });
                      const hasError = !!error || !!respData?.error;
                      const errorMsg = error?.message || respData?.error || null;
                      await (supabase as any).from('whatsapp_message_log').insert({
                        owner_id: session.user.id,
                        recipient_phone: phone,
                        recipient_name: matchedUser?.name || '',
                        message: whatsappMessage,
                        status: hasError ? 'error' : 'sent',
                        error_message: errorMsg,
                      });
                      if (hasError) errors++; else sent++;
                    } catch (e: any) {
                      errors++;
                      await (supabase as any).from('whatsapp_message_log').insert({
                        owner_id: session.user.id,
                        recipient_phone: phone,
                        recipient_name: matchedUser?.name || '',
                        message: whatsappMessage,
                        status: 'error',
                        error_message: e?.message || 'Erro desconhecido',
                      });
                    }
                    // Delay between sends to avoid rate limiting/timeouts
                    if (i < phones.length - 1) {
                      await new Promise(resolve => setTimeout(resolve, whatsappDelaySeconds * 1000));
                    }
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


          {/* ══════ FINANCEIRO TAB ══════ */}
          {activeTab === 'financeiro' && (
            <div className="max-w-2xl space-y-5">
              {/* Sub-tabs */}
              <div className="flex gap-2">
                {[
                  { key: 'credenciais' as const, label: '🔑 Credenciais' },
                  { key: 'saldo' as const, label: '💲 Saldo' },
                  { key: 'deposito' as const, label: '💰 Depósito PIX' },
                  { key: 'crypto' as const, label: '🪙 Depósito USDT' },
                  { key: 'withdraw' as const, label: '📤 Saque USDT' },
                  { key: 'aprovacoes' as const, label: '✅ Aprovações' },
                  { key: 'historico' as const, label: '📜 Histórico' },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => { setFinanceiroSubTab(tab.key); if (tab.key === 'aprovacoes') fetchPrizePayments(); if (tab.key === 'historico') fetchPaidHistory(); }}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                      financeiroSubTab === tab.key
                        ? 'bg-primary/15 text-primary border border-primary/20'
                        : 'bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08] border border-transparent'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Credenciais Sub-tab */}
              {financeiroSubTab === 'credenciais' && (
                <>
                <GlassCard className="p-5 space-y-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                      <Wallet size={20} className="text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">EdPay — Gateway de Pagamento</h3>
                      <p className="text-xs text-muted-foreground">Configure suas credenciais para processar pagamentos via PIX</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Chave Pública</label>
                      <input
                        type="text"
                        value={edpayPublicKey}
                        onChange={e => setEdpayPublicKey(e.target.value)}
                        placeholder="pk_live_..."
                        className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Chave Secreta</label>
                      <div className="relative">
                        <input
                          type={showEdpaySecret ? 'text' : 'password'}
                          value={edpaySecretKey}
                          onChange={e => setEdpaySecretKey(e.target.value)}
                          placeholder="sk_live_..."
                          className="w-full px-4 py-2.5 pr-12 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowEdpaySecret(!showEdpaySecret)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Eye size={16} />
                        </button>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">⚠️ A chave secreta é salva de forma segura junto com a configuração da sua roleta.</p>
                    </div>
                  </div>

                  {edpayPublicKey && edpaySecretKey && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-xs font-medium text-emerald-400">Credenciais configuradas</span>
                    </div>
                  )}

                  {(!edpayPublicKey || !edpaySecretKey) && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <div className="w-2 h-2 rounded-full bg-amber-400" />
                      <span className="text-xs font-medium text-amber-400">Preencha ambas as chaves para ativar os pagamentos</span>
                    </div>
                  )}
                </GlassCard>

                {/* Notificação WhatsApp de Pagamento Automático */}
                <GlassCard className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                        <MessageCircle size={20} className="text-green-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-foreground">Notificação de Pagamentos</h3>
                        <p className="text-xs text-muted-foreground">Receba no WhatsApp quando qualquer prêmio for pago (automático ou manual)</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNotifyAutoPaymentEnabled(!notifyAutoPaymentEnabled)}
                      className={`w-12 h-7 rounded-full relative transition-all duration-300 ${notifyAutoPaymentEnabled ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30' : 'bg-white/[0.1]'}`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow-md absolute top-1 transition-all duration-300 ${notifyAutoPaymentEnabled ? 'left-[26px]' : 'left-1'}`} />
                    </button>
                  </div>

                  {notifyAutoPaymentEnabled && (
                    <div className="space-y-3 pt-2 border-t border-white/[0.06]">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Seu número WhatsApp (para receber notificações)</label>
                        <input type="text" value={notifyWhatsappPhone} onChange={e => setNotifyWhatsappPhone(e.target.value)} placeholder="5511999999999" className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">URL da API Evolution (Notificações)</label>
                        <input type="text" value={notifyEvolutionApiUrl} onChange={e => setNotifyEvolutionApiUrl(e.target.value)} placeholder="https://sua-api.com" className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">API Key (Notificações)</label>
                        <div className="relative">
                          <input type={showNotifySecret ? 'text' : 'password'} value={notifyEvolutionApiKey} onChange={e => setNotifyEvolutionApiKey(e.target.value)} placeholder="sua-api-key" className="w-full px-4 py-2.5 pr-12 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
                          <button type="button" onClick={() => setShowNotifySecret(!showNotifySecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"><Eye size={16} /></button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Nome da Instância (Notificações)</label>
                        <input type="text" value={notifyEvolutionInstance} onChange={e => setNotifyEvolutionInstance(e.target.value)} placeholder="minha-instancia-notif" className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
                      </div>

                      {notifyEvolutionApiUrl && notifyEvolutionApiKey && notifyEvolutionInstance && notifyWhatsappPhone ? (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-xs font-medium text-emerald-400">Notificações de pagamento ativas</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                          <div className="w-2 h-2 rounded-full bg-amber-400" />
                          <span className="text-xs font-medium text-amber-400">Preencha todos os campos para ativar as notificações</span>
                        </div>
                      )}
                    </div>
                  )}
                </GlassCard>
              </>
              )}

              {/* Saldo Sub-tab */}
              {financeiroSubTab === 'saldo' && (
                <GlassCard className="p-5 space-y-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                      <DollarSign size={20} className="text-green-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Saldo EdPay</h3>
                      <p className="text-xs text-muted-foreground">Consulte seu saldo disponível</p>
                    </div>
                  </div>

                  {(!edpayPublicKey || !edpaySecretKey) ? (
                    <div className="text-center py-8 space-y-2">
                      <DollarSign size={32} className="mx-auto text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">Configure suas credenciais primeiro</p>
                      <button onClick={() => setFinanceiroSubTab('credenciais')} className="mt-2 px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:brightness-110 transition-all">
                        Ir para Credenciais
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {edpayBalance !== null && (
                        <div className="p-6 rounded-2xl bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/20 text-center">
                          <p className="text-xs text-muted-foreground mb-1">Saldo Disponível</p>
                          <p className="text-3xl font-bold text-green-400">
                            R$ {edpayBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      )}
                      <button
                        onClick={async () => {
                          setEdpayBalanceLoading(true);
                          try {
                            const { data, error } = await supabase.functions.invoke('edpay-balance', {
                              body: { edpayPublicKey, edpaySecretKey },
                            });
                            if (error || !data?.success) {
                              toast.error(data?.error || 'Erro ao consultar saldo');
                            } else {
                              const bd = data.data;
                              console.log('EdPay balance raw:', JSON.stringify(bd));
                              const bal = bd?.availableBalance ?? bd?.balance ?? bd?.available_balance ?? bd?.saldo ?? bd?.amount ?? (typeof bd === 'number' ? bd : 0);
                              setEdpayBalance(Number(bal) || 0);
                              toast.success('Saldo atualizado!');
                            }
                          } catch (e: any) {
                            toast.error('Erro ao consultar saldo');
                          } finally {
                            setEdpayBalanceLoading(false);
                          }
                        }}
                        disabled={edpayBalanceLoading}
                        className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                      >
                        {edpayBalanceLoading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Consultando...</> : <><DollarSign size={16} /> Consultar Saldo</>}
                      </button>
                    </div>
                  )}
                </GlassCard>
              )}

              {financeiroSubTab === 'deposito' && (
                <>
                  {(!edpayPublicKey || !edpaySecretKey) ? (
                    <GlassCard className="p-5">
                      <div className="flex flex-col items-center gap-3 py-6 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                          <Wallet size={28} className="text-amber-400" />
                        </div>
                        <h3 className="text-sm font-bold text-foreground">Credenciais não configuradas</h3>
                        <p className="text-xs text-muted-foreground max-w-sm">Configure suas chaves da EdPay na aba "Credenciais" antes de gerar depósitos.</p>
                        <button
                          onClick={() => setFinanceiroSubTab('credenciais')}
                          className="mt-2 px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:brightness-110 transition-all"
                        >
                          Ir para Credenciais
                        </button>
                      </div>
                    </GlassCard>
                  ) : (
                    <GlassCard className="p-5 space-y-5">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                          <span className="text-xl">💰</span>
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-foreground">Gerar QR Code PIX</h3>
                          <p className="text-xs text-muted-foreground">Crie um QR Code para receber pagamentos via PIX</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Valor (R$)</label>
                          <input
                            type="number"
                            min="1"
                            step="0.01"
                            value={depositAmount}
                            onChange={e => setDepositAmount(e.target.value)}
                            placeholder="0,00"
                            className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Descrição (opcional)</label>
                          <input
                            type="text"
                            value={depositDescription}
                            onChange={e => setDepositDescription(e.target.value)}
                            placeholder="Ex: Depósito para roleta"
                            className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                          />
                        </div>

                        <button
                          onClick={async () => {
                            if (!depositAmount || Number(depositAmount) < 1) {
                              toast.error('Valor mínimo: R$ 1,00');
                              return;
                            }
                            setDepositLoading(true);
                            setDepositQrData(null);
                            try {
                              const { data, error } = await supabase.functions.invoke('edpay-generate-qrcode', {
                                body: {
                                  amount: Number(depositAmount),
                                  edpayPublicKey,
                                  edpaySecretKey,
                                  description: depositDescription || 'Depósito via Roleta',
                                },
                              });
                              if (error) throw error;
                              if (data?.error) {
                                toast.error(data.error);
                              } else {
                                setDepositQrData(data?.data || data);
                                toast.success('QR Code gerado com sucesso!');
                              }
                            } catch (err: any) {
                              toast.error(err?.message || 'Erro ao gerar QR Code');
                            } finally {
                              setDepositLoading(false);
                            }
                          }}
                          disabled={depositLoading || !depositAmount}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:brightness-110 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {depositLoading ? (
                            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Gerando...</>
                          ) : (
                            '🔲 Gerar QR Code PIX'
                          )}
                        </button>
                      </div>

                      {/* QR Code Result */}
                      {depositQrData && (
                        <div className="mt-4 p-4 rounded-xl bg-white/[0.06] border border-white/[0.08] space-y-4">
                          <h4 className="text-sm font-bold text-foreground text-center">QR Code gerado!</h4>

                          {depositQrData.id && (
                            <p className="text-xs text-muted-foreground text-center">ID da transação: <span className="text-foreground font-mono">{depositQrData.id}</span></p>
                          )}

                          {(depositQrData.qrcode || depositQrData.copiacola) && (
                            <div className="flex justify-center">
                              <div className="bg-white p-3 rounded-xl">
                                <QRCodeSVG
                                  value={depositQrData.copiacola || depositQrData.qrcode}
                                  size={192}
                                  level="M"
                                />
                              </div>
                            </div>
                          )}

                          {depositQrData.copiacola && (
                            <div>
                              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Código PIX (Copia e Cola)</label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  readOnly
                                  value={depositQrData.copiacola}
                                  className="flex-1 px-3 py-2 rounded-xl text-xs bg-white/[0.06] border border-white/[0.08] text-foreground"
                                />
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(depositQrData.copiacola);
                                    toast.success('Código copiado!');
                                  }}
                                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-primary/15 text-primary hover:bg-primary/25 transition-all"
                                >
                                  <Copy size={14} />
                                </button>
                              </div>
                            </div>
                          )}

                          <details className="text-[10px] text-muted-foreground">
                            <summary className="cursor-pointer hover:text-foreground transition-colors">Ver resposta completa</summary>
                            <pre className="mt-2 p-2 rounded-lg bg-black/20 overflow-auto max-h-40 text-[10px]">
                              {JSON.stringify(depositQrData, null, 2)}
                            </pre>
                          </details>
                        </div>
                      )}
                    </GlassCard>
                  )}
                </>
              )}

              {/* Crypto USDT Sub-tab */}
              {financeiroSubTab === 'crypto' && (
                <GlassCard className="p-5 space-y-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center text-lg">🪙</div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Depósito USDT (TRC20)</h3>
                      <p className="text-xs text-muted-foreground">Receba pagamentos em USDT via rede TRON</p>
                    </div>
                  </div>

                  {(!edpayPublicKey || !edpaySecretKey) ? (
                    <div className="text-center py-8 space-y-2">
                      <p className="text-sm text-muted-foreground">Configure suas credenciais primeiro</p>
                      <button onClick={() => setFinanceiroSubTab('credenciais')} className="mt-2 px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:brightness-110 transition-all">
                        Ir para Credenciais
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Valor (USD)</label>
                        <input type="number" min="1" step="0.01" value={cryptoAmount} onChange={e => setCryptoAmount(e.target.value)} placeholder="100.00" className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Descrição (opcional)</label>
                        <input type="text" value={cryptoDescription} onChange={e => setCryptoDescription(e.target.value)} placeholder="Recarga de conta" className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
                      </div>
                      <button
                        onClick={async () => {
                          if (!cryptoAmount || Number(cryptoAmount) <= 0) { toast.error('Informe um valor válido'); return; }
                          setCryptoLoading(true);
                          setCryptoData(null);
                          try {
                            const { data, error } = await supabase.functions.invoke('edpay-crypto-deposit', {
                              body: { amount: Number(cryptoAmount), edpayPublicKey, edpaySecretKey, description: cryptoDescription || undefined },
                            });
                            if (error || !data?.success) {
                              toast.error(data?.error || 'Erro ao gerar depósito crypto');
                            } else {
                              setCryptoData(data.data);
                              toast.success('Endereço USDT gerado!');
                            }
                          } catch (e: any) {
                            toast.error('Erro ao gerar depósito crypto');
                          } finally {
                            setCryptoLoading(false);
                          }
                        }}
                        disabled={cryptoLoading}
                        className="w-full py-3 rounded-xl bg-yellow-600 hover:bg-yellow-500 text-white font-bold text-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                      >
                        {cryptoLoading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Gerando...</> : '🪙 Gerar Depósito USDT'}
                      </button>

                      {cryptoData && (
                        <div className="mt-4 p-4 rounded-xl bg-white/[0.06] border border-white/[0.08] space-y-4">
                          <h4 className="text-sm font-bold text-foreground text-center">Depósito USDT gerado!</h4>

                          {cryptoData.id && (
                            <p className="text-xs text-muted-foreground text-center">ID: <span className="text-foreground font-mono">{cryptoData.id}</span></p>
                          )}

                          {cryptoData.qr_code && (
                            <div className="flex justify-center">
                              <img src={cryptoData.qr_code} alt="QR Code USDT" className="w-48 h-48 rounded-xl bg-white p-2" />
                            </div>
                          )}

                          {cryptoData.address && (
                            <div>
                              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Endereço TRC20</label>
                              <div className="flex gap-2">
                                <input type="text" readOnly value={cryptoData.address} className="flex-1 px-3 py-2 rounded-xl text-xs bg-white/[0.06] border border-white/[0.08] text-foreground font-mono" />
                                <button onClick={() => { navigator.clipboard.writeText(cryptoData.address); toast.success('Endereço copiado!'); }} className="px-3 py-2 rounded-xl text-xs font-semibold bg-primary/15 text-primary hover:bg-primary/25 transition-all">
                                  <Copy size={14} />
                                </button>
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-3 text-xs">
                            {cryptoData.pay_amount && (
                              <div className="p-2 rounded-lg bg-white/[0.04]">
                                <span className="text-muted-foreground">Valor USDT:</span>
                                <span className="ml-1 text-foreground font-semibold">{cryptoData.pay_amount}</span>
                              </div>
                            )}
                            {cryptoData.network && (
                              <div className="p-2 rounded-lg bg-white/[0.04]">
                                <span className="text-muted-foreground">Rede:</span>
                                <span className="ml-1 text-foreground font-semibold">{cryptoData.network}</span>
                              </div>
                            )}
                            {cryptoData.rate && (
                              <div className="p-2 rounded-lg bg-white/[0.04]">
                                <span className="text-muted-foreground">Taxa:</span>
                                <span className="ml-1 text-foreground font-semibold">{cryptoData.rate}</span>
                              </div>
                            )}
                            {cryptoData.expired_at && (
                              <div className="p-2 rounded-lg bg-white/[0.04]">
                                <span className="text-muted-foreground">Expira:</span>
                                <span className="ml-1 text-foreground font-semibold">{new Date(cryptoData.expired_at * 1000).toLocaleString('pt-BR')}</span>
                              </div>
                            )}
                          </div>

                          <details className="text-[10px] text-muted-foreground">
                            <summary className="cursor-pointer hover:text-foreground transition-colors">Ver resposta completa</summary>
                            <pre className="mt-2 p-2 rounded-lg bg-black/20 overflow-auto max-h-40 text-[10px]">{JSON.stringify(cryptoData, null, 2)}</pre>
                          </details>
                        </div>
                      )}
                    </div>
                  )}
                </GlassCard>
              )}

              {/* Saque USDT Sub-tab */}
              {financeiroSubTab === 'withdraw' && (
                <GlassCard className="p-5 space-y-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-lg">📤</div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Saque USDT (TRC20)</h3>
                      <p className="text-xs text-muted-foreground">Envie USDT para qualquer carteira TRC20</p>
                    </div>
                  </div>

                  {(!edpayPublicKey || !edpaySecretKey) ? (
                    <div className="text-center py-8 space-y-2">
                      <p className="text-sm text-muted-foreground">Configure suas credenciais primeiro</p>
                      <button onClick={() => setFinanceiroSubTab('credenciais')} className="mt-2 px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:brightness-110 transition-all">
                        Ir para Credenciais
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Valor (USDT)</label>
                        <input type="number" min="1" step="0.01" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} placeholder="50.00" className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Endereço TRC20</label>
                        <input type="text" value={withdrawAddress} onChange={e => setWithdrawAddress(e.target.value)} placeholder="TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS" className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/40" />
                        <p className="text-[10px] text-muted-foreground mt-1">Deve começar com "T" e ter 34 caracteres</p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Descrição (opcional)</label>
                        <input type="text" value={withdrawDescription} onChange={e => setWithdrawDescription(e.target.value)} placeholder="Saque para carteira pessoal" className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
                      </div>

                      <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/10 text-xs text-red-300">
                        ⚠️ Atenção: Transações crypto são irreversíveis. Verifique o endereço com cuidado.
                      </div>

                      <button
                        onClick={async () => {
                          if (!withdrawAmount || Number(withdrawAmount) <= 0) { toast.error('Informe um valor válido'); return; }
                          if (!withdrawAddress || !withdrawAddress.startsWith('T') || withdrawAddress.length !== 34) { toast.error('Endereço TRC20 inválido'); return; }
                          setWithdrawLoading(true);
                          setWithdrawData(null);
                          try {
                            const { data, error } = await supabase.functions.invoke('edpay-crypto-withdraw', {
                              body: { amount: Number(withdrawAmount), address: withdrawAddress, edpayPublicKey, edpaySecretKey, description: withdrawDescription || undefined },
                            });
                            if (error || !data?.success) {
                              toast.error(data?.error || 'Erro ao processar saque');
                            } else {
                              setWithdrawData(data.data);
                              toast.success('Saque enviado para processamento!');
                            }
                          } catch (e: any) {
                            toast.error('Erro ao processar saque');
                          } finally {
                            setWithdrawLoading(false);
                          }
                        }}
                        disabled={withdrawLoading}
                        className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                      >
                        {withdrawLoading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Processando...</> : '📤 Enviar Saque USDT'}
                      </button>

                      {withdrawData && (
                        <div className="mt-4 p-4 rounded-xl bg-white/[0.06] border border-white/[0.08] space-y-3">
                          <h4 className="text-sm font-bold text-foreground text-center">Saque enviado!</h4>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            {withdrawData.id && (
                              <div className="p-2 rounded-lg bg-white/[0.04] col-span-2">
                                <span className="text-muted-foreground">ID:</span>
                                <span className="ml-1 text-foreground font-mono font-semibold">{withdrawData.id}</span>
                              </div>
                            )}
                            {withdrawData.status && (
                              <div className="p-2 rounded-lg bg-white/[0.04]">
                                <span className="text-muted-foreground">Status:</span>
                                <span className="ml-1 text-yellow-400 font-semibold">{withdrawData.status}</span>
                              </div>
                            )}
                            {withdrawData.amount != null && (
                              <div className="p-2 rounded-lg bg-white/[0.04]">
                                <span className="text-muted-foreground">Valor:</span>
                                <span className="ml-1 text-foreground font-semibold">{withdrawData.amount} USDT</span>
                              </div>
                            )}
                            {withdrawData.fee != null && (
                              <div className="p-2 rounded-lg bg-white/[0.04]">
                                <span className="text-muted-foreground">Taxa:</span>
                                <span className="ml-1 text-foreground font-semibold">{withdrawData.fee} USDT</span>
                              </div>
                            )}
                            {withdrawData.total != null && (
                              <div className="p-2 rounded-lg bg-white/[0.04]">
                                <span className="text-muted-foreground">Total:</span>
                                <span className="ml-1 text-foreground font-semibold">{withdrawData.total} USDT</span>
                              </div>
                            )}
                            {withdrawData.network && (
                              <div className="p-2 rounded-lg bg-white/[0.04] col-span-2">
                                <span className="text-muted-foreground">Rede:</span>
                                <span className="ml-1 text-foreground font-semibold">{withdrawData.network}</span>
                              </div>
                            )}
                          </div>
                          <details className="text-[10px] text-muted-foreground">
                            <summary className="cursor-pointer hover:text-foreground transition-colors">Ver resposta completa</summary>
                            <pre className="mt-2 p-2 rounded-lg bg-black/20 overflow-auto max-h-40 text-[10px]">{JSON.stringify(withdrawData, null, 2)}</pre>
                          </details>
                        </div>
                      )}
                    </div>
                  )}
                </GlassCard>
              )}

              {/* Aprovações Sub-tab */}
              {financeiroSubTab === 'aprovacoes' && (
                <GlassCard className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
                        <Trophy size={20} className="text-amber-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-foreground">Aprovações de Prêmios</h3>
                        <p className="text-xs text-muted-foreground">Gerencie os pagamentos de prêmios ganhos</p>
                      </div>
                    </div>
                    <button
                      onClick={fetchPrizePayments}
                      className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-muted-foreground hover:text-foreground transition-all"
                    >
                      <RotateCcw size={16} />
                    </button>
                  </div>

                  {prizePaymentsLoading ? (
                    <div className="text-center py-8">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">Carregando...</p>
                    </div>
                  ) : prizePayments.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">Nenhum prêmio pendente de aprovação</p>
                      <p className="text-xs text-muted-foreground mt-1">Os prêmios aparecerão aqui quando os inscritos ganharem na roleta</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
                      {prizePayments.map((p: any) => {
                        const statusColors: Record<string, string> = {
                          pending: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
                          auto_pending: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
                          approved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
                          paid: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
                          rejected: 'bg-red-500/15 text-red-400 border-red-500/20',
                          failed: 'bg-red-500/15 text-red-400 border-red-500/20',
                        };
                        const statusLabels: Record<string, string> = {
                          pending: '⏳ Pendente',
                          auto_pending: '🤖 Auto (Pendente)',
                          approved: '✅ Aprovado',
                          paid: '💰 Pago',
                          rejected: '❌ Rejeitado',
                          failed: '⚠️ Falhou',
                        };
                        return (
                          <div key={p.id} className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] space-y-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-semibold text-foreground">{p.user_name}</p>
                                <p className="text-[10px] text-muted-foreground">{p.user_email} • {p.account_id}</p>
                              </div>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusColors[p.status] || 'bg-white/10 text-muted-foreground border-white/10'}`}>
                                {statusLabels[p.status] || p.status}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">🎁 {p.prize}</span>
                              <span className="font-bold text-foreground">R$ {Number(p.amount).toFixed(2)}</span>
                            </div>
                            {p.pix_key && (
                              <p className="text-[10px] text-muted-foreground">PIX: {p.pix_key} ({p.pix_key_type})</p>
                            )}
                            <p className="text-[10px] text-muted-foreground">{new Date(p.created_at).toLocaleString('pt-BR')}</p>

                            {/* Actions */}
                            {(p.status === 'pending' || p.status === 'auto_pending') && (
                              <div className="flex gap-2 pt-1">
                                <button
                                  onClick={() => handlePayPrize(p.id)}
                                  disabled={payingPaymentId === p.id || !edpayPublicKey || !edpaySecretKey}
                                  className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-all disabled:opacity-50"
                                >
                                  {payingPaymentId === p.id ? (
                                    <div className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                                  ) : '💸'} Pagar via PIX
                                </button>
                                <button
                                  onClick={() => handleApprovePrize(p.id)}
                                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-primary/15 text-primary hover:bg-primary/25 transition-all"
                                >
                                  ✅
                                </button>
                                <button
                                  onClick={() => handleRejectPrize(p.id)}
                                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-all"
                                >
                                  ❌
                                </button>
                              </div>
                            )}
                            {p.status === 'approved' && (
                              <button
                                onClick={() => handlePayPrize(p.id)}
                                disabled={payingPaymentId === p.id || !edpayPublicKey || !edpaySecretKey}
                                className="w-full flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-all disabled:opacity-50"
                              >
                                {payingPaymentId === p.id ? (
                                  <div className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                                ) : '💸'} Pagar via PIX
                              </button>
                            )}
                            {p.edpay_transaction_id && (
                              <p className="text-[10px] text-muted-foreground">TX: {p.edpay_transaction_id}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </GlassCard>
              )}

              {/* Histórico de prêmios pagos / rejeitados */}
              {financeiroSubTab === 'historico' && (
                <GlassCard className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-base font-bold text-foreground">📜 Histórico de Pagamentos</h3>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Prêmios pagos e rejeitados</p>
                    </div>
                    <button
                      onClick={fetchPaidHistory}
                      className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-muted-foreground hover:text-foreground transition-all"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>

                  {paidHistoryLoading ? (
                    <div className="text-center py-8">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">Carregando...</p>
                    </div>
                  ) : paidHistory.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">Nenhum pagamento no histórico</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
                      {paidHistory.map((p: any) => {
                        const isPaid = p.status === 'paid';
                        return (
                          <div key={p.id} className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-semibold text-foreground">{p.user_name}</p>
                                <p className="text-[10px] text-muted-foreground">{p.user_email} • {p.account_id}</p>
                              </div>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${isPaid ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20' : 'bg-red-500/15 text-red-400 border-red-500/20'}`}>
                                {isPaid ? '💰 Pago' : '❌ Rejeitado'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">🎁 {p.prize}</span>
                              <span className="font-bold text-foreground">R$ {Number(p.amount).toFixed(2)}</span>
                            </div>
                            {p.pix_key && (
                              <p className="text-[10px] text-muted-foreground">PIX: {p.pix_key} ({p.pix_key_type})</p>
                            )}
                            {p.paid_at && (
                              <p className="text-[10px] text-muted-foreground">Pago em: {new Date(p.paid_at).toLocaleString('pt-BR')}</p>
                            )}
                            {p.edpay_transaction_id && (
                              <p className="text-[10px] text-muted-foreground">TX: {p.edpay_transaction_id}</p>
                            )}
                            <p className="text-[10px] text-muted-foreground">Criado: {new Date(p.created_at).toLocaleString('pt-BR')}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </GlassCard>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Grant Spin Modal */}
      {grantSpinUser && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setGrantSpinUser(null)}>
          <div className="w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#1a1a2e] p-6 shadow-2xl [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-white/[0.04] [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/[0.15] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:bg-white/[0.25]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-foreground">Liberar Giro — {grantSpinUser.name}</h3>
              <button onClick={() => setGrantSpinUser(null)} className="p-1 rounded-lg hover:bg-white/10 text-muted-foreground"><X size={18} /></button>
            </div>

            <p className="text-sm text-muted-foreground mb-4">Escolha como o prêmio será definido para este giro:</p>

            {/* Spin count */}
            <div className="mb-4">
              <label className="text-xs text-muted-foreground mb-1.5 block">Quantidade de giros</label>
              <input
                type="number"
                min={1}
                max={999}
                value={grantSpinCount}
                onChange={e => setGrantSpinCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.1] text-foreground text-sm focus:outline-none focus:border-primary/50 transition"
              />
            </div>

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

            {/* WhatsApp notification */}
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 mb-5">
              <label className="flex items-center gap-2.5 cursor-pointer mb-3">
                <input type="checkbox" checked={spinWhatsappEnabled} onChange={e => setSpinWhatsappEnabled(e.target.checked)} className="rounded border-white/20" />
                <MessageCircle size={16} className="text-green-400" />
                <span className="text-sm font-medium text-foreground">Enviar WhatsApp ao liberar giro</span>
              </label>
              {spinWhatsappEnabled && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-1.5">
                    {WHATSAPP_SPIN_TEMPLATES.map(tpl => (
                      <button key={tpl.id} onClick={() => setSpinWhatsappTemplate(tpl.id)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${spinWhatsappTemplate === tpl.id ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-white/[0.02] text-muted-foreground border-white/[0.06] hover:bg-white/[0.06]'}`}>
                        {tpl.label}
                      </button>
                    ))}
                  </div>
                  {spinWhatsappTemplate === 'custom' ? (
                    <textarea value={spinWhatsappCustomMsg} onChange={e => setSpinWhatsappCustomMsg(e.target.value)} rows={3} placeholder="Use {nome}, {giros}, {link} como variáveis..." className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-xs resize-y focus:outline-none focus:ring-1 focus:ring-green-500/40 placeholder:text-muted-foreground" />
                  ) : (
                    <div className="rounded-lg bg-white/[0.04] p-3 border border-white/[0.06]">
                      <p className="text-[11px] text-muted-foreground mb-1">Pré-visualização:</p>
                      <p className="text-xs text-foreground">
                        {(WHATSAPP_SPIN_TEMPLATES.find(t => t.id === spinWhatsappTemplate)?.message || '')
                          .replace(/\{nome\}/g, grantSpinUser?.name || 'Nome')
                          .replace(/\{giros\}/g, String(grantSpinCount))
                          .replace(/\{link\}/g, `${window.location.origin}/${slug}`)}
                      </p>
                    </div>
                  )}
                  {!evolutionApiUrl && <p className="text-[10px] text-amber-400">⚠️ Configure a Evolution API na aba WhatsApp primeiro</p>}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setGrantSpinUser(null)} className="flex-1 py-3 rounded-xl text-sm font-semibold bg-white/[0.06] text-muted-foreground hover:bg-white/[0.1] transition-all border border-white/[0.08]">
                Cancelar
              </button>
              <button onClick={confirmGrantSpin} className="flex-1 py-3 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:brightness-110 transition-all shadow-lg shadow-primary/20">
                {spinWhatsappEnabled ? '📱 Liberar + WhatsApp' : 'Liberar Giro'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Grant Spin Modal */}
      {showBatchGrantModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowBatchGrantModal(false)}>
          <div className="w-full max-w-md mx-4 rounded-2xl border border-white/[0.08] bg-[#1a1a2e] p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-foreground">Liberar Giros em Lote — {selectedUserIds.size} inscrito(s)</h3>
              <button onClick={() => setShowBatchGrantModal(false)} className="p-1 rounded-lg hover:bg-white/10 text-muted-foreground"><X size={18} /></button>
            </div>

            <p className="text-sm text-muted-foreground mb-4">Escolha como o prêmio será definido para todos os selecionados:</p>

            {/* Spin count */}
            <div className="mb-4">
              <label className="text-xs text-muted-foreground mb-1.5 block">Quantidade de giros por inscrito</label>
              <input
                type="number"
                min={1}
                max={999}
                value={batchGrantSpinCount}
                onChange={e => setBatchGrantSpinCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.1] text-foreground text-sm focus:outline-none focus:border-primary/50 transition"
              />
            </div>

            <div className="flex gap-2 mb-5">
              <button
                onClick={() => setBatchGrantMode('random')}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all border ${batchGrantMode === 'random' ? 'bg-primary/20 text-primary border-primary/30' : 'bg-white/[0.04] text-muted-foreground border-white/[0.08] hover:bg-white/[0.08]'}`}
              >
                🎲 Aleatório (%)
              </button>
              <button
                onClick={() => setBatchGrantMode('fixed')}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all border ${batchGrantMode === 'fixed' ? 'bg-primary/20 text-primary border-primary/30' : 'bg-white/[0.04] text-muted-foreground border-white/[0.08] hover:bg-white/[0.08]'}`}
              >
                🎯 Pré-definir
              </button>
            </div>

            {batchGrantMode === 'random' ? (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 mb-5">
                <p className="text-xs text-muted-foreground mb-3">O prêmio será sorteado automaticamente baseado nas probabilidades:</p>
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
                <label className="text-xs text-muted-foreground mb-2 block">Selecione o prêmio garantido para todos:</label>
                <div className="space-y-1.5">
                  {wheelConfig.segments.map((seg, i) => (
                    <button
                      key={i}
                      onClick={() => setBatchGrantSegment(i)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all border ${batchGrantSegment === i ? 'bg-primary/15 border-primary/30 text-primary' : 'bg-white/[0.02] border-white/[0.06] text-foreground hover:bg-white/[0.06]'}`}
                    >
                      <div className="w-4 h-4 rounded-sm flex-shrink-0" style={{ background: seg.color }} />
                      <span className="flex-1 text-left font-medium">{seg.title}</span>
                      <span className="text-xs text-muted-foreground">{seg.percentage}%</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* WhatsApp notification */}
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 mb-5">
              <label className="flex items-center gap-2.5 cursor-pointer mb-3">
                <input type="checkbox" checked={batchWhatsappEnabled} onChange={e => setBatchWhatsappEnabled(e.target.checked)} className="rounded border-white/20" />
                <MessageCircle size={16} className="text-green-400" />
                <span className="text-sm font-medium text-foreground">Enviar WhatsApp ao liberar giros</span>
              </label>
              {batchWhatsappEnabled && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-1.5">
                    {WHATSAPP_SPIN_TEMPLATES.map(tpl => (
                      <button key={tpl.id} onClick={() => setBatchWhatsappTemplate(tpl.id)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${batchWhatsappTemplate === tpl.id ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-white/[0.02] text-muted-foreground border-white/[0.06] hover:bg-white/[0.06]'}`}>
                        {tpl.label}
                      </button>
                    ))}
                  </div>
                  {batchWhatsappTemplate === 'custom' ? (
                    <textarea value={batchWhatsappCustomMsg} onChange={e => setBatchWhatsappCustomMsg(e.target.value)} rows={3} placeholder="Use {nome}, {giros}, {link} como variáveis..." className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-xs resize-y focus:outline-none focus:ring-1 focus:ring-green-500/40 placeholder:text-muted-foreground" />
                  ) : (
                    <div className="rounded-lg bg-white/[0.04] p-3 border border-white/[0.06]">
                      <p className="text-[11px] text-muted-foreground mb-1">Pré-visualização:</p>
                      <p className="text-xs text-foreground">
                        {(WHATSAPP_SPIN_TEMPLATES.find(t => t.id === batchWhatsappTemplate)?.message || '')
                          .replace(/\{nome\}/g, 'Nome')
                          .replace(/\{giros\}/g, String(batchGrantSpinCount))
                          .replace(/\{link\}/g, `${window.location.origin}/${slug}`)}
                      </p>
                    </div>
                  )}
                  {!evolutionApiUrl && <p className="text-[10px] text-amber-400">⚠️ Configure a Evolution API na aba WhatsApp primeiro</p>}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowBatchGrantModal(false)} className="flex-1 py-3 rounded-xl text-sm font-semibold bg-white/[0.06] text-muted-foreground hover:bg-white/[0.1] transition-all border border-white/[0.08]">
                Cancelar
              </button>
              <button onClick={confirmBatchGrantSpin} className="flex-1 py-3 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:brightness-110 transition-all shadow-lg shadow-primary/20">
                {batchWhatsappEnabled ? `📱 Liberar + WhatsApp (${selectedUserIds.size})` : `Liberar ${batchGrantSpinCount} Giro(s) para ${selectedUserIds.size} inscrito(s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
