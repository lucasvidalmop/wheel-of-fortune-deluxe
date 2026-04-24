import Deposit from './Deposit';

/**
 * Depósito BS — clone visual da página de Depósito.
 * Compartilha a MESMA `depositConfig` (e credenciais EdPay) configuradas no
 * Dashboard, mudando apenas a URL pública: /depbs=tag (em vez de /dep=tag).
 */
const DepositBS = ({ tag }: { tag?: string }) => {
  return <Deposit tag={tag} />;
};

export default DepositBS;
