CREATE OR REPLACE FUNCTION public.get_referral_page_data(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_link public.referral_links%ROWTYPE;
  v_wc public.wheel_configs%ROWTYPE;
BEGIN
  SELECT * INTO v_link FROM public.referral_links
  WHERE code = btrim(p_code) AND is_active = true
  LIMIT 1;

  IF v_link.id IS NULL THEN
    SELECT * INTO v_link FROM public.referral_links
    WHERE lower(code) = lower(btrim(p_code)) AND is_active = true
    LIMIT 1;
  END IF;

  IF v_link.id IS NULL THEN
    RETURN jsonb_build_object('linkData', null);
  END IF;

  SELECT * INTO v_wc FROM public.wheel_configs WHERE user_id = v_link.owner_id LIMIT 1;

  RETURN jsonb_build_object(
    'linkData', to_jsonb(v_link),
    'wheelSlug', COALESCE(v_wc.slug, ''),
    'defaultReferralPageConfig', COALESCE(v_wc.config->'defaultReferralPageConfig', '{}'::jsonb),
    'gorjetaPageConfig', COALESCE(v_wc.config->'gorjetaPageConfig', '{}'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_referral_page_data(text) TO anon, authenticated;