# Sorteio ao Vivo por Eventos

## 1. O que já existe e será reutilizado

| Recurso existente | Como será usado |
|---|---|
| `wheel_users` (contas da Gorjeta: email + account_id) | Validação da inscrição — nenhum sistema de auth novo |
| `lobbySession.ts` + `LobbySession` | Autopreenchimento de e-mail/ID quando o usuário já está logado no lobby |
| `LobbyShell` / `LobbyHeader` / `LobbyBottomNav` / `LobbyPromoCard` | Card "Sorteio ao Vivo" no lobby e visual do módulo embutido |
| Roteamento por prefixo em `App.tsx` (`luckybox=`, `odds=`, `lobby=`) | Novos prefixos `sorteio=` (página pública) e `live=` (tela de OBS) |
| Padrão de Edge Function pública (`get-lobby-page`) com service role | Leitura pública do evento e inscrição sem expor tabelas |
| `operator_permissions.sorteio` (coluna **já existe**, ainda sem UI) | Nova aba no Dashboard respeitando a permissão |
| `owner_id` + RLS multi-operador, `set_updated_at()`, triggers padrão | Mesmo modelo nas tabelas novas |
| `track-pageview` / `log-registration-update` (IP, UA, geo) | Mesma técnica de coleta de sinais para o antifraude |
| Realtime Postgres (`supabase.channel`, já usado em `Batalha.tsx`) | Participantes, status e resultado ao vivo |
| `useConfirmDialog`, `sonner`, tokens de tema, Bebas Neue/Barlow | Confirmações, toasts e identidade visual |

Roleta, Luckybox, Apostas, Batalha, Bolão e Gorjeta não serão alterados.

## 2. Banco de dados (nova migração)

- `raffle_events` — owner_id, tag (slug público), nome, descrição, banner_url, regulamento, prêmio, signup_url, min_participants, max_participants (opcional), winners_count, opens_at, closes_at, draw_at, status (`draft|scheduled|open|closed|live|finished|cancelled`), theme jsonb, messages jsonb, locked_at, locked_count, is_active.
- `raffle_participants` — event_id, owner_id, wheel_user_id, account_id, email, display_name, public_code (único no evento), status (`approved|review|blocked`), flags jsonb, ip_address, user_agent, device/os/browser, city/region/country, session_fingerprint, internal_note, reviewed_by, reviewed_at.
- `raffle_draws` — event_id, owner_id, round, participants_snapshot_count, winners jsonb (nome mascarado, código, participant_id), executed_by, executed_at, redraw_reason, superseded.
- `raffle_restrictions` — lista de restrição **por evento** (email/account_id/ip), motivo, autor.
- `raffle_attempts` — histórico de tentativas por e-mail/IP (rate limit + auditoria).

Todas com `GRANT` explícito e RLS por `owner_id`; o público acessa apenas via Edge Functions com service role. `raffle_events` e `raffle_participants` entram na publicação de realtime.

## 3. Arquivos criados

**Edge Functions**
- `get-raffle-event` — dados públicos do evento + contagem de aprovados (sem PII).
- `join-raffle` — valida a conta na Gorjeta, coleta sinais, aplica antifraude, grava participante e devolve o código público.
- `run-raffle-draw` — autenticada; trava a lista, sorteia com `crypto.getRandomValues`, grava `raffle_draws`; refazer exige justificativa e cria nova rodada.
- `manage-raffle` — ações do operador (aprovar/bloquear/remover/observação/restrições/exportar), com checagem de `owner_id` e da permissão `sorteio`.

**Frontend público**
- `src/pages/Sorteio.tsx` (mobile-first) e `src/pages/SorteioLive.tsx` (OBS).
- `src/components/raffle/`: `RaffleHero`, `RaffleCountdown`, `RaffleProgress`, `RaffleJoinForm`, `RaffleTicket`, `RaffleRules`, `RaffleResult`, `RaffleShare` (QR + link curto), `RaffleRollAnimation` (suspense, revelação, confetes).
- `src/lib/raffle.ts` (tipos, máscara de nome/ID, fingerprint) e `src/hooks/useRaffleRealtime.ts`.

**Painel do operador**
- `RafflePanel.tsx` (lista, indicadores, ações de status), `RaffleEventEditor.tsx` (todos os campos + duplicar), `RaffleParticipants.tsx` (busca, filtros, aprovar/bloquear/remover, exportar CSV), `RaffleSecurityReview.tsx` (Análise de Segurança + lista de restrição), `RaffleDrawControl.tsx` (iniciar, confirmar, publicar, refazer com justificativa, histórico).

## 4. Arquivos existentes alterados (mínimo)

- `src/App.tsx` — rotas `sorteio=<tag>` e `live=<tag>`.
- `src/pages/Dashboard.tsx` — aba `sorteio` no grupo Operação, protegida por `permissions.sorteio`.
- `supabase/functions/manage-operator-permissions/index.ts` — incluir `"sorteio"` em `TOOL_KEYS`.
- `LobbyPromoCard` / `LobbyHome` / `src/pages/Lobby.tsx` — nova `ProductKey` `sorteio` reaproveitando a sessão.
- `src/components/casino/LobbyPanel.tsx` — habilitar/ordenar o card.
- `supabase/config.toml` — `verify_jwt = false` nas funções públicas.

## 5. Fluxo do participante

1. Abre `/sorteio=<tag>` (ou pelo card do lobby).
2. Vê banner, prêmio, contagem regressiva, progresso da meta e regulamento.
3. Toca em **Participar** → e-mail, ID, nome/apelido e aceite (pré-preenchidos se houver sessão).
4. Backend valida a conta em `wheel_users` do operador. Sem conta → botão **Criar minha conta** com o link do evento; ao voltar, a inscrição é retomada.
5. Antifraude define `approved`, `review` (mensagem neutra) ou `blocked` silencioso.
6. Confirmação com código público, nome do evento, data/hora e status.
7. Realtime atualiza contagem, status, encerramento e resultado sem recarregar.

## 6. Fluxo do operador

Criar → editar/duplicar → publicar → abrir/pausar inscrições → acompanhar indicadores e Análise de Segurança → encerrar inscrições (trava a lista, registra contagem e horário) → **Ao vivo** (`/live=<tag>` no OBS) → confirmar e executar o sorteio → publicar resultado → opcionalmente refazer com justificativa registrada. Ações relevantes ficam em log de auditoria no padrão do projeto.

## 7. Regras de validação e segurança

- A conta precisa existir em `wheel_users` do mesmo `owner_id` (e-mail + ID conferem).
- Duplicidade dura (mesmo ID ou e-mail no evento) → recusa educada.
- Sinais que levam à análise (nunca só o IP): IP repetido, fingerprint/sessão repetida, muitas tentativas em pouco tempo, dados inconsistentes, e-mail/ID em restrição, conta com `blacklisted`.
- Score: 1 sinal fraco → aprovada; 2+ ou sinal forte → em análise; restrição explícita → bloqueada.
- O usuário nunca vê o motivo técnico — só a mensagem neutra.
- O sorteio só habilita com `aprovados >= min_participants` e lista travada.
- A tela de live nunca expõe e-mail completo, IP ou dados internos.

## 8. Wireframe textual

**Página pública (mobile)**
```text
┌──────────────────────────────┐
│  [banner do evento]          │
│  AO VIVO • encerra em 02:14  │
├──────────────────────────────┤
│  NOME DO SORTEIO             │
│  descrição curta             │
│  Prêmio: R$ 500 PIX x3       │
├──────────────────────────────┤
│  01d 04h 22m 10s             │
│  Participantes  312 / 500    │
│  [■■■■■■■■□□□□□□]  62%       │
├──────────────────────────────┤
│  [   PARTICIPAR AGORA   ]    │
├──────────────────────────────┤
│  Sorteio: 12/08 às 20h       │
│  > Regulamento               │
│  > QR Code + link do evento  │
└──────────────────────────────┘
```

**Tela de live (OBS, 16:9)**
```text
┌────────────────────────────────────────┐
│ LOGO      SORTEIO DA GORJETA    ● LIVE │
│                                        │
│   ██  ROLANDO...  ██   (nomes girando) │
│                                        │
│   VENCEDOR: JO*** S.    #GRJ-8F3K      │
│   20:14:07 • 312 participantes válidos │
│                                        │
│ [meta 100%] [QR code] [ INICIAR ]      │
└────────────────────────────────────────┘
```

**Painel do operador**
```text
Sorteio > [Eventos] [Participantes] [Análise de Segurança] [Sorteio/Resultado]
Indicadores: inscrições · aprovados · análise · bloqueados · meta %
Tabela: busca + filtro de status + ações em lote + exportar CSV
```

## 9. Ordem de implementação

Migração → Edge Functions → página pública e tela de live → painel do operador → integração no lobby e permissões → verificação em viewport mobile.
