import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Copy, Check, ExternalLink } from 'lucide-react';

export interface UpdatePageConfig {
  enabled?: boolean;
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
}

export const defaultUpdatePageConfig: UpdatePageConfig = {
  enabled: false,
  fields: { name: true, phone: true, cpf: false, pixKey: true },
  titleText: 'Atualizar Cadastro',
  subtitleText: 'Mantenha seus dados sempre atualizados.',
  btnText: 'SALVAR ATUALIZAÇÃO',
  successTitle: 'CADASTRO ATUALIZADO!',
  successSubtitle: 'Seus novos dados foram salvos com sucesso.',
  notFoundText: 'Não encontramos um cadastro com esse e-mail e ID. Confira os dados e tente novamente.',
  lookupBtnText: 'BUSCAR CADASTRO',
};

interface Props {
  userId: string;
  currentConfig: UpdatePageConfig;
  onSaved: (cfg: UpdatePageConfig) => void;
}

const UpdatePageEditor = ({ userId, currentConfig, onSaved }: Props) => {
  const [cfg, setCfg] = useState<UpdatePageConfig>({ ...defaultUpdatePageConfig, ...currentConfig, fields: { ...defaultUpdatePageConfig.fields, ...(currentConfig.fields || {}) } });
  const [slug, setSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('wheel_configs').select('slug').eq('user_id', userId).maybeSingle();
      if (data?.slug) setSlug(data.slug);
    })();
  }, [userId]);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const publicUrl = slug ? `${baseUrl}/atualizar=${slug}` : '';

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
          <p className="text-xs text-muted-foreground">Defina o slug da sua roleta para gerar a URL pública.</p>
        )}
      </div>

      {/* Campos liberados */}
      <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-3">
        <h3 className="text-sm font-bold text-foreground">Campos que o participante pode atualizar</h3>
        <p className="text-[11px] text-muted-foreground -mt-1">E-mail e ID da conta são usados apenas para localizar o cadastro e nunca podem ser alterados.</p>
        <div className="grid sm:grid-cols-2 gap-2">
          {fieldRow('name', 'Nome completo')}
          {fieldRow('phone', 'WhatsApp / Celular')}
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
