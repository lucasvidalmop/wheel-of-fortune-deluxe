import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import PlinkoBoard from './components/plinko/PlinkoBoard';
import './index.css';

const NAMES = ['JO*** S.', 'MA*** L.', 'CA*** P.', 'RE*** T.', 'AN*** B.', 'LU*** M.', 'PE*** R.', 'BR*** F.', 'TE*** 4.', 'GA*** V.'];

const Demo = () => {
  const [token, setToken] = useState(0);
  const [balls, setBalls] = useState<{ id: string; label: string }[]>([]);
  return (
    <div style={{ maxWidth: 640, margin: '20px auto' }}>
      <button
        onClick={() => {
          setBalls(NAMES.map((n, i) => ({ id: `${Date.now()}-${i}`, label: n })));
          setToken(t => t + 1);
        }}
      >drop 10</button>
      <PlinkoBoard rows={8} multipliers={[10, 5, 3, 2, 1, 2, 3, 5, 10]} accent="#2dd4bf" dropToken={token} balls={balls} />
    </div>
  );
};

createRoot(document.getElementById('root')!).render(<Demo />);
