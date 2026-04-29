REVOKE EXECUTE ON FUNCTION public.create_config_backup(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.restore_config_backup(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_config_backup(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_config_backup(UUID) TO authenticated;