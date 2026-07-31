import { Trophy } from 'lucide-react';
import type { RaffleResultPublic } from '@/lib/raffle';

const RaffleResult = ({ result, highlightCode }: { result: RaffleResultPublic; highlightCode?: string }) => (
  <div className="rounded-3xl border border-amber-400/25 bg-amber-400/[0.07] p-5 space-y-4">
    <div className="flex items-center gap-2">
      <Trophy size={18} className="text-amber-300" />
      <span className="text-[11px] uppercase tracking-[0.24em] text-amber-200">
        Resultado {result.round > 1 ? `· rodada ${result.round}` : ''}
      </span>
    </div>
    <div className="space-y-2">
      {result.winners.map((w) => {
        const isMe = highlightCode && w.code === highlightCode;
        return (
          <div
            key={w.code}
            className={`flex items-center justify-between rounded-2xl px-4 py-3 border ${
              isMe ? 'border-emerald-400/50 bg-emerald-400/10' : 'border-white/10 bg-black/25'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-white/40 w-5">{w.position}º</span>
              <span className="font-semibold text-white">{w.name}</span>
            </div>
            <span className="text-xs tracking-wider text-white/50">{w.code}</span>
          </div>
        );
      })}
    </div>
    <p className="text-[11px] text-white/45">
      {result.totalValid} participantes válidos ·{' '}
      {new Date(result.executedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
    </p>
  </div>
);

export default RaffleResult;
