import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Save, Download, RotateCcw, Trash2, Shield, RefreshCw, Upload } from 'lucide-react';
import { toast } from 'sonner';

interface BackupRow {
  id: string;
  label: string;
  trigger: string;
  created_at: string;
  wheel_configs: any[];
  referral_links: any[];
  email_templates: any[];
  whatsapp_share_templates: any[];
}

const AUTO_BACKUP_KEY = 'lastAutoConfigBackupAt';
const AUTO_BACKUP_INTERVAL_MS = 1000 * 60 * 60 * 6; // a cada 6h

export const ConfigBackupPanel = () => {
  const [backups, setBackups] = useState<BackupRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [label, setLabel] = useState('');

  const loadBackups = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('config_backups' as any)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Erro ao carregar backups: ' + error.message);
    } else {
      setBackups((data as any) || []);
    }
    setLoading(false);
  }, []);

  const createBackup = useCallback(async (customLabel?: string, trigger: 'manual' | 'auto' = 'manual') => {
    setCreating(true);
    const { data, error } = await supabase.rpc('create_config_backup' as any, {
      _label: customLabel ?? label ?? '',
      _trigger: trigger,
    });
    setCreating(false);
    if (error) {
      toast.error('Erro ao criar backup: ' + error.message);
      return null;
    }
    if (trigger === 'manual') {
      toast.success('Backup criado com sucesso');
      setLabel('');
      loadBackups();
    }
    return data;
  }, [label, loadBackups]);

  // Auto-backup on mount (uma vez por sessão, no máximo a cada 6h)
  useEffect(() => {
    const last = Number(localStorage.getItem(AUTO_BACKUP_KEY) || 0);
    if (Date.now() - last > AUTO_BACKUP_INTERVAL_MS) {
      createBackup('Backup automático', 'auto').then((id) => {
        if (id) localStorage.setItem(AUTO_BACKUP_KEY, String(Date.now()));
      });
    }
    loadBackups();
  }, [createBackup, loadBackups]);

  const restoreBackup = async (id: string) => {
    if (!confirm('Restaurar este backup? Suas configurações atuais serão substituídas pelas deste snapshot.')) return;
    setRestoringId(id);
    // Cria um snapshot de segurança antes de restaurar
    await createBackup('Antes de restaurar', 'auto');
    const { error } = await supabase.rpc('restore_config_backup' as any, { _backup_id: id });
    setRestoringId(null);
    if (error) {
      toast.error('Erro ao restaurar: ' + error.message);
      return;
    }
    toast.success('Backup restaurado! Recarregando...');
    setTimeout(() => window.location.reload(), 1200);
  };

  const deleteBackup = async (id: string) => {
    if (!confirm('Excluir este backup permanentemente?')) return;
    const { error } = await supabase.from('config_backups' as any).delete().eq('id', id);
    if (error) {
      toast.error('Erro ao excluir: ' + error.message);
      return;
    }
    toast.success('Backup excluído');
    loadBackups();
  };

  const downloadBackup = (b: BackupRow) => {
    const blob = new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-${b.created_at.replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Não autenticado'); return; }
      const { error } = await supabase.from('config_backups' as any).insert({
        user_id: user.id,
        label: parsed.label || `Importado: ${file.name}`,
        trigger: 'manual',
        wheel_configs: parsed.wheel_configs || [],
        referral_links: parsed.referral_links || [],
        email_templates: parsed.email_templates || [],
        whatsapp_share_templates: parsed.whatsapp_share_templates || [],
      });
      if (error) { toast.error('Erro ao importar: ' + error.message); return; }
      toast.success('Backup importado');
      loadBackups();
    } catch (e: any) {
      toast.error('Arquivo inválido: ' + e.message);
    }
  };

  const formatDate = (s: string) => new Date(s).toLocaleString('pt-BR');

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Shield size={20} className="text-primary" />
        <h3 className="text-base font-bold text-foreground">Backup de Configurações</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Snapshot completo das suas configurações (roleta, dashboard, integrações, links de indicação, templates de email/whatsapp). Mantém os <strong className="text-foreground">últimos 20 backups</strong>. Um backup automático é criado a cada 6h.
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          placeholder="Rótulo (opcional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="flex-1 px-3 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
        <button
          onClick={() => createBackup()}
          disabled={creating}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 text-sm font-medium transition disabled:opacity-50"
        >
          <Save size={16} /> {creating ? 'Criando...' : 'Criar backup agora'}
        </button>
        <label className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-foreground text-sm font-medium transition cursor-pointer">
          <Upload size={16} /> Importar
          <input type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importBackup(f); e.currentTarget.value = ''; }} />
        </label>
        <button
          onClick={loadBackups}
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-muted-foreground hover:text-foreground transition"
          title="Atualizar"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="space-y-2 max-h-[480px] overflow-y-auto">
        {backups.length === 0 && !loading && (
          <div className="text-center text-sm text-muted-foreground py-6">Nenhum backup ainda.</div>
        )}
        {backups.map((b) => (
          <div key={b.id} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-foreground truncate">{b.label || 'Sem rótulo'}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${b.trigger === 'auto' ? 'bg-blue-500/20 text-blue-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                  {b.trigger === 'auto' ? 'AUTO' : 'MANUAL'}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {formatDate(b.created_at)} · {b.wheel_configs?.length || 0} config · {b.referral_links?.length || 0} links · {b.email_templates?.length || 0} email · {b.whatsapp_share_templates?.length || 0} wpp
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => downloadBackup(b)} className="p-2 rounded-lg hover:bg-white/[0.08] text-muted-foreground hover:text-foreground transition" title="Baixar JSON">
                <Download size={14} />
              </button>
              <button
                onClick={() => restoreBackup(b.id)}
                disabled={restoringId === b.id}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/15 hover:bg-primary/25 text-primary border border-primary/25 text-xs font-medium transition disabled:opacity-50"
                title="Restaurar"
              >
                <RotateCcw size={12} /> {restoringId === b.id ? '...' : 'Restaurar'}
              </button>
              <button onClick={() => deleteBackup(b.id)} className="p-2 rounded-lg hover:bg-red-500/15 text-muted-foreground hover:text-red-400 transition" title="Excluir">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
