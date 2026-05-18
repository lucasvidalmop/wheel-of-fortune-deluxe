REVOKE ALL ON FUNCTION public.place_bet(uuid,text,text,uuid,uuid,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_bet_event(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_bet_event(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_bet(uuid,text,text,uuid,uuid,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_bet_event(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_bet_event(uuid) TO service_role;
-- Allow authenticated owners to call resolve/cancel from dashboard via direct RPC if desired
GRANT EXECUTE ON FUNCTION public.resolve_bet_event(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_bet_event(uuid) TO authenticated;