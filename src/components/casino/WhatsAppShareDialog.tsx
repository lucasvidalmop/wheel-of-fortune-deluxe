import { useEffect, useState } from 'react';
import { X, MessageCircle, Save, Trash2, FileText, Send, Copy, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  ownerId: string;
  shareUrl: string;
  linkLabel?: string;
  onClose: () => void;
}

interface Template {
  id: string;
  name: string;
  message: string;
}

const DEFAULT_MESSAGE = (label: string, url: string) =>
  `🎁 Olha que legal! Você ganhou um giro grátis na nossa Roleta de Prêmios${label ? ` (${label})` : ''}.\n\n` +
  `🎯 Resgate agora pelo link:\n${url}\n\n` +
  `Boa sorte! 🍀`;

const WhatsAppShareDialog = ({ ownerId, shareUrl, linkLabel = '', onClose }: Props) => {
  const [message, setMessage] = useState(DEFAULT_MESSAGE(linkLabel, shareUrl));
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string>('');
  const [newName, setNewName] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadTemplates = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('whatsapp_share_templates')
      .select('id, name, message')
      .eq('owner_id', ownerId)
      .order('updated_at', { ascending: false });
    if (error) toast.error('Erro ao carregar templates: ' + error.message);
    else setTemplates(data || []);
    setLoading(false);
  };

  useEffect(() => { loadTemplates(); }, [ownerId]);

  const applyTemplate = (id: string) => {
    setSelectedId(id);
    if (!id) return;
    const t = templates.find(x => x.id === id);
    if (!t) return;
    // Replace placeholders with current link data
    const filled = t.message
      .split('{link}').join(shareUrl)
      .split('{url}').join(shareUrl)
      .split('{label}').join(linkLabel);
    setMessage(filled);
  };

  const handleSaveNew = async () => {
    const name = newName.trim();
    if (!name) { toast.error('Informe um nome para o template'); return; }
    if (!message.trim()) { toast.error('Mensagem vazia'); return; }
    setSaving(true);
    // Save raw template (replace current URL with placeholder for reusability)
    const stored = message
      .replaceAll(shareUrl, '{link}')
      .replaceAll(linkLabel, linkLabel ? '{label}' : linkLabel);
    const { error } = await (supabase as any)
      .from('whatsapp_share_templates')
      .insert({ owner_id: ownerId, name, message: stored });
    if (error) toast.error('Erro ao salvar: ' + error.message);
    else {
      toast.success('Template salvo!');
      setNewName('');
      setShowSaveForm(false);
      await loadTemplates();
    }
    setSaving(false);
  };

  const handleUpdateExisting = async () => {
    if (!selectedId) return;
    setSaving(true);
    const stored = message
      .replaceAll(shareUrl, '{link}')
      .replaceAll(linkLabel, linkLabel ? '{label}' : linkLabel);
    const { error } = await (supabase as any)
      .from('whatsapp_share_templates')
      .update({ message: stored, updated_at: new Date().toISOString() })
      .eq('id', selectedId)
      .eq('owner_id', ownerId);
    if (error) toast.error('Erro ao atualizar: ' + error.message);
    else { toast.success('Template atualizado!'); await loadTemplates(); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!confirm('Excluir este template?')) return;
    const { error } = await (supabase as any)
      .from('whatsapp_share_templates')
      .delete()
      .eq('id', selectedId)
      .eq('owner_id', ownerId);
    if (error) toast.error('Erro ao excluir: ' + error.message);
    else { toast.success('Template excluído'); setSelectedId(''); await loadTemplates(); }
  };

  const handleShare = () => {
    if (!message.trim()) { toast.error('Mensagem vazia'); return; }
    const text = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast.success('Mensagem copiada!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[90vh] bg-background border border-white/[0.08] rounded-2xl shadow-2xl overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-xl border-b border-white/[0.06] p-5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <MessageCircle size={16} className="text-emerald-400" />
              Compartilhar no WhatsApp
            </h2>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[300px]">{linkLabel || 'Link de Referência'}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Link preview */}
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Link a compartilhar</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono text-[11px] truncate">
                {shareUrl}
              </code>
            </div>
          </div>

          {/* Templates dropdown */}
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1 flex items-center gap-1.5">
              <FileText size={11} /> Templates salvos
            </label>
            <div className="flex items-center gap-2">
              <select
                value={selectedId}
                onChange={e => applyTemplate(e.target.value)}
                disabled={loading}
                className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-sm focus:outline-none focus:border-primary/50"
              >
                <option value="">{loading ? 'Carregando...' : templates.length === 0 ? '— Nenhum template salvo —' : '— Selecionar template —'}</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {selectedId && (
                <>
                  <button
                    onClick={handleUpdateExisting}
                    disabled={saving}
                    title="Atualizar template selecionado"
                    className="p-2 rounded-lg bg-sky-500/15 text-sky-300 hover:bg-sky-500/25 transition disabled:opacity-50"
                  >
                    <Save size={14} />
                  </button>
                  <button
                    onClick={handleDelete}
                    title="Excluir template"
                    className="p-2 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Message editor */}
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Mensagem</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={8}
              placeholder="Digite a mensagem que será compartilhada..."
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-sm focus:outline-none focus:border-primary/50 font-mono leading-relaxed resize-none"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Dica: ao salvar, o link e o nome serão substituídos por <code className="text-primary">{'{link}'}</code> e <code className="text-primary">{'{label}'}</code> para reuso.
            </p>
          </div>

          {/* Save new template */}
          {!showSaveForm ? (
            <button
              onClick={() => setShowSaveForm(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-muted-foreground hover:text-foreground hover:bg-white/[0.08] transition text-xs font-semibold"
            >
              <Save size={14} /> Salvar como novo template
            </button>
          ) : (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
              <label className="text-[10px] text-muted-foreground">Nome do novo template</label>
              <div className="flex items-center gap-2">
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Ex: Convite padrão"
                  autoFocus
                  className="flex-1 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-foreground text-sm focus:outline-none focus:border-primary/50"
                />
                <button
                  onClick={handleSaveNew}
                  disabled={saving || !newName.trim()}
                  className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50 hover:brightness-110 transition flex items-center gap-1.5"
                >
                  <Save size={14} /> {saving ? 'Salvando' : 'Salvar'}
                </button>
                <button
                  onClick={() => { setShowSaveForm(false); setNewName(''); }}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.08] transition"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-foreground text-xs font-bold hover:bg-white/[0.08] transition"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copiado' : 'Copiar mensagem'}
            </button>
            <button
              onClick={handleShare}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:brightness-110 transition shadow-lg shadow-emerald-500/20"
            >
              <Send size={14} /> Abrir WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppShareDialog;
