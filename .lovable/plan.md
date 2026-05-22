
# Bolão da Copa

Sistema de palpites estilo "bolão" inspirado nos prints: usuário monta fase de grupos (12 grupos × 4 seleções), escolhe os 8 melhores terceiros, monta o mata-mata até o campeão, envia o palpite uma única vez, e recebe pontos conforme o resultado oficial.

## 1. Modelo de dados (Lovable Cloud)

Quatro tabelas novas, todas isoladas por `owner_id` (mesmo padrão de `bets_configs`):

- **bolao_configs** — 1 por owner/tag.
  - `tag`, `owner_id`, `name`, `submission_deadline` (timestamp), `is_active`, `page_config` (jsonb: cores, textos), `scoring` (jsonb com os pontos abaixo, editáveis), `groups` (jsonb: 12 grupos A–L, cada um com 4 seleções `{name, flag_url, code}`), `bracket_template` (jsonb opcional: cruzamentos das oitavas), `official_results` (jsonb: posições reais por grupo, melhores terceiros, vencedores de cada confronto, campeão).
- **bolao_entries** — 1 por usuário.
  - `owner_id`, `bolao_config_id`, `wheel_user_id`, `account_id`, `user_email`, `user_name`, `status` (`draft` | `submitted` | `locked`), `submitted_at`, `score` (int, calculado), `score_breakdown` (jsonb).
  - Único: `(bolao_config_id, account_id)`.
- **bolao_entry_groups** — palpite de grupos.
  - `entry_id`, `group_key` (A–L), `first_team`, `second_team`, `third_team`.
- **bolao_entry_bracket** — palpite do mata-mata.
  - `entry_id`, `round` (`r32` | `r16` | `qf` | `sf` | `final` | `champion`), `slot` (posição no chaveamento), `team_code`.
  - Campo separado `best_thirds` (jsonb com 8 códigos) em `bolao_entries`.

RLS: owner CRUD próprio; service role gerencia tudo; leitura pública dos `bolao_configs` via edge function (sem expor `official_results` antes do prazo).

## 2. Fluxo do participante (frontend)

Nova rota `/bolao/:tag` (ou botão "Bolão da Copa" abre modal/aba no `/odds=...`). 3 abas internas:

### Aba "Grupos"
- 12 cards (Grupo A → L), 3 colunas em desktop, 1 em mobile.
- Cada card: lista as 4 seleções (bandeira + nome) com 3 radios "1º / 2º / 3º".
- Validação: não permite a mesma seleção em duas posições do mesmo grupo (desabilita radios já usados).
- Botão "Sorteio aleatório" por grupo: embaralha e preenche 1º/2º/3º.
- Header fixo com progresso: `X / 12 grupos preenchidos`.

### Aba "Classificação"
- Mostra automaticamente os 24 classificados (1º + 2º de cada grupo) em formato de tabela.
- Lista os 12 terceiros — usuário marca 8 (botão fica desabilitado quando atinge 8).
- Indicador "Faltam Y terceiros".

### Aba "Mata-mata"
- Chaveamento em bracket visual (similar ao print 3) com rounds: 16-avos (32→16), Oitavas (16→8), Quartas (8→4), Semi (4→2), Final (2→1), Campeão.
- Slots iniciais preenchidos a partir do template (1A vs 2B, 1B vs 3F, etc.) — uso o cruzamento padrão da Copa.
- Clique no time avança automaticamente para o slot da próxima fase.
- Trocar um vencedor em fase anterior limpa as fases dependentes.
- Botão "Enviar palpite" só habilita quando todos os 32 grupos + 8 terceiros + bracket completos estiverem prontos.

### Envio
- Botão "Enviar palpite" → confirma → grava `status='submitted'`.
- Após envio: tela read-only com o palpite + pontuação atual (se admin já lançou resultados).
- Após `submission_deadline`: backend força `status='locked'` ao tentar editar.

## 3. Admin

Nova seção no painel admin de Apostas: "Bolão da Copa".
- Editor de **grupos**: criar/renomear grupos, adicionar/remover seleções, upload de bandeira.
- Definir **deadline** de envio.
- Definir **resultados oficiais** (mesma UI do participante, mas marcando o real).
- Botão **"Recalcular pontuações"** → edge function percorre `bolao_entries` e atualiza `score`/`score_breakdown`.
- Tabela de **ranking** dos participantes (nome, account_id, pontos, ver palpite).

## 4. Pontuação (regras do usuário)

Implementada em uma edge function `score-bolao` reutilizando o `scoring` jsonb (default = valores do pedido):

- Seleção classificada no grupo (apareceu no top 2 ou nos 8 melhores 3º): **5 pts**
- Posição exata no grupo (1º/2º/3º acertado): **10 pts**
- Terceiro escolhido entre os 8 melhores reais: **8 pts**
- Acerto de seleção nas oitavas: **10 pts**
- Acerto nas quartas: **15 pts**
- Acerto na semi: **25 pts**
- Acerto de finalista: **40 pts**
- Acerto do campeão: **80 pts**

## 5. Edge functions

- `get-bolao` — devolve config pública + entry do usuário logado (sem `official_results` se antes do prazo).
- `submit-bolao` — valida entry completa, grava como `submitted`, idempotente.
- `score-bolao` (admin) — recalcula todas as pontuações.
- Reuso de `get-user-bets` pattern para autenticação por email+account_id.

## 6. Itens fora do escopo deste plano

- Premiação automática em coins (pode vir depois ligando a `prize_payments`).
- Chat / comentários no bolão.
- Múltiplos bolões simultâneos por owner (faço 1 por tag agora; multi-bolão depois).

---

## Decisões necessárias antes de implementar

1. **Seleções e grupos**: você quer que eu já deixe pré-cadastradas as 48 seleções dos prints (Grupo A–L) como seed inicial, ou prefere começar vazio e cadastrar tudo pelo admin?
2. **Acesso ao bolão**: o usuário precisa estar logado (mesmo email/account_id que usa nas apostas) para participar — ok?
3. **Cruzamentos do mata-mata**: uso o cruzamento padrão (1A×3C/D/E/F, 2A×2C, etc.) ou você quer definir manualmente quem cruza com quem no admin?
4. **Deadline**: edição bloqueada exatamente no `submission_deadline`, sem prorrogação automática — confirma?
