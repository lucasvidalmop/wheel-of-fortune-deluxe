import Deposit from './Deposit';

/**
 * Depósito BS — clone visual da página de Depósito.
 * Compartilha a MESMA `depositConfig` (e credenciais EdPay) configuradas no
 * Dashboard, mudando apenas a URL pública (/depbs=tag) e os rótulos do
 * questionário: Nome no Youtube, Nome do Jogo e WhatsApp.
 */
const DepositBS = ({ tag }: { tag?: string }) => {
  return (
    <Deposit
      tag={tag}
      variant="bs"
      labels={{
        nameLabel: 'Nome no Youtube',
        namePlaceholder: 'Seu nome no Youtube',
        accountLabel: 'Nome do Jogo',
        accountPlaceholder: 'Nome do Jogo',
        whatsappLabel: 'WhatsApp',
      }}
    />
  );
};

export default DepositBS;
