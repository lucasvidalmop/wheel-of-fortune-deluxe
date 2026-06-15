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

interface LobbyTheme {
  primary?: string;
  bg_color?: string;
  text_color?: string;
  heading_font?: string;
  body_font?: string;
  overlay_strength?: number;
}

interface LobbyLoginConfig {
  title?: string;
  subtitle?: string;
  button_label?: string;
  remember_label?: string;
  signup_text?: string;
  signup_link_text?: string;
  signup_url?: string;
  show_signup?: boolean;
  show_lobby_pill?: boolean;
}

interface PageConfig {
  site_title?: string;
  site_description?: string;
  bg_image_url?: string;
  logo_url?: string;
  footer_text?: string;
  cards?: CardConfig[];
  theme?: LobbyTheme;
  login?: LobbyLoginConfig;
}

const FONT_OPTIONS = [
  'Bebas Neue', 'Barlow', 'Inter', 'Poppins', 'Montserrat', 'Oswald',
  'Playfair Display', 'Roboto', 'Anton', 'Archivo Black', 'Space Grotesk', 'DM Sans',
];

const DEFAULT_THEME: LobbyTheme = {
  primary: '#00d4ff',
  bg_color: '#0a0a0f',
  text_color: '#ffffff',
  heading_font: 'Bebas Neue',
  body_font: 'Barlow',
  overlay_strength: 65,
};

const DEFAULT_LOGIN: LobbyLoginConfig = {
  title: '',
  subtitle: '',
  button_label: 'Entrar',
  remember_label: 'Lembrar sessão',
  signup_text: 'Crie sua conta na gorjeta',
  signup_link_text: 'Clique aqui',
  signup_url: '',
  show_signup: true,
  show_lobby_pill: true,
};

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
  const [pc, setPc] = useState<PageConfig>({ cards: DEFAULT_CARDS, theme: DEFAULT_THEME, login: DEFAULT_LOGIN });
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
        const stored = conf.cards || [];
        const merged = DEFAULT_CARDS.map((d) => ({ ...d, ...(stored.find((s) => s.key === d.key) || {}) }));
        setPc({
          ...conf,
          cards: merged,
          theme: { ...DEFAULT_THEME, ...(conf.theme || {}) },
          login: { ...DEFAULT_LOGIN, ...(conf.login || {}) },
        });
      } else {
        setPc({ cards: DEFAULT_CARDS, theme: DEFAULT_THEME, login: DEFAULT_LOGIN });
      }
      setLoading(false);
    })();
  }, [ownerId]);

  const updateTheme = (patch: Partial<LobbyTheme>) =>
    setPc((p) => ({ ...p, theme: { ...DEFAULT_THEME, ...(p.theme || {}), ...patch } }));
  const updateLogin = (patch: Partial<LobbyLoginConfig>) =>
    setPc((p) => ({ ...p, login: { ...DEFAULT_LOGIN, ...(p.login || {}), ...patch } }));

  const save = async () => {
    const cleanTag = slugify(tag);
    if (!cleanTag) { toast.error('Defina uma tag válida'); return; }
    setSaving(true);
    const payload = {
      owner_id: ownerId,
      tag: cleanTag,
      is_active: isActive,
      page_config: pc as any,
    };
    const { error } = await (supabase as any)
      .from('lobby_configs')
      .upsert([payload], { onConflict: 'owner_id' });
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
      const res = await uploadAppAsset(file, 'lobby');
      const url = res.publicUrl;
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

      {/* ─── Tema visual ─── */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
        <div>
          <h3 className="text-lg font-bold text-foreground">Tema visual</h3>
          <p className="text-xs text-muted-foreground">Personalize as cores e fontes do lobby e da tela de login do seu operador.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Cor primária (botões, destaques)</label>
            <div className="flex gap-2 items-center">
              <input type="color" value={pc.theme?.primary || '#00d4ff'} onChange={(e) => updateTheme({ primary: e.target.value })} className="h-10 w-12 rounded-md border border-white/10 bg-background cursor-pointer" />
              <input type="text" value={pc.theme?.primary || ''} onChange={(e) => updateTheme({ primary: e.target.value })} placeholder="#00d4ff" className="flex-1 px-3 py-2 rounded-lg bg-background border border-white/10 text-foreground text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Cor de fundo</label>
            <div className="flex gap-2 items-center">
              <input type="color" value={pc.theme?.bg_color || '#0a0a0f'} onChange={(e) => updateTheme({ bg_color: e.target.value })} className="h-10 w-12 rounded-md border border-white/10 bg-background cursor-pointer" />
              <input type="text" value={pc.theme?.bg_color || ''} onChange={(e) => updateTheme({ bg_color: e.target.value })} placeholder="#0a0a0f" className="flex-1 px-3 py-2 rounded-lg bg-background border border-white/10 text-foreground text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Cor do texto</label>
            <div className="flex gap-2 items-center">
              <input type="color" value={pc.theme?.text_color || '#ffffff'} onChange={(e) => updateTheme({ text_color: e.target.value })} className="h-10 w-12 rounded-md border border-white/10 bg-background cursor-pointer" />
              <input type="text" value={pc.theme?.text_color || ''} onChange={(e) => updateTheme({ text_color: e.target.value })} placeholder="#ffffff" className="flex-1 px-3 py-2 rounded-lg bg-background border border-white/10 text-foreground text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Escurecimento do fundo ({pc.theme?.overlay_strength ?? 65}%)</label>
            <input type="range" min={0} max={100} value={pc.theme?.overlay_strength ?? 65} onChange={(e) => updateTheme({ overlay_strength: Number(e.target.value) })} className="w-full accent-primary" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Fonte dos títulos</label>
            <select value={pc.theme?.heading_font || 'Bebas Neue'} onChange={(e) => updateTheme({ heading_font: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-white/10 text-foreground text-sm">
              {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Fonte do corpo</label>
            <select value={pc.theme?.body_font || 'Barlow'} onChange={(e) => updateTheme({ body_font: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-white/10 text-foreground text-sm">
              {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>
        {/* Preview */}
        <div className="rounded-xl p-5 border border-white/10" style={{ background: pc.theme?.bg_color || '#0a0a0f', color: pc.theme?.text_color || '#fff' }}>
          <div className="text-[10px] uppercase tracking-[0.3em] opacity-50 mb-2" style={{ fontFamily: `${pc.theme?.body_font || 'Barlow'}, sans-serif` }}>Preview</div>
          <div style={{ fontFamily: `${pc.theme?.heading_font || 'Bebas Neue'}, sans-serif`, fontSize: 42, lineHeight: 1 }}>SEU LOBBY</div>
          <div className="mt-2 text-sm opacity-70" style={{ fontFamily: `${pc.theme?.body_font || 'Barlow'}, sans-serif` }}>Veja como ficará a tipografia e as cores.</div>
          <button type="button" className="mt-3 px-4 py-2 rounded-lg font-semibold text-sm" style={{ background: pc.theme?.primary || '#00d4ff', color: '#0a0a0f', fontFamily: `${pc.theme?.body_font || 'Barlow'}, sans-serif` }}>
            Botão primário
          </button>
        </div>
      </div>

      {/* ─── Tela de login ─── */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
        <div>
          <h3 className="text-lg font-bold text-foreground">Tela de login</h3>
          <p className="text-xs text-muted-foreground">Textos exibidos na tela de login do lobby. Deixe em branco para usar o padrão.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Título do login</label>
            <input type="text" value={pc.login?.title || ''} onChange={(e) => updateLogin({ title: e.target.value })} placeholder="Acesse o Lobby" className="w-full px-3 py-2 rounded-lg bg-background border border-white/10 text-foreground text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Subtítulo do login</label>
            <input type="text" value={pc.login?.subtitle || ''} onChange={(e) => updateLogin({ subtitle: e.target.value })} placeholder="Entre com seu e-mail e ID da conta" className="w-full px-3 py-2 rounded-lg bg-background border border-white/10 text-foreground text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Texto do botão</label>
            <input type="text" value={pc.login?.button_label || ''} onChange={(e) => updateLogin({ button_label: e.target.value })} placeholder="Entrar" className="w-full px-3 py-2 rounded-lg bg-background border border-white/10 text-foreground text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Texto "lembrar sessão"</label>
            <input type="text" value={pc.login?.remember_label || ''} onChange={(e) => updateLogin({ remember_label: e.target.value })} placeholder="Lembrar sessão" className="w-full px-3 py-2 rounded-lg bg-background border border-white/10 text-foreground text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Texto antes do link de cadastro</label>
            <input type="text" value={pc.login?.signup_text || ''} onChange={(e) => updateLogin({ signup_text: e.target.value })} placeholder="Crie sua conta na gorjeta" className="w-full px-3 py-2 rounded-lg bg-background border border-white/10 text-foreground text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Texto do link de cadastro</label>
            <input type="text" value={pc.login?.signup_link_text || ''} onChange={(e) => updateLogin({ signup_link_text: e.target.value })} placeholder="Clique aqui" className="w-full px-3 py-2 rounded-lg bg-background border border-white/10 text-foreground text-sm" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-muted-foreground mb-1">URL do cadastro (vazio = página de gorjeta do operador)</label>
            <input type="text" value={pc.login?.signup_url || ''} onChange={(e) => updateLogin({ signup_url: e.target.value })} placeholder="https://..." className="w-full px-3 py-2 rounded-lg bg-background border border-white/10 text-foreground text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={pc.login?.show_signup !== false} onChange={(e) => updateLogin({ show_signup: e.target.checked })} />
            Mostrar link de cadastro
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={pc.login?.show_lobby_pill !== false} onChange={(e) => updateLogin({ show_lobby_pill: e.target.checked })} />
            Mostrar selo "Lobby" no canto
          </label>
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
