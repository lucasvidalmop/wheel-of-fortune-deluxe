import { useState } from 'react';
import { Copy, Check, Radio, Users, X } from 'lucide-react';
import type { LiveParticipant, LiveRoom } from './useLiveRoom';

interface Props {
  accent: string;
  room: LiveRoom | null;
  participants: LiveParticipant[];
  busy: boolean;
  link: string;
  useGhosts: boolean;
  onToggleGhosts: (v: boolean) => void;
  ghostCount: number;
  onOpenRoom: (name: string) => void;
  onCloseRoom: () => void;
}

const LiveRoomPanel = ({
  accent, room, participants, busy, link, useGhosts, onToggleGhosts, ghostCount, onOpenRoom, onCloseRoom,
}: Props) => {
  const [name, setName] = useState('');
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  if (!room) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3 mb-3 shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <Radio size={13} style={{ color: accent }} />
          <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">Nenhuma sala aberta</span>
        </div>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da transmissão"
            maxLength={60}
            className="flex-1 h-9 px-3 rounded-lg bg-black/40 border border-white/10 text-xs text-white placeholder:text-white/25 outline-none"
          />
          <button
            onClick={() => onOpenRoom(name.trim() || 'Sala ao vivo')}
            disabled={busy}
            className="h-9 px-4 rounded-lg text-[11px] font-black uppercase tracking-wider disabled:opacity-50"
            style={{ background: accent, color: '#04150a' }}
          >
            Abrir sala
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border p-3 mb-3 shrink-0" style={{ borderColor: `${accent}44`, background: `${accent}0c` }}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2 w-2 rounded-full animate-pulse shrink-0" style={{ background: accent }} />
          <span className="text-xs font-bold truncate">{room.name}</span>
        </div>
        <button
          onClick={onCloseRoom}
          disabled={busy}
          className="h-7 px-2 rounded-lg border border-white/12 text-[10px] font-semibold text-white/55 flex items-center gap-1 disabled:opacity-40"
        >
          <X size={11} /> Encerrar
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 h-8 px-2 rounded-lg bg-black/40 border border-white/10 flex items-center text-[10px] text-white/50 font-mono truncate">
          {link}
        </div>
        <button onClick={copy} className="h-8 px-2.5 rounded-lg border border-white/12 text-[10px] text-white/60 flex items-center gap-1">
          {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] text-white/55">
          <Users size={12} /> <strong style={{ color: accent }}>{participants.length}</strong> na sala
          {participants.length > 0 && (
            <span className="text-white/30 truncate">
              · último: {participants[participants.length - 1].user_name}
            </span>
          )}
        </div>
      </div>

    </div>
  );
};

export default LiveRoomPanel;
