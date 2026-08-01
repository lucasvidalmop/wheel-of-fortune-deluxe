import PlinkoGame from '@/components/plinko/PlinkoGame';

const names = ['Ana Souza', 'Bruno Lima', 'Carla Dias', 'Diego Melo', 'Eva Rocha'];

const PlinkoPreview = () => (
  <PlinkoGame
    open
    onClose={() => {}}
    accent="#00e5cc"
    btnText="#04120f"
    textColor="#ffffff"
    cardStyle={{ background: '#0b1220' }}
    names={names}
    participantCount={476}
    pickParticipant={() => ({ id: '1', name: 'Ana Souza', account_id: '123', isGhost: false })}
    onWin={() => {}}
    basePrize={10}
    ballCount={1}
  />
);

export default PlinkoPreview;
