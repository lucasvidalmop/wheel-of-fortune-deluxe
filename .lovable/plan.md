
# Sistema de Eventos de Gorjeta ao Vivo

Evolução da página de gorjeta atual (`/influencer`) para um sistema de **eventos**: você cria um evento para a live, divulga um link, o pessoal se inscreve dentro da janela de tempo, e você joga os mini games de cassino no palco pelos participantes. Quem for sorteado/vencer recebe o prêmio configurado.

## Conceito central

```text
EVENTO (live de 30/11, 20h–22h)
 ├── Link público  /evento=<tag>
 ├── Janela de inscrição (abre / fecha)
 ├── Participantes inscritos (novos + usuários já cadastrados)
 └── RODADAS (você dispara ao vivo, uma de cada vez)
      ├── Rodada 1 · Plinko     · prêmio: PIX
      ├── Rodada 2 · Roleta     · prêmio: giros
      └── Rodada 3 · Raspadinha · prêmio: coins
```

A mecânica é sempre: o sistema sorteia um participante (ou você escolhe) → você joga o mini game na tela → o resultado do jogo define se ganha e quanto → o prêmio é creditado automaticamente.

## 1. Página pública do evento (`/evento=<tag>`)

- Capa do evento, título, descrição e **contador regressivo** para abertura/fechamento das inscrições.
- Dois caminhos de entrada: cadastro rápido no evento (nome, e-mail, telefone, ID, CPF/PIX) **ou** login com e-mail + ID para quem já é da base.
- Depois de inscrito: tela "Você está participando", número de inscrição, e o feed ao vivo dos ganhadores conforme você joga.
- Estados: `agendado` → `inscrições abertas` → `ao vivo` → `encerrado`, cada um com tela própria.

## 2. Painel do host (novo `/evento-host` ou aba dentro da gorjeta atual)

- Lista de eventos com status e nº de inscritos.
- Criar/editar evento: nome, tag do link, capa, janela de inscrição, limite de participantes, texto de regras.
- **Palco ao vivo**: painel em tela cheia (pensado para compartilhamento de tela na live) com:
  - contador de inscritos em tempo real,
  - botão "Sortear participante",
  - seletor de mini game da rodada,
  - o jogo em si, em tamanho grande,
  - histórico de ganhadores da sessão com status de pagamento.
- Reaproveita o que já existe hoje: limite diário, probabilidade de prêmio, mínimo de ganhadores reais, participantes fantasma e envio automático de PIX.

## 3. Mini games (cassino)

Todos rodam no painel do host, com animação grande e som. Resultado calculado no backend (não dá para burlar) e depois animado na tela.

- **Plinko** — bolinha cai pela pirâmide de pinos até um slot de multiplicador. Multiplicadores e pesos configuráveis por rodada.
- **Roleta de prêmios** — reaproveita o componente de roleta já existente do sistema.
- **Raspadinha** — reaproveita o `ScratchCell` já existente.
- **Caça-níquel** — reaproveita a `BattleWheel`/slot já existente.

Começamos pelo **Plinko** (é o novo de verdade) e plugamos os outros três reusando componentes prontos. Cada rodada tem seu próprio prêmio: PIX automático, giros na roleta, coins/Luckybox ou caixa da Luckybox — **misto por game**, como você pediu.

## 4. Prêmios e pagamento

- PIX: mesma rota de hoje (`create_prize_payment` + EdPay, com pagamento automático quando ativado).
- Giros: incrementa os giros do usuário na roleta.
- Coins/Luckybox: credita saldo ou concede uma caixa.
- Tudo registrado com o evento e a rodada de origem, para relatório depois.

## 5. Tempo real

Os inscritos veem o contador de participantes e o feed de ganhadores atualizando ao vivo (realtime do banco). Não precisam interagir — só assistir e torcer, que é exatamente o formato que você descreveu.

## Detalhes técnicos

**Novas tabelas**
- `gorjeta_events` — dono, tag, nome, capa, config visual, abertura/fechamento das inscrições, status, limite de inscritos.
- `gorjeta_event_participants` — vínculo evento ↔ usuário da roleta, origem (novo cadastro ou login), nº de inscrição, flag de já premiado.
- `gorjeta_event_rounds` — evento, tipo de mini game, config do jogo (multiplicadores/pesos), tipo e valor do prêmio, status.
- `gorjeta_event_results` — rodada, participante, resultado do jogo, prêmio ganho, referência do pagamento.

Todas com RLS por `owner_id` (operador gerencia as suas) + leitura pública restrita do que o evento precisa expor, via função `security definer` — mesmo padrão de `get_referral_page_data`.

**Edge Functions**
- `get-event-page` — dados públicos do evento por tag.
- `join-event` — inscrição (cria/reaproveita `wheel_users`, valida janela e limite).
- `play-event-round` — sorteia o participante, roda a lógica do jogo no servidor, grava o resultado e dispara o prêmio.

**Frontend**
- `src/pages/GorjetaEvent.tsx` (público) e `src/pages/GorjetaEventHost.tsx` (palco).
- `src/components/gorjeta/games/Plinko.tsx` — novo, com física simples em canvas.
- Rota `/evento=<tag>` adicionada ao `SlugRouter`.
- A página `/influencer` atual continua funcionando como está; o sistema de eventos é uma camada nova ao lado dela.

## Entrega sugerida em fases

1. Evento + inscrição + página pública + painel de criação.
2. Palco ao vivo com sorteio de participante e Plinko + prêmio PIX.
3. Demais mini games e demais tipos de prêmio.
4. Realtime no feed público e relatório do evento.

Quer que eu siga por aqui, começando pela fase 1?
