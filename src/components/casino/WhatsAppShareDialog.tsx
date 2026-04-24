import { useEffect, useMemo, useState } from 'react';
import { X, MessageCircle, Save, Trash2, FileText, Send, Copy, Check, Users, Search, ChevronDown, ChevronUp } from 'lucide-react';
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

interface Contact {
  id: string;
  lead: string;
  numero: string;
  group_name: string;
  source: 'csv' | 'subscriber';
}

const DEFAULT_MESSAGE = (label: string, url: string) =>
  `🎁 Olha que legal! Você ganhou um giro grátis na nossa Roleta de Prêmios${label ? ` (${label})` : ''}.\n\n` +
  `🎯 Resgate agora pelo link:\n${url}\n\n` +
  `Boa sorte! 🍀`;

const normalizePhone = (raw: string): string => {
  const digits = (raw || '').replace(/\D+/g, '');
  if (!digits) return '';
  if (digits.startsWith('55')) return digits;
  if (digits.length >= 10 && digits.length <= 11) return `55${digits}`;
  return digits;
};

const mergeContacts = (items: Contact[]) => {
  const map = new Map<string, Contact>();

  items.forEach((item) => {
    const phone = normalizePhone(item.numero);
    if (!phone) return;

    const normalizedItem = { ...item, numero: phone };
    const existing = map.get(phone);

    if (!existing) {
      map.set(phone, normalizedItem);
      return;
    }

    if (existing.source === 'csv' && normalizedItem.source === 'subscriber') {
      map.set(phone, {
        ...normalizedItem,
        lead: normalizedItem.lead || existing.lead,
      });
      return;
    }

    if (!existing.lead && normalizedItem.lead) {
      map.set(phone, {
        ...existing,
        lead: normalizedItem.lead,
      });
    }
  });

  return Array.from(map.values());
};

const WhatsAppShareDialog = ({ ownerId, shareUrl, linkLabel = '', onClose }: Props) => {
  const [message, setMessage] = useState(DEFAULT_MESSAGE(linkLabel, shareUrl));
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string>('');
  const [newName, setNewName] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsExpanded, setContactsExpanded] = useState(false);
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const [groupFilter, setGroupFilter] = useState<string>('__all__');
  const [search, setSearch] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());

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

  const readImportedContacts = async () => {
    const all: Contact[] = [];
    const PAGE = 1000;
    let from = 0;

    while (true) {
      const { data, error } = await (supabase as any)
        .from('imported_contacts')
        .select('id, lead, numero, group_name')
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: true })
        .range(from, from + PAGE - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      all.push(
        ...data.map((item: any) => ({
          id: `csv:${item.id}`,
          lead: item.lead || '',
          numero: item.numero || '',
          group_name: item.group_name || 'CSV',
          source: 'csv' as const,
        })),
      );

      if (data.length < PAGE) break;
      from += PAGE;
    }

    return all;
  };

  const readWheelUsers = async () => {
    const all: Contact[] = [];
    const PAGE = 1000;
    let from = 0;

    while (true) {
      const { data, error } = await (supabase as any)
        .from('wheel_users')
        .select('id, name, phone')
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false })
        .range(from, from + PAGE - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      all.push(
        ...data
          .filter((item: any) => normalizePhone(item.phone || '').length >= 12)
          .map((item: any) => ({
            id: `subscriber:${item.id}`,
            lead: item.name || '',
            numero: item.phone || '',
            group_name: 'Inscritos',
            source: 'subscriber' as const,
          })),
      );

      if (data.length < PAGE) break;
      from += PAGE;
    }

    return all;
  };

  const loadContacts = async () => {
    setContactsLoading(true);

    try {
      const [importedContacts, wheelUsers] = await Promise.all([
        readImportedContacts(),
        readWheelUsers(),
      ]);

      setContacts(mergeContacts([...wheelUsers, ...importedContacts]));
      setContactsLoaded(true);
    } catch (error: any) {
      toast.error('Erro ao carregar contatos: ' + (error?.message || 'desconhecido'));
    } finally {
      setContactsLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, [ownerId]);

  useEffect(() => {
    if (contactsExpanded && !contactsLoaded && !contactsLoading) {
      loadContacts();
    }
  }, [contactsExpanded, contactsLoaded, contactsLoading]);

  const groups = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach((contact) => set.add(contact.group_name || 'Sem grupo'));
    return Array.from(set).sort((a, b) => {
      if (a === 'Inscritos') return -1;
      if (b === 'Inscritos') return 1;
      return a.localeCompare(b);
    });
  }, [contacts]);

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();

    return contacts.filter((contact) => {
      if (groupFilter !== '__all__' && (contact.group_name || 'Sem grupo') !== groupFilter) return false;
      if (!q) return true;

      return (
        (contact.lead || '').toLowerCase().includes(q) ||
        (contact.numero || '').includes(q)
      );
    });
  }, [contacts, groupFilter, search]);

  const toggleContact = (id: string) => {
    setSelectedContacts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    const allIds = filteredContacts.map((contact) => contact.id);
    const allSelected = allIds.every((id) => selectedContacts.has(id));

    setSelectedContacts((prev) => {
      const next = new Set(prev);
      if (allSelected) allIds.forEach((id) => next.delete(id));
      else allIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const applyTemplate = (id: string) => {
    setSelectedId(id);
    if (!id) return;

    const template = templates.find((item) => item.id === id);
    if (!template) return;

    const filled = template.message
      .split('{link}').join(shareUrl)
      .split('{url}').join(shareUrl)
      .split('{label}').join(linkLabel);

    setMessage(filled);
  };

  const handleSaveNew = async () => {
    const name = newName.trim();
    if (!name) {
      toast.error('Informe um nome para o template');
      return;
    }
    if (!message.trim()) {
      toast.error('Mensagem vazia');
      return;
    }

    setSaving(true);

    const stored = message
      .split(shareUrl).join('{link}')
      .split(linkLabel || '\u0000').join(linkLabel ? '{label}' : (linkLabel || '\u0000'));

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
      .split(shareUrl).join('{link}')
      .split(linkLabel || '\u0000').join(linkLabel ? '{label}' : (linkLabel || '\u0000'));

    const { error } = await (supabase as any)
      .from('whatsapp_share_templates')
      .update({ message: stored, updated_at: new Date().toISOString() })
      .eq('id', selectedId)
      .eq('owner_id', ownerId);

    if (error) toast.error('Erro ao atualizar: ' + error.message);
    else {
      toast.success('Template atualizado!');
      await loadTemplates();
    }

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
    else {
      toast.success('Template excluído');
      setSelectedId('');
      await loadTemplates();
    }
  };

  const handleShare = () => {
    if (!message.trim()) {
      toast.error('Mensagem vazia');
      return;
    }

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

  const sendToSelected = () => {
    if (!message.trim()) {
      toast.error('Mensagem vazia');
      return;
    }

    const targets = contacts.filter((contact) => selectedContacts.has(contact.id));
    if (targets.length === 0) {
      toast.error('Selecione pelo menos um contato');
      return;
    }

    const text = encodeURIComponent(message);
    let opened = 0;
    let blocked = 0;

    targets.forEach((contact, index) => {
      const phone = normalizePhone(contact.numero);
      if (!phone) return;

      setTimeout(() => {
        const popup = window.open(`https://wa.me/${phone}?text=${text}`, '_blank', 'noopener,noreferrer');
        if (!popup) blocked++;
        else opened++;

        if (index === targets.length - 1) {
          if (blocked > 0) toast.warning(`${opened} aberto(s), ${blocked} bloqueado(s) pelo navegador. Permita pop-ups.`);
          else toast.success(`Abrindo WhatsApp para ${opened} contato(s)`);
        }
      }, index * 350);
    });
  };

  const sendToOne = (contact: Contact) => {
    if (!message.trim()) {
      toast.error('Mensagem vazia');
      return;
    }

    const phone = normalizePhone(contact.numero);
    if (!phone) {
      toast.error('Número inválido');
      return;
    }

    const text = encodeURIComponent(message);
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  const allFilteredSelected = filteredContacts.length > 0 && filteredContacts.every((contact) => selectedContacts.has(contact.id));

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg max-h-[90vh] bg-background border border-white/[0.08] rounded-2xl shadow-2xl overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
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
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Link a compartilhar</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono text-[11px] truncate">
                {shareUrl}
              </code>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground block mb-1 flex items-center gap-1.5">
              <FileText size={11} /> Templates salvos
            </label>
            <div className="flex items-center gap-2">
              <select
                value={selectedId}
                onChange={(e) => applyTemplate(e.target.value)}
                disabled={loading}
                className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-sm focus:outline-none focus:border-primary/50"
              >
                <option value="">{loading ? 'Carregando...' : templates.length === 0 ? '— Nenhum template salvo —' : '— Selecionar template —'}</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>{template.name}</option>
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

          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Mensagem</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              placeholder="Digite a mensagem que será compartilhada..."
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-sm focus:outline-none focus:border-primary/50 font-mono leading-relaxed resize-none"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Dica: ao salvar, o link e o nome serão substituídos por <code className="text-primary">{'{link}'}</code> e <code className="text-primary">{'{label}'}</code> para reuso.
            </p>
          </div>

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
                  onChange={(e) => setNewName(e.target.value)}
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
                  onClick={() => {
                    setShowSaveForm(false);
                    setNewName('');
                  }}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.08] transition"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
            <button
              onClick={() => setContactsExpanded((value) => !value)}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/[0.04] transition"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Users size={14} className="text-emerald-400" />
                Enviar para contatos salvos
                {selectedContacts.size > 0 && (
                  <span className="ml-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                    {selectedContacts.size} selecionado{selectedContacts.size > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {contactsExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
            </button>

            {contactsExpanded && (
              <div className="p-3 border-t border-white/[0.06] space-y-2">
                {contactsLoading ? (
                  <div className="text-center text-xs text-muted-foreground py-4">Carregando contatos e inscritos...</div>
                ) : contacts.length === 0 ? (
                  <div className="text-center text-xs text-muted-foreground py-4">
                    Nenhum número encontrado entre contatos importados e inscritos.
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <select
                        value={groupFilter}
                        onChange={(e) => setGroupFilter(e.target.value)}
                        className="px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-xs focus:outline-none focus:border-primary/50 max-w-[40%]"
                      >
                        <option value="__all__">Todos</option>
                        {groups.map((group) => (
                          <option key={group} value={group}>{group}</option>
                        ))}
                      </select>

                      <div className="flex-1 relative">
                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Buscar nome ou número..."
                          className="w-full pl-7 pr-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-xs focus:outline-none focus:border-primary/50"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
                      <button onClick={toggleAllFiltered} className="hover:text-foreground transition font-semibold">
                        {allFilteredSelected ? 'Desmarcar todos' : 'Selecionar todos'} ({filteredContacts.length})
                      </button>

                      {selectedContacts.size > 0 && (
                        <button onClick={() => setSelectedContacts(new Set())} className="hover:text-foreground transition">
                          Limpar seleção
                        </button>
                      )}
                    </div>

                    <div className="max-h-56 overflow-y-auto rounded-lg border border-white/[0.06] divide-y divide-white/[0.04]" style={{ scrollbarWidth: 'thin' }}>
                      {filteredContacts.length === 0 ? (
                        <div className="text-center text-xs text-muted-foreground py-4">Nenhum contato corresponde ao filtro</div>
                      ) : (
                        filteredContacts.slice(0, 500).map((contact) => {
                          const checked = selectedContacts.has(contact.id);
                          return (
                            <div key={contact.id} className={`flex items-center gap-2 px-2.5 py-1.5 hover:bg-white/[0.04] transition ${checked ? 'bg-emerald-500/5' : ''}`}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleContact(contact.id)}
                                className="accent-emerald-500 cursor-pointer"
                              />

                              <button onClick={() => toggleContact(contact.id)} className="flex-1 text-left min-w-0">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="text-xs text-foreground truncate font-medium">{contact.lead || '(sem nome)'}</div>
                                  <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${contact.source === 'subscriber' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                    {contact.source === 'subscriber' ? 'Inscrito' : 'CSV'}
                                  </span>
                                </div>
                                <div className="text-[10px] text-muted-foreground truncate font-mono">{contact.numero} • {contact.group_name || 'Sem grupo'}</div>
                              </button>

                              <button
                                onClick={() => sendToOne(contact)}
                                title="Enviar para este contato"
                                className="p-1.5 rounded-md bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 transition"
                              >
                                <Send size={11} />
                              </button>
                            </div>
                          );
                        })
                      )}

                      {filteredContacts.length > 500 && (
                        <div className="text-center text-[10px] text-muted-foreground py-2">
                          Mostrando 500 de {filteredContacts.length}. Refine a busca para ver mais.
                        </div>
                      )}
                    </div>

                    <button
                      onClick={sendToSelected}
                      disabled={selectedContacts.size === 0}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:brightness-110 transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send size={13} /> Enviar para {selectedContacts.size || 0} contato{selectedContacts.size === 1 ? '' : 's'} selecionado{selectedContacts.size === 1 ? '' : 's'}
                    </button>

                    <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
                      Agora a lista inclui contatos importados por CSV e inscritos com telefone salvo.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

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
