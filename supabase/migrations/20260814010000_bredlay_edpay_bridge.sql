-- Ponte pro BREDLAY (loja externa) usar a cobranca Pix EdPay ja aprovada
-- neste projeto, sem precisar de um segundo webhook aprovado na EdPay.
-- external_ref guarda o identificador do pedido do BREDLAY, unico por tipo,
-- pra permitir consulta de status depois.

alter table public.edpay_transactions
  add column if not exists external_ref text;

create unique index if not exists edpay_transactions_type_external_ref_uq
  on public.edpay_transactions(type, external_ref)
  where external_ref is not null;
