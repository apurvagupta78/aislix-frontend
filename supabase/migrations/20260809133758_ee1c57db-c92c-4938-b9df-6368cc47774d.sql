-- Replace the partial unique index (which PostgREST cannot use as an upsert conflict target)
-- with a real UNIQUE constraint on (org_id, sku).
DROP INDEX IF EXISTS public.learned_skus_org_sku_key;

DELETE FROM public.learned_skus a
USING public.learned_skus b
WHERE a.sku IS NOT NULL
  AND a.org_id = b.org_id
  AND a.sku = b.sku
  AND a.ctid > b.ctid;

ALTER TABLE public.learned_skus
  ADD CONSTRAINT learned_skus_org_sku_key UNIQUE (org_id, sku);