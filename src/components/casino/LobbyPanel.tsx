import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Copy, Upload, ExternalLink } from 'lucide-react';
import { uploadAppAsset } from '@/lib/uploadAppAsset';

type ProductKey = 'roleta' | 'batalha' | 'luckybox' | 'apostas';

interface CardConfig {
  key: ProductKey;
  enabled: boolean;
  title: string;
  subtitle?: string;
  image_url?: string;
  href?: string;
  order?: number;
}

interface PageConfig {
  site_title?: string;
  site_description?: string;
  bg_image_url?: string;
  logo_url?: string;
  footer_text?: string;
  cards?: CardConfig[];
}

const PRODUCT_LABELS: Record<ProductKey, string> = {
  roleta: 'Roleta',
  apostas: 'Apostas',
  luckybox: 'Luckybox',
  batalha: 'Batalha de Slots',
};

const DEFAULT_CARDS: CardConfig[] = [
  { key: 'roleta', enabled: true, title: 'Roleta', subtitle: 'Gire e ganhe prêmios', order: 1 },
  { key: 'apostas', enabled: true, title: 'Apostas', subtitle: 'Aposte nos jogos do dia', order: 2 },
  { key: 'luckybox', enabled: true, title: 'Luckybox', subtitle: 'Abra caixas e descubra prêmios', order: 3 },
  { key: 'batalha', enabled: false, title: 'Batalha de Slots', subtitle: 'Competição ao vivo', order: 4 },
];

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40);

const LobbyPanel = ({ ownerId }: { ownerId: string }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exists, setExists] = useState(false);
  const [tag, setTag] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [pc, setPc] = useState<PageConfig>({ cards: DEFAULT_CARDS });
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('lobby_configs')
        .select('tag, is_active, page_config')
        .eq('owner_id', ownerId)
        .maybeSingle();
      if (data) {
        setExists(true);
        setTag(data.tag);
        setIsActive(data.is_active);
        const conf = (data.page_config || {}) as PageConfig;
        // merge default cards with stored
        const stored = conf.cards || [];
        const merged = DEFAULT_CARDS.map((d) => ({ ...d, ...(stored.find((s) => s.key === d.key) || {}) }));
        setPc({ ...conf, cards: merged });
      } else {
        setPc({ cards: DEFAULT_CARDS });
      }
      setLoading(false);
    })();
  }, [ownerId]);

  const save = async () => {
    const cleanTag = slugify(tag);
    if (!cleanTag) { toast.error('Defina uma tag válida'); return; }
    setSaving(true);
    const payload = {
      owner_id: ownerId,
      tag: cleanTag,
      is_active: isActive,
      page_config: pc,
    };
    const { error } = await supabase
      .from('lobby_configs')
      .upsert(payload, { onConflict: 'owner_id' });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setExists(true);
    setTag(cleanTag);
    toast.success('Lobby salvo');
  };

  const updateCard = (idx: number, patch: Partial<CardConfig>) => {
    setPc((p) => {
      const cards = [...(p.cards || DEFAULT_CARDS)];
      cards[idx] = { ...cards[idx], ...patch };
      return { ...p, cards };
    });
  };

  const handleUpload = async (file: File, target: 'bg' | 'logo' | `card-${number}`) => {
    setUploadingKey(target);
    try {
      const url = await uploadAppAsset(file);
      if (target === 'bg') setPc((p) => ({ ...p, bg_image_url: url }));
      else if (target === 'logo') setPc((p) => ({ ...p, logo_url: url }));
      else {
        const idx = Number(target.split('-')[1]);
        updateCard(idx, { image_url: url });
      }
      toast.success('Imagem enviada');
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao enviar imagem');
    } finally {
      setUploadingKey(null);
    }
  };

  const lobbyUrl = tag ? `${window.location.origin}/lobby=${slugify(tag)}` : '';

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
        <h3 className="text-lg font-bold text-foreground">Configuração do Lobby</h3>
        <p className="text-sm text-muted-foreground">Crie uma página única que reúne todos os seus produtos (Roleta, Apostas, Luckybox e Batalha).</p>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Tag do lobby</label>
            <input
              type="text"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="ex: casa1"
              className="w-full px-3 py-2 rounded-lg bg-background border border-white/10 text-foreground"
            />
            <p className="text-[11px] text-muted-foreground mt-1">URL: /lobby={slugify(tag) || 'sua-tag'}</p>
          </div>
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Ativo
            </label>
            {exists && lobbyUrl && (
              <>
                <button type="button" onClick={() => { navigator.clipboard.writeText(lobbyUrl); toast.success('Link copiado'); }} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm flex items-center gap-1">
                  <Copy size={14} /> Copiar
                </button>
                <a href={lobbyUrl} target="_blank" rel="noreferrer" className="px-3 py-2 rounded-lg bg-primary/15 hover:bg-primary/25 text-primary text-sm flex items-center gap-1">
                  <ExternalLink size={14} /> Abrir
                </a>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
        <h3 className="text-lg font-bold text-foreground">Visual da página</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Título</label>
            <input type="text" value={pc.site_title || ''} onChange={(e) => setPc({ ...pc, site_title: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-white/10 text-foreground" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Descrição</label>
            <input type="text" value={pc.site_description || ''} onChange={(e) => setPc({ ...pc, site_description: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-white/10 text-foreground" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Imagem de fundo</label>
            <div className="flex gap-2 items-center">
              <input type="text" value={pc.bg_image_url || ''} onChange={(e) => setPc({ ...pc, bg_image_url: e.target.value })} placeholder="URL da imagem" className="flex-1 px-3 py-2 rounded-lg bg-background border border-white/10 text-foreground text-sm" />
              <label className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm cursor-pointer flex items-center gap-1">
                {uploadingKey === 'bg' ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], 'bg')} />
              </label>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Logo</label>
            <div className="flex gap-2 items-center">
              <input type="text" value={pc.logo_url || ''} onChange={(e) => setPc({ ...pc, logo_url: e.target.value })} placeholder="URL do logo" className="flex-1 px-3 py-2 rounded-lg bg-background border border-white/10 text-foreground text-sm" />
              <label className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm cursor-pointer flex items-center gap-1">
                {uploadingKey === 'logo' ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], 'logo')} />
              </label>
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Texto do rodapé</label>
            <input type="text" value={pc.footer_text || ''} onChange={(e) => setPc({ ...pc, footer_text: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-white/10 text-foreground" />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
        <h3 className="text-lg font-bold text-foreground">Cards dos produtos</h3>
        <p className="text-xs text-muted-foreground">Deixe o link em branco para usar o padrão configurado nas tags de cada produto. Desative cards que você não usa.</p>
        <div className="space-y-3">
          {(pc.cards || DEFAULT_CARDS).map((card, idx) => (
            <div key={card.key} className="rounded-xl border border-white/10 bg-background/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={card.enabled} onChange={(e) => updateCard(idx, { enabled: e.target.checked })} />
                    <span className="font-semibold text-foreground">{PRODUCT_LABELS[card.key]}</span>
                  </label>
                </div>
                <input type="number" value={card.order ?? idx + 1} onChange={(e) => updateCard(idx, { order: Number(e.target.value) })} className="w-20 px-2 py-1 rounded bg-background border border-white/10 text-foreground text-sm" title="Ordem" />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <input type="text" value={card.title} onChange={(e) => updateCard(idx, { title: e.target.value })} placeholder="Título do card" className="px-3 py-2 rounded-lg bg-background border border-white/10 text-foreground text-sm" />
                <input type="text" value={card.subtitle || ''} onChange={(e) => updateCard(idx, { subtitle: e.target.value })} placeholder="Subtítulo" className="px-3 py-2 rounded-lg bg-background border border-white/10 text-foreground text-sm" />
                <input type="text" value={card.href || ''} onChange={(e) => updateCard(idx, { href: e.target.value })} placeholder="Link (vazio = padrão)" className="px-3 py-2 rounded-lg bg-background border border-white/10 text-foreground text-sm" />
                <div className="flex gap-2 items-center">
                  <input type="text" value={card.image_url || ''} onChange={(e) => updateCard(idx, { image_url: e.target.value })} placeholder="URL da imagem" className="flex-1 px-3 py-2 rounded-lg bg-background border border-white/10 text-foreground text-sm" />
                  <label className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm cursor-pointer flex items-center gap-1">
                    {uploadingKey === `card-${idx}` ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], `card-${idx}`)} />
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-60 flex items-center gap-2">
          {saving && <Loader2 size={16} className="animate-spin" />}
          Salvar lobby
        </button>
      </div>
    </div>
  );
};

export default LobbyPanel;
