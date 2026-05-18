import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Save, Bell } from 'lucide-react';

interface Props { ownerId: string }

interface Notice {
  enabled: boolean;
  title: string;
  message: string;
  cta_text: string;
  cta_url: string;
  bg_color: string;
  text_color: string;
  cta_bg_color: string;
  cta_text_color: string;
}

const defaults: Notice = {
  enabled: false,
  title: 'Aviso importante',
  message: 'Leia atentamente antes de continuar.',
  cta_text: 'Saiba mais',
  cta_url: '',
  bg_color: '#fef3c7',
  text_color: '#78350f',
  cta_bg_color: '#f59e0b',
  cta_text_color: '#ffffff',
};

const AuthNoticePanel = ({ ownerId }: Props) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(defaults);
  const [exists, setExists] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('auth_notice_configs')
        .select('*')
        .eq('owner_id', ownerId)
        .maybeSingle();
      if (data) {
        setNotice({
          enabled: data.enabled, title: data.title, message: data.message,
          cta_text: data.cta_text, cta_url: data.cta_url,
          bg_color: data.bg_color, text_color: data.text_color,
          cta_bg_color: data.cta_bg_color, cta_text_color: data.cta_text_color,
        });
        setExists(true);
      }
      setLoading(false);
    })();
  }, [ownerId]);

  const save = async () => {
    setSaving(true);
    const payload = { owner_id: ownerId, ...notice, updated_at: new Date().toISOString() };
    const { error } = exists
      ? await supabase.from('auth_notice_configs').update(payload).eq('owner_id', ownerId)
      : await supabase.from('auth_notice_configs').insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setExists(true);
    toast.success('Aviso salvo');
  };

  const set = <K extends keyof Notice>(k: K, v: Notice[K]) => setNotice(n => ({ ...n, [k]: v }));

  if (loading) return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 flex justify-center">
      <Loader2 className="animate-spin text-muted-foreground" size={18} />
    </div>
  );

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Bell size={20} className="text-primary" />
        <h3 className="text-base font-bold text-foreground">Aviso nas páginas de login</h3>
      </div>
      <p className="text-sm text-muted-foreground -mt-2">
        Banner fixo que aparece no topo de todas as páginas com login (Luckybox, Apostas, Resgate, Depósito, Atualizar cadastro).
      </p>

      <label className="flex items-center gap-2 text-sm select-none cursor-pointer">
        <input type="checkbox" checked={notice.enabled} onChange={e => set('enabled', e.target.checked)} />
        <span>Exibir aviso</span>
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Text label="Título" value={notice.title} onChange={v => set('title', v)} />
        <Text label="Texto do botão (CTA)" value={notice.cta_text} onChange={v => set('cta_text', v)} placeholder="Ex.: Saiba mais" />
        <div className="sm:col-span-2">
          <label className="text-xs font-medium block mb-1 text-muted-foreground">Mensagem</label>
          <textarea rows={2} value={notice.message} onChange={e => set('message', e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm" />
        </div>
        <div className="sm:col-span-2">
          <Text label="URL do botão (deixe vazio para esconder o botão)" value={notice.cta_url} onChange={v => set('cta_url', v)} placeholder="https://..." />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Color label="Fundo banner" value={notice.bg_color} onChange={v => set('bg_color', v)} />
        <Color label="Texto banner" value={notice.text_color} onChange={v => set('text_color', v)} />
        <Color label="Fundo botão" value={notice.cta_bg_color} onChange={v => set('cta_bg_color', v)} />
        <Color label="Texto botão" value={notice.cta_text_color} onChange={v => set('cta_text_color', v)} />
      </div>

      {/* Preview */}
      <div>
        <div className="text-xs text-muted-foreground mb-1">Pré-visualização</div>
        <div className="rounded-lg overflow-hidden" style={{ background: notice.bg_color, color: notice.text_color }}>
          <div className="px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              {notice.title && <div className="font-bold text-sm">{notice.title}</div>}
              {notice.message && <div className="text-xs opacity-95 mt-0.5 whitespace-pre-line">{notice.message}</div>}
            </div>
            {notice.cta_text && notice.cta_url && (
              <span className="px-4 py-2 rounded-lg text-xs font-bold"
                style={{ background: notice.cta_bg_color, color: notice.cta_text_color }}>
                {notice.cta_text}
              </span>
            )}
          </div>
        </div>
      </div>

      <button onClick={save} disabled={saving}
        className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium flex items-center gap-2 disabled:opacity-50">
        {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Salvar aviso
      </button>
    </div>
  );
};

function Text({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs font-medium block mb-1 text-muted-foreground">{label}</label>
      <input value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm" />
    </div>
  );
}
function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-medium block mb-1 text-muted-foreground">{label}</label>
      <div className="flex gap-1">
        <input type="color" value={value} onChange={e => onChange(e.target.value)} className="w-10 h-9 rounded cursor-pointer" />
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          className="flex-1 px-2 py-2 rounded bg-white/[0.04] border border-white/[0.08] text-xs tabular-nums" />
      </div>
    </div>
  );
}

export default AuthNoticePanel;
