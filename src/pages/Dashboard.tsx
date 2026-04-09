import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import CustomizationPanel from '@/components/casino/CustomizationPanel';
import DialogConfigPanel from '@/components/casino/DialogConfigPanel';
import AuthConfigPanel from '@/components/casino/AuthConfigPanel';
import { WheelConfig, defaultConfig } from '@/components/casino/types';
import { Users, Target, Shield, Trophy, Mail, Smartphone, MessageCircle, LogOut, Search, Plus, FileDown, FileUp, Pencil, Trash2, Copy, ExternalLink, ChevronLeft, ChevronRight, RotateCcw, Eye, Settings, Send, X, BarChart3, Globe, Monitor, Clock, MapPin, Wallet, DollarSign, Ban } from 'lucide-react';
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

  const [activeTab, setActiveTab] = useState<'inscritos' | 'wheel' | 'auth' | 'history' | 'email' | 'sms' | 'whatsapp' | 'analytics' | 'financeiro'>('inscritos');
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
