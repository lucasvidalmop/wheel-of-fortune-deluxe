## Visão geral

Criar uma página pública de atualização de cadastro idêntica visualmente à página de Gorjeta. Cada operador terá sua própria URL `/atualizar=tag` (onde `tag` é o `slug` da gorjeta) e controla, no Dashboard, **quais campos** do cadastro podem ser editados pelo participante.

O participante se identifica por **e-mail + ID da conta** (mesmo padrão da auth da roleta), e os campos liberados são gravados diretamente em `wheel_users` (sobrescreve o cadastro).

## O que muda

### 1. Roteamento
- Nova rota `/:slug` capturada por `SlugRouter` quando começar com `atualizar=` → renderiza `<UpdateRegistration tag={...} />`.

### 2. Nova página `src/pages/UpdateRegistration.tsx`
- Clone do `Registration.tsx` (mesmo `bgStyle`, `cardBg`, `accentColor`, header, footer, termos, CTA — reaproveita o `GorjetaPageConfig` existente do operador para herdar 100% do visual).
- **Fluxo:**
  1. Tela 1 — Identificação: campos E-mail + ID da Conta + botão "Buscar cadastro".
  2. Tela 2 — Edição: mostra apenas os campos habilitados pelo operador, pré-preenchidos com os dados atuais; botão "Atualizar".
  3. Tela 3 — Sucesso: mensagem configurável (reutiliza `successTitle`/`successSubtitle` ou específicos da atualização).

### 3. Configuração por operador (Dashboard)
- Nova aba dentro do menu **Gorjeta**: `✏️ Atualização` (entre "Visual Influencer" e "SEO").
- Componente novo `src/components/casino/UpdatePageEditor.tsx` salvando em `wheelConfig.updatePageConfig`:
  - `enabled` (boolean) — liga/desliga a página pública
  - `fields`: `{ name, phone, cpf, accountId, pixKey }` cada um boolean (o e-mail é sempre a chave de identificação e nunca é editável)
  - `titleText`, `subtitleText`, `btnText`, `successTitle`, `successSubtitle`, `notFoundText`
- A URL gerada é exibida com botão de copiar/QR (mesmo padrão da aba Link da gorjeta).

### 4. Backend
- **Edge function `get-update-page`** (público): recebe `tag` (slug), retorna `{ wheelSlug, ownerId, updatePageConfig, gorjetaPageConfig, gorjetaSeo, casinoName, enabled }`. Sem autenticação.
- **RPC `update_wheel_user_self(p_owner_id, p_email, p_account_id, p_name, p_phone, p_cpf, p_pix_key, p_pix_key_type, p_allowed_fields jsonb)`** `SECURITY DEFINER`:
  - Localiza o usuário em `wheel_users` por `(owner_id, email, account_id)`.
  - Atualiza somente os campos presentes em `p_allowed_fields` (defesa server-side caso o front mande além do permitido).
  - Retorna `{ success, error? }`.
- Sem alteração nas RLS atuais; a RPC bypassa via `SECURITY DEFINER`.

### 5. Tracking
- `track-pageview` com `page_type: 'update_registration'` (mesmo padrão da gorjeta).

## Detalhes técnicos

- A `tag` da URL é igual ao `wheel_configs.slug` (1 por operador), garantindo escopo único por operador, sem precisar de nova tabela.
- A página de identificação respeita `accountIdMode` ('numeric' vs 'text') do `gorjetaPageConfig`.
- Se nenhum campo estiver habilitado ou `enabled=false`, a página exibe "Atualização indisponível" com o mesmo card visual.
- Validações reaproveitam os mesmos `maskPhone`/`maskCpf`/`maskCnpj`/`PIX_TYPES` de Registration (extrair para `src/lib/formMasks.ts` para evitar duplicação).

## Diagrama do fluxo

```text
[/atualizar=tag] -> get-update-page(tag) -> { config, fields liberados }
       |
       v
[Tela 1: e-mail + ID]
       |
       v
update_wheel_user_self (busca → confirma → mostra Tela 2)
       |
       v
[Tela 2: campos liberados editáveis]
       |
       v
update_wheel_user_self (grava só campos permitidos) -> [Tela 3 sucesso]
```

## Fora de escopo
- Não altera `referral_redemptions` (a fonte de verdade do cadastro é `wheel_users`).
- Não envia notificação ao operador (pode ser feito depois reaproveitando `send-owner-notification`).
- Não permite trocar e-mail nem ID da conta (são chaves de identificação).
