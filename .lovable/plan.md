
# Redesign Mobile-First do Lobby da Gorjeta

Reformulação completa do lobby para parecer um app nativo no celular, com SPA real, sessão persistente e todas as promoções (Roleta, Batalha, Luckybox, Apostas) acessíveis sob um único login.

## 1. Sessão e autenticação (uma vez só)

- Persistir sessão em `localStorage` (em vez de `sessionStorage`) com chave única `gorjeta_lobby_session`.
- Hidratar a sessão no boot do `Lobby` antes de decidir entre login/home — sem flicker para a tela de login quando já está logado.
- Manter a RPC `authenticate_wheel_user` atual (e-mail + ID).
- Logout só por ação manual (botão Sair) ou quando a RPC rejeitar a sessão.
- Mesma sessão é injetada nos módulos embutidos (Roleta, Bets, Luckybox) via `LobbyEmbedProvider` — nenhum deles pede login de novo.
- Botão "Inscrever-se" abre a página de cadastro da Gorjeta (URL configurável) com parâmetro `return=lobby:<tag>`; o cadastro existente já redireciona de volta.

## 2. SPA real — sem trocar de rota

- `Lobby.tsx` mantém um `view` interno: `'home' | 'roleta' | 'apostas' | 'luckybox' | 'perfil' | 'batalha'`.
- Trocar de view NÃO altera a URL nem desmonta o container — só troca o conteúdo central.
- Pré-carregar (`prefetch`) os bundles lazy das views logo após o login, para a primeira transição já ser instantânea.
- Batalha continua abrindo a página de depósito do operador em nova aba (regra já definida).

## 3. Arquitetura mobile-first

Estrutura do shell em todas as telas:

```text
┌──────────────────────────────┐
│ Header fixo (logo • coins • avatar)
├──────────────────────────────┤
│                              │
│   Conteúdo da view ativa     │
│   (rolável)                  │
│                              │
├──────────────────────────────┤
│ Bottom Nav fixo (Home • Promos • Perfil)
└──────────────────────────────┘
```

- Larguras: tudo em `w-full max-w-[480px] mx-auto` no mobile e expande para `max-w-6xl` no desktop usando breakpoints (`sm`, `md`, `lg`).
- `safe-area-inset` para iPhone (notch + home indicator).
- Padding base `px-4` no mobile, `px-8` no desktop. Sem margens exageradas.

## 4. Novas telas / componentes

Tudo dentro de `src/components/lobby/`:

- `LobbyShell.tsx` — wrapper com header + bottom nav + safe-area + tema do operador.
- `LobbyHeader.tsx` — logo da Gorjeta + nome do usuário + coins + botão de perfil.
- `LobbyBottomNav.tsx` — 3 abas (Início, Promoções, Perfil), fixa no rodapé do mobile, vira sidebar discreta no desktop.
- `LobbyHome.tsx` — saudação curta + carrossel de destaque + lista de cards grandes.
- `LobbyPromoCard.tsx` — card grande com imagem, nome, descrição, badge e botão "Acessar". Toque com `active:scale-[0.98]`.
- `LobbyProfile.tsx` — dados do usuário, ID da conta, botão "Sair".
- `LobbyLogin.tsx` — já existe, será simplificado para alinhar com o novo shell e ganhar estado de "carregando sessão" para evitar flicker.

## 5. Tema do operador

Continuar consumindo `pageConfig.theme` + `pageConfig.login` (sistema de configuração visual já criado no painel). O novo shell aplica:

- `--lobby-primary`, `--lobby-bg`, `--lobby-text`, `--lobby-font-heading`, `--lobby-font-body` no container raiz.
- Bottom nav, header e cards usam esses tokens — operador customiza tudo de um lugar só.

## 6. Auditoria de responsividade

Antes de fechar, testar manualmente cada view nos breakpoints 320, 360, 375, 390, 412, 430, 768, 820, 1024, 1280, 1440, 1920:

- Login
- Home do lobby
- Roleta embutida
- Luckybox embutido
- Apostas embutidas
- Perfil
- Modais e formulários internos das views

Critérios obrigatórios (zero ocorrências):
- Sem scroll horizontal (`overflow-x: hidden` no shell + auditoria visual).
- Sem texto/botão cortado.
- Sem componente saindo da viewport.
- Modais sempre com `max-h-[90vh]` e scroll interno.

## 7. Performance

- Lazy-load real das views (`React.lazy` + `Suspense`) — já existe, manter.
- `prefetch` no hover/após login para reduzir latência da primeira troca.
- Memoizar `cards`, `theme`, `productMeta`.
- Imagens com `loading="lazy"` e `optimizedImage` (já em uso).
- Evitar re-renderizar o shell quando só a view interna muda — `LobbyShell` recebe `children` e nada mais.

## Arquivos afetados

**Novos**
- `src/components/lobby/LobbyShell.tsx`
- `src/components/lobby/LobbyHeader.tsx`
- `src/components/lobby/LobbyBottomNav.tsx`
- `src/components/lobby/LobbyHome.tsx`
- `src/components/lobby/LobbyPromoCard.tsx`
- `src/components/lobby/LobbyProfile.tsx`

**Editados**
- `src/pages/Lobby.tsx` — passa a apenas orquestrar `view` + sessão e renderizar o shell.
- `src/components/lobby/LobbyLogin.tsx` — encaixa no novo shell, sem flicker.
- `src/lib/lobbySession.ts` — migra para `localStorage` mantendo retrocompat com `sessionStorage`.
- `src/index.css` — utilitários `safe-area`, `lobby-tap` (feedback de toque), classes de tipografia do tema.

## Fora do escopo desta entrega

- Não vou refazer o visual interno de Roleta / Bets / Luckybox / Batalha — eles ficam dentro do shell e herdam o tema, mas o redesign dos jogos em si é outra task. Posso atacar um por vez depois, na ordem que você preferir.
- Painel de configuração no dashboard fica como está (já tem cores, fontes, textos do login).

Quer que eu siga assim?
