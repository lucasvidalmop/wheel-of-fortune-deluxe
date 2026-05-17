import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Copy, Check, ExternalLink, Upload, Trash2 } from 'lucide-react';
import { uploadAppAsset } from '@/lib/uploadAppAsset';

export interface UpdateSeoConfig {
  pageTitle?: string;
  faviconUrl?: string;
  pageDescription?: string;
  ogImage?: string;
  keywords?: string;
  facebookPixelId?: string;
  googleAnalyticsId?: string;
  gtmId?: string;
  tiktokPixelId?: string;
  customHeadScript?: string;
}

export interface UpdatePageConfig {
  enabled?: boolean;
  tag?: string;
  fields?: {
    name?: boolean;
    phone?: boolean;
    cpf?: boolean;
    pixKey?: boolean;
    accountId?: boolean;
  };
  titleText?: string;
  subtitleText?: string;
  btnText?: string;
  successTitle?: string;
  successSubtitle?: string;
  notFoundText?: string;
  lookupBtnText?: string;
  seo?: UpdateSeoConfig;
}

export const defaultUpdatePageConfig: UpdatePageConfig = {
  enabled: false,
  fields: { name: true, phone: true, cpf: false, pixKey: true, accountId: false },
  titleText: 'Atualizar Cadastro',
  subtitleText: 'Mantenha seus dados sempre atualizados.',
  btnText: 'SALVAR ATUALIZAÇÃO',
  successTitle: 'CADASTRO ATUALIZADO!',
  successSubtitle: 'Seus novos dados foram salvos com sucesso.',
  notFoundText: 'Não encontramos um cadastro com esse e-mail e ID. Confira os dados e tente novamente.',
  lookupBtnText: 'BUSCAR CADASTRO',
  seo: {},
};

interface Props {
  userId: string;
  currentConfig: UpdatePageConfig;
  onSaved: (cfg: UpdatePageConfig) => void;
}

const slugify = (v: string) =>
  v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

const UpdatePageEditor = ({ userId, currentConfig, onSaved }: Props) => {
  const [cfg, setCfg] = useState<UpdatePageConfig>({ ...defaultUpdatePageConfig, ...currentConfig, fields: { ...defaultUpdatePageConfig.fields, ...(currentConfig.fields || {}) } });
  const [wheelSlug, setWheelSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('wheel_configs').select('slug').eq('user_id', userId).maybeSingle();
      if (data?.slug) setWheelSlug(data.slug);
    })();
  }, [userId]);

  const effectiveTag = (cfg.tag && cfg.tag.trim()) || wheelSlug;
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const publicUrl = effectiveTag ? `${baseUrl}/atualizar=${effectiveTag}` : '';

  const setField = (k: keyof NonNullable<UpdatePageConfig['fields']>, v: boolean) =>
    setCfg(p => ({ ...p, fields: { ...(p.fields || {}), [k]: v } }));

  const save = async () => {
    setSaving(true);
    try {
      const { data: existing } = await supabase.from('wheel_configs').select('config').eq('user_id', userId).maybeSingle();
      const newConfig = { ...((existing?.config as any) || {}), updatePageConfig: cfg };
      const { error } = await supabase.from('wheel_configs').update({ config: newConfig as any }).eq('user_id', userId);
      if (error) throw error;
      onSaved(cfg);
      toast.success('Configuração salva!');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar');
    }
    setSaving(false);
  };

  const copy = async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const fieldRow = (key: keyof NonNullable<UpdatePageConfig['fields']>, label: string, hint?: string) => (
    <label className="flex items-start gap-3 p-3 rounded-xl border border-white/[0.06] hover:bg-white/[0.02] cursor-pointer transition">
      <input
        type="checkbox"
        checked={!!cfg.fields?.[key]}
        onChange={e => setField(key, e.target.checked)}
        className="mt-0.5 w-4 h-4 accent-primary cursor-pointer"
      />
      <div className="flex-1">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
      </div>
    </label>
  );

  const textRow = (label: string, value: string | undefined, onChange: (v: string) => void, placeholder?: string, textarea = false) => (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{label}</label>
      {textarea ? (
        <textarea
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      ) : (
        <input
          type="text"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Status + URL */}
      <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">Página pública de atualização</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Cada participante atualiza somente os campos liberados abaixo.</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!cfg.enabled}
              onChange={e => setCfg(p => ({ ...p, enabled: e.target.checked }))}
              className="w-4 h-4 accent-primary cursor-pointer"
            />
            <span className="text-xs font-medium">{cfg.enabled ? 'Ativa' : 'Desativada'}</span>
          </label>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Tag personalizada (URL)</label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">/atualizar=</span>
            <input
              type="text"
              value={cfg.tag || ''}
              onChange={e => setCfg(p => ({ ...p, tag: slugify(e.target.value) }))}
              placeholder={wheelSlug || 'minha-tag'}
              className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Letras minúsculas, números e hífen. Se vazio, usa o slug da roleta ({wheelSlug || '—'}).</p>
        </div>

        {publicUrl ? (
          <div className="flex gap-2">
            <input value={publicUrl} readOnly className="flex-1 px-3 py-2 rounded-lg bg-black/30 border border-white/[0.08] text-xs text-foreground" />
            <button onClick={copy} className="px-3 py-2 rounded-lg bg-primary/15 border border-primary/30 text-primary text-xs font-medium hover:bg-primary/25 transition flex items-center gap-1.5">
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiado' : 'Copiar'}
            </button>
            <a href={publicUrl} target="_blank" rel="noreferrer" className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs hover:bg-white/[0.08] transition flex items-center gap-1.5">
              <ExternalLink size={14} /> Abrir
            </a>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Defina uma tag acima ou o slug da sua roleta para gerar a URL pública.</p>
        )}
      </div>

      {/* Campos liberados */}
      <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-3">
        <h3 className="text-sm font-bold text-foreground">Campos que o participante pode atualizar</h3>
        <p className="text-[11px] text-muted-foreground -mt-1">O participante se identifica por e-mail + CPF (validados contra o cadastro original). Esses dois campos nunca podem ser alterados.</p>
        <div className="grid sm:grid-cols-2 gap-2">
          {fieldRow('name', 'Nome completo')}
          {fieldRow('phone', 'WhatsApp / Celular')}
          {fieldRow('accountId', 'ID da conta', 'Permite trocar o ID. Rejeitado se o novo ID já estiver em uso.')}
          {fieldRow('cpf', 'CPF', 'Visível apenas como referência — não é salvo se a base não tiver coluna.')}
          {fieldRow('pixKey', 'Chave PIX', 'Inclui o tipo (CPF, e-mail, celular, aleatória).')}
        </div>
      </div>

      {/* Textos */}
      <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-3">
        <h3 className="text-sm font-bold text-foreground">Textos da página</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {textRow('Título', cfg.titleText, v => setCfg(p => ({ ...p, titleText: v })), 'Atualizar Cadastro')}
          {textRow('Botão lookup', cfg.lookupBtnText, v => setCfg(p => ({ ...p, lookupBtnText: v })), 'BUSCAR CADASTRO')}
          {textRow('Subtítulo', cfg.subtitleText, v => setCfg(p => ({ ...p, subtitleText: v })), 'Mantenha seus dados sempre atualizados.', true)}
          {textRow('Botão salvar', cfg.btnText, v => setCfg(p => ({ ...p, btnText: v })), 'SALVAR ATUALIZAÇÃO')}
          {textRow('Título sucesso', cfg.successTitle, v => setCfg(p => ({ ...p, successTitle: v })), 'CADASTRO ATUALIZADO!')}
          {textRow('Subtítulo sucesso', cfg.successSubtitle, v => setCfg(p => ({ ...p, successSubtitle: v })), 'Seus novos dados foram salvos.', true)}
          {textRow('Mensagem "não encontrado"', cfg.notFoundText, v => setCfg(p => ({ ...p, notFoundText: v })), 'Não encontramos um cadastro...', true)}
        </div>
      </div>

      {/* SEO & Pixels */}
      <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-3">
        <h3 className="text-sm font-bold text-foreground">SEO & Pixels</h3>
        <p className="text-[11px] text-muted-foreground -mt-1">Meta tags e pixels de rastreamento aplicados especificamente na página de atualização.</p>

        <div className="grid sm:grid-cols-2 gap-3">
          {textRow('Título da aba', cfg.seo?.pageTitle, v => setCfg(p => ({ ...p, seo: { ...(p.seo || {}), pageTitle: v } })), 'Ex: Atualizar Cadastro')}
          {textRow('Palavras-chave', cfg.seo?.keywords, v => setCfg(p => ({ ...p, seo: { ...(p.seo || {}), keywords: v } })), 'atualizar, cadastro, pix')}
        </div>

        {/* Favicon with upload */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Favicon (ícone da aba)</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={cfg.seo?.faviconUrl || ''}
              onChange={e => setCfg(p => ({ ...p, seo: { ...(p.seo || {}), faviconUrl: e.target.value } }))}
              placeholder="https://exemplo.com/favicon.ico"
              className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <label className="shrink-0 cursor-pointer rounded-lg border border-white/[0.08] bg-white/[0.06] hover:bg-white/[0.12] px-3 py-2 text-xs font-semibold text-foreground transition flex items-center gap-1.5">
              <Upload size={14} /> Upload
              <input type="file" accept="image/*,.ico,.svg" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0]; if (!file) return;
                try {
                  const { publicUrl } = await uploadAppAsset(file, 'favicon');
                  setCfg(p => ({ ...p, seo: { ...(p.seo || {}), faviconUrl: publicUrl } }));
                  toast.success('Favicon enviado!');
                } catch (err: any) { toast.error('Erro: ' + (err.message || 'Tente novamente')); }
                e.target.value = '';
              }} />
            </label>
          </div>
          {cfg.seo?.faviconUrl && (
            <div className="mt-2 flex items-center gap-2">
              <img src={cfg.seo.faviconUrl} alt="Favicon" className="w-6 h-6 rounded object-contain bg-white/10 p-0.5" onError={e => (e.currentTarget.style.display = 'none')} />
              <button type="button" onClick={() => setCfg(p => ({ ...p, seo: { ...(p.seo || {}), faviconUrl: '' } }))} className="text-xs text-destructive hover:text-destructive/80"><Trash2 size={12} /></button>
            </div>
          )}
        </div>

        {/* OG Image with upload */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Imagem social (og:image)</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={cfg.seo?.ogImage || ''}
              onChange={e => setCfg(p => ({ ...p, seo: { ...(p.seo || {}), ogImage: e.target.value } }))}
              placeholder="https://exemplo.com/og.jpg"
              className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <label className="shrink-0 cursor-pointer rounded-lg border border-white/[0.08] bg-white/[0.06] hover:bg-white/[0.12] px-3 py-2 text-xs font-semibold text-foreground transition flex items-center gap-1.5">
              <Upload size={14} /> Upload
              <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0]; if (!file) return;
                try {
                  const { publicUrl } = await uploadAppAsset(file, 'og-images');
                  setCfg(p => ({ ...p, seo: { ...(p.seo || {}), ogImage: publicUrl } }));
                  toast.success('Imagem enviada!');
                } catch (err: any) { toast.error('Erro: ' + (err.message || 'Tente novamente')); }
                e.target.value = '';
              }} />
            </label>
          </div>
          {cfg.seo?.ogImage && (
            <div className="mt-2 rounded-lg overflow-hidden border border-white/[0.08] max-w-xs relative">
              <img src={cfg.seo.ogImage} alt="OG preview" className="w-full h-auto object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
              <button type="button" onClick={() => setCfg(p => ({ ...p, seo: { ...(p.seo || {}), ogImage: '' } }))} className="absolute top-1 right-1 bg-black/60 rounded-full p-1 text-destructive hover:text-destructive/80"><Trash2 size={12} /></button>
            </div>
          )}
        </div>

        {textRow('Descrição (meta description)', cfg.seo?.pageDescription, v => setCfg(p => ({ ...p, seo: { ...(p.seo || {}), pageDescription: v } })), 'Atualize seus dados para continuar participando.', true)}

        <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-white/[0.06]">
          {textRow('Facebook Pixel ID', cfg.seo?.facebookPixelId, v => setCfg(p => ({ ...p, seo: { ...(p.seo || {}), facebookPixelId: v } })), '123456789012345')}
          {textRow('Google Analytics (GA4)', cfg.seo?.googleAnalyticsId, v => setCfg(p => ({ ...p, seo: { ...(p.seo || {}), googleAnalyticsId: v } })), 'G-XXXXXXXXXX')}
          {textRow('Google Tag Manager', cfg.seo?.gtmId, v => setCfg(p => ({ ...p, seo: { ...(p.seo || {}), gtmId: v } })), 'GTM-XXXXXXX')}
          {textRow('TikTok Pixel ID', cfg.seo?.tiktokPixelId, v => setCfg(p => ({ ...p, seo: { ...(p.seo || {}), tiktokPixelId: v } })), 'CXXXXXXXXXXXXXXXXX')}
        </div>
        {textRow('Script personalizado (head)', cfg.seo?.customHeadScript, v => setCfg(p => ({ ...p, seo: { ...(p.seo || {}), customHeadScript: v } })), '<!-- script personalizado -->', true)}
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 hover:brightness-110 transition-all shadow-lg shadow-primary/20"
      >
        {saving ? 'Salvando...' : '💾 Salvar Configuração'}
      </button>
    </div>
  );
};

export default UpdatePageEditor;
