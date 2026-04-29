import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Mail, Upload, Send, FileText, Eye, Loader2, Search, CheckSquare, Square, Image as ImageIcon, FileCode, Wrench, Clock, Calendar as CalendarIcon, Trash2, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { uploadAppAsset } from '@/lib/uploadAppAsset';
import BulkSendProgress from '@/components/casino/BulkSendProgress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type Recipient = { email: string; name?: string };
type Source = 'csv' | 'contacts' | 'wheel_users';

const GlassCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl ${className}`}>{children}</div>
);

const STORAGE_KEY = 'brevo_bulk_panel_settings_v1';

type StoredSettings = {
  senderEmail?: string;
  senderName?: string;
  replyTo?: string;
  subject?: string;
};

function loadStored(ownerId: string | null): StoredSettings {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${ownerId ?? 'anon'}`);
    return raw ? (JSON.parse(raw) as StoredSettings) : {};
  } catch {
    return {};
  }
}

export default function BrevoBulkEmailPanel({ ownerId }: { ownerId: string | null }) {
  const initial = useMemo(() => loadStored(ownerId), [ownerId]);
  const [senderEmail, setSenderEmail] = useState(initial.senderEmail ?? '');
  const [senderName, setSenderName] = useState(initial.senderName ?? '');
  const [replyTo, setReplyTo] = useState(initial.replyTo ?? '');
  const [subject, setSubject] = useState(initial.subject ?? '');

  // Reload when owner changes
  useEffect(() => {
    const s = loadStored(ownerId);
    setSenderEmail(s.senderEmail ?? '');
    setSenderName(s.senderName ?? '');
    setReplyTo(s.replyTo ?? '');
    setSubject(s.subject ?? '');
  }, [ownerId]);

  // Persist on change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        `${STORAGE_KEY}:${ownerId ?? 'anon'}`,
        JSON.stringify({ senderEmail, senderName, replyTo, subject })
      );
    } catch {
      // ignore quota errors
    }
  }, [ownerId, senderEmail, senderName, replyTo, subject]);
  const [contentMode, setContentMode] = useState<'html' | 'text'>('html');
  const [htmlContent, setHtmlContent] = useState('<p>Olá {{NOME}},</p>\n<p>Sua mensagem aqui.</p>');
  const [textContent, setTextContent] = useState('Olá {{NOME}},\n\nSua mensagem aqui.');
  const [source, setSource] = useState<Source>('csv');
  const [csvText, setCsvText] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [lastResult, setLastResult] = useState<{ total: number; sent: number; failed: number } | null>(null);
  const [availableContacts, setAvailableContacts] = useState<Recipient[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [uploadingImage, setUploadingImage] = useState(false);
  const [fixingImages, setFixingImages] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingRecipients, setPendingRecipients] = useState<Recipient[]>([]);
  const htmlTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // ─── Agendamento ───
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleRecurrence, setScheduleRecurrence] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [scheduling, setScheduling] = useState(false);
  const [scheduledList, setScheduledList] = useState<any[]>([]);
  const [scheduledLoading, setScheduledLoading] = useState(false);

  const loadScheduled = useCallback(async () => {
    if (!ownerId) { setScheduledList([]); return; }
    setScheduledLoading(true);
    try {
      const { data, error } = await supabase
        .from('scheduled_brevo_emails')
        .select('*')
        .eq('owner_id', ownerId)
        .order('next_run_at', { ascending: true })
        .limit(50);
      if (error) throw error;
      setScheduledList(data ?? []);
    } catch (e: any) {
      toast.error(`Falha ao carregar agendamentos: ${e?.message || 'erro'}`);
    } finally {
      setScheduledLoading(false);
    }
  }, [ownerId]);

  useEffect(() => { loadScheduled(); }, [loadScheduled]);

  const replaceOrInsertHtmlImage = (publicUrl: string) => {
    const imgSrcRegex = /(<img\b[^>]*\bsrc\s*=\s*)(["'])([^"']*)(\2)([^>]*>)/i;
    const tag = `<img src="${publicUrl}" alt="" style="max-width:100%;height:auto;display:block;" />`;

    if (imgSrcRegex.test(htmlContent)) {
      setHtmlContent((prev) => prev.replace(imgSrcRegex, `$1$2${publicUrl}$4$5`));
      return 'replaced';
    }

    const ta = htmlTextareaRef.current;
    if (ta && contentMode === 'html') {
      const start = ta.selectionStart ?? htmlContent.length;
      const end = ta.selectionEnd ?? htmlContent.length;
      const next = htmlContent.slice(0, start) + tag + htmlContent.slice(end);
      setHtmlContent(next);
      requestAnimationFrame(() => {
        ta.focus();
        const pos = start + tag.length;
        ta.setSelectionRange(pos, pos);
      });
    } else {
      setHtmlContent((prev) => prev + '\n' + tag);
      setContentMode('html');
    }
    return 'inserted';
  };

  const handleHtmlFileUpload = (file: File) => {
    if (!/\.html?$/i.test(file.name) && file.type !== 'text/html') {
      toast.error('Selecione um arquivo .html');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = (e.target?.result as string) || '';
      setHtmlContent(content);
      setContentMode('html');
      toast.success('HTML carregado com sucesso');
    };
    reader.onerror = () => toast.error('Erro ao ler o arquivo HTML');
    reader.readAsText(file);
  };

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem.');
      return;
    }
    setUploadingImage(true);
    try {
      const { publicUrl } = await uploadAppAsset(file, 'brevo-emails');
      const action = replaceOrInsertHtmlImage(publicUrl);
      toast.success(action === 'replaced' ? 'Imagem quebrada substituída no HTML' : 'Imagem enviada e inserida no HTML');
    } catch (e: any) {
      toast.error(`Falha ao enviar imagem: ${e?.message || 'erro desconhecido'}`);
    } finally {
      setUploadingImage(false);
    }
  };

  // Detecta <img> com src que não vai funcionar em email (data:, blob:, relativo, ou URL externa
  // que pode bloquear hotlink) e re-envia para o nosso storage público.
  const fixHtmlImages = async () => {
    if (!htmlContent.trim()) {
      toast.error('Sem HTML para corrigir.');
      return;
    }
    setFixingImages(true);
    try {
      const imgRegex = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
      const matches = Array.from(htmlContent.matchAll(imgRegex));
      if (matches.length === 0) {
        toast.info('Nenhuma tag <img> encontrada no HTML.');
        return;
      }

      const ourHost = (() => {
        try {
          return new URL(import.meta.env.VITE_SUPABASE_URL).host;
        } catch {
          return '';
        }
      })();

      const replacements = new Map<string, string>();
      let fixed = 0;
      let failed = 0;
      let skipped = 0;

      for (const m of matches) {
        const src = m[1];
        if (replacements.has(src)) continue;

        // Já está no nosso storage público — pular
        if (ourHost && src.includes(ourHost) && src.includes('/storage/v1/object/public/')) {
          skipped++;
          continue;
        }

        try {
          let blob: Blob;
          let filename = 'image';

          if (src.startsWith('data:')) {
            const res = await fetch(src);
            blob = await res.blob();
            const ext = (blob.type.split('/')[1] || 'png').split(';')[0];
            filename = `inline-${Date.now()}.${ext}`;
          } else if (src.startsWith('blob:') || src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//')) {
            const url = src.startsWith('//') ? `https:${src}` : src;
            const res = await fetch(url, { mode: 'cors' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            blob = await res.blob();
            const urlPath = (() => {
              try { return new URL(url).pathname.split('/').pop() || ''; } catch { return ''; }
            })();
            const ext = urlPath.split('.').pop() || (blob.type.split('/')[1] || 'png').split(';')[0];
            filename = urlPath || `remote-${Date.now()}.${ext}`;
          } else {
            // Caminho relativo — não temos como resolver de forma confiável no email
            failed++;
            continue;
          }

          const file = new File([blob], filename, { type: blob.type || 'image/png' });
          const { publicUrl } = await uploadAppAsset(file, 'brevo-emails');
          replacements.set(src, publicUrl);
          fixed++;
        } catch (e) {
          failed++;
        }
      }

      if (replacements.size > 0) {
        let next = htmlContent;
        for (const [oldSrc, newSrc] of replacements) {
          // Substitui todas as ocorrências do src antigo
          next = next.split(oldSrc).join(newSrc);
        }
        setHtmlContent(next);
      }

      if (fixed > 0) {
        toast.success(`${fixed} imagem(ns) corrigida(s)${failed ? ` • ${failed} falharam` : ''}${skipped ? ` • ${skipped} já ok` : ''}`);
      } else if (failed > 0) {
        toast.error(`Não foi possível corrigir ${failed} imagem(ns). Verifique se o site de origem permite acesso.`);
      } else {
        toast.success('Todas as imagens já estão hospedadas corretamente.');
      }
    } finally {
      setFixingImages(false);
    }
  };

  const csvRecipients = useMemo<Recipient[]>(() => {
    if (!csvText.trim()) return [];
    const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const out: Recipient[] = [];
    for (const line of lines) {
      // Accept "email", "email,name" or "name,email"
      const parts = line.split(/[,;\t]/).map((p) => p.trim()).filter(Boolean);
      if (parts.length === 0) continue;
      const emailPart = parts.find((p) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p));
      if (!emailPart) continue;
      const namePart = parts.find((p) => p !== emailPart);
      out.push({ email: emailPart, name: namePart });
    }
    return out;
  }, [csvText]);

  const handleCsvUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setCsvText((e.target?.result as string) || '');
    reader.readAsText(file);
  };

  // Load contacts when source changes (for non-csv)
  useEffect(() => {
    if (source === 'csv' || !ownerId) {
      setAvailableContacts([]);
      setSelectedEmails(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      setContactsLoading(true);
      try {
        let recipients: Recipient[] = [];
        if (source === 'wheel_users') {
          const { data } = await supabase
            .from('wheel_users')
            .select('email, name')
            .eq('owner_id', ownerId)
            .eq('archived', false)
            .order('created_at', { ascending: false })
            .limit(5000);
          recipients = (data ?? [])
            .filter((r: any) => r.email)
            .map((r: any) => ({ email: r.email, name: r.name }));
        } else if (source === 'contacts') {
          const { data } = await supabase
            .from('imported_contacts')
            .select('numero, lead')
            .eq('owner_id', ownerId)
            .limit(5000);
          recipients = (data ?? [])
            .filter((r: any) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.numero || ''))
            .map((r: any) => ({ email: r.numero, name: r.lead }));
        }
        // Dedup by email
        const seen = new Set<string>();
        const unique = recipients.filter((r) => {
          const k = r.email.toLowerCase();
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        if (!cancelled) {
          setAvailableContacts(unique);
          setSelectedEmails(new Set(unique.map((r) => r.email.toLowerCase())));
        }
      } catch (e) {
        if (!cancelled) toast.error('Erro ao carregar contatos.');
      } finally {
        if (!cancelled) setContactsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source, ownerId]);

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return availableContacts;
    return availableContacts.filter(
      (r) => r.email.toLowerCase().includes(q) || (r.name || '').toLowerCase().includes(q)
    );
  }, [availableContacts, search]);

  const toggleEmail = (email: string) => {
    const k = email.toLowerCase();
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    const filteredKeys = filteredContacts.map((r) => r.email.toLowerCase());
    const allSelected = filteredKeys.every((k) => selectedEmails.has(k));
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (allSelected) filteredKeys.forEach((k) => next.delete(k));
      else filteredKeys.forEach((k) => next.add(k));
      return next;
    });
  };

  const fetchRecipients = async (): Promise<Recipient[]> => {
    if (source === 'csv') return csvRecipients;
    return availableContacts.filter((r) => selectedEmails.has(r.email.toLowerCase()));
  };

  const handleSend = async () => {
    const body = contentMode === 'html' ? htmlContent : textContent;
    if (!senderEmail.trim() || !subject.trim() || !body.trim()) {
      toast.error('Preencha remetente, assunto e conteúdo.');
      return;
    }
    const recipients = await fetchRecipients();
    if (recipients.length === 0) {
      toast.error('Nenhum destinatário válido encontrado.');
      return;
    }
    setPendingRecipients(recipients);
    setConfirmOpen(true);
  };

  const performSend = async (recipients: Recipient[]) => {
    setLoading(true);
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('send-bulk-brevo', {
        body: {
          senderEmail: senderEmail.trim(),
          senderName: senderName.trim() || senderEmail.trim(),
          replyTo: replyTo.trim() || undefined,
          subject: subject.trim(),
          ...(contentMode === 'html' ? { htmlContent } : { textContent }),
          recipients,
        },
      });
      if (error) throw error;
      setLastResult(data);
      const skipped = data?.suppressed_skipped ?? 0;
      const invalid = data?.invalid ?? 0;
      const extra = [
        skipped > 0 ? `${skipped} pulado(s) na supressão` : null,
        invalid > 0 ? `${invalid} formato inválido` : null,
      ].filter(Boolean).join(' • ');
      if (data?.failed > 0) {
        toast.warning(`Enviados: ${data.sent} • Falhas: ${data.failed}${extra ? ' • ' + extra : ''}`);
      } else {
        toast.success(`✓ ${data?.sent ?? 0} email(s) enviados${extra ? ' • ' + extra : ''}`);
      }
    } catch (e: any) {
      toast.error(`Erro: ${e?.message || 'falha desconhecida'}`);
    } finally {
      setLoading(false);
    }
  };

  const openSchedule = () => {
    const body = contentMode === 'html' ? htmlContent : textContent;
    if (!senderEmail.trim() || !subject.trim() || !body.trim()) {
      toast.error('Preencha remetente, assunto e conteúdo antes de agendar.');
      return;
    }
    if (source === 'csv' && csvRecipients.length === 0) {
      toast.error('Adicione destinatários no CSV.');
      return;
    }
    if (source !== 'csv' && selectedEmails.size === 0) {
      toast.error('Selecione ao menos um destinatário.');
      return;
    }
    // default: now + 1h
    const d = new Date(Date.now() + 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    setScheduleDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    setScheduleTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
    setScheduleRecurrence('none');
    setScheduleOpen(true);
  };

  const submitSchedule = async () => {
    if (!ownerId) { toast.error('Sem usuário autenticado.'); return; }
    if (!scheduleDate || !scheduleTime) { toast.error('Informe data e hora.'); return; }
    const when = new Date(`${scheduleDate}T${scheduleTime}`);
    if (Number.isNaN(when.getTime())) { toast.error('Data/hora inválida.'); return; }
    if (when.getTime() < Date.now() - 60_000 && scheduleRecurrence === 'none') {
      toast.error('A data/hora deve estar no futuro.');
      return;
    }

    setScheduling(true);
    try {
      const payload: any = {
        owner_id: ownerId,
        sender_email: senderEmail.trim(),
        sender_name: senderName.trim() || senderEmail.trim(),
        reply_to: replyTo.trim() || null,
        subject: subject.trim(),
        html_content: contentMode === 'html' ? htmlContent : null,
        text_content: contentMode === 'text' ? textContent : null,
        source,
        csv_recipients: source === 'csv' ? csvRecipients : [],
        selected_emails: source !== 'csv' ? Array.from(selectedEmails) : [],
        scheduled_at: when.toISOString(),
        recurrence: scheduleRecurrence,
      };
      const { error } = await supabase.from('scheduled_brevo_emails').insert(payload);
      if (error) throw error;
      toast.success('Agendamento criado com sucesso.');
      setScheduleOpen(false);
      loadScheduled();
    } catch (e: any) {
      toast.error(`Erro ao agendar: ${e?.message || 'falha desconhecida'}`);
    } finally {
      setScheduling(false);
    }
  };

  const deleteScheduled = async (id: string) => {
    try {
      const { error } = await supabase.from('scheduled_brevo_emails').delete().eq('id', id);
      if (error) throw error;
      toast.success('Agendamento removido.');
      loadScheduled();
    } catch (e: any) {
      toast.error(`Erro ao remover: ${e?.message || 'falha desconhecida'}`);
    }
  };

  const previewContent = useMemo(() => {
    const sample = csvRecipients[0] || { email: 'exemplo@email.com', name: 'Exemplo' };
    const raw = contentMode === 'html' ? htmlContent : textContent;
    return raw
      .split('{{NOME}}').join(sample.name || 'Cliente')
      .split('{{EMAIL}}').join(sample.email);
  }, [htmlContent, textContent, contentMode, csvRecipients]);

  return (
    <div className="max-w-3xl space-y-5">
      <GlassCard className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Mail size={18} className="text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Disparo em massa via Brevo API</h3>
            <p className="text-xs text-muted-foreground">Para campanhas e newsletters de alto volume.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Email do remetente *</label>
            <input
              type="email"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              placeholder="noreply@seudominio.com"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Domínio precisa estar verificado no Brevo.</p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Nome do remetente</label>
            <input
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="Sua Marca"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Reply-To (opcional)</label>
          <input
            type="email"
            value={replyTo}
            onChange={(e) => setReplyTo(e.target.value)}
            placeholder="contato@seudominio.com"
            className="w-full mt-1 px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Assunto *</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Assunto do email"
            className="w-full mt-1 px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-muted-foreground">Conteúdo *</label>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-white/[0.08] bg-white/[0.04] p-0.5">
                <button
                  type="button"
                  onClick={() => setContentMode('html')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                    contentMode === 'html' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  HTML
                </button>
                <button
                  type="button"
                  onClick={() => setContentMode('text')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                    contentMode === 'text' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Texto simples
                </button>
              </div>
              <label className="text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer">
                <FileCode size={12} /> Subir HTML
                <input
                  type="file"
                  accept=".html,.htm,text/html"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleHtmlFileUpload(f);
                    e.target.value = '';
                  }}
                />
              </label>
              <label className={`text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer ${uploadingImage ? 'opacity-50 pointer-events-none' : ''}`}>
                {uploadingImage ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />}
                {uploadingImage ? 'Enviando...' : 'Inserir imagem'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImageUpload(f);
                    e.target.value = '';
                  }}
                />
              </label>
              <button
                type="button"
                onClick={fixHtmlImages}
                disabled={fixingImages}
                title="Re-hospeda imagens com src inválido (data:, blob:, externas) no nosso storage para que cheguem ao destinatário"
                className="text-[11px] text-amber-300 hover:underline flex items-center gap-1 disabled:opacity-50"
              >
                {fixingImages ? <Loader2 size={12} className="animate-spin" /> : <Wrench size={12} />}
                {fixingImages ? 'Corrigindo...' : 'Corrigir imagens'}
              </button>
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="text-[11px] text-primary hover:underline flex items-center gap-1"
              >
                <Eye size={12} /> {showPreview ? 'Ocultar' : 'Pré-visualizar'}
              </button>
            </div>
          </div>
          {contentMode === 'html' ? (
            <textarea
              ref={htmlTextareaRef}
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              rows={8}
              className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          ) : (
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              rows={8}
              placeholder="Digite sua mensagem em texto simples..."
              className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          )}
          <p className="text-[10px] text-muted-foreground mt-1">
            Variáveis: <code className="text-primary">{'{{NOME}}'}</code> e <code className="text-primary">{'{{EMAIL}}'}</code>
            {contentMode === 'text' && ' • Quebras de linha são preservadas.'}
          </p>
        </div>

        {showPreview && (
          <div className="border border-white/[0.08] rounded-lg overflow-hidden bg-white">
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Preview do email</div>
              <div className="text-[10px] text-gray-400">
                {contentMode === 'html' ? 'renderização real' : 'texto simples'}
              </div>
            </div>
            {contentMode === 'html' ? (
              <iframe
                title="Preview do email"
                srcDoc={previewContent}
                sandbox=""
                className="w-full bg-white"
                style={{ height: 480, border: 0 }}
              />
            ) : (
              <pre className="text-black text-sm whitespace-pre-wrap font-sans p-4">{previewContent}</pre>
            )}
          </div>
        )}
      </GlassCard>

      <GlassCard className="p-5 space-y-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Upload size={16} className="text-primary" /> Destinatários
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {(['csv', 'contacts', 'wheel_users'] as Source[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSource(s)}
              className={`px-3 py-2 rounded-lg border text-xs font-medium transition ${
                source === s
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:text-foreground'
              }`}
            >
              {s === 'csv' ? 'CSV / Colar lista' : s === 'contacts' ? 'Contatos importados' : 'Inscritos da roleta'}
            </button>
          ))}
        </div>

        {source === 'csv' && (
          <>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-xs cursor-pointer hover:bg-white/[0.08]">
                <FileText size={13} /> Subir CSV
                <input
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleCsvUpload(e.target.files[0])}
                />
              </label>
              <span className="text-[11px] text-muted-foreground">
                Formato: <code>email,nome</code> (uma linha por contato)
              </span>
            </div>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={6}
              placeholder={'joao@email.com,João\nmaria@email.com,Maria'}
              className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <p className="text-[11px] text-muted-foreground">
              {csvRecipients.length} destinatário(s) válido(s) detectado(s).
            </p>
          </>
        )}

        {source !== 'csv' && (
          <div className="space-y-2">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar por email ou nome..."
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            {contactsLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-xs">
                <Loader2 size={14} className="animate-spin mr-2" /> Carregando contatos...
              </div>
            ) : availableContacts.length === 0 ? (
              <p className="text-[11px] text-muted-foreground py-4 text-center">
                Nenhum contato com email válido encontrado.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <button
                    type="button"
                    onClick={toggleSelectAllFiltered}
                    className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/[0.05] text-foreground"
                  >
                    {filteredContacts.every((r) => selectedEmails.has(r.email.toLowerCase())) && filteredContacts.length > 0 ? (
                      <CheckSquare size={13} className="text-primary" />
                    ) : (
                      <Square size={13} />
                    )}
                    {filteredContacts.every((r) => selectedEmails.has(r.email.toLowerCase())) && filteredContacts.length > 0
                      ? 'Desmarcar todos'
                      : 'Selecionar todos'}
                  </button>
                  <span>
                    <span className="text-primary font-semibold">{selectedEmails.size}</span> de {availableContacts.length} selecionado(s)
                  </span>
                </div>

                <div className="max-h-72 overflow-y-auto rounded-lg border border-white/[0.08] bg-white/[0.02] divide-y divide-white/[0.05]">
                  {filteredContacts.slice(0, 500).map((r) => {
                    const k = r.email.toLowerCase();
                    const checked = selectedEmails.has(k);
                    return (
                      <label
                        key={k}
                        className="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-white/[0.04]"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleEmail(r.email)}
                          className="accent-primary"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-foreground">{r.name || '—'}</div>
                          <div className="truncate text-[10px] text-muted-foreground">{r.email}</div>
                        </div>
                      </label>
                    );
                  })}
                  {filteredContacts.length > 500 && (
                    <div className="px-3 py-2 text-[10px] text-muted-foreground text-center">
                      Mostrando primeiros 500 de {filteredContacts.length} resultados. Refine a busca.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </GlassCard>

      {loading && (
        <BulkSendProgress
          total={pendingRecipients.length || lastResult?.total || 1}
          sent={0}
          errors={0}
          label="Disparando via Brevo (lote único)"
          indeterminate
          accent="blue"
        />
      )}

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <button
          onClick={handleSend}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {loading ? 'Enviando...' : 'Disparar via Brevo'}
        </button>
        <button
          onClick={openSchedule}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-white/[0.12] bg-white/[0.04] text-foreground font-semibold text-sm hover:bg-white/[0.08] transition disabled:opacity-50"
        >
          <Clock size={16} /> Agendar
        </button>
      </div>

      <GlassCard className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <CalendarIcon size={16} className="text-primary" /> Agendamentos
          </h3>
          <button
            type="button"
            onClick={loadScheduled}
            className="text-[11px] text-primary hover:underline flex items-center gap-1"
          >
            <RefreshCw size={12} /> Atualizar
          </button>
        </div>
        {scheduledLoading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground text-xs">
            <Loader2 size={14} className="animate-spin mr-2" /> Carregando...
          </div>
        ) : scheduledList.length === 0 ? (
          <p className="text-[11px] text-muted-foreground py-4 text-center">
            Nenhum disparo agendado.
          </p>
        ) : (
          <div className="divide-y divide-white/[0.05] rounded-lg border border-white/[0.08] bg-white/[0.02]">
            {scheduledList.map((s) => {
              const when = s.next_run_at ? new Date(s.next_run_at) : new Date(s.scheduled_at);
              const recLabel = s.recurrence === 'none' ? 'Único' :
                s.recurrence === 'daily' ? 'Diário' :
                s.recurrence === 'weekly' ? 'Semanal' :
                s.recurrence === 'monthly' ? 'Mensal' : s.recurrence;
              const statusColor =
                s.status === 'sent' ? 'text-emerald-400' :
                s.status === 'failed' ? 'text-rose-400' :
                s.status === 'processing' ? 'text-amber-300' : 'text-primary';
              return (
                <div key={s.id} className="flex items-start gap-3 px-3 py-2.5 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-foreground font-medium">{s.subject}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {when.toLocaleString('pt-BR')} • {recLabel} •{' '}
                      <span className={statusColor}>{s.status}</span>
                      {s.last_result?.sent != null && (
                        <> • <span className="text-emerald-400">{s.last_result.sent} enviados</span></>
                      )}
                      {s.last_result?.failed > 0 && (
                        <> • <span className="text-rose-400">{s.last_result.failed} falhas</span></>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteScheduled(s.id)}
                    className="p-1.5 rounded-md text-rose-300 hover:bg-rose-500/10 transition"
                    title="Remover agendamento"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      {lastResult && (
        <GlassCard className="p-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-2xl font-bold text-foreground">{lastResult.total}</div>
              <div className="text-[10px] text-muted-foreground uppercase">Total</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-400">{lastResult.sent}</div>
              <div className="text-[10px] text-muted-foreground uppercase">Enviados</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-rose-400">{lastResult.failed}</div>
              <div className="text-[10px] text-muted-foreground uppercase">Falhas</div>
            </div>
          </div>
        </GlassCard>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="border-white/[0.08] bg-background/95 backdrop-blur-xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Send size={18} className="text-primary" />
              </div>
              <div>
                <AlertDialogTitle className="text-foreground">Confirmar disparo</AlertDialogTitle>
                <AlertDialogDescription className="text-muted-foreground">
                  Revise antes de enviar. Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          <div className="mt-2 space-y-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Destinatários</span>
              <span className="font-semibold text-primary">{pendingRecipients.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Remetente</span>
              <span className="font-medium text-foreground truncate ml-3 max-w-[60%] text-right">
                {senderName.trim() || senderEmail.trim()} &lt;{senderEmail.trim()}&gt;
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Assunto</span>
              <span className="font-medium text-foreground truncate ml-3 max-w-[60%] text-right">
                {subject.trim() || '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Provedor</span>
              <span className="font-medium text-foreground">Brevo</span>
            </div>
          </div>

          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel className="border-white/[0.08] bg-white/[0.04] text-foreground hover:bg-white/[0.08]">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => performSend(pendingRecipients)}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Send size={14} className="mr-1.5" />
              Enviar agora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="border-white/[0.08] bg-background/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Clock size={18} className="text-primary" /> Agendar disparo Brevo
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              O envio será disparado automaticamente na data/hora escolhida usando os destinatários selecionados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Data *</label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Hora *</label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Recorrência</label>
              <select
                value={scheduleRecurrence}
                onChange={(e) => setScheduleRecurrence(e.target.value as any)}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="none">Único (não repete)</option>
                <option value="daily">Diário</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensal</option>
              </select>
            </div>

            <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 text-[11px] text-muted-foreground space-y-1">
              <div>Assunto: <span className="text-foreground">{subject || '—'}</span></div>
              <div>
                Destinatários:{' '}
                <span className="text-primary font-semibold">
                  {source === 'csv' ? csvRecipients.length : selectedEmails.size}
                </span>{' '}
                <span className="text-muted-foreground">
                  ({source === 'csv' ? 'CSV' : source === 'wheel_users' ? 'Inscritos da roleta' : 'Contatos importados'})
                </span>
              </div>
              {source !== 'csv' && (
                <div className="text-amber-300/80">
                  Para fontes dinâmicas, os destinatários serão recalculados no momento do envio (apenas os que ainda estiverem selecionados/válidos).
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="mt-2">
            <button
              type="button"
              onClick={() => setScheduleOpen(false)}
              className="px-4 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-sm text-foreground hover:bg-white/[0.08]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={submitSchedule}
              disabled={scheduling}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
            >
              {scheduling ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />}
              {scheduling ? 'Agendando...' : 'Agendar disparo'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
