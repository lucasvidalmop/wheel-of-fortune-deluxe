import { useState } from 'react';
import PlinkoGame from '@/components/plinko/PlinkoGame';

const participants = Array.from({ length: 48 }, (_, i) => `Participante ${i + 1}`);

export default function PlinkoPreview() {
  const [open, setOpen] = useState(true);
  return (
    <PlinkoGame
      open={open}
      onClose={() => setOpen(false)}
      accent="#00e5d4"
      btnText="#061416"
      textColor="#f4fbfb"
      cardStyle={{ background: '#07131a' }}
      names={participants}
      participantCount={participants.length}
      pickParticipant={() => ({ id: crypto.randomUUID(), name: participants[Math.floor(Math.random() * participants.length)], account_id: 'preview', isGhost: true })}
      onWin={() => undefined}
      basePrize={10}
      ballCount={10}
    />
  );
}