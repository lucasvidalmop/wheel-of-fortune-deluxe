
-- 1. Tokens balance on wheel_users
ALTER TABLE public.wheel_users
  ADD COLUMN IF NOT EXISTS tokens_balance integer NOT NULL DEFAULT 0;

-- 2. Permission flag
ALTER TABLE public.operator_permissions
  ADD COLUMN IF NOT EXISTS luckybox boolean NOT NULL DEFAULT false;
ALTER TABLE public.operator_permissions_defaults
  ADD COLUMN IF NOT EXISTS luckybox boolean NOT NULL DEFAULT false;

-- 3. Luckybox configs (per operator)
CREATE TABLE IF NOT EXISTS public.luckybox_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL UNIQUE,
  tag text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  page_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  tokens_symbol text NOT NULL DEFAULT 'T',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.luckybox_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active luckybox_configs"
  ON public.luckybox_configs FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Owners read own luckybox_configs"
  ON public.luckybox_configs FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners insert own luckybox_configs"
  ON public.luckybox_configs FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners update own luckybox_configs"
  ON public.luckybox_configs FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners delete own luckybox_configs"
  ON public.luckybox_configs FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- 4. Cases
CREATE TABLE IF NOT EXISTS public.luckybox_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Caixa',
  price_tokens integer NOT NULL DEFAULT 0,
  image_url text NOT NULL DEFAULT '',
  rarity text NOT NULL DEFAULT 'common',
  mode text NOT NULL DEFAULT 'probability', -- 'probability' | 'pool'
  prizes jsonb NOT NULL DEFAULT '[]'::jsonb,
  prize_pool jsonb, -- runtime pool when mode = 'pool'
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.luckybox_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active luckybox_cases"
  ON public.luckybox_cases FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Owners read own luckybox_cases"
  ON public.luckybox_cases FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners insert own luckybox_cases"
  ON public.luckybox_cases FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners update own luckybox_cases"
  ON public.luckybox_cases FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners delete own luckybox_cases"
  ON public.luckybox_cases FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- 5. Openings history
CREATE TABLE IF NOT EXISTS public.luckybox_openings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  wheel_user_id uuid,
  case_id uuid,
  case_name text NOT NULL DEFAULT '',
  account_id text NOT NULL DEFAULT '',
  user_email text NOT NULL DEFAULT '',
  user_name text NOT NULL DEFAULT '',
  price_tokens integer NOT NULL DEFAULT 0,
  prize_label text NOT NULL DEFAULT '',
  prize_amount numeric NOT NULL DEFAULT 0,
  prize_image text NOT NULL DEFAULT '',
  prize_index integer,
  prize_payment_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.luckybox_openings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read own luckybox_openings"
  ON public.luckybox_openings FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages luckybox_openings"
  ON public.luckybox_openings FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 6. Touch trigger
CREATE OR REPLACE FUNCTION public.touch_luckybox_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_luckybox_configs_touch ON public.luckybox_configs;
CREATE TRIGGER trg_luckybox_configs_touch
  BEFORE UPDATE ON public.luckybox_configs
  FOR EACH ROW EXECUTE FUNCTION public.touch_luckybox_updated_at();

DROP TRIGGER IF EXISTS trg_luckybox_cases_touch ON public.luckybox_cases;
CREATE TRIGGER trg_luckybox_cases_touch
  BEFORE UPDATE ON public.luckybox_cases
  FOR EACH ROW EXECUTE FUNCTION public.touch_luckybox_updated_at();

-- 7. Public page loader by tag
CREATE OR REPLACE FUNCTION public.get_luckybox_page_by_tag(p_tag text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
    'prizes', c.prizes
  ) ORDER BY c.position, c.created_at), '[]'::jsonb) INTO v_cases
  FROM public.luckybox_cases c
  WHERE c.owner_id = v_cfg.owner_id AND c.is_active = true;

  RETURN jsonb_build_object(
    'config', jsonb_build_object(
      'id', v_cfg.id,
      'tag', v_cfg.tag,
      'tokens_symbol', v_cfg.tokens_symbol,
      'page_config', v_cfg.page_config,
      'owner_id', v_cfg.owner_id
    ),
    'cases', v_cases
  );
END;
$$;

-- 8. Open a case (atomic): deduct tokens, pick prize, log, optionally create prize_payment
CREATE OR REPLACE FUNCTION public.open_luckybox_case(
  p_owner_id uuid,
  p_account_id text,
  p_case_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
BEGIN
  -- Lock user row
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

  -- Lock case
  SELECT * INTO v_case FROM public.luckybox_cases
  WHERE id = p_case_id AND owner_id = p_owner_id AND is_active = true
  FOR UPDATE;

  IF v_case.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Caixa indisponível');
  END IF;

  IF COALESCE(v_user.tokens_balance, 0) < v_case.price_tokens THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tokens insuficientes');
  END IF;

  v_prizes := COALESCE(v_case.prizes, '[]'::jsonb);
  IF jsonb_typeof(v_prizes) <> 'array' OR jsonb_array_length(v_prizes) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Caixa sem prêmios configurados');
  END IF;

  -- Pick prize
  IF v_case.mode = 'pool' THEN
    -- Initialize pool if empty
    v_pool := COALESCE(v_case.prize_pool, 'null'::jsonb);
    IF v_pool IS NULL OR v_pool = 'null'::jsonb OR jsonb_array_length(v_pool) = 0 THEN
      -- build from prizes count field
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
      -- shuffle: just pick random index later
    END IF;

    IF jsonb_array_length(v_pool) = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Estoque da caixa esgotado');
    END IF;

    -- pick random index from pool
    v_i := floor(random() * jsonb_array_length(v_pool))::integer;
    v_prize_index := (v_pool->>v_i)::integer;

    -- remove it
    v_pool := (
      SELECT COALESCE(jsonb_agg(value), '[]'::jsonb)
      FROM (
        SELECT value FROM jsonb_array_elements(v_pool) WITH ORDINALITY t(value, ord)
        WHERE ord <> v_i + 1 ORDER BY ord
      ) s
    );

    UPDATE public.luckybox_cases SET prize_pool = v_pool, updated_at = now()
    WHERE id = v_case.id;
  ELSE
    -- probability mode
    FOR v_i IN 0..(jsonb_array_length(v_prizes) - 1) LOOP
      v_total_weight := v_total_weight + GREATEST(COALESCE(NULLIF(v_prizes->v_i->>'weight', '')::numeric, 1), 0);
    END LOOP;
    IF v_total_weight <= 0 THEN
      v_total_weight := jsonb_array_length(v_prizes);
    END IF;
    v_pick := random() * v_total_weight;
    v_prize_index := 0;
    FOR v_i IN 0..(jsonb_array_length(v_prizes) - 1) LOOP
      v_acc := v_acc + GREATEST(COALESCE(NULLIF(v_prizes->v_i->>'weight', '')::numeric, 1), 0);
      IF v_pick <= v_acc THEN
        v_prize_index := v_i;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  v_prize := v_prizes->v_prize_index;
  v_amount := COALESCE(NULLIF(v_prize->>'amount', '')::numeric, 0);

  -- Deduct tokens
  UPDATE public.wheel_users
  SET tokens_balance = GREATEST(COALESCE(tokens_balance, 0) - v_case.price_tokens, 0),
      updated_at = now()
  WHERE id = v_user.id;

  -- If prize is money, create prize_payment using existing engine
  IF v_amount > 0 THEN
    v_payment := public.create_prize_payment(
      p_owner_id := p_owner_id,
      p_account_id := v_user.account_id,
      p_user_name := COALESCE(v_user.name, ''),
      p_user_email := COALESCE(v_user.email, ''),
      p_prize := COALESCE(v_prize->>'label', 'Prêmio'),
      p_amount := v_amount,
      p_spin_result_id := NULL
    );
    v_payment_id := (v_payment->>'id')::uuid;
  END IF;

  -- Log opening
  INSERT INTO public.luckybox_openings (
    owner_id, wheel_user_id, case_id, case_name, account_id,
    user_email, user_name, price_tokens, prize_label, prize_amount,
    prize_image, prize_index, prize_payment_id
  ) VALUES (
    p_owner_id, v_user.id, v_case.id, v_case.name, v_user.account_id,
    v_user.email, COALESCE(v_user.name, ''), v_case.price_tokens,
    COALESCE(v_prize->>'label', ''), v_amount,
    COALESCE(v_prize->>'image', ''), v_prize_index, v_payment_id
  ) RETURNING id INTO v_opening_id;

  RETURN jsonb_build_object(
    'success', true,
    'opening_id', v_opening_id,
    'prize_index', v_prize_index,
    'prize', v_prize,
    'tokens_balance', GREATEST(COALESCE(v_user.tokens_balance, 0) - v_case.price_tokens, 0),
    'payment_id', v_payment_id,
    'auto_paid', COALESCE((v_payment->>'auto_payment')::boolean, false)
  );
END;
$$;

-- 9. Adjust tokens (used by operator panel)
CREATE OR REPLACE FUNCTION public.adjust_luckybox_tokens(
  p_owner_id uuid,
  p_wheel_user_id uuid,
  p_delta integer
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new integer;
BEGIN
  IF NOT (auth.uid() = p_owner_id OR has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  UPDATE public.wheel_users
  SET tokens_balance = GREATEST(COALESCE(tokens_balance, 0) + p_delta, 0),
      updated_at = now()
  WHERE id = p_wheel_user_id AND owner_id = p_owner_id
  RETURNING tokens_balance INTO v_new;
  RETURN COALESCE(v_new, 0);
END;
$$;
