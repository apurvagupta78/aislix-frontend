GRANT SELECT, INSERT, UPDATE, DELETE ON public.scan_share_links TO authenticated;
GRANT ALL ON public.scan_share_links TO service_role;
GRANT SELECT, INSERT ON public.scan_share_events TO authenticated;
GRANT ALL ON public.scan_share_events TO service_role;