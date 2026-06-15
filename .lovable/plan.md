## Objetivo

Transformar o lobby (`/g=:tag`) em uma SPA: o usuário faz login uma única vez (e-mail + ID da conta, padrão atual do sistema), a sessão persiste em `localStorage`, e ele navega entre Apostas / Roleta / Batalha / Luckybox sem trocar de rota nem precisar logar novamente.

## 1. Sessão única do lobby

Criar `src/lib/lobbySession.ts` com:
- Chave única `gorjeta_session_v1` em `localStorage` contendo `{ wheel_user_id, account_id, email, name, lobby_tag, signed_in_at }`.
- Funções `getLobbySession()`, `setLobbySession()`, `clearLobbySession()`, hook `useLobbySession()`.
- A sessão é global ao lobby (não por-tag), então qualquer promoção dentro do lobby reconhece o mesmo usuário.

Autenticação reaproveita a RPC `authenticate_wheel_user` (já usada por Roleta/Bets/Luckybox), que valida `p_email + p_account_id`.

## 2. Novo `src/pages/Lobby.tsx` como shell SPA

Estrutura interna por estado, sem react-router para sub-views:

```text
Lobby (shell)
 ├─ Header persistente (logo, nome do usuário, botão Sair)
 ├─ view = 'login'   → <LobbyLogin />            (email + ID + "Clique aqui para se inscrever")
 ├─ view = 'home'    → grid de cards atuais
 ├─ view = 'apostas' → <BetsView embedded />
 ├─ view = 'roleta'  → <RoletaView embedded />
 ├─ view = 'batalha' → <BatalhaView embedded />
 └─ view = 'luckybox'→ <LuckyboxView embedded />
```

Regras:
- Ao montar: tenta restaurar sessão do `localStorage`. Se inválida (RPC falha) → `view = 'login'`. Se válida → `view = 'home'`.
- Cards do lobby disparam `setView('apostas' | ...)` em vez de navegar.
- Botão "Voltar ao lobby" sempre visível dentro das sub-views.
- Se a sub-view tentar checar auth e não houver sessão → volta automaticamente para `view = 'login'`.

## 3. Tela de login do lobby

Componente novo `src/components/lobby/LobbyLogin.tsx`:
- Campos: **E-mail** e **ID da conta** (mesmo padrão das outras telas).
- Botão "Entrar" → chama `authenticate_wheel_user` → salva sessão única → `view = 'home'`.
- Link grande: **"Ainda não tem conta? Clique aqui para se inscrever"** → navega para `/registration?return=lobby:<tag>` (rota nova querystring).

## 4. Retorno do cadastro para o lobby

Editar `src/pages/Registration.tsx`:
- Ler `?return=lobby:<tag>` da URL.
- Após cadastro bem-sucedido, se `return` for `lobby:*`, redirecionar para `/g=<tag>` em vez do destino padrão.
- O lobby, ao carregar com sessão já criada pelo fluxo de cadastro (se aplicável), entra direto. Caso contrário mostra a tela de login com o e-mail pré-preenchido via querystring `?email=` (opcional).

## 5. Refatorar as 4 páginas em "views embarcáveis"

Para cada uma das páginas, extrair o conteúdo atual em um componente `*View` que aceita props `{ embedded?: boolean; session: LobbySession; tag: string; onExitToLobby: () => void }`. As rotas standalone (`/odds=:tag`, `/<roletaTag>`, `/luckybox=:tag`, `/batalha`) continuam funcionando, agora apenas montando a mesma view com `embedded={false}` e usando o próprio fluxo de login.

Quando `embedded=true`:
- Pulam a própria tela de login (usam a `session` recebida).
- Pulam `LobbyHomeButton` próprio (o shell já tem header).
- Não escrevem em `sessionStorage` específico — usam a sessão única do lobby.

Páginas afetadas:
- `src/pages/Bets.tsx` → extrai `BetsView`.
- `src/pages/Roleta.tsx` → extrai `RoletaView`.
- `src/pages/Luckybox.tsx` → extrai `LuckyboxView`.
- `src/pages/Batalha.tsx` → **caso especial**: hoje usa `supabase.auth.signInWithPassword` (admin). No contexto do lobby, Batalha vira read-only/participante usando a sessão de `wheel_user` (sem acesso admin). Confirmar se isso atende ou se a Batalha embarcada deve apenas mostrar status/inscrição.

## 6. Persistência e logout

- `localStorage` (não `sessionStorage`) garante que fechar e abrir o navegador mantém o login.
- Botão "Sair" no header chama `clearLobbySession()` e volta para `view = 'login'`.
- Se qualquer RPC dentro de uma sub-view responder com erro de autenticação → `clearLobbySession()` + voltar pro login.

## 7. Detalhes técnicos

- Manter `App.tsx` com a rota `/g=:tag` existente apontando para o novo `Lobby`.
- `useLobbySession` expõe `session, signIn, signOut, refresh`.
- Nenhuma mudança de schema. Nenhuma edge function nova.
- Tradução PT-BR já existente continua valendo (footballTranslations).

## Ponto que precisa de confirmação antes de eu começar

**Batalha embarcada**: a página `/batalha` atual exige login admin (`signInWithPassword`). Faz sentido que, dentro do lobby, ela apareça apenas como visualização da batalha em andamento + inscrição do usuário, sem o painel admin? Ou prefere que o card "Batalha" no lobby simplesmente abra a `/batalha` em nova aba até definirmos esse fluxo?
