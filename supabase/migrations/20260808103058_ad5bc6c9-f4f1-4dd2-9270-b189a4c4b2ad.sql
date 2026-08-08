CREATE TABLE public.api_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text,
  key_prefix text NOT NULL,
  key_hash text NOT NULL,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX api_keys_org_id_idx ON public.api_keys(org_id);
CREATE UNIQUE INDEX api_keys_key_hash_idx ON public.api_keys(key_hash);

GRANT SELECT, INSERT, UPDATE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view api keys"
ON public.api_keys FOR SELECT TO authenticated
USING (private.is_org_member(org_id, auth.uid()));

CREATE POLICY "Org admins can create api keys"
ON public.api_keys FOR INSERT TO authenticated
WITH CHECK (
  private.has_org_role(org_id, auth.uid(), ARRAY['owner','admin']::app_role[])
  AND user_id = auth.uid()
);

CREATE POLICY "Org admins can revoke api keys"
ON public.api_keys FOR UPDATE TO authenticated
USING (private.has_org_role(org_id, auth.uid(), ARRAY['owner','admin']::app_role[]))
WITH CHECK (private.has_org_role(org_id, auth.uid(), ARRAY['owner','admin']::app_role[]));

CREATE TRIGGER api_keys_updated_at
BEFORE UPDATE ON public.api_keys
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();