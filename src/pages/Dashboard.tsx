import { useState, useEffect, useRef } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import CustomizationPanel from '@/components/casino/CustomizationPanel';
import DialogConfigPanel from '@/components/casino/DialogConfigPanel';
import AuthConfigPanel from '@/components/casino/AuthConfigPanel';
import { WheelConfig, defaultConfig } from '@/components/casino/types';
import BattleConfigPanel from '@/components/casino/BattleConfigPanel';
import { Users, Target, Shield, Trophy, Mail, Smartphone, MessageCircle, LogOut, Search, Plus, FileDown, FileUp, Pencil, Trash2, Copy, ExternalLink, ChevronLeft, ChevronRight, RotateCcw, Eye, Settings, Send, X, BarChart3, Globe, Monitor, Clock, MapPin, Wallet, DollarSign, Ban, Link2, Palette, CalendarIcon, Bell, Image, Film, Mic, Paperclip, ImageIcon, Video, FileAudio, FileText, Gift, Star, Upload, Minus, RefreshCw, CheckCircle2, Swords } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import ReferralPageEditor from '@/components/casino/ReferralPageEditor';
import ReferralAnalyticsPanel from '@/components/casino/ReferralAnalyticsPanel';
import WhatsAppShareDialog from '@/components/casino/WhatsAppShareDialog';
import ReferralDefaultEditor from '@/components/casino/ReferralDefaultEditor';
import ThemeSettingsPanel, { ThemeSettings, defaultTheme } from '@/components/casino/ThemeSettingsPanel';
import GorjetaPageEditor from '@/components/casino/GorjetaPageEditor';
import InfluencerPageEditor from '@/components/casino/InfluencerPageEditor';
import { uploadAppAsset } from '@/lib/uploadAppAsset';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import MessagingAnalytics from '@/components/casino/MessagingAnalytics';
import EmailTemplateEditor, { useEmailTemplates, type EmailTemplateRow } from '@/components/casino/EmailTemplateEditor';
import BrevoBulkEmailPanel from '@/components/casino/BrevoBulkEmailPanel';
import BulkSendProgress from '@/components/casino/BulkSendProgress';
import BulkSendControls from '@/components/casino/BulkSendControls';
import { useBulkSendControl } from '@/hooks/useBulkSendControl';
import MoneyInput from '@/components/casino/MoneyInput';

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
  blacklisted: boolean;
  guaranteed_next_win: boolean;
}

interface PersistedDashboardSettings {
  emailSubject: string;
  emailBody: string;
  emailTemplate: 'original' | 'custom' | 'lucas' | string;
  emailBannerUrl: string;
  emailSenderName: string;
  emailSenderEmail: string;
  smsMessage: string;
  smsProvider: 'twilio' | 'mobizon';
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioPhoneNumber: string;
  mobizonSender: string;
  smsCsMessage: string;
  clicksendUsername: string;
  clicksendApiKey: string;
  clicksendSenderId: string;
  whatsappMessage: string;
  whatsappDelaySeconds: number;
  evolutionApiUrl: string;
  evolutionApiKey: string;
  evolutionInstance: string;
  evolutionApiUrl2: string;
  evolutionApiKey2: string;
  evolutionInstance2: string;
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
  notifyWhatsappPhones: string[];
  notifyAutoPaymentEnabled: boolean;
  notifyReferralEnabled: boolean;
  notifyPendingPaymentEnabled: boolean;
  notifyDepositEnabled: boolean;
  notifyGroupJid: string;
  notifyGroupName: string;
  notifySelectedGroups: {id: string; subject: string}[];
  receiptFontColor: string;
  receiptBgColor: string;
  receiptAccentColor: string;
  receiptOperatorName: string;
  hideReceiptSection: boolean;
  hideEdpaySection: boolean;
  panelCasaUrl: string;
  csvContactGroups: string[];
}

const DEFAULT_PERSISTED_DASHBOARD_SETTINGS: PersistedDashboardSettings = {
  emailSubject: '🎰 Você tem um giro disponível!',
  emailBody: 'Olá! Você foi convidado para girar a roleta e concorrer a prêmios incríveis. Acesse o link abaixo e boa sorte!',
  emailTemplate: 'original',
  emailBannerUrl: '',
  emailSenderName: 'Royal Spin Wheel',
  emailSenderEmail: 'noreply',
  smsMessage: '',
  smsProvider: 'twilio',
  twilioAccountSid: '',
  twilioAuthToken: '',
  twilioPhoneNumber: '',
  mobizonSender: 'MobizonBR',
  smsCsMessage: '',
  clicksendUsername: '',
  clicksendApiKey: '',
  clicksendSenderId: '',
  whatsappMessage: '',
  whatsappDelaySeconds: 2,
  evolutionApiUrl: '',
  evolutionApiKey: '',
  evolutionInstance: '',
  evolutionApiUrl2: '',
  evolutionApiKey2: '',
  evolutionInstance2: '',
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
  notifyWhatsappPhones: [],
  notifyAutoPaymentEnabled: false,
  notifyReferralEnabled: false,
  notifyPendingPaymentEnabled: false,
  notifyDepositEnabled: false,
  notifyGroupJid: '',
  notifyGroupName: '',
  notifySelectedGroups: [],
  receiptFontColor: '#1a1a2e',
  receiptBgColor: '#ffffff',
  receiptAccentColor: '#3b82f6',
  receiptOperatorName: '',
  hideReceiptSection: false,
  hideEdpaySection: false,
  panelCasaUrl: '',
  csvContactGroups: [],
};

const PANEL_CASA_STORAGE_KEY = 'dashboard_panel_casa_url';

const normalizePanelCasaUrl = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const schemeRe = new RegExp('^[a-zA-Z][a-zA-Z\\d+\\-.]*:');
  if (schemeRe.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return 'https:' + trimmed;
  return 'https://' + trimmed;
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

function openPrintReceipt(elementId: string, fontColor: string, bgColor: string, accentColor: string) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const w = window.open('', '_blank');
  if (!w) return;
  const css = '*{margin:0;padding:0;box-sizing:border-box;font-family:system-ui,-apple-system,sans-serif}' +
    'body{padding:40px;color:' + fontColor + ';background:' + bgColor + ';max-width:500px;margin:0 auto}' +
    '.section{border-top:1px solid #e5e7eb;padding:16px 0}' +
    '.row{display:flex;justify-content:space-between;padding:4px 0;font-size:13px}' +
    '.row .label{color:#888}.row .val{font-weight:600;text-align:right;max-width:60%}' +
    '.label-sm{font-size:11px;color:#999;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;font-weight:600}' +
    '.amount-box{border:2px solid ' + accentColor + ';border-radius:12px;text-align:center;padding:16px;margin:16px 0}' +
    '.footer{text-align:center;font-size:10px;color:#999;margin-top:20px;border-top:1px solid #e5e7eb;padding-top:12px}';
  const head = '<html><head><title>Comprovante<' + '/title><style>' + css + '<' + '/style><' + '/head>';
  w.document.write(head + '<body>' + el.innerHTML + '<' + '/body><' + '/html>');
  w.document.close();
  w.print();
}

function Dashboard() {
  useSiteSettings('dashboard');
  const configHydratedRef = useRef(false);
  const lastPersistedSettingsRef = useRef('');
  const lastConfigUpdatedAtRef = useRef<string | null>(null);
  const savingInFlightRef = useRef(false);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [toolPerms, setToolPerms] = useState<Record<string, boolean>>({
    roleta: true, sms: true, sms_mb: true, sms_cs: true, email: true, whatsapp: true, whatsapp2: true, financeiro: true, gorjeta: true, referral: true,
    inscritos: true, auth: true, history: true, analytics: true, msg_analytics: true, notificacoes: true, configuracoes: true, painel_casa: true,
    batalha_slot: false,
  });

  const [activeTab, setActiveTab] = useState<'inscritos' | 'wheel' | 'batalha_slot' | 'auth' | 'history' | 'email' | 'email_brevo' | 'sms' | 'sms_cs' | 'whatsapp' | 'whatsapp2' | 'analytics' | 'financeiro' | 'referral' | 'notificacoes' | 'gorjeta' | 'hist_gorjeta' | 'configuracoes' | 'painel_casa' | 'deposito' | 'hist_deposito' | 'msg_analytics'>('inscritos');
  const [openGroupsRaw, setOpenGroupsRaw] = useState<Record<string, boolean>>({});
  const [gorjetaHistory, setGorjetaHistory] = useState<any[]>([]);
  const [gorjetaHistoryLoading, setGorjetaHistoryLoading] = useState(false);
  const [gorjetaDetailUser, setGorjetaDetailUser] = useState<any>(null);
  const [gorjetaDateFilter, setGorjetaDateFilter] = useState<string>(''); // YYYY-MM-DD or '' for all
  const [gorjetaStatusFilter, setGorjetaStatusFilter] = useState<'all' | 'paid' | 'pending' | 'failed'>('all');
  const [gorjetaSubTab, setGorjetaSubTab] = useState<'link' | 'visual' | 'influencer' | 'seo'>('link');
  const [ghostUserName, setGhostUserName] = useState('');
  const [referralLinks, setReferralLinks] = useState<any[]>([]);
  const [referralLoading, setReferralLoading] = useState(false);
  const [showReferralForm, setShowReferralForm] = useState(false);
  const [referralForm, setReferralForm] = useState({
    label: '',
    spins_per_registration: 1,
    max_registrations: '' as string,
    fixed_prize_segments: [] as number[],
    fixed_prize_plan: [] as { segment_index: number; count: number }[],
    auto_payment: false,
    expires_at: '',
  });
  const [editingReferral, setEditingReferral] = useState<any>(null);
  const [customizingReferral, setCustomizingReferral] = useState<any>(null);
  const [analyticsReferral, setAnalyticsReferral] = useState<any>(null);
  const [sharingReferral, setSharingReferral] = useState<any>(null);
  const [referralSubTab, setReferralSubTab] = useState<'links' | 'analytics' | 'default_style'>('links');
  const [defaultReferralConfig, setDefaultReferralConfig] = useState<any>({});
  const [pageViews, setPageViews] = useState<any[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsFilter, setAnalyticsFilter] = useState<'all' | 'roleta' | 'referral' | 'gorjeta'>('all');
  const [analyticsDateFilter, setAnalyticsDateFilter] = useState<string>(''); // YYYY-MM-DD
  const [analyticsRangeFilter, setAnalyticsRangeFilter] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [users, setUsers] = useState<WheelUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [spinsFilter, setSpinsFilter] = useState<'all' | 'with' | 'without' | 'auto_pay' | 'qualified' | 'duplicados' | 'blacklist' | 'guaranteed'>('all');

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
  const [emailTemplate, setEmailTemplate] = useState<'original' | 'custom' | 'lucas' | string>('original');
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplateRow | null>(null);
  const [emailBannerUrl, setEmailBannerUrl] = useState('');
  const [emailBannerUploading, setEmailBannerUploading] = useState(false);
  const [emailSenderName, setEmailSenderName] = useState('Royal Spin Wheel');
  const [emailSenderEmail, setEmailSenderEmail] = useState('noreply');
  const [showEmailHistory, setShowEmailHistory] = useState(false);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [emailLogsLoading, setEmailLogsLoading] = useState(false);

  const { templates: customTemplates, refresh: refreshCustomTemplates } = useEmailTemplates(session?.user?.id || null);
  const [smsMessage, setSmsMessage] = useState('');
  const [smsProvider, setSmsProvider] = useState<'twilio' | 'mobizon'>('twilio');
  const [smsSending, setSmsSending] = useState(false);
  const [smsTarget, setSmsTarget] = useState<'all' | 'selected'>('all');
  const [selectedPhones, setSelectedPhones] = useState<string[]>([]);
   const [showSmsConfig, setShowSmsConfig] = useState(false);
  const [smsSearchTerm, setSmsSearchTerm] = useState('');
  const [smsLogs, setSmsLogs] = useState<any[]>([]);
  const [smsLogsLoading, setSmsLogsLoading] = useState(false);
  const [showSmsHistory, setShowSmsHistory] = useState(false);
  const [smsScheduleMode, setSmsScheduleMode] = useState(false);
  const [smsSchedDate, setSmsSchedDate] = useState<Date | undefined>(undefined);
  const [smsSchedTime, setSmsSchedTime] = useState('12:00');
  const [smsSchedRecurrence, setSmsSchedRecurrence] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [smsSchedSaving, setSmsSchedSaving] = useState(false);
  const [smsScheduledList, setSmsScheduledList] = useState<any[]>([]);
  const [showSmsScheduledList, setShowSmsScheduledList] = useState(false);
  // Twilio credentials are scoped per operator via wheel_configs (NEVER localStorage — would leak across operators on the same browser)
  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState('');
  const [mobizonSender, setMobizonSender] = useState('MobizonBR');

  // ClickSend (SMS API CS) — separate state, separate log table (sms_cs_message_log)
  const [smsCsMessage, setSmsCsMessage] = useState('');
  const [smsCsSending, setSmsCsSending] = useState(false);
  const [smsCsTarget, setSmsCsTarget] = useState<'all' | 'selected'>('all');
  const [selectedSmsCsPhones, setSelectedSmsCsPhones] = useState<string[]>([]);
  const [showSmsCsConfig, setShowSmsCsConfig] = useState(false);
  const [smsCsSearchTerm, setSmsCsSearchTerm] = useState('');
  const [smsCsLogs, setSmsCsLogs] = useState<any[]>([]);
  const [smsCsLogsLoading, setSmsCsLogsLoading] = useState(false);
  const [showSmsCsHistory, setShowSmsCsHistory] = useState(false);
  const [smsCsScheduleMode, setSmsCsScheduleMode] = useState(false);
  const [smsCsSchedDate, setSmsCsSchedDate] = useState<Date | undefined>(undefined);
  const [smsCsSchedTime, setSmsCsSchedTime] = useState('12:00');
  const [smsCsSchedRecurrence, setSmsCsSchedRecurrence] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [smsCsSchedSaving, setSmsCsSchedSaving] = useState(false);
  const [smsCsScheduledList, setSmsCsScheduledList] = useState<any[]>([]);
  const [showSmsCsScheduledList, setShowSmsCsScheduledList] = useState(false);
  const [smsCsSourceMode, setSmsCsSourceMode] = useState<'base' | 'csv'>('base');
  const [clicksendUsername, setClicksendUsername] = useState('');
  const [clicksendApiKey, setClicksendApiKey] = useState('');
  const [clicksendSenderId, setClicksendSenderId] = useState('');

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

  // WhatsApp 2 state (segunda instância — credenciais e envios independentes)
  const [whatsappSending2, setWhatsappSending2] = useState(false);
  const [showWhatsappConfig2, setShowWhatsappConfig2] = useState(false);
  const [evolutionApiUrl2, setEvolutionApiUrl2] = useState('');
  const [evolutionApiKey2, setEvolutionApiKey2] = useState('');
  const [evolutionInstance2, setEvolutionInstance2] = useState('');
  const [instanceStatus2, setInstanceStatus2] = useState<'unknown' | 'loading' | 'open' | 'close' | 'connecting' | 'error'>('unknown');
  const [instanceQrCode2, setInstanceQrCode2] = useState<string | null>(null);
  const [creatingInstance2, setCreatingInstance2] = useState(false);
  const [whatsappLogs2, setWhatsappLogs2] = useState<any[]>([]);
  const [whatsappLogsLoading2, setWhatsappLogsLoading2] = useState(false);
  const [showWhatsappHistory2, setShowWhatsappHistory2] = useState(false);
  const [notifyGroups2, setNotifyGroups2] = useState<{ id: string; subject: string }[]>([]);
  const [notifySelectedGroups2, setNotifySelectedGroups2] = useState<{ id: string; subject: string }[]>([]);
  const [notifyGroupJid2, setNotifyGroupJid2] = useState('');
  const [notifyGroupName2, setNotifyGroupName2] = useState('');
  const [notifyGroupsLoading2, setNotifyGroupsLoading2] = useState(false);
  const [excludeBulkSent, setExcludeBulkSent] = useState(false);

  // Progresso dos disparos em massa (Email/SMS/WhatsApp)
  type BulkProgress = { total: number; sent: number; errors: number; skipped: number };
  const emptyProgress: BulkProgress = { total: 0, sent: 0, errors: 0, skipped: 0 };
  const [emailProgress, setEmailProgress] = useState<BulkProgress>(emptyProgress);
  const [smsProgress, setSmsProgress] = useState<BulkProgress>(emptyProgress);
  const [smsCsProgress, setSmsCsProgress] = useState<BulkProgress>(emptyProgress);
  const [whatsappProgress, setWhatsappProgress] = useState<BulkProgress>(emptyProgress);
  const [whatsappProgress2, setWhatsappProgress2] = useState<BulkProgress>(emptyProgress);

  // Controles de PAUSAR/PARAR para cada modo de disparo
  const emailCtrl = useBulkSendControl();
  const smsCtrl = useBulkSendControl();
  const smsCsCtrl = useBulkSendControl();
  const whatsappCtrl = useBulkSendControl();
  const whatsappGroupCtrl = useBulkSendControl();
  const whatsapp2Ctrl = useBulkSendControl();
  const whatsapp2GroupCtrl = useBulkSendControl();

  const [edpayPublicKey, setEdpayPublicKey] = useState('');
  const [edpaySecretKey, setEdpaySecretKey] = useState('');
  const [showEdpaySecret, setShowEdpaySecret] = useState(false);
  const [notifyEvolutionApiUrl, setNotifyEvolutionApiUrl] = useState('');
  const [notifyEvolutionApiKey, setNotifyEvolutionApiKey] = useState('');
  const [notifyEvolutionInstance, setNotifyEvolutionInstance] = useState('');
  const [notifyWhatsappPhone, setNotifyWhatsappPhone] = useState('');
  const [notifyWhatsappPhones, setNotifyWhatsappPhones] = useState<string[]>([]);
  const [notifyAutoPaymentEnabled, setNotifyAutoPaymentEnabled] = useState(false);
  const [notifyReferralEnabled, setNotifyReferralEnabled] = useState(false);
  const [notifyPendingPaymentEnabled, setNotifyPendingPaymentEnabled] = useState(false);
  const [notifyDepositEnabled, setNotifyDepositEnabled] = useState(false);
  const [notifyGroupJid, setNotifyGroupJid] = useState('');
  const [notifyGroupName, setNotifyGroupName] = useState('');
  const [notifySelectedGroups, setNotifySelectedGroups] = useState<{id: string; subject: string}[]>([]);
  const [receiptFontColor, setReceiptFontColor] = useState('#1a1a2e');
  const [receiptBgColor, setReceiptBgColor] = useState('#ffffff');
  const [receiptAccentColor, setReceiptAccentColor] = useState('#3b82f6');
  const [receiptOperatorName, setReceiptOperatorName] = useState('');
  const [hideReceiptSection, setHideReceiptSection] = useState(false);
  const [hideEdpaySection, setHideEdpaySection] = useState(false);
  const [panelCasaUrl, setPanelCasaUrl] = useState('');
  const resolvedPanelCasaUrl = normalizePanelCasaUrl(panelCasaUrl);
  const [notifyGroups, setNotifyGroups] = useState<{id: string; subject: string}[]>([]);
  const [notifyGroupsLoading, setNotifyGroupsLoading] = useState(false);
  const [showNotifySecret, setShowNotifySecret] = useState(false);

  // Scheduled messages state
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduledMessages, setScheduledMessages] = useState<any[]>([]);
  const [scheduledLoading, setScheduledLoading] = useState(false);
  const [schedForm, setSchedForm] = useState({ message: '', recipientType: 'individual' as 'individual' | 'group', recipientValue: '', recipientLabel: '', date: undefined as Date | undefined, time: '12:00', recurrence: 'none' as 'none' | 'daily' | 'weekly' | 'monthly', mentionAll: false, selectedGroups: [] as { id: string; name: string }[], pollEnabled: false, pollName: '', pollValues: ['', ''] as string[], pollMulti: false });
  const [schedSaving, setSchedSaving] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [schedMedia, setSchedMedia] = useState<{ url: string; mediatype: string; mimetype: string; fileName: string; ptt?: boolean } | null>(null);
  const [schedMediaUploading, setSchedMediaUploading] = useState(false);
  const schedMediaInputRef = useRef<HTMLInputElement>(null);
  const schedPttInputRef = useRef<HTMLInputElement>(null);

  const handleSchedMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSchedMediaUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      let mediatype = 'document';
      if (['jpg','jpeg','png','gif','webp'].includes(ext)) mediatype = 'image';
      else if (['mp4','avi','mov','mkv','3gp'].includes(ext)) mediatype = 'video';
      else if (['mp3','ogg','opus','wav','m4a','aac'].includes(ext)) mediatype = 'audio';
      const safeName = file.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60) || 'arquivo';
      const path = `whatsapp-media/${session.user.id}/${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage.from('app-assets').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('app-assets').getPublicUrl(path);
      setSchedMedia({ url: urlData.publicUrl, mediatype, mimetype: file.type, fileName: file.name });
      toast.success('Mídia anexada ao agendamento!');
    } catch (err: any) {
      toast.error('Erro no upload: ' + (err.message || 'Erro'));
    } finally {
      setSchedMediaUploading(false);
      if (schedMediaInputRef.current) schedMediaInputRef.current.value = '';
    }
  };

  const handleSchedPttUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSchedMediaUploading(true);
    try {
      const safeName = file.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60) || 'audio.ogg';
      const path = `whatsapp-media/${session.user.id}/${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage.from('app-assets').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('app-assets').getPublicUrl(path);
      setSchedMedia({ url: urlData.publicUrl, mediatype: 'ptt', mimetype: 'audio/ogg; codecs=opus', fileName: file.name, ptt: true });
      toast.success('🎤 Áudio de voz anexado ao agendamento!');
    } catch (err: any) {
      toast.error('Erro no upload: ' + (err.message || 'Erro'));
    }
    setSchedMediaUploading(false);
    if (schedPttInputRef.current) schedPttInputRef.current.value = '';
  };

  const fetchScheduledMessages = async () => {
    if (!session?.user?.id) return;
    setScheduledLoading(true);
    const { data } = await supabase.from('scheduled_messages').select('*').eq('owner_id', session.user.id).order('next_run_at', { ascending: true });
    setScheduledMessages(data || []);
    setScheduledLoading(false);
  };

  const resetSchedForm = () => {
    setSchedForm({ message: '', recipientType: 'individual', recipientValue: '', recipientLabel: '', date: undefined, time: '12:00', recurrence: 'none', mentionAll: false, selectedGroups: [], pollEnabled: false, pollName: '', pollValues: ['', ''], pollMulti: false });
    setSchedMedia(null);
    setEditingScheduleId(null);
  };

  const startEditSchedule = (m: any) => {
    const dt = new Date(m.scheduled_at);
    setSchedForm({
      message: m.message || '',
      recipientType: m.recipient_type || 'individual',
      recipientValue: m.recipient_type === 'individual' ? m.recipient_value : '',
      recipientLabel: m.recipient_type === 'individual' ? (m.recipient_label || '') : '',
      date: dt,
      time: `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`,
      recurrence: m.recurrence || 'none',
      mentionAll: m.mention_all || false,
      selectedGroups: m.recipient_type === 'group' ? [{ id: m.recipient_value, name: m.recipient_label || m.recipient_value }] : [],
      pollEnabled: !!m.poll,
      pollName: m.poll?.name || '',
      pollValues: Array.isArray(m.poll?.values) && m.poll.values.length >= 2 ? m.poll.values : ['', ''],
      pollMulti: !!(m.poll && Number(m.poll.selectableCount) > 1),
    });
    if (m.media_url) {
      setSchedMedia({ url: m.media_url, mediatype: m.media_type || 'document', mimetype: m.media_mimetype || '', fileName: m.media_filename || 'file' });
    } else {
      setSchedMedia(null);
    }
    setEditingScheduleId(m.id);
  };

  const saveScheduledMessage = async () => {
    let pollPayload: { name: string; values: string[]; selectableCount: number } | null = null;
    if (schedForm.pollEnabled) {
      if (schedForm.recipientType !== 'group') { toast.error('Enquetes só podem ser enviadas para grupos'); return; }
      const opts = schedForm.pollValues.map(v => v.trim()).filter(Boolean);
      if (!schedForm.pollName.trim()) { toast.error('Informe a pergunta da enquete'); return; }
      if (opts.length < 2) { toast.error('A enquete precisa de pelo menos 2 opções'); return; }
      pollPayload = { name: schedForm.pollName.trim(), values: opts, selectableCount: schedForm.pollMulti ? opts.length : 1 };
    }
    if (!pollPayload && !schedForm.message.trim() && !schedMedia) { toast.error('Digite a mensagem ou anexe mídia'); return; }
    if (schedForm.recipientType === 'individual' && !schedForm.recipientValue) { toast.error('Selecione o destinatário'); return; }
    if (schedForm.recipientType === 'group' && schedForm.selectedGroups.length === 0) { toast.error('Selecione ao menos um grupo'); return; }
    if (!schedForm.date) { toast.error('Selecione a data'); return; }
    const [hours, minutes] = schedForm.time.split(':').map(Number);
    const scheduledAt = new Date(schedForm.date);
    scheduledAt.setHours(hours, minutes, 0, 0);
    if (scheduledAt.getTime() <= Date.now() + 60000) {
      toast.error('A data/hora do agendamento deve ser no futuro (pelo menos 1 minuto à frente)');
      return;
    }
    setSchedSaving(true);
    const isoDate = scheduledAt.toISOString();

    const scheduleChannel = activeTab === 'whatsapp2' ? 'whatsapp2' : 'whatsapp';

    const baseRow = {
      message: schedForm.message || '',
      recipient_type: schedForm.recipientType,
      recurrence: schedForm.recurrence,
      status: 'pending',
      media_url: pollPayload ? null : (schedMedia?.url || null),
      media_type: pollPayload ? null : (schedMedia?.mediatype || null),
      media_mimetype: pollPayload ? null : (schedMedia?.mimetype || null),
      media_filename: pollPayload ? null : (schedMedia?.fileName || null),
      mention_all: schedForm.mentionAll,
      scheduled_at: isoDate,
      next_run_at: isoDate,
      channel: scheduleChannel,
      poll: pollPayload,
      updated_at: new Date().toISOString(),
    };

    let error: any = null;

    if (editingScheduleId) {
      // Update existing
      const recipient = schedForm.recipientType === 'group' && schedForm.selectedGroups.length > 0
        ? { recipient_value: schedForm.selectedGroups[0].id, recipient_label: schedForm.selectedGroups[0].name }
        : { recipient_value: schedForm.recipientValue, recipient_label: schedForm.recipientLabel };
      const { error: err } = await supabase.from('scheduled_messages').update({ ...baseRow, ...recipient } as any).eq('id', editingScheduleId);
      error = err;
    } else {
      // Insert new (possibly multiple groups)
      const recipients = schedForm.recipientType === 'group'
        ? schedForm.selectedGroups.map(g => ({ value: g.id, label: g.name }))
        : [{ value: schedForm.recipientValue, label: schedForm.recipientLabel }];

      const rows = recipients.map(r => ({
        owner_id: session.user.id,
        ...baseRow,
        recipient_value: r.value,
        recipient_label: r.label,
      }));

      const { error: err } = await supabase.from('scheduled_messages').insert(rows as any);
      error = err;
    }

    setSchedSaving(false);
    if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    toast.success(editingScheduleId ? 'Agendamento atualizado!' : 'Mensagem agendada com sucesso!');
    resetSchedForm();
    fetchScheduledMessages();
  };

  const cancelScheduledMessage = async (id: string) => {
    await supabase.from('scheduled_messages').update({ status: 'cancelled', updated_at: new Date().toISOString() } as any).eq('id', id);
    toast.success('Agendamento cancelado');
    fetchScheduledMessages();
  };

  // Media attachment state
  const [whatsappMedia, setWhatsappMedia] = useState<{ url: string; mediatype: string; mimetype: string; fileName: string; ptt?: boolean } | null>(null);
  const [whatsappMediaUploading, setWhatsappMediaUploading] = useState(false);
  const [whatsappMentionAll, setWhatsappMentionAll] = useState(false);
  const [groupPoll, setGroupPoll] = useState<{ enabled: boolean; name: string; values: string[]; multi: boolean }>({ enabled: false, name: '', values: ['', ''], multi: false });
  const whatsappMediaInputRef = useRef<HTMLInputElement>(null);
  const whatsappPttInputRef = useRef<HTMLInputElement>(null);

  const handleWhatsappMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setWhatsappMediaUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      let mediatype = 'document';
      if (['jpg','jpeg','png','gif','webp'].includes(ext)) mediatype = 'image';
      else if (['mp4','avi','mov','mkv','3gp'].includes(ext)) mediatype = 'video';
      else if (['mp3','ogg','opus','wav','m4a','aac'].includes(ext)) mediatype = 'audio';

      const safeName2 = file.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60) || 'arquivo';
      const path = `whatsapp-media/${session.user.id}/${Date.now()}_${safeName2}`;
      const { error: uploadError } = await supabase.storage.from('app-assets').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('app-assets').getPublicUrl(path);
      setWhatsappMedia({ url: urlData.publicUrl, mediatype, mimetype: file.type, fileName: file.name });
      toast.success(`${mediatype === 'image' ? 'Imagem' : mediatype === 'video' ? 'Vídeo' : mediatype === 'audio' ? 'Áudio' : 'Arquivo'} anexado!`);
    } catch (err: any) {
      toast.error('Erro no upload: ' + (err.message || 'Erro'));
    }
    setWhatsappMediaUploading(false);
    if (whatsappMediaInputRef.current) whatsappMediaInputRef.current.value = '';
  };

  const handleWhatsappPttUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setWhatsappMediaUploading(true);
    try {
      const safeName = file.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60) || 'audio.ogg';
      const path = `whatsapp-media/${session.user.id}/${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage.from('app-assets').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('app-assets').getPublicUrl(path);
      setWhatsappMedia({ url: urlData.publicUrl, mediatype: 'audio', mimetype: 'audio/ogg; codecs=opus', fileName: file.name, ptt: true });
      toast.success('🎤 Áudio de voz anexado! Será enviado como mensagem de voz.');
    } catch (err: any) {
      toast.error('Erro no upload: ' + (err.message || 'Erro'));
    }
    setWhatsappMediaUploading(false);
    if (whatsappPttInputRef.current) whatsappPttInputRef.current.value = '';
  };

  const [financeiroSubTab, setFinanceiroSubTab] = useState<'credenciais' | 'deposito' | 'aprovacoes' | 'saldo' | 'crypto' | 'withdraw' | 'historico' | 'pagamento_manual'>('credenciais');
  // Sub-tab for the public Deposit page variant displayed in the dashboard.
  // Both variants share the same depositConfig — only the public URL differs (/dep= vs /depbs=).
  const [depositVariant, setDepositVariant] = useState<'dep' | 'depbs'>('dep');
  const [manualPaySelectedIds, setManualPaySelectedIds] = useState<Set<string>>(new Set());
  const [manualPayAmount, setManualPayAmount] = useState('');
  const [manualPayPrize, setManualPayPrize] = useState('');
  const [manualPaySearch, setManualPaySearch] = useState('');
  const [manualPaySending, setManualPaySending] = useState(false);
  const { confirm: confirmDialog, ConfirmDialog } = useConfirmDialog();
  const [bsDepositStats, setBsDepositStats] = useState<{ total: number; count: number }>({ total: 0, count: 0 });
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
  const [selectedPrizeIds, setSelectedPrizeIds] = useState<Set<string>>(new Set());
  const [bulkPaying, setBulkPaying] = useState(false);
  const [paidHistory, setPaidHistory] = useState<any[]>([]);
  const [paidHistoryLoading, setPaidHistoryLoading] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState<any | null>(null);
  const [receiptMeta, setReceiptMeta] = useState<any | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [depositHistory, setDepositHistory] = useState<any[]>([]);
  const [depositHistoryLoading, setDepositHistoryLoading] = useState(false);
  const [depositStatusFilter, setDepositStatusFilter] = useState<'all' | 'paid' | 'cancelled' | 'pending'>('all');
  const [depositReceipt, setDepositReceipt] = useState<any | null>(null);
  const [bulkSentPhones, setBulkSentPhones] = useState<Set<string>>(new Set());
  const [bulkSentOldestTime, setBulkSentOldestTime] = useState<Date | null>(null);
  const [bulkSentCountdown, setBulkSentCountdown] = useState('');
  const [excludeRecentEmail, setExcludeRecentEmail] = useState(false);
  const [recentEmailRecipients, setRecentEmailRecipients] = useState<Set<string>>(new Set());
  const [recentEmailOldestTime, setRecentEmailOldestTime] = useState<Date | null>(null);
  const [recentEmailCountdown, setRecentEmailCountdown] = useState('');

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

  const fetchGorjetaHistory = async () => {
    if (!session?.user?.id) return;
    setGorjetaHistoryLoading(true);
    try {
      const { data } = await (supabase as any)
        .from('prize_payments')
        .select('*, wheel_users!prize_payments_wheel_user_id_fkey(name, email, phone, account_id, pix_key, pix_key_type, user_type, responsible, auto_payment, blacklisted, guaranteed_next_win, created_at)')
        .eq('owner_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(500);
      setGorjetaHistory(data || []);
    } catch (e) {
      console.error(e);
    }
    setGorjetaHistoryLoading(false);
  };

  const buildReferralFixedPrizePlan = (link: any) => {
    if (Array.isArray(link?.fixed_prize_plan)) {
      return link.fixed_prize_plan
        .map((item: any) => ({
          segment_index: Number(item?.segment_index),
          count: Math.max(0, Number(item?.count) || 0),
        }))
        .filter((item: any) => Number.isInteger(item.segment_index) && item.segment_index >= 0 && item.count > 0);
    }

    if (Array.isArray(link?.fixed_prize_segments) && link.fixed_prize_segments.length > 0) {
      const counts = new Map<number, number>();
      link.fixed_prize_segments.forEach((segmentIndex: any) => {
        const idx = Number(segmentIndex);
        if (!Number.isInteger(idx) || idx < 0) return;
        counts.set(idx, (counts.get(idx) || 0) + 1);
      });
      return Array.from(counts.entries()).map(([segment_index, count]) => ({ segment_index, count }));
    }

    if (link?.fixed_prize_segment != null) {
      return [{ segment_index: Number(link.fixed_prize_segment), count: 1 }];
    }

    return [] as { segment_index: number; count: number }[];
  };

  const formatReferralPrizePlan = (plan: { segment_index: number; count: number }[]) => {
    if (!plan.length) return 'Nenhum';
    return plan
      .map(({ segment_index, count }) => {
        const segment = wheelConfig?.segments?.[segment_index];
        const label = segment ? `${segment.title} — ${segment.reward}` : `Segmento ${segment_index + 1}`;
        return `${count}x ${label}`;
      })
      .join(', ');
  };

  const totalReferralPrizePlanCount = referralForm.fixed_prize_plan.reduce((sum, item) => sum + item.count, 0);
  const referralMaxRegistrationsNum = parseInt(referralForm.max_registrations) || 0;
  // Total de giros possíveis = giros por inscrição × limite de inscrições.
  // Se inscrições for ilimitado (0), o cap também é ilimitado (Infinity).
  const referralTotalAvailableSpins = referralMaxRegistrationsNum > 0
    ? referralForm.spins_per_registration * referralMaxRegistrationsNum
    : Infinity;

  const handleSaveReferral = async () => {
    if (!referralForm.label.trim()) { toast.error('Preencha o nome do link'); return; }
    if (totalReferralPrizePlanCount > referralTotalAvailableSpins) {
      toast.error('A soma dos prêmios garantidos não pode ser maior que o total de giros disponíveis');
      return;
    }

    const normalizedPlan = referralForm.fixed_prize_plan
      .map(item => ({ segment_index: item.segment_index, count: Math.max(0, Math.floor(item.count || 0)) }))
      .filter(item => item.count > 0);

    if (editingReferral) {
      const { error } = await (supabase as any)
        .from('referral_links')
        .update({ label: referralForm.label, spins_per_registration: referralForm.spins_per_registration, max_registrations: referralForm.max_registrations ? parseInt(referralForm.max_registrations) : null, fixed_prize_segments: null, fixed_prize_plan: normalizedPlan.length > 0 ? normalizedPlan : null, auto_payment: referralForm.auto_payment, expires_at: referralForm.expires_at ? new Date(referralForm.expires_at).toISOString() : null, updated_at: new Date().toISOString() })
        .eq('id', editingReferral.id);
      if (error) { toast.error('Erro ao atualizar'); return; }
      toast.success('Link atualizado!');
    } else {
      // Build confirmation message with link details
      const confirmLines = [
        `📌 Nome: ${referralForm.label}`,
        `🎰 Giros por resgate: ${referralForm.spins_per_registration}`,
        referralForm.max_registrations ? `👥 Limite de resgates: ${referralForm.max_registrations}` : '👥 Limite de resgates: Ilimitado',
        referralForm.expires_at ? `📅 Expira em: ${new Date(referralForm.expires_at).toLocaleString('pt-BR')}` : '📅 Expiração: Sem prazo',
        normalizedPlan.length > 0 ? `🎯 Plano de prêmios:\n${normalizedPlan.map(item => `   • ${item.count}x ${wheelConfig?.segments?.[item.segment_index]?.title || `Segmento ${item.segment_index + 1}`} — ${wheelConfig?.segments?.[item.segment_index]?.reward || ''}`).join('\n')}` : '🎯 Plano de prêmios: Nenhum',
        `💸 Auto-pagamento: ${referralForm.auto_payment ? 'Sim' : 'Não'}`,
      ];
      const confirmed = await confirmDialog({
        title: 'Confirmar Criação do Link',
        message: confirmLines.join('\n'),
        variant: 'info',
        confirmLabel: 'Criar Link',
      });
      if (!confirmed) return;

      const { error } = await (supabase as any)
        .from('referral_links')
        .insert({ owner_id: session.user.id, label: referralForm.label, spins_per_registration: referralForm.spins_per_registration, max_registrations: referralForm.max_registrations ? parseInt(referralForm.max_registrations) : null, fixed_prize_segments: null, fixed_prize_plan: normalizedPlan.length > 0 ? normalizedPlan : null, auto_payment: referralForm.auto_payment, expires_at: referralForm.expires_at ? new Date(referralForm.expires_at).toISOString() : null });
      if (error) { toast.error('Erro ao criar link'); return; }
      toast.success('Link criado!');
    }
    setShowReferralForm(false);
    setEditingReferral(null);
    setReferralForm({ label: '', spins_per_registration: 1, max_registrations: '', fixed_prize_segments: [], fixed_prize_plan: [], auto_payment: false, expires_at: '' });
    fetchReferralLinks();
  };

  const handleToggleReferral = async (id: string, currentActive: boolean) => {
    await (supabase as any).from('referral_links').update({ is_active: !currentActive, updated_at: new Date().toISOString() }).eq('id', id);
    fetchReferralLinks();
  };

  const handleDeleteReferral = async (id: string) => {
    if (!await confirmDialog({ title: 'Excluir Link', message: 'Tem certeza que deseja excluir este link de referência?', variant: 'danger', confirmLabel: 'Excluir' })) return;
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

  const fetchSmsLogs = async () => {
    if (!session?.user?.id) return;
    setSmsLogsLoading(true);
    const [{ data: smsData }, { data: smsMbData }] = await Promise.all([
      (supabase as any)
        .from('sms_message_log')
        .select('*')
        .eq('owner_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(100),
      (supabase as any)
        .from('sms_mb_message_log')
        .select('*')
        .eq('owner_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(100),
    ]);
    const merged = [
      ...((smsData || []).map((row: any) => ({ ...row, provider: 'twilio' }))),
      ...((smsMbData || []).map((row: any) => ({ ...row, provider: 'mobizon_br' }))),
    ].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setSmsLogs(merged);
    setSmsLogsLoading(false);
  };

  const fetchEmailLogs = async () => {
    if (!session?.user?.id) return;
    setEmailLogsLoading(true);
    try {
      let allData: any[] = [];
      const PAGE = 1000;
      let from = 0;
      while (true) {
        const { data } = await (supabase as any)
          .from('email_send_log')
          .select('*')
          .eq('metadata->>owner_id', session.user.id)
          .order('created_at', { ascending: false })
          .range(from, from + PAGE - 1);
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      const seen = new Map<string, any>();
      for (const row of allData) {
        const key = row.message_id || row.id;
        if (!seen.has(key)) seen.set(key, row);
      }
      setEmailLogs(Array.from(seen.values()));
    } catch (e) {
      console.error('Failed to fetch email logs', e);
    }
    setEmailLogsLoading(false);
  };

  const deleteSmsLog = async (id: string) => {
    const ok = await confirmDialog({ title: 'Excluir registro?', message: 'Deseja remover este SMS do histórico?', variant: 'danger', confirmLabel: 'Excluir' });
    if (!ok) return;
    const log = smsLogs.find((item: any) => item.id === id);
    await (supabase as any).from(log?.provider === 'mobizon_br' ? 'sms_mb_message_log' : 'sms_message_log').delete().eq('id', id);
    setSmsLogs(prev => prev.filter(l => l.id !== id));
    toast.success('Registro excluído');
  };

  const resendSms = async (log: any) => {
    const provider = log.provider === 'mobizon_br' ? 'mobizon' : 'twilio';
    if (provider === 'twilio' && (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber)) { toast.error('Configure as credenciais do Twilio'); setShowSmsConfig(true); return; }
    const { data, error } = await supabase.functions.invoke(provider === 'mobizon' ? 'send-sms-mobizon' : 'send-sms', {
      body: provider === 'mobizon'
        ? { recipientPhone: log.recipient_phone, message: log.message, sender: mobizonSender }
        : { recipientPhone: log.recipient_phone, message: log.message, twilioAccountSid, twilioAuthToken, twilioPhoneNumber }
    });
    if (error) { toast.error('Erro ao reenviar SMS'); return; }
    if ((data as any)?.skipped) { toast.error((data as any)?.error || 'Número inválido'); return; }
    if (provider === 'mobizon') {
      await (supabase as any).from('sms_mb_message_log').insert({
        owner_id: session?.user?.id,
        recipient_phone: log.recipient_phone,
        recipient_name: log.recipient_name || '',
        message: log.message,
        status: 'sent',
        error_message: null,
      });
    } else {
      await (supabase as any).from('sms_message_log').insert({
        owner_id: session?.user?.id,
        recipient_phone: log.recipient_phone,
        recipient_name: log.recipient_name || '',
        message: log.message,
        status: 'sent',
        error_message: null,
      });
    }
    toast.success('SMS reenviado!');
    fetchSmsLogs();
  };

  const fetchSmsScheduled = async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase.from('scheduled_messages').select('*').eq('owner_id', session.user.id).in('channel', ['sms', 'sms_mb'] as any).order('next_run_at', { ascending: true });
    setSmsScheduledList(data || []);
  };

  const saveSmsSchedule = async () => {
    if (!session?.user?.id) return;
    if (!smsMessage.trim()) { toast.error('Digite a mensagem'); return; }
    if (!smsSchedDate) { toast.error('Selecione a data'); return; }
    let targetPhones: { phone: string; name: string }[] = [];
    if (smsSourceMode === 'csv') {
      targetPhones = getSelectedExternalPhoneList();
    } else {
      const usersWithPhone = users.filter(u => u.phone && u.phone.replace(/\D/g, '').length >= 10);
      targetPhones = (smsTarget === 'all' ? usersWithPhone : users.filter(u => selectedPhones.includes(u.phone))).map(u => ({ phone: u.phone, name: u.name }));
    }
    if (targetPhones.length === 0) { toast.error('Nenhum destinatário'); return; }
    setSmsSchedSaving(true);
    const [h, m] = smsSchedTime.split(':').map(Number);
    const scheduledAt = new Date(smsSchedDate);
    scheduledAt.setHours(h, m, 0, 0);
    const rows = targetPhones.map(t => ({
      owner_id: session.user.id,
      message: smsMessage,
      recipient_type: 'individual',
      recipient_value: t.phone,
      recipient_label: t.name,
      scheduled_at: scheduledAt.toISOString(),
      next_run_at: scheduledAt.toISOString(),
      recurrence: smsSchedRecurrence,
      channel: smsProvider === 'mobizon' ? 'sms_mb' : 'sms',
    }));
    const { error } = await supabase.from('scheduled_messages').insert(rows as any);
    setSmsSchedSaving(false);
    if (error) { toast.error('Erro ao agendar'); console.error(error); return; }
    toast.success(`${targetPhones.length} SMS agendado(s)!`);
    setSmsScheduleMode(false);
    setSmsSchedDate(undefined);
    setSmsSchedTime('12:00');
    setSmsSchedRecurrence('none');
    fetchSmsScheduled();
  };

  const cancelSmsSchedule = async (id: string) => {
    await supabase.from('scheduled_messages').update({ status: 'cancelled', updated_at: new Date().toISOString() } as any).eq('id', id);
    toast.success('Agendamento cancelado');
    fetchSmsScheduled();
  };

  // ═══ ClickSend (SMS API CS) helpers — log: sms_cs_message_log, channel: 'sms_cs' ═══
  const fetchSmsCsLogs = async () => {
    if (!session?.user?.id) return;
    setSmsCsLogsLoading(true);
    const { data } = await (supabase as any)
      .from('sms_cs_message_log')
      .select('*')
      .eq('owner_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setSmsCsLogs(data || []);
    setSmsCsLogsLoading(false);
  };

  const deleteSmsCsLog = async (id: string) => {
    const ok = await confirmDialog({ title: 'Excluir registro?', message: 'Deseja remover este SMS do histórico?', variant: 'danger', confirmLabel: 'Excluir' });
    if (!ok) return;
    await (supabase as any).from('sms_cs_message_log').delete().eq('id', id);
    setSmsCsLogs(prev => prev.filter(l => l.id !== id));
    toast.success('Registro excluído');
  };

  const resendSmsCs = async (log: any) => {
    if (!clicksendUsername || !clicksendApiKey || !clicksendSenderId) { toast.error('Configure as credenciais do ClickSend'); setShowSmsCsConfig(true); return; }
    const { data, error } = await supabase.functions.invoke('send-sms-clicksend', {
      body: { recipientPhone: log.recipient_phone, message: log.message, clicksendUsername, clicksendApiKey, clicksendSenderId }
    });
    if (error) { toast.error('Erro ao reenviar SMS'); return; }
    if ((data as any)?.skipped) { toast.error((data as any)?.error || 'Número inválido'); return; }
    await (supabase as any).from('sms_cs_message_log').insert({
      owner_id: session?.user?.id,
      recipient_phone: log.recipient_phone,
      recipient_name: log.recipient_name || '',
      message: log.message,
      status: 'sent',
    });
    toast.success('SMS reenviado!');
    fetchSmsCsLogs();
  };

  const fetchSmsCsScheduled = async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase.from('scheduled_messages').select('*').eq('owner_id', session.user.id).eq('channel', 'sms_cs' as any).order('next_run_at', { ascending: true });
    setSmsCsScheduledList(data || []);
  };

  const saveSmsCsSchedule = async () => {
    if (!session?.user?.id) return;
    if (!smsCsMessage.trim()) { toast.error('Digite a mensagem'); return; }
    if (!smsCsSchedDate) { toast.error('Selecione a data'); return; }
    let targetPhones: { phone: string; name: string }[] = [];
    if (smsCsSourceMode === 'csv') {
      targetPhones = getSelectedExternalPhoneList();
    } else {
      const usersWithPhone = users.filter(u => u.phone && u.phone.replace(/\D/g, '').length >= 10);
      targetPhones = (smsCsTarget === 'all' ? usersWithPhone : users.filter(u => selectedSmsCsPhones.includes(u.phone))).map(u => ({ phone: u.phone, name: u.name }));
    }
    if (targetPhones.length === 0) { toast.error('Nenhum destinatário'); return; }
    setSmsCsSchedSaving(true);
    const [h, m] = smsCsSchedTime.split(':').map(Number);
    const scheduledAt = new Date(smsCsSchedDate);
    scheduledAt.setHours(h, m, 0, 0);
    const rows = targetPhones.map(t => ({
      owner_id: session.user.id,
      message: smsCsMessage,
      recipient_type: 'individual',
      recipient_value: t.phone,
      recipient_label: t.name,
      scheduled_at: scheduledAt.toISOString(),
      next_run_at: scheduledAt.toISOString(),
      recurrence: smsCsSchedRecurrence,
      channel: 'sms_cs',
    }));
    const { error } = await supabase.from('scheduled_messages').insert(rows as any);
    setSmsCsSchedSaving(false);
    if (error) { toast.error('Erro ao agendar'); console.error(error); return; }
    toast.success(`${targetPhones.length} SMS agendado(s)!`);
    setSmsCsScheduleMode(false);
    setSmsCsSchedDate(undefined);
    setSmsCsSchedTime('12:00');
    setSmsCsSchedRecurrence('none');
    fetchSmsCsScheduled();
  };

  const cancelSmsCsSchedule = async (id: string) => {
    await supabase.from('scheduled_messages').update({ status: 'cancelled', updated_at: new Date().toISOString() } as any).eq('id', id);
    toast.success('Agendamento cancelado');
    fetchSmsCsScheduled();
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

  const fetchRecentEmailRecipients = async () => {
    if (!session?.user?.id) return;
    const since2h = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data } = await (supabase as any)
      .from('email_send_log')
      .select('recipient_email, created_at, status')
      .eq('metadata->>owner_id', session.user.id)
      .gte('created_at', since2h)
      .in('status', ['sent', 'pending']);
    const rows = data || [];
    const emails = new Set<string>(rows.map((d: any) => (d.recipient_email || '').toLowerCase()));
    setRecentEmailRecipients(emails);
    if (rows.length > 0) {
      const oldest = rows.reduce((min: string, d: any) => d.created_at < min ? d.created_at : min, rows[0].created_at);
      setRecentEmailOldestTime(new Date(oldest));
    } else {
      setRecentEmailOldestTime(null);
    }
  };

  useEffect(() => {
    if (!excludeRecentEmail || !recentEmailOldestTime) { setRecentEmailCountdown(''); return; }
    const update = () => {
      const expiresAt = recentEmailOldestTime.getTime() + 2 * 60 * 60 * 1000;
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        setRecentEmailCountdown('');
        fetchRecentEmailRecipients();
        return;
      }
      const h = Math.floor(remaining / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setRecentEmailCountdown(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [excludeRecentEmail, recentEmailOldestTime]);


  const [slug, setSlug] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [editingSlug, setEditingSlug] = useState(false);
  const [newSlug, setNewSlug] = useState('');

  const [wheelConfig, setWheelConfig] = useState<WheelConfig>(defaultConfig);
  const [configId, setConfigId] = useState<string | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  // Auto-load BS deposit stats whenever the operator opens the BS deposit tab
  useEffect(() => {
    if (activeTab !== 'deposito' || depositVariant !== 'depbs' || !session?.user?.id) return;
    const sinceIso = (wheelConfig as any)?.depositConfig?.bsLimitsResetAt || null;
    (supabase as any)
      .rpc('get_bs_deposit_stats', { p_owner_id: session.user.id, p_since: sinceIso })
      .then(({ data }: any) => {
        const row = Array.isArray(data) ? data[0] : null;
        setBsDepositStats({ total: Number(row?.total_amount || 0), count: Number(row?.total_count || 0) });
      });
  }, [activeTab, depositVariant, session?.user?.id, (wheelConfig as any)?.depositConfig?.bsLimitsResetAt]);

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

  const syncLegacyIntegrationStorage = (_settings: PersistedDashboardSettings) => {
    // Per-operator credentials (Twilio, Evolution, Panel Casa) are stored ONLY in wheel_configs.
    // Writing them to localStorage previously caused leakage across operators on the same browser.
    // Clear any legacy values left over from before the fix.
    ['twilio_account_sid', 'twilio_auth_token', 'twilio_phone_number',
     'evolution_api_url', 'evolution_api_key', 'evolution_instance',
     'evolution_api_url_2', 'evolution_api_key_2', 'evolution_instance_2',
     PANEL_CASA_STORAGE_KEY].forEach((key) => {
      try { localStorage.removeItem(key); } catch {}
    });
  };

  const buildPersistedDashboardSettings = (): PersistedDashboardSettings => ({
    emailSubject,
    emailBody,
    emailTemplate,
    emailBannerUrl,
    emailSenderName,
    emailSenderEmail,
    smsMessage,
    smsProvider,
    twilioAccountSid,
    twilioAuthToken,
    twilioPhoneNumber,
    mobizonSender,
    smsCsMessage,
    clicksendUsername,
    clicksendApiKey,
    clicksendSenderId,
    whatsappMessage,
    whatsappDelaySeconds,
    evolutionApiUrl,
    evolutionApiKey,
    evolutionInstance,
    evolutionApiUrl2,
    evolutionApiKey2,
    evolutionInstance2,
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
    notifyWhatsappPhones,
    notifyAutoPaymentEnabled,
    notifyReferralEnabled,
    notifyPendingPaymentEnabled,
    notifyDepositEnabled,
    notifyGroupJid,
    notifyGroupName,
    notifySelectedGroups,
    receiptFontColor,
    receiptBgColor,
    receiptAccentColor,
    receiptOperatorName,
    hideReceiptSection,
    hideEdpaySection,
    panelCasaUrl: normalizePanelCasaUrl(panelCasaUrl),
    csvContactGroups: contactGroups,
  });

  const applyPersistedDashboardSettings = (rawSettings?: Partial<PersistedDashboardSettings>) => {
    // IMPORTANT: do NOT fall back to localStorage for per-operator API credentials —
    // localStorage is shared across all operators on the same browser and was the root
    // cause of credentials from one operator leaking into another's Dashboard.
    const settings: PersistedDashboardSettings = {
      ...DEFAULT_PERSISTED_DASHBOARD_SETTINGS,
      ...(rawSettings || {}),
    };

    setEmailSubject(settings.emailSubject);
    setEmailBody(settings.emailBody);
    setEmailTemplate(settings.emailTemplate || 'original');
    setEmailBannerUrl(settings.emailBannerUrl || '');
    setEmailSenderName(settings.emailSenderName || DEFAULT_PERSISTED_DASHBOARD_SETTINGS.emailSenderName);
    setEmailSenderEmail(settings.emailSenderEmail || DEFAULT_PERSISTED_DASHBOARD_SETTINGS.emailSenderEmail);
    setSmsMessage(settings.smsMessage || '');
    setSmsProvider(settings.smsProvider === 'mobizon' ? 'mobizon' : 'twilio');
    setTwilioAccountSid(settings.twilioAccountSid || '');
    setTwilioAuthToken(settings.twilioAuthToken || '');
    setTwilioPhoneNumber(settings.twilioPhoneNumber || '');
    setMobizonSender(settings.mobizonSender || 'MobizonBR');
    setSmsCsMessage(settings.smsCsMessage || '');
    setClicksendUsername(settings.clicksendUsername || '');
    setClicksendApiKey(settings.clicksendApiKey || '');
    setClicksendSenderId(settings.clicksendSenderId || '');
    setWhatsappMessage(settings.whatsappMessage || '');
    setWhatsappDelaySeconds(Number(settings.whatsappDelaySeconds) > 0 ? Number(settings.whatsappDelaySeconds) : 2);
    setEvolutionApiUrl(settings.evolutionApiUrl || '');
    setEvolutionApiKey(settings.evolutionApiKey || '');
    setEvolutionInstance(settings.evolutionInstance || '');
    setEvolutionApiUrl2(settings.evolutionApiUrl2 || '');
    setEvolutionApiKey2(settings.evolutionApiKey2 || '');
    setEvolutionInstance2(settings.evolutionInstance2 || '');
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
    setNotifyWhatsappPhones(Array.isArray(settings.notifyWhatsappPhones) ? settings.notifyWhatsappPhones : (settings.notifyWhatsappPhone ? [settings.notifyWhatsappPhone] : []));
    setNotifyAutoPaymentEnabled(!!settings.notifyAutoPaymentEnabled);
    setNotifyReferralEnabled(!!settings.notifyReferralEnabled);
    setNotifyPendingPaymentEnabled(!!settings.notifyPendingPaymentEnabled);
    setNotifyDepositEnabled(!!settings.notifyDepositEnabled);
    setNotifyGroupJid(settings.notifyGroupJid || '');
    setNotifyGroupName(settings.notifyGroupName || '');
    setNotifySelectedGroups(Array.isArray(settings.notifySelectedGroups) ? settings.notifySelectedGroups : []);
    setReceiptFontColor(settings.receiptFontColor || '#1a1a2e');
    setReceiptBgColor(settings.receiptBgColor || '#ffffff');
    setReceiptAccentColor(settings.receiptAccentColor || '#3b82f6');
    setReceiptOperatorName(settings.receiptOperatorName || '');
    setHideReceiptSection(!!settings.hideReceiptSection);
    setHideEdpaySection(!!settings.hideEdpaySection);
    setPanelCasaUrl(normalizePanelCasaUrl(settings.panelCasaUrl || ''));
    setManualGroups(Array.isArray(settings.csvContactGroups) ? settings.csvContactGroups.filter(Boolean) : []);

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
    setDefaultReferralConfig(rawConfig?.defaultReferralPageConfig || {});
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
    if (savingInFlightRef.current) return;

    configHydratedRef.current = false;
    hydrateDashboardConfig(latest);
    configHydratedRef.current = true;
  };

  useEffect(() => {
    let dataLoaded = false;
    const loadPerms = async (uid: string) => {
      try {
        const [{ data: row }, { data: defaults }] = await Promise.all([
          (supabase as any).from('operator_permissions').select('*').eq('user_id', uid).maybeSingle(),
          (supabase as any).from('operator_permissions_defaults').select('*').eq('id', 1).maybeSingle(),
        ]);
        const src = row || defaults;
        if (src) {
          setToolPerms({
            roleta: src.roleta !== false,
            sms: src.sms !== false,
            sms_mb: src.sms_mb !== false,
            sms_cs: src.sms_cs !== false,
            email: src.email !== false,
            email_brevo: src.email_brevo !== false,
            whatsapp: src.whatsapp !== false,
            financeiro: src.financeiro !== false,
            gorjeta: src.gorjeta !== false,
            referral: src.referral !== false,
            inscritos: src.inscritos !== false,
            auth: src.auth !== false,
            history: src.history !== false,
            analytics: src.analytics !== false,
            msg_analytics: src.msg_analytics !== false,
            notificacoes: src.notificacoes !== false,
            configuracoes: src.configuracoes !== false,
            painel_casa: src.painel_casa !== false,
          });
        }
      } catch {}
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user && !dataLoaded) {
        dataLoaded = true;
        loadData(s.user.id);
        loadPerms(s.user.id);
      } else if (!s) {
        setLoading(false);
      }
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user && !dataLoaded) {
        dataLoaded = true;
        loadData(s.user.id);
        loadPerms(s.user.id);
      } else if (!s) {
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (toolPerms.sms_mb === false && smsProvider === 'mobizon') {
      setSmsProvider('twilio');
    }
  }, [toolPerms.sms_mb, smsProvider]);

  // Realtime subscription for prize_payments updates
  useEffect(() => {
    if (!session?.user?.id) return;
    const channel = supabase
      .channel(`${session.user.id}:prize-payments-realtime`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'prize_payments',
          filter: `owner_id=eq.${session.user.id}`,
        },
        () => {
          fetchPrizePayments();
          fetchPaidHistory();
          fetchGorjetaHistory();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id]);

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
    loadPersistedCsvContacts(userId);
  };

  useEffect(() => {
    if (!session?.user?.id || !configHydratedRef.current || !configId) return;

    const settings = buildPersistedDashboardSettings();
    const serialized = JSON.stringify(settings);
    syncLegacyIntegrationStorage(settings);

    if (serialized === lastPersistedSettingsRef.current) return;

    savingInFlightRef.current = true;

    const timeoutId = window.setTimeout(async () => {
      const latestSettings = buildPersistedDashboardSettings();
      const latestSerialized = JSON.stringify(latestSettings);
      if (latestSerialized === lastPersistedSettingsRef.current) {
        savingInFlightRef.current = false;
        return;
      }

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
      savingInFlightRef.current = false;
    }, 400);

    return () => {
      window.clearTimeout(timeoutId);
      savingInFlightRef.current = false;
    };
  }, [
    session?.user?.id,
    configId,
    emailSubject,
    emailBody,
    emailTemplate,
    emailBannerUrl,
    emailSenderName,
    emailSenderEmail,
    smsMessage,
    smsProvider,
    twilioAccountSid,
    twilioAuthToken,
    twilioPhoneNumber,
    smsCsMessage,
    clicksendUsername,
    clicksendApiKey,
    clicksendSenderId,
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
    notifyWhatsappPhones,
    notifyAutoPaymentEnabled,
    notifyReferralEnabled,
    notifyPendingPaymentEnabled,
    notifyDepositEnabled,
    notifyGroupJid,
    notifyGroupName,
    notifySelectedGroups,
    receiptFontColor,
    receiptBgColor,
    receiptAccentColor,
    receiptOperatorName,
    hideReceiptSection,
    hideEdpaySection,
    panelCasaUrl,
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

  // CSV external contacts state (shared between SMS & WhatsApp)
  const [smsSourceMode, setSmsSourceMode] = useState<'base' | 'csv'>('base');
  const [whatsappSourceMode, setWhatsappSourceMode] = useState<'base' | 'csv'>('base');
  const [csvContacts, setCsvContacts] = useState<{ lead: string; numero: string; group_name: string }[]>([]);
  const [selectedCsvContacts, setSelectedCsvContacts] = useState<string[]>([]);
  const [csvSearchTerm, setCsvSearchTerm] = useState('');
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Group management
  const [contactGroups, setContactGroups] = useState<string[]>([]);
  // Grupos criados manualmente que ainda não possuem contatos (para não desaparecerem ao re-derivar)
  const [manualGroups, setManualGroups] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('__all__');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [importTargetGroup, setImportTargetGroup] = useState('');
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');

  // WhatsApp contacts from Evolution API
  const [waContacts, setWaContacts] = useState<{ lead: string; numero: string }[]>([]);
  const [waContactsLoading, setWaContactsLoading] = useState(false);
  const [selectedWaContacts, setSelectedWaContacts] = useState<string[]>([]);
  const [waContactSearch, setWaContactSearch] = useState('');

  const getSelectedExternalPhoneList = (): { phone: string; name: string }[] => {
    const selectedNumbers = new Set(selectedCsvContacts);
    const sourceContacts: { lead: string; numero: string; group_name?: string }[] = selectedGroup === '__all__'
      ? (() => {
          const merged: { lead: string; numero: string; group_name?: string }[] = [...csvContacts];
          const existingNums = new Set(csvContacts.map(c => c.numero));
          for (const wc of waContacts) {
            if (!existingNums.has(wc.numero)) merged.push({ ...wc, group_name: '' });
          }
          return merged;
        })()
      : csvContacts.filter(c => c.group_name === selectedGroup);

    const uniqueByPhone = new Map<string, { phone: string; name: string }>();
    for (const contact of sourceContacts) {
      if (selectedNumbers.has(contact.numero) && !uniqueByPhone.has(contact.numero)) {
        uniqueByPhone.set(contact.numero, { phone: contact.numero, name: contact.lead || '' });
      }
    }
    return Array.from(uniqueByPhone.values());
  };

  const parseCsvContacts = (file: File): Promise<{ lead: string; numero: string }[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          let text = ((e.target?.result as string) || '').replace(/\u0000/g, '');
          if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
          const lines = text.split(/\r?\n/).filter(l => l.trim());
          if (lines.length === 0) { reject(new Error('CSV vazio')); return; }
          const countSep = (line: string, sep: string) => {
            let count = 0, quoted = false;
            for (let i = 0; i < line.length; i++) {
              if (line[i] === '"') quoted = !quoted;
              else if (!quoted && line[i] === sep) count++;
            }
            return count;
          };
          const sep = [',', ';', '\t', '|'].sort((a, b) => lines.slice(0, 5).reduce((n, l) => n + countSep(l, b), 0) - lines.slice(0, 5).reduce((n, l) => n + countSep(l, a), 0))[0];
          const splitCsvLine = (line: string) => {
            const out: string[] = [];
            let cur = '', quoted = false;
            for (let i = 0; i < line.length; i++) {
              const ch = line[i];
              if (ch === '"') {
                if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
                else quoted = !quoted;
              } else if (!quoted && ch === sep) { out.push(cur.trim()); cur = ''; }
              else cur += ch;
            }
            out.push(cur.trim());
            return out.map(c => c.replace(/^["'\s]+|["'\s]+$/g, ''));
          };
          const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/^["'\s]+|["'\s]+$/g, '').trim();
          const compact = (s: string) => normalize(s).replace(/[\s_\-().]/g, '');
          const phoneDigits = (s: string) => (s || '').replace(/\D/g, '');
          const rows = lines.map(splitCsvLine);
          const header = (rows[0] || []).map(compact);
          const phoneHeader = (h: string) => ['numero', 'numeros', 'telefone', 'telefones', 'celular', 'celulares', 'whatsapp', 'whats', 'zap', 'phone', 'phones', 'mobile', 'tel'].some(k => h === k || h.includes(k));
          const nameHeader = (h: string) => ['lead', 'nome', 'name', 'contato', 'cliente', 'customer'].some(k => h === k || h.includes(k));
          let numIdx = header.findIndex(phoneHeader);
          let leadIdx = header.findIndex(nameHeader);
          const hasHeader = numIdx >= 0 || leadIdx >= 0 || (rows[0] || []).every(c => phoneDigits(c).length < 10);
          if (numIdx === -1) {
            const colCount = Math.max(...rows.map(r => r.length));
            let bestIdx = -1, bestScore = 0;
            for (let c = 0; c < colCount; c++) {
              const score = rows.slice(hasHeader ? 1 : 0).reduce((acc, row) => acc + (phoneDigits(row[c] || '').length >= 10 ? 1 : 0), 0);
              if (score > bestScore) { bestScore = score; bestIdx = c; }
            }
            if (bestIdx === -1) { reject(new Error('Nenhum telefone com 10 ou mais dígitos foi encontrado no CSV.')); return; }
            numIdx = bestIdx;
          }
          const contacts: { lead: string; numero: string }[] = [];
          for (let i = hasHeader ? 1 : 0; i < rows.length; i++) {
            const cols = rows[i];
            const numero = phoneDigits(cols[numIdx] || '');
            if (numero.length >= 10) {
              contacts.push({ lead: leadIdx >= 0 ? (cols[leadIdx] || '') : '', numero });
            }
          }
          if (contacts.length === 0) { reject(new Error('Nenhum telefone com 10 ou mais dígitos foi encontrado no CSV.')); return; }
          resolve(contacts);
        } catch (err) { reject(err); }
      };
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsText(file, 'UTF-8');
    });
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const contacts = await parseCsvContacts(file);
      if (contacts.length === 0) { toast.error('Nenhum contato válido encontrado no CSV'); return; }
      const groupName = importTargetGroup || '';
      setCsvContacts(prev => {
        const existingKeys = new Set(prev.map(c => `${c.numero}__${c.group_name}`));
        const newOnes = contacts.filter(c => !existingKeys.has(`${c.numero}__${groupName}`)).map(c => ({ ...c, group_name: groupName }));
        return [...prev, ...newOnes];
      });
      setSelectedCsvContacts(prev => [...new Set([...prev, ...contacts.map(c => c.numero)])]);
      if (session?.user?.id) {
        const rows = contacts.map(c => ({ owner_id: session.user.id, lead: c.lead, numero: c.numero, group_name: groupName }));
        const BATCH = 500;
        for (let i = 0; i < rows.length; i += BATCH) {
          const { error: upErr } = await (supabase as any).from('imported_contacts').upsert(rows.slice(i, i + BATCH), { onConflict: 'owner_id,numero,group_name', ignoreDuplicates: true });
          if (upErr) { console.error('Erro ao salvar contatos:', upErr); toast.error(`Erro ao salvar no banco: ${upErr.message}`); break; }
        }
      }
      if (groupName) setSelectedGroup(groupName);
      toast.success(`${contacts.length} contato(s) importado(s)${groupName ? ` no grupo "${groupName}"` : ''}`);
    } catch (err: any) { toast.error(err.message || 'Erro ao importar CSV'); }
    if (csvInputRef.current) csvInputRef.current.value = '';
  };

  const loadPersistedCsvContacts = async (userId: string) => {
    let allData: any[] = [];
    const PAGE = 1000;
    let from = 0;
    while (true) {
      const { data } = await (supabase as any).from('imported_contacts').select('lead, numero, group_name').eq('owner_id', userId).order('created_at', { ascending: true }).range(from, from + PAGE - 1);
      if (!data || data.length === 0) break;
      allData = allData.concat(data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    if (allData.length > 0) {
      setCsvContacts(allData.map((c: any) => ({ lead: c.lead, numero: c.numero, group_name: c.group_name || '' })));
      setSelectedCsvContacts(allData.map((c: any) => c.numero));
    }
  };

  const clearPersistedCsvContacts = async (groupToClear?: string) => {
    if (groupToClear && groupToClear !== '__all__') {
      setCsvContacts(prev => prev.filter(c => c.group_name !== groupToClear));
      setSelectedCsvContacts(prev => {
        const numsInGroup = new Set(csvContacts.filter(c => c.group_name === groupToClear).map(c => c.numero));
        return prev.filter(n => !numsInGroup.has(n));
      });
      if (session?.user?.id) {
        await (supabase as any).from('imported_contacts').delete().eq('owner_id', session.user.id).eq('group_name', groupToClear);
      }
      if (selectedGroup === groupToClear) setSelectedGroup('__all__');
      toast.success(`Grupo "${groupToClear}" removido`);
    } else {
      setCsvContacts([]);
      setSelectedCsvContacts([]);
      if (session?.user?.id) {
        await (supabase as any).from('imported_contacts').delete().eq('owner_id', session.user.id);
      }
      toast.success('Todos os contatos importados removidos');
    }
  };

  const handleCreateGroup = () => {
    const name = newGroupName.trim();
    if (!name) { toast.error('Digite um nome para o grupo'); return; }
    if (contactGroups.includes(name)) { toast.error('Grupo já existe'); return; }
    setManualGroups(prev => prev.includes(name) ? prev : [...prev, name]);
    setContactGroups(prev => prev.includes(name) ? prev : [...prev, name]);
    setImportTargetGroup(name);
    setSelectedGroup(name);
    setNewGroupName('');
    setShowCreateGroup(false);
    toast.success(`Grupo "${name}" criado. Importe um CSV para adicionar contatos.`);
  };

  const handleRenameGroup = async (oldName: string) => {
    const newName = editingGroupName.trim();
    if (!newName) { toast.error('Digite um nome'); return; }
    if (newName === oldName) { setEditingGroup(null); return; }
    if (contactGroups.includes(newName)) { toast.error('Grupo já existe'); return; }
    setCsvContacts(prev => prev.map(c => c.group_name === oldName ? { ...c, group_name: newName } : c));
    setManualGroups(prev => prev.map(g => g === oldName ? newName : g));
    if (selectedGroup === oldName) setSelectedGroup(newName);
    if (importTargetGroup === oldName) setImportTargetGroup(newName);
    if (session?.user?.id) {
      await (supabase as any).from('imported_contacts').update({ group_name: newName }).eq('owner_id', session.user.id).eq('group_name', oldName);
    }
    setEditingGroup(null);
    toast.success(`Grupo renomeado para "${newName}"`);
  };

  const handleDeleteGroup = async (groupName: string) => {
    setCsvContacts(prev => prev.filter(c => c.group_name !== groupName));
    setManualGroups(prev => prev.filter(g => g !== groupName));
    setSelectedCsvContacts(prev => {
      const numsInGroup = new Set(csvContacts.filter(c => c.group_name === groupName).map(c => c.numero));
      return prev.filter(n => !numsInGroup.has(n));
    });
    if (session?.user?.id) {
      await (supabase as any).from('imported_contacts').delete().eq('owner_id', session.user.id).eq('group_name', groupName);
    }
    if (selectedGroup === groupName) setSelectedGroup('__all__');
    toast.success(`Grupo "${groupName}" removido`);
  };

  const fetchWaContacts = async () => {
    if (!evolutionApiUrl || !evolutionApiKey || !evolutionInstance) { toast.error('Configure a Evolution API primeiro'); return; }
    setWaContactsLoading(true);
    try {
      const baseUrl = evolutionApiUrl.replace(/\/+$/, '').replace(/\/manager$/i, '');
      const res = await fetch(`${baseUrl}/chat/findContacts/${evolutionInstance}`, {
        method: 'POST',
        headers: { 'apikey': evolutionApiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ where: {} }),
      });
      if (!res.ok) throw new Error('Erro ao buscar contatos');
      const data = await res.json();
      const contacts: { lead: string; numero: string }[] = [];
      for (const c of (Array.isArray(data) ? data : [])) {
        const jid = c.id || c.remoteJid || '';
        if (!jid || jid.includes('@g.us') || jid.includes('@broadcast')) continue;
        const numero = jid.replace('@s.whatsapp.net', '').replace(/\D/g, '');
        if (numero.length >= 10) {
          contacts.push({ lead: c.pushName || c.name || c.notify || '', numero });
        }
      }
      setWaContacts(contacts);
      toast.success(`${contacts.length} contato(s) encontrado(s) no WhatsApp`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao buscar contatos');
    }
    setWaContactsLoading(false);
  };

  // Derive groups from contacts (mesclando os grupos criados manualmente, mesmo sem contatos)
  useEffect(() => {
    const fromContacts = csvContacts.map(c => c.group_name).filter(g => g);
    const groups = [...new Set([...fromContacts, ...manualGroups])];
    setContactGroups(groups);
  }, [csvContacts, manualGroups]);

  useEffect(() => {
    if (!session?.user?.id || !configHydratedRef.current || !configId) return;
    const groups = contactGroups.filter(Boolean);
    const timeoutId = window.setTimeout(async () => {
      const { data: dbRow } = await (supabase as any).from('wheel_configs').select('config').eq('id', configId).maybeSingle();
      const dbConfig = dbRow?.config || {};
      await (supabase as any).from('wheel_configs').update({
        config: { ...dbConfig, dashboardSettings: { ...(dbConfig.dashboardSettings || {}), csvContactGroups: groups } },
        updated_at: new Date().toISOString(),
      }).eq('id', configId);
    }, 400);
    return () => window.clearTimeout(timeoutId);
  }, [session?.user?.id, configId, contactGroups]);
  

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

  const handleToggleQualified = async (user: WheelUser) => {
    const newType = user.user_type === 'qualified' ? '' : 'qualified';
    const { error } = await (supabase as any)
      .from('wheel_users')
      .update({ user_type: newType })
      .eq('id', user.id);
    if (error) { toast.error('Erro ao atualizar status'); return; }
    toast.success(newType === 'qualified' ? '✅ Jogador qualificado!' : 'Status removido');
    fetchUsers();
  };

  const handleToggleBlacklist = async (user: WheelUser) => {
    const newVal = !user.blacklisted;
    const { error } = await (supabase as any).from('wheel_users').update({ blacklisted: newVal }).eq('id', user.id);
    if (error) { toast.error('Erro ao atualizar blacklist'); return; }
    toast.success(newVal ? '🚫 Usuário na blacklist (shadowban)' : 'Blacklist removida');
    fetchUsers();
  };

  const handleToggleGuaranteedWin = async (user: WheelUser) => {
    const newVal = !user.guaranteed_next_win;
    const { error } = await (supabase as any).from('wheel_users').update({ guaranteed_next_win: newVal }).eq('id', user.id);
    if (error) { toast.error('Erro ao atualizar sorteio garantido'); return; }
    toast.success(newVal ? '⭐ Usuário será sorteado 100% no próximo sorteio' : 'Sorteio garantido removido');
    fetchUsers();
  };

  const fetchPaidHistory = async () => {
    if (!session?.user?.id) return;
    setPaidHistoryLoading(true);
    const { data } = await (supabase as any)
      .from('prize_payments')
      .select('*')
      .eq('owner_id', session.user.id)
      .in('status', ['paid', 'rejected', 'processing'])
      .order('created_at', { ascending: false });
    setPaidHistory(data || []);
    setPaidHistoryLoading(false);
  };

  const openReceipt = async (payment: any) => {
    setReceiptPayment(payment);
    setReceiptMeta(null);
    setReceiptLoading(true);
    if (payment.edpay_transaction_id) {
      const { data } = await (supabase as any)
        .from('edpay_transactions')
        .select('metadata')
        .eq('edpay_id', payment.edpay_transaction_id)
        .maybeSingle();
      setReceiptMeta(data?.metadata || null);
    }
    setReceiptLoading(false);
  };

  const fetchDepositHistory = async () => {
    if (!session?.user?.id) return;
    setDepositHistoryLoading(true);
    const { data } = await (supabase as any)
      .from('edpay_transactions')
      .select('*')
      .eq('owner_id', session.user.id)
      .eq('type', 'deposit_public')
      .order('created_at', { ascending: false })
      .limit(200);
    setDepositHistory(data || []);
    setDepositHistoryLoading(false);
  };

  const fetchPrizePayments = async () => {
    if (!session?.user?.id) return;
    setPrizePaymentsLoading(true);
    const { data } = await (supabase as any)
      .from('prize_payments')
      .select('*')
      .eq('owner_id', session.user.id)
      .in('status', ['pending', 'auto_pending', 'approved', 'failed', 'processing'])
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

  const handleBulkReject = async () => {
    if (selectedPrizeIds.size === 0) { toast.error('Selecione ao menos um prêmio'); return; }
    const ids = Array.from(selectedPrizeIds);
    await (supabase as any).from('prize_payments').update({ status: 'rejected', updated_at: new Date().toISOString() }).in('id', ids);
    toast.success(`${ids.length} prêmio(s) rejeitado(s)`);
    setSelectedPrizeIds(new Set());
    fetchPrizePayments();
  };

  const handleBulkPay = async () => {
    if (selectedPrizeIds.size === 0) { toast.error('Selecione ao menos um prêmio'); return; }
    if (!edpayPublicKey || !edpaySecretKey) { toast.error('Configure as credenciais EdPay'); return; }
    setBulkPaying(true);
    const ids = Array.from(selectedPrizeIds);
    let ok = 0, fail = 0;
    for (const id of ids) {
      try {
        const { data, error } = await supabase.functions.invoke('edpay-pix-transfer', { body: { paymentId: id, edpayPublicKey, edpaySecretKey } });
        if (error || data?.error) { fail++; } else { ok++; }
      } catch { fail++; }
    }
    toast.success(`${ok} pago(s)${fail > 0 ? `, ${fail} falha(s)` : ''}`);
    setSelectedPrizeIds(new Set());
    setBulkPaying(false);
    fetchPrizePayments();
  };

  const fetchWhatsappLogs2 = async () => {
    if (!session?.user?.id) return;
    setWhatsappLogsLoading2(true);
    const { data } = await (supabase as any)
      .from('whatsapp2_message_log')
      .select('*')
      .eq('owner_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setWhatsappLogs2(data || []);
    setWhatsappLogsLoading2(false);
  };
  const handleGrantSpin = async (user: WheelUser) => {
    // Open modal to choose prize
    setGrantSpinUser(user);
    setGrantSpinMode('random');
    setGrantSpinSegment(0);
    setGrantSpinCount(1);
  };

  const handleRemoveSpins = async (user: WheelUser) => {
    if (user.spins_available < 1) {
      toast.error(`${user.name} não possui giros para remover`);
      return;
    }
    const ok = await confirmDialog({
      title: 'Remover giros',
      message: `Remover todos os ${user.spins_available} giro(s) de ${user.name}?`,
      confirmLabel: 'Remover',
      variant: 'danger',
    });
    if (!ok) return;
    const { error } = await (supabase as any).from('wheel_users').update({ spins_available: 0, fixed_prize_enabled: false, fixed_prize_segment: null }).eq('id', user.id);
    if (error) { toast.error('Erro ao remover giros'); return; }
    toast.success(`Giros removidos de ${user.name}`);
    fetchUsers();
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
    const expMinutes = (wheelConfig as any).spinExpirationMinutes ?? 0;
    const expireAt = expMinutes > 0 ? new Date(Date.now() + expMinutes * 60000).toISOString() : null;
    const { error } = await (supabase as any).from('wheel_users').update({
      spins_available: count,
      fixed_prize_enabled: isFixed,
      fixed_prize_segment: isFixed ? grantSpinSegment : null,
      spins_expire_at: expireAt,
    }).eq('id', grantSpinUser.id);
    if (error) { toast.error('Erro ao liberar giro'); return; }
    toast.success(`${count} giro(s) liberado(s) para ${grantSpinUser.name}!${expMinutes > 0 ? ` Expira em ${expMinutes}min.` : ''}`);
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
    const expMinutes = (wheelConfig as any).spinExpirationMinutes ?? 0;
    const expireAt = expMinutes > 0 ? new Date(Date.now() + expMinutes * 60000).toISOString() : null;
    const selectedUsers = users.filter(u => selectedUserIds.has(u.id));
    let success = 0;
    for (const user of selectedUsers) {
      const { error } = await (supabase as any).from('wheel_users').update({
        spins_available: count,
        fixed_prize_enabled: isFixed,
        fixed_prize_segment: isFixed ? batchGrantSegment : null,
        spins_expire_at: expireAt,
      }).eq('id', user.id);
      if (!error) {
        success++;
        if (batchWhatsappEnabled) {
          await sendSpinWhatsapp(user, count, batchWhatsappTemplate, batchWhatsappCustomMsg);
        }
      }
    }
    toast.success(`${success} inscrito(s) receberam ${count} giro(s)!${expMinutes > 0 ? ` Expira em ${expMinutes}min.` : ''}`);
    if (batchWhatsappEnabled) toast.info(`📱 WhatsApp enviado para ${success} inscrito(s)`);
    setShowBatchGrantModal(false);
    setSelectedUserIds(new Set());
    fetchUsers();
  };

  const handleClearHistory = async () => {
    if (!await confirmDialog({ title: 'Limpar Histórico', message: 'Tem certeza que deseja limpar todo o histórico de sorteio? Esta ação é irreversível.', variant: 'danger', confirmLabel: 'Limpar' })) return;
    const uid = session?.user?.id;
    if (!uid) return;
    const { error } = await (supabase as any).from('spin_results').delete().eq('owner_id', uid);
    if (error) { toast.error('Erro ao limpar histórico'); return; }
    toast.success('Histórico limpo!');
    setSpinResults([]);
  };

  const handleClearAnalytics = async () => {
    if (!await confirmDialog({ title: 'Limpar Analytics', message: 'Tem certeza que deseja limpar todo o histórico de analytics? Esta ação é irreversível.', variant: 'danger', confirmLabel: 'Limpar' })) return;
    const uid = session?.user?.id;
    if (!uid) return;
    const { error } = await (supabase as any).from('page_views').delete().eq('owner_id', uid);
    if (error) { toast.error('Erro ao limpar analytics'); return; }
    toast.success('Analytics limpo!');
    setPageViews([]);
  };

  const handleDeleteUser = async (id: string) => {
    if (!await confirmDialog({ title: 'Excluir Usuário', message: 'Tem certeza que deseja excluir este usuário?', variant: 'danger', confirmLabel: 'Excluir' })) return;
    await (supabase as any).from('wheel_users').delete().eq('id', id);
    toast.success('Excluído!');
    fetchUsers();
  };

  const handleDeleteSelectedUsers = async () => {
    if (selectedUserIds.size === 0) return;
    if (!await confirmDialog({ title: 'Excluir Selecionados', message: `Tem certeza que deseja excluir ${selectedUserIds.size} inscrito(s) selecionado(s)?`, variant: 'danger', confirmLabel: 'Excluir' })) return;
    const ids = Array.from(selectedUserIds);
    const { error } = await (supabase as any).from('wheel_users').delete().in('id', ids);
    if (error) { toast.error('Erro ao excluir inscritos'); return; }
    toast.success(`${ids.length} inscrito(s) excluído(s)!`);
    setSelectedUserIds(new Set());
    fetchUsers();
  };
  const handleRemoveSpinsSelected = async () => {
    if (selectedUserIds.size === 0) return;
    const withSpins = users.filter(u => selectedUserIds.has(u.id) && u.spins_available >= 1);
    if (withSpins.length === 0) { toast.error('Nenhum selecionado possui giros'); return; }
    if (!await confirmDialog({ title: 'Tirar Giros', message: `Remover todos os giros de ${withSpins.length} inscrito(s)?`, variant: 'danger', confirmLabel: 'Remover' })) return;
    const { error } = await (supabase as any).from('wheel_users').update({ spins_available: 0, fixed_prize_enabled: false, fixed_prize_segment: null }).in('id', withSpins.map(u => u.id));
    if (error) { toast.error('Erro ao remover giros'); return; }
    toast.success(`Giros removidos de ${withSpins.length} inscrito(s)!`);
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
      : spinsFilter === 'qualified' ? u.user_type === 'qualified'
      : spinsFilter === 'duplicados' ? (() => {
          const emailCount = users.filter(o => o.email && o.email.toLowerCase() === u.email.toLowerCase()).length;
          const idCount = users.filter(o => o.account_id === u.account_id).length;
          const nameCount = u.name ? users.filter(o => o.name && o.name.toLowerCase().trim() === u.name.toLowerCase().trim()).length : 0;
          return emailCount > 1 || idCount > 1 || nameCount > 1;
        })()
      : spinsFilter === 'blacklist' ? !!u.blacklisted
      : spinsFilter === 'guaranteed' ? !!u.guaranteed_next_win
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

  const allMenuItems: { key: typeof activeTab; icon: React.ReactNode; label: string; tool?: 'roleta' | 'sms' | 'sms_cs' | 'email' | 'email_brevo' | 'whatsapp' | 'whatsapp2' | 'financeiro' | 'gorjeta' | 'referral' | 'inscritos' | 'auth' | 'history' | 'analytics' | 'msg_analytics' | 'notificacoes' | 'configuracoes' | 'painel_casa' | 'batalha_slot' }[] = [
    { key: 'inscritos', icon: <Users size={20} />, label: 'Inscritos', tool: 'inscritos' },
    { key: 'wheel', icon: <Target size={20} />, label: 'Roleta', tool: 'roleta' },
    { key: 'batalha_slot', icon: <Swords size={20} />, label: 'Batalha Slot', tool: 'batalha_slot' },
    { key: 'auth', icon: <Shield size={20} />, label: 'Login', tool: 'auth' },
    { key: 'history', icon: <Trophy size={20} />, label: 'Histórico', tool: 'history' },
    { key: 'analytics', icon: <BarChart3 size={20} />, label: 'Analytics', tool: 'analytics' },
    { key: 'email', icon: <Mail size={20} />, label: 'Email', tool: 'email' },
    { key: 'email_brevo', icon: <Mail size={20} />, label: 'Email API (Brevo)', tool: 'email_brevo' },
    { key: 'sms', icon: <Smartphone size={20} />, label: 'SMS', tool: 'sms' },
    { key: 'sms_cs', icon: <Smartphone size={20} />, label: 'SMS API (CS)', tool: 'sms_cs' },
    { key: 'whatsapp', icon: <MessageCircle size={20} />, label: 'WhatsApp', tool: 'whatsapp' },
    { key: 'whatsapp2', icon: <MessageCircle size={20} />, label: 'WhatsApp 2', tool: 'whatsapp2' },
    { key: 'msg_analytics', icon: <BarChart3 size={20} />, label: 'Analytics Msg', tool: 'msg_analytics' },
    { key: 'financeiro', icon: <Wallet size={20} />, label: 'Financeiro', tool: 'financeiro' },
    { key: 'notificacoes', icon: <Bell size={20} />, label: 'Notificações', tool: 'notificacoes' },
    { key: 'referral', icon: <Link2 size={20} />, label: 'Links Ref.', tool: 'referral' },
    { key: 'gorjeta', icon: <Gift size={20} />, label: 'Gorjeta', tool: 'gorjeta' },
    { key: 'hist_gorjeta', icon: <Clock size={20} />, label: 'Hist. Gorjeta', tool: 'gorjeta' },
    { key: 'deposito', icon: <DollarSign size={20} />, label: 'Depósito', tool: 'financeiro' },
    { key: 'hist_deposito', icon: <Clock size={20} />, label: 'Hist. Depósito', tool: 'financeiro' },
    { key: 'configuracoes', icon: <Settings size={20} />, label: 'Configurações', tool: 'configuracoes' },
    { key: 'painel_casa', icon: <Monitor size={20} />, label: 'Painel da Casa', tool: 'painel_casa' },
  ];
  const menuItems = allMenuItems.filter(it => !it.tool || toolPerms[it.tool] !== false);

  // ═══ MENU GROUPS ═══
  type GroupKey = 'operacao' | 'disparos' | 'crescimento' | 'sistema';
  const groupDefs: { key: GroupKey; label: string; itemKeys: typeof activeTab[] }[] = [
    { key: 'operacao', label: 'Operação', itemKeys: ['inscritos', 'wheel', 'batalha_slot', 'auth', 'history'] },
    { key: 'disparos', label: 'Disparos', itemKeys: ['email', 'email_brevo', 'sms', 'sms_cs', 'whatsapp', 'whatsapp2', 'msg_analytics'] },
    { key: 'crescimento', label: 'Crescimento', itemKeys: ['referral', 'gorjeta', 'hist_gorjeta', 'deposito', 'hist_deposito'] },
    { key: 'sistema', label: 'Sistema', itemKeys: ['analytics', 'financeiro', 'notificacoes', 'configuracoes'] },
  ];
  const menuGroups = groupDefs
    .map(g => ({ ...g, items: g.itemKeys.map(k => menuItems.find(i => i.key === k)).filter(Boolean) as typeof menuItems }))
    .filter(g => g.items.length > 0);
  const standaloneItems = menuItems.filter(i => i.key === 'painel_casa');

  const activeGroupKey: GroupKey | null =
    menuGroups.find(g => g.items.some(i => i.key === activeTab))?.key ?? null;
  const isGroupOpen = (k: GroupKey) =>
    openGroupsRaw[k] !== undefined ? openGroupsRaw[k] : k === activeGroupKey;
  const toggleGroup = (k: GroupKey) =>
    setOpenGroupsRaw(prev => ({ ...prev, [k]: !isGroupOpen(k) }));

  const handleMenuClick = (key: typeof activeTab) => {
    setActiveTab(key);
    if (key === 'history') fetchHistory();
    if (key === 'analytics') fetchAnalytics();
    if (key === 'referral') fetchReferralLinks();
    if (key === 'hist_gorjeta') fetchGorjetaHistory();
  };

  const tabTitles: Record<string, string> = {
    inscritos: 'Inscritos',
    wheel: 'Configuração da Roleta',
    batalha_slot: 'Batalha Slot',
    auth: 'Página de Login',
    history: 'Histórico de Prêmios',
    analytics: 'Web Analytics',
    email: 'Disparo de Email',
    email_brevo: 'Disparo em Massa (Brevo API)',
    sms: 'Disparo de SMS',
    sms_cs: 'Disparo de SMS API (ClickSend)',
    whatsapp: 'Disparo de WhatsApp',
    whatsapp2: 'Disparo de WhatsApp 2',
    financeiro: 'Financeiro',
    notificacoes: 'Notificações',
    referral: 'Links de Referência',
    gorjeta: 'Página de Gorjeta',
    hist_gorjeta: 'Histórico de Gorjetas',
    configuracoes: 'Configurações',
    deposito: 'Página de Depósito',
    hist_deposito: 'Histórico de Depósitos',
    painel_casa: 'Painel da Casa',
    msg_analytics: 'Analytics de Mensagens',
  };

  return (
    <div className="min-h-screen bg-background flex relative overflow-x-hidden overflow-y-auto">
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
          <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
            {menuGroups.map(group => {
              const open = isGroupOpen(group.key);
              const groupHasActive = group.items.some(i => i.key === activeTab);
              return (
                <div key={group.key} className="space-y-0.5">
                  {!sidebarCollapsed && (
                    <button
                      onClick={() => toggleGroup(group.key)}
                      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all ${
                        groupHasActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span>{group.label}</span>
                      <ChevronRight size={12} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
                    </button>
                  )}
                  {(open || sidebarCollapsed) && group.items.map(item => (
                    <button
                      key={item.key}
                      onClick={() => handleMenuClick(item.key)}
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
                </div>
              );
            })}
            {standaloneItems.map(item => (
              <button
                key={item.key}
                onClick={() => handleMenuClick(item.key)}
                title={sidebarCollapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 rounded-xl text-sm transition-all duration-200 group relative mt-2 ${sidebarCollapsed ? 'justify-center px-0 py-3' : 'px-4 py-2.5'} ${
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
          <div className="px-3 pb-2.5 space-y-2 max-h-[60vh] overflow-y-auto">
            {menuGroups.map(group => {
              const open = isGroupOpen(group.key);
              const groupHasActive = group.items.some(i => i.key === activeTab);
              return (
                <div key={group.key}>
                  <button
                    onClick={() => toggleGroup(group.key)}
                    className={`w-full flex items-center justify-between px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition-all ${
                      groupHasActive ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    <span>{group.label}</span>
                    <ChevronRight size={12} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
                  </button>
                  {open && (
                    <div className="flex gap-1 overflow-x-auto [touch-action:pan-x] pb-1" style={{ scrollbarWidth: 'none' }}>
                      {group.items.map(item => (
                        <button
                          key={item.key}
                          onClick={() => handleMenuClick(item.key)}
                          className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
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
                  )}
                </div>
              );
            })}
            {standaloneItems.length > 0 && (
              <div className="flex gap-1 overflow-x-auto pb-1 pt-1 border-t border-white/[0.06]" style={{ scrollbarWidth: 'none' }}>
                {standaloneItems.map(item => (
                  <button
                    key={item.key}
                    onClick={() => handleMenuClick(item.key)}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
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
            )}
          </div>
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className={`flex-1 min-w-0 pt-28 lg:pt-0 p-3 md:p-4 transition-all duration-500 relative z-10 ${sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-[260px]'}`}>
        <div className="w-full max-w-[1600px] min-w-0 mx-auto lg:py-4 space-y-4">

          {/* Page title bar */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground">{tabTitles[activeTab]}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{users.length} inscritos • {spinResults.length} giros realizados</p>
            </div>
          </div>

          {/* Slug / link — hidden when roleta permission is disabled */}
          {toolPerms.roleta !== false && (
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
          )}

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
                  { value: 'qualified' as const, label: '✅ Qualificados' },
                  { value: 'duplicados' as const, label: '🔁 Duplicados' },
                  { value: 'blacklist' as const, label: '🚫 Blacklist' },
                  { value: 'guaranteed' as const, label: '⭐ Sorteio 100%' },
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
                    {opt.value === 'qualified' && ` (${users.filter(u => u.user_type === 'qualified').length})`}
                    {opt.value === 'duplicados' && ` (${(() => {
                      const emailMap = new Map<string, number>();
                      const idMap = new Map<string, number>();
                      users.forEach(u => {
                        if (u.email) emailMap.set(u.email.toLowerCase(), (emailMap.get(u.email.toLowerCase()) || 0) + 1);
                        idMap.set(u.account_id, (idMap.get(u.account_id) || 0) + 1);
                      });
                      return users.filter(u => (emailMap.get(u.email.toLowerCase()) || 0) > 1 || (idMap.get(u.account_id) || 0) > 1).length;
                    })()})`}
                    {opt.value === 'blacklist' && ` (${users.filter(u => u.blacklisted).length})`}
                    {opt.value === 'guaranteed' && ` (${users.filter(u => u.guaranteed_next_win).length})`}
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
                        onClick={handleRemoveSpinsSelected}
                        className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold hover:bg-amber-500/30 transition"
                      >
                        <Minus size={12} className="inline mr-1" />
                        Tirar Giros
                      </button>
                      <button
                        onClick={() => setSelectedUserIds(new Set())}
                        className="px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] text-muted-foreground text-xs hover:bg-white/[0.08] transition"
                      >
                        Limpar seleção
                      </button>
                    </div>
                  )}
                  <div className="hidden lg:block">
                  <table className="w-full text-sm">
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
                        <th className="text-left px-2 py-3 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Nome</th>
                        <th className="text-left px-2 py-3 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Email</th>
                        <th className="text-left px-2 py-3 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Celular</th>
                        <th className="text-left px-2 py-3 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Acc ID</th>
                        <th className="text-left px-2 py-3 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">PIX</th>
                        <th className="text-left px-2 py-3 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Chave</th>
                        <th className="text-left px-2 py-3 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Data</th>
                        {spinsFilter === 'with' && (
                          <th className="text-left px-2 py-3 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Prêmio</th>
                        )}
                        <th className="text-center px-2 py-3 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider w-10">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user, index) => (
                        <tr key={user.id} className={`border-t border-white/[0.04] hover:bg-white/[0.03] transition-colors group ${selectedUserIds.has(user.id) ? 'bg-primary/[0.04]' : ''} ${user.blacklisted ? 'bg-red-500/[0.06]' : ''} ${user.guaranteed_next_win ? 'bg-emerald-500/[0.06]' : ''}`}>
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
                          <td className="px-2 py-2 font-medium text-xs whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              {user.blacklisted && <Ban size={12} className="text-destructive flex-shrink-0" />}
                              {user.guaranteed_next_win && <Star size={12} className="text-emerald-400 flex-shrink-0" />}
                              <span className={`truncate max-w-[140px] ${user.blacklisted ? 'line-through opacity-50 text-destructive' : 'text-foreground'}`}>
                                {user.user_type === 'qualified' && <span title="Qualificado">✅ </span>}
                                {user.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-2 py-2 text-muted-foreground text-[11px] truncate max-w-[160px]">{user.email}</td>
                          <td className="px-2 py-2 text-muted-foreground text-[11px] whitespace-nowrap">{user.phone}</td>
                          <td className="px-2 py-2 font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <span>{user.account_id}</span>
                              <button onClick={() => { navigator.clipboard.writeText(user.account_id); toast.success('ID copiado!'); }} className="p-0.5 rounded hover:bg-white/[0.08] transition text-muted-foreground hover:text-foreground" title="Copiar ID">
                                <Copy size={11} />
                              </button>
                            </div>
                          </td>
                          <td className="px-2 py-2 text-muted-foreground text-[11px] whitespace-nowrap">{user.pix_key_type || '—'}</td>
                          <td className="px-2 py-2 text-muted-foreground text-[11px] truncate max-w-[140px]">{user.pix_key || '—'}</td>
                          <td className="px-2 py-2 text-muted-foreground text-[11px] whitespace-nowrap">{user.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : '—'}</td>
                          {spinsFilter === 'with' && (
                            <td className="px-2 py-2">
                              {user.fixed_prize_enabled && user.fixed_prize_segment != null && wheelConfig.segments[user.fixed_prize_segment] ? (
                                <span className="text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-md inline-block truncate max-w-[100px]">
                                  🎯 {wheelConfig.segments[user.fixed_prize_segment].title}
                                </span>
                              ) : (
                                <span className="text-[10px] text-muted-foreground/60 italic">Aleatório</span>
                              )}
                            </td>
                          )}
                          <td className="px-2 py-2 align-middle">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleToggleBlacklist(user)}
                                title={user.blacklisted ? 'Remover blacklist' : 'Blacklist'}
                                className={`p-1.5 rounded-md transition ${user.blacklisted ? 'bg-destructive/20 text-destructive' : 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive'}`}
                              >
                                <Ban size={14} />
                              </button>
                              <button
                                onClick={() => handleToggleGuaranteedWin(user)}
                                title={user.guaranteed_next_win ? 'Remover garantido' : 'Próx. rodada'}
                                className={`p-1.5 rounded-md transition ${user.guaranteed_next_win ? 'bg-emerald-500/20 text-emerald-400' : 'text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-400'}`}
                              >
                                <Star size={14} />
                              </button>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="p-1.5 rounded-md hover:bg-white/[0.08] transition text-muted-foreground hover:text-foreground">
                                    <Settings size={14} />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent align="end" className="w-44 p-1.5 bg-card border border-white/[0.08] shadow-xl" sideOffset={4}>
                                  <div className="flex flex-col gap-0.5">
                                    <button
                                      onClick={() => handleGrantSpin(user)}
                                      className="flex items-center gap-2 px-3 py-2 rounded-md text-xs hover:bg-white/[0.06] transition text-left w-full"
                                    >
                                      <RotateCcw size={13} className="text-primary" />
                                      <span>{user.spins_available >= 1 ? `Giros: ${user.spins_available}` : 'Dar giro'}</span>
                                    </button>
                                    {user.spins_available >= 1 && (
                                      <button
                                        onClick={() => handleRemoveSpins(user)}
                                        className="flex items-center gap-2 px-3 py-2 rounded-md text-xs hover:bg-white/[0.06] transition text-left w-full text-red-400"
                                      >
                                        <Minus size={13} className="text-red-400" />
                                        <span>Tirar giros ({user.spins_available})</span>
                                      </button>
                                    )}
                                    <button
                                      onClick={() => openEdit(user)}
                                      className="flex items-center gap-2 px-3 py-2 rounded-md text-xs hover:bg-white/[0.06] transition text-left w-full"
                                    >
                                      <Pencil size={13} className="text-primary" />
                                      <span>Editar</span>
                                    </button>
                                    <button
                                      onClick={() => handleToggleQualified(user)}
                                      className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs hover:bg-white/[0.06] transition text-left w-full ${user.user_type === 'qualified' ? 'text-emerald-400' : ''}`}
                                    >
                                      <span className="text-[13px]">✅</span>
                                      <span>{user.user_type === 'qualified' ? 'Remover qualificação' : 'Qualificar'}</span>
                                    </button>
                                    <div className="border-t border-white/[0.06] my-0.5" />
                                    <button
                                      onClick={() => handleDeleteUser(user.id)}
                                      className="flex items-center gap-2 px-3 py-2 rounded-md text-xs hover:bg-destructive/10 transition text-left w-full text-destructive"
                                    >
                                      <Trash2 size={13} />
                                      <span>Excluir</span>
                                    </button>
                                  </div>
                                </PopoverContent>
                              </Popover>
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
                              <p className="text-sm font-medium text-foreground truncate">{user.user_type === 'qualified' && '✅ '}#{index + 1} {user.name}</p>
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
                            {user.spins_available >= 1 && (
                              <button
                                onClick={() => handleRemoveSpins(user)}
                                className="p-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition"
                                title="Tirar giros"
                              >
                                <Minus size={13} />
                              </button>
                            )}
                            <button
                              onClick={() => handleToggleQualified(user)}
                              className={`p-1.5 rounded-lg transition border ${user.user_type === 'qualified' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-white/[0.06] text-muted-foreground border-white/[0.06]'}`}
                              title={user.user_type === 'qualified' ? 'Remover qualificação' : 'Qualificar'}
                            >
                              <span className="text-[13px]">✅</span>
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

          {/* ══════ BATALHA SLOT ══════ */}
          {activeTab === 'batalha_slot' && session?.user?.id && (
            <BattleConfigPanel userId={session.user.id} />
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
                  <div className="overflow-x-auto [touch-action:pan-x]">
                    <table className="w-full min-w-[760px] text-sm">
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
                  </div>
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
            // Date range filtering
            const dayKey = (dateStr: string) => {
              const d = new Date(dateStr);
              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            };
            const nowRef = new Date();
            const rangeCutoff = (() => {
              if (analyticsRangeFilter === 'today') {
                const d = new Date(nowRef); d.setHours(0, 0, 0, 0); return d.getTime();
              }
              if (analyticsRangeFilter === '7d') return nowRef.getTime() - 7 * 86400000;
              if (analyticsRangeFilter === '30d') return nowRef.getTime() - 30 * 86400000;
              return null;
            })();
            const dateFiltered = pageViews.filter((v: any) => {
              if (analyticsDateFilter && dayKey(v.created_at) !== analyticsDateFilter) return false;
              if (rangeCutoff !== null && new Date(v.created_at).getTime() < rangeCutoff) return false;
              return true;
            });
            const filtered = analyticsFilter === 'all' ? dateFiltered : dateFiltered.filter((v: any) => (v.page_type || 'roleta') === analyticsFilter);
            // Available unique dates for dropdown
            const availableDates = Array.from(new Set(pageViews.map((v: any) => dayKey(v.created_at)))).sort().reverse();
            const total = filtered.length;
            const uniqueIPs = new Set(filtered.map((v: any) => v.ip_address)).size;
            const avgDuration = total > 0 ? Math.round(filtered.reduce((s: number, v: any) => s + (v.duration_seconds || 0), 0) / total) : 0;
            const formatDuration = (s: number) => s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;

            // Device breakdown
            const devices: Record<string, number> = {};
            filtered.forEach((v: any) => { devices[v.device_type || 'Desconhecido'] = (devices[v.device_type || 'Desconhecido'] || 0) + 1; });
            const deviceEntries = Object.entries(devices).sort((a, b) => b[1] - a[1]);

            // Browser breakdown
            const browsers: Record<string, number> = {};
            filtered.forEach((v: any) => { browsers[v.browser || 'Desconhecido'] = (browsers[v.browser || 'Desconhecido'] || 0) + 1; });
            const browserEntries = Object.entries(browsers).sort((a, b) => b[1] - a[1]);

            // OS breakdown
            const osStat: Record<string, number> = {};
            filtered.forEach((v: any) => { osStat[v.os || 'Desconhecido'] = (osStat[v.os || 'Desconhecido'] || 0) + 1; });
            const osEntries = Object.entries(osStat).sort((a, b) => b[1] - a[1]);

            // Country/City breakdown
            const locations: Record<string, number> = {};
            filtered.forEach((v: any) => {
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
            filtered.forEach((v: any) => {
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
              {/* Date filter */}
              <GlassCard className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <CalendarIcon size={16} className="text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Período:</span>
                  </div>
                  {([
                    { key: 'all', label: 'Tudo' },
                    { key: 'today', label: 'Hoje' },
                    { key: '7d', label: '7 dias' },
                    { key: '30d', label: '30 dias' },
                  ] as const).map(r => (
                    <button
                      key={r.key}
                      onClick={() => { setAnalyticsRangeFilter(r.key); setAnalyticsDateFilter(''); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${analyticsRangeFilter === r.key && !analyticsDateFilter ? 'bg-primary text-primary-foreground' : 'bg-white/[0.06] border border-white/[0.08] text-muted-foreground hover:bg-white/[0.1]'}`}
                    >
                      {r.label}
                    </button>
                  ))}
                  <div className="h-6 w-px bg-white/10 mx-1" />
                  <input
                    type="date"
                    value={analyticsDateFilter}
                    onChange={(e) => { setAnalyticsDateFilter(e.target.value); setAnalyticsRangeFilter('all'); }}
                    className="px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-sm text-foreground"
                  />
                  {availableDates.length > 0 && (
                    <select
                      value={analyticsDateFilter}
                      onChange={(e) => { setAnalyticsDateFilter(e.target.value); setAnalyticsRangeFilter('all'); }}
                      className="px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-sm text-foreground"
                    >
                      <option value="">Selecionar dia...</option>
                      {availableDates.map(d => (
                        <option key={d} value={d}>{new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')}</option>
                      ))}
                    </select>
                  )}
                  {(analyticsDateFilter || analyticsRangeFilter !== 'all') && (
                    <button
                      onClick={() => { setAnalyticsDateFilter(''); setAnalyticsRangeFilter('all'); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] border border-white/[0.08] text-muted-foreground hover:bg-white/[0.1]"
                    >
                      Limpar
                    </button>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </GlassCard>

              {/* Filter buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {([
                  { key: 'all', label: 'Todos' },
                  { key: 'roleta', label: 'Roleta' },
                  { key: 'referral', label: 'Referral' },
                  { key: 'gorjeta', label: 'Gorjeta' },
                ] as const).map(f => (
                  <button
                    key={f.key}
                    onClick={() => setAnalyticsFilter(f.key)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${analyticsFilter === f.key ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'bg-white/[0.06] border border-white/[0.08] text-muted-foreground hover:bg-white/[0.1]'}`}
                  >
                    {f.label}
                    <span className="ml-1.5 text-xs opacity-70">
                      ({f.key === 'all' ? dateFiltered.length : dateFiltered.filter((v: any) => (v.page_type || 'roleta') === f.key).length})
                    </span>
                  </button>
                ))}
              </div>

              {/* Top stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: 'Total de Acessos', value: total, icon: <Globe size={18} />, color: 'text-primary', bg: 'bg-primary/10' },
                  { label: 'IPs Únicos', value: uniqueIPs, icon: <MapPin size={18} />, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
                  { label: 'Tempo Médio', value: formatDuration(avgDuration), icon: <Clock size={18} />, color: 'text-sky-400', bg: 'bg-sky-400/10' },
                  { label: 'Hoje', value: filtered.filter((v: any) => new Date(v.created_at).toISOString().split('T')[0] === todayStr).length, icon: <BarChart3 size={18} />, color: 'text-amber-400', bg: 'bg-amber-400/10' },
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
              ) : filtered.length === 0 ? (
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
                          <th className="text-left px-4 py-3.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Tipo</th>
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
                        {filtered.slice(0, 50).map((v: any) => (
                          <tr key={v.id} className="border-t border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold uppercase ${(v.page_type || 'roleta') === 'roleta' ? 'bg-primary/10 text-primary' : (v.page_type) === 'gorjeta' ? 'bg-amber-400/10 text-amber-400' : 'bg-emerald-400/10 text-emerald-400'}`}>
                                {v.page_type || 'roleta'}
                              </span>
                            </td>
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
          {activeTab === 'email_brevo' && (
            <BrevoBulkEmailPanel ownerId={session?.user?.id ?? null} />
          )}

          {activeTab === 'email' && (
            <div className="max-w-2xl space-y-5">
              <div className="flex items-center gap-2 justify-end">
                <button onClick={() => { setShowEmailHistory(!showEmailHistory); if (!showEmailHistory) fetchEmailLogs(); }} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm transition ${showEmailHistory ? 'border-primary/30 bg-primary/10 text-primary' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground hover:bg-white/[0.08]'}`}>
                  <Clock size={15} /> Histórico
                </button>
              </div>

              {showEmailHistory && (
                <GlassCard className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Clock size={16} className="text-primary" /> Histórico de Emails</h3>
                    <button onClick={fetchEmailLogs} className="text-xs text-muted-foreground hover:text-foreground transition flex items-center gap-1"><RotateCcw size={12} /> Atualizar</button>
                  </div>
                  {emailLogsLoading ? (
                    <div className="flex items-center justify-center py-8"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
                  ) : emailLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum email enviado ainda.</p>
                  ) : (
                    <div className="max-h-96 overflow-y-auto space-y-2">
                      {emailLogs.map(log => (
                        <div key={log.id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`shrink-0 w-2 h-2 rounded-full ${log.status === 'sent' ? 'bg-emerald-400' : log.status === 'pending' ? 'bg-amber-400' : log.status === 'suppressed' ? 'bg-yellow-500' : 'bg-red-400'}`} />
                              <span className="truncate text-foreground">{log.recipient_email}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <span className="px-1.5 py-0.5 rounded bg-white/[0.06] text-[10px] uppercase font-medium">{log.template_name}</span>
                              <span>{new Date(log.created_at).toLocaleString('pt-BR')}</span>
                            </div>
                            {log.error_message && <p className="text-xs text-red-400 mt-1 truncate">{log.error_message}</p>}
                          </div>
                          <span className={`shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase ${log.status === 'sent' ? 'bg-emerald-400/10 text-emerald-400' : log.status === 'pending' ? 'bg-amber-400/10 text-amber-400' : log.status === 'suppressed' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-400/10 text-red-400'}`}>
                            {log.status === 'sent' ? 'Enviado' : log.status === 'pending' ? 'Pendente' : log.status === 'suppressed' ? 'Suprimido' : log.status === 'dlq' ? 'Falhou' : log.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </GlassCard>
              )}

              <GlassCard className="p-5 space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Users size={16} className="text-primary" /> Destinatários</h3>
                <label className="flex items-center gap-2 cursor-pointer flex-wrap">
                  <input type="checkbox" checked={excludeRecentEmail} onChange={e => { setExcludeRecentEmail(e.target.checked); if (e.target.checked) fetchRecentEmailRecipients(); }} className="rounded border-white/20" />
                  <span className="text-xs text-muted-foreground">Excluir quem já recebeu email (2h)</span>
                  {excludeRecentEmail && recentEmailRecipients.size > 0 && <span className="text-xs text-yellow-400">({recentEmailRecipients.size} excluídos)</span>}
                  {excludeRecentEmail && recentEmailCountdown && (
                    <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20">⏱ {recentEmailCountdown}</span>
                  )}
                </label>
                <div className="flex gap-2">
                  <button onClick={() => { setEmailTarget('all'); setSelectedEmails([]); }} className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${emailTarget === 'all' ? 'bg-primary/15 text-primary border-primary/20' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground'}`}>
                    Todos ({users.filter(u => u.email && (!excludeRecentEmail || !recentEmailRecipients.has(u.email.toLowerCase()))).length})
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
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Template</label>
                    <button
                      onClick={() => { setEditingTemplate(null); setShowTemplateEditor(true); }}
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Plus size={12} /> Criar template
                    </button>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setEmailTemplate('original')} className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${emailTemplate === 'original' ? 'bg-primary/15 text-primary border-primary/20' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground'}`}>
                      🎰 Original
                    </button>
                    <button onClick={() => setEmailTemplate('custom')} className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${emailTemplate === 'custom' ? 'bg-primary/15 text-primary border-primary/20' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground'}`}>
                      🖼️ Personalizado
                    </button>
                    {session?.user?.email === 'lucasvidalmop@gmail.com' && (
                      <button onClick={() => setEmailTemplate('lucas')} className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${emailTemplate === 'lucas' ? 'bg-primary/15 text-primary border-primary/20' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground'}`}>
                        🏆 Lucas BSB
                      </button>
                    )}
                    {customTemplates.map(t => (
                      <div key={t.id} className={`group relative flex items-center rounded-xl border transition-all ${emailTemplate === t.id ? 'bg-primary/15 border-primary/20' : 'border-white/[0.08] bg-white/[0.04]'}`}>
                        <button
                          onClick={() => setEmailTemplate(t.id)}
                          className={`pl-4 pr-2 py-2.5 text-sm font-medium ${emailTemplate === t.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                          ✨ {t.name}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingTemplate(t); setShowTemplateEditor(true); }}
                          className="px-1.5 py-2.5 text-muted-foreground hover:text-foreground"
                          title="Editar"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!confirm(`Excluir template "${t.name}"?`)) return;
                            const { error } = await supabase.from('email_templates').delete().eq('id', t.id);
                            if (error) { toast.error('Erro ao excluir'); return; }
                            toast.success('Template excluído');
                            if (emailTemplate === t.id) setEmailTemplate('original');
                            refreshCustomTemplates();
                          }}
                          className="px-1.5 pr-3 py-2.5 text-muted-foreground hover:text-destructive"
                          title="Excluir"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
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
                  <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Nome do Remetente</label>
                  <input value={emailSenderName} onChange={e => setEmailSenderName(e.target.value)} placeholder="Nome da marca" className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Email do Remetente</label>
                  <div className="flex items-center gap-0">
                    <input value={emailSenderEmail} onChange={e => setEmailSenderEmail(e.target.value.replace(/[^a-zA-Z0-9._-]/g, ''))} placeholder="noreply" className="flex-1 px-3 py-2.5 rounded-l-xl border border-r-0 border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
                    <span className="px-3 py-2.5 rounded-r-xl border border-white/[0.08] bg-white/[0.06] text-muted-foreground text-sm select-none">@tipspayroleta.com</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Ex: contato, noreply, suporte</p>
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

              <BulkSendProgress
                total={emailProgress.total}
                sent={emailProgress.sent}
                errors={emailProgress.errors}
                skipped={emailProgress.skipped}
                label="Disparo de email"
              />

              <BulkSendControls control={emailCtrl} visible={emailSending} />

              <button
                onClick={async () => {
                  const baseRecipients = emailTarget === 'all' ? users.map(u => u.email) : selectedEmails;
                  const recipients = excludeRecentEmail
                    ? baseRecipients.filter(e => e && !recentEmailRecipients.has(e.toLowerCase()))
                    : baseRecipients.filter(e => !!e);
                  const skipped = baseRecipients.length - recipients.length;
                   if (recipients.length === 0) { toast.error(skipped > 0 ? `Todos os ${skipped} destinatários foram excluídos (email recente)` : 'Nenhum destinatário selecionado'); return; }
                   if (!emailSubject.trim()) { toast.error('Preencha o assunto'); return; }
                   if (!await confirmDialog({ title: 'Confirmar disparo de Email', message: `Enviar este email para ${recipients.length} destinatário(s)?`, variant: 'info', confirmLabel: 'Disparar' })) return;
                   setEmailSending(true);
                  setEmailProgress({ total: recipients.length, sent: 0, errors: 0, skipped: 0 });
                  emailCtrl.start();
                   const publishedUrl = 'https://tipspayroleta.com';
                   const roletaLink = `${publishedUrl}/${slug}`;
                  const { data: { session: freshSession } } = await supabase.auth.getSession();
                  if (!freshSession?.access_token) { toast.error('Sessão expirada, faça login novamente'); setEmailSending(false); setEmailProgress(emptyProgress); return; }
                  let sent = 0, errors = 0, timedOut = 0;
                  const customTpl = customTemplates.find(t => t.id === emailTemplate);
                  const templateName = customTpl
                    ? 'wheel-invite-blocks'
                    : emailTemplate === 'custom' ? 'wheel-invite-custom'
                    : emailTemplate === 'lucas' ? 'wheel-invite-lucas'
                    : 'wheel-invite';

                  // Per-request timeout to prevent the loop from hanging on a stuck call
                  const PER_REQUEST_TIMEOUT_MS = 20000;
                  // Concurrency: send several in parallel to avoid serial blocking
                  const CONCURRENCY = 5;

                  const sendOne = async (email: string) => {
                    const user = users.find(u => u.email === email);
                    const invocation = supabase.functions.invoke('send-transactional-email', {
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
                          senderEmail: emailSenderEmail || undefined,
                          ...(customTpl ? { blocks: customTpl.blocks } : {}),
                          ...(emailTemplate === 'custom' && emailBannerUrl ? { bannerImageUrl: emailBannerUrl } : {}),
                        },
                      },
                    });
                    try {
                      const result: any = await Promise.race([
                        invocation,
                        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), PER_REQUEST_TIMEOUT_MS)),
                      ]);
                      if (result?.error) { errors++; setEmailProgress(p => ({ ...p, errors: p.errors + 1 })); }
                      else { sent++; setEmailProgress(p => ({ ...p, sent: p.sent + 1 })); }
                    } catch (e: any) {
                      if (e?.message === 'timeout') timedOut++;
                      errors++;
                      setEmailProgress(p => ({ ...p, errors: p.errors + 1 }));
                    }
                  };

                  // Process in chunks of CONCURRENCY, never blocking forever on a single request
                  let stoppedEarly = false;
                  for (let i = 0; i < recipients.length; i += CONCURRENCY) {
                    if (await emailCtrl.shouldStop()) { stoppedEarly = true; break; }
                    const chunk = recipients.slice(i, i + CONCURRENCY);
                    await Promise.all(chunk.map(sendOne));
                  }
                  emailCtrl.finish();
                  setEmailSending(false);
                  setTimeout(() => setEmailProgress(emptyProgress), 4000);
                  const skipMsg = skipped > 0 ? ` (${skipped} excluído${skipped > 1 ? 's' : ''} por já ter recebido)` : '';
                  if (stoppedEarly) {
                    toast.warning(`Disparo interrompido — ${sent} enviado(s), ${errors} erro(s)${skipMsg}`);
                  } else if (errors > 0) {
                    toast.error(`${sent} enviado(s), ${errors} erro(s)${timedOut > 0 ? ` (${timedOut} sem resposta)` : ''}${skipMsg}`);
                  } else {
                    toast.success(`${sent} email(s) enviado(s) com sucesso!${skipMsg}`);
                  }
                  if (showEmailHistory) fetchEmailLogs();
                  if (excludeRecentEmail) fetchRecentEmailRecipients();
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
              <div className="flex items-center gap-2 justify-end">
                <button onClick={() => { setShowSmsHistory(!showSmsHistory); if (!showSmsHistory) fetchSmsLogs(); }} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm transition ${showSmsHistory ? 'border-primary/30 bg-primary/10 text-primary' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground hover:bg-white/[0.08]'}`}>
                  <Clock size={15} /> Histórico
                </button>
                <button onClick={() => { setShowSmsScheduledList(!showSmsScheduledList); if (!showSmsScheduledList) fetchSmsScheduled(); }} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm transition ${showSmsScheduledList ? 'border-primary/30 bg-primary/10 text-primary' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground hover:bg-white/[0.08]'}`}>
                  <CalendarIcon size={15} /> Agendados
                </button>
                <button onClick={() => setShowSmsConfig(!showSmsConfig)} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm transition ${showSmsConfig ? 'border-primary/30 bg-primary/10 text-primary' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground hover:bg-white/[0.08]'}`} title="Configurações">
                  <Settings size={15} /> Configurar API
                </button>
              </div>

              {showSmsHistory && (
                <GlassCard className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Clock size={16} className="text-primary" /> Histórico de SMS</h3>
                    <button onClick={fetchSmsLogs} className="text-xs text-muted-foreground hover:text-foreground transition flex items-center gap-1"><RotateCcw size={12} /> Atualizar</button>
                  </div>
                  {smsLogsLoading ? (
                    <div className="text-center py-8 text-muted-foreground text-sm animate-pulse">Carregando histórico...</div>
                  ) : smsLogs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">Nenhum SMS enviado ainda.</div>
                  ) : (
                    <div className="max-h-[400px] overflow-y-auto space-y-2 pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/[0.1] [&::-webkit-scrollbar-thumb]:rounded-full">
                      {smsLogs.map((log: any) => (
                        <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition group">
                          <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${log.status === 'sent' ? 'bg-green-400' : 'bg-red-400'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-foreground truncate">{log.recipient_name || 'Sem nome'}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">{log.recipient_phone}</span>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">{log.message}</p>
                            {log.error_message && <p className="text-[10px] text-red-400 mt-1">Erro: {log.error_message}</p>}
                          </div>
                          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {new Date(log.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} {new Date(log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => resendSms(log)} className="p-1 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition" title="Reenviar">
                                <RotateCcw size={12} />
                              </button>
                              <button onClick={() => deleteSmsLog(log.id)} className="p-1 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition" title="Excluir">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </GlassCard>
              )}

              {showSmsConfig && (
                <GlassCard className="p-5 space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-foreground">🔑 Provedor de SMS</h3>
                  <div className={`grid gap-2 ${toolPerms.sms_mb === false ? 'grid-cols-1' : 'grid-cols-2'}`}>
                      <button type="button" onClick={() => setSmsProvider('twilio')} className={`px-3 py-2 rounded-xl text-sm font-medium border transition ${smsProvider === 'twilio' ? 'border-primary/30 bg-primary/10 text-primary' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground'}`}>Twilio</button>
                    {toolPerms.sms_mb !== false && (
                      <button type="button" onClick={() => setSmsProvider('mobizon')} className={`px-3 py-2 rounded-xl text-sm font-medium border transition ${smsProvider === 'mobizon' ? 'border-primary/30 bg-primary/10 text-primary' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground'}`}>SMS API (MB)</button>
                    )}
                    </div>
                  </div>

                  {smsProvider === 'twilio' ? (
                    <>
                      <p className="text-[10px] text-muted-foreground">Crie uma conta em <a href="https://www.twilio.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">twilio.com</a></p>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Account SID</label>
                        <input type="text" value={twilioAccountSid} onChange={e => setTwilioAccountSid(e.target.value)} placeholder="ACxxxxxxxx" className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/40" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Auth Token</label>
                        <input type="password" value={twilioAuthToken} onChange={e => setTwilioAuthToken(e.target.value)} placeholder="••••••••" className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/40" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Número remetente</label>
                        <input type="text" value={twilioPhoneNumber} onChange={e => setTwilioPhoneNumber(e.target.value)} placeholder="+5511999999999" className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/40" />
                      </div>
                      <div className={`text-xs font-medium ${twilioAccountSid && twilioAuthToken && twilioPhoneNumber ? 'text-green-400' : 'text-yellow-400'}`}>
                        {twilioAccountSid && twilioAuthToken && twilioPhoneNumber ? '✅ Twilio configurado' : '⚠️ Preencha todas as credenciais'}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-[10px] text-muted-foreground">A chave da Mobizon Brasil fica salva com segurança no backend. Aqui você só define o nome do remetente.</p>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Remetente</label>
                        <input type="text" value={mobizonSender} onChange={e => setMobizonSender(e.target.value)} placeholder="MobizonBR" className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/40" />
                      </div>
                      <div className="text-xs font-medium text-green-400">✅ SMS API (MB) pronta para uso</div>
                    </>
                  )}
                </GlassCard>
              )}

              <GlassCard className="p-5 space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Users size={16} className="text-primary" /> Destinatários</h3>
                {/* Source mode toggle */}
                <div className="flex gap-2">
                  <button onClick={() => setSmsSourceMode('base')} className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${smsSourceMode === 'base' ? 'bg-primary/15 text-primary border-primary/20' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground'}`}>
                    📋 Base
                  </button>
                  <button onClick={() => setSmsSourceMode('csv')} className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${smsSourceMode === 'csv' ? 'bg-primary/15 text-primary border-primary/20' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground'}`}>
                    <span className="flex items-center justify-center gap-1.5"><Upload size={14} /> CSV Externo</span>
                  </button>
                </div>

                {smsSourceMode === 'base' ? (
                  <>
                    <div className="flex gap-2">
                      <button onClick={() => { setSmsTarget('all'); setSelectedPhones([]); }} className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${smsTarget === 'all' ? 'bg-primary/15 text-primary border-primary/20' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground'}`}>
                        Todos ({users.filter(u => u.phone && u.phone.replace(/\D/g, '').length >= 10).length})
                      </button>
                      <button onClick={() => setSmsTarget('selected')} className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${smsTarget === 'selected' ? 'bg-primary/15 text-primary border-primary/20' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground'}`}>
                        Selecionar ({selectedPhones.length})
                      </button>
                    </div>
                    {smsTarget === 'selected' && (() => {
                      const smsUsersWithPhone = users.filter(u => u.phone && u.phone.replace(/\D/g, '').length >= 10);
                      const smsFilteredUsers = smsSearchTerm
                        ? smsUsersWithPhone.filter(u => u.name.toLowerCase().includes(smsSearchTerm.toLowerCase()) || u.phone.includes(smsSearchTerm))
                        : smsUsersWithPhone;
                      const allFilteredSelected = smsFilteredUsers.length > 0 && smsFilteredUsers.every(u => selectedPhones.includes(u.phone));
                      return (
                        <div className="space-y-2">
                          <input type="text" value={smsSearchTerm} onChange={e => setSmsSearchTerm(e.target.value)} placeholder="Pesquisar por nome ou telefone..." className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
                          <div className="flex items-center gap-2 px-1">
                            <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition">
                              <input type="checkbox" checked={allFilteredSelected} onChange={e => { if (e.target.checked) { const newPhones = new Set([...selectedPhones, ...smsFilteredUsers.map(u => u.phone)]); setSelectedPhones(Array.from(newPhones)); } else { const removeSet = new Set(smsFilteredUsers.map(u => u.phone)); setSelectedPhones(selectedPhones.filter(p => !removeSet.has(p))); } }} className="rounded border-white/20" />
                              Selecionar todos ({smsFilteredUsers.length})
                            </label>
                          </div>
                          <div className="max-h-48 overflow-y-auto rounded-xl border border-white/[0.08] bg-white/[0.02] p-2 space-y-0.5">
                            {smsFilteredUsers.map(u => (
                              <label key={u.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.04] cursor-pointer transition">
                                <input type="checkbox" checked={selectedPhones.includes(u.phone)} onChange={e => { if (e.target.checked) setSelectedPhones([...selectedPhones, u.phone]); else setSelectedPhones(selectedPhones.filter(p => p !== u.phone)); }} className="rounded border-white/20" />
                                <span className="text-sm text-foreground">{u.name}</span>
                                <span className="text-xs text-muted-foreground ml-auto">{u.phone}</span>
                              </label>
                            ))}
                            {smsFilteredUsers.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Nenhum resultado</p>}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <input ref={csvInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleCsvUpload} />
                      <button onClick={() => csvInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-white/20 bg-white/[0.04] text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition">
                        <Upload size={14} /> Importar CSV
                      </button>
                      <button onClick={fetchWaContacts} disabled={waContactsLoading} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-green-500/30 bg-green-500/5 text-sm text-green-400 hover:text-green-300 hover:border-green-400/40 transition disabled:opacity-50">
                        {waContactsLoading ? <div className="w-3.5 h-3.5 border-2 border-green-400 border-t-transparent rounded-full animate-spin" /> : <MessageCircle size={14} />} Contatos WhatsApp
                      </button>
                      <button onClick={() => setShowCreateGroup(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-primary/30 bg-primary/5 text-sm text-primary hover:text-primary/80 transition">
                        <Plus size={14} /> Criar Grupo
                      </button>
                      {csvContacts.length > 0 && (
                        <button onClick={() => clearPersistedCsvContacts(selectedGroup !== '__all__' ? selectedGroup : undefined)} className="px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-xs text-muted-foreground hover:text-red-400 transition" title={selectedGroup !== '__all__' ? `Remover grupo "${selectedGroup}"` : 'Limpar todos'}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    {/* Group selector + import target */}
                    {contactGroups.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button onClick={() => setSelectedGroup('__all__')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${selectedGroup === '__all__' ? 'bg-primary/15 text-primary border-primary/20' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground'}`}>
                            Todos ({csvContacts.length})
                          </button>
                          {contactGroups.map(g => (
                            <div key={g} className="relative group/grp flex items-center">
                              {editingGroup === g ? (
                                <div className="flex items-center gap-1">
                                  <input type="text" value={editingGroupName} onChange={e => setEditingGroupName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleRenameGroup(g); if (e.key === 'Escape') setEditingGroup(null); }} className="px-2 py-1 rounded-lg border border-primary/30 bg-white/[0.06] text-foreground text-xs w-24 focus:outline-none focus:ring-1 focus:ring-primary/40" autoFocus />
                                  <button onClick={() => handleRenameGroup(g)} className="p-1 rounded text-primary hover:bg-primary/10 transition"><CheckCircle2 size={12} /></button>
                                  <button onClick={() => setEditingGroup(null)} className="p-1 rounded text-muted-foreground hover:text-foreground transition"><X size={12} /></button>
                                </div>
                              ) : (
                                <button onClick={() => setSelectedGroup(g)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${selectedGroup === g ? 'bg-primary/15 text-primary border-primary/20' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground'}`}>
                                  {g} ({csvContacts.filter(c => c.group_name === g).length})
                                </button>
                              )}
                              {editingGroup !== g && (
                                <div className="hidden group-hover/grp:flex items-center gap-0.5 ml-0.5">
                                  <button onClick={(e) => { e.stopPropagation(); setEditingGroup(g); setEditingGroupName(g); }} className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition" title="Renomear"><Pencil size={10} /></button>
                                  <button onClick={(e) => { e.stopPropagation(); handleDeleteGroup(g); }} className="p-1 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition" title="Remover grupo"><Trash2 size={10} /></button>
                                </div>
                              )}
                            </div>
                          ))}
                          {csvContacts.filter(c => !c.group_name).length > 0 && (
                            <button onClick={() => setSelectedGroup('')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${selectedGroup === '' ? 'bg-primary/15 text-primary border-primary/20' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground'}`}>
                              Sem grupo ({csvContacts.filter(c => !c.group_name).length})
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">Importar para:</span>
                          <select value={importTargetGroup} onChange={e => setImportTargetGroup(e.target.value)} className="px-2 py-1 rounded-lg border border-white/[0.08] bg-white/[0.04] text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary/40">
                            <option value="">Sem grupo</option>
                            {contactGroups.map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Create group dialog */}
                    {showCreateGroup && (
                      <div className="flex items-center gap-2 p-3 rounded-xl border border-primary/20 bg-primary/5">
                        <input type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateGroup()} placeholder="Nome do grupo..." className="flex-1 px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" autoFocus />
                        <button onClick={handleCreateGroup} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition">Criar</button>
                        <button onClick={() => { setShowCreateGroup(false); setNewGroupName(''); }} className="px-2 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground transition"><X size={14} /></button>
                      </div>
                    )}

                    <p className="text-[10px] text-muted-foreground">CSV: colunas <code className="bg-white/10 px-1 rounded">lead</code>,<code className="bg-white/10 px-1 rounded">numero</code> · Contatos sincronizados entre SMS e WhatsApp</p>

                    {/* Merged list: CSV + WhatsApp contacts */}
                    {(() => {
                      let groupFiltered = csvContacts;
                      if (selectedGroup !== '__all__') {
                        groupFiltered = csvContacts.filter(c => c.group_name === selectedGroup);
                      }
                      const merged: { lead: string; numero: string; group_name: string }[] = [...groupFiltered];
                      if (selectedGroup === '__all__') {
                        const existingNums = new Set(csvContacts.map(c => c.numero));
                        for (const wc of waContacts) { if (!existingNums.has(wc.numero)) merged.push({ ...wc, group_name: '' }); }
                      }
                      const filtered = csvSearchTerm ? merged.filter(c => c.lead.toLowerCase().includes(csvSearchTerm.toLowerCase()) || c.numero.includes(csvSearchTerm)) : merged;
                      const allSelected = filtered.length > 0 && filtered.every(c => selectedCsvContacts.includes(c.numero));
                      if (merged.length === 0) return null;
                      return (
                        <div className="space-y-2">
                          <input type="text" value={csvSearchTerm} onChange={e => setCsvSearchTerm(e.target.value)} placeholder="Buscar por nome ou número..." className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
                          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
                            <label className="flex items-center gap-2.5 px-3 py-2.5 border-b border-white/[0.08] bg-white/[0.04] cursor-pointer hover:bg-white/[0.06] transition">
                              <input type="checkbox" checked={allSelected} onChange={e => {
                                if (e.target.checked) setSelectedCsvContacts(prev => [...new Set([...prev, ...filtered.map(c => c.numero)])]);
                                else setSelectedCsvContacts(prev => prev.filter(n => !filtered.some(c => c.numero === n)));
                              }} className="rounded border-white/20" />
                              <span className="text-sm font-medium text-foreground">Selecionar todos</span>
                              <span className="text-xs text-muted-foreground ml-auto">{selectedCsvContacts.filter(n => filtered.some(c => c.numero === n)).length}/{merged.length}</span>
                            </label>
                            <div className="max-h-48 overflow-y-auto p-2 space-y-0.5">
                              {filtered.map((c, i) => (
                                <label key={`${c.numero}-${i}`} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.04] cursor-pointer transition">
                                  <input type="checkbox" checked={selectedCsvContacts.includes(c.numero)} onChange={e => { if (e.target.checked) setSelectedCsvContacts(prev => [...prev, c.numero]); else setSelectedCsvContacts(prev => prev.filter(n => n !== c.numero)); }} className="rounded border-white/20" />
                                  <span className="text-sm text-foreground">{c.lead || 'Sem nome'}</span>
                                  {c.group_name && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">{c.group_name}</span>}
                                  <span className="text-xs text-muted-foreground ml-auto">{c.numero}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </GlassCard>

              <GlassCard className="p-5 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Smartphone size={16} className="text-primary" /> Mensagem</h3>
                <textarea value={smsMessage} onChange={e => setSmsMessage(e.target.value)} rows={4} placeholder="Digite a mensagem..." className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm resize-y focus:outline-none focus:ring-1 focus:ring-primary/40" />
                <p className="text-[10px] text-muted-foreground">{smsMessage.length}/160 caracteres</p>
              </GlassCard>

              {/* Schedule toggle */}
              <GlassCard className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><CalendarIcon size={16} className="text-primary" /> Agendar envio</h3>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs text-muted-foreground">{smsScheduleMode ? 'Agendado' : 'Enviar agora'}</span>
                    <button onClick={() => setSmsScheduleMode(!smsScheduleMode)} className={`relative w-10 h-5 rounded-full transition-colors ${smsScheduleMode ? 'bg-primary' : 'bg-white/[0.12]'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${smsScheduleMode ? 'translate-x-5' : ''}`} />
                    </button>
                  </label>
                </div>
                {smsScheduleMode && (
                  <div className="space-y-3 pt-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Data</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm text-left flex items-center gap-2">
                              <CalendarIcon size={14} className="text-muted-foreground" />
                              {smsSchedDate ? smsSchedDate.toLocaleDateString('pt-BR') : 'Selecionar'}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={smsSchedDate} onSelect={setSmsSchedDate} initialFocus className="p-3 pointer-events-auto" />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Hora</label>
                        <input type="time" value={smsSchedTime} onChange={e => setSmsSchedTime(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Recorrência</label>
                      <select value={smsSchedRecurrence} onChange={e => setSmsSchedRecurrence(e.target.value as any)} className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40">
                        <option value="none">Sem recorrência</option>
                        <option value="daily">Diário</option>
                        <option value="weekly">Semanal</option>
                        <option value="monthly">Mensal</option>
                      </select>
                    </div>
                  </div>
                )}
              </GlassCard>

              <BulkSendProgress total={smsProgress.total} sent={smsProgress.sent} errors={smsProgress.errors} skipped={smsProgress.skipped} label="Disparo de SMS" />
              <BulkSendControls control={smsCtrl} visible={smsSending} />

              {smsScheduleMode ? (
                <button
                  onClick={saveSmsSchedule}
                  disabled={smsSchedSaving}
                  className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 hover:brightness-110 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                >
                  {smsSchedSaving ? <><div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> Agendando...</> : <><CalendarIcon size={16} /> Agendar SMS</>}
                </button>
              ) : (
              <button
                onClick={async () => {
                  if (smsProvider === 'twilio' && (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber)) { toast.error('Configure as credenciais do Twilio'); setShowSmsConfig(true); return; }
                  let phoneList: { phone: string; name: string }[] = [];
                  if (smsSourceMode === 'csv') {
                    phoneList = getSelectedExternalPhoneList();
                  } else {
                    const usersWithPhone = users.filter(u => u.phone && u.phone.replace(/\D/g, '').length >= 10);
                    phoneList = (smsTarget === 'all' ? usersWithPhone : users.filter(u => selectedPhones.includes(u.phone))).map(u => ({ phone: u.phone, name: u.name }));
                  }
                  const phones = phoneList.map(p => p.phone);
                  if (phones.length === 0) { toast.error('Nenhum destinatário'); return; }
                  if (!smsMessage.trim()) { toast.error('Digite a mensagem'); return; }
                  if (!await confirmDialog({ title: 'Confirmar disparo de SMS', message: `Enviar este SMS para ${phones.length} número(s)?`, variant: 'info', confirmLabel: 'Disparar' })) return;
                  setSmsSending(true);
                  setSmsProgress({ total: phones.length, sent: 0, errors: 0, skipped: 0 });
                  smsCtrl.start();
                  let sent = 0, errors = 0, skipped = 0;
                  const BATCH_SIZE = 5;
                  const TIMEOUT_MS = 15000;
                  const smsLogEntries: any[] = [];
                  const batchId = phones.length > 1 ? `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` : null;
                  try {
                    for (let i = 0; i < phones.length; i += BATCH_SIZE) {
                      if (await smsCtrl.shouldStop()) break;
                      const batch = phones.slice(i, i + BATCH_SIZE);
                      const results = await Promise.allSettled(
                        batch.map(phone => {
                          const controller = new AbortController();
                          const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
                          return supabase.functions.invoke(smsProvider === 'mobizon' ? 'send-sms-mobizon' : 'send-sms', {
                            body: smsProvider === 'mobizon'
                              ? { recipientPhone: phone, message: smsMessage, sender: mobizonSender }
                              : { recipientPhone: phone, message: smsMessage, twilioAccountSid, twilioAuthToken, twilioPhoneNumber }
                          }).then(res => { clearTimeout(timer); return { ...res, phone }; })
                            .catch(err => { clearTimeout(timer); throw err; });
                        })
                      );
                      for (let j = 0; j < results.length; j++) {
                        const r = results[j];
                        const phone = batch[j];
                        const user = users.find(u => u.phone === phone) || phoneList.find(p => p.phone === phone);
                        if (r.status === 'fulfilled' && !r.value.error) {
                          const payload = r.value.data as any;
                          if (payload?.skipped) {
                            skipped++;
                            setSmsProgress(p => ({ ...p, skipped: p.skipped + 1 }));
                            smsLogEntries.push({ owner_id: session?.user?.id, recipient_phone: phone, recipient_name: user?.name || '', message: smsMessage, status: 'error', error_message: payload?.error || 'Número inválido', batch_id: batchId });
                          } else {
                            sent++;
                            setSmsProgress(p => ({ ...p, sent: p.sent + 1 }));
                            smsLogEntries.push({ owner_id: session?.user?.id, recipient_phone: phone, recipient_name: user?.name || '', message: smsMessage, status: 'sent', batch_id: batchId });
                          }
                        } else {
                          errors++;
                          setSmsProgress(p => ({ ...p, errors: p.errors + 1 }));
                          const errMsg = r.status === 'rejected' ? r.reason?.message : r.value?.error?.message || 'Erro';
                          smsLogEntries.push({ owner_id: session?.user?.id, recipient_phone: phone, recipient_name: user?.name || '', message: smsMessage, status: 'error', error_message: errMsg, batch_id: batchId });
                        }
                      }
                    }
                  } catch (e) {
                    console.error('SMS batch error:', e);
                  }
                  if (smsLogEntries.length > 0) {
                    await (supabase as any).from(smsProvider === 'mobizon' ? 'sms_mb_message_log' : 'sms_message_log').insert(smsLogEntries);
                  }
                  smsCtrl.finish();
                  setSmsSending(false);
                  setTimeout(() => setSmsProgress(emptyProgress), 4000);
                  if (errors > 0 || skipped > 0) toast.error(`${sent} enviado(s), ${skipped} inválido(s), ${errors} erro(s)`);
                  else if (sent > 0) toast.success(`${sent} SMS enviado(s)!`);
                  else toast.error('Nenhum SMS enviado');
                  if (showSmsHistory) fetchSmsLogs();
                }}
                disabled={smsSending}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 hover:brightness-110 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
              >
                {smsSending ? <><div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> Enviando...</> : <><Send size={16} /> Enviar SMS</>}
              </button>
              )}

              {showSmsScheduledList && (
                <GlassCard className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><CalendarIcon size={16} className="text-primary" /> SMS Agendados</h3>
                    <button onClick={fetchSmsScheduled} className="text-xs text-muted-foreground hover:text-foreground transition flex items-center gap-1"><RotateCcw size={12} /> Atualizar</button>
                  </div>
                  {smsScheduledList.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhum SMS agendado</p>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {smsScheduledList.map((m: any) => (
                        <div key={m.id} className={`p-3 rounded-xl border text-xs space-y-1 ${m.status === 'pending' ? 'border-primary/20 bg-primary/5' : m.status === 'sent' ? 'border-green-500/20 bg-green-500/5' : m.status === 'cancelled' ? 'border-muted/20 bg-muted/5 opacity-60' : 'border-red-500/20 bg-red-500/5'}`}>
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-foreground truncate">{m.recipient_label || m.recipient_value}</p>
                              <p className="text-muted-foreground line-clamp-2 mt-0.5">{m.message}</p>
                            </div>
                            <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${m.status === 'pending' ? 'bg-primary/20 text-primary' : m.status === 'sent' ? 'bg-green-500/20 text-green-400' : m.status === 'cancelled' ? 'bg-muted/20 text-muted-foreground' : 'bg-red-500/20 text-red-400'}`}>
                                {m.status === 'pending' ? 'Pendente' : m.status === 'sent' ? 'Enviado' : m.status === 'cancelled' ? 'Cancelado' : 'Falhou'}
                              </span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center pt-1">
                            <span className="text-muted-foreground">
                              📅 {new Date(m.next_run_at || m.scheduled_at).toLocaleDateString('pt-BR')} {new Date(m.next_run_at || m.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              {m.recurrence !== 'none' && ` · 🔁 ${m.recurrence === 'daily' ? 'Diário' : m.recurrence === 'weekly' ? 'Semanal' : 'Mensal'}`}
                            </span>
                            {m.status === 'pending' && (
                              <button onClick={() => cancelSmsSchedule(m.id)} className="text-red-400 hover:text-red-300 transition text-[10px] font-bold">Cancelar</button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </GlassCard>
              )}
            </div>
          )}

          {/* ══════ SMS API (CS) — ClickSend TAB ══════ */}
          {activeTab === 'sms_cs' && (
            <div className="max-w-2xl space-y-5">
              <div className="flex items-center gap-2 justify-end">
                <button onClick={() => { setShowSmsCsHistory(!showSmsCsHistory); if (!showSmsCsHistory) fetchSmsCsLogs(); }} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm transition ${showSmsCsHistory ? 'border-primary/30 bg-primary/10 text-primary' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground hover:bg-white/[0.08]'}`}>
                  <Clock size={15} /> Histórico
                </button>
                <button onClick={() => { setShowSmsCsScheduledList(!showSmsCsScheduledList); if (!showSmsCsScheduledList) fetchSmsCsScheduled(); }} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm transition ${showSmsCsScheduledList ? 'border-primary/30 bg-primary/10 text-primary' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground hover:bg-white/[0.08]'}`}>
                  <CalendarIcon size={15} /> Agendados
                </button>
                <button onClick={() => setShowSmsCsConfig(!showSmsCsConfig)} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm transition ${showSmsCsConfig ? 'border-primary/30 bg-primary/10 text-primary' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground hover:bg-white/[0.08]'}`}>
                  <Settings size={15} /> Configurar API
                </button>
              </div>

              {showSmsCsHistory && (
                <GlassCard className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Clock size={16} className="text-primary" /> Histórico de SMS (ClickSend)</h3>
                    <button onClick={fetchSmsCsLogs} className="text-xs text-muted-foreground hover:text-foreground transition flex items-center gap-1"><RotateCcw size={12} /> Atualizar</button>
                  </div>
                  {smsCsLogsLoading ? (
                    <div className="text-center py-8 text-muted-foreground text-sm animate-pulse">Carregando...</div>
                  ) : smsCsLogs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">Nenhum SMS enviado ainda.</div>
                  ) : (
                    <div className="max-h-[400px] overflow-y-auto space-y-2 pr-1">
                      {smsCsLogs.map((log: any) => (
                        <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition group">
                          <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${log.status === 'sent' ? 'bg-green-400' : 'bg-red-400'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-foreground truncate">{log.recipient_name || 'Sem nome'}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">{log.recipient_phone}</span>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">{log.message}</p>
                            {log.error_message && <p className="text-[10px] text-red-400 mt-1">Erro: {log.error_message}</p>}
                          </div>
                          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {new Date(log.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} {new Date(log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => resendSmsCs(log)} className="p-1 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition" title="Reenviar"><RotateCcw size={12} /></button>
                              <button onClick={() => deleteSmsCsLog(log.id)} className="p-1 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition" title="Excluir"><Trash2 size={12} /></button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </GlassCard>
              )}

              {showSmsCsConfig && (
                <GlassCard className="p-5 space-y-3">
                  <h3 className="text-sm font-bold text-foreground">🔑 ClickSend</h3>
                  <p className="text-[10px] text-muted-foreground">Crie uma conta em <a href="https://www.clicksend.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">clicksend.com</a> e pegue suas credenciais em Dashboard → API Credentials.</p>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Username</label>
                    <input type="text" value={clicksendUsername} onChange={e => setClicksendUsername(e.target.value)} placeholder="seu-usuario" className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/40" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">API Key</label>
                    <input type="password" value={clicksendApiKey} onChange={e => setClicksendApiKey(e.target.value)} placeholder="••••••••" className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/40" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Sender ID (nome ou número alfa)</label>
                    <input type="text" value={clicksendSenderId} onChange={e => setClicksendSenderId(e.target.value)} placeholder="MinhaCasa" className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/40" />
                  </div>
                  <div className={`text-xs font-medium ${clicksendUsername && clicksendApiKey && clicksendSenderId ? 'text-green-400' : 'text-yellow-400'}`}>
                    {clicksendUsername && clicksendApiKey && clicksendSenderId ? '✅ Configurado' : '⚠️ Preencha todas as credenciais'}
                  </div>
                </GlassCard>
              )}

              <GlassCard className="p-5 space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Users size={16} className="text-primary" /> Destinatários</h3>
                <div className="flex gap-2">
                  <button onClick={() => setSmsCsSourceMode('base')} className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${smsCsSourceMode === 'base' ? 'bg-primary/15 text-primary border-primary/20' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground'}`}>📋 Base</button>
                  <button onClick={() => setSmsCsSourceMode('csv')} className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${smsCsSourceMode === 'csv' ? 'bg-primary/15 text-primary border-primary/20' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground'}`}><span className="flex items-center justify-center gap-1.5"><Upload size={14} /> CSV / WhatsApp</span></button>
                </div>

                {smsCsSourceMode === 'base' ? (
                  <>
                    <div className="flex gap-2">
                      <button onClick={() => { setSmsCsTarget('all'); setSelectedSmsCsPhones([]); }} className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${smsCsTarget === 'all' ? 'bg-primary/15 text-primary border-primary/20' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground'}`}>
                        Todos ({users.filter(u => u.phone && u.phone.replace(/\D/g, '').length >= 10).length})
                      </button>
                      <button onClick={() => setSmsCsTarget('selected')} className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${smsCsTarget === 'selected' ? 'bg-primary/15 text-primary border-primary/20' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground'}`}>
                        Selecionar ({selectedSmsCsPhones.length})
                      </button>
                    </div>
                    {smsCsTarget === 'selected' && (() => {
                      const usersWithPhone = users.filter(u => u.phone && u.phone.replace(/\D/g, '').length >= 10);
                      const filtered = smsCsSearchTerm ? usersWithPhone.filter(u => u.name.toLowerCase().includes(smsCsSearchTerm.toLowerCase()) || u.phone.includes(smsCsSearchTerm)) : usersWithPhone;
                      const allSelected = filtered.length > 0 && filtered.every(u => selectedSmsCsPhones.includes(u.phone));
                      return (
                        <div className="space-y-2">
                          <input type="text" value={smsCsSearchTerm} onChange={e => setSmsCsSearchTerm(e.target.value)} placeholder="Pesquisar..." className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
                          <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition px-1">
                            <input type="checkbox" checked={allSelected} onChange={e => { if (e.target.checked) setSelectedSmsCsPhones(Array.from(new Set([...selectedSmsCsPhones, ...filtered.map(u => u.phone)]))); else { const remove = new Set(filtered.map(u => u.phone)); setSelectedSmsCsPhones(selectedSmsCsPhones.filter(p => !remove.has(p))); } }} className="rounded border-white/20" />
                            Selecionar todos ({filtered.length})
                          </label>
                          <div className="max-h-48 overflow-y-auto rounded-xl border border-white/[0.08] bg-white/[0.02] p-2 space-y-0.5">
                            {filtered.map(u => (
                              <label key={u.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.04] cursor-pointer transition">
                                <input type="checkbox" checked={selectedSmsCsPhones.includes(u.phone)} onChange={e => { if (e.target.checked) setSelectedSmsCsPhones([...selectedSmsCsPhones, u.phone]); else setSelectedSmsCsPhones(selectedSmsCsPhones.filter(p => p !== u.phone)); }} className="rounded border-white/20" />
                                <span className="text-sm text-foreground">{u.name}</span>
                                <span className="text-xs text-muted-foreground ml-auto">{u.phone}</span>
                              </label>
                            ))}
                            {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Nenhum resultado</p>}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <p className="text-[10px] text-muted-foreground">Use a aba SMS / WhatsApp para importar contatos CSV — eles ficam compartilhados. Os contatos selecionados em <code className="bg-white/10 px-1 rounded">selectedCsvContacts</code> serão usados aqui também.</p>
                )}
              </GlassCard>

              <GlassCard className="p-5 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Smartphone size={16} className="text-primary" /> Mensagem</h3>
                <textarea value={smsCsMessage} onChange={e => setSmsCsMessage(e.target.value)} rows={4} placeholder="Digite a mensagem..." className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm resize-y focus:outline-none focus:ring-1 focus:ring-primary/40" />
                <p className="text-[10px] text-muted-foreground">{smsCsMessage.length}/160 caracteres</p>
              </GlassCard>

              <GlassCard className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><CalendarIcon size={16} className="text-primary" /> Agendar envio</h3>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs text-muted-foreground">{smsCsScheduleMode ? 'Agendado' : 'Enviar agora'}</span>
                    <button onClick={() => setSmsCsScheduleMode(!smsCsScheduleMode)} className={`relative w-10 h-5 rounded-full transition-colors ${smsCsScheduleMode ? 'bg-primary' : 'bg-white/[0.12]'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${smsCsScheduleMode ? 'translate-x-5' : ''}`} />
                    </button>
                  </label>
                </div>
                {smsCsScheduleMode && (
                  <div className="space-y-3 pt-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Data</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm text-left flex items-center gap-2">
                              <CalendarIcon size={14} className="text-muted-foreground" />
                              {smsCsSchedDate ? smsCsSchedDate.toLocaleDateString('pt-BR') : 'Selecionar'}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={smsCsSchedDate} onSelect={setSmsCsSchedDate} initialFocus className="p-3 pointer-events-auto" />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Hora</label>
                        <input type="time" value={smsCsSchedTime} onChange={e => setSmsCsSchedTime(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Recorrência</label>
                      <select value={smsCsSchedRecurrence} onChange={e => setSmsCsSchedRecurrence(e.target.value as any)} className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40">
                        <option value="none">Sem recorrência</option>
                        <option value="daily">Diário</option>
                        <option value="weekly">Semanal</option>
                        <option value="monthly">Mensal</option>
                      </select>
                    </div>
                  </div>
                )}
              </GlassCard>

              <BulkSendProgress total={smsCsProgress.total} sent={smsCsProgress.sent} errors={smsCsProgress.errors} skipped={smsCsProgress.skipped} label="Disparo de SMS (ClickSend)" />
              <BulkSendControls control={smsCsCtrl} visible={smsCsSending} />

              {smsCsScheduleMode ? (
                <button onClick={saveSmsCsSchedule} disabled={smsCsSchedSaving} className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 hover:brightness-110 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                  {smsCsSchedSaving ? <><div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> Agendando...</> : <><CalendarIcon size={16} /> Agendar SMS</>}
                </button>
              ) : (
                <button
                  onClick={async () => {
                    if (!clicksendUsername || !clicksendApiKey || !clicksendSenderId) { toast.error('Configure as credenciais do ClickSend'); setShowSmsCsConfig(true); return; }
                    let phoneList: { phone: string; name: string }[] = [];
                    if (smsCsSourceMode === 'csv') {
                      phoneList = getSelectedExternalPhoneList();
                    } else {
                      const usersWithPhone = users.filter(u => u.phone && u.phone.replace(/\D/g, '').length >= 10);
                      phoneList = (smsCsTarget === 'all' ? usersWithPhone : users.filter(u => selectedSmsCsPhones.includes(u.phone))).map(u => ({ phone: u.phone, name: u.name }));
                    }
                    const phones = phoneList.map(p => p.phone);
                    if (phones.length === 0) { toast.error('Nenhum destinatário'); return; }
                    if (!smsCsMessage.trim()) { toast.error('Digite a mensagem'); return; }
                    if (!await confirmDialog({ title: 'Confirmar disparo de SMS (ClickSend)', message: `Enviar este SMS para ${phones.length} número(s)?`, variant: 'info', confirmLabel: 'Disparar' })) return;
                    setSmsCsSending(true);
                    setSmsCsProgress({ total: phones.length, sent: 0, errors: 0, skipped: 0 });
                    smsCsCtrl.start();
                    let sent = 0, errors = 0, skipped = 0;
                    const BATCH_SIZE = 5;
                    const entries: any[] = [];
                    const batchId = phones.length > 1 ? `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` : null;
                    try {
                      for (let i = 0; i < phones.length; i += BATCH_SIZE) {
                        if (await smsCsCtrl.shouldStop()) break;
                        const batch = phones.slice(i, i + BATCH_SIZE);
                        const results = await Promise.allSettled(batch.map(phone =>
                          supabase.functions.invoke('send-sms-clicksend', {
                            body: { recipientPhone: phone, message: smsCsMessage, clicksendUsername, clicksendApiKey, clicksendSenderId }
                          })
                        ));
                        for (let j = 0; j < results.length; j++) {
                          const r = results[j];
                          const phone = batch[j];
                          const u = users.find(x => x.phone === phone) || phoneList.find(p => p.phone === phone);
                          if (r.status === 'fulfilled' && !r.value.error) {
                            const payload = r.value.data as any;
                            if (payload?.skipped) { skipped++; setSmsCsProgress(p => ({ ...p, skipped: p.skipped + 1 })); entries.push({ owner_id: session?.user?.id, recipient_phone: phone, recipient_name: u?.name || '', message: smsCsMessage, status: 'error', error_message: payload?.error || 'Número inválido', batch_id: batchId }); }
                            else { sent++; setSmsCsProgress(p => ({ ...p, sent: p.sent + 1 })); entries.push({ owner_id: session?.user?.id, recipient_phone: phone, recipient_name: u?.name || '', message: smsCsMessage, status: 'sent', batch_id: batchId }); }
                          } else {
                            errors++;
                            setSmsCsProgress(p => ({ ...p, errors: p.errors + 1 }));
                            const errMsg = r.status === 'rejected' ? r.reason?.message : r.value?.error?.message || 'Erro';
                            entries.push({ owner_id: session?.user?.id, recipient_phone: phone, recipient_name: u?.name || '', message: smsCsMessage, status: 'error', error_message: errMsg, batch_id: batchId });
                          }
                        }
                      }
                    } catch (e) { console.error('SMS CS batch error:', e); }
                    if (entries.length > 0) await (supabase as any).from('sms_cs_message_log').insert(entries);
                    smsCsCtrl.finish();
                    setSmsCsSending(false);
                    setTimeout(() => setSmsCsProgress(emptyProgress), 4000);
                    if (errors > 0 || skipped > 0) toast.error(`${sent} enviado(s), ${skipped} inválido(s), ${errors} erro(s)`);
                    else if (sent > 0) toast.success(`${sent} SMS enviado(s)!`);
                    else toast.error('Nenhum SMS enviado');
                    if (showSmsCsHistory) fetchSmsCsLogs();
                  }}
                  disabled={smsCsSending}
                  className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 hover:brightness-110 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                >
                  {smsCsSending ? <><div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> Enviando...</> : <><Send size={16} /> Enviar SMS (ClickSend)</>}
                </button>
              )}

              {showSmsCsScheduledList && (
                <GlassCard className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><CalendarIcon size={16} className="text-primary" /> SMS Agendados (CS)</h3>
                    <button onClick={fetchSmsCsScheduled} className="text-xs text-muted-foreground hover:text-foreground transition flex items-center gap-1"><RotateCcw size={12} /> Atualizar</button>
                  </div>
                  {smsCsScheduledList.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhum SMS agendado</p>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {smsCsScheduledList.map((m: any) => (
                        <div key={m.id} className={`p-3 rounded-xl border text-xs space-y-1 ${m.status === 'pending' ? 'border-primary/20 bg-primary/5' : m.status === 'sent' ? 'border-green-500/20 bg-green-500/5' : m.status === 'cancelled' ? 'border-muted/20 bg-muted/5 opacity-60' : 'border-red-500/20 bg-red-500/5'}`}>
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-foreground truncate">{m.recipient_label || m.recipient_value}</p>
                              <p className="text-muted-foreground line-clamp-2 mt-0.5">{m.message}</p>
                            </div>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ml-2 flex-shrink-0 ${m.status === 'pending' ? 'bg-primary/20 text-primary' : m.status === 'sent' ? 'bg-green-500/20 text-green-400' : m.status === 'cancelled' ? 'bg-muted/20 text-muted-foreground' : 'bg-red-500/20 text-red-400'}`}>
                              {m.status === 'pending' ? 'Pendente' : m.status === 'sent' ? 'Enviado' : m.status === 'cancelled' ? 'Cancelado' : 'Falhou'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center pt-1">
                            <span className="text-muted-foreground">📅 {new Date(m.next_run_at || m.scheduled_at).toLocaleDateString('pt-BR')} {new Date(m.next_run_at || m.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}{m.recurrence !== 'none' && ` · 🔁 ${m.recurrence === 'daily' ? 'Diário' : m.recurrence === 'weekly' ? 'Semanal' : 'Mensal'}`}</span>
                            {m.status === 'pending' && <button onClick={() => cancelSmsCsSchedule(m.id)} className="text-red-400 hover:text-red-300 transition text-[10px] font-bold">Cancelar</button>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </GlassCard>
              )}
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

              {/* ── Grupos WhatsApp ── */}
              <GlassCard className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                      <Users size={20} className="text-green-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Grupos WhatsApp</h3>
                      <p className="text-xs text-muted-foreground">Selecione um grupo para receber notificações automáticas</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!evolutionApiUrl || !evolutionApiKey || !evolutionInstance || notifyGroupsLoading}
                    onClick={async () => {
                      setNotifyGroupsLoading(true);
                      try {
                        const { data } = await supabase.functions.invoke('evolution-proxy', {
                          body: {
                            action: 'fetchGroups',
                            evolutionApiUrl,
                            evolutionApiKey,
                            evolutionInstance,
                          },
                        });
                        if (data?.ok && Array.isArray(data.data)) {
                          setNotifyGroups(data.data.map((g: any) => ({ id: g.id, subject: g.subject || g.id })));
                          toast.success(`${data.data.length} grupo(s) encontrado(s)`);
                        } else {
                          toast.error('Erro ao buscar grupos. Verifique se a API está conectada.');
                        }
                      } catch {
                        toast.error('Erro ao buscar grupos');
                      }
                      setNotifyGroupsLoading(false);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold border border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20 disabled:opacity-40 transition flex items-center gap-1.5"
                  >
                    <RotateCcw size={14} /> {notifyGroupsLoading ? 'Buscando...' : 'Buscar Grupos'}
                  </button>
                </div>

                {notifyGroups.length > 0 ? (
                  <div className="space-y-2">
                    <div className="max-h-[200px] overflow-y-auto space-y-1.5 pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/[0.1] [&::-webkit-scrollbar-thumb]:rounded-full">
                      {notifyGroups.map(g => {
                        const isSelected = notifySelectedGroups.some(sg => sg.id === g.id);
                        return (
                          <label key={g.id} className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${isSelected ? 'bg-green-500/10 border-green-500/20' : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'}`}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                if (isSelected) {
                                  const updated = notifySelectedGroups.filter(sg => sg.id !== g.id);
                                  setNotifySelectedGroups(updated);
                                  if (notifyGroupJid === g.id) {
                                    setNotifyGroupJid(updated[0]?.id || '');
                                    setNotifyGroupName(updated[0]?.subject || '');
                                  }
                                } else {
                                  const updated = [...notifySelectedGroups, g];
                                  setNotifySelectedGroups(updated);
                                  if (!notifyGroupJid) {
                                    setNotifyGroupJid(g.id);
                                    setNotifyGroupName(g.subject);
                                  }
                                }
                              }}
                              className="rounded border-white/20 accent-green-500"
                            />
                            <div className="flex items-center gap-2 min-w-0">
                              {isSelected && <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />}
                              <span className="text-xs font-medium text-foreground truncate">{g.subject}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                    {notifySelectedGroups.length > 0 && (
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-green-500/10 border border-green-500/20">
                        <span className="text-xs font-medium text-green-400">📌 {notifySelectedGroups.length} grupo(s) selecionado(s)</span>
                        <button type="button" onClick={() => { setNotifySelectedGroups([]); setNotifyGroupJid(''); setNotifyGroupName(''); }} className="text-xs text-red-400 hover:text-red-300">Limpar todos</button>
                      </div>
                    )}
                  </div>
                ) : notifySelectedGroups.length > 0 ? (
                  <div className="space-y-1.5">
                    {notifySelectedGroups.map(g => (
                      <div key={g.id} className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08]">
                        <span className="text-xs text-foreground">📌 {g.subject}</span>
                        <button type="button" onClick={() => {
                          const updated = notifySelectedGroups.filter(sg => sg.id !== g.id);
                          setNotifySelectedGroups(updated);
                          if (notifyGroupJid === g.id) {
                            setNotifyGroupJid(updated[0]?.id || '');
                            setNotifyGroupName(updated[0]?.subject || '');
                          }
                        }} className="text-xs text-red-400 hover:text-red-300">Remover</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground/60">Configure a API acima e clique em "Buscar Grupos"</p>
                )}
              </GlassCard>

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
                {/* Source mode toggle */}
                <div className="flex gap-2">
                  <button onClick={() => setWhatsappSourceMode('base')} className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${whatsappSourceMode === 'base' ? 'bg-primary/15 text-primary border-primary/20' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground'}`}>
                    📋 Base
                  </button>
                  <button onClick={() => setWhatsappSourceMode('csv')} className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${whatsappSourceMode === 'csv' ? 'bg-primary/15 text-primary border-primary/20' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground'}`}>
                    <span className="flex items-center justify-center gap-1.5"><Upload size={14} /> CSV Externo</span>
                  </button>
                </div>

                {whatsappSourceMode === 'base' ? (
                  <>
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
                          <input type="text" value={whatsappSearch} onChange={e => setWhatsappSearch(e.target.value)} placeholder="Buscar por nome ou telefone..." className="w-full pl-8 pr-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground" />
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
                                  if (e.target.checked) { setSelectedWhatsappPhones(prev => [...new Set([...prev, ...filteredPhones])]); }
                                  else { setSelectedWhatsappPhones(prev => prev.filter(p => !filteredPhones.includes(p))); }
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
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <input ref={csvInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleCsvUpload} />
                      <button onClick={() => csvInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-white/20 bg-white/[0.04] text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition">
                        <Upload size={14} /> Importar CSV
                      </button>
                      <button onClick={fetchWaContacts} disabled={waContactsLoading} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-green-500/30 bg-green-500/5 text-sm text-green-400 hover:text-green-300 hover:border-green-400/40 transition disabled:opacity-50">
                        {waContactsLoading ? <div className="w-3.5 h-3.5 border-2 border-green-400 border-t-transparent rounded-full animate-spin" /> : <MessageCircle size={14} />} Contatos WhatsApp
                      </button>
                      <button onClick={() => setShowCreateGroup(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-primary/30 bg-primary/5 text-sm text-primary hover:text-primary/80 transition">
                        <Plus size={14} /> Criar Grupo
                      </button>
                      {csvContacts.length > 0 && (
                        <button onClick={() => clearPersistedCsvContacts(selectedGroup !== '__all__' ? selectedGroup : undefined)} className="px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-xs text-muted-foreground hover:text-red-400 transition" title={selectedGroup !== '__all__' ? `Remover grupo "${selectedGroup}"` : 'Limpar todos'}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    {contactGroups.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button onClick={() => setSelectedGroup('__all__')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${selectedGroup === '__all__' ? 'bg-primary/15 text-primary border-primary/20' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground'}`}>
                            Todos ({csvContacts.length})
                          </button>
                          {contactGroups.map(g => (
                            <div key={g} className="relative group/grp flex items-center">
                              {editingGroup === g ? (
                                <div className="flex items-center gap-1">
                                  <input type="text" value={editingGroupName} onChange={e => setEditingGroupName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleRenameGroup(g); if (e.key === 'Escape') setEditingGroup(null); }} className="px-2 py-1 rounded-lg border border-primary/30 bg-white/[0.06] text-foreground text-xs w-24 focus:outline-none focus:ring-1 focus:ring-primary/40" autoFocus />
                                  <button onClick={() => handleRenameGroup(g)} className="p-1 rounded text-primary hover:bg-primary/10 transition"><CheckCircle2 size={12} /></button>
                                  <button onClick={() => setEditingGroup(null)} className="p-1 rounded text-muted-foreground hover:text-foreground transition"><X size={12} /></button>
                                </div>
                              ) : (
                                <button onClick={() => setSelectedGroup(g)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${selectedGroup === g ? 'bg-primary/15 text-primary border-primary/20' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground'}`}>
                                  {g} ({csvContacts.filter(c => c.group_name === g).length})
                                </button>
                              )}
                              {editingGroup !== g && (
                                <div className="hidden group-hover/grp:flex items-center gap-0.5 ml-0.5">
                                  <button onClick={(e) => { e.stopPropagation(); setEditingGroup(g); setEditingGroupName(g); }} className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition" title="Renomear"><Pencil size={10} /></button>
                                  <button onClick={(e) => { e.stopPropagation(); handleDeleteGroup(g); }} className="p-1 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition" title="Remover grupo"><Trash2 size={10} /></button>
                                </div>
                              )}
                            </div>
                          ))}
                          {csvContacts.filter(c => !c.group_name).length > 0 && (
                            <button onClick={() => setSelectedGroup('')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${selectedGroup === '' ? 'bg-primary/15 text-primary border-primary/20' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground'}`}>
                              Sem grupo ({csvContacts.filter(c => !c.group_name).length})
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">Importar para:</span>
                          <select value={importTargetGroup} onChange={e => setImportTargetGroup(e.target.value)} className="px-2 py-1 rounded-lg border border-white/[0.08] bg-white/[0.04] text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary/40">
                            <option value="">Sem grupo</option>
                            {contactGroups.map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                        </div>
                      </div>
                    )}

                    {showCreateGroup && (
                      <div className="flex items-center gap-2 p-3 rounded-xl border border-primary/20 bg-primary/5">
                        <input type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateGroup()} placeholder="Nome do grupo..." className="flex-1 px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" autoFocus />
                        <button onClick={handleCreateGroup} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition">Criar</button>
                        <button onClick={() => { setShowCreateGroup(false); setNewGroupName(''); }} className="px-2 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground transition"><X size={14} /></button>
                      </div>
                    )}

                    <p className="text-[10px] text-muted-foreground">CSV: colunas <code className="bg-white/10 px-1 rounded">lead</code>,<code className="bg-white/10 px-1 rounded">numero</code> · Contatos sincronizados entre SMS e WhatsApp</p>

                    {(() => {
                      let groupFiltered = csvContacts;
                      if (selectedGroup !== '__all__') {
                        groupFiltered = csvContacts.filter(c => c.group_name === selectedGroup);
                      }
                      const merged: { lead: string; numero: string; group_name: string }[] = [...groupFiltered];
                      if (selectedGroup === '__all__') {
                        const existingNums = new Set(csvContacts.map(c => c.numero));
                        for (const wc of waContacts) { if (!existingNums.has(wc.numero)) merged.push({ ...wc, group_name: '' }); }
                      }
                      const filtered = csvSearchTerm ? merged.filter(c => c.lead.toLowerCase().includes(csvSearchTerm.toLowerCase()) || c.numero.includes(csvSearchTerm)) : merged;
                      const allSelected = filtered.length > 0 && filtered.every(c => selectedCsvContacts.includes(c.numero));
                      if (merged.length === 0) return null;
                      return (
                        <div className="space-y-2">
                          <input type="text" value={csvSearchTerm} onChange={e => setCsvSearchTerm(e.target.value)} placeholder="Buscar por nome ou número..." className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
                          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
                            <label className="flex items-center gap-2.5 px-3 py-2.5 border-b border-white/[0.08] bg-white/[0.04] cursor-pointer hover:bg-white/[0.06] transition">
                              <input type="checkbox" checked={allSelected} onChange={e => {
                                if (e.target.checked) setSelectedCsvContacts(prev => [...new Set([...prev, ...filtered.map(c => c.numero)])]);
                                else setSelectedCsvContacts(prev => prev.filter(n => !filtered.some(c => c.numero === n)));
                              }} className="rounded border-white/20" />
                              <span className="text-sm font-medium text-foreground">Selecionar todos</span>
                              <span className="text-xs text-muted-foreground ml-auto">{selectedCsvContacts.filter(n => filtered.some(c => c.numero === n)).length}/{merged.length}</span>
                            </label>
                            <div className="max-h-48 overflow-y-auto p-2 space-y-0.5">
                              {filtered.map((c, i) => (
                                <label key={`${c.numero}-${i}`} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.04] cursor-pointer transition">
                                  <input type="checkbox" checked={selectedCsvContacts.includes(c.numero)} onChange={e => { if (e.target.checked) setSelectedCsvContacts(prev => [...prev, c.numero]); else setSelectedCsvContacts(prev => prev.filter(n => n !== c.numero)); }} className="rounded border-white/20" />
                                  <span className="text-sm text-foreground">{c.lead || 'Sem nome'}</span>
                                  {c.group_name && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">{c.group_name}</span>}
                                  <span className="text-xs text-muted-foreground ml-auto">{c.numero}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </GlassCard>

              <GlassCard className="p-5 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><MessageCircle size={16} className="text-green-400" /> Mensagem</h3>
                <textarea value={whatsappMessage} onChange={e => setWhatsappMessage(e.target.value)} rows={4} placeholder="Digite a mensagem (ou legenda da mídia)..." className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm resize-y focus:outline-none focus:ring-1 focus:ring-primary/40" />

                {/* Media attachment */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <input ref={whatsappMediaInputRef} type="file" accept="image/*,video/*,audio/*" className="hidden" onChange={handleWhatsappMediaUpload} />
                    <button onClick={() => whatsappMediaInputRef.current?.click()} disabled={whatsappMediaUploading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground text-xs transition">
                      {whatsappMediaUploading ? <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Paperclip size={14} />}
                      {whatsappMediaUploading ? 'Enviando...' : 'Anexar mídia'}
                    </button>
                    <input ref={whatsappPttInputRef} type="file" accept=".ogg,.mp3,.wav,.m4a,.aac,audio/*" className="hidden" onChange={handleWhatsappPttUpload} />
                    <button onClick={() => whatsappPttInputRef.current?.click()} disabled={whatsappMediaUploading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-500/20 bg-green-500/5 text-green-400 hover:text-green-300 text-xs transition">
                      <Mic size={14} />
                      Áudio de voz
                    </button>
                    {whatsappMedia && (
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${whatsappMedia.ptt ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-primary/20 bg-primary/5 text-primary'}`}>
                        {whatsappMedia.ptt ? <Mic size={14} /> : whatsappMedia.mediatype === 'image' ? <Image size={14} /> : whatsappMedia.mediatype === 'video' ? <Film size={14} /> : whatsappMedia.mediatype === 'audio' ? <Mic size={14} /> : <Paperclip size={14} />}
                        <span className="truncate max-w-[150px]">{whatsappMedia.ptt ? '🎤 Voz' : ''} {whatsappMedia.fileName}</span>
                        <button onClick={() => setWhatsappMedia(null)} className="text-red-400 hover:text-red-300"><X size={14} /></button>
                      </div>
                    )}
                  </div>

                  {/* Mention all toggle */}
                  <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                    <input type="checkbox" checked={whatsappMentionAll} onChange={e => setWhatsappMentionAll(e.target.checked)} className="rounded border-white/20 bg-white/[0.04]" />
                    <span className="text-muted-foreground">Marcar todos do grupo (@todos)</span>
                  </label>
                </div>

                {/* Poll editor (only relevant when sending to groups) */}
                {(notifySelectedGroups.length > 0 || notifySelectedGroups2.length > 0) && (
                  <div className="space-y-2 border border-white/[0.08] rounded-xl p-3 bg-white/[0.02]">
                    <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                      <input type="checkbox" checked={groupPoll.enabled} onChange={e => setGroupPoll(p => ({ ...p, enabled: e.target.checked }))} className="rounded border-white/20 bg-white/[0.04]" />
                      <BarChart3 size={14} className="text-blue-400" />
                      <span className="text-foreground font-medium">Enviar como enquete (apenas para grupos)</span>
                    </label>
                    {groupPoll.enabled && (
                      <div className="space-y-2 pl-1">
                        <input
                          type="text"
                          value={groupPoll.name}
                          onChange={e => setGroupPoll(p => ({ ...p, name: e.target.value }))}
                          maxLength={255}
                          placeholder="Pergunta da enquete"
                          className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
                        />
                        <div className="space-y-1.5">
                          {groupPoll.values.map((v, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={v}
                                onChange={e => setGroupPoll(p => { const nv = [...p.values]; nv[idx] = e.target.value; return { ...p, values: nv }; })}
                                maxLength={100}
                                placeholder={`Opção ${idx + 1}`}
                                className="flex-1 px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
                              />
                              {groupPoll.values.length > 2 && (
                                <button type="button" onClick={() => setGroupPoll(p => ({ ...p, values: p.values.filter((_, i) => i !== idx) }))} className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition">
                                  <X size={14} />
                                </button>
                              )}
                            </div>
                          ))}
                          {groupPoll.values.length < 12 && (
                            <button type="button" onClick={() => setGroupPoll(p => ({ ...p, values: [...p.values, ''] }))} className="flex items-center gap-1 px-2 py-1 text-xs text-primary hover:text-primary/80 transition">
                              <Plus size={12} /> Adicionar opção
                            </button>
                          )}
                        </div>
                        <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                          <input type="checkbox" checked={groupPoll.multi} onChange={e => setGroupPoll(p => ({ ...p, multi: e.target.checked }))} className="rounded border-white/20 bg-white/[0.04]" />
                          <span className="text-muted-foreground">Permitir múltiplas respostas</span>
                        </label>
                      </div>
                    )}
                  </div>
                )}

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

              <BulkSendProgress total={whatsappProgress.total} sent={whatsappProgress.sent} errors={whatsappProgress.errors} skipped={whatsappProgress.skipped} label="Disparo de WhatsApp" accent="green" />
              <BulkSendControls control={whatsappCtrl.active ? whatsappCtrl : whatsappGroupCtrl} visible={whatsappSending} />

              <button
                onClick={async () => {
                  if (!evolutionApiUrl || !evolutionApiKey || !evolutionInstance) { toast.error('Configure as credenciais da Evolution API'); setShowWhatsappConfig(true); return; }
                  let waPhoneList: { phone: string; name: string }[] = [];
                  if (whatsappSourceMode === 'csv') {
                    waPhoneList = getSelectedExternalPhoneList();
                  } else {
                    const usersWithPhone = users.filter(u => u.phone && u.phone.replace(/\D/g, '').length >= 10 && (!excludeBulkSent || !bulkSentPhones.has(u.phone)));
                    waPhoneList = (whatsappTarget === 'all' ? usersWithPhone : usersWithPhone.filter(u => selectedWhatsappPhones.includes(u.phone))).map(u => ({ phone: u.phone, name: u.name }));
                  }
                  const phones = waPhoneList.map(p => p.phone);
                  if (phones.length === 0) { toast.error('Nenhum destinatário'); return; }
                  if (!whatsappMessage.trim() && !whatsappMedia) { toast.error('Digite a mensagem ou anexe uma mídia'); return; }
                  if (!await confirmDialog({ title: 'Confirmar disparo de WhatsApp', message: `Enviar esta mensagem para ${phones.length} contato(s)?`, variant: 'info', confirmLabel: 'Disparar' })) return;
                  setWhatsappSending(true);
                  setWhatsappProgress({ total: phones.length, sent: 0, errors: 0, skipped: 0 });
                  whatsappCtrl.start();
                  let sent = 0, errors = 0;
                  for (let i = 0; i < phones.length; i++) {
                    if (await whatsappCtrl.shouldStop()) break;
                    const phone = phones[i];
                    const matchedUser = waPhoneList.find(p => p.phone === phone);
                    try {
                      const { data: respData, error } = await supabase.functions.invoke('send-whatsapp', { body: { recipientPhone: phone, message: whatsappMessage, evolutionApiUrl, evolutionApiKey, evolutionInstance, media: whatsappMedia || undefined, mentionsEveryOne: whatsappMentionAll || undefined } });
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
                      if (hasError) { errors++; setWhatsappProgress(p => ({ ...p, errors: p.errors + 1 })); }
                      else { sent++; setWhatsappProgress(p => ({ ...p, sent: p.sent + 1 })); }
                    } catch (e: any) {
                      errors++;
                      setWhatsappProgress(p => ({ ...p, errors: p.errors + 1 }));
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
                  whatsappCtrl.finish();
                  setWhatsappSending(false);
                  if (errors > 0) toast.error(`${sent} enviado(s), ${errors} erro(s)`);
                  else toast.success(`${sent} mensagem(ns) enviada(s)!`);
                  setTimeout(() => setWhatsappProgress(emptyProgress), 4000);
                }}
                disabled={whatsappSending}
                className="w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-sm disabled:opacity-50 transition-all shadow-lg shadow-green-600/20 flex items-center justify-center gap-2"
              >
                {whatsappSending ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Enviando...</> : <><Send size={16} /> Enviar WhatsApp</>}
              </button>

              {/* Send to Group(s) button */}
              {notifySelectedGroups.length > 0 && (
                <button
                  onClick={async () => {
                    if (!evolutionApiUrl || !evolutionApiKey || !evolutionInstance) { toast.error('Configure as credenciais da Evolution API'); setShowWhatsappConfig(true); return; }
                    const pollPayload = groupPoll.enabled ? (() => {
                      const opts = groupPoll.values.map(v => v.trim()).filter(Boolean);
                      if (!groupPoll.name.trim()) { toast.error('Informe a pergunta da enquete'); return null; }
                      if (opts.length < 2) { toast.error('A enquete precisa de pelo menos 2 opções'); return null; }
                      return { name: groupPoll.name.trim(), values: opts, selectableCount: groupPoll.multi ? opts.length : 1 };
                    })() : null;
                    if (groupPoll.enabled && !pollPayload) return;
                    if (!pollPayload && !whatsappMessage.trim() && !whatsappMedia) { toast.error('Digite a mensagem ou anexe uma mídia'); return; }
                    if (!await confirmDialog({ title: pollPayload ? 'Confirmar enquete para Grupos' : 'Confirmar disparo para Grupos', message: pollPayload ? `Enviar enquete para ${notifySelectedGroups.length} grupo(s)?` : `Enviar esta mensagem para ${notifySelectedGroups.length} grupo(s)?`, variant: 'info', confirmLabel: 'Disparar' })) return;
                    setWhatsappSending(true);
                    setWhatsappProgress({ total: notifySelectedGroups.length, sent: 0, errors: 0, skipped: 0 });
                    whatsappGroupCtrl.start();
                    let sent = 0, errors = 0;
                    for (const group of notifySelectedGroups) {
                      if (await whatsappGroupCtrl.shouldStop()) break;
                      try {
                        const { data: respData, error } = await supabase.functions.invoke('send-whatsapp', {
                          body: { recipientPhone: group.id, message: pollPayload ? '' : whatsappMessage, evolutionApiUrl, evolutionApiKey, evolutionInstance, media: pollPayload ? undefined : (whatsappMedia || undefined), mentionsEveryOne: whatsappMentionAll || undefined, poll: pollPayload || undefined }
                        });
                        const hasError = !!error || !!respData?.error;
                        if (hasError) { errors++; setWhatsappProgress(p => ({ ...p, errors: p.errors + 1 })); }
                        else { sent++; setWhatsappProgress(p => ({ ...p, sent: p.sent + 1 })); }
                      } catch {
                        errors++;
                        setWhatsappProgress(p => ({ ...p, errors: p.errors + 1 }));
                      }
                    }
                    whatsappGroupCtrl.finish();
                    setWhatsappSending(false);
                    if (errors > 0) toast.error(`${sent} grupo(s) enviado(s), ${errors} erro(s)`);
                    else toast.success(pollPayload ? `Enquete enviada para ${sent} grupo(s)!` : `Mensagem enviada para ${sent} grupo(s)!`);
                    setTimeout(() => setWhatsappProgress(emptyProgress), 4000);
                  }}
                  disabled={whatsappSending}
                  className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm disabled:opacity-50 transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                >
                  {whatsappSending ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Enviando...</> : <><Users size={16} /> Enviar para {notifySelectedGroups.length} Grupo(s)</>}
                </button>
               )}

              {/* ── Agendamento de Mensagens ── */}
              <GlassCard className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Clock size={16} /> Agendamento de Mensagens</h3>
                  <button onClick={() => { setShowScheduler(!showScheduler); if (!showScheduler) fetchScheduledMessages(); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition ${showScheduler ? 'border-primary/30 bg-primary/10 text-primary' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground'}`}>
                    {showScheduler ? 'Fechar' : 'Abrir'}
                  </button>
                </div>

                {showScheduler && (
                  <div className="space-y-4">
                    {/* Form */}
                    <div className="space-y-3 border border-white/[0.08] rounded-xl p-4 bg-white/[0.02]">
                      <textarea value={schedForm.message} onChange={e => setSchedForm(f => ({ ...f, message: e.target.value }))} rows={3} placeholder="Mensagem agendada (ou apenas mídia)..." className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm resize-y focus:outline-none focus:ring-1 focus:ring-primary/40" disabled={schedForm.pollEnabled} />

                      {/* Poll editor (groups only) */}
                      {schedForm.recipientType === 'group' && (
                        <div className="space-y-2 border border-white/[0.08] rounded-xl p-3 bg-white/[0.02]">
                          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                            <input type="checkbox" checked={schedForm.pollEnabled} onChange={e => setSchedForm(f => ({ ...f, pollEnabled: e.target.checked }))} className="rounded border-white/20 bg-white/[0.04]" />
                            <BarChart3 size={14} className="text-blue-400" />
                            <span className="text-foreground font-medium">Agendar enquete (apenas grupos)</span>
                          </label>
                          {schedForm.pollEnabled && (
                            <div className="space-y-2">
                              <input type="text" value={schedForm.pollName} onChange={e => setSchedForm(f => ({ ...f, pollName: e.target.value }))} maxLength={255} placeholder="Pergunta da enquete" className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
                              <div className="space-y-1.5">
                                {schedForm.pollValues.map((v, idx) => (
                                  <div key={idx} className="flex items-center gap-2">
                                    <input type="text" value={v} onChange={e => setSchedForm(f => { const nv = [...f.pollValues]; nv[idx] = e.target.value; return { ...f, pollValues: nv }; })} maxLength={100} placeholder={`Opção ${idx + 1}`} className="flex-1 px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
                                    {schedForm.pollValues.length > 2 && (
                                      <button type="button" onClick={() => setSchedForm(f => ({ ...f, pollValues: f.pollValues.filter((_, i) => i !== idx) }))} className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition"><X size={14} /></button>
                                    )}
                                  </div>
                                ))}
                                {schedForm.pollValues.length < 12 && (
                                  <button type="button" onClick={() => setSchedForm(f => ({ ...f, pollValues: [...f.pollValues, ''] }))} className="flex items-center gap-1 px-2 py-1 text-xs text-primary hover:text-primary/80 transition"><Plus size={12} /> Adicionar opção</button>
                                )}
                              </div>
                              <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                                <input type="checkbox" checked={schedForm.pollMulti} onChange={e => setSchedForm(f => ({ ...f, pollMulti: e.target.checked }))} className="rounded border-white/20 bg-white/[0.04]" />
                                <span className="text-muted-foreground">Permitir múltiplas respostas</span>
                              </label>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Media attachment for scheduler */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <input type="file" ref={schedMediaInputRef} className="hidden" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={handleSchedMediaUpload} />
                        <button type="button" onClick={() => schedMediaInputRef.current?.click()} disabled={schedMediaUploading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground text-xs transition">
                          {schedMediaUploading ? <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Paperclip size={14} />}
                          Anexar mídia
                        </button>
                        <input type="file" ref={schedPttInputRef} className="hidden" accept=".ogg,.mp3,.wav,.m4a,.aac,audio/*" onChange={handleSchedPttUpload} />
                        <button type="button" onClick={() => schedPttInputRef.current?.click()} disabled={schedMediaUploading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-500/20 bg-green-500/5 text-green-400 hover:text-green-300 text-xs transition">
                          <Mic size={14} />
                          Áudio de voz
                        </button>
                        {schedMedia && (
                          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs ${schedMedia.ptt ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-primary/10 border border-primary/20 text-primary'}`}>
                            {schedMedia.ptt ? <Mic size={12} /> : schedMedia.mediatype === 'image' ? <ImageIcon size={12} /> : schedMedia.mediatype === 'video' ? <Video size={12} /> : <FileAudio size={12} />}
                            <span className="truncate max-w-[120px]">{schedMedia.ptt ? '🎤 Voz' : ''} {schedMedia.fileName}</span>
                            <button onClick={() => setSchedMedia(null)} className="ml-1 text-red-400 hover:text-red-300"><X size={12} /></button>
                          </div>
                        )}
                        {schedForm.recipientType === 'group' && (
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer ml-auto">
                            <input type="checkbox" checked={schedForm.mentionAll} onChange={e => setSchedForm(f => ({ ...f, mentionAll: e.target.checked }))} className="rounded border-white/20" />
                            @todos
                          </label>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground font-medium">Tipo</label>
                          <select value={schedForm.recipientType} onChange={e => setSchedForm(f => ({ ...f, recipientType: e.target.value as any, recipientValue: '', recipientLabel: '', selectedGroups: [] }))} className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm">
                            <option value="individual">Inscrito</option>
                            <option value="group">Grupo(s)</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground font-medium">Destinatário</label>
                          {schedForm.recipientType === 'individual' ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm text-left truncate">
                                  {schedForm.recipientValue ? `${schedForm.recipientLabel || schedForm.recipientValue}` : 'Selecione...'}
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-72 p-2 space-y-1" align="start">
                                <input
                                  type="text"
                                  placeholder="Buscar por nome, telefone ou email..."
                                  className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-foreground text-xs mb-1 outline-none focus:ring-1 focus:ring-primary"
                                  onChange={e => {
                                    const el = e.target;
                                    el.setAttribute('data-search', el.value.toLowerCase());
                                    const items = el.parentElement?.querySelectorAll('[data-sched-user]');
                                    items?.forEach((item: any) => {
                                      const text = item.getAttribute('data-sched-user') || '';
                                      item.style.display = text.includes(el.value.toLowerCase()) ? '' : 'none';
                                    });
                                  }}
                                />
                                <div className="max-h-48 overflow-y-auto space-y-0.5">
                                  {users.filter(u => u.phone).map(u => (
                                    <button
                                      key={u.id}
                                      data-sched-user={`${u.name} ${u.phone} ${u.email}`.toLowerCase()}
                                      className={`w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-white/[0.06] cursor-pointer truncate ${schedForm.recipientValue === u.phone ? 'bg-primary/20 text-primary' : 'text-foreground'}`}
                                      onClick={() => setSchedForm(f => ({ ...f, recipientValue: u.phone, recipientLabel: u.name }))}
                                    >
                                      <span className="font-medium">{u.name}</span>
                                      <span className="text-muted-foreground ml-1">({u.phone})</span>
                                    </button>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                          ) : (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm text-left truncate">
                                  {schedForm.selectedGroups.length > 0 ? `${schedForm.selectedGroups.length} grupo(s)` : 'Selecione...'}
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-64 max-h-60 overflow-y-auto p-2 space-y-1" align="start">
                                {notifyGroups.map(g => {
                                  const checked = schedForm.selectedGroups.some(sg => sg.id === g.id);
                                  return (
                                    <label key={g.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.06] cursor-pointer text-xs text-foreground">
                                      <Checkbox checked={checked} onCheckedChange={() => {
                                        setSchedForm(f => {
                                          const exists = f.selectedGroups.some(sg => sg.id === g.id);
                                          const selectedGroups = exists ? f.selectedGroups.filter(sg => sg.id !== g.id) : [...f.selectedGroups, { id: g.id, name: g.subject }];
                                          return { ...f, selectedGroups };
                                        });
                                      }} />
                                      {g.subject}
                                    </label>
                                  );
                                })}
                              </PopoverContent>
                            </Popover>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground font-medium">Data</label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm text-left flex items-center gap-2">
                                <CalendarIcon size={14} className="text-muted-foreground" />
                                {schedForm.date ? schedForm.date.toLocaleDateString('pt-BR') : 'Selecione'}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar mode="single" selected={schedForm.date} onSelect={d => setSchedForm(f => ({ ...f, date: d || undefined }))} className="p-3 pointer-events-auto" />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground font-medium">Horário</label>
                          <input type="time" value={schedForm.time} onChange={e => setSchedForm(f => ({ ...f, time: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground font-medium">Recorrência</label>
                          <select value={schedForm.recurrence} onChange={e => setSchedForm(f => ({ ...f, recurrence: e.target.value as any }))} className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm">
                            <option value="none">Única vez</option>
                            <option value="daily">Diário</option>
                            <option value="weekly">Semanal</option>
                            <option value="monthly">Mensal</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {editingScheduleId && (
                          <button onClick={resetSchedForm} className="px-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground font-medium text-sm transition-all">
                            Cancelar edição
                          </button>
                        )}
                        <button onClick={saveScheduledMessage} disabled={schedSaving} className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/80 text-primary-foreground font-bold text-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                          {schedSaving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Salvando...</> : editingScheduleId ? <><Pencil size={16} /> Atualizar Agendamento</> : <><Clock size={16} /> Agendar Mensagem</>}
                        </button>
                      </div>
                    </div>

                    {/* List */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground">Mensagens agendadas</h4>
                      {scheduledLoading ? (
                        <p className="text-xs text-muted-foreground text-center py-4">Carregando...</p>
                      ) : scheduledMessages.filter((m: any) => (m.channel || 'whatsapp') === 'whatsapp').length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">Nenhum agendamento</p>
                      ) : (
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                          {scheduledMessages.filter((m: any) => (m.channel || 'whatsapp') === 'whatsapp').map((m: any) => (
                            <div key={m.id} className={`p-3 rounded-xl border text-xs space-y-1 ${m.status === 'pending' ? 'border-primary/20 bg-primary/5' : m.status === 'sent' ? 'border-green-500/20 bg-green-500/5' : m.status === 'cancelled' ? 'border-muted/20 bg-muted/5 opacity-60' : 'border-red-500/20 bg-red-500/5'}`}>
                              <div className="flex justify-between items-start">
                                <span className="font-medium text-foreground truncate max-w-[70%]">{m.recipient_label || m.recipient_value}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${m.status === 'pending' ? 'bg-primary/20 text-primary' : m.status === 'sent' ? 'bg-green-500/20 text-green-400' : m.status === 'cancelled' ? 'bg-muted/20 text-muted-foreground' : 'bg-red-500/20 text-red-400'}`}>
                                  {m.status === 'pending' ? '⏳ Pendente' : m.status === 'sent' ? '✅ Enviado' : m.status === 'cancelled' ? '🚫 Cancelado' : '❌ Falhou'}
                                </span>
                              </div>
                              <p className="text-muted-foreground line-clamp-2">{m.message}</p>
                              <div className="flex justify-between items-center text-muted-foreground">
                                <span>📅 {new Date(m.next_run_at || m.scheduled_at).toLocaleString('pt-BR')} {m.recurrence !== 'none' && `• 🔁 ${m.recurrence === 'daily' ? 'Diário' : m.recurrence === 'weekly' ? 'Semanal' : 'Mensal'}`}</span>
                                {m.status === 'pending' && (
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => startEditSchedule(m)} className="text-primary hover:text-primary/80 font-medium flex items-center gap-1"><Pencil size={12} /> Editar</button>
                                    <button onClick={() => cancelScheduledMessage(m.id)} className="text-red-400 hover:text-red-300 font-medium">Cancelar</button>
                                  </div>
                                )}
                                {(m.status === 'failed' || m.status === 'cancelled') && (
                                  <div className="flex items-center gap-2">
                                    <button onClick={async () => {
                                      const nextRun = new Date();
                                      nextRun.setMinutes(nextRun.getMinutes() + 1);
                                      await supabase.from('scheduled_messages').update({ status: 'pending', next_run_at: nextRun.toISOString(), updated_at: new Date().toISOString() } as any).eq('id', m.id);
                                      toast.success('Mensagem reagendada para reenvio');
                                      fetchScheduledMessages();
                                    }} className="text-primary hover:text-primary/80 font-medium flex items-center gap-1"><RefreshCw size={12} /> Reenviar</button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </GlassCard>
            </div>
          )}

          {/* ══════ WHATSAPP 2 TAB ══════ */}
          {activeTab === 'whatsapp2' && (
            <div className="max-w-2xl space-y-5">
              <div className="flex items-center gap-2 justify-end">
                <button onClick={() => { setShowWhatsappHistory2(!showWhatsappHistory2); if (!showWhatsappHistory2) fetchWhatsappLogs2(); }} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm transition ${showWhatsappHistory2 ? 'border-primary/30 bg-primary/10 text-primary' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground hover:bg-white/[0.08]'}`}>
                  <Clock size={15} /> Histórico
                </button>
                <button onClick={() => setShowWhatsappConfig2(!showWhatsappConfig2)} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm transition ${showWhatsappConfig2 ? 'border-primary/30 bg-primary/10 text-primary' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground hover:bg-white/[0.08]'}`}>
                  <Settings size={15} /> Configurar API
                </button>
              </div>

              {showWhatsappConfig2 && (
                <GlassCard className="p-5 space-y-4">
                  <h3 className="text-sm font-bold text-foreground">🔑 Evolution API</h3>
                  <p className="text-[10px] text-muted-foreground">Configure sua instância da <a href="https://doc.evolution-api.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">Evolution API</a></p>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">URL da API</label>
                    <input type="text" value={evolutionApiUrl2} onChange={e => setEvolutionApiUrl2(e.target.value)} placeholder="https://sua-api.com" className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/40" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">API Key</label>
                    <input type="password" value={evolutionApiKey2} onChange={e => setEvolutionApiKey2(e.target.value)} placeholder="••••••••" className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/40" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Nome da Instância</label>
                    <input type="text" value={evolutionInstance2} onChange={e => setEvolutionInstance2(e.target.value)} placeholder="minha-instancia" className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/40" />
                  </div>

                  <div className="border-t border-white/[0.06] pt-4 space-y-3">
                    <h4 className="text-xs font-semibold text-foreground">📱 Gerenciar Instância</h4>

                    <div className="flex gap-2 flex-wrap">
                      {/* Criar Instância */}
                      <button
                        disabled={!evolutionApiUrl2 || !evolutionApiKey2 || !evolutionInstance2 || creatingInstance2}
                        onClick={async () => {
                          setCreatingInstance2(true);
                          try {
                            const { data, error } = await supabase.functions.invoke('evolution-proxy', {
                              body: { action: 'create', evolutionApiUrl: evolutionApiUrl2, evolutionApiKey: evolutionApiKey2, evolutionInstance: evolutionInstance2 }
                            });
                            const msg = data?.error || data?.data?.error || data?.data?.response?.message || data?.data?.message || error?.message || 'Erro ao criar instância';
                            if (error || !data?.ok) {
                              toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
                              setInstanceStatus2('error');
                              return;
                            }
                            const d = data.data;
                            toast.success('Instância criada com sucesso!');
                            if (d?.qrcode?.base64) {
                              setInstanceQrCode2(d.qrcode.base64);
                              setInstanceStatus2('connecting');
                            } else {
                              setInstanceStatus2('close');
                            }
                          } catch (err: any) {
                            toast.error(err.message || 'Erro de conexão');
                            setInstanceStatus2('error');
                          } finally {
                            setCreatingInstance2(false);
                          }
                        }}
                        className="flex-1 min-w-[120px] px-3 py-2.5 rounded-xl text-xs font-semibold border border-white/[0.08] bg-white/[0.04] text-foreground hover:bg-white/[0.08] disabled:opacity-40 transition flex items-center justify-center gap-1.5"
                      >
                        <Plus size={14} /> {creatingInstance2 ? 'Criando...' : 'Criar Instância'}
                      </button>

                      {/* Conectar / QR Code */}
                      <button
                        disabled={!evolutionApiUrl2 || !evolutionApiKey2 || !evolutionInstance2 || instanceStatus2 === 'loading'}
                        onClick={async () => {
                          setInstanceStatus2('loading');
                          setInstanceQrCode2(null);
                          try {
                            const { data, error } = await supabase.functions.invoke('evolution-proxy', {
                              body: { action: 'connect', evolutionApiUrl: evolutionApiUrl2, evolutionApiKey: evolutionApiKey2, evolutionInstance: evolutionInstance2 }
                            });
                            const msg = data?.error || data?.data?.error || data?.data?.response?.message || data?.data?.message || error?.message || 'Erro ao conectar';
                            if (error || !data?.ok) {
                              toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
                              setInstanceStatus2('error');
                              return;
                            }
                            const d = data.data;
                            if (d?.base64) {
                              setInstanceQrCode2(d.base64);
                              setInstanceStatus2('connecting');
                              toast.info('Escaneie o QR Code no WhatsApp');
                            } else if (d?.instance?.state === 'open') {
                              setInstanceStatus2('open');
                              toast.success('WhatsApp já está conectado!');
                            } else {
                              setInstanceStatus2('close');
                              toast.info('Instância desconectada. Tente novamente.');
                            }
                          } catch (err: any) {
                            toast.error(err.message || 'Erro de conexão');
                            setInstanceStatus2('error');
                          }
                        }}
                        className="flex-1 min-w-[120px] px-3 py-2.5 rounded-xl text-xs font-semibold border border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20 disabled:opacity-40 transition flex items-center justify-center gap-1.5"
                      >
                        <Smartphone size={14} /> {instanceStatus2 === 'loading' ? 'Conectando...' : 'Conectar (QR Code)'}
                      </button>

                      {/* Verificar Status */}
                      <button
                        disabled={!evolutionApiUrl2 || !evolutionApiKey2 || !evolutionInstance2}
                        onClick={async () => {
                          setInstanceStatus2('loading');
                          try {
                            const { data, error } = await supabase.functions.invoke('evolution-proxy', {
                              body: { action: 'status', evolutionApiUrl: evolutionApiUrl2, evolutionApiKey: evolutionApiKey2, evolutionInstance: evolutionInstance2 }
                            });
                            const msg = data?.error || data?.data?.error || data?.data?.response?.message || data?.data?.message || error?.message || 'Erro ao verificar';
                            if (error || !data?.ok) {
                              toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
                              setInstanceStatus2('error');
                              return;
                            }
                            const d = data.data;
                            const state = d?.instance?.state || d?.state || 'unknown';
                            if (state === 'open') {
                              setInstanceStatus2('open');
                              toast.success('Status: 🟢 Conectado');
                            } else if (state === 'connecting') {
                              setInstanceStatus2('connecting');
                              toast.info('Status: 🟡 Aguardando leitura do QR Code');
                            } else {
                              setInstanceStatus2('close');
                              toast.info('Status: 🔴 Desconectado');
                            }
                          } catch (err: any) {
                            toast.error(err.message || 'Erro');
                            setInstanceStatus2('error');
                          }
                        }}
                        className="flex-1 min-w-[120px] px-3 py-2.5 rounded-xl text-xs font-semibold border border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground hover:bg-white/[0.08] disabled:opacity-40 transition flex items-center justify-center gap-1.5"
                      >
                        <RotateCcw size={14} /> Verificar Status
                      </button>

                      {/* Desconectar */}
                      <button
                        disabled={!evolutionApiUrl2 || !evolutionApiKey2 || !evolutionInstance2}
                        onClick={async () => {
                          try {
                            const { data, error } = await supabase.functions.invoke('evolution-proxy', {
                              body: { action: 'logout', evolutionApiUrl: evolutionApiUrl2, evolutionApiKey: evolutionApiKey2, evolutionInstance: evolutionInstance2 }
                            });
                            const msg = data?.error || data?.data?.error || data?.data?.response?.message || data?.data?.message || error?.message || 'Erro ao desconectar';
                            if (error || !data?.ok) {
                              toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
                              setInstanceStatus2('error');
                              return;
                            }
                            toast.success('WhatsApp desconectado');
                            setInstanceStatus2('close');
                            setInstanceQrCode2(null);
                          } catch (err: any) {
                            toast.error(err.message || 'Erro');
                            setInstanceStatus2('error');
                          }
                        }}
                        className="flex-1 min-w-[120px] px-3 py-2.5 rounded-xl text-xs font-semibold border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-40 transition flex items-center justify-center gap-1.5"
                      >
                        <LogOut size={14} /> Desconectar
                      </button>
                    </div>

                    {/* Status badge */}
                    <div className={`text-xs font-medium flex items-center gap-1.5 ${
                      instanceStatus2 === 'open' ? 'text-green-400' :
                      instanceStatus2 === 'connecting' ? 'text-yellow-400' :
                      instanceStatus2 === 'error' ? 'text-red-400' :
                      instanceStatus2 === 'close' ? 'text-orange-400' :
                      'text-muted-foreground'
                    }`}>
                      {instanceStatus2 === 'open' && '🟢 WhatsApp conectado'}
                      {instanceStatus2 === 'connecting' && '🟡 Aguardando leitura do QR Code...'}
                      {instanceStatus2 === 'close' && '🔴 Desconectado'}
                      {instanceStatus2 === 'error' && '❌ Erro na conexão'}
                      {instanceStatus2 === 'loading' && '⏳ Verificando...'}
                      {instanceStatus2 === 'unknown' && (evolutionApiUrl2 && evolutionApiKey2 && evolutionInstance2 ? '⚪ Clique em "Verificar Status"' : '⚠️ Preencha todas as credenciais')}
                    </div>

                    {/* QR Code display */}
                    {instanceQrCode2 && (
                      <div className="flex flex-col items-center gap-3 p-4 rounded-xl border border-white/[0.08] bg-white/[0.02]">
                        <p className="text-xs text-muted-foreground font-medium">Escaneie o QR Code com o WhatsApp</p>
                        <div className="bg-white p-3 rounded-xl">
                          <img src={instanceQrCode2.startsWith('data:') ? instanceQrCode2 : `data:image/png;base64,${instanceQrCode2}`} alt="QR Code WhatsApp" className="w-56 h-56" />
                        </div>
                        <p className="text-[10px] text-muted-foreground">Abra o WhatsApp → Menu (⋮) → Aparelhos conectados → Conectar aparelho</p>
                        <button onClick={() => { setInstanceQrCode2(null); setInstanceStatus2('unknown'); }} className="text-xs text-muted-foreground hover:text-foreground transition">
                          Fechar QR Code
                        </button>
                      </div>
                    )}
                  </div>
                </GlassCard>
              )}

              {/* ── Grupos WhatsApp ── */}
              <GlassCard className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                      <Users size={20} className="text-green-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Grupos WhatsApp</h3>
                      <p className="text-xs text-muted-foreground">Selecione um grupo para receber notificações automáticas</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!evolutionApiUrl2 || !evolutionApiKey2 || !evolutionInstance2 || notifyGroupsLoading2}
                    onClick={async () => {
                      setNotifyGroupsLoading2(true);
                      try {
                        const { data } = await supabase.functions.invoke('evolution-proxy', {
                          body: {
                            action: 'fetchGroups',
                            evolutionApiUrl: evolutionApiUrl2, evolutionApiKey: evolutionApiKey2, evolutionInstance: evolutionInstance2,
                          },
                        });
                        if (data?.ok && Array.isArray(data.data)) {
                          setNotifyGroups2(data.data.map((g: any) => ({ id: g.id, subject: g.subject || g.id })));
                          toast.success(`${data.data.length} grupo(s) encontrado(s)`);
                        } else {
                          toast.error('Erro ao buscar grupos. Verifique se a API está conectada.');
                        }
                      } catch {
                        toast.error('Erro ao buscar grupos');
                      }
                      setNotifyGroupsLoading2(false);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold border border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20 disabled:opacity-40 transition flex items-center gap-1.5"
                  >
                    <RotateCcw size={14} /> {notifyGroupsLoading2 ? 'Buscando...' : 'Buscar Grupos'}
                  </button>
                </div>

                {notifyGroups2.length > 0 ? (
                  <div className="space-y-2">
                    <div className="max-h-[200px] overflow-y-auto space-y-1.5 pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/[0.1] [&::-webkit-scrollbar-thumb]:rounded-full">
                      {notifyGroups2.map(g => {
                        const isSelected = notifySelectedGroups2.some(sg => sg.id === g.id);
                        return (
                          <label key={g.id} className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${isSelected ? 'bg-green-500/10 border-green-500/20' : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'}`}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                if (isSelected) {
                                  const updated = notifySelectedGroups2.filter(sg => sg.id !== g.id);
                                  setNotifySelectedGroups2(updated);
                                  if (notifyGroupJid2 === g.id) {
                                    setNotifyGroupJid2(updated[0]?.id || '');
                                    setNotifyGroupName2(updated[0]?.subject || '');
                                  }
                                } else {
                                  const updated = [...notifySelectedGroups2, g];
                                  setNotifySelectedGroups2(updated);
                                  if (!notifyGroupJid2) {
                                    setNotifyGroupJid2(g.id);
                                    setNotifyGroupName2(g.subject);
                                  }
                                }
                              }}
                              className="rounded border-white/20 accent-green-500"
                            />
                            <div className="flex items-center gap-2 min-w-0">
                              {isSelected && <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />}
                              <span className="text-xs font-medium text-foreground truncate">{g.subject}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                    {notifySelectedGroups2.length > 0 && (
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-green-500/10 border border-green-500/20">
                        <span className="text-xs font-medium text-green-400">📌 {notifySelectedGroups2.length} grupo(s) selecionado(s)</span>
                        <button type="button" onClick={() => { setNotifySelectedGroups2([]); setNotifyGroupJid2(''); setNotifyGroupName2(''); }} className="text-xs text-red-400 hover:text-red-300">Limpar todos</button>
                      </div>
                    )}
                  </div>
                ) : notifySelectedGroups2.length > 0 ? (
                  <div className="space-y-1.5">
                    {notifySelectedGroups2.map(g => (
                      <div key={g.id} className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08]">
                        <span className="text-xs text-foreground">📌 {g.subject}</span>
                        <button type="button" onClick={() => {
                          const updated = notifySelectedGroups2.filter(sg => sg.id !== g.id);
                          setNotifySelectedGroups2(updated);
                          if (notifyGroupJid2 === g.id) {
                            setNotifyGroupJid2(updated[0]?.id || '');
                            setNotifyGroupName2(updated[0]?.subject || '');
                          }
                        }} className="text-xs text-red-400 hover:text-red-300">Remover</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground/60">Configure a API acima e clique em "Buscar Grupos"</p>
                )}
              </GlassCard>

              {showWhatsappHistory2 && (
                <GlassCard className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Clock size={16} className="text-primary" /> Histórico de Mensagens</h3>
                    <button onClick={fetchWhatsappLogs2} className="text-xs text-muted-foreground hover:text-foreground transition flex items-center gap-1"><RotateCcw size={12} /> Atualizar</button>
                  </div>
                  {whatsappLogsLoading2 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm animate-pulse">Carregando histórico...</div>
                  ) : whatsappLogs2.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">Nenhuma mensagem enviada ainda.</div>
                  ) : (
                    <div className="max-h-[400px] overflow-y-auto space-y-2 pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/[0.1] [&::-webkit-scrollbar-thumb]:rounded-full">
                      {whatsappLogs2.map((log: any) => (
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
                {/* Source mode toggle */}
                <div className="flex gap-2">
                  <button onClick={() => setWhatsappSourceMode('base')} className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${whatsappSourceMode === 'base' ? 'bg-primary/15 text-primary border-primary/20' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground'}`}>
                    📋 Base
                  </button>
                  <button onClick={() => setWhatsappSourceMode('csv')} className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${whatsappSourceMode === 'csv' ? 'bg-primary/15 text-primary border-primary/20' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground'}`}>
                    <span className="flex items-center justify-center gap-1.5"><Upload size={14} /> CSV Externo</span>
                  </button>
                </div>

                {whatsappSourceMode === 'base' ? (
                  <>
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
                          <input type="text" value={whatsappSearch} onChange={e => setWhatsappSearch(e.target.value)} placeholder="Buscar por nome ou telefone..." className="w-full pl-8 pr-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground" />
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
                                  if (e.target.checked) { setSelectedWhatsappPhones(prev => [...new Set([...prev, ...filteredPhones])]); }
                                  else { setSelectedWhatsappPhones(prev => prev.filter(p => !filteredPhones.includes(p))); }
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
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <input ref={csvInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleCsvUpload} />
                      <button onClick={() => csvInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-white/20 bg-white/[0.04] text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition">
                        <Upload size={14} /> Importar CSV
                      </button>
                      <button onClick={fetchWaContacts} disabled={waContactsLoading} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-green-500/30 bg-green-500/5 text-sm text-green-400 hover:text-green-300 hover:border-green-400/40 transition disabled:opacity-50">
                        {waContactsLoading ? <div className="w-3.5 h-3.5 border-2 border-green-400 border-t-transparent rounded-full animate-spin" /> : <MessageCircle size={14} />} Contatos WhatsApp
                      </button>
                      <button onClick={() => setShowCreateGroup(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-primary/30 bg-primary/5 text-sm text-primary hover:text-primary/80 transition">
                        <Plus size={14} /> Criar Grupo
                      </button>
                      {csvContacts.length > 0 && (
                        <button onClick={() => clearPersistedCsvContacts(selectedGroup !== '__all__' ? selectedGroup : undefined)} className="px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-xs text-muted-foreground hover:text-red-400 transition" title={selectedGroup !== '__all__' ? `Remover grupo "${selectedGroup}"` : 'Limpar todos'}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    {contactGroups.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button onClick={() => setSelectedGroup('__all__')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${selectedGroup === '__all__' ? 'bg-primary/15 text-primary border-primary/20' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground'}`}>
                            Todos ({csvContacts.length})
                          </button>
                          {contactGroups.map(g => (
                            <div key={g} className="relative group/grp flex items-center">
                              {editingGroup === g ? (
                                <div className="flex items-center gap-1">
                                  <input type="text" value={editingGroupName} onChange={e => setEditingGroupName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleRenameGroup(g); if (e.key === 'Escape') setEditingGroup(null); }} className="px-2 py-1 rounded-lg border border-primary/30 bg-white/[0.06] text-foreground text-xs w-24 focus:outline-none focus:ring-1 focus:ring-primary/40" autoFocus />
                                  <button onClick={() => handleRenameGroup(g)} className="p-1 rounded text-primary hover:bg-primary/10 transition"><CheckCircle2 size={12} /></button>
                                  <button onClick={() => setEditingGroup(null)} className="p-1 rounded text-muted-foreground hover:text-foreground transition"><X size={12} /></button>
                                </div>
                              ) : (
                                <button onClick={() => setSelectedGroup(g)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${selectedGroup === g ? 'bg-primary/15 text-primary border-primary/20' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground'}`}>
                                  {g} ({csvContacts.filter(c => c.group_name === g).length})
                                </button>
                              )}
                              {editingGroup !== g && (
                                <div className="hidden group-hover/grp:flex items-center gap-0.5 ml-0.5">
                                  <button onClick={(e) => { e.stopPropagation(); setEditingGroup(g); setEditingGroupName(g); }} className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition" title="Renomear"><Pencil size={10} /></button>
                                  <button onClick={(e) => { e.stopPropagation(); handleDeleteGroup(g); }} className="p-1 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition" title="Remover grupo"><Trash2 size={10} /></button>
                                </div>
                              )}
                            </div>
                          ))}
                          {csvContacts.filter(c => !c.group_name).length > 0 && (
                            <button onClick={() => setSelectedGroup('')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${selectedGroup === '' ? 'bg-primary/15 text-primary border-primary/20' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground'}`}>
                              Sem grupo ({csvContacts.filter(c => !c.group_name).length})
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">Importar para:</span>
                          <select value={importTargetGroup} onChange={e => setImportTargetGroup(e.target.value)} className="px-2 py-1 rounded-lg border border-white/[0.08] bg-white/[0.04] text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary/40">
                            <option value="">Sem grupo</option>
                            {contactGroups.map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                        </div>
                      </div>
                    )}

                    {showCreateGroup && (
                      <div className="flex items-center gap-2 p-3 rounded-xl border border-primary/20 bg-primary/5">
                        <input type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateGroup()} placeholder="Nome do grupo..." className="flex-1 px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" autoFocus />
                        <button onClick={handleCreateGroup} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition">Criar</button>
                        <button onClick={() => { setShowCreateGroup(false); setNewGroupName(''); }} className="px-2 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground transition"><X size={14} /></button>
                      </div>
                    )}

                    <p className="text-[10px] text-muted-foreground">CSV: colunas <code className="bg-white/10 px-1 rounded">lead</code>,<code className="bg-white/10 px-1 rounded">numero</code> · Contatos sincronizados entre SMS e WhatsApp</p>

                    {(() => {
                      let groupFiltered = csvContacts;
                      if (selectedGroup !== '__all__') {
                        groupFiltered = csvContacts.filter(c => c.group_name === selectedGroup);
                      }
                      const merged: { lead: string; numero: string; group_name: string }[] = [...groupFiltered];
                      if (selectedGroup === '__all__') {
                        const existingNums = new Set(csvContacts.map(c => c.numero));
                        for (const wc of waContacts) { if (!existingNums.has(wc.numero)) merged.push({ ...wc, group_name: '' }); }
                      }
                      const filtered = csvSearchTerm ? merged.filter(c => c.lead.toLowerCase().includes(csvSearchTerm.toLowerCase()) || c.numero.includes(csvSearchTerm)) : merged;
                      const allSelected = filtered.length > 0 && filtered.every(c => selectedCsvContacts.includes(c.numero));
                      if (merged.length === 0) return null;
                      return (
                        <div className="space-y-2">
                          <input type="text" value={csvSearchTerm} onChange={e => setCsvSearchTerm(e.target.value)} placeholder="Buscar por nome ou número..." className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
                          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
                            <label className="flex items-center gap-2.5 px-3 py-2.5 border-b border-white/[0.08] bg-white/[0.04] cursor-pointer hover:bg-white/[0.06] transition">
                              <input type="checkbox" checked={allSelected} onChange={e => {
                                if (e.target.checked) setSelectedCsvContacts(prev => [...new Set([...prev, ...filtered.map(c => c.numero)])]);
                                else setSelectedCsvContacts(prev => prev.filter(n => !filtered.some(c => c.numero === n)));
                              }} className="rounded border-white/20" />
                              <span className="text-sm font-medium text-foreground">Selecionar todos</span>
                              <span className="text-xs text-muted-foreground ml-auto">{selectedCsvContacts.filter(n => filtered.some(c => c.numero === n)).length}/{merged.length}</span>
                            </label>
                            <div className="max-h-48 overflow-y-auto p-2 space-y-0.5">
                              {filtered.map((c, i) => (
                                <label key={`${c.numero}-${i}`} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.04] cursor-pointer transition">
                                  <input type="checkbox" checked={selectedCsvContacts.includes(c.numero)} onChange={e => { if (e.target.checked) setSelectedCsvContacts(prev => [...prev, c.numero]); else setSelectedCsvContacts(prev => prev.filter(n => n !== c.numero)); }} className="rounded border-white/20" />
                                  <span className="text-sm text-foreground">{c.lead || 'Sem nome'}</span>
                                  {c.group_name && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">{c.group_name}</span>}
                                  <span className="text-xs text-muted-foreground ml-auto">{c.numero}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </GlassCard>

              <GlassCard className="p-5 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><MessageCircle size={16} className="text-green-400" /> Mensagem</h3>
                <textarea value={whatsappMessage} onChange={e => setWhatsappMessage(e.target.value)} rows={4} placeholder="Digite a mensagem (ou legenda da mídia)..." className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm resize-y focus:outline-none focus:ring-1 focus:ring-primary/40" />

                {/* Media attachment */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <input ref={whatsappMediaInputRef} type="file" accept="image/*,video/*,audio/*" className="hidden" onChange={handleWhatsappMediaUpload} />
                    <button onClick={() => whatsappMediaInputRef.current?.click()} disabled={whatsappMediaUploading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground text-xs transition">
                      {whatsappMediaUploading ? <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Paperclip size={14} />}
                      {whatsappMediaUploading ? 'Enviando...' : 'Anexar mídia'}
                    </button>
                    <input ref={whatsappPttInputRef} type="file" accept=".ogg,.mp3,.wav,.m4a,.aac,audio/*" className="hidden" onChange={handleWhatsappPttUpload} />
                    <button onClick={() => whatsappPttInputRef.current?.click()} disabled={whatsappMediaUploading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-500/20 bg-green-500/5 text-green-400 hover:text-green-300 text-xs transition">
                      <Mic size={14} />
                      Áudio de voz
                    </button>
                    {whatsappMedia && (
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${whatsappMedia.ptt ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-primary/20 bg-primary/5 text-primary'}`}>
                        {whatsappMedia.ptt ? <Mic size={14} /> : whatsappMedia.mediatype === 'image' ? <Image size={14} /> : whatsappMedia.mediatype === 'video' ? <Film size={14} /> : whatsappMedia.mediatype === 'audio' ? <Mic size={14} /> : <Paperclip size={14} />}
                        <span className="truncate max-w-[150px]">{whatsappMedia.ptt ? '🎤 Voz' : ''} {whatsappMedia.fileName}</span>
                        <button onClick={() => setWhatsappMedia(null)} className="text-red-400 hover:text-red-300"><X size={14} /></button>
                      </div>
                    )}
                  </div>

                  {/* Mention all toggle */}
                  <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                    <input type="checkbox" checked={whatsappMentionAll} onChange={e => setWhatsappMentionAll(e.target.checked)} className="rounded border-white/20 bg-white/[0.04]" />
                    <span className="text-muted-foreground">Marcar todos do grupo (@todos)</span>
                  </label>
                </div>

                {/* Poll editor (only relevant when sending to groups) */}
                {(notifySelectedGroups.length > 0 || notifySelectedGroups2.length > 0) && (
                  <div className="space-y-2 border border-white/[0.08] rounded-xl p-3 bg-white/[0.02]">
                    <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                      <input type="checkbox" checked={groupPoll.enabled} onChange={e => setGroupPoll(p => ({ ...p, enabled: e.target.checked }))} className="rounded border-white/20 bg-white/[0.04]" />
                      <BarChart3 size={14} className="text-blue-400" />
                      <span className="text-foreground font-medium">Enviar como enquete (apenas para grupos)</span>
                    </label>
                    {groupPoll.enabled && (
                      <div className="space-y-2 pl-1">
                        <input
                          type="text"
                          value={groupPoll.name}
                          onChange={e => setGroupPoll(p => ({ ...p, name: e.target.value }))}
                          maxLength={255}
                          placeholder="Pergunta da enquete"
                          className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
                        />
                        <div className="space-y-1.5">
                          {groupPoll.values.map((v, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={v}
                                onChange={e => setGroupPoll(p => { const nv = [...p.values]; nv[idx] = e.target.value; return { ...p, values: nv }; })}
                                maxLength={100}
                                placeholder={`Opção ${idx + 1}`}
                                className="flex-1 px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
                              />
                              {groupPoll.values.length > 2 && (
                                <button type="button" onClick={() => setGroupPoll(p => ({ ...p, values: p.values.filter((_, i) => i !== idx) }))} className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition">
                                  <X size={14} />
                                </button>
                              )}
                            </div>
                          ))}
                          {groupPoll.values.length < 12 && (
                            <button type="button" onClick={() => setGroupPoll(p => ({ ...p, values: [...p.values, ''] }))} className="flex items-center gap-1 px-2 py-1 text-xs text-primary hover:text-primary/80 transition">
                              <Plus size={12} /> Adicionar opção
                            </button>
                          )}
                        </div>
                        <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                          <input type="checkbox" checked={groupPoll.multi} onChange={e => setGroupPoll(p => ({ ...p, multi: e.target.checked }))} className="rounded border-white/20 bg-white/[0.04]" />
                          <span className="text-muted-foreground">Permitir múltiplas respostas</span>
                        </label>
                      </div>
                    )}
                  </div>
                )}

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

              <BulkSendProgress total={whatsappProgress2.total} sent={whatsappProgress2.sent} errors={whatsappProgress2.errors} skipped={whatsappProgress2.skipped} label="Disparo de WhatsApp 2" accent="green" />
              <BulkSendControls control={whatsapp2Ctrl.active ? whatsapp2Ctrl : whatsapp2GroupCtrl} visible={whatsappSending2} />

              <button
                onClick={async () => {
                  if (!evolutionApiUrl2 || !evolutionApiKey2 || !evolutionInstance2) { toast.error('Configure as credenciais da Evolution API'); setShowWhatsappConfig2(true); return; }
                  let waPhoneList: { phone: string; name: string }[] = [];
                  if (whatsappSourceMode === 'csv') {
                    waPhoneList = getSelectedExternalPhoneList();
                  } else {
                    const usersWithPhone = users.filter(u => u.phone && u.phone.replace(/\D/g, '').length >= 10 && (!excludeBulkSent || !bulkSentPhones.has(u.phone)));
                    waPhoneList = (whatsappTarget === 'all' ? usersWithPhone : usersWithPhone.filter(u => selectedWhatsappPhones.includes(u.phone))).map(u => ({ phone: u.phone, name: u.name }));
                  }
                  const phones = waPhoneList.map(p => p.phone);
                  if (phones.length === 0) { toast.error('Nenhum destinatário'); return; }
                  if (!whatsappMessage.trim() && !whatsappMedia) { toast.error('Digite a mensagem ou anexe uma mídia'); return; }
                  if (!await confirmDialog({ title: 'Confirmar disparo de WhatsApp', message: `Enviar esta mensagem para ${phones.length} contato(s)?`, variant: 'info', confirmLabel: 'Disparar' })) return;
                  setWhatsappSending2(true);
                  setWhatsappProgress2({ total: phones.length, sent: 0, errors: 0, skipped: 0 });
                  whatsapp2Ctrl.start();
                  let sent = 0, errors = 0;
                  for (let i = 0; i < phones.length; i++) {
                    if (await whatsapp2Ctrl.shouldStop()) break;
                    const phone = phones[i];
                    const matchedUser = waPhoneList.find(p => p.phone === phone);
                    try {
                      const { data: respData, error } = await supabase.functions.invoke('send-whatsapp2', { body: { recipientPhone: phone, message: whatsappMessage, evolutionApiUrl: evolutionApiUrl2, evolutionApiKey: evolutionApiKey2, evolutionInstance: evolutionInstance2, media: whatsappMedia || undefined, mentionsEveryOne: whatsappMentionAll || undefined } });
                      const hasError = !!error || !!respData?.error;
                      const errorMsg = error?.message || respData?.error || null;
                      await (supabase as any).from('whatsapp2_message_log').insert({
                        owner_id: session.user.id,
                        recipient_phone: phone,
                        recipient_name: matchedUser?.name || '',
                        message: whatsappMessage,
                        status: hasError ? 'error' : 'sent',
                        error_message: errorMsg,
                      });
                      if (hasError) { errors++; setWhatsappProgress2(p => ({ ...p, errors: p.errors + 1 })); }
                      else { sent++; setWhatsappProgress2(p => ({ ...p, sent: p.sent + 1 })); }
                    } catch (e: any) {
                      errors++;
                      setWhatsappProgress2(p => ({ ...p, errors: p.errors + 1 }));
                      await (supabase as any).from('whatsapp2_message_log').insert({
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
                  whatsapp2Ctrl.finish();
                  setWhatsappSending2(false);
                  if (errors > 0) toast.error(`${sent} enviado(s), ${errors} erro(s)`);
                  else toast.success(`${sent} mensagem(ns) enviada(s)!`);
                  setTimeout(() => setWhatsappProgress2(emptyProgress), 4000);
                }}
                disabled={whatsappSending2}
                className="w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-sm disabled:opacity-50 transition-all shadow-lg shadow-green-600/20 flex items-center justify-center gap-2"
              >
                {whatsappSending2 ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Enviando...</> : <><Send size={16} /> Enviar WhatsApp</>}
              </button>

              {/* Send to Group(s) button */}
              {notifySelectedGroups2.length > 0 && (
                <button
                  onClick={async () => {
                    if (!evolutionApiUrl2 || !evolutionApiKey2 || !evolutionInstance2) { toast.error('Configure as credenciais da Evolution API'); setShowWhatsappConfig2(true); return; }
                    const pollPayload = groupPoll.enabled ? (() => {
                      const opts = groupPoll.values.map(v => v.trim()).filter(Boolean);
                      if (!groupPoll.name.trim()) { toast.error('Informe a pergunta da enquete'); return null; }
                      if (opts.length < 2) { toast.error('A enquete precisa de pelo menos 2 opções'); return null; }
                      return { name: groupPoll.name.trim(), values: opts, selectableCount: groupPoll.multi ? opts.length : 1 };
                    })() : null;
                    if (groupPoll.enabled && !pollPayload) return;
                    if (!pollPayload && !whatsappMessage.trim() && !whatsappMedia) { toast.error('Digite a mensagem ou anexe uma mídia'); return; }
                    if (!await confirmDialog({ title: pollPayload ? 'Confirmar enquete para Grupos' : 'Confirmar disparo para Grupos', message: pollPayload ? `Enviar enquete para ${notifySelectedGroups2.length} grupo(s)?` : `Enviar esta mensagem para ${notifySelectedGroups2.length} grupo(s)?`, variant: 'info', confirmLabel: 'Disparar' })) return;
                    setWhatsappSending2(true);
                    setWhatsappProgress2({ total: notifySelectedGroups2.length, sent: 0, errors: 0, skipped: 0 });
                    whatsapp2GroupCtrl.start();
                    let sent = 0, errors = 0;
                    for (const group of notifySelectedGroups2) {
                      if (await whatsapp2GroupCtrl.shouldStop()) break;
                      try {
                        const { data: respData, error } = await supabase.functions.invoke('send-whatsapp2', {
                          body: { recipientPhone: group.id, message: pollPayload ? '' : whatsappMessage, evolutionApiUrl: evolutionApiUrl2, evolutionApiKey: evolutionApiKey2, evolutionInstance: evolutionInstance2, media: pollPayload ? undefined : (whatsappMedia || undefined), mentionsEveryOne: whatsappMentionAll || undefined, poll: pollPayload || undefined }
                        });
                        const hasError = !!error || !!respData?.error;
                        if (hasError) { errors++; setWhatsappProgress2(p => ({ ...p, errors: p.errors + 1 })); }
                        else { sent++; setWhatsappProgress2(p => ({ ...p, sent: p.sent + 1 })); }
                      } catch {
                        errors++;
                        setWhatsappProgress2(p => ({ ...p, errors: p.errors + 1 }));
                      }
                    }
                    whatsapp2GroupCtrl.finish();
                    setWhatsappSending2(false);
                    if (errors > 0) toast.error(`${sent} grupo(s) enviado(s), ${errors} erro(s)`);
                    else toast.success(pollPayload ? `Enquete enviada para ${sent} grupo(s)!` : `Mensagem enviada para ${sent} grupo(s)!`);
                    setTimeout(() => setWhatsappProgress2(emptyProgress), 4000);
                  }}
                  disabled={whatsappSending2}
                  className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm disabled:opacity-50 transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                >
                  {whatsappSending2 ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Enviando...</> : <><Users size={16} /> Enviar para {notifySelectedGroups2.length} Grupo(s)</>}
                </button>
               )}

              {/* ── Agendamento de Mensagens ── */}
              <GlassCard className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Clock size={16} /> Agendamento de Mensagens</h3>
                  <button onClick={() => { setShowScheduler(!showScheduler); if (!showScheduler) fetchScheduledMessages(); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition ${showScheduler ? 'border-primary/30 bg-primary/10 text-primary' : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground'}`}>
                    {showScheduler ? 'Fechar' : 'Abrir'}
                  </button>
                </div>

                {showScheduler && (
                  <div className="space-y-4">
                    {/* Form */}
                    <div className="space-y-3 border border-white/[0.08] rounded-xl p-4 bg-white/[0.02]">
                      <textarea value={schedForm.message} onChange={e => setSchedForm(f => ({ ...f, message: e.target.value }))} rows={3} placeholder="Mensagem agendada (ou apenas mídia)..." className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm resize-y focus:outline-none focus:ring-1 focus:ring-primary/40" disabled={schedForm.pollEnabled} />

                      {/* Poll editor (groups only) */}
                      {schedForm.recipientType === 'group' && (
                        <div className="space-y-2 border border-white/[0.08] rounded-xl p-3 bg-white/[0.02]">
                          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                            <input type="checkbox" checked={schedForm.pollEnabled} onChange={e => setSchedForm(f => ({ ...f, pollEnabled: e.target.checked }))} className="rounded border-white/20 bg-white/[0.04]" />
                            <BarChart3 size={14} className="text-blue-400" />
                            <span className="text-foreground font-medium">Agendar enquete (apenas grupos)</span>
                          </label>
                          {schedForm.pollEnabled && (
                            <div className="space-y-2">
                              <input type="text" value={schedForm.pollName} onChange={e => setSchedForm(f => ({ ...f, pollName: e.target.value }))} maxLength={255} placeholder="Pergunta da enquete" className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
                              <div className="space-y-1.5">
                                {schedForm.pollValues.map((v, idx) => (
                                  <div key={idx} className="flex items-center gap-2">
                                    <input type="text" value={v} onChange={e => setSchedForm(f => { const nv = [...f.pollValues]; nv[idx] = e.target.value; return { ...f, pollValues: nv }; })} maxLength={100} placeholder={`Opção ${idx + 1}`} className="flex-1 px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
                                    {schedForm.pollValues.length > 2 && (
                                      <button type="button" onClick={() => setSchedForm(f => ({ ...f, pollValues: f.pollValues.filter((_, i) => i !== idx) }))} className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition"><X size={14} /></button>
                                    )}
                                  </div>
                                ))}
                                {schedForm.pollValues.length < 12 && (
                                  <button type="button" onClick={() => setSchedForm(f => ({ ...f, pollValues: [...f.pollValues, ''] }))} className="flex items-center gap-1 px-2 py-1 text-xs text-primary hover:text-primary/80 transition"><Plus size={12} /> Adicionar opção</button>
                                )}
                              </div>
                              <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                                <input type="checkbox" checked={schedForm.pollMulti} onChange={e => setSchedForm(f => ({ ...f, pollMulti: e.target.checked }))} className="rounded border-white/20 bg-white/[0.04]" />
                                <span className="text-muted-foreground">Permitir múltiplas respostas</span>
                              </label>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Media attachment for scheduler */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <input type="file" ref={schedMediaInputRef} className="hidden" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={handleSchedMediaUpload} />
                        <button type="button" onClick={() => schedMediaInputRef.current?.click()} disabled={schedMediaUploading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground text-xs transition">
                          {schedMediaUploading ? <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Paperclip size={14} />}
                          Anexar mídia
                        </button>
                        <input type="file" ref={schedPttInputRef} className="hidden" accept=".ogg,.mp3,.wav,.m4a,.aac,audio/*" onChange={handleSchedPttUpload} />
                        <button type="button" onClick={() => schedPttInputRef.current?.click()} disabled={schedMediaUploading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-500/20 bg-green-500/5 text-green-400 hover:text-green-300 text-xs transition">
                          <Mic size={14} />
                          Áudio de voz
                        </button>
                        {schedMedia && (
                          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs ${schedMedia.ptt ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-primary/10 border border-primary/20 text-primary'}`}>
                            {schedMedia.ptt ? <Mic size={12} /> : schedMedia.mediatype === 'image' ? <ImageIcon size={12} /> : schedMedia.mediatype === 'video' ? <Video size={12} /> : <FileAudio size={12} />}
                            <span className="truncate max-w-[120px]">{schedMedia.ptt ? '🎤 Voz' : ''} {schedMedia.fileName}</span>
                            <button onClick={() => setSchedMedia(null)} className="ml-1 text-red-400 hover:text-red-300"><X size={12} /></button>
                          </div>
                        )}
                        {schedForm.recipientType === 'group' && (
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer ml-auto">
                            <input type="checkbox" checked={schedForm.mentionAll} onChange={e => setSchedForm(f => ({ ...f, mentionAll: e.target.checked }))} className="rounded border-white/20" />
                            @todos
                          </label>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground font-medium">Tipo</label>
                          <select value={schedForm.recipientType} onChange={e => setSchedForm(f => ({ ...f, recipientType: e.target.value as any, recipientValue: '', recipientLabel: '', selectedGroups: [] }))} className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm">
                            <option value="individual">Inscrito</option>
                            <option value="group">Grupo(s)</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground font-medium">Destinatário</label>
                          {schedForm.recipientType === 'individual' ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm text-left truncate">
                                  {schedForm.recipientValue ? `${schedForm.recipientLabel || schedForm.recipientValue}` : 'Selecione...'}
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-72 p-2 space-y-1" align="start">
                                <input
                                  type="text"
                                  placeholder="Buscar por nome, telefone ou email..."
                                  className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-foreground text-xs mb-1 outline-none focus:ring-1 focus:ring-primary"
                                  onChange={e => {
                                    const el = e.target;
                                    el.setAttribute('data-search', el.value.toLowerCase());
                                    const items = el.parentElement?.querySelectorAll('[data-sched-user]');
                                    items?.forEach((item: any) => {
                                      const text = item.getAttribute('data-sched-user') || '';
                                      item.style.display = text.includes(el.value.toLowerCase()) ? '' : 'none';
                                    });
                                  }}
                                />
                                <div className="max-h-48 overflow-y-auto space-y-0.5">
                                  {users.filter(u => u.phone).map(u => (
                                    <button
                                      key={u.id}
                                      data-sched-user={`${u.name} ${u.phone} ${u.email}`.toLowerCase()}
                                      className={`w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-white/[0.06] cursor-pointer truncate ${schedForm.recipientValue === u.phone ? 'bg-primary/20 text-primary' : 'text-foreground'}`}
                                      onClick={() => setSchedForm(f => ({ ...f, recipientValue: u.phone, recipientLabel: u.name }))}
                                    >
                                      <span className="font-medium">{u.name}</span>
                                      <span className="text-muted-foreground ml-1">({u.phone})</span>
                                    </button>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                          ) : (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm text-left truncate">
                                  {schedForm.selectedGroups.length > 0 ? `${schedForm.selectedGroups.length} grupo(s)` : 'Selecione...'}
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-64 max-h-60 overflow-y-auto p-2 space-y-1" align="start">
                                {notifyGroups2.map(g => {
                                  const checked = schedForm.selectedGroups.some(sg => sg.id === g.id);
                                  return (
                                    <label key={g.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.06] cursor-pointer text-xs text-foreground">
                                      <Checkbox checked={checked} onCheckedChange={() => {
                                        setSchedForm(f => {
                                          const exists = f.selectedGroups.some(sg => sg.id === g.id);
                                          const selectedGroups = exists ? f.selectedGroups.filter(sg => sg.id !== g.id) : [...f.selectedGroups, { id: g.id, name: g.subject }];
                                          return { ...f, selectedGroups };
                                        });
                                      }} />
                                      {g.subject}
                                    </label>
                                  );
                                })}
                              </PopoverContent>
                            </Popover>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground font-medium">Data</label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm text-left flex items-center gap-2">
                                <CalendarIcon size={14} className="text-muted-foreground" />
                                {schedForm.date ? schedForm.date.toLocaleDateString('pt-BR') : 'Selecione'}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar mode="single" selected={schedForm.date} onSelect={d => setSchedForm(f => ({ ...f, date: d || undefined }))} className="p-3 pointer-events-auto" />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground font-medium">Horário</label>
                          <input type="time" value={schedForm.time} onChange={e => setSchedForm(f => ({ ...f, time: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground font-medium">Recorrência</label>
                          <select value={schedForm.recurrence} onChange={e => setSchedForm(f => ({ ...f, recurrence: e.target.value as any }))} className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm">
                            <option value="none">Única vez</option>
                            <option value="daily">Diário</option>
                            <option value="weekly">Semanal</option>
                            <option value="monthly">Mensal</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {editingScheduleId && (
                          <button onClick={resetSchedForm} className="px-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground font-medium text-sm transition-all">
                            Cancelar edição
                          </button>
                        )}
                        <button onClick={saveScheduledMessage} disabled={schedSaving} className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/80 text-primary-foreground font-bold text-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                          {schedSaving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Salvando...</> : editingScheduleId ? <><Pencil size={16} /> Atualizar Agendamento</> : <><Clock size={16} /> Agendar Mensagem</>}
                        </button>
                      </div>
                    </div>

                    {/* List */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground">Mensagens agendadas</h4>
                      {scheduledLoading ? (
                        <p className="text-xs text-muted-foreground text-center py-4">Carregando...</p>
                      ) : scheduledMessages.filter((m: any) => m.channel === 'whatsapp2').length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">Nenhum agendamento</p>
                      ) : (
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                          {scheduledMessages.filter((m: any) => m.channel === 'whatsapp2').map((m: any) => (
                            <div key={m.id} className={`p-3 rounded-xl border text-xs space-y-1 ${m.status === 'pending' ? 'border-primary/20 bg-primary/5' : m.status === 'sent' ? 'border-green-500/20 bg-green-500/5' : m.status === 'cancelled' ? 'border-muted/20 bg-muted/5 opacity-60' : 'border-red-500/20 bg-red-500/5'}`}>
                              <div className="flex justify-between items-start">
                                <span className="font-medium text-foreground truncate max-w-[70%]">{m.recipient_label || m.recipient_value}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${m.status === 'pending' ? 'bg-primary/20 text-primary' : m.status === 'sent' ? 'bg-green-500/20 text-green-400' : m.status === 'cancelled' ? 'bg-muted/20 text-muted-foreground' : 'bg-red-500/20 text-red-400'}`}>
                                  {m.status === 'pending' ? '⏳ Pendente' : m.status === 'sent' ? '✅ Enviado' : m.status === 'cancelled' ? '🚫 Cancelado' : '❌ Falhou'}
                                </span>
                              </div>
                              <p className="text-muted-foreground line-clamp-2">{m.message}</p>
                              <div className="flex justify-between items-center text-muted-foreground">
                                <span>📅 {new Date(m.next_run_at || m.scheduled_at).toLocaleString('pt-BR')} {m.recurrence !== 'none' && `• 🔁 ${m.recurrence === 'daily' ? 'Diário' : m.recurrence === 'weekly' ? 'Semanal' : 'Mensal'}`}</span>
                                {m.status === 'pending' && (
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => startEditSchedule(m)} className="text-primary hover:text-primary/80 font-medium flex items-center gap-1"><Pencil size={12} /> Editar</button>
                                    <button onClick={() => cancelScheduledMessage(m.id)} className="text-red-400 hover:text-red-300 font-medium">Cancelar</button>
                                  </div>
                                )}
                                {(m.status === 'failed' || m.status === 'cancelled') && (
                                  <div className="flex items-center gap-2">
                                    <button onClick={async () => {
                                      const nextRun = new Date();
                                      nextRun.setMinutes(nextRun.getMinutes() + 1);
                                      await supabase.from('scheduled_messages').update({ status: 'pending', next_run_at: nextRun.toISOString(), updated_at: new Date().toISOString() } as any).eq('id', m.id);
                                      toast.success('Mensagem reagendada para reenvio');
                                      fetchScheduledMessages();
                                    }} className="text-primary hover:text-primary/80 font-medium flex items-center gap-1"><RefreshCw size={12} /> Reenviar</button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </GlassCard>
            </div>
          )}


          {/* ══════ NOTIFICAÇÕES TAB ══════ */}
          {activeTab === 'notificacoes' && (
            <div className="max-w-2xl space-y-5">

              {/* Toggle: Resgate de link de referência */}
              <GlassCard className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                      <Link2 size={20} className="text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Resgate de Link de Referência</h3>
                      <p className="text-xs text-muted-foreground">Receba uma notificação quando alguém resgatar giros pelo link de referência</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotifyReferralEnabled(!notifyReferralEnabled)}
                    className={`w-12 h-7 rounded-full relative transition-all duration-300 ${notifyReferralEnabled ? 'bg-blue-500 shadow-lg shadow-blue-500/30' : 'bg-white/[0.1]'}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-md absolute top-1 transition-all duration-300 ${notifyReferralEnabled ? 'left-[26px]' : 'left-1'}`} />
                  </button>
                </div>
              </GlassCard>

              {/* Toggle: Pagamento pendente para aprovação */}
              <GlassCard className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                      <Clock size={20} className="text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Pagamento Pendente</h3>
                      <p className="text-xs text-muted-foreground">Receba uma notificação quando houver um pagamento aguardando aprovação</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotifyPendingPaymentEnabled(!notifyPendingPaymentEnabled)}
                    className={`w-12 h-7 rounded-full relative transition-all duration-300 ${notifyPendingPaymentEnabled ? 'bg-amber-500 shadow-lg shadow-amber-500/30' : 'bg-white/[0.1]'}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-md absolute top-1 transition-all duration-300 ${notifyPendingPaymentEnabled ? 'left-[26px]' : 'left-1'}`} />
                  </button>
                </div>
              </GlassCard>

              {/* Toggle: Pagamento automático */}
              <GlassCard className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      <DollarSign size={20} className="text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Pagamento Automático</h3>
                      <p className="text-xs text-muted-foreground">Receba uma notificação quando um pagamento automático for processado</p>
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
              </GlassCard>

              {/* Toggle: Depósito confirmado */}
              <GlassCard className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                      <Wallet size={20} className="text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Depósito Confirmado</h3>
                      <p className="text-xs text-muted-foreground">Receba uma notificação quando um depósito PIX for confirmado</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotifyDepositEnabled(!notifyDepositEnabled)}
                    className={`w-12 h-7 rounded-full relative transition-all duration-300 ${notifyDepositEnabled ? 'bg-cyan-500 shadow-lg shadow-cyan-500/30' : 'bg-white/[0.1]'}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-md absolute top-1 transition-all duration-300 ${notifyDepositEnabled ? 'left-[26px]' : 'left-1'}`} />
                  </button>
                </div>
              </GlassCard>

              {/* Configuração WhatsApp para Notificações */}
              {(notifyReferralEnabled || notifyPendingPaymentEnabled || notifyAutoPaymentEnabled || notifyDepositEnabled) && (
                <GlassCard className="p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                      <MessageCircle size={20} className="text-green-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Configuração WhatsApp</h3>
                      <p className="text-xs text-muted-foreground">Configure o WhatsApp para receber as notificações ativas</p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2 border-t border-white/[0.06]">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Seu número WhatsApp</label>
                      <label className="text-xs text-muted-foreground">Números WhatsApp para notificação</label>
                      {notifyWhatsappPhones.map((phone, idx) => (
                        <div key={idx} className="flex gap-2">
                          <input type="text" value={phone} onChange={e => { const arr = [...notifyWhatsappPhones]; arr[idx] = e.target.value; setNotifyWhatsappPhones(arr); setNotifyWhatsappPhone(arr[0] || ''); }} placeholder="5511999999999" className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
                          <button type="button" onClick={() => { const arr = notifyWhatsappPhones.filter((_, i) => i !== idx); setNotifyWhatsappPhones(arr); setNotifyWhatsappPhone(arr[0] || ''); }} className="px-2 text-red-400 hover:text-red-300 transition-colors text-lg font-bold">✕</button>
                        </div>
                      ))}
                      <button type="button" onClick={() => setNotifyWhatsappPhones([...notifyWhatsappPhones, ''])} className="w-full py-2 rounded-xl text-xs font-medium bg-white/[0.04] border border-dashed border-white/[0.12] text-muted-foreground hover:text-foreground hover:border-white/[0.2] transition-all">+ Adicionar número</button>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">URL da API Evolution</label>
                      <input type="text" value={notifyEvolutionApiUrl} onChange={e => setNotifyEvolutionApiUrl(e.target.value)} placeholder="https://sua-api.com" className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">API Key</label>
                      <div className="relative">
                        <input type={showNotifySecret ? 'text' : 'password'} value={notifyEvolutionApiKey} onChange={e => setNotifyEvolutionApiKey(e.target.value)} placeholder="sua-api-key" className="w-full px-4 py-2.5 pr-12 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
                        <button type="button" onClick={() => setShowNotifySecret(!showNotifySecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"><Eye size={16} /></button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Nome da Instância</label>
                      <input type="text" value={notifyEvolutionInstance} onChange={e => setNotifyEvolutionInstance(e.target.value)} placeholder="minha-instancia-notif" className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
                    </div>

                    {notifyEvolutionApiUrl && notifyEvolutionApiKey && notifyEvolutionInstance && notifyWhatsappPhones.some(p => p.trim()) ? (
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-xs font-medium text-emerald-400">Notificações configuradas e ativas</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                        <div className="w-2 h-2 rounded-full bg-amber-400" />
                        <span className="text-xs font-medium text-amber-400">Preencha todos os campos para ativar as notificações</span>
                      </div>
                    )}
                  </div>
                </GlassCard>
              )}

              {/* Empty state */}
              {!notifyReferralEnabled && !notifyPendingPaymentEnabled && !notifyAutoPaymentEnabled && !notifyDepositEnabled && (
                <div className="text-center py-8">
                  <Bell size={40} className="mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">Ative pelo menos uma notificação acima para configurar o canal de envio</p>
                </div>
              )}
            </div>
          )}

          {/* ══════ REFERRAL LINKS TAB ══════ */}
          {activeTab === 'referral' && (
            <div className="max-w-2xl space-y-5">
              {/* Sub-tabs */}
              <div className="flex gap-2 overflow-x-auto pb-1 [touch-action:pan-x]" style={{ scrollbarWidth: 'none' }}>
                {([
                  { key: 'links' as const, label: '🔗 Links', icon: Link2 },
                  { key: 'analytics' as const, label: '📊 Analytics', icon: BarChart3 },
                  { key: 'default_style' as const, label: '🎨 Visual Padrão', icon: Palette },
                ] as const).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setReferralSubTab(tab.key)}
                    className={`shrink-0 whitespace-nowrap px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                      referralSubTab === tab.key
                        ? 'bg-primary/15 text-primary border border-primary/20'
                        : 'bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08] border border-transparent'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {referralSubTab === 'default_style' && (
                <GlassCard className="p-5">
                  <ReferralDefaultEditor
                    userId={session.user.id}
                    currentConfig={defaultReferralConfig}
                    onSaved={(cfg) => setDefaultReferralConfig(cfg)}
                  />
                </GlassCard>
              )}

              {referralSubTab === 'analytics' && (
                <GlassCard className="p-5">
                  <ReferralAnalyticsPanel ownerId={session.user.id} gorjetaRef={(wheelConfig as any).gorjetaRef || ''} />
                </GlassCard>
              )}

              {referralSubTab === 'links' && (
              <GlassCard className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Link2 size={16} /> Links de Referência</h3>
                  <button
                    onClick={() => { setShowReferralForm(true); setEditingReferral(null); setReferralForm({ label: '', spins_per_registration: 1, max_registrations: '', fixed_prize_segments: [], fixed_prize_plan: [], auto_payment: false, expires_at: '' }); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 text-primary border border-primary/20 text-xs font-semibold hover:bg-primary/25 transition"
                  >
                    <Plus size={14} /> Novo Link
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Crie links para que usuários se inscrevam e ganhem giros automaticamente. Links sem personalização individual usam o <span className="text-primary font-semibold">Visual Padrão</span>.
                </p>

                {showReferralForm && (
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-4 space-y-3">
                    <h4 className="text-xs font-bold text-foreground">{editingReferral ? 'Editar Link' : 'Criar Novo Link'}</h4>
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-1">Nome / Label</label>
                      <input
                        value={referralForm.label}
                        onChange={e => setReferralForm(p => ({ ...p, label: e.target.value }))}
                        placeholder="Ex: Campanha Janeiro"
                        className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.1] text-foreground text-sm focus:outline-none focus:border-primary/50"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-1">Giros por inscrição</label>
                      <input
                        type="number"
                        min={1}
                        max={999}
                        value={referralForm.spins_per_registration}
                        onChange={e => setReferralForm(p => ({ ...p, spins_per_registration: Math.max(1, parseInt(e.target.value) || 1) }))}
                        className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.1] text-foreground text-sm focus:outline-none focus:border-primary/50"
                      />
                    </div>
                    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 space-y-3">
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-1">Plano de saídas por segmento</label>
                        <p className="text-[10px] text-muted-foreground/70">
                          Defina quantas vezes cada segmento deve sair dentro dos giros desse resgate. Ex.: 3 giros = 1x prêmio A, 1x prêmio B, 1x perdeu.
                        </p>
                      </div>
                      <div className="space-y-2 max-h-52 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                        {wheelConfig.segments.map((seg: any, i: number) => {
                          const planItem = referralForm.fixed_prize_plan.find(item => item.segment_index === i);
                          const count = planItem?.count || 0;
                          return (
                            <div key={seg.id} className="flex items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-foreground truncate">{seg.title}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{seg.reward}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setReferralForm(prev => ({
                                    ...prev,
                                    fixed_prize_plan: prev.fixed_prize_plan
                                      .map(item => item.segment_index === i ? { ...item, count: Math.max(0, item.count - 1) } : item)
                                      .filter(item => item.count > 0),
                                  }))}
                                  className="w-7 h-7 rounded-lg border border-white/[0.08] bg-white/[0.05] text-foreground hover:bg-white/[0.1] transition"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min={0}
                                  max={Number.isFinite(referralTotalAvailableSpins) ? referralTotalAvailableSpins : undefined}
                                  value={count}
                                  onChange={e => {
                                    const cap = Number.isFinite(referralTotalAvailableSpins) ? referralTotalAvailableSpins : Number.MAX_SAFE_INTEGER;
                                    const nextCount = Math.max(0, Math.min(cap, parseInt(e.target.value) || 0));
                                    setReferralForm(prev => {
                                      const otherItems = prev.fixed_prize_plan.filter(item => item.segment_index !== i);
                                      return {
                                        ...prev,
                                        fixed_prize_plan: nextCount > 0 ? [...otherItems, { segment_index: i, count: nextCount }] : otherItems,
                                      };
                                    });
                                  }}
                                  className="w-16 px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.1] text-center text-sm text-foreground focus:outline-none focus:border-primary/50"
                                />
                                <button
                                  type="button"
                                  onClick={() => setReferralForm(prev => {
                                    const cap = Number.isFinite(referralTotalAvailableSpins) ? referralTotalAvailableSpins : Number.MAX_SAFE_INTEGER;
                                    const currentCount = prev.fixed_prize_plan.find(item => item.segment_index === i)?.count || 0;
                                    const nextCount = Math.min(cap, currentCount + 1);
                                    const otherItems = prev.fixed_prize_plan.filter(item => item.segment_index !== i);
                                    return {
                                      ...prev,
                                      fixed_prize_plan: [...otherItems, { segment_index: i, count: nextCount }],
                                    };
                                  })}
                                  className="w-7 h-7 rounded-lg border border-white/[0.08] bg-white/[0.05] text-foreground hover:bg-white/[0.1] transition"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground">Total configurado</span>
                        <span className={`${totalReferralPrizePlanCount > referralTotalAvailableSpins ? 'text-destructive' : 'text-foreground'} font-semibold`}>
                          {totalReferralPrizePlanCount}/{Number.isFinite(referralTotalAvailableSpins) ? referralTotalAvailableSpins : '∞'}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground/70">
                        Total de giros disponíveis = giros por inscrição × limite de inscrições. Se sobrar giro sem plano, ele continua aleatório. Defina um limite de inscrições para usar prêmios garantidos.
                      </p>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-1">Limite de inscrições <span className="text-muted-foreground/50">(vazio = ilimitado)</span></label>
                      <input
                        type="number"
                        min={1}
                        value={referralForm.max_registrations}
                        onChange={e => setReferralForm(p => ({ ...p, max_registrations: e.target.value }))}
                        placeholder="Ilimitado"
                        className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.1] text-foreground text-sm focus:outline-none focus:border-primary/50"
                      />
                    </div>
                    {/* Timer de expiração */}
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-1">⏳ Expira em <span className="text-muted-foreground/50">(vazio = sem expiração)</span></label>
                      {!referralForm.expires_at ? (
                        <button
                          type="button"
                          onClick={() => {
                            const d = new Date();
                            d.setDate(d.getDate() + 7);
                            d.setHours(23, 59, 0, 0);
                            setReferralForm(p => ({ ...p, expires_at: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T23:59` }));
                          }}
                          className="w-full py-2.5 rounded-lg border border-dashed border-white/[0.12] bg-white/[0.02] text-muted-foreground text-xs hover:bg-white/[0.06] hover:border-primary/30 hover:text-foreground transition flex items-center justify-center gap-2"
                        >
                          <Clock size={13} /> Definir data de expiração
                        </button>
                      ) : (
                        <div className="rounded-lg border border-white/[0.1] bg-white/[0.04] p-3 space-y-2.5">
                          <div className="flex gap-2">
                            <div className="flex-1 space-y-1">
                              <span className="text-[9px] text-muted-foreground/70 uppercase tracking-wider font-semibold">Data</span>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button type="button" className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-sm text-left hover:bg-white/[0.08] transition flex items-center justify-between">
                                    <span>{referralForm.expires_at ? (() => { const [y,m,d] = referralForm.expires_at.split('T')[0].split('-'); return `${d}/${m}/${y}`; })() : ''}</span>
                                    <CalendarIcon size={13} className="text-muted-foreground" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 z-[70]" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={referralForm.expires_at ? new Date(referralForm.expires_at.split('T')[0] + 'T12:00:00') : undefined}
                                    onSelect={(d) => {
                                      if (!d) return;
                                      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                                      const time = referralForm.expires_at?.split('T')[1] || '23:59';
                                      setReferralForm(p => ({ ...p, expires_at: `${ds}T${time}` }));
                                    }}
                                    className="p-3 pointer-events-auto"
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>
                            <div className="w-24 space-y-1">
                              <span className="text-[9px] text-muted-foreground/70 uppercase tracking-wider font-semibold">Hora</span>
                              <div className="flex items-center gap-1">
                                <select
                                  value={referralForm.expires_at ? referralForm.expires_at.split('T')[1]?.split(':')[0] || '23' : '23'}
                                  onChange={e => {
                                    const mins = referralForm.expires_at?.split('T')[1]?.split(':')[1] || '59';
                                    const date = referralForm.expires_at?.split('T')[0] || '';
                                    setReferralForm(p => ({ ...p, expires_at: `${date}T${e.target.value}:${mins}` }));
                                  }}
                                  className="flex-1 px-1.5 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-sm focus:outline-none appearance-none text-center"
                                >
                                  {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => (
                                    <option key={h} value={h} className="bg-background text-foreground">{h}</option>
                                  ))}
                                </select>
                                <span className="text-muted-foreground font-bold">:</span>
                                <select
                                  value={referralForm.expires_at ? referralForm.expires_at.split('T')[1]?.split(':')[1] || '59' : '59'}
                                  onChange={e => {
                                    const hrs = referralForm.expires_at?.split('T')[1]?.split(':')[0] || '23';
                                    const date = referralForm.expires_at?.split('T')[0] || '';
                                    setReferralForm(p => ({ ...p, expires_at: `${date}T${hrs}:${e.target.value}` }));
                                  }}
                                  className="flex-1 px-1.5 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-sm focus:outline-none appearance-none text-center"
                                >
                                  {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => (
                                    <option key={m} value={m} className="bg-background text-foreground">{m}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                          {/* Quick presets */}
                          <div className="flex gap-1.5 flex-wrap">
                            {[
                              { label: '1h', fn: () => { const d = new Date(); d.setHours(d.getHours()+1); return d; } },
                              { label: '24h', fn: () => { const d = new Date(); d.setDate(d.getDate()+1); return d; } },
                              { label: '3 dias', fn: () => { const d = new Date(); d.setDate(d.getDate()+3); return d; } },
                              { label: '7 dias', fn: () => { const d = new Date(); d.setDate(d.getDate()+7); return d; } },
                              { label: '30 dias', fn: () => { const d = new Date(); d.setDate(d.getDate()+30); return d; } },
                            ].map(preset => (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() => {
                                  const d = preset.fn();
                                  const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                                  const ts = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                                  setReferralForm(p => ({ ...p, expires_at: `${ds}T${ts}` }));
                                }}
                                className="px-2 py-1 rounded-md bg-white/[0.06] border border-white/[0.08] text-[10px] text-muted-foreground hover:bg-primary/15 hover:text-primary hover:border-primary/20 transition"
                              >
                                +{preset.label}
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => setReferralForm(p => ({ ...p, expires_at: '' }))}
                            className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 transition"
                          >
                            <X size={10} /> Remover expiração
                          </button>
                        </div>
                      )}
                    </div>
                    {/* Auto-payment */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">💳 Pagamento automático</span>
                      <button
                        type="button"
                        onClick={() => setReferralForm(p => ({ ...p, auto_payment: !p.auto_payment }))}
                        className={`w-12 h-7 rounded-full relative transition-all duration-300 ${referralForm.auto_payment ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30' : 'bg-white/[0.1]'}`}
                      >
                        <div className={`w-5 h-5 rounded-full bg-white shadow-md absolute top-1 transition-all duration-300 ${referralForm.auto_payment ? 'left-[26px]' : 'left-1'}`} />
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setShowReferralForm(false); setEditingReferral(null); }} className="flex-1 py-2 rounded-lg bg-white/[0.06] text-muted-foreground text-sm hover:bg-white/[0.1] transition">Cancelar</button>
                      <button onClick={handleSaveReferral} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:brightness-110 transition">Salvar</button>
                    </div>
                  </div>
                )}

                {referralLoading ? (
                  <div className="text-center py-6 text-sm text-muted-foreground animate-pulse">Carregando...</div>
                ) : referralLinks.length === 0 ? (
                  <div className="text-center py-8">
                    <Link2 size={32} className="mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">Nenhum link criado</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Crie um link para começar a receber inscrições</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {referralLinks.filter(link => link.code?.toLowerCase() !== ((wheelConfig as any).gorjetaRef || '').toLowerCase()).map(link => {
                      const hasCustomStyle = link.page_config && Object.keys(link.page_config).length > 0;
                      return (
                      <div key={link.id} className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold text-foreground">{link.label || 'Sem nome'}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {link.registrations_count}{link.max_registrations ? `/${link.max_registrations}` : ''} inscrição(ões) • {link.spins_per_registration} giro(s)/inscrição
                              {buildReferralFixedPrizePlan(link).length > 0 ? ` • 🎯 ${formatReferralPrizePlan(buildReferralFixedPrizePlan(link))}` : ''}
                              {link.auto_payment ? ' • 💳 Auto' : ''}
                              {link.expires_at ? ` • ⏳ ${new Date(link.expires_at).toLocaleString('pt-BR')}${new Date(link.expires_at) <= new Date() ? ' (expirado)' : ''}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {hasCustomStyle && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-primary/10 text-primary border-primary/20">🎨 Custom</span>
                            )}
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${link.is_active ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20' : 'bg-red-500/15 text-red-400 border-red-500/20'}`}>
                              {link.is_active ? '✅ Ativo' : '❌ Inativo'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-primary font-mono bg-primary/10 border border-primary/20 px-2 py-1 rounded-lg flex-1 truncate">
                            {window.location.origin}/ref/{link.code}
                          </code>
                          <button
                            onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/ref/${link.code}`); toast.success('Link copiado!'); }}
                            className="p-1.5 rounded-lg bg-white/[0.06] text-muted-foreground hover:text-foreground hover:bg-white/[0.1] transition"
                            title="Copiar"
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 pt-1 flex-wrap">
                          <button
                            onClick={() => { setEditingReferral(link); const exAt = link.expires_at ? (() => { const d = new Date(link.expires_at); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; })() : ''; setReferralForm({ label: link.label, spins_per_registration: link.spins_per_registration, max_registrations: link.max_registrations ? String(link.max_registrations) : '', fixed_prize_segments: Array.isArray(link.fixed_prize_segments) ? link.fixed_prize_segments : link.fixed_prize_segment != null ? [link.fixed_prize_segment] : [], fixed_prize_plan: buildReferralFixedPrizePlan(link), auto_payment: link.auto_payment ?? false, expires_at: exAt }); setShowReferralForm(true); }}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.06] text-muted-foreground text-[10px] hover:bg-white/[0.1] transition"
                          >
                            <Pencil size={12} /> Editar
                          </button>
                          <button
                            onClick={() => setCustomizingReferral(link)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/15 text-primary text-[10px] hover:bg-primary/25 transition"
                          >
                            <Palette size={12} /> Personalizar
                          </button>
                          <button
                            onClick={() => setSharingReferral(link)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 text-[10px] hover:bg-emerald-500/25 transition"
                          >
                            <MessageCircle size={12} /> WhatsApp
                          </button>
                          <button
                            onClick={() => setAnalyticsReferral(link)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-500/15 text-sky-300 text-[10px] hover:bg-sky-500/25 transition"
                          >
                            <BarChart3 size={12} /> Analytics
                          </button>
                          <button
                            onClick={() => handleToggleReferral(link.id, link.is_active)}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] transition ${link.is_active ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25' : 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'}`}
                          >
                            {link.is_active ? '⏸️ Desativar' : '▶️ Ativar'}
                          </button>
                          <button
                            onClick={() => handleDeleteReferral(link.id)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/15 text-red-400 text-[10px] hover:bg-red-500/25 transition"
                          >
                            <Trash2 size={12} /> Excluir
                          </button>
                        </div>
                        <p className="text-[10px] text-muted-foreground">Criado: {new Date(link.created_at).toLocaleString('pt-BR')}</p>
                      </div>
                      );
                    })}
                  </div>
                )}
              </GlassCard>
              )}
            </div>
          )}

          {customizingReferral && (
            <ReferralPageEditor
              linkId={customizingReferral.id}
              linkLabel={customizingReferral.label}
              currentConfig={customizingReferral.page_config || {}}
              onClose={() => setCustomizingReferral(null)}
              onSaved={() => { setCustomizingReferral(null); fetchReferralLinks(); }}
            />
          )}

          {analyticsReferral && session?.user?.id && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setAnalyticsReferral(null)} />
              <div className="relative w-full max-w-5xl max-h-[90vh] bg-background border border-white/[0.08] rounded-2xl shadow-2xl overflow-y-auto p-5" style={{ scrollbarWidth: 'thin' }}>
                <button
                  onClick={() => setAnalyticsReferral(null)}
                  className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition z-10"
                >
                  <X size={18} />
                </button>
                <ReferralAnalyticsPanel
                  ownerId={session.user.id}
                  linkId={analyticsReferral.id}
                  scopeLabel={`${analyticsReferral.label || 'Link'} • ${analyticsReferral.code}`}
                />
              </div>
            </div>
          )}

          {sharingReferral && session?.user?.id && (
            <WhatsAppShareDialog
              ownerId={session.user.id}
              shareUrl={`${window.location.origin}/ref/${sharingReferral.code}`}
              linkLabel={sharingReferral.label || ''}
              onClose={() => setSharingReferral(null)}
              evolutionApiUrl={evolutionApiUrl}
              evolutionApiKey={evolutionApiKey}
              evolutionInstance={evolutionInstance}
            />
          )}

          {/* ══════ GORJETA TAB ══════ */}
          {activeTab === 'gorjeta' && (() => {
            const gorjetaRef = (wheelConfig as any).gorjetaRef || '';
            const gorjetaUrl = gorjetaRef ? `${baseUrl}/gorjeta?ref=${gorjetaRef}` : '';
            const showQr = (wheelConfig as any).gorjetaShowQr !== false;
            return (
              <div className="max-w-2xl space-y-5">
                {/* Sub-tabs */}
                <div className="flex gap-2 overflow-x-auto pb-1 [touch-action:pan-x]" style={{ scrollbarWidth: 'none' }}>
                  {([
                    { key: 'link' as const, label: '🔗 Link', icon: Link2 },
                    { key: 'visual' as const, label: '🎨 Visual', icon: Palette },
                    { key: 'influencer' as const, label: '🎯 Visual Influencer', icon: Target },
                    { key: 'seo' as const, label: '📊 SEO & Pixel', icon: Globe },
                  ] as const).map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setGorjetaSubTab(tab.key)}
                      className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                        gorjetaSubTab === tab.key
                          ? 'bg-primary/15 text-primary border border-primary/20'
                          : 'text-muted-foreground hover:bg-white/[0.04] border border-transparent'
                      }`}
                    >
                      <tab.icon size={14} />
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>

                {gorjetaSubTab === 'link' && (
                  <GlassCard className="p-5 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Gift size={20} className="text-primary" />
                      <h3 className="text-sm font-bold text-foreground">Configurar Link de Gorjeta</h3>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Defina o código de referência que será usado na sua página de gorjeta. O link final será: <span className="font-mono text-primary">{baseUrl}/gorjeta?ref=SEU_CODIGO</span>
                    </p>

                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Código de Referência (ref)</label>
                      <input
                        type="text"
                        value={gorjetaRef}
                        onChange={e => {
                          const val = e.target.value.replace(/[^a-zA-Z0-9_-]/g, '');
                          setWheelConfig((prev: any) => ({ ...prev, gorjetaRef: val }));
                        }}
                        placeholder="Ex: meucafe"
                        className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-mono tracking-wider"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">Use letras, números, - ou _.</p>
                    </div>

                    {gorjetaUrl && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Seu Link de Gorjeta</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              readOnly
                              value={gorjetaUrl}
                              className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground font-mono text-xs"
                            />
                            <button
                              onClick={() => { navigator.clipboard.writeText(gorjetaUrl); toast.success('Link copiado!'); }}
                              className="shrink-0 px-3 py-2.5 rounded-xl text-xs font-semibold bg-primary/15 text-primary border border-primary/20 hover:bg-primary/25 transition-all flex items-center gap-1.5"
                            >
                              <Copy size={14} /> Copiar
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => window.open(gorjetaUrl, '_blank')}
                            className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/[0.06] border border-white/[0.08] text-muted-foreground hover:text-foreground hover:bg-white/[0.1] transition-all flex items-center gap-1.5"
                          >
                            <ExternalLink size={14} /> Abrir Página
                          </button>
                          <button
                            onClick={() => setWheelConfig((prev: any) => ({ ...prev, gorjetaShowQr: !showQr }))}
                            className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/[0.06] border border-white/[0.08] text-muted-foreground hover:text-foreground hover:bg-white/[0.1] transition-all flex items-center gap-1.5"
                          >
                            <Eye size={14} /> {showQr ? 'Esconder QR Code' : 'Mostrar QR Code'}
                          </button>
                        </div>

                        {showQr && (
                          <div className="flex justify-center p-4 bg-white rounded-xl">
                            <QRCodeSVG value={gorjetaUrl} size={160} />
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      onClick={async () => {
                        await handleSaveConfig();
                        const ref = (wheelConfig as any).gorjetaRef;
                        if (ref && session?.user?.id) {
                          const { data: existing } = await (supabase as any)
                            .from('referral_links')
                            .select('id')
                            .eq('code', ref)
                            .eq('owner_id', session.user.id)
                            .maybeSingle();
                          if (!existing) {
                            const { error: createErr } = await (supabase as any)
                              .from('referral_links')
                              .insert({
                                code: ref,
                                owner_id: session.user.id,
                                label: 'Gorjeta',
                                spins_per_registration: 1,
                                is_active: true,
                              });
                            if (createErr) {
                              toast.error('Erro ao criar link: ' + createErr.message);
                            } else {
                              toast.success('Link de gorjeta criado automaticamente!');
                            }
                          }
                        }
                      }}
                      disabled={savingConfig}
                      className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 hover:brightness-110 transition-all shadow-lg shadow-primary/20"
                    >
                      {savingConfig ? 'Salvando...' : '💾 Salvar Configuração'}
                    </button>
                  </GlassCard>
                )}

                {gorjetaSubTab === 'visual' && session?.user?.id && (
                  <GorjetaPageEditor
                    userId={session.user.id}
                    currentConfig={(wheelConfig as any).gorjetaPageConfig || {}}
                    onSaved={(cfg) => setWheelConfig((prev: any) => ({ ...prev, gorjetaPageConfig: cfg }))}
                  />
                )}

                {gorjetaSubTab === 'influencer' && session?.user?.id && (
                  <InfluencerPageEditor
                    userId={session.user.id}
                    currentConfig={(wheelConfig as any).influencerPageConfig || {}}
                    onSaved={(cfg) => setWheelConfig((prev: any) => ({ ...prev, influencerPageConfig: cfg }))}
                  />
                )}

                {gorjetaSubTab === 'seo' && (() => {
                  const seoConfig = (wheelConfig as any).gorjetaSeo || {};
                  const updateSeo = (field: string, value: string) => {
                    setWheelConfig((prev: any) => ({
                      ...prev,
                      gorjetaSeo: { ...(prev.gorjetaSeo || {}), [field]: value },
                    }));
                  };
                  return (
                    <div className="space-y-5">
                      {/* Configuração da Página */}
                      <GlassCard className="p-5 space-y-4">
                        <div className="flex items-center gap-2 mb-1">
                          <FileText size={20} className="text-emerald-400" />
                          <h3 className="text-sm font-bold text-foreground">Configuração da Página</h3>
                        </div>
                        <p className="text-xs text-muted-foreground">Defina o nome, ícone e descrição que aparecem na aba do navegador e nos resultados de busca.</p>

                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Nome da Página (título da aba)</label>
                          <input
                            type="text"
                            value={seoConfig.pageTitle || ''}
                            onChange={e => updateSeo('pageTitle', e.target.value)}
                            placeholder="Ex: Roleta de Prêmios"
                            className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                          />
                          <p className="text-[10px] text-muted-foreground mt-1">Aparece na aba do navegador</p>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Favicon (ícone da aba)</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={seoConfig.faviconUrl || ''}
                              onChange={e => updateSeo('faviconUrl', e.target.value)}
                              placeholder="https://exemplo.com/favicon.ico"
                              className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-mono text-xs"
                            />
                            <label className="shrink-0 cursor-pointer rounded-xl border border-white/[0.08] bg-white/[0.06] hover:bg-white/[0.12] px-3 py-2.5 text-xs font-semibold text-foreground transition-all flex items-center gap-1.5">
                              <Upload size={14} /> Upload
                              <input type="file" accept="image/*,.ico,.svg" className="hidden" onChange={async (e) => {
                                const file = e.target.files?.[0]; if (!file) return;
                                try { const { publicUrl } = await uploadAppAsset(file, 'favicon'); updateSeo('faviconUrl', publicUrl); toast.success('Favicon enviado!'); } catch (err: any) { toast.error('Erro: ' + (err.message || 'Tente novamente')); }
                                e.target.value = '';
                              }} />
                            </label>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">Ícone pequeno na aba do navegador. Use .ico, .png ou .svg</p>
                          {seoConfig.faviconUrl && (
                            <div className="mt-2 flex items-center gap-2">
                              <img src={seoConfig.faviconUrl} alt="Favicon preview" className="w-6 h-6 rounded object-contain bg-white/10 p-0.5" onError={e => (e.currentTarget.style.display = 'none')} />
                              <span className="text-[10px] text-muted-foreground">Preview</span>
                              <button type="button" onClick={() => updateSeo('faviconUrl', '')} className="text-xs text-destructive hover:text-destructive/80 ml-1"><Trash2 size={12} /></button>
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Descrição da Página (meta description)</label>
                          <textarea
                            value={seoConfig.pageDescription || ''}
                            onChange={e => updateSeo('pageDescription', e.target.value)}
                            placeholder="Ex: Participe e concorra a prêmios em dinheiro via PIX!"
                            rows={3}
                            className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all resize-none"
                          />
                          <p className="text-[10px] text-muted-foreground mt-1">Aparece nos resultados de busca do Google</p>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Imagem Social (og:image)</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={seoConfig.ogImage || ''}
                              onChange={e => updateSeo('ogImage', e.target.value)}
                              placeholder="https://exemplo.com/imagem.jpg"
                              className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-mono text-xs"
                            />
                            <label className="shrink-0 cursor-pointer rounded-xl border border-white/[0.08] bg-white/[0.06] hover:bg-white/[0.12] px-3 py-2.5 text-xs font-semibold text-foreground transition-all flex items-center gap-1.5">
                              <Upload size={14} /> Upload
                              <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                const file = e.target.files?.[0]; if (!file) return;
                                try { const { publicUrl } = await uploadAppAsset(file, 'og-images'); updateSeo('ogImage', publicUrl); toast.success('Imagem enviada!'); } catch (err: any) { toast.error('Erro: ' + (err.message || 'Tente novamente')); }
                                e.target.value = '';
                              }} />
                            </label>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">Imagem ao compartilhar no WhatsApp, Facebook, etc. Tamanho recomendado: 1200×630px</p>
                          {seoConfig.ogImage && (
                            <div className="mt-2 rounded-xl overflow-hidden border border-white/[0.08] max-w-xs relative">
                              <img src={seoConfig.ogImage} alt="OG image preview" className="w-full h-auto object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
                              <button type="button" onClick={() => updateSeo('ogImage', '')} className="absolute top-1 right-1 bg-black/60 rounded-full p-1 text-destructive hover:text-destructive/80"><Trash2 size={12} /></button>
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Palavras-chave (meta keywords)</label>
                          <input
                            type="text"
                            value={seoConfig.keywords || ''}
                            onChange={e => updateSeo('keywords', e.target.value)}
                            placeholder="gorjeta, pix, prêmio, sorteio"
                            className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                          />
                        </div>
                      </GlassCard>

                      {/* Pixels */}
                      <GlassCard className="p-5 space-y-4">
                        <div className="flex items-center gap-2 mb-1">
                          <BarChart3 size={20} className="text-amber-400" />
                          <h3 className="text-sm font-bold text-foreground">Pixels de Rastreamento</h3>
                        </div>
                        <p className="text-xs text-muted-foreground">Insira os IDs dos pixels para rastrear conversões e eventos na sua página de gorjeta.</p>

                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Facebook Pixel ID</label>
                          <input
                            type="text"
                            value={seoConfig.facebookPixelId || ''}
                            onChange={e => updateSeo('facebookPixelId', e.target.value)}
                            placeholder="Ex: 123456789012345"
                            className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-mono tracking-wider"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Google Analytics ID (GA4)</label>
                          <input
                            type="text"
                            value={seoConfig.googleAnalyticsId || ''}
                            onChange={e => updateSeo('googleAnalyticsId', e.target.value)}
                            placeholder="Ex: G-XXXXXXXXXX"
                            className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-mono tracking-wider"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Google Tag Manager ID</label>
                          <input
                            type="text"
                            value={seoConfig.gtmId || ''}
                            onChange={e => updateSeo('gtmId', e.target.value)}
                            placeholder="Ex: GTM-XXXXXXX"
                            className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-mono tracking-wider"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">TikTok Pixel ID</label>
                          <input
                            type="text"
                            value={seoConfig.tiktokPixelId || ''}
                            onChange={e => updateSeo('tiktokPixelId', e.target.value)}
                            placeholder="Ex: CXXXXXXXXXXXXXXXXX"
                            className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-mono tracking-wider"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Script Personalizado (head)</label>
                          <textarea
                            value={seoConfig.customHeadScript || ''}
                            onChange={e => updateSeo('customHeadScript', e.target.value)}
                            placeholder={"<!-- Cole aqui qualquer script personalizado -->"}
                            rows={4}
                            className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all resize-none font-mono text-xs"
                          />
                          <p className="text-[10px] text-muted-foreground mt-1">⚠️ Cuidado: scripts incorretos podem quebrar a página.</p>
                        </div>
                      </GlassCard>

                      <button
                        onClick={handleSaveConfig}
                        disabled={savingConfig}
                        className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 hover:brightness-110 transition-all shadow-lg shadow-primary/20"
                      >
                        {savingConfig ? 'Salvando...' : '💾 Salvar Configuração SEO & Pixel'}
                      </button>
                    </div>
                  );
                })()}
              </div>
            );
          })()}


          {/* ══════ HISTÓRICO GORJETA TAB ══════ */}
          {activeTab === 'hist_gorjeta' && (() => {
            // Build list of available dates (YYYY-MM-DD) for the filter dropdown
            const availableDates = Array.from(new Set(
              gorjetaHistory.map((i: any) => {
                const d = new Date(i.created_at);
                if (isNaN(d.getTime())) return '';
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              }).filter(Boolean)
            )).sort((a, b) => b.localeCompare(a));

            const matchesStatus = (status: string) => {
              if (gorjetaStatusFilter === 'all') return true;
              if (gorjetaStatusFilter === 'paid') return status === 'paid';
              if (gorjetaStatusFilter === 'pending') return status === 'pending' || status === 'auto_pending';
              if (gorjetaStatusFilter === 'failed') return status === 'failed' || status === 'rejected' || status === 'cancelled';
              return true;
            };

            const dateFiltered = gorjetaDateFilter
              ? gorjetaHistory.filter((i: any) => {
                  const d = new Date(i.created_at);
                  if (isNaN(d.getTime())) return false;
                  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  return key === gorjetaDateFilter;
                })
              : gorjetaHistory;

            const filteredHistory = dateFiltered.filter((i: any) => matchesStatus(i.status));

            // Counts based on date-filtered list (so status chips reflect the selected day)
            const countPaid = dateFiltered.filter((i: any) => i.status === 'paid').length;
            const countPending = dateFiltered.filter((i: any) => i.status === 'pending' || i.status === 'auto_pending').length;
            const countFailed = dateFiltered.filter((i: any) => i.status === 'failed' || i.status === 'rejected' || i.status === 'cancelled').length;

            const formatDateLabel = (iso: string) => {
              const [y, m, d] = iso.split('-');
              return `${d}/${m}/${y.slice(2)}`;
            };

            const statusChip = (key: typeof gorjetaStatusFilter, label: string, count: number, colorClass: string) => (
              <button
                onClick={() => setGorjetaStatusFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  gorjetaStatusFilter === key
                    ? `${colorClass} border-current`
                    : 'bg-white/[0.04] border-white/[0.08] text-muted-foreground hover:text-foreground hover:bg-white/[0.08]'
                }`}
              >
                {label} <span className="opacity-70">({count})</span>
              </button>
            );

            return (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Clock size={20} className="text-primary" />
                  <h3 className="text-sm font-bold text-foreground">Histórico de Sorteados</h3>
                </div>
                <button
                  onClick={fetchGorjetaHistory}
                  disabled={gorjetaHistoryLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 text-primary border border-primary/20 text-xs font-semibold hover:bg-primary/25 transition"
                >
                  <RotateCcw size={14} className={gorjetaHistoryLoading ? 'animate-spin' : ''} /> Atualizar
                </button>
              </div>

              {/* Date filter */}
              <GlassCard className="p-3 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <CalendarIcon size={14} className="text-primary" /> Filtrar por dia:
                  </label>
                  <input
                    type="date"
                    value={gorjetaDateFilter}
                    onChange={(e) => setGorjetaDateFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  {availableDates.length > 0 && (
                    <select
                      value={gorjetaDateFilter}
                      onChange={(e) => setGorjetaDateFilter(e.target.value)}
                      className="px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="">Todos os dias</option>
                      {availableDates.map((d) => (
                        <option key={d} value={d}>{formatDateLabel(d)}</option>
                      ))}
                    </select>
                  )}
                  {(gorjetaDateFilter || gorjetaStatusFilter !== 'all') && (
                    <button
                      onClick={() => { setGorjetaDateFilter(''); setGorjetaStatusFilter('all'); }}
                      className="px-2.5 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-xs text-muted-foreground hover:text-foreground hover:bg-white/[0.1] transition"
                    >
                      Limpar
                    </button>
                  )}
                  <span className="text-[11px] text-muted-foreground ml-auto">
                    Exibindo: <span className="font-semibold text-foreground">{filteredHistory.length}</span> de {gorjetaHistory.length}
                  </span>
                </div>

                {/* Status filter chips */}
                <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-white/[0.06]">
                  <span className="text-xs font-semibold text-muted-foreground">Status:</span>
                  {statusChip('all', 'Todos', dateFiltered.length, 'bg-primary/15 text-primary')}
                  {statusChip('paid', 'Pagos', countPaid, 'bg-green-500/15 text-green-400')}
                  {statusChip('pending', 'Pendentes', countPending, 'bg-yellow-500/15 text-yellow-400')}
                  {statusChip('failed', 'Rejeitados', countFailed, 'bg-red-500/15 text-red-400')}
                </div>
              </GlassCard>

              {/* Summary cards */}
              {filteredHistory.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <GlassCard className="p-3 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{gorjetaDateFilter ? 'Sorteados no dia' : 'Total Sorteados'}</p>
                    <p className="text-lg font-bold text-foreground">{filteredHistory.length}</p>
                  </GlassCard>
                  <GlassCard className="p-3 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{gorjetaDateFilter ? 'Gasto no dia' : 'Total Gasto'}</p>
                    <p className="text-lg font-bold text-primary">R$ {filteredHistory.reduce((s: number, i: any) => s + (i.amount || 0), 0).toFixed(2).replace('.', ',')}</p>
                  </GlassCard>
                  <GlassCard className="p-3 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pendentes</p>
                    <p className="text-lg font-bold text-yellow-400">{countPending}</p>
                  </GlassCard>
                  <GlassCard className="p-3 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pagos</p>
                    <p className="text-lg font-bold text-green-400">{countPaid}</p>
                  </GlassCard>
                </div>
              )}

              {gorjetaHistoryLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredHistory.length === 0 ? (
                <GlassCard className="p-8 text-center">
                  <Gift size={32} className="mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {gorjetaDateFilter ? `Nenhum sorteado em ${formatDateLabel(gorjetaDateFilter)}.` : 'Nenhum sorteado encontrado.'}
                  </p>
                </GlassCard>
              ) : (
                <GlassCard className="p-0 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-white/[0.06]">
                          <th className="px-3 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Nome</th>
                          <th className="px-3 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">ID</th>
                          <th className="px-3 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Prêmio</th>
                          <th className="px-3 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Valor</th>
                          <th className="px-3 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                          <th className="px-3 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Data</th>
                          <th className="px-3 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredHistory.map((item: any) => {
                          const wu = item.wheel_users;
                          const statusColors: Record<string, string> = {
                            paid: 'bg-green-500/20 text-green-400',
                            pending: 'bg-yellow-500/20 text-yellow-400',
                            auto_pending: 'bg-blue-500/20 text-blue-400',
                            failed: 'bg-red-500/20 text-red-400',
                          };
                          const statusLabels: Record<string, string> = {
                            paid: 'Pago',
                            pending: 'Pendente',
                            auto_pending: 'Auto',
                            failed: 'Falhou',
                          };
                          return (
                            <tr key={item.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                              <td className="px-3 py-2.5 text-xs text-foreground font-medium">{item.user_name || wu?.name || '—'}</td>
                              <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">
                                <div className="flex items-center gap-1">
                                  <span className="truncate max-w-[100px]">{item.account_id}</span>
                                  <button
                                    onClick={() => { navigator.clipboard.writeText(item.account_id); toast.success('ID copiado!'); }}
                                    className="shrink-0 p-0.5 rounded hover:bg-white/[0.08] text-muted-foreground hover:text-foreground transition"
                                  >
                                    <Copy size={12} />
                                  </button>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-xs text-muted-foreground">{item.prize || '—'}</td>
                              <td className="px-3 py-2.5 text-xs text-foreground font-semibold">R$ {(item.amount || 0).toFixed(2).replace('.', ',')}</td>
                              <td className="px-3 py-2.5">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColors[item.status] || 'bg-white/[0.08] text-muted-foreground'}`}>
                                  {statusLabels[item.status] || item.status}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                                {new Date(item.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <button
                                  onClick={() => setGorjetaDetailUser({ ...item, ...wu })}
                                  className="px-2.5 py-1 rounded-lg bg-primary/15 text-primary border border-primary/20 text-[10px] font-semibold hover:bg-primary/25 transition"
                                >
                                  <Eye size={12} className="inline mr-1" />Ver Dados
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-4 py-3 border-t border-white/[0.06] text-xs text-muted-foreground flex items-center justify-between flex-wrap gap-2">
                    <span>
                      Total: <span className="font-semibold text-foreground">{filteredHistory.length}</span> sorteados
                      {gorjetaDateFilter && <span className="ml-1">em {formatDateLabel(gorjetaDateFilter)}</span>}
                    </span>
                    <span>
                      Gasto: <span className="font-semibold text-primary">R$ {filteredHistory.reduce((s: number, i: any) => s + (i.amount || 0), 0).toFixed(2).replace('.', ',')}</span>
                    </span>
                  </div>
                </GlassCard>
              )}

              {/* Detail Dialog */}
              <Dialog open={!!gorjetaDetailUser} onOpenChange={(open) => { if (!open) setGorjetaDetailUser(null); }}>
                <DialogContent className="max-w-md bg-card border border-white/[0.08]">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-foreground">
                      <Users size={18} className="text-primary" />
                      Dados do Sorteado
                    </DialogTitle>
                  </DialogHeader>
                  {gorjetaDetailUser && (
                    <div className="space-y-3 mt-2">
                      {[
                        { label: 'Nome', value: gorjetaDetailUser.user_name || gorjetaDetailUser.name },
                        { label: 'Email', value: gorjetaDetailUser.user_email || gorjetaDetailUser.email },
                        { label: 'Telefone', value: gorjetaDetailUser.phone },
                        { label: 'ID Conta', value: gorjetaDetailUser.account_id, copy: true },
                        { label: 'PIX Tipo', value: gorjetaDetailUser.pix_key_type },
                        { label: 'PIX Chave', value: gorjetaDetailUser.pix_key, copy: true },
                        { label: 'Tipo Usuário', value: gorjetaDetailUser.user_type },
                        { label: 'Responsável', value: gorjetaDetailUser.responsible },
                        { label: 'Prêmio', value: gorjetaDetailUser.prize },
                        { label: 'Valor', value: gorjetaDetailUser.amount ? `R$ ${Number(gorjetaDetailUser.amount).toFixed(2).replace('.', ',')}` : '' },
                        { label: 'Status', value: gorjetaDetailUser.status },
                        { label: 'Auto Payment', value: gorjetaDetailUser.auto_payment ? 'Sim' : 'Não' },
                        { label: 'Data', value: gorjetaDetailUser.created_at ? new Date(gorjetaDetailUser.created_at).toLocaleString('pt-BR') : '' },
                      ].filter(r => r.value).map((row) => (
                        <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-white/[0.04]">
                          <span className="text-xs text-muted-foreground">{row.label}</span>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-foreground font-medium max-w-[200px] truncate">{row.value}</span>
                            {row.copy && (
                              <button
                                onClick={() => { navigator.clipboard.writeText(String(row.value)); toast.success(`${row.label} copiado!`); }}
                                className="p-0.5 rounded hover:bg-white/[0.08] text-muted-foreground hover:text-foreground transition"
                              >
                                <Copy size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </div>
            );
          })()}

          {activeTab === 'deposito' && (() => {
            const dc = (wheelConfig as any).depositConfig || { enabled: false, tag: '', accountIdLabel: 'ID da Conta', presetValues: [10, 20, 50, 100], minimumValue: 10, allowCustomValue: true, description: 'Selecione um valor para depósito', bgColor: '#0a0a0f', accentColor: '#10b981', textColor: '#ffffff', logoUrl: '', bgImageUrl: '', seoTitle: '', seoDescription: '', seoFaviconUrl: '', seoOgImageUrl: '', pixelFacebook: '', pixelGoogle: '', pixelTiktok: '', customHeadScript: '', confirmationTitle: 'Pagamento Confirmado!', confirmationMessage: 'Seu depósito foi recebido com sucesso.', confirmationLogoUrl: '', confirmationButtonText: 'Acessar →', confirmationButtonUrl: '', confirmationButtonColor: '', showNewDepositButton: true };
            const updateDc = (patch: any) => setWheelConfig((prev: any) => ({ ...prev, depositConfig: { ...dc, ...patch } }));
            // Visual / textos / SEO / pixels / confirmação independentes por variante.
            // `dcv` lê com fallback para o Depósito padrão; `updateDcv` grava em `bsOverrides` quando variant=='depbs'.
            const isBs = depositVariant === 'depbs';
            const overrides = (dc.bsOverrides || {}) as Record<string, any>;
            const dcv: any = isBs ? new Proxy({}, {
              get: (_t, key: string) => {
                if (overrides[key] !== undefined && overrides[key] !== null && overrides[key] !== '') return overrides[key];
                return (dc as any)[key];
              },
            }) : dc;
            const updateDcv = (patch: any) => {
              if (!isBs) { updateDc(patch); return; }
              setWheelConfig((prev: any) => {
                const prevDc = prev.depositConfig || dc;
                const prevOv = (prevDc.bsOverrides || {}) as Record<string, any>;
                return {
                  ...prev,
                  depositConfig: {
                    ...prevDc,
                    bsOverrides: { ...prevOv, ...patch },
                  },
                };
              });
            };
            const depositUrl = dc.tag ? `${baseUrl}/dep=${dc.tag}` : '';
            const depositBsUrl = dc.tag ? `${baseUrl}/depbs=${dc.tag}` : '';

            const handleDepositUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
              const file = e.target.files?.[0]; if (!file) return;
              try {
                const { publicUrl } = await uploadAppAsset(file, 'deposit');
                // All upload fields (logoUrl, bgImageUrl, seoFaviconUrl, seoOgImageUrl, confirmationLogoUrl) are visual
                updateDcv({ [field]: publicUrl });
                toast.success('Imagem enviada!');
              } catch (err: any) { toast.error('Erro: ' + (err.message || 'Tente novamente')); }
              e.target.value = '';
            };

            return (
              <div className="w-full max-w-2xl min-w-0 space-y-6">
                {/* Sub-tabs: Depósito / Depósito BS */}
                <div className="flex gap-2 p-1 rounded-2xl bg-white/[0.04] border border-white/[0.06] w-fit">
                  {[
                    { key: 'dep', label: 'Depósito' },
                    { key: 'depbs', label: 'Depósito BS' },
                  ].map(t => (
                    <button
                      key={t.key}
                      onClick={() => setDepositVariant(t.key as 'dep' | 'depbs')}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${depositVariant === t.key ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Ativar + Tag */}
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign size={20} className="text-primary" />
                      <h3 className="text-base font-bold text-foreground">{depositVariant === 'depbs' ? 'Página de Depósito BS' : 'Página de Depósito'}</h3>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-xs text-muted-foreground">{dc.enabled ? 'Ativa' : 'Inativa'}</span>
                      <div className={`relative w-10 h-5 rounded-full transition-all cursor-pointer ${dc.enabled ? 'bg-primary' : 'bg-white/[0.1]'}`} onClick={() => updateDc({ enabled: !dc.enabled })}>
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${dc.enabled ? 'left-[22px]' : 'left-0.5'}`} />
                      </div>
                    </label>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Tag da rota (URL)</label>
                    <input value={dc.tag || ''} onChange={e => updateDc({ tag: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() })} placeholder="ex: meudeposito" className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
                    {(depositVariant === 'depbs' ? depositBsUrl : depositUrl) && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground truncate">{depositVariant === 'depbs' ? depositBsUrl : depositUrl}</span>
                        <button onClick={() => { const url = depositVariant === 'depbs' ? depositBsUrl : depositUrl; navigator.clipboard.writeText(url); toast.success('Link copiado!'); }} className="text-xs text-primary hover:text-primary/80 shrink-0"><Copy size={12} /></button>
                        <a href={depositVariant === 'depbs' ? depositBsUrl : depositUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:text-primary/80 shrink-0"><ExternalLink size={12} /></a>
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground/70 mt-1">
                      {depositVariant === 'depbs'
                        ? 'Compartilha tag, valores e credenciais EdPay com o Depósito padrão. Visual, textos, SEO/pixels e tela de confirmação são independentes.'
                        : 'Tag única para gerar a URL pública desta página.'}
                    </p>
                  </div>
                </div>

                {/* Configuração do formulário */}
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Settings size={18} className="text-primary" />
                    <h3 className="text-base font-bold text-foreground">Configurações do Formulário</h3>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Label do campo de ID</label>
                    <input value={dc.accountIdLabel || ''} onChange={e => updateDc({ accountIdLabel: e.target.value })} placeholder="Ex: ID da Conta, Matrícula, CPF..." className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Descrição da página</label>
                    <input value={dcv.description || ''} onChange={e => updateDcv({ description: e.target.value })} placeholder="Texto exibido no topo" className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
                  </div>
                </div>

                {/* Valores */}
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Wallet size={18} className="text-primary" />
                    <h3 className="text-base font-bold text-foreground">Valores</h3>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Valor mínimo (R$)</label>
                    <input type="number" min={1} step="0.01" value={dcv.minimumValue ?? 10} onChange={e => updateDcv({ minimumValue: Math.max(1, Number(e.target.value)) })} className="w-32 px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">Valores pré-definidos</label>
                    <div className="flex flex-wrap gap-2">
                      {(dcv.presetValues || []).map((val: number, idx: number) => (
                        <div key={idx} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08]">
                          <span className="text-xs text-foreground">R$ {val.toFixed(2)}</span>
                          <button onClick={() => { const nv = [...(dcv.presetValues || [])]; nv.splice(idx, 1); updateDcv({ presetValues: nv }); }} className="text-destructive hover:text-destructive/80 ml-1"><X size={12} /></button>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="number" min={1} step="0.01" placeholder="Novo valor" id="deposit-new-preset" className="w-32 px-3 py-2 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
                      <button onClick={() => { const inp = document.getElementById('deposit-new-preset') as HTMLInputElement; const val = Number(inp?.value); if (val >= 1) { updateDcv({ presetValues: [...(dcv.presetValues || []), val] }); if (inp) inp.value = ''; } }} className="px-3 py-2 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:brightness-110 transition-all"><Plus size={14} /></button>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer pt-2">
                    <Checkbox checked={dcv.allowCustomValue !== false} onCheckedChange={(v) => updateDcv({ allowCustomValue: !!v })} />
                    <span className="text-sm text-foreground">Permitir valor personalizado</span>
                  </label>
                </div>

                {/* Limites — exclusivos do Depósito BS */}
                {depositVariant === 'depbs' && (() => {
                  const [bsStats, setBsStats] = [bsDepositStats, setBsDepositStats];
                  const refreshStats = async () => {
                    if (!session?.user?.id) return;
                    const sinceIso = dc.bsLimitsResetAt || null;
                    const { data } = await (supabase as any).rpc('get_bs_deposit_stats', { p_owner_id: session.user.id, p_since: sinceIso });
                    const row = Array.isArray(data) ? data[0] : null;
                    setBsStats({ total: Number(row?.total_amount || 0), count: Number(row?.total_count || 0) });
                  };
                  return (
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign size={18} className="text-primary" />
                      <h3 className="text-base font-bold text-foreground">Limites de Aceitação (Depósito BS)</h3>
                    </div>
                    <p className="text-[11px] text-muted-foreground/80 -mt-2">Use 0 para "sem limite". Os limites contam apenas depósitos BS confirmados.</p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">Máx por depósito (R$)</label>
                        <input type="number" min={0} step="0.01" value={dc.bsMaxPerDeposit ?? 0} onChange={e => updateDc({ bsMaxPerDeposit: Math.max(0, Number(e.target.value)) })} className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">Total acumulado máx (R$)</label>
                        <input type="number" min={0} step="0.01" value={dc.bsMaxTotal ?? 0} onChange={e => updateDc({ bsMaxTotal: Math.max(0, Number(e.target.value)) })} className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">Quantidade máx de depósitos</label>
                        <input type="number" min={0} step="1" value={dc.bsMaxCount ?? 0} onChange={e => updateDc({ bsMaxCount: Math.max(0, Math.floor(Number(e.target.value))) })} className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Mensagem quando limite for atingido</label>
                      <input value={dc.bsLimitReachedMessage || ''} onChange={e => updateDc({ bsLimitReachedMessage: e.target.value })} placeholder="O limite de depósitos para esta página foi atingido. Volte mais tarde." className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
                    </div>

                    {/* Reset counters */}
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex-1 min-w-[200px]">
                          <p className="text-xs font-semibold text-amber-300/90 mb-1">Contagem atual (após último reset)</p>
                          <p className="text-[11px] text-muted-foreground">
                            {bsStats.count} depósito(s) · R$ {bsStats.total.toFixed(2)}
                            {dc.bsLimitsResetAt && (
                              <span className="block opacity-70">desde {new Date(dc.bsLimitsResetAt).toLocaleString('pt-BR')}</span>
                            )}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={refreshStats}
                            className="px-3 py-2 rounded-xl text-xs font-medium bg-white/[0.06] hover:bg-white/[0.12] text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5"
                          >
                            <RotateCcw size={12} /> Atualizar
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const ok = await confirmDialog({
                                title: 'Resetar contagem de depósitos BS?',
                                message: 'A partir de agora, apenas novos depósitos contarão para os limites de "Total acumulado" e "Quantidade máx". O histórico não é apagado.',
                                confirmLabel: 'Resetar agora',
                                variant: 'warning',
                              });
                              if (!ok || !session?.user?.id) return;
                              const nowIso = new Date().toISOString();
                              // Persist immediately to DB so the public deposit page picks it up
                              const { data: dbRow } = await (supabase as any)
                                .from('wheel_configs')
                                .select('config')
                                .eq('user_id', session.user.id)
                                .maybeSingle();
                              const dbConfig = dbRow?.config || {};
                              const newConfig = {
                                ...dbConfig,
                                depositConfig: { ...(dbConfig.depositConfig || {}), ...dc, bsLimitsResetAt: nowIso },
                              };
                              const { error } = await (supabase as any)
                                .from('wheel_configs')
                                .update({ config: newConfig, updated_at: nowIso })
                                .eq('user_id', session.user.id);
                              if (error) { toast.error('Erro ao resetar: ' + error.message); return; }
                              updateDc({ bsLimitsResetAt: nowIso });
                              toast.success('Contagem resetada!');
                              await refreshStats();
                            }}
                            className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition-all flex items-center gap-1.5 shadow-lg shadow-amber-600/20"
                          >
                            <RotateCcw size={12} /> Resetar contagem
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  );
                })()}

                {/* Visual */}
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Palette size={18} className="text-primary" />
                    <h3 className="text-base font-bold text-foreground">Visual da Página</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Fundo</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={dcv.bgColor || '#0a0a0f'} onChange={e => updateDcv({ bgColor: e.target.value })} className="w-8 h-8 rounded-lg border border-white/[0.08] cursor-pointer" />
                        <span className="text-[10px] font-mono text-muted-foreground">{dcv.bgColor || '#0a0a0f'}</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Destaque</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={dcv.accentColor || '#10b981'} onChange={e => updateDcv({ accentColor: e.target.value })} className="w-8 h-8 rounded-lg border border-white/[0.08] cursor-pointer" />
                        <span className="text-[10px] font-mono text-muted-foreground">{dcv.accentColor || '#10b981'}</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Texto</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={dcv.textColor || '#ffffff'} onChange={e => updateDcv({ textColor: e.target.value })} className="w-8 h-8 rounded-lg border border-white/[0.08] cursor-pointer" />
                        <span className="text-[10px] font-mono text-muted-foreground">{dcv.textColor || '#ffffff'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Logo</label>
                    <div className="flex items-center gap-3">
                      {dcv.logoUrl && <img src={dcv.logoUrl} alt="" className="h-10 w-10 rounded-lg border border-white/[0.08] object-contain" />}
                      <label className="cursor-pointer rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs text-foreground hover:bg-white/[0.1] transition-all">
                        {dcv.logoUrl ? '🔄 Trocar' : '📤 Enviar'} Logo
                        <input type="file" accept="image/*" onChange={e => handleDepositUpload(e, 'logoUrl')} className="hidden" />
                      </label>
                      {dcv.logoUrl && <button onClick={() => updateDcv({ logoUrl: '' })} className="text-xs text-destructive"><Trash2 size={14} /></button>}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Imagem de fundo</label>
                    <div className="flex items-center gap-3">
                      {dcv.bgImageUrl && <img src={dcv.bgImageUrl} alt="" className="h-10 w-16 rounded-lg border border-white/[0.08] object-cover" />}
                      <label className="cursor-pointer rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs text-foreground hover:bg-white/[0.1] transition-all">
                        {dcv.bgImageUrl ? '🔄 Trocar' : '📤 Enviar'} Fundo
                        <input type="file" accept="image/*" onChange={e => handleDepositUpload(e, 'bgImageUrl')} className="hidden" />
                      </label>
                      {dcv.bgImageUrl && <button onClick={() => updateDcv({ bgImageUrl: '' })} className="text-xs text-destructive"><Trash2 size={14} /></button>}
                    </div>
                  </div>
                </div>

                {/* SEO */}
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Globe size={18} className="text-primary" />
                    <h3 className="text-base font-bold text-foreground">SEO / Meta Tags</h3>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Título da página</label>
                    <input value={dcv.seoTitle || ''} onChange={e => updateDcv({ seoTitle: e.target.value })} placeholder="Título exibido na aba do navegador" className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Meta descrição</label>
                    <textarea value={dcv.seoDescription || ''} onChange={e => updateDcv({ seoDescription: e.target.value })} placeholder="Descrição para SEO e compartilhamento" rows={2} className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all resize-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Favicon</label>
                    <div className="flex items-center gap-3">
                      {dcv.seoFaviconUrl && <img src={dcv.seoFaviconUrl} alt="" className="h-8 w-8 rounded border border-white/[0.08] object-contain" />}
                      <label className="cursor-pointer rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs text-foreground hover:bg-white/[0.1] transition-all">
                        {dcv.seoFaviconUrl ? '🔄 Trocar' : '📤 Enviar'} Favicon
                        <input type="file" accept="image/*" onChange={e => handleDepositUpload(e, 'seoFaviconUrl')} className="hidden" />
                      </label>
                      {dcv.seoFaviconUrl && <button onClick={() => updateDcv({ seoFaviconUrl: '' })} className="text-xs text-destructive"><Trash2 size={14} /></button>}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Imagem social (OG Image)</label>
                    <div className="flex items-center gap-3">
                      {dcv.seoOgImageUrl && <img src={dcv.seoOgImageUrl} alt="" className="h-10 w-16 rounded-lg border border-white/[0.08] object-cover" />}
                      <label className="cursor-pointer rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs text-foreground hover:bg-white/[0.1] transition-all">
                        {dcv.seoOgImageUrl ? '🔄 Trocar' : '📤 Enviar'} OG Image
                        <input type="file" accept="image/*" onChange={e => handleDepositUpload(e, 'seoOgImageUrl')} className="hidden" />
                      </label>
                      {dcv.seoOgImageUrl && <button onClick={() => updateDcv({ seoOgImageUrl: '' })} className="text-xs text-destructive"><Trash2 size={14} /></button>}
                    </div>
                  </div>
                </div>

                {/* Pixel / Tracking */}
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <BarChart3 size={18} className="text-primary" />
                    <h3 className="text-base font-bold text-foreground">Pixel / Tracking</h3>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Facebook Pixel ID</label>
                    <input value={dcv.pixelFacebook || ''} onChange={e => updateDcv({ pixelFacebook: e.target.value })} placeholder="Ex: 123456789" className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Google Analytics / GTM ID</label>
                    <input value={dcv.pixelGoogle || ''} onChange={e => updateDcv({ pixelGoogle: e.target.value })} placeholder="Ex: G-XXXXXXX ou GTM-XXXXXXX" className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">TikTok Pixel ID</label>
                    <input value={dcv.pixelTiktok || ''} onChange={e => updateDcv({ pixelTiktok: e.target.value })} placeholder="Ex: CXXXXXXX" className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Script customizado (Head)</label>
                    <textarea value={dcv.customHeadScript || ''} onChange={e => updateDcv({ customHeadScript: e.target.value })} placeholder="<script>...</script>" rows={3} className="w-full px-4 py-2.5 rounded-xl text-xs font-mono bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all resize-none" />
                  </div>
                </div>

                {/* Tela de Confirmação */}
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 size={18} className="text-primary" />
                    <h3 className="text-base font-bold text-foreground">Tela de Confirmação</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">Exibida após o pagamento ser confirmado.</p>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Título da confirmação</label>
                    <input value={dcv.confirmationTitle || ''} onChange={e => updateDcv({ confirmationTitle: e.target.value })} placeholder="Pagamento Confirmado!" className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Mensagem de confirmação</label>
                    <textarea value={dcv.confirmationMessage || ''} onChange={e => updateDcv({ confirmationMessage: e.target.value })} placeholder="Seu depósito foi recebido com sucesso." rows={2} className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all resize-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Cor do título</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={dcv.confirmationTitleColor || dcv.accentColor || '#10b981'} onChange={e => updateDcv({ confirmationTitleColor: e.target.value })} className="w-10 h-10 rounded-lg border border-white/[0.08] cursor-pointer bg-transparent p-0.5" />
                        <input value={dcv.confirmationTitleColor || ''} onChange={e => updateDcv({ confirmationTitleColor: e.target.value })} placeholder="Cor de destaque" className="flex-1 px-3 py-2 rounded-xl text-xs bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Cor da mensagem</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={dcv.confirmationMessageColor || '#94a3b8'} onChange={e => updateDcv({ confirmationMessageColor: e.target.value })} className="w-10 h-10 rounded-lg border border-white/[0.08] cursor-pointer bg-transparent p-0.5" />
                        <input value={dcv.confirmationMessageColor || ''} onChange={e => updateDcv({ confirmationMessageColor: e.target.value })} placeholder="Padrão suave" className="flex-1 px-3 py-2 rounded-xl text-xs bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Cor dos rótulos do recibo</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={dcv.confirmationReceiptLabelColor || '#94a3b8'} onChange={e => updateDcv({ confirmationReceiptLabelColor: e.target.value })} className="w-10 h-10 rounded-lg border border-white/[0.08] cursor-pointer bg-transparent p-0.5" />
                        <input value={dcv.confirmationReceiptLabelColor || ''} onChange={e => updateDcv({ confirmationReceiptLabelColor: e.target.value })} placeholder="Padrão suave" className="flex-1 px-3 py-2 rounded-xl text-xs bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Cor dos valores + Valor Depositado</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={dcv.confirmationReceiptValueColor || dcv.accentColor || '#10b981'} onChange={e => updateDcv({ confirmationReceiptValueColor: e.target.value })} className="w-10 h-10 rounded-lg border border-white/[0.08] cursor-pointer bg-transparent p-0.5" />
                        <input value={dcv.confirmationReceiptValueColor || ''} onChange={e => updateDcv({ confirmationReceiptValueColor: e.target.value })} placeholder="Cor de destaque" className="flex-1 px-3 py-2 rounded-xl text-xs bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Logo da confirmação (opcional)</label>
                    <div className="flex items-center gap-3">
                      {dcv.confirmationLogoUrl && <img src={dcv.confirmationLogoUrl} alt="" className="h-10 w-10 rounded-lg border border-white/[0.08] object-contain" />}
                      <label className="cursor-pointer rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs text-foreground hover:bg-white/[0.1] transition-all">
                        {dcv.confirmationLogoUrl ? '🔄 Trocar' : '📤 Enviar'}
                        <input type="file" accept="image/*" onChange={e => handleDepositUpload(e, 'confirmationLogoUrl')} className="hidden" />
                      </label>
                      {dcv.confirmationLogoUrl && <button onClick={() => updateDcv({ confirmationLogoUrl: '' })} className="text-xs text-destructive"><Trash2 size={14} /></button>}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Texto do botão pós-pagamento</label>
                    <input value={dcv.confirmationButtonText || ''} onChange={e => updateDcv({ confirmationButtonText: e.target.value })} placeholder="Acessar →" className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Link do botão pós-pagamento</label>
                    <input value={dcv.confirmationButtonUrl || ''} onChange={e => updateDcv({ confirmationButtonUrl: e.target.value })} placeholder="https://exemplo.com" className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
                    <p className="text-[10px] text-muted-foreground/60">Deixe vazio para não exibir o botão.</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Cor do botão pós-pagamento</label>
                    <div className="flex items-center gap-3">
                      <input type="color" value={dcv.confirmationButtonColor || dcv.accentColor || '#10b981'} onChange={e => updateDcv({ confirmationButtonColor: e.target.value })} className="w-10 h-10 rounded-lg border border-white/[0.08] cursor-pointer bg-transparent p-0.5" />
                      <input value={dcv.confirmationButtonColor || ''} onChange={e => updateDcv({ confirmationButtonColor: e.target.value })} placeholder="Usa cor de destaque padrão" className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                    <div>
                      <p className="text-xs font-semibold text-foreground">Botão de novo depósito</p>
                      <p className="text-[10px] text-muted-foreground/70">Mostra ou esconde o botão abaixo da confirmação.</p>
                    </div>
                    <button type="button" onClick={() => updateDcv({ showNewDepositButton: !(dcv.showNewDepositButton ?? true) })} className={`relative h-6 w-11 rounded-full transition-all ${(dcv.showNewDepositButton ?? true) ? 'bg-primary' : 'bg-white/[0.12]'}`}>
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${(dcv.showNewDepositButton ?? true) ? 'left-[22px]' : 'left-0.5'}`} />
                    </button>
                  </div>
                </div>

                {/* Comprovante de Recebimento */}
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText size={18} className="text-primary" />
                    <h3 className="text-base font-bold text-foreground">Comprovante de Recebimento</h3>
                    <p className="text-xs text-muted-foreground">(usa mesmas cores do comprovante de pagamento)</p>
                  </div>
                </div>

                {/* Save button */}
                <button
                  onClick={handleSaveConfig}
                  disabled={savingConfig}
                  className="w-full py-3 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:brightness-110 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                  {savingConfig ? '⏳ Salvando...' : '💾 Salvar Configurações'}
                </button>
              </div>
            );
          })()}

          {activeTab === 'hist_deposito' && (() => {
            if (depositHistory.length === 0 && !depositHistoryLoading) { fetchDepositHistory(); }
            const dc = (wheelConfig as any).depositConfig || {};
            const rFont = receiptFontColor || '#1a1a2e';
            const rBg = receiptBgColor || '#ffffff';
            const rAccent = receiptAccentColor || '#3b82f6';
            const rOperator = receiptOperatorName || session?.user?.email || 'Operador';

            return (
              <div className="w-full max-w-4xl min-w-0 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-base font-bold text-foreground">Depósitos Recebidos</h3>
                  <button onClick={fetchDepositHistory} disabled={depositHistoryLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] text-xs text-foreground hover:bg-white/[0.1] transition-all disabled:opacity-50">
                    <RefreshCw size={14} className={depositHistoryLoading ? 'animate-spin' : ''} /> Atualizar
                  </button>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {([['all', 'Todos'], ['paid', 'Pagos'], ['pending', 'Pendentes'], ['cancelled', 'Cancelados']] as const).map(([val, label]) => (
                    <button key={val} onClick={() => setDepositStatusFilter(val as any)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${depositStatusFilter === val ? 'bg-primary text-primary-foreground' : 'bg-white/[0.06] text-muted-foreground hover:bg-white/[0.1]'}`}>
                      {label}
                    </button>
                  ))}
                </div>

                {depositHistoryLoading && depositHistory.length === 0 ? (
                  <div className="text-center py-10"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
                ) : depositHistory.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-sm">Nenhum depósito registrado ainda.</div>
                ) : (() => {
                  const filtered = depositHistory.filter((tx: any) => {
                    if (depositStatusFilter === 'all') return true;
                    if (depositStatusFilter === 'paid') return tx.status === 'paid';
                    if (depositStatusFilter === 'cancelled') return tx.status === 'cancelled' || tx.status === 'expired';
                    if (depositStatusFilter === 'pending') return tx.status === 'pending';
                    return true;
                  });
                  if (filtered.length === 0) return <div className="text-center py-10 text-muted-foreground text-sm">Nenhum depósito com este status.</div>;
                  return (
                  <div className="space-y-2">
                    {filtered.map((tx: any) => {
                      const meta = tx.metadata || {};
                      const isPaid = tx.status === 'paid';
                      const isPending = tx.status === 'pending';
                      const isCancelled = tx.status === 'cancelled' || tx.status === 'expired';
                      return (
                        <div key={tx.id} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: isPaid ? '#d1fae533' : isPending ? '#fef3c733' : '#fee2e233' }}>
                            {isPaid ? <CheckCircle2 size={20} className="text-green-400" /> : isPending ? <Clock size={20} className="text-yellow-400" /> : <Ban size={20} className="text-red-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-foreground truncate">{meta.userName || 'Anônimo'}</span>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isPaid ? 'bg-green-500/20 text-green-400' : isPending ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                                {isPaid ? 'Pago' : isPending ? 'Pendente' : isCancelled ? 'Cancelado' : tx.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                              {meta.userAccountId && <span>ID: {meta.userAccountId}</span>}
                              {meta.userPhone && <span>📱 {meta.userPhone}</span>}
                              <span>{new Date(tx.created_at).toLocaleString('pt-BR')}</span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-lg font-extrabold text-primary">R$ {Number(tx.amount).toFixed(2).replace('.', ',')}</p>
                            {isPaid && (
                              <button onClick={() => setDepositReceipt(tx)} className="flex items-center gap-1 text-[10px] font-medium text-primary hover:text-primary/80 transition-colors mt-1">
                                <FileText size={12} /> Comprovante
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  );
                })()}
              </div>
            );
          })()}


          {activeTab === 'configuracoes' && (
            <div className="w-full max-w-2xl min-w-0 space-y-6">
              {/* Probabilidade do Sorteio */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Target size={20} className="text-primary" />
                  <h3 className="text-base font-bold text-foreground">Probabilidade do Sorteio</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Define a chance de um usuário <strong className="text-foreground">real</strong> ser selecionado versus um <strong className="text-primary">fantasma</strong> nas vagas <em>restantes</em> depois da fila pré-definida e do mínimo de reais. 100% = apenas reais. 0% = apenas fantasmas.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-muted-foreground">Probabilidade de sorteio (%)</label>
                    <span className="text-sm font-bold text-primary">{(wheelConfig as any).drawProbability ?? 0}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={(wheelConfig as any).drawProbability ?? 0}
                    onChange={(e) => setWheelConfig((prev: any) => ({ ...prev, drawProbability: Number(e.target.value) }))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer accent-primary bg-white/[0.08]"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0% — Só fantasmas</span>
                    <span>100% — Só reais</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={(wheelConfig as any).drawProbability ?? 0}
                      onChange={(e) => setWheelConfig((prev: any) => ({ ...prev, drawProbability: Math.max(0, Math.min(100, Number(e.target.value))) }))}
                      className="w-20 px-3 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>

                <div className="border-t border-white/[0.06] pt-4 mt-4">
                  <h4 className="text-sm font-bold text-primary mb-2">Mínimo de pessoas reais por sorteio (global)</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Valor <strong className="text-foreground">padrão</strong> para todos os influenciadores que não tiverem valor próprio. Em cada sorteio, o sistema tenta garantir <strong className="text-foreground">pelo menos X ganhadores reais</strong> (se houver inscritos elegíveis). As vagas restantes são preenchidas pela <strong className="text-foreground">probabilidade</strong> acima (reais vs fantasmas). Use <strong className="text-foreground">0</strong> ou vazio para não forçar mínimo (só a %).
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      value={(wheelConfig as any).minRealWinners ?? 0}
                      onChange={(e) => setWheelConfig((prev: any) => ({ ...prev, minRealWinners: Math.max(0, Number(e.target.value)) }))}
                      className="w-20 px-3 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
                    />
                    <span className="text-sm text-muted-foreground">pessoas reais mínimas</span>
                  </div>
                </div>
              </div>

              {/* Limite de vitórias por dia */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Trophy size={20} className="text-primary" />
                  <h3 className="text-base font-bold text-foreground">Limite de Vitórias por Dia</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Define quantas vezes uma pessoa pode ser sorteada em um período de <strong className="text-foreground">24 horas</strong>. Ao atingir o limite, o participante fica bloqueado (borda vermelha) e não entra no próximo sorteio até o prazo expirar.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={(wheelConfig as any).maxWinsPerDay ?? 1}
                    onChange={(e) => setWheelConfig((prev: any) => ({ ...prev, maxWinsPerDay: Math.max(1, Number(e.target.value)) }))}
                    className="w-20 px-3 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                  <span className="text-sm text-muted-foreground">vitória(s) máximas por 24h</span>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={async () => {
                      if (!await confirmDialog({ title: 'Reiniciar Contadores', message: 'Isso irá limpar o histórico de vitórias de hoje para todos os participantes.', variant: 'warning', confirmLabel: 'Reiniciar' })) return;
                      const todayStart = new Date();
                      todayStart.setHours(0, 0, 0, 0);
                      await (supabase as any).from('prize_payments').delete().eq('owner_id', session?.user?.id).gte('created_at', todayStart.toISOString());
                      toast.success('Contadores de vitórias do dia reiniciados!');
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 transition text-sm font-medium"
                  >
                    <RotateCcw size={14} /> Reiniciar contadores do dia
                  </button>
                </div>
              </div>

              {/* Expiração de Giros */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock size={20} className="text-primary" />
                  <h3 className="text-base font-bold text-foreground">Expiração de Giros</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Define o tempo (em minutos) que o giro ficará disponível após ser concedido (via link de referral ou manualmente). Se o usuário não girar dentro deste prazo, o giro será removido automaticamente. Deixe <strong className="text-foreground">0</strong> para desativar.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={(() => {
                      const unit = (wheelConfig as any).spinExpirationUnit ?? 'minutes';
                      const mins = (wheelConfig as any).spinExpirationMinutes ?? 0;
                      if (unit === 'days') return Math.round(mins / 1440);
                      if (unit === 'hours') return Math.round(mins / 60);
                      return mins;
                    })()}
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value));
                      const unit = (wheelConfig as any).spinExpirationUnit ?? 'minutes';
                      const mins = unit === 'days' ? val * 1440 : unit === 'hours' ? val * 60 : val;
                      setWheelConfig((prev: any) => ({ ...prev, spinExpirationMinutes: mins }));
                    }}
                    className="w-24 px-3 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                  <select
                    value={(wheelConfig as any).spinExpirationUnit ?? 'minutes'}
                    onChange={(e) => {
                      const oldUnit = (wheelConfig as any).spinExpirationUnit ?? 'minutes';
                      const newUnit = e.target.value;
                      const mins = (wheelConfig as any).spinExpirationMinutes ?? 0;
                      // Keep the same total minutes, just change display unit
                      setWheelConfig((prev: any) => ({ ...prev, spinExpirationUnit: newUnit }));
                    }}
                    className="px-3 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
                  >
                    <option value="minutes">Minutos</option>
                    <option value="hours">Horas</option>
                    <option value="days">Dias</option>
                  </select>
                  <span className="text-sm text-muted-foreground">(0 = sem expiração)</span>
                </div>
                {((wheelConfig as any).spinExpirationMinutes ?? 0) > 0 && (
                  <p className="text-xs text-amber-400/80">
                    ⏰ Giros expiram em {(() => {
                      const mins = (wheelConfig as any).spinExpirationMinutes;
                      if (mins >= 1440) return `${Math.round(mins / 1440 * 10) / 10} dia(s)`;
                      if (mins >= 60) return `${Math.round(mins / 60 * 10) / 10} hora(s)`;
                      return `${mins} minuto(s)`;
                    })()} após serem concedidos.
                  </p>
                )}
              </div>

              {/* Cooldown de Auto-Pagamento */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock size={20} className="text-primary" />
                  <h3 className="text-base font-bold text-foreground">Cooldown Auto-Pagamento</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Tempo mínimo entre pagamentos automáticos para o mesmo usuário. Enquanto estiver em cooldown, o pagamento vai para aprovação manual.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={(() => {
                      const unit = (wheelConfig as any).autoPaymentCooldownUnit ?? 'minutes';
                      const mins = (wheelConfig as any).autoPaymentCooldownMinutes ?? 0;
                      if (unit === 'days') return Math.round(mins / 1440);
                      if (unit === 'hours') return Math.round(mins / 60);
                      return mins;
                    })()}
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value));
                      const unit = (wheelConfig as any).autoPaymentCooldownUnit ?? 'minutes';
                      const mins = unit === 'days' ? val * 1440 : unit === 'hours' ? val * 60 : val;
                      setWheelConfig((prev: any) => ({ ...prev, autoPaymentCooldownMinutes: mins }));
                    }}
                    className="w-24 px-3 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                  <select
                    value={(wheelConfig as any).autoPaymentCooldownUnit ?? 'minutes'}
                    onChange={(e) => {
                      setWheelConfig((prev: any) => ({ ...prev, autoPaymentCooldownUnit: e.target.value }));
                    }}
                    className="px-3 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
                  >
                    <option value="minutes">Minutos</option>
                    <option value="hours">Horas</option>
                    <option value="days">Dias</option>
                  </select>
                  <span className="text-sm text-muted-foreground">(0 = sem cooldown)</span>
                </div>
                {((wheelConfig as any).autoPaymentCooldownMinutes ?? 0) > 0 && (
                  <p className="text-xs text-amber-400/80">
                    ⏱️ Após um auto-pagamento, o próximo só será automático após {(() => {
                      const mins = (wheelConfig as any).autoPaymentCooldownMinutes;
                      if (mins >= 1440) return `${Math.round(mins / 1440 * 10) / 10} dia(s)`;
                      if (mins >= 60) return `${Math.round(mins / 60 * 10) / 10} hora(s)`;
                      return `${mins} minuto(s)`;
                    })()}.
                  </p>
                )}
              </div>

              {/* Blacklist - Segmento Fixo */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 space-y-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Ban size={20} className="text-destructive" />
                    <h3 className="text-base font-bold text-foreground">Prêmio da Blacklist</h3>
                  </div>
                  <button
                    onClick={() => setWheelConfig((prev: any) => ({ ...prev, blacklistFixedSegmentEnabled: !(prev.blacklistFixedSegmentEnabled ?? false) }))}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition ${(wheelConfig as any).blacklistFixedSegmentEnabled ? 'bg-destructive/20 text-destructive' : 'bg-white/[0.06] text-muted-foreground'}`}
                  >
                    {(wheelConfig as any).blacklistFixedSegmentEnabled ? '🔴 Ativo' : 'Desativado'}
                  </button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Quando ativado, usuários na blacklist sempre cairão no segmento definido abaixo.
                </p>
                {(wheelConfig as any).blacklistFixedSegmentEnabled && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Segmento fixo para blacklist</label>
                    <select
                      value={(wheelConfig as any).blacklistFixedSegment ?? ''}
                      onChange={(e) => setWheelConfig((prev: any) => ({ ...prev, blacklistFixedSegment: e.target.value === '' ? null : Number(e.target.value) }))}
                      className="w-full px-3 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
                    >
                      <option value="">Selecione um segmento</option>
                      {(wheelConfig as any).segments?.map((seg: any, idx: number) => (
                        <option key={idx} value={idx}>
                          {idx + 1}. {seg.title || seg.reward || `Segmento ${idx + 1}`}
                        </option>
                      ))}
                    </select>
                    {(wheelConfig as any).blacklistFixedSegment != null && (
                      <p className="text-xs text-destructive/80">
                        🚫 Blacklistados sempre ganharão: <strong>{((wheelConfig as any).segments?.[(wheelConfig as any).blacklistFixedSegment]?.title) || ('Segmento ' + ((wheelConfig as any).blacklistFixedSegment + 1))}</strong>
                      </p>
                    )}
                  </div>
                )}
              </div>


              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Pencil size={20} className="text-primary" />
                  <h3 className="text-base font-bold text-foreground">Título da Página</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Texto exibido no topo da página do Influencer, ao lado do ícone.
                </p>
                <input
                  type="text"
                  placeholder="Ex: LUCASBSB"
                  value={(wheelConfig as any).influencerLabel ?? ''}
                  onChange={(e) => setWheelConfig((prev: any) => ({ ...prev, influencerLabel: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
              </div>

              {/* Limite diário de sorteios */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Target size={20} className="text-primary" />
                  <h3 className="text-base font-bold text-foreground">Limite Diário de Sorteios</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Define o número máximo de prêmios que o operador pode enviar por dia na página do Influencer. Quando atingido, o botão de sorteio fica bloqueado.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={(wheelConfig as any).influencerDailyLimit ?? 500}
                    onChange={(e) => setWheelConfig((prev: any) => ({ ...prev, influencerDailyLimit: Math.max(1, Number(e.target.value)) }))}
                    className="w-24 px-3 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                  <span className="text-sm text-muted-foreground">prêmios por dia</span>
                </div>
              </div>

              {/* Efeito Glass dos Cards */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Monitor size={20} className="text-primary" />
                  <h3 className="text-base font-bold text-foreground">Efeito Glass dos Cards</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Controle o efeito de vidro (glassmorphism) aplicado nos cards da página do Influencer.
                </p>

                {/* Glass toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Ativar efeito glass</span>
                  <button
                    onClick={() => setWheelConfig((prev: any) => ({ ...prev, influencerGlassEnabled: !(prev.influencerGlassEnabled ?? true) }))}
                    className={`w-11 h-6 rounded-full transition-all relative ${(wheelConfig as any).influencerGlassEnabled !== false ? 'bg-primary' : 'bg-white/[0.1]'}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all ${(wheelConfig as any).influencerGlassEnabled !== false ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </div>

                {(wheelConfig as any).influencerGlassEnabled !== false && (
                  <>
                    {/* Blur intensity */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Intensidade do blur</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="range" min="0" max="40"
                          value={(wheelConfig as any).influencerGlassBlur ?? 16}
                          onChange={e => setWheelConfig((prev: any) => ({ ...prev, influencerGlassBlur: parseInt(e.target.value) }))}
                          className="w-28 accent-primary h-1.5"
                        />
                        <span className="text-xs font-mono text-muted-foreground w-10 text-right">{(wheelConfig as any).influencerGlassBlur ?? 16}px</span>
                      </div>
                    </div>

                    {/* Card background opacity */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Opacidade do fundo</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="range" min="0" max="100"
                          value={(wheelConfig as any).influencerCardBgOpacity ?? 95}
                          onChange={e => setWheelConfig((prev: any) => ({ ...prev, influencerCardBgOpacity: parseInt(e.target.value) }))}
                          className="w-28 accent-primary h-1.5"
                        />
                        <span className="text-xs font-mono text-muted-foreground w-10 text-right">{(wheelConfig as any).influencerCardBgOpacity ?? 95}%</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users size={20} className="text-muted-foreground" />
                  <h3 className="text-base font-bold text-foreground">Usuários Fantasmas</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Nomes fictícios que entram no pool do sorteio conforme a probabilidade configurada acima.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nome1, Nome2, Nome3 (separe por vírgula)"
                    value={ghostUserName}
                    onChange={(e) => setGhostUserName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && ghostUserName.trim()) {
                        const names = ghostUserName.split(',').map(n => n.trim()).filter(Boolean);
                        if (names.length === 0) return;
                        const current: string[] = (wheelConfig as any).ghostUsers || [];
                        setWheelConfig((prev: any) => ({ ...prev, ghostUsers: [...current, ...names] }));
                        setGhostUserName('');
                      }
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                  <button
                    onClick={() => {
                      const names = ghostUserName.split(',').map(n => n.trim()).filter(Boolean);
                      if (names.length === 0) return;
                      const current: string[] = (wheelConfig as any).ghostUsers || [];
                      setWheelConfig((prev: any) => ({ ...prev, ghostUsers: [...current, ...names] }));
                      setGhostUserName('');
                    }}
                    className="px-4 py-2.5 rounded-xl bg-accent/20 border border-accent/30 text-accent-foreground hover:bg-accent/30 transition text-sm font-medium"
                  >
                    Adicionar
                  </button>
                </div>

                {((wheelConfig as any).ghostUsers || []).length > 0 && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => setWheelConfig((prev: any) => ({ ...prev, ghostUsers: [] }))}
                      className="text-xs text-destructive hover:underline"
                    >
                      Remover todos
                    </button>
                  </div>
                )}

                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] min-h-[80px] p-3">
                  {((wheelConfig as any).ghostUsers || []).length === 0 ? (
                    <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                      <span>👻</span> Nenhum usuário fantasma cadastrado.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {((wheelConfig as any).ghostUsers as string[]).map((name: string, idx: number) => (
                        <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-sm text-foreground">
                          {name}
                          <button
                            onClick={() => {
                              const current: string[] = [...((wheelConfig as any).ghostUsers || [])];
                              current.splice(idx, 1);
                              setWheelConfig((prev: any) => ({ ...prev, ghostUsers: current }));
                            }}
                            className="text-muted-foreground hover:text-destructive transition ml-0.5"
                          >
                            <X size={14} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Limpar Dados da Gorjeta */}
              <div className="rounded-2xl border border-destructive/20 bg-destructive/[0.03] p-6 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Trash2 size={20} className="text-destructive" />
                  <h3 className="text-base font-bold text-foreground">Limpar Dados da Gorjeta</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Gerencie os dados de sorteios/gorjetas. O botão de limpar ganhadores de hoje <strong className="text-destructive">é irreversível</strong>. O botão de ocultar apenas esconde os dados na página do Influencer.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={async () => {
                      if (!await confirmDialog({ title: 'Limpar Ganhadores de Hoje', message: 'Tem certeza que deseja limpar os ganhadores de hoje?', variant: 'danger', confirmLabel: 'Limpar' })) return;
                      const uid = session?.user?.id;
                      if (!uid) return;
                      const todayStart = new Date();
                      todayStart.setHours(0, 0, 0, 0);
                      await (supabase as any).from('prize_payments').delete().eq('owner_id', uid).gte('created_at', todayStart.toISOString());
                      toast.success('Ganhadores de hoje limpos!');
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border border-destructive/30 text-destructive hover:bg-destructive/10 transition-all"
                  >
                    <Trash2 size={14} /> Limpar ganhadores de hoje
                  </button>
                  <button
                    onClick={async () => {
                      if (!await confirmDialog({ title: 'Ocultar Histórico no Influencer', message: 'Isso irá ocultar todo o histórico de gorjeta na página do Influencer. Os dados continuarão visíveis aqui na Dashboard.', variant: 'warning', confirmLabel: 'Ocultar' })) return;
                      const uid = session?.user?.id;
                      if (!uid) return;
                      await (supabase as any).from('prize_payments').update({ hidden_from_influencer: true }).eq('owner_id', uid);
                      toast.success('Histórico ocultado na página do Influencer!');
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border border-destructive/30 text-destructive hover:bg-destructive/10 transition-all"
                  >
                    <Eye size={14} /> Ocultar histórico no Influencer
                  </button>
                </div>
              </div>

              {/* Painel da Casa - URL do iframe */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Monitor size={20} className="text-primary" />
                  <h3 className="text-base font-bold text-foreground">Painel da Casa (iframe)</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Cole a URL do painel externo que deseja embutir na aba <strong className="text-foreground">Painel da Casa</strong>.
                </p>
                <input
                  type="url"
                  placeholder="https://exemplo.com/painel"
                  value={panelCasaUrl}
                  onChange={(e) => setPanelCasaUrl(e.target.value)}
                  onBlur={(e) => setPanelCasaUrl(normalizePanelCasaUrl(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
              </div>

              {/* Save button */}
              <button
                onClick={handleSaveConfig}
                className="w-full py-3 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:brightness-110 transition-all"
              >
                {savingConfig ? 'Salvando...' : '💾 Salvar Configurações'}
              </button>
            </div>
          )}

          {/* Painel da Casa: always mounted to preserve iframe session */}
          <div className="w-full min-w-0" style={{ height: 'calc(100vh - 80px)', display: activeTab === 'painel_casa' ? 'block' : 'none' }}>
            {resolvedPanelCasaUrl ? (
              <iframe
                src={resolvedPanelCasaUrl}
                className="w-full h-full rounded-2xl border border-white/[0.08]"
                allow="fullscreen"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads allow-modals allow-pointer-lock allow-presentation allow-storage-access-by-user-activation"
                referrerPolicy="strict-origin-when-cross-origin"
                title="Painel da Casa"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
                <Monitor size={48} className="opacity-40" />
                <p className="text-sm">Nenhuma URL configurada. Vá em <strong className="text-foreground">Configurações</strong> para definir a URL do painel.</p>
              </div>
            )}
          </div>

          {activeTab === 'msg_analytics' && (
            <div className="w-full max-w-[1200px] min-w-0">
              <MessagingAnalytics ownerId={session?.user?.id || ''} />
            </div>
          )}

          {activeTab === 'financeiro' && (
            <div className="w-full max-w-2xl min-w-0 space-y-5">
              {/* Sub-tabs with scroll arrows */}
              <div className="relative flex items-center gap-1">
                <button onClick={() => { const el = document.getElementById('fin-subtabs'); el?.scrollBy({ left: -200, behavior: 'smooth' }); }} className="shrink-0 w-7 h-7 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-muted-foreground hover:text-foreground transition-all">
                  <ChevronLeft size={16} />
                </button>
                <div id="fin-subtabs" className="flex gap-2 overflow-x-auto pb-1 [touch-action:pan-x] flex-1" style={{ scrollbarWidth: 'none' }}>
                  {[
                    { key: 'credenciais' as const, label: '🔑 Credenciais' },
                    { key: 'saldo' as const, label: '💲 Saldo' },
                    { key: 'deposito' as const, label: '💰 Depósito PIX' },
                    { key: 'crypto' as const, label: '🪙 Depósito USDT' },
                    { key: 'withdraw' as const, label: '📤 Saque USDT' },
                    { key: 'pagamento_manual' as const, label: '💳 Pagamento Manual' },
                    { key: 'aprovacoes' as const, label: '✅ Aprovações' },
                    { key: 'historico' as const, label: '📜 Histórico' },
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => { setFinanceiroSubTab(tab.key); if (tab.key === 'aprovacoes') fetchPrizePayments(); if (tab.key === 'historico') fetchPaidHistory(); if (tab.key === 'pagamento_manual') fetchUsers(); }}
                      className={`shrink-0 whitespace-nowrap px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                        financeiroSubTab === tab.key
                          ? 'bg-primary/15 text-primary border border-primary/20'
                          : 'bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08] border border-transparent'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <button onClick={() => { const el = document.getElementById('fin-subtabs'); el?.scrollBy({ left: 200, behavior: 'smooth' }); }} className="shrink-0 w-7 h-7 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-muted-foreground hover:text-foreground transition-all">
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Credenciais Sub-tab */}
              {financeiroSubTab === 'credenciais' && (
                <>
                <GlassCard className="p-4 space-y-3">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Visibilidade das Seções</h3>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground">EdPay — Chaves</span>
                    <button onClick={() => setHideEdpaySection(!hideEdpaySection)} className={`w-10 h-5 rounded-full transition-colors ${!hideEdpaySection ? 'bg-primary' : 'bg-white/10'}`}>
                      <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${!hideEdpaySection ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground">Comprovante de Pagamento</span>
                    <button onClick={() => setHideReceiptSection(!hideReceiptSection)} className={`w-10 h-5 rounded-full transition-colors ${!hideReceiptSection ? 'bg-primary' : 'bg-white/10'}`}>
                      <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${!hideReceiptSection ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                </GlassCard>

                {!hideEdpaySection && (
                <GlassCard className="p-5 space-y-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center"><Wallet size={20} className="text-primary" /></div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">EdPay — Gateway de Pagamento</h3>
                      <p className="text-xs text-muted-foreground">Configure suas credenciais para processar pagamentos via PIX</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Chave Pública</label>
                      <input type="text" value={edpayPublicKey} onChange={e => setEdpayPublicKey(e.target.value)} placeholder="pk_live_..." className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Chave Secreta</label>
                      <div className="relative">
                        <input type={showEdpaySecret ? 'text' : 'password'} value={edpaySecretKey} onChange={e => setEdpaySecretKey(e.target.value)} placeholder="sk_live_..." className="w-full px-4 py-2.5 pr-12 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
                        <button type="button" onClick={() => setShowEdpaySecret(!showEdpaySecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"><Eye size={16} /></button>
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
                )}

                {!hideReceiptSection && (
                <GlassCard className="p-5 space-y-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center"><FileText size={20} className="text-primary" /></div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Comprovante de Pagamento</h3>
                      <p className="text-xs text-muted-foreground">Personalize a aparência do comprovante</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Apelido do Operador</label>
                      <input type="text" value={receiptOperatorName} onChange={e => setReceiptOperatorName(e.target.value)} placeholder={session?.user?.email || 'Ex: Lucas BSB'} className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
                      <p className="text-[10px] text-muted-foreground mt-1">Substitui o e-mail no campo "Enviado por" do comprovante</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Cor da Fonte</label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={receiptFontColor} onChange={e => setReceiptFontColor(e.target.value)} className="w-8 h-8 rounded-lg border border-white/[0.08] cursor-pointer bg-transparent" />
                          <input type="text" value={receiptFontColor} onChange={e => setReceiptFontColor(e.target.value)} className="flex-1 px-2 py-1.5 rounded-lg text-xs bg-white/[0.06] border border-white/[0.08] text-foreground font-mono" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Cor de Fundo</label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={receiptBgColor} onChange={e => setReceiptBgColor(e.target.value)} className="w-8 h-8 rounded-lg border border-white/[0.08] cursor-pointer bg-transparent" />
                          <input type="text" value={receiptBgColor} onChange={e => setReceiptBgColor(e.target.value)} className="flex-1 px-2 py-1.5 rounded-lg text-xs bg-white/[0.06] border border-white/[0.08] text-foreground font-mono" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Cor Destaque</label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={receiptAccentColor} onChange={e => setReceiptAccentColor(e.target.value)} className="w-8 h-8 rounded-lg border border-white/[0.08] cursor-pointer bg-transparent" />
                          <input type="text" value={receiptAccentColor} onChange={e => setReceiptAccentColor(e.target.value)} className="flex-1 px-2 py-1.5 rounded-lg text-xs bg-white/[0.06] border border-white/[0.08] text-foreground font-mono" />
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/[0.08] overflow-hidden">
                      <div className="text-center py-4 px-3" style={{ backgroundColor: receiptBgColor, color: receiptFontColor }}>
                        <p className="text-[10px] font-bold uppercase tracking-widest">Pré-visualização</p>
                        <p className="text-lg font-extrabold mt-1" style={{ color: receiptAccentColor }}>R$ 10,00</p>
                        <p className="text-[10px] mt-1">Enviado por: <b>{receiptOperatorName || session?.user?.email || 'Operador'}</b></p>
                      </div>
                    </div>
                  </div>
                </GlassCard>
                )}

                <button onClick={handleSaveConfig} className="w-full py-3 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:brightness-110 transition-all">
                  Salvar Configurações
                </button>
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

              {/* Pagamento Manual Sub-tab */}
              {financeiroSubTab === 'pagamento_manual' && (
                <GlassCard className="p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                      <DollarSign size={20} className="text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Pagamento Manual</h3>
                      <p className="text-xs text-muted-foreground">Selecione inscritos e envie pagamentos manualmente via PIX</p>
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
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Valor por pessoa (R$)</label>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={manualPayAmount}
                            onChange={e => setManualPayAmount(e.target.value)}
                            placeholder="10.00"
                            className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Descrição do prêmio</label>
                          <input
                            type="text"
                            value={manualPayPrize}
                            onChange={e => setManualPayPrize(e.target.value)}
                            placeholder="Ex: Bônus especial"
                            className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                          />
                        </div>
                      </div>

                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Buscar inscrito por nome, email ou ID..."
                          value={manualPaySearch}
                          onChange={e => setManualPaySearch(e.target.value)}
                          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                        />
                      </div>

                      {(() => {
                        const filtered = users.filter(u => {
                          if (!manualPaySearch) return true;
                          const q = manualPaySearch.toLowerCase();
                          return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.account_id.toLowerCase().includes(q);
                        });
                        const allFilteredSelected = filtered.length > 0 && filtered.every(u => manualPaySelectedIds.has(u.id));
                        return (
                          <div className="flex items-center justify-between">
                            <button
                              onClick={() => {
                                if (allFilteredSelected) {
                                  const next = new Set(manualPaySelectedIds);
                                  filtered.forEach(u => next.delete(u.id));
                                  setManualPaySelectedIds(next);
                                } else {
                                  const next = new Set(manualPaySelectedIds);
                                  filtered.forEach(u => { if (u.pix_key) next.add(u.id); });
                                  setManualPaySelectedIds(next);
                                }
                              }}
                              className="text-xs text-primary hover:text-primary/80 font-semibold transition-colors"
                            >
                              {allFilteredSelected ? 'Desmarcar todos' : 'Selecionar todos (com PIX)'}
                            </button>
                            <span className="text-xs text-muted-foreground">{manualPaySelectedIds.size} selecionado(s)</span>
                          </div>
                        );
                      })()}

                      <div className="max-h-[40vh] overflow-y-auto space-y-1.5 pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
                        {users
                          .filter(u => {
                            if (!manualPaySearch) return true;
                            const q = manualPaySearch.toLowerCase();
                            return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.account_id.toLowerCase().includes(q);
                          })
                          .map(u => (
                            <label
                              key={u.id}
                              className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                                manualPaySelectedIds.has(u.id)
                                  ? 'bg-primary/10 border-primary/20'
                                  : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]'
                              } ${!u.pix_key ? 'opacity-50' : ''}`}
                            >
                              <Checkbox
                                checked={manualPaySelectedIds.has(u.id)}
                                disabled={!u.pix_key}
                                onCheckedChange={(checked) => {
                                  const next = new Set(manualPaySelectedIds);
                                  if (checked) next.add(u.id); else next.delete(u.id);
                                  setManualPaySelectedIds(next);
                                }}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate">{u.name}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{u.email} • {u.account_id}</p>
                                {u.pix_key ? (
                                  <p className="text-[10px] text-emerald-400">PIX: {u.pix_key} ({u.pix_key_type})</p>
                                ) : (
                                  <p className="text-[10px] text-amber-400">⚠️ Sem chave PIX cadastrada</p>
                                )}
                              </div>
                            </label>
                          ))}
                      </div>

                      {manualPaySelectedIds.size > 0 && manualPayAmount && Number(manualPayAmount) > 0 && (
                        <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 space-y-1">
                          <p className="text-xs text-foreground font-semibold">
                            💳 Resumo: {manualPaySelectedIds.size} pagamento(s) × R$ {Number(manualPayAmount).toFixed(2)} = <span className="text-primary">R$ {(manualPaySelectedIds.size * Number(manualPayAmount)).toFixed(2)}</span>
                          </p>
                          <p className="text-[10px] text-muted-foreground">Prêmio: {manualPayPrize || '(sem descrição)'}</p>
                        </div>
                      )}

                      <button
                        disabled={manualPaySending || manualPaySelectedIds.size === 0 || !manualPayAmount || Number(manualPayAmount) <= 0}
                        onClick={async () => {
                          const count = manualPaySelectedIds.size;
                          const amt = Number(manualPayAmount).toFixed(2);
                          const total = (count * Number(manualPayAmount)).toFixed(2);
                          if (!await confirmDialog({ title: '💳 Confirmar Pagamento', message: `Enviar ${count} pagamento(s) de R$ ${amt} cada?
Total: R$ ${total}`, variant: 'info', confirmLabel: 'Enviar' })) return;
                          setManualPaySending(true);
                          let success = 0;
                          let failed = 0;
                          const selectedUsers = users.filter(u => manualPaySelectedIds.has(u.id));
                          for (const u of selectedUsers) {
                            try {
                              const { data: ppData, error: ppErr } = await (supabase as any)
                                .from('prize_payments')
                                .insert({
                                  owner_id: session.user.id,
                                  account_id: u.account_id,
                                  user_name: u.name,
                                  user_email: u.email,
                                  prize: manualPayPrize || 'Pagamento manual',
                                  amount: Number(manualPayAmount),
                                  pix_key: u.pix_key || '',
                                  pix_key_type: u.pix_key_type || '',
                                  auto_payment: false,
                                  status: 'approved',
                                })
                                .select('id')
                                .single();
                              if (ppErr) { failed++; continue; }
                              const { data, error } = await supabase.functions.invoke('edpay-pix-transfer', {
                                body: { paymentId: ppData.id, edpayPublicKey, edpaySecretKey },
                              });
                              if (error || data?.error) { failed++; } else { success++; }
                            } catch { failed++; }
                          }
                          setManualPaySending(false);
                          if (success > 0) toast.success(`${success} pagamento(s) enviado(s) com sucesso!`);
                          if (failed > 0) toast.error(`${failed} pagamento(s) falharam`);
                          setManualPaySelectedIds(new Set());
                        }}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {manualPaySending ? (
                          <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Processando...</>
                        ) : (
                          <>💸 Enviar {manualPaySelectedIds.size} Pagamento(s)</>
                        )}
                      </button>
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
                    <>
                    {/* Select all + bulk actions */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedPrizeIds.size === prizePayments.filter((p: any) => p.status === 'pending' || p.status === 'auto_pending' || p.status === 'approved' || p.status === 'failed' || p.status === 'processing').length && selectedPrizeIds.size > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPrizeIds(new Set(prizePayments.filter((p: any) => p.status === 'pending' || p.status === 'auto_pending' || p.status === 'approved' || p.status === 'failed' || p.status === 'processing').map((p: any) => p.id)));
                            } else {
                              setSelectedPrizeIds(new Set());
                            }
                          }}
                          className="w-4 h-4 rounded accent-primary"
                        />
                        <span className="text-xs text-muted-foreground">Selecionar todos ({prizePayments.filter((p: any) => p.status === 'pending' || p.status === 'auto_pending' || p.status === 'approved' || p.status === 'failed' || p.status === 'processing').length})</span>
                      </label>
                      {selectedPrizeIds.size > 0 && (
                        <div className="flex gap-2">
                          <button
                            onClick={handleBulkPay}
                            disabled={bulkPaying || !edpayPublicKey || !edpaySecretKey}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-all disabled:opacity-50"
                          >
                            {bulkPaying ? <div className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" /> : '💸'} Pagar {selectedPrizeIds.size}
                          </button>
                          <button
                            onClick={handleBulkReject}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
                          >
                            ❌ Recusar {selectedPrizeIds.size}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
                      {prizePayments.map((p: any) => {
                        const statusColors: Record<string, string> = {
                          pending: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
                          auto_pending: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
                          approved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
                          processing: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
                          paid: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
                          rejected: 'bg-red-500/15 text-red-400 border-red-500/20',
                          failed: 'bg-red-500/15 text-red-400 border-red-500/20',
                        };
                        const statusLabels: Record<string, string> = {
                          pending: '⏳ Pendente',
                          auto_pending: '🤖 Auto (Pendente)',
                          approved: '✅ Aprovado',
                          processing: '⏳ Processando',
                          paid: '💰 Pago',
                          rejected: '❌ Rejeitado',
                          failed: '⚠️ Falhou',
                        };
                        const isActionable = p.status === 'pending' || p.status === 'auto_pending' || p.status === 'approved' || p.status === 'failed' || p.status === 'processing';
                        return (
                          <div key={p.id} className={`p-3 rounded-xl bg-white/[0.04] border ${selectedPrizeIds.has(p.id) ? 'border-primary/40' : 'border-white/[0.06]'} space-y-2`}>
                            <div className="flex items-center gap-2">
                              {isActionable && (
                                <input
                                  type="checkbox"
                                  checked={selectedPrizeIds.has(p.id)}
                                  onChange={(e) => {
                                    const next = new Set(selectedPrizeIds);
                                    if (e.target.checked) next.add(p.id); else next.delete(p.id);
                                    setSelectedPrizeIds(next);
                                  }}
                                  className="w-4 h-4 shrink-0 rounded accent-primary"
                                />
                              )}
                              <div className="flex-1 flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-semibold text-foreground">{p.user_name}</p>
                                  <p className="text-[10px] text-muted-foreground">{p.user_email} • {p.account_id}</p>
                                </div>
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusColors[p.status] || 'bg-white/10 text-muted-foreground border-white/10'}`}>
                                  {statusLabels[p.status] || p.status}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">🎁 {p.prize}</span>
                              <span className="font-bold text-foreground">R$ {Number(p.amount).toFixed(2)}</span>
                            </div>
                            {p.pix_key && (
                              <p className="text-[10px] text-muted-foreground">PIX: {p.pix_key} ({p.pix_key_type})</p>
                            )}
                            <p className="text-[10px] text-muted-foreground">{new Date(p.created_at).toLocaleString('pt-BR')}</p>

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
                            {p.status === 'processing' && (
                              <div className="flex gap-2 pt-1">
                                <span className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-semibold bg-yellow-500/10 text-yellow-400">
                                  <div className="w-3 h-3 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" /> Aguardando confirmação
                                </span>
                                <button
                                  onClick={() => handleRejectPrize(p.id)}
                                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-all"
                                >
                                  ❌ Cancelar
                                </button>
                              </div>
                            )}
                            {p.edpay_transaction_id && (
                              <p className="text-[10px] text-muted-foreground">TX: {p.edpay_transaction_id}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    </>
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
                            <div className="flex items-center justify-between">
                              <p className="text-[10px] text-muted-foreground">Criado: {new Date(p.created_at).toLocaleString('pt-BR')}</p>
                              {isPaid && (
                                <button
                                  onClick={() => openReceipt(p)}
                                  className="flex items-center gap-1 text-[10px] font-medium text-primary hover:text-primary/80 transition-colors"
                                >
                                  <FileText size={12} />
                                  Comprovante
                                </button>
                              )}
                            </div>
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

      {/* Receipt Dialog */}
      <Dialog open={!!receiptPayment} onOpenChange={(open) => { if (!open) setReceiptPayment(null); }}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          {receiptPayment && (() => {
            const isPaid = receiptPayment.status === 'paid';
            const rFont = receiptFontColor || '#1a1a2e';
            const rBg = receiptBgColor || '#ffffff';
            const rAccent = receiptAccentColor || '#3b82f6';
            const rOperator = receiptOperatorName || session?.user?.email || 'Operador';
            return (
              <>
                {/* Top bar */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
                  <span className="text-sm font-semibold text-foreground">Comprovante de Pagamento</span>
                  <button
                    onClick={() => openPrintReceipt('receipt-print-area', rFont, rBg, rAccent)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:brightness-110 transition-all"
                  >
                    🖨 Imprimir / PDF
                  </button>
                </div>

                {/* Printable content */}
                <div id="receipt-print-area" className="px-6 py-5 space-y-4" style={{ backgroundColor: rBg, color: rFont }}>
                  {/* Header */}
                  <div className="text-center space-y-1">
                    <div className="text-2xl">💳</div>
                    <h2 className="text-lg font-extrabold tracking-wider uppercase" style={{ color: rFont }}>Comprovante de Pagamento</h2>
                    <p className="text-xs" style={{ color: '#888' }}>Transferência PIX via EdPay</p>
                    <div className="mt-3">
                      <span style={{
                        display: 'inline-block', padding: '6px 20px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                        background: isPaid ? '#d1fae5' : '#fee2e2',
                        color: isPaid ? '#047857' : '#b91c1c',
                        border: `1px solid ${isPaid ? '#6ee7b7' : '#fca5a5'}`
                      }}>
                        {isPaid ? '✓ PAGAMENTO CONFIRMADO' : '✗ PAGAMENTO REJEITADO'}
                      </span>
                    </div>
                  </div>

                  {/* Transaction Info */}
                  <div className="section" style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
                    {receiptPayment.edpay_transaction_id && (
                      <div className="row flex justify-between text-sm py-1">
                        <span style={{ color: '#888' }}>ID EdPay</span>
                        <span className="font-mono text-xs font-semibold" style={{ color: rFont }}>{receiptPayment.edpay_transaction_id}</span>
                      </div>
                    )}
                    {receiptPayment.spin_result_id && (
                      <div className="row flex justify-between text-sm py-1">
                        <span style={{ color: '#888' }}>ID do Sorteio</span>
                        <span className="font-mono text-xs font-semibold" style={{ color: rFont }}>{receiptPayment.spin_result_id}</span>
                      </div>
                    )}
                    {receiptPayment.paid_at && (
                      <div className="row flex justify-between text-sm py-1">
                        <span style={{ color: '#888' }}>Data/Hora</span>
                        <span className="font-semibold" style={{ color: rFont }}>{new Date(receiptPayment.paid_at).toLocaleString('pt-BR')}</span>
                      </div>
                    )}
                  </div>

                  {/* Sender */}
                  <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
                    <p className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: '#999' }}>Enviado por</p>
                    <p className="text-sm font-bold" style={{ color: rFont }}>{rOperator}</p>
                    <p className="text-xs" style={{ color: '#888' }}>Plataforma EdPay · https://api.edpay.me/</p>
                  </div>

                  {/* Receiver */}
                  <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
                    <p className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: '#999' }}>Recebedor</p>
                    <p className="text-sm font-bold" style={{ color: rFont }}>{receiptPayment.user_name}</p>
                    <p className="text-xs" style={{ color: '#888' }}>{receiptPayment.user_email} · {receiptPayment.account_id}</p>
                    {receiptPayment.pix_key && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded uppercase" style={{ background: '#f3f4f6', color: '#666' }}>{receiptPayment.pix_key_type || 'PIX'}</span>
                        <span className="text-xs font-mono" style={{ color: rFont }}>{receiptPayment.pix_key}</span>
                      </div>
                    )}
                  </div>

                  {/* Amount */}
                  <div className="rounded-xl text-center py-4 px-4" style={{ border: `2px solid ${rAccent}` }}>
                    <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: rAccent }}>Valor Transferido</p>
                    <p className="text-3xl font-extrabold mt-1" style={{ color: rAccent }}>R$ {Number(receiptPayment.amount).toFixed(2).replace('.', ',')}</p>
                    <p className="text-[10px] mt-1" style={{ color: '#888' }}>via PIX instantâneo</p>
                  </div>

                  {/* Footer */}
                  <div className="text-center pt-3 space-y-0.5" style={{ borderTop: '1px solid #e5e7eb' }}>
                    <p className="text-[10px]" style={{ color: '#999' }}>
                      Documento gerado em {new Date().toLocaleString('pt-BR')}
                    </p>
                    <p className="text-[10px]" style={{ color: '#999' }}>
                      Este comprovante é válido como prova de pagamento.
                    </p>
                  </div>
                </div>

                {receiptLoading && (
                  <div className="text-center py-4">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                  </div>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Deposit Receipt Dialog */}
      <Dialog open={!!depositReceipt} onOpenChange={(open) => { if (!open) setDepositReceipt(null); }}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          {depositReceipt && (() => {
            const meta = depositReceipt.metadata || {};
            const isPaid = depositReceipt.status === 'paid';
            const rFont = receiptFontColor || '#1a1a2e';
            const rBg = receiptBgColor || '#ffffff';
            const rAccent = receiptAccentColor || '#3b82f6';
            const rOperator = receiptOperatorName || session?.user?.email || 'Operador';
            return (
              <>
                <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
                  <span className="text-sm font-semibold text-foreground">Comprovante de Recebimento</span>
                  <button
                    onClick={() => openPrintReceipt('deposit-receipt-print', rFont, rBg, rAccent)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:brightness-110 transition-all"
                  >
                    🖨 Imprimir / PDF
                  </button>
                </div>
                <div id="deposit-receipt-print" className="px-6 py-5 space-y-4" style={{ backgroundColor: rBg, color: rFont }}>
                  <div className="text-center space-y-1">
                    <div className="text-2xl">💰</div>
                    <h2 className="text-lg font-extrabold tracking-wider uppercase" style={{ color: rFont }}>Comprovante de Recebimento</h2>
                    <p className="text-xs" style={{ color: '#888' }}>Depósito PIX via EdPay</p>
                    <div className="mt-3">
                      <span style={{ display: 'inline-block', padding: '6px 20px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: isPaid ? '#d1fae5' : '#fee2e2', color: isPaid ? '#047857' : '#b91c1c', border: `1px solid ${isPaid ? '#6ee7b7' : '#fca5a5'}` }}>
                        {isPaid ? '✓ DEPÓSITO CONFIRMADO' : '⏳ AGUARDANDO PAGAMENTO'}
                      </span>
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
                    {depositReceipt.edpay_id && (
                      <div className="flex justify-between text-sm py-1">
                        <span style={{ color: '#888' }}>ID EdPay</span>
                        <span className="font-mono text-xs font-semibold" style={{ color: rFont }}>{depositReceipt.edpay_id}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm py-1">
                      <span style={{ color: '#888' }}>Data/Hora</span>
                      <span className="font-semibold" style={{ color: rFont }}>{new Date(depositReceipt.created_at).toLocaleString('pt-BR')}</span>
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
                    <p className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: '#999' }}>Recebido por</p>
                    <p className="text-sm font-bold" style={{ color: rFont }}>{rOperator}</p>
                    <p className="text-xs" style={{ color: '#888' }}>Plataforma EdPay · https://api.edpay.me/</p>
                  </div>
                  <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
                    <p className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: '#999' }}>Pagador</p>
                    <p className="text-sm font-bold" style={{ color: rFont }}>{meta.userName || 'Anônimo'}</p>
                    <div className="flex items-center gap-3 text-xs" style={{ color: '#888' }}>
                      {meta.userAccountId && <span>ID: {meta.userAccountId}</span>}
                      {meta.userPhone && <span>📱 {meta.userPhone}</span>}
                    </div>
                  </div>
                  <div className="rounded-xl text-center py-4 px-4" style={{ border: `2px solid ${rAccent}` }}>
                    <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: rAccent }}>Valor Recebido</p>
                    <p className="text-3xl font-extrabold mt-1" style={{ color: rAccent }}>R$ {Number(depositReceipt.amount).toFixed(2).replace('.', ',')}</p>
                    <p className="text-[10px] mt-1" style={{ color: '#888' }}>via PIX instantâneo</p>
                  </div>
                  <div className="text-center pt-3 space-y-0.5" style={{ borderTop: '1px solid #e5e7eb' }}>
                    <p className="text-[10px]" style={{ color: '#999' }}>Documento gerado em {new Date().toLocaleString('pt-BR')}</p>
                    <p className="text-[10px]" style={{ color: '#999' }}>Este comprovante é válido como prova de recebimento.</p>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Email template editor */}
      <Dialog open={showTemplateEditor} onOpenChange={setShowTemplateEditor}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? `Editar: ${editingTemplate.name}` : 'Novo template de email'}</DialogTitle>
          </DialogHeader>
          {session?.user?.id && (
            <EmailTemplateEditor
              ownerId={session.user.id}
              initial={editingTemplate}
              onClose={() => setShowTemplateEditor(false)}
              onSaved={refreshCustomTemplates}
            />
          )}
        </DialogContent>
      </Dialog>

      {ConfirmDialog}
    </div>
  );
};

export default Dashboard;
