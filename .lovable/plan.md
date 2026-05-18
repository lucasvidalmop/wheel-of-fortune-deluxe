## Visão geral

Criar uma nova página pública de apostas estilo bet365 na rota `/odds=tag`, onde o operador cadastra eventos manualmente (ex.: "Flamengo x Vasco") com 2 ou mais resultados possíveis e suas odds. O usuário, autenticado via e-mail + ID da conta (mesmo padrão do Luckybox), aposta seu saldo de **coins do Luckybox** (mesma carteira `wheel_users.tokens_balance`) em um dos resultados. Quando o operador resolve o evento (define qual resultado venceu), as apostas vencedoras são pagas automaticamente.

Cada **evento** define o tipo de prêmio:
- **Coins × odd**: ganha `valor_apostado * odd` em coins de volta no `tokens_balance`.
- **Caixa Luckybox**: ganha um `luckybox_grants` da caixa escolhida pelo operador (1 grant por aposta vencedora, opcionalmente multiplicado).

## O que muda

### 1. Roteamento
- `SlugRouter` em `src/App.tsx` reconhece `/:slug` começando com `odds=` → renderiza `<Bets tag={...} />`.

### 2. Banco de dados (migração nova)

Tabela **`bets_configs`** (1 por operador/tag — configura a página pública):
- `owner_id uuid`, `tag text unique`, `is_active boolean`
- `page_config jsonb` (visual: cores, header, logo, textos, SEO/pixels — mesmo padrão das outras páginas)
- `coin_name text`, `coin_icon_url text` (herdado/espelho do luckybox_configs do operador)

Tabela **`bet_events`** (eventos criados pelo operador):
- `owner_id uuid`, `bets_config_id uuid`
- `title text` ("Flamengo x Vasco"), `subtitle text`, `category text`, `image_url text`
- `starts_at timestamptz`, `closes_at timestamptz` (apostas bloqueadas após)
- `status text` (`open`, `closed`, `resolved`, `cancelled`)
- `payout_mode text` (`coins` | `case`)
- `payout_case_id uuid` (FK para `luckybox_cases`, quando `payout_mode = 'case'`)
- `payout_case_qty_per_unit numeric` (qtas caixas por unidade apostada — default 1)
- `min_bet integer`, `max_bet integer`
- `position integer`, `created_at`, `updated_at`

Tabela **`bet_outcomes`** (resultados possíveis de cada evento):
- `event_id uuid`, `label text` ("Casa", "Empate", "Visitante"), `odd numeric`
- `position integer`, `is_winner boolean default false`

Tabela **`bet_wagers`** (apostas dos usuários):
- `owner_id`, `event_id`, `outcome_id`, `wheel_user_id`
- `account_id text`, `user_email text`, `user_name text`
- `amount_coins integer`, `odd_snapshot numeric` (trava a odd no momento da aposta)
- `status text` (`pending`, `won`, `lost`, `refunded`, `cancelled`)
- `payout_coins integer`, `payout_grant_id uuid` (FK luckybox_grants)
- `created_at`, `resolved_at`

RLS: owner+admin podem CRUD próprios registros. Service role acessa tudo.

**RPCs `SECURITY DEFINER`** (chamadas via edge function, sem auth do usuário):
- `place_bet(p_owner_id, p_email, p_account_id, p_event_id, p_outcome_id, p_amount)` — valida saldo, deduz `tokens_balance`, cria `bet_wagers` com `odd_snapshot`. Retorna `{ success, new_balance, wager_id }`.
- `resolve_bet_event(p_event_id, p_winning_outcome_id)` — marca outcome vencedor, percorre wagers: vencedoras → credita coins ou cria `luckybox_grants`; perdedoras → marca `lost`. Idempotente.
- `cancel_bet_event(p_event_id)` — devolve coins de todas as apostas pendentes.

### 3. Edge functions
- **`get-bets-page`** (público, sem JWT): recebe `tag`, retorna `{ found, ownerId, pageConfig, coinName, events[], outcomes[] }`. Lista só eventos `open` ou `closed`.
- **`place-bet`** (público): recebe `tag, email, accountId, eventId, outcomeId, amount`. Localiza owner, valida evento aberto e dentro de `closes_at`, chama RPC `place_bet`. Retorna saldo atualizado.
- **`get-user-bets`** (público): retorna histórico de apostas do usuário naquela tag.

### 4. Painel do operador (Dashboard)
Nova entrada `🎯 Apostas` no menu lateral (entre Luckybox e Gorjeta), com componente novo `src/components/casino/BetsPanel.tsx`:
- **Aba "Configuração"**: tag (editável, valida unicidade), enabled, visual da página (reaproveita o mesmo editor de cores/header/SEO das outras páginas), URL pública com botão copiar + QR.
- **Aba "Eventos"**: lista CRUD de `bet_events`. Botão "Novo evento" abre dialog com:
  - Título, subtítulo, categoria, imagem
  - Datas (início / fechamento de apostas)
  - Min/max de aposta
  - Tipo de prêmio: Coins × odd **ou** Caixa Luckybox (com select de `luckybox_cases` do operador + qtd por unidade)
  - Lista dinâmica de resultados (mínimo 2): label + odd cada
  - Ações por evento: editar, fechar apostas, **resolver** (escolhe vencedor → dispara `resolve_bet_event`), cancelar (devolve coins), excluir
- **Aba "Apostas"**: tabela de `bet_wagers` com filtros por evento/status, exportar CSV.

### 5. Página pública `src/pages/Bets.tsx`
- Layout estilo casa de apostas:
  - Header com logo, saldo de coins do usuário (após autenticar).
  - Tela 1 (auth): e-mail + ID da conta → busca `wheel_users`, traz `tokens_balance`.
  - Tela 2 (lobby): cards/lista de eventos `open`, agrupados por categoria. Cada card mostra título, horário, e botões de outcome com sua odd ("Flamengo 1.85", "Empate 3.20", "Vasco 4.10").
  - Click em um outcome abre **cupom de aposta** lateral/modal: campo de valor, mostra retorno potencial `amount × odd` ou "X caixas", botão **Confirmar aposta**.
  - Aba "Minhas apostas" mostrando histórico (pendentes/ganhas/perdidas).
- Quando evento é resolvido pelo operador, refresh manual ou polling leve mostra resultado.
- Suporta SEO/pixels igual `UpdateRegistration` (Facebook Pixel, GA4, GTM, TikTok, custom head script).

### 6. Permissão
- Adicionar coluna `apostas boolean default false` em `operator_permissions` e `operator_permissions_defaults`.
- Menu "Apostas" só aparece se a permissão estiver ligada.

### 7. Tracking
- `track-pageview` com `page_type: 'bets'`.

## Detalhes técnicos

- A **odd é congelada** no momento da aposta (`odd_snapshot` em `bet_wagers`), então editar a odd do outcome depois não afeta apostas já feitas.
- `resolve_bet_event` é **idempotente** — checa `status = 'resolved'` antes de pagar para não pagar 2×.
- Pagamento em caixa: gera `luckybox_grants` com `case_id = payout_case_id`, `recipient_*` do `wheel_user`, `quantity = floor(amount * payout_case_qty_per_unit)` (mínimo 1), `status = 'pending'` (resgatável pelo Luckybox normalmente).
- Pagamento em coins: `tokens_balance += round(amount * odd_snapshot)`.
- Cancelamento devolve apenas `amount_coins` (sem odd) e marca `refunded`.
- Validação no front E no RPC (defesa em profundidade): `amount` inteiro positivo, dentro de `min_bet/max_bet`, evento aberto, `now() < closes_at`, saldo suficiente.

## Diagrama do fluxo

```text
[Operador] Dashboard > Apostas > Novo evento (título, outcomes+odds, prêmio)
                                          |
                                          v
                                  bet_events / bet_outcomes
                                          |
[/odds=tag] -> get-bets-page -> lobby de eventos
                                          |
[User auth: email+id] -> wheel_users.tokens_balance
                                          |
                                          v
[Click outcome] -> cupom (valor) -> place-bet -> place_bet RPC
                                                  - deduz coins
                                                  - cria bet_wager (odd travada)
                                          |
                                          v
[Operador] resolve evento -> resolve_bet_event RPC
                                          - vencedoras: credita coins OU gera grant Luckybox
                                          - perdedoras: status=lost
                                          |
                                          v
                       Usuário vê resultado em "Minhas apostas"
                       (se ganhou caixa, abre na página /:tag do Luckybox)
```

## Fora de escopo (pode vir depois)
- Apostas múltiplas (combinadas/parlay) — por ora só apostas simples.
- Cash-out antes do evento resolver.
- Limites/anti-fraude avançados (1 aposta por evento, etc).
- Mercados múltiplos por evento (resultado + total gols etc) — fica como evento separado.
- Notificação automática ao usuário quando ganha (pode reaproveitar `send-owner-notification` depois).
