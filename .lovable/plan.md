# Bilhete múltiplo (apostas combinadas)

Adicionar suporte a apostas combinadas mantendo o sistema atual de apostas simples intacto.

## Banco de dados (nova migração)

### Tabela `bet_tickets`
- `id`, `owner_id`, `wheel_user_id`, `account_id`, `user_email`, `user_name`
- `public_code text unique` (mesmo padrão de `bet_wagers`)
- `total_odd numeric` — produto das odds no momento da aposta
- `stake integer` — coins apostadas
- `potential_return integer` — `round(stake * total_odd)`
- `status text` — `pending` | `won` | `lost` | `cancelled` | `refunded`
- `payout_coins integer default 0`
- `resolved_at timestamptz`, `created_at`

### Tabela `bet_ticket_selections`
- `id`, `ticket_id`, `owner_id`
- `event_id`, `market_id` (nullable), `outcome_id`
- `event_title text`, `market_title text`, `selection_label text` (snapshots para histórico)
- `odd numeric` — odd travada
- `status text` — `pending` | `won` | `lost` | `cancelled`

RLS: owner+admin CRUD próprios registros; service role full.

### RPCs `SECURITY DEFINER`
- `place_ticket(p_owner_id, p_email, p_account_id, p_selections jsonb, p_amount int)`
  - Valida: pelo menos 2 seleções; nenhuma seleção duplicada por evento+mercado; cada evento aberto e dentro de `closes_at`; saldo suficiente
  - Calcula `total_odd` no servidor a partir dos `bet_outcomes`
  - Deduz `tokens_balance`, cria `bet_tickets` + `bet_ticket_selections` (status `pending`)
  - Retorna `{ success, new_balance, ticket_id, public_code, total_odd, potential_return }`
- Ajuste em `resolve_bet_event` (e/ou `resolve_bet_market`): após resolver outcomes, percorrer `bet_ticket_selections` afetadas:
  - marcar selection `won` ou `lost`
  - se qualquer selection do ticket virar `lost` → ticket `lost`
  - se todas as selections do ticket virarem `won` → ticket `won` e creditar `potential_return` no `tokens_balance` (idempotente)

## Edge functions

### Nova: `place-ticket` (pública, sem JWT)
- Body: `{ tag, email, accountId, selections: [{ eventId, outcomeId, marketId? }], amount }`
- Localiza owner via `bets_configs.tag`, chama RPC `place_ticket`
- Retorna saldo atualizado e ticket criado

### `get-user-bets` (existente)
- Expandir retorno para incluir `tickets` do usuário (com selections agregadas)

## Frontend (`src/pages/Bets.tsx`)

### Estado novo
- `ticketSelections: Array<{ event, market, outcome }>` (em memória, sem persistir)
- `ticketOpen: boolean` para mostrar/esconder painel
- `ticketAmount: string`

### Botão nas odds
- Cada botão de odd existente passa a ter dois modos:
  - clique simples → mantém comportamento atual (aposta simples / abre slip)
  - botão pequeno secundário "+" / "Adicionar ao bilhete" sobreposto no canto
- Ao adicionar:
  - bloqueia se já existe seleção do mesmo `event_id` + `market_id`
  - toast confirmando
  - abre/atualiza badge do botão flutuante "Meu Bilhete (N)"

### Painel "Meu Bilhete"
- Botão flutuante fixo (canto inferior direito) com contador de seleções
- Drawer/Sheet lateral mostrando:
  - Lista de seleções (evento, mercado, label, odd) com botão remover
  - Odd final calculada (multiplicação)
  - Input de valor em coins
  - Retorno potencial = `valor × odd_final`
  - Botão "Confirmar bilhete" → chama `place-ticket`
  - Botão "Limpar bilhete"
- Validações no front: saldo, mínimo 2 seleções, todas válidas

### Aba "Minhas apostas"
- Adicionar seção "Bilhetes múltiplos" listando tickets do usuário com:
  - código, data, stake, odd total, retorno potencial, status
  - lista expandível das selections com status individual

## Detalhes técnicos
- Odd travada no momento da aposta (`odd` em `bet_ticket_selections`), igual ao padrão de `bet_wagers.odd_snapshot`.
- Resolução idempotente: checar status antes de creditar.
- Bilhete cancelado/refunded devolve `stake` ao saldo.
- Caso uma selection seja de evento cancelado, a regra é: bilhete vira `refunded` e devolve stake (mais simples e justo).
- Pagamento em caixa Luckybox **fora de escopo** para bilhetes — bilhete múltiplo paga apenas em coins.
- Apostas simples (`bet_wagers`) continuam funcionando exatamente como hoje, sem mudanças no fluxo.

## Fora de escopo
- UI no painel do operador para resolver tickets manualmente (resolução é automática via resolução dos eventos/mercados).
- Cash-out parcial.
- Bilhetes com prêmio em caixa.
