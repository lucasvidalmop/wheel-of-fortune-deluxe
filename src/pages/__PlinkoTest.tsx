import { useState } from 'react';
import PlinkoRaffleDialog from '@/components/gorjeta/PlinkoRaffleDialog';
import { DEFAULT_PLINKO } from '@/components/gorjeta/plinkoConfig';

const CANDIDATES = Array.from({ length: 25 }, (_, i) => ({
  id: String(i),
  name: `Participante ${i + 1}`,
  account_id: `ID${1000 + i}`,
}));

const PlinkoTest = () => {
  const [mode, setMode] = useState<'base' | 'live'>('base');
  return (
    <PlinkoRaffleDialog
      open
      onClose={() => {}}
      accent="#2ff0ec"
      config={DEFAULT_PLINKO}
      onSaveConfig={() => {}}
      candidates={CANDIDATES}
      mode={mode}
      onModeChange={setMode}
      onWinner={() => {}}
    />
  );
};
export default PlinkoTest;
