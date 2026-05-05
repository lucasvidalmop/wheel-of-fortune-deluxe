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
    'defaultReferralPageConfig', COALESCE(v_wc.config->'defaultReferralPageConfig', '{}'::jsonb),
    'gorjetaPageConfig', COALESCE(v_wc.config->'gorjetaPageConfig', '{}'::jsonb)
  );
END;
$$;