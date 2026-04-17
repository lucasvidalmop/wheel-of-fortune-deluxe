import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, ChevronUp, ChevronDown, Save, X, Pencil, Image as ImageIcon, Type, Heading as HeadingIcon, List, MousePointerClick, Minus, Layout, Code2, Eye, Upload, FileCode } from 'lucide-react';
import { uploadAppAsset } from '@/lib/uploadAppAsset';

export type EmailBlock =
  | { type: 'hero'; imageUrl: string; alt?: string }
  | { type: 'image'; imageUrl: string; alt?: string; width?: number; align?: 'left' | 'center' | 'right'; linkUrl?: string }
  | { type: 'bullets'; items: { bold?: string; text?: string }[]; align?: 'left' | 'center' }
  | { type: 'divider' }
  | { type: 'heading'; text: string; align?: 'left' | 'center'; color?: string }
  | { type: 'text'; text: string; align?: 'left' | 'center'; color?: string }
  | { type: 'cta'; label: string; backgroundColor?: string; textColor?: string }
  | { type: 'html'; html: string }
  | { type: 'footer'; heading?: string; text?: string; copyright?: string; backgroundColor?: string; textColor?: string };

export interface EmailTemplateRow {
  id: string;
  name: string;
  blocks: EmailBlock[];
  backgroundColor?: string;
}

interface Props {
  ownerId: string;
  onClose: () => void;
  onSaved?: () => void;
  initial?: EmailTemplateRow | null;
}

const NEW_BLOCK_DEFAULTS: Record<EmailBlock['type'], EmailBlock> = {
  hero: { type: 'hero', imageUrl: '' },
  image: { type: 'image', imageUrl: '', align: 'center', width: 480 },
  bullets: { type: 'bullets', items: [{ bold: 'Destaque', text: 'descrição' }], align: 'center' },
  divider: { type: 'divider' },
  heading: { type: 'heading', text: 'Título principal', align: 'center', color: '#0e1b10' },
  text: { type: 'text', text: 'Seu texto aqui. Use {name} para o nome do destinatário e {body} para a mensagem.', align: 'center', color: '#0e1b10' },
  cta: { type: 'cta', label: 'Girar agora →', backgroundColor: '#00c4cc', textColor: '#ffffff' },
  html: { type: 'html', html: '<div style="padding:20px;text-align:center;">Cole seu HTML aqui</div>' },
  footer: { type: 'footer', heading: 'Precisa de ajuda?', text: 'Fale com o suporte.', copyright: 'Equipe - 2026', backgroundColor: '#070300', textColor: '#f6f5f1' },
};

export default function EmailTemplateEditor({ ownerId, onClose, onSaved, initial }: Props) {
  const [name, setName] = useState(initial?.name || '');
  const [blocks, setBlocks] = useState<EmailBlock[]>(initial?.blocks || []);
  const [backgroundColor, setBackgroundColor] = useState(initial?.backgroundColor || '#f0f1f5');
  const [saving, setSaving] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  const addBlock = (type: EmailBlock['type']) => {
    setBlocks([...blocks, JSON.parse(JSON.stringify(NEW_BLOCK_DEFAULTS[type]))]);
  };

  const updateBlock = (idx: number, patch: any) => {
    setBlocks(blocks.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  };

  const removeBlock = (idx: number) => setBlocks(blocks.filter((_, i) => i !== idx));

  const moveBlock = (idx: number, dir: -1 | 1) => {
    const next = [...blocks];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setBlocks(next);
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Dê um nome ao template'); return; }
    if (blocks.length === 0) { toast.error('Adicione pelo menos um bloco'); return; }
    setSaving(true);
    try {
      const payload = { owner_id: ownerId, name: name.trim(), blocks: blocks as any, updated_at: new Date().toISOString() };
      let error;
      if (initial?.id) {
        ({ error } = await supabase.from('email_templates').update(payload).eq('id', initial.id));
      } else {
        ({ error } = await supabase.from('email_templates').insert(payload));
      }
      if (error) throw error;
      toast.success('Template salvo!');
      onSaved?.();
      onClose();
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + (e.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (file: File, idx: number) => {
    if (file.size > 5 * 1024 * 1024) { toast.error('Imagem máx 5MB'); return; }
    setUploadingIdx(idx);
    try {
      const { publicUrl } = await uploadAppAsset(file, 'email-blocks');
      updateBlock(idx, { imageUrl: publicUrl });
      toast.success('Imagem enviada!');
    } catch (e: any) {
      toast.error('Erro: ' + (e.message || ''));
    } finally {
      setUploadingIdx(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do template (ex: Promo Sexta)"
          className="flex-1 px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] uppercase text-muted-foreground">BG</label>
          <input type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} className="w-9 h-9 rounded-lg border border-white/[0.08] bg-transparent cursor-pointer" />
        </div>
      </div>

      {/* Add block toolbar */}
      <div className="flex flex-wrap gap-1.5">
        {([
          ['hero', ImageIcon, 'Hero'],
          ['image', ImageIcon, 'Imagem'],
          ['heading', HeadingIcon, 'Título'],
          ['text', Type, 'Texto'],
          ['bullets', List, 'Lista'],
          ['cta', MousePointerClick, 'Botão'],
          ['divider', Minus, 'Divisor'],
          ['footer', Layout, 'Rodapé'],
        ] as const).map(([type, Icon, label]) => (
          <button
            key={type}
            type="button"
            onClick={() => addBlock(type)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] text-xs text-foreground hover:bg-white/[0.08] transition"
          >
            <Plus size={12} /> <Icon size={12} /> {label}
          </button>
        ))}
      </div>

      {/* Blocks list */}
      <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
        {blocks.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8 border border-dashed border-white/[0.08] rounded-xl">
            Nenhum bloco. Adicione um acima.
          </p>
        )}
        {blocks.map((block, idx) => (
          <div key={idx} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider text-primary">{block.type}</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => moveBlock(idx, -1)} disabled={idx === 0} className="p-1 rounded hover:bg-white/[0.06] disabled:opacity-30"><ChevronUp size={14} /></button>
                <button type="button" onClick={() => moveBlock(idx, 1)} disabled={idx === blocks.length - 1} className="p-1 rounded hover:bg-white/[0.06] disabled:opacity-30"><ChevronDown size={14} /></button>
                <button type="button" onClick={() => removeBlock(idx)} className="p-1 rounded hover:bg-destructive/20 text-destructive"><Trash2 size={14} /></button>
              </div>
            </div>

            {block.type === 'hero' && (
              <>
                <input value={block.imageUrl} onChange={(e) => updateBlock(idx, { imageUrl: e.target.value })} placeholder="URL da imagem" className="w-full px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-foreground focus:outline-none" />
                <label className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-white/[0.15] bg-white/[0.02] text-muted-foreground text-xs hover:bg-white/[0.05] transition cursor-pointer">
                  {uploadingIdx === idx ? '⏳ Enviando...' : '📤 Enviar imagem'}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, idx); }} />
                </label>
                {block.imageUrl && <img src={block.imageUrl} alt="" className="w-full max-h-32 object-cover rounded-lg" onError={(e) => (e.currentTarget.style.display = 'none')} />}
              </>
            )}

            {block.type === 'image' && (
              <>
                <input value={block.imageUrl} onChange={(e) => updateBlock(idx, { imageUrl: e.target.value })} placeholder="URL da imagem" className="w-full px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-foreground focus:outline-none" />
                <label className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-white/[0.15] bg-white/[0.02] text-muted-foreground text-xs hover:bg-white/[0.05] transition cursor-pointer">
                  {uploadingIdx === idx ? '⏳ Enviando...' : '📤 Enviar imagem'}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, idx); }} />
                </label>
                <input value={block.linkUrl || ''} onChange={(e) => updateBlock(idx, { linkUrl: e.target.value })} placeholder="Link ao clicar (opcional)" className="w-full px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-foreground focus:outline-none" />
                <div className="flex gap-2 items-center text-xs text-muted-foreground">
                  <span>Largura</span>
                  <input type="number" min={100} max={600} value={block.width || 480} onChange={(e) => updateBlock(idx, { width: parseInt(e.target.value) || 480 })} className="w-20 px-2 py-1 rounded bg-white/[0.04] border border-white/[0.08] text-xs text-foreground" />
                  <select value={block.align || 'center'} onChange={(e) => updateBlock(idx, { align: e.target.value })} className="px-2 py-1 rounded bg-white/[0.04] border border-white/[0.08] text-xs text-foreground">
                    <option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option>
                  </select>
                </div>
                {block.imageUrl && <img src={block.imageUrl} alt="" className="w-full max-h-32 object-contain rounded-lg" onError={(e) => (e.currentTarget.style.display = 'none')} />}
              </>
            )}

            {block.type === 'heading' && (
              <>
                <input value={block.text} onChange={(e) => updateBlock(idx, { text: e.target.value })} placeholder="Texto do título" className="w-full px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-foreground focus:outline-none" />
                <div className="flex gap-2 items-center">
                  <select value={block.align || 'center'} onChange={(e) => updateBlock(idx, { align: e.target.value })} className="px-2 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-foreground">
                    <option value="left">Esquerda</option><option value="center">Centro</option>
                  </select>
                  <input type="color" value={block.color || '#0e1b10'} onChange={(e) => updateBlock(idx, { color: e.target.value })} className="w-7 h-7 rounded border border-white/[0.08] bg-transparent" />
                </div>
              </>
            )}

            {block.type === 'text' && (
              <>
                <textarea value={block.text} onChange={(e) => updateBlock(idx, { text: e.target.value })} rows={3} placeholder="Texto. Use {name} e {body} como variáveis." className="w-full px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-foreground focus:outline-none resize-y" />
                <div className="flex gap-2 items-center">
                  <select value={block.align || 'center'} onChange={(e) => updateBlock(idx, { align: e.target.value })} className="px-2 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-foreground">
                    <option value="left">Esquerda</option><option value="center">Centro</option>
                  </select>
                  <input type="color" value={block.color || '#0e1b10'} onChange={(e) => updateBlock(idx, { color: e.target.value })} className="w-7 h-7 rounded border border-white/[0.08] bg-transparent" />
                </div>
              </>
            )}

            {block.type === 'bullets' && (
              <>
                {block.items.map((item, i) => (
                  <div key={i} className="flex gap-1.5 items-center">
                    <input value={item.bold || ''} onChange={(e) => { const items = [...block.items]; items[i] = { ...items[i], bold: e.target.value }; updateBlock(idx, { items }); }} placeholder="Negrito" className="flex-1 px-2 py-1 rounded bg-white/[0.04] border border-white/[0.08] text-xs text-foreground" />
                    <input value={item.text || ''} onChange={(e) => { const items = [...block.items]; items[i] = { ...items[i], text: e.target.value }; updateBlock(idx, { items }); }} placeholder="Resto" className="flex-1 px-2 py-1 rounded bg-white/[0.04] border border-white/[0.08] text-xs text-foreground" />
                    <button type="button" onClick={() => { const items = block.items.filter((_, j) => j !== i); updateBlock(idx, { items }); }} className="p-1 text-destructive hover:bg-destructive/20 rounded"><X size={12} /></button>
                  </div>
                ))}
                <button type="button" onClick={() => updateBlock(idx, { items: [...block.items, { bold: '', text: '' }] })} className="text-xs text-primary hover:underline">+ Item</button>
              </>
            )}

            {block.type === 'cta' && (
              <>
                <input value={block.label} onChange={(e) => updateBlock(idx, { label: e.target.value })} placeholder="Texto do botão" className="w-full px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-foreground focus:outline-none" />
                <div className="flex gap-2 items-center text-xs text-muted-foreground">
                  <span>Fundo</span><input type="color" value={block.backgroundColor || '#00c4cc'} onChange={(e) => updateBlock(idx, { backgroundColor: e.target.value })} className="w-7 h-7 rounded border border-white/[0.08] bg-transparent" />
                  <span>Texto</span><input type="color" value={block.textColor || '#ffffff'} onChange={(e) => updateBlock(idx, { textColor: e.target.value })} className="w-7 h-7 rounded border border-white/[0.08] bg-transparent" />
                </div>
                <p className="text-[10px] text-muted-foreground">O link da roleta é aplicado automaticamente.</p>
              </>
            )}

            {block.type === 'footer' && (
              <>
                <input value={block.heading || ''} onChange={(e) => updateBlock(idx, { heading: e.target.value })} placeholder="Título do rodapé" className="w-full px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-foreground focus:outline-none" />
                <textarea value={block.text || ''} onChange={(e) => updateBlock(idx, { text: e.target.value })} rows={2} placeholder="Texto" className="w-full px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-foreground focus:outline-none resize-y" />
                <input value={block.copyright || ''} onChange={(e) => updateBlock(idx, { copyright: e.target.value })} placeholder="Copyright" className="w-full px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-foreground focus:outline-none" />
                <div className="flex gap-2 items-center text-xs text-muted-foreground">
                  <span>Fundo</span><input type="color" value={block.backgroundColor || '#070300'} onChange={(e) => updateBlock(idx, { backgroundColor: e.target.value })} className="w-7 h-7 rounded border border-white/[0.08] bg-transparent" />
                  <span>Texto</span><input type="color" value={block.textColor || '#f6f5f1'} onChange={(e) => updateBlock(idx, { textColor: e.target.value })} className="w-7 h-7 rounded border border-white/[0.08] bg-transparent" />
                </div>
              </>
            )}

            {block.type === 'divider' && <p className="text-[10px] text-muted-foreground italic">Linha divisória</p>}
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-2 border-t border-white/[0.06]">
        <button onClick={onClose} className="px-4 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm hover:bg-white/[0.08]">Cancelar</button>
        <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
          <Save size={14} /> {saving ? 'Salvando...' : 'Salvar template'}
        </button>
      </div>
    </div>
  );
}

export function useEmailTemplates(ownerId: string | null) {
  const [templates, setTemplates] = useState<EmailTemplateRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    if (!ownerId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('email_templates')
      .select('id, name, blocks')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });
    if (!error && data) {
      setTemplates(data.map((d: any) => ({ id: d.id, name: d.name, blocks: (d.blocks as any) || [] })));
    }
    setLoading(false);
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [ownerId]);

  return { templates, loading, refresh };
}
