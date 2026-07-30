import Plinko from '@/components/gorjeta/games/Plinko';

export default function PlinkoPreview() {
  return (
    <div style={{ background: '#000', minHeight: '100vh', padding: 24 }}>
      <div style={{ width: 1100, height: 660, margin: '0 auto' }}>
        <Plinko rows={11} multipliers={[10,5,2,1,0.5,0,0.5,1,2,5,10]} path={[1,0,1,1,0,1,0,0,1,1,0]} />
      </div>
    </div>
  );
}
