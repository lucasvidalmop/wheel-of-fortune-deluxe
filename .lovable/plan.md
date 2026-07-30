## Sistema de Sorteio ao Vivo (Live Draw)

Novo módulo de sorteio para participantes da live, aproveitando as tabelas `gorjeta_events*` que já existem no banco mas ainda não têm código.

### Como vai funcionar

**1. Você cria o evento (dashboard do operador)**
- Nome, descrição e regras do evento
- Data/hora de **abertura** e de **fechamento** das inscrições
- **Valor da gorjeta** (prêmio por ganhador, em R$)
- **Quantidade de premiados** (X ganhadores)
- Limite máximo de participantes (opcional)
- Capa, cores e textos da página pública
- Ativar/desativar e link público com tag (ex.: `/sorteio/live-natal`)

**2. O participante entra (página pública)**
- Entra com **E-mail + ID da conta** (mesma sessão do lobby, sem pagar nada)
- Se ainda não tem conta, botão para cadastro que retorna ao evento
- **Uma entrada por IP** — o sistema bloqueia a segunda tentativa do mesmo IP
- Só aceita inscrição dentro da janela de horário; antes mostra contagem regressiva, depois mostra "inscrições encerradas"
- Depois de inscrito vê seu número de participação e a lista/contador de inscritos

**3. Você sorteia ao vivo**
- Tela de sorteio no dashboard com a lista de inscritos
- Botão "Sortear próximo" — anima e revela um ganhador por vez, até completar os X premiados
- Ninguém é sorteado duas vezes
- Cada ganhador aparece também na página pública em tempo real, para quem está assistindo

**4. Pagamento PIX automático**
- Ao ser sorteado, o sistema cria o pagamento do valor da gorjeta para a chave PIX cadastrada do ganhador e dispara via EdPay, igual ao fluxo já existente de prêmios
- Se o ganhador não tiver chave PIX, o pagamento fica pendente no financeiro para você resolver manualmente
- Todos os ganhadores e status de pagamento ficam registrados no histórico do evento

### Detalhes técnicos

- **Banco**: reutilizar `gorjeta_events` (adicionar `prize_amount`, `winners_count`), `gorjeta_event_participants` (adicionar `ip_address` + índice único por evento+IP) e `gorjeta_event_results`. Revisar RLS: leitura pública do evento via função, escrita apenas por edge function.
- **Edge functions**:
  - `get-live-event` (pública, por tag): retorna config, janela, contadores e ganhadores já sorteados
  - `join-live-event` (pública): valida janela, sessão E-mail+ID, captura IP do header e grava a inscrição de forma idempotente
  - `draw-live-winner` (autenticada, operador): sorteia 1 ganhador dentro de uma transação, grava resultado e chama `create_prize_payment` para o PIX
- **Frontend**:
  - `src/pages/LiveDraw.tsx` — página pública do evento (mobile-first, mesmo padrão visual do lobby)
  - `src/components/casino/LiveDrawPanel.tsx` — painel do operador: criar/editar eventos, ver inscritos, conduzir o sorteio, histórico de ganhadores e pagamentos
  - Nova aba no dashboard + permissão de operador correspondente
  - Atualização em tempo real (realtime na tabela de resultados) para a página pública

### Observação sobre "1 por IP"

Bloqueio por IP funciona bem contra inscrições repetidas casuais, mas quem estiver na mesma rede (casa, empresa, Wi-Fi público) compartilha o mesmo IP e só o primeiro conseguirá entrar. Vou combinar **IP + ID da conta**: bloqueia o mesmo ID sempre, e o mesmo IP por padrão — com um interruptor no evento para desligar a trava de IP caso você veja bloqueios indevidos durante a live.
