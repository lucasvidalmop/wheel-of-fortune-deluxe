import { Pause, Play, Square } from 'lucide-react';
import type { BulkSendControl } from '@/hooks/useBulkSendControl';

interface BulkSendControlsProps {
  control: BulkSendControl;
  /** Quando true (envio em andamento) os botões aparecem. */
  visible: boolean;
  onStop?: () => void | Promise<void>;
  className?: string;
}

/**
 * Botões PAUSAR/RETOMAR e PARAR para qualquer disparo em massa.
 * Renderize logo acima ou abaixo do botão de envio.
 */
export default function BulkSendControls({
  control,
  visible,
  onStop,
  className = '',
}: BulkSendControlsProps) {
  if (!visible) return null;

  return (
    <div className={`flex gap-2 ${className}`}>
      {control.paused ? (
        <button
          type="button"
          onClick={control.resume}
          className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
        >
          <Play size={14} /> Retomar
        </button>
      ) : (
        <button
          type="button"
          onClick={control.pause}
          className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition-all shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2"
        >
          <Pause size={14} /> Pausar
        </button>
      )}
      <button
        type="button"
        onClick={async () => {
          control.stop();
          if (onStop) await onStop();
        }}
        className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-all shadow-lg shadow-red-600/20 flex items-center justify-center gap-2"
      >
        <Square size={14} /> Parar
      </button>
    </div>
  );
}
