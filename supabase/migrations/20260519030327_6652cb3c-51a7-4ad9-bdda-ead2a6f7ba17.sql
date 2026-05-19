
-- 1) Add recurrence column
ALTER TABLE public.luckybox_cases
  ADD COLUMN IF NOT EXISTS claim_recurrence text NOT NULL DEFAULT 'none';

-- 2) Drop strict unique indexes (recurrence requires multiple historic claims)
DROP INDEX IF EXISTS public.luckybox_case_claims_case_email_uq;
DROP INDEX IF EXISTS public.luckybox_case_claims_case_account_uq;

CREATE INDEX IF NOT EXISTS luckybox_case_claims_case_email_idx
  ON public.luckybox_case_claims (case_id, lower(user_email), created_at DESC);
CREATE INDEX IF NOT EXISTS luckybox_case_claims_case_account_idx
  ON public.luckybox_case_claims (case_id, account_id, created_at DESC);

-- 3) Updated claim RPC with recurrence
CREATE OR REPLACE FUNCTION public.claim_luckybox_case(
  p_owner_id uuid,
  p_email text,
  p_account_id text,
  p_case_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user public.wheel_users%ROWTYPE;
  v_case public.luckybox_cases%ROWTYPE;
  v_email text := lower(btrim(p_email));
  v_account text := btrim(p_account_id);
  v_qty integer;
  v_grants jsonb;
  v_case_key text;
  v_current integer;
  v_new_count integer;
  v_last_claim timestamptz;
  v_interval interval;
  v_recurrence text;
  v_next_at timestamptz;
BEGIN
  IF v_email = '' OR v_account = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dados inválidos');
  END IF;

  SELECT * INTO v_case FROM public.luckybox_cases
  WHERE id = p_case_id AND owner_id = p_owner_id AND is_active = true
  FOR UPDATE;
  IF v_case.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Caixa indisponível');
  END IF;

  IF NOT COALESCE(v_case.claim_enabled, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Resgate desativado para esta caixa');
  END IF;

  IF v_case.claim_opens_at IS NOT NULL AND now() < v_case.claim_opens_at THEN
    RETURN jsonb_build_object('success', false, 'error', 'Resgate ainda não liberado', 'opens_at', v_case.claim_opens_at);
  END IF;
  IF v_case.claim_closes_at IS NOT NULL AND now() > v_case.claim_closes_at THEN
    RETURN jsonb_build_object('success', false, 'error', 'Resgate encerrado');
  END IF;

  SELECT * INTO v_user FROM public.wheel_users
  WHERE owner_id = p_owner_id
    AND (lower(btrim(email)) = v_email OR btrim(account_id) = v_account)
  ORDER BY updated_at DESC NULLS LAST LIMIT 1
  FOR UPDATE;
  IF v_user.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não encontrado');
  END IF;
  IF COALESCE(v_user.blacklisted, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conta bloqueada');
  END IF;

  v_recurrence := COALESCE(v_case.claim_recurrence, 'none');

  -- Última claim deste usuário (email OU account) nesta caixa
  SELECT MAX(created_at) INTO v_last_claim
  FROM public.luckybox_case_claims
  WHERE case_id = v_case.id
    AND (lower(user_email) = v_email OR account_id = v_account);

  IF v_last_claim IS NOT NULL THEN
    IF v_recurrence = 'none' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Você já resgatou esta caixa');
    END IF;

    v_interval := CASE v_recurrence
      WHEN 'daily' THEN interval '1 day'
      WHEN 'weekly' THEN interval '7 days'
      WHEN 'monthly' THEN interval '30 days'
      ELSE NULL
    END;

    IF v_interval IS NOT NULL AND v_last_claim + v_interval > now() THEN
      v_next_at := v_last_claim + v_interval;
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Aguarde para resgatar novamente',
        'next_available_at', v_next_at
      );
    END IF;
  END IF;

  v_qty := GREATEST(COALESCE(v_case.claim_quantity, 1), 1);

  INSERT INTO public.luckybox_case_claims (owner_id, case_id, wheel_user_id, user_email, account_id, quantity)
  VALUES (p_owner_id, v_case.id, v_user.id, COALESCE(v_user.email, p_email), COALESCE(v_user.account_id, v_account), v_qty);

  v_grants := COALESCE(v_user.case_grants, '{}'::jsonb);
  v_case_key := v_case.id::text;
  v_current := COALESCE((v_grants->>v_case_key)::integer, 0);
  v_new_count := v_current + v_qty;
  v_grants := jsonb_set(v_grants, ARRAY[v_case_key], to_jsonb(v_new_count), true);

  UPDATE public.wheel_users
  SET case_grants = v_grants, updated_at = now()
  WHERE id = v_user.id;

  -- Next available timestamp para feedback imediato
  v_next_at := CASE v_recurrence
    WHEN 'daily' THEN now() + interval '1 day'
    WHEN 'weekly' THEN now() + interval '7 days'
    WHEN 'monthly' THEN now() + interval '30 days'
    ELSE NULL
  END;

  RETURN jsonb_build_object(
    'success', true,
    'case_id', v_case.id,
    'quantity', v_qty,
    'case_grants', v_grants,
    'last_claim_at', now(),
    'next_available_at', v_next_at,
    'recurrence', v_recurrence
  );
END;
$$;

-- 4) RPC para buscar últimas claims do usuário (mapa case_id => last_claim_at)
CREATE OR REPLACE FUNCTION public.get_user_case_claims(
  p_owner_id uuid,
  p_email text,
  p_account_id text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_account text := btrim(coalesce(p_account_id, ''));
  v_result jsonb;
BEGIN
  IF v_email = '' AND v_account = '' THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_object_agg(case_id::text, last_at), '{}'::jsonb) INTO v_result
  FROM (
    SELECT case_id, MAX(created_at) AS last_at
    FROM public.luckybox_case_claims
    WHERE owner_id = p_owner_id
      AND (
        (v_email <> '' AND lower(user_email) = v_email)
        OR (v_account <> '' AND account_id = v_account)
      )
    GROUP BY case_id
  ) s;

  RETURN v_result;
END;
$$;

-- 5) Atualizar get_luckybox_page_by_tag pra retornar claim_recurrence
CREATE OR REPLACE FUNCTION public.get_luckybox_page_by_tag(p_tag text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cfg public.luckybox_configs%ROWTYPE;
  v_perm boolean;
  v_cases jsonb;
BEGIN
  SELECT * INTO v_cfg FROM public.luckybox_configs
  WHERE lower(tag) = lower(btrim(p_tag)) AND is_active = true LIMIT 1;

  IF v_cfg.id IS NULL THEN
    RETURN jsonb_build_object('config', null);
  END IF;

  SELECT COALESCE(luckybox, false) INTO v_perm
  FROM public.operator_permissions WHERE user_id = v_cfg.owner_id;

  IF NOT COALESCE(v_perm, false) THEN
    RETURN jsonb_build_object('config', null, 'disabled', true);
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'price_tokens', c.price_tokens,
    'image_url', c.image_url,
    'rarity', c.rarity,
    'mode', c.mode,
    'prize_type', COALESCE(c.prize_type, 'pix'),
    'prize_pool', c.prize_pool,
    'prizes', c.prizes,
    'claim_enabled', COALESCE(c.claim_enabled, false),
    'claim_opens_at', c.claim_opens_at,
    'claim_closes_at', c.claim_closes_at,
    'claim_quantity', COALESCE(c.claim_quantity, 1),
    'claim_recurrence', COALESCE(c.claim_recurrence, 'none')
  ) ORDER BY c.position, c.created_at), '[]'::jsonb) INTO v_cases
  FROM public.luckybox_cases c
  WHERE c.owner_id = v_cfg.owner_id AND c.is_active = true;

  RETURN jsonb_build_object(
    'config', jsonb_build_object(
      'id', v_cfg.id,
      'tag', v_cfg.tag,
      'tokens_symbol', v_cfg.tokens_symbol,
      'coin_name', v_cfg.coin_name,
      'coin_icon_url', v_cfg.coin_icon_url,
      'page_config', v_cfg.page_config,
      'owner_id', v_cfg.owner_id
    ),
    'cases', v_cases
  );
END;
$function$;
