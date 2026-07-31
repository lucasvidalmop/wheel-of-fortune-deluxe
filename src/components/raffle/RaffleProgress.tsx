interface Props {
  current: number;
  min: number;
  max?: number | null;
}

const RaffleProgress = ({ current, min, max }: Props) => {
  const goal = max || min || 0;
  const pct = goal > 0 ? Math.min(100, Math.round((current / goal) * 100)) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-white/60">Participantes</span>
        <span className="font-semibold text-white tabular-nums">
          {current}{goal > 0 ? ` / ${goal}` : ''}
        </span>
      </div>
      {goal > 0 && (
        <>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--lobby-primary, #00d4ff), #a855f7)' }}
            />
          </div>
          <p className="text-[11px] text-white/45">{pct}% da meta</p>
        </>
      )}
    </div>
  );
};

export default RaffleProgress;
