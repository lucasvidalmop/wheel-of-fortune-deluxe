import { Ticket, Clock3, CheckCircle2 } from 'lucide-react';

interface Props {
  code?: string;
  status?: string;
  eventName: string;
  drawAt?: string | null;
  message?: string;
}

const RaffleTicket = ({ code, status, eventName, drawAt, message }: Props) => {
  const inReview = status === 'review';
  return (
    <div className="rounded-3xl border border-white/12 bg-white/[0.06] p-5 space-y-3">
      <div className="flex items-center gap-2 text-white/70">
        {inReview ? <Clock3 size={18} /> : <CheckCircle2 size={18} className="text-emerald-400" />}
        <span className="text-[11px] uppercase tracking-[0.24em]">
          {inReview ? 'Em análise' : 'Inscrição confirmada'}
        </span>
      </div>
      <p className="text-sm text-white/70">{message || eventName}</p>
      {code && (
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-white/20 bg-black/30 px-4 py-3">
          <Ticket size={20} className="text-white/60" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/40">Seu código</p>
            <p className="text-lg font-bold tracking-wider text-white">{code}</p>
          </div>
        </div>
      )}
      {drawAt && (
        <p className="text-[12px] text-white/50">
          Sorteio em {new Date(drawAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
        </p>
      )}
    </div>
  );
};

export default RaffleTicket;
