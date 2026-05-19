
ALTER TABLE public.luckybox_cases
  ADD COLUMN IF NOT EXISTS claim_event_name text NOT NULL DEFAULT '';

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
    'claim_recurrence', COALESCE(c.claim_recurrence, 'none'),
    'claim_event_name', COALESCE(c.claim_event_name, '')
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
