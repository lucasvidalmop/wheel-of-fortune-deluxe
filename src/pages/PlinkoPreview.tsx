import Plinko from '@/components/gorjeta/games/Plinko';
const M = [10,5,2,1,0.5,0,0.5,1,2,5,10];
export default function PlinkoPreview() {
  return (
    <div className="h-[100dvh] w-screen bg-[#080b11] p-4 flex flex-col items-center">
      <div className="w-full max-w-[1000px] flex-1 min-h-0">
        <Plinko rows={11} multipliers={M} path={null} accent="#22d3ba" />
      </div>
    </div>
  );
}
