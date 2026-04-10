import { useState, useCallback, ReactNode } from 'react';
import { AlertTriangle, Trash2, HelpCircle } from 'lucide-react';

type ConfirmVariant = 'danger' | 'warning' | 'info';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
}

const variantStyles: Record<ConfirmVariant, { icon: ReactNode; confirmClass: string; iconBgClass: string }> = {
  danger: {
    icon: <Trash2 size={24} />,
    confirmClass: 'bg-red-600 hover:bg-red-500 shadow-lg shadow-red-600/20',
    iconBgClass: 'bg-red-500/15 text-red-400 border-red-500/20',
  },
  warning: {
    icon: <AlertTriangle size={24} />,
    confirmClass: 'bg-amber-600 hover:bg-amber-500 shadow-lg shadow-amber-600/20',
    iconBgClass: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  },
  info: {
    icon: <HelpCircle size={24} />,
    confirmClass: 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/20',
    iconBgClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  },
};

export function useConfirmDialog() {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ ...options, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state?.resolve(true);
    setState(null);
  }, [state]);

  const handleCancel = useCallback(() => {
    state?.resolve(false);
    setState(null);
  }, [state]);

  const ConfirmDialog = state ? (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleCancel}
    >
      <div
        className="w-full max-w-sm mx-4 rounded-2xl border border-white/[0.08] bg-[#1a1a2e] p-6 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className={`w-14 h-14 rounded-full border flex items-center justify-center ${variantStyles[state.variant || 'info'].iconBgClass}`}>
            {variantStyles[state.variant || 'info'].icon}
          </div>
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-foreground text-center mb-2">
          {state.title}
        </h3>

        {/* Message */}
        <p className="text-sm text-muted-foreground text-center whitespace-pre-line mb-6 leading-relaxed">
          {state.message}
        </p>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-white/[0.06] border border-white/[0.08] text-muted-foreground hover:bg-white/[0.1] hover:text-foreground transition-all"
          >
            {state.cancelLabel || 'Cancelar'}
          </button>
          <button
            onClick={handleConfirm}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all ${variantStyles[state.variant || 'info'].confirmClass}`}
          >
            {state.confirmLabel || 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, ConfirmDialog };
}
