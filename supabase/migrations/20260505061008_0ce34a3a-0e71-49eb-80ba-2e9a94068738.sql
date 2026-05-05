
-- ============ redemption_pages ============
CREATE TABLE public.redemption_pages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  tag text NOT NULL,
  referral_link_id uuid NOT NULL REFERENCES public.referral_links(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'shared', -- 'shared' | 'unique'
  shared_code text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT redemption_pages_tag_unique UNIQUE (tag)
);

CREATE INDEX idx_redemption_pages_owner ON public.redemption_pages(owner_id);
CREATE INDEX idx_redemption_pages_tag ON public.redemption_pages(lower(tag));

ALTER TABLE public.redemption_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active redemption_pages"
  ON public.redemption_pages FOR SELECT TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Owners can read own redemption_pages"
  ON public.redemption_pages FOR SELECT TO authenticated
  USING ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners can insert own redemption_pages"
  ON public.redemption_pages FOR INSERT TO authenticated
  WITH CHECK ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners can update own redemption_pages"
  ON public.redemption_pages FOR UPDATE TO authenticated
  USING ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners can delete own redemption_pages"
  ON public.redemption_pages FOR DELETE TO authenticated
  USING ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER touch_redemption_pages_updated_at
  BEFORE UPDATE ON public.redemption_pages
  FOR EACH ROW EXECUTE FUNCTION public.touch_battle_configs_updated_at();

-- ============ redemption_codes ============
CREATE TABLE public.redemption_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  redemption_page_id uuid NOT NULL REFERENCES public.redemption_pages(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  code text NOT NULL,
  used_at timestamp with time zone,
  used_by_email text,
  used_by_account_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT redemption_codes_page_code_unique UNIQUE (redemption_page_id, code)
);

CREATE INDEX idx_redemption_codes_page ON public.redemption_codes(redemption_page_id);
CREATE INDEX idx_redemption_codes_owner ON public.redemption_codes(owner_id);
CREATE INDEX idx_redemption_codes_code ON public.redemption_codes(lower(code));

ALTER TABLE public.redemption_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read own redemption_codes"
  ON public.redemption_codes FOR SELECT TO authenticated
  USING ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners can insert own redemption_codes"
  ON public.redemption_codes FOR INSERT TO authenticated
  WITH CHECK ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners can delete own redemption_codes"
  ON public.redemption_codes FOR DELETE TO authenticated
  USING ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages redemption_codes"
  ON public.redemption_codes FOR ALL TO public
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============ get_redemption_page_by_tag ============
CREATE OR REPLACE FUNCTION public.get_redemption_page_by_tag(p_tag text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_page public.redemption_pages%ROWTYPE;
  v_link public.referral_links%ROWTYPE;
  v_wc public.wheel_configs%ROWTYPE;
BEGIN
  SELECT * INTO v_page FROM public.redemption_pages
  WHERE lower(tag) = lower(btrim(p_tag)) AND is_active = true LIMIT 1;

  IF v_page.id IS NULL THEN
    RETURN jsonb_build_object('pageData', null);
  END IF;

  SELECT * INTO v_link FROM public.referral_links WHERE id = v_page.referral_link_id;
  SELECT * INTO v_wc FROM public.wheel_configs WHERE user_id = v_page.owner_id LIMIT 1;

  RETURN jsonb_build_object(
    'pageData', jsonb_build_object(
      'id', v_page.id,
      'tag', v_page.tag,
      'mode', v_page.mode,
      'owner_id', v_page.owner_id,
      'referral_link_id', v_page.referral_link_id
    ),
    'linkData', to_jsonb(v_link),
    'wheelSlug', COALESCE(v_wc.slug, ''),
    'defaultReferralPageConfig', COALESCE(v_wc.config->'defaultReferralPageConfig', '{}'::jsonb)
  );
END;
$$;

-- ============ register_via_redemption ============
CREATE OR REPLACE FUNCTION public.register_via_redemption(
  p_tag text,
  p_code text,
  p_email text,
  p_account_id text,
  p_name text DEFAULT '',
  p_cpf text DEFAULT '',
  p_phone text DEFAULT '',
  p_pix_key text DEFAULT '',
  p_pix_key_type text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_page public.redemption_pages%ROWTYPE;
  v_link public.referral_links%ROWTYPE;
  v_code_row public.redemption_codes%ROWTYPE;
  v_clean_code text;
  v_result jsonb;
BEGIN
  v_clean_code := btrim(p_code);
  IF v_clean_code = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Informe o código de resgate.');
  END IF;

  SELECT * INTO v_page FROM public.redemption_pages
  WHERE lower(tag) = lower(btrim(p_tag)) AND is_active = true LIMIT 1;
  IF v_page.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Página de resgate não encontrada.');
  END IF;

  SELECT * INTO v_link FROM public.referral_links WHERE id = v_page.referral_link_id AND is_active = true;
  IF v_link.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Promoção indisponível no momento.');
  END IF;

  -- Validate the code based on mode
  IF v_page.mode = 'shared' THEN
    IF lower(COALESCE(v_page.shared_code, '')) <> lower(v_clean_code) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Código inválido.');
    END IF;
  ELSE
    -- unique mode: lock the code row
    SELECT * INTO v_code_row FROM public.redemption_codes
    WHERE redemption_page_id = v_page.id AND lower(code) = lower(v_clean_code)
    FOR UPDATE;
    IF v_code_row.id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Código inválido.');
    END IF;
    IF v_code_row.used_at IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Este código já foi resgatado.');
    END IF;
  END IF;

  -- Delegate to referral logic (re-uses ALL distribution rules: pool, fixed prize, expiration, auto_payment, dedup, etc.)
  v_result := public.register_via_referral(
    v_link.code, p_email, p_account_id, p_name, p_cpf, p_phone, p_pix_key, p_pix_key_type
  );

  IF COALESCE((v_result->>'success')::boolean, false) = false THEN
    RETURN v_result;
  END IF;

  -- Mark unique code as used (only after successful redemption)
  IF v_page.mode = 'unique' AND v_code_row.id IS NOT NULL THEN
    UPDATE public.redemption_codes
    SET used_at = now(),
        used_by_email = lower(btrim(p_email)),
        used_by_account_id = btrim(p_account_id)
    WHERE id = v_code_row.id;
  END IF;

  RETURN v_result;
END;
$$;
