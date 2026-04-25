import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface BulkSendProgressProps {
  total: number;
  sent: number;
  errors: number;
  skipped?: number;
  label?: string;
  /** Quando true, mostra barra "indeterminada" (para envio único em lote no servidor) */
  indeterminate?: boolean;
  /** Cor do accent: 'primary' (default), 'green', 'blue' */
  accent?: "primary" | "green" | "blue";
}

/**
 * Barra de progresso para disparos em massa (WhatsApp / SMS / Email).
 * Use renderizando-a logo acima do botão de envio enquanto `total > 0`.
 */
export default function BulkSendProgress({
  total,
  sent,
  errors,
  skipped = 0,
  label = "Progresso do disparo",
  indeterminate = false,
  accent = "primary",
}: BulkSendProgressProps) {
  if (total <= 0) return null;

  const processed = sent + errors + skipped;
  const pct = indeterminate
    ? 100
    : Math.min(100, Math.round((processed / total) * 100));
  const done = processed >= total && !indeterminate;

  const accentText =
    accent === "green"
      ? "text-green-400"
      : accent === "blue"
      ? "text-blue-400"
      : "text-primary";

  return (
    <div className="w-full space-y-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-2 font-semibold text-foreground">
          {done ? (
            <CheckCircle2 size={14} className="text-green-400" />
          ) : (
            <Loader2 size={14} className={`animate-spin ${accentText}`} />
          )}
          {label}
        </span>
        <span className="font-mono text-muted-foreground">
          {indeterminate ? `${total} destinatário(s)` : `${processed}/${total}`}
          {!indeterminate && ` • ${pct}%`}
        </span>
      </div>

      <Progress
        value={pct}
        className={indeterminate ? "h-2 animate-pulse" : "h-2"}
      />

      <div className="flex flex-wrap items-center gap-3 text-[11px]">
        <span className="flex items-center gap-1 text-green-400">
          <CheckCircle2 size={11} /> {sent} enviado{sent === 1 ? "" : "s"}
        </span>
        {errors > 0 && (
          <span className="flex items-center gap-1 text-red-400">
            <XCircle size={11} /> {errors} erro{errors === 1 ? "" : "s"}
          </span>
        )}
        {skipped > 0 && (
          <span className="flex items-center gap-1 text-yellow-400">
            ⚠ {skipped} pulado{skipped === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </div>
  );
}
