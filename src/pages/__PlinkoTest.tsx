import { useState } from 'react';
import Plinko from '@/components/gorjeta/games/Plinko';

const MULT = [0, 0.5, 1, 2, 5, 2, 1, 0.5, 0];
const ROWS = 8;

const PlinkoTest = () => {
  const [path, setPath] = useState<number[] | null>(null);
  return (
    <div className="min-h-screen bg-background p-6">
      <button data-testid="drop" className="mb-4 rounded bg-primary px-4 py-2" onClick={() => setPath(Array.from({length: ROWS}, () => (Math.random() < 0.5 ? 0 : 1)))}>drop</button>
      <div className="aspect-[16/10] w-full max-w-[900px]">
        <Plinko rows={ROWS} multipliers={MULT} path={path} accent="#2ff0ec" />
      </div>
    </div>
  );
};
export default PlinkoTest;
