
-- Add case_grants column to wheel_users to store free case openings { case_id: count }
ALTER TABLE public.wheel_users
ADD COLUMN IF NOT EXISTS case_grants jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Create grants table
CREATE TABLE IF NOT EXISTS public.luckybox_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  case_id uuid NOT NULL,
  case_name text NOT NULL DEFAULT '',
  wheel_user_id uuid,
  recipient_name text NOT NULL DEFAULT '',
  recipient_phone text NOT NULL DEFAULT '',
  recipient_email text NOT NULL DEFAULT '',
  recipient_account_id text NOT NULL DEFAULT '',
  code text NOT NULL UNIQUE,
  quantity integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending', -- pending | redeemed | cancelled
  redeemed_at timestamptz,
  whatsapp_status text NOT NULL DEFAULT 'not_sent', -- not_sent | sent | error
  whatsapp_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_luckybox_grants_owner ON public.luckybox_grants(owner_id);
CREATE INDEX IF NOT EXISTS idx_luckybox_grants_user ON public.luckybox_grants(wheel_user_id);
CREATE INDEX IF NOT EXISTS idx_luckybox_grants_code ON public.luckybox_grants(code);

ALTER TABLE public.luckybox_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read own luckybox_grants"
ON public.luckybox_grants FOR SELECT TO authenticated
USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners insert own luckybox_grants"
ON public.luckybox_grants FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners update own luckybox_grants"
ON public.luckybox_grants FOR UPDATE TO authenticated
USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners delete own luckybox_grants"
ON public.luckybox_grants FOR DELETE TO authenticated
USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages luckybox_grants"
ON public.luckybox_grants FOR ALL TO public
USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER touch_luckybox_grants_updated_at
BEFORE UPDATE ON public.luckybox_grants
FOR EACH ROW EXECUTE FUNCTION public.touch_luckybox_updated_at();

-- Function: redeem a grant code
CREATE OR REPLACE FUNCTION public.redeem_luckybox_grant(
  p_owner_id uuid,
  p_account_id text,
  p_email text,
  p_code text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grant public.luckybox_grants%ROWTYPE;
  v_user public.wheel_users%ROWTYPE;
  v_grants jsonb;
  v_current integer;
  v_case_key text;
BEGIN
  SELECT * INTO v_grant FROM public.luckybox_grants
  WHERE upper(btrim(code)) = upper(btrim(p_code))
    AND owner_id = p_owner_id
  FOR UPDATE;

  IF v_grant.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Código inválido');
  END IF;

  IF v_grant.status = 'redeemed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Código já utilizado');
  END IF;

  IF v_grant.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Código cancelado');
  END IF;

  -- Find user by account_id and email (matching login flow)
  SELECT * INTO v_user FROM public.wheel_users
  WHERE owner_id = p_owner_id
    AND btrim(account_id) = btrim(p_account_id)
    AND lower(btrim(email)) = lower(btrim(p_email))
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1
  FOR UPDATE;

  IF v_user.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conta não encontrada para este código');
  END IF;

  -- If grant was tied to a specific user, ensure it matches
  IF v_grant.wheel_user_id IS NOT NULL AND v_grant.wheel_user_id <> v_user.id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este código não é seu');
  END IF;

  -- Credit case_grants
  v_grants := COALESCE(v_user.case_grants, '{}'::jsonb);
  v_case_key := v_grant.case_id::text;
  v_current := COALESCE((v_grants->>v_case_key)::integer, 0);
  v_grants := jsonb_set(v_grants, ARRAY[v_case_key], to_jsonb(v_current + GREATEST(v_grant.quantity, 1)), true);

  UPDATE public.wheel_users
  SET case_grants = v_grants, updated_at = now()
  WHERE id = v_user.id;

  UPDATE public.luckybox_grants
  SET status = 'redeemed',
      redeemed_at = now(),
      wheel_user_id = COALESCE(wheel_user_id, v_user.id),
      updated_at = now()
  WHERE id = v_grant.id;

  RETURN jsonb_build_object(
    'success', true,
    'case_id', v_grant.case_id,
    'case_name', v_grant.case_name,
    'quantity', v_grant.quantity,
    'case_grants', v_grants
  );
END;
$$;

-- Update open_luckybox_case to consume from case_grants (free) when available
CREATE OR REPLACE FUNCTION public.open_luckybox_case(p_owner_id uuid, p_account_id text, p_case_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user public.wheel_users%ROWTYPE;
  v_case public.luckybox_cases%ROWTYPE;
  v_prizes jsonb;
  v_prize jsonb;
  v_prize_index integer;
  v_total_weight numeric := 0;
  v_pick numeric;
  v_acc numeric := 0;
  v_i integer;
  v_pool jsonb;
  v_amount numeric := 0;
  v_payment jsonb;
  v_payment_id uuid;
  v_opening_id uuid;
  v_scratch_prizes jsonb;
  v_scratch_prize jsonb := NULL;
  v_scratch_index integer := NULL;
  v_resolved_prize jsonb;
  v_resolved_label text;
  v_grants jsonb;
  v_case_key text;
  v_grant_count integer;
  v_used_grant boolean := false;
  v_new_tokens integer;
BEGIN
  SELECT * INTO v_user FROM public.wheel_users
  WHERE owner_id = p_owner_id AND btrim(account_id) = btrim(p_account_id)
  ORDER BY updated_at DESC NULLS LAST LIMIT 1
  FOR UPDATE;

  IF v_user.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não encontrado');
  END IF;

  IF COALESCE(v_user.blacklisted, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conta bloqueada');
  END IF;

  SELECT * INTO v_case FROM public.luckybox_cases
  WHERE id = p_case_id AND owner_id = p_owner_id AND is_active = true
  FOR UPDATE;

  IF v_case.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Caixa indisponível');
  END IF;

  -- Check granted (free) cases first
  v_grants := COALESCE(v_user.case_grants, '{}'::jsonb);
  v_case_key := v_case.id::text;
  v_grant_count := COALESCE((v_grants->>v_case_key)::integer, 0);

  IF v_grant_count > 0 THEN
    v_used_grant := true;
  ELSIF COALESCE(v_user.tokens_balance, 0) < v_case.price_tokens THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tokens insuficientes');
  END IF;

  v_prizes := COALESCE(v_case.prizes, '[]'::jsonb);
  IF jsonb_typeof(v_prizes) <> 'array' OR jsonb_array_length(v_prizes) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Caixa sem prêmios configurados');
  END IF;

  IF v_case.mode = 'pool' THEN
    v_pool := COALESCE(v_case.prize_pool, 'null'::jsonb);
    IF v_pool IS NULL OR v_pool = 'null'::jsonb OR jsonb_array_length(v_pool) = 0 THEN
      v_pool := '[]'::jsonb;
      FOR v_i IN 0..(jsonb_array_length(v_prizes) - 1) LOOP
        DECLARE v_count integer;
        BEGIN
          v_count := GREATEST(COALESCE(NULLIF(v_prizes->v_i->>'count', '')::integer, 0), 0);
          IF v_count > 0 THEN
            FOR v_acc IN 1..v_count LOOP
              v_pool := v_pool || jsonb_build_array(v_i);
            END LOOP;
          END IF;
        END;
      END LOOP;
    END IF;

    IF jsonb_array_length(v_pool) = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Estoque da caixa esgotado');
    END IF;

    v_i := floor(random() * jsonb_array_length(v_pool))::integer;
    v_prize_index := (v_pool->v_i)::integer;
    v_pool := (v_pool - v_i);

    UPDATE public.luckybox_cases SET prize_pool = v_pool, updated_at = now()
    WHERE id = v_case.id;
  ELSE
    -- probability mode
    FOR v_i IN 0..(jsonb_array_length(v_prizes) - 1) LOOP
      v_total_weight := v_total_weight + GREATEST(COALESCE(NULLIF(v_prizes->v_i->>'weight','')::numeric, 1), 0);
    END LOOP;
    IF v_total_weight <= 0 THEN v_total_weight := jsonb_array_length(v_prizes); END IF;
    v_pick := random() * v_total_weight;
    v_acc := 0;
    v_prize_index := 0;
    FOR v_i IN 0..(jsonb_array_length(v_prizes) - 1) LOOP
      v_acc := v_acc + GREATEST(COALESCE(NULLIF(v_prizes->v_i->>'weight','')::numeric, 1), 0);
      IF v_pick <= v_acc THEN
        v_prize_index := v_i;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  v_prize := v_prizes->v_prize_index;
  v_resolved_prize := v_prize;
  v_resolved_label := COALESCE(v_prize->>'label', '');

  -- Mystery scratch prize: pick a sub-prize
  IF COALESCE((v_prize->>'scratch')::boolean, false) THEN
    v_scratch_prizes := COALESCE(v_prize->'scratchPrizes', '[]'::jsonb);
    IF jsonb_typeof(v_scratch_prizes) = 'array' AND jsonb_array_length(v_scratch_prizes) > 0 THEN
      v_total_weight := 0;
      FOR v_i IN 0..(jsonb_array_length(v_scratch_prizes) - 1) LOOP
        v_total_weight := v_total_weight + GREATEST(COALESCE(NULLIF(v_scratch_prizes->v_i->>'weight','')::numeric, 1), 0);
      END LOOP;
      IF v_total_weight <= 0 THEN v_total_weight := jsonb_array_length(v_scratch_prizes); END IF;
      v_pick := random() * v_total_weight;
      v_acc := 0;
      v_scratch_index := 0;
      FOR v_i IN 0..(jsonb_array_length(v_scratch_prizes) - 1) LOOP
        v_acc := v_acc + GREATEST(COALESCE(NULLIF(v_scratch_prizes->v_i->>'weight','')::numeric, 1), 0);
        IF v_pick <= v_acc THEN
          v_scratch_index := v_i;
          EXIT;
        END IF;
      END LOOP;
      v_scratch_prize := v_scratch_prizes->v_scratch_index;
      v_resolved_prize := v_scratch_prize;
      v_resolved_label := COALESCE(v_scratch_prize->>'label', v_resolved_label);
    END IF;
  END IF;

  v_amount := COALESCE(NULLIF(v_resolved_prize->>'amount','')::numeric, 0);

  -- Charge: consume grant or tokens
  IF v_used_grant THEN
    v_grants := jsonb_set(v_grants, ARRAY[v_case_key], to_jsonb(v_grant_count - 1), true);
    IF (v_grants->>v_case_key)::integer <= 0 THEN
      v_grants := v_grants - v_case_key;
    END IF;
    UPDATE public.wheel_users
    SET case_grants = v_grants, updated_at = now()
    WHERE id = v_user.id
    RETURNING tokens_balance INTO v_new_tokens;
  ELSE
    UPDATE public.wheel_users
    SET tokens_balance = tokens_balance - v_case.price_tokens, updated_at = now()
    WHERE id = v_user.id
    RETURNING tokens_balance INTO v_new_tokens;
  END IF;

  -- Create payment record if amount > 0
  IF v_amount > 0 THEN
    INSERT INTO public.prize_payments (
      owner_id, wheel_user_id, prize, amount, status, user_name, user_email, account_id,
      pix_key, pix_key_type, auto_payment
    ) VALUES (
      p_owner_id, v_user.id, v_resolved_label, v_amount, 'pending',
      COALESCE(v_user.name, ''), COALESCE(v_user.email, ''), COALESCE(v_user.account_id, ''),
      COALESCE(v_user.pix_key, ''), COALESCE(v_user.pix_key_type, ''), COALESCE(v_user.auto_payment, false)
    ) RETURNING id INTO v_payment_id;
  END IF;

  -- Log opening
  INSERT INTO public.luckybox_openings (
    owner_id, wheel_user_id, case_id, case_name, account_id, user_email, user_name,
    price_tokens, prize_label, prize_amount, prize_image, prize_index, prize_payment_id
  ) VALUES (
    p_owner_id, v_user.id, v_case.id, COALESCE(v_case.name, ''),
    COALESCE(v_user.account_id, ''), COALESCE(v_user.email, ''), COALESCE(v_user.name, ''),
    CASE WHEN v_used_grant THEN 0 ELSE v_case.price_tokens END,
    v_resolved_label, v_amount, COALESCE(v_resolved_prize->>'image', ''), v_prize_index, v_payment_id
  ) RETURNING id INTO v_opening_id;

  RETURN jsonb_build_object(
    'success', true,
    'prize', v_prize,
    'prize_index', v_prize_index,
    'scratch_prize', v_scratch_prize,
    'tokens_balance', v_new_tokens,
    'opening_id', v_opening_id,
    'payment_id', v_payment_id,
    'used_grant', v_used_grant,
    'case_grants', v_grants
  );
END;
$function$;
