-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('owner','admin','store_manager','viewer');
CREATE TYPE public.store_status AS ENUM ('active','inactive','onboarding');
CREATE TYPE public.scan_status AS ENUM ('queued','processing','completed','failed');
CREATE TYPE public.stock_status AS ENUM ('in_stock','low_stock','out_of_stock','misplaced');
CREATE TYPE public.alert_severity AS ENUM ('critical','high','medium','low');
CREATE TYPE public.billing_cycle AS ENUM ('monthly','annual');
CREATE TYPE public.subscription_status AS ENUM ('active','trialing','past_due','canceled');
CREATE TYPE public.member_status AS ENUM ('active','invited','suspended');

-- ============ SHARED TRIGGER FN ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  job_title TEXT,
  timezone TEXT DEFAULT 'Asia/Kolkata',
  locale TEXT DEFAULT 'en-IN',
  notification_prefs JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (NEW.id, NEW.email,
          COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
          NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ ORGANIZATIONS ============
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  industry TEXT,
  website TEXT,
  logo_url TEXT,
  country TEXT DEFAULT 'India',
  gstin TEXT,
  billing_email TEXT,
  address JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'viewer',
  status public.member_status NOT NULL DEFAULT 'active',
  invited_email TEXT,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  store_ids UUID[] NOT NULL DEFAULT '{}',
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX idx_org_members_org ON public.organization_members(org_id);

-- security definer helpers
CREATE OR REPLACE FUNCTION public.is_org_member(_org_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members m
    WHERE m.org_id = _org_id AND m.user_id = _user_id AND m.status = 'active');
$$;
CREATE OR REPLACE FUNCTION public.has_org_role(_org_id UUID, _user_id UUID, _roles public.app_role[])
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members m
    WHERE m.org_id = _org_id AND m.user_id = _user_id AND m.status = 'active' AND m.role = ANY(_roles));
$$;

CREATE POLICY "orgs_select_members" ON public.organizations FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_org_member(id, auth.uid()));
CREATE POLICY "orgs_insert_own" ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "orgs_update_admins" ON public.organizations FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_org_role(id, auth.uid(), ARRAY['owner','admin']::public.app_role[]))
  WITH CHECK (owner_id = auth.uid() OR public.has_org_role(id, auth.uid(), ARRAY['owner','admin']::public.app_role[]));
CREATE POLICY "orgs_delete_owner" ON public.organizations FOR DELETE TO authenticated
  USING (owner_id = auth.uid());
CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "org_members_select" ON public.organization_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_org_member(org_id, auth.uid()));
CREATE POLICY "org_members_insert_admins" ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(org_id, auth.uid(), ARRAY['owner','admin']::public.app_role[])
    OR EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = org_id AND o.owner_id = auth.uid())
  );
CREATE POLICY "org_members_update_admins" ON public.organization_members FOR UPDATE TO authenticated
  USING (public.has_org_role(org_id, auth.uid(), ARRAY['owner','admin']::public.app_role[]))
  WITH CHECK (public.has_org_role(org_id, auth.uid(), ARRAY['owner','admin']::public.app_role[]));
CREATE POLICY "org_members_delete_admins" ON public.organization_members FOR DELETE TO authenticated
  USING (public.has_org_role(org_id, auth.uid(), ARRAY['owner','admin']::public.app_role[]));
CREATE TRIGGER org_members_updated_at BEFORE UPDATE ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- auto-add creator as owner member
CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.organization_members (org_id, user_id, role, status)
  VALUES (NEW.id, NEW.owner_id, 'owner', 'active')
  ON CONFLICT (org_id, user_id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_organization_created AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization();

-- ============ STORES ============
CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  store_type TEXT DEFAULT 'local store',
  status public.store_status NOT NULL DEFAULT 'active',
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  country TEXT DEFAULT 'India',
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  shelf_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_stores_org ON public.stores(org_id);
CREATE INDEX idx_stores_status ON public.stores(org_id, status);
CREATE POLICY "stores_select_members" ON public.stores FOR SELECT TO authenticated
  USING (public.is_org_member(org_id, auth.uid()));
CREATE POLICY "stores_insert_admins" ON public.stores FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(org_id, auth.uid(), ARRAY['owner','admin']::public.app_role[]));
CREATE POLICY "stores_update_managers" ON public.stores FOR UPDATE TO authenticated
  USING (public.has_org_role(org_id, auth.uid(), ARRAY['owner','admin','store_manager']::public.app_role[]))
  WITH CHECK (public.has_org_role(org_id, auth.uid(), ARRAY['owner','admin','store_manager']::public.app_role[]));
CREATE POLICY "stores_delete_admins" ON public.stores FOR DELETE TO authenticated
  USING (public.has_org_role(org_id, auth.uid(), ARRAY['owner','admin']::public.app_role[]));
CREATE TRIGGER stores_updated_at BEFORE UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SUBSCRIPTION PLANS ============
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tagline TEXT,
  price_monthly_inr INTEGER NOT NULL DEFAULT 0,
  price_annual_inr INTEGER NOT NULL DEFAULT 0,
  scan_quota INTEGER,
  store_limit INTEGER,
  seat_limit INTEGER,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_contact_sales BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_plans TO anon;
GRANT SELECT ON public.subscription_plans TO authenticated;
GRANT ALL ON public.subscription_plans TO service_role;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans_public_read" ON public.subscription_plans FOR SELECT USING (is_active = true);
CREATE TRIGGER plans_updated_at BEFORE UPDATE ON public.subscription_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  status public.subscription_status NOT NULL DEFAULT 'active',
  cycle public.billing_cycle NOT NULL DEFAULT 'monthly',
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ,
  scans_used INTEGER NOT NULL DEFAULT 0,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  provider TEXT,
  provider_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subs_select_members" ON public.subscriptions FOR SELECT TO authenticated
  USING (public.is_org_member(org_id, auth.uid()));
CREATE POLICY "subs_insert_admins" ON public.subscriptions FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(org_id, auth.uid(), ARRAY['owner','admin']::public.app_role[]));
CREATE POLICY "subs_update_admins" ON public.subscriptions FOR UPDATE TO authenticated
  USING (public.has_org_role(org_id, auth.uid(), ARRAY['owner','admin']::public.app_role[]))
  WITH CHECK (public.has_org_role(org_id, auth.uid(), ARRAY['owner','admin']::public.app_role[]));
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SHELF SCANS ============
CREATE TABLE public.shelf_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.scan_status NOT NULL DEFAULT 'queued',
  shelf_label TEXT,
  category TEXT,
  notes TEXT,
  shelf_health_score NUMERIC(5,2),
  osa_percent NUMERIC(5,2),
  share_of_shelf_percent NUMERIC(5,2),
  planogram_compliance_percent NUMERIC(5,2),
  total_products INTEGER NOT NULL DEFAULT 0,
  out_of_stock_count INTEGER NOT NULL DEFAULT 0,
  low_stock_count INTEGER NOT NULL DEFAULT 0,
  misplaced_count INTEGER NOT NULL DEFAULT 0,
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shelf_scans TO authenticated;
GRANT ALL ON public.shelf_scans TO service_role;
ALTER TABLE public.shelf_scans ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_scans_org_created ON public.shelf_scans(org_id, created_at DESC);
CREATE INDEX idx_scans_store_created ON public.shelf_scans(store_id, created_at DESC);
CREATE INDEX idx_scans_status ON public.shelf_scans(org_id, status);
CREATE POLICY "scans_select_members" ON public.shelf_scans FOR SELECT TO authenticated
  USING (public.is_org_member(org_id, auth.uid()));
CREATE POLICY "scans_insert_members" ON public.shelf_scans FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(org_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "scans_update_managers" ON public.shelf_scans FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_org_role(org_id, auth.uid(), ARRAY['owner','admin','store_manager']::public.app_role[]))
  WITH CHECK (public.is_org_member(org_id, auth.uid()));
CREATE POLICY "scans_delete_admins" ON public.shelf_scans FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_org_role(org_id, auth.uid(), ARRAY['owner','admin']::public.app_role[]));
CREATE TRIGGER shelf_scans_updated_at BEFORE UPDATE ON public.shelf_scans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.scan_in_my_org(_scan_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shelf_scans s
    JOIN public.organization_members m ON m.org_id = s.org_id
    WHERE s.id = _scan_id AND m.user_id = auth.uid() AND m.status = 'active'
  );
$$;

-- ============ SCAN IMAGES ============
CREATE TABLE public.scan_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES public.shelf_scans(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'original',
  storage_bucket TEXT NOT NULL DEFAULT 'scan-images',
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  file_size_bytes BIGINT,
  width INTEGER,
  height INTEGER,
  captured_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scan_images TO authenticated;
GRANT ALL ON public.scan_images TO service_role;
ALTER TABLE public.scan_images ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_scan_images_scan ON public.scan_images(scan_id);
CREATE POLICY "scan_images_select" ON public.scan_images FOR SELECT TO authenticated USING (public.scan_in_my_org(scan_id));
CREATE POLICY "scan_images_insert" ON public.scan_images FOR INSERT TO authenticated WITH CHECK (public.scan_in_my_org(scan_id));
CREATE POLICY "scan_images_update" ON public.scan_images FOR UPDATE TO authenticated USING (public.scan_in_my_org(scan_id)) WITH CHECK (public.scan_in_my_org(scan_id));
CREATE POLICY "scan_images_delete" ON public.scan_images FOR DELETE TO authenticated USING (public.scan_in_my_org(scan_id));

-- ============ SCAN RESULTS ============
CREATE TABLE public.scan_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL UNIQUE REFERENCES public.shelf_scans(id) ON DELETE CASCADE,
  executive_summary TEXT,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  alerts JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  brand_share JSONB NOT NULL DEFAULT '[]'::jsonb,
  category_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
  shelf_rows JSONB NOT NULL DEFAULT '[]'::jsonb,
  model_version TEXT,
  confidence_avg NUMERIC(5,4),
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scan_results TO authenticated;
GRANT ALL ON public.scan_results TO service_role;
ALTER TABLE public.scan_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scan_results_select" ON public.scan_results FOR SELECT TO authenticated USING (public.scan_in_my_org(scan_id));
CREATE POLICY "scan_results_insert" ON public.scan_results FOR INSERT TO authenticated WITH CHECK (public.scan_in_my_org(scan_id));
CREATE POLICY "scan_results_update" ON public.scan_results FOR UPDATE TO authenticated USING (public.scan_in_my_org(scan_id)) WITH CHECK (public.scan_in_my_org(scan_id));
CREATE TRIGGER scan_results_updated_at BEFORE UPDATE ON public.scan_results FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ DETECTED PRODUCTS ============
CREATE TABLE public.detected_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES public.shelf_scans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT,
  sku TEXT,
  barcode TEXT,
  facings INTEGER NOT NULL DEFAULT 1,
  shelf_row INTEGER,
  position_index INTEGER,
  stock_status public.stock_status NOT NULL DEFAULT 'in_stock',
  confidence NUMERIC(5,4),
  price_inr NUMERIC(10,2),
  expected_facings INTEGER,
  bounding_box JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.detected_products TO authenticated;
GRANT ALL ON public.detected_products TO service_role;
ALTER TABLE public.detected_products ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_detected_products_scan ON public.detected_products(scan_id);
CREATE INDEX idx_detected_products_brand ON public.detected_products(brand);
CREATE POLICY "detected_products_select" ON public.detected_products FOR SELECT TO authenticated USING (public.scan_in_my_org(scan_id));
CREATE POLICY "detected_products_insert" ON public.detected_products FOR INSERT TO authenticated WITH CHECK (public.scan_in_my_org(scan_id));
CREATE POLICY "detected_products_update" ON public.detected_products FOR UPDATE TO authenticated USING (public.scan_in_my_org(scan_id)) WITH CHECK (public.scan_in_my_org(scan_id));
CREATE POLICY "detected_products_delete" ON public.detected_products FOR DELETE TO authenticated USING (public.scan_in_my_org(scan_id));

-- ============ SHELF ANALYTICS ============
CREATE TABLE public.shelf_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  period_date DATE NOT NULL,
  scans_count INTEGER NOT NULL DEFAULT 0,
  avg_shelf_health NUMERIC(5,2),
  avg_osa_percent NUMERIC(5,2),
  avg_share_of_shelf NUMERIC(5,2),
  out_of_stock_count INTEGER NOT NULL DEFAULT 0,
  low_stock_count INTEGER NOT NULL DEFAULT 0,
  misplaced_count INTEGER NOT NULL DEFAULT 0,
  top_brands JSONB NOT NULL DEFAULT '[]'::jsonb,
  category_mix JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, store_id, period_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shelf_analytics TO authenticated;
GRANT ALL ON public.shelf_analytics TO service_role;
ALTER TABLE public.shelf_analytics ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_shelf_analytics_org_date ON public.shelf_analytics(org_id, period_date DESC);
CREATE POLICY "analytics_select_members" ON public.shelf_analytics FOR SELECT TO authenticated USING (public.is_org_member(org_id, auth.uid()));
CREATE POLICY "analytics_write_admins" ON public.shelf_analytics FOR ALL TO authenticated
  USING (public.has_org_role(org_id, auth.uid(), ARRAY['owner','admin']::public.app_role[]))
  WITH CHECK (public.has_org_role(org_id, auth.uid(), ARRAY['owner','admin']::public.app_role[]));
CREATE TRIGGER shelf_analytics_updated_at BEFORE UPDATE ON public.shelf_analytics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CONTACT SUBMISSIONS ============
CREATE TABLE public.contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  phone TEXT,
  topic TEXT,
  message TEXT NOT NULL,
  store_count TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.contact_submissions TO anon;
GRANT INSERT, SELECT ON public.contact_submissions TO authenticated;
GRANT ALL ON public.contact_submissions TO service_role;
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contact_insert_anyone" ON public.contact_submissions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "contact_select_own" ON public.contact_submissions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER contact_submissions_updated_at BEFORE UPDATE ON public.contact_submissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SUBSCRIPTION PLAN CATALOGUE (real product config, not sample data) ============
INSERT INTO public.subscription_plans (code, name, tagline, price_monthly_inr, price_annual_inr, scan_quota, store_limit, seat_limit, features, is_contact_sales, sort_order) VALUES
('free','Free','Try shelf intelligence',0,0,10,1,1,'["10 shelf scans / month","1 store","Basic shelf health score","Email support"]'::jsonb,false,1),
('starter','Starter','For single-store retailers',999,9590,150,3,5,'["150 shelf scans / month","Up to 3 stores","Full scan reports & alerts","PDF & CSV exports","Email support"]'::jsonb,false,2),
('professional','Professional','For growing retail chains',4999,47990,1000,25,25,'["1,000 shelf scans / month","Up to 25 stores","Advanced analytics & trends","Planogram compliance","Team roles & permissions","Priority support"]'::jsonb,false,3),
('enterprise','Enterprise','For large retail networks',0,0,NULL,NULL,NULL,'["Unlimited shelf scans","Unlimited stores","Custom AI models","API & data warehouse access","SSO & audit logs","Dedicated success manager"]'::jsonb,true,4);

-- ============ STORAGE POLICIES ============
CREATE POLICY "scan_images_read_members" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'scan-images' AND EXISTS (
    SELECT 1 FROM public.organization_members m WHERE m.user_id = auth.uid() AND m.status = 'active'
      AND m.org_id::text = (storage.foldername(name))[1]));
CREATE POLICY "scan_images_insert_members" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'scan-images' AND EXISTS (
    SELECT 1 FROM public.organization_members m WHERE m.user_id = auth.uid() AND m.status = 'active'
      AND m.org_id::text = (storage.foldername(name))[1]));
CREATE POLICY "scan_images_delete_members" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'scan-images' AND EXISTS (
    SELECT 1 FROM public.organization_members m WHERE m.user_id = auth.uid() AND m.status = 'active'
      AND m.org_id::text = (storage.foldername(name))[1]));

CREATE POLICY "avatars_own_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars_own_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars_own_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars_own_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "org_logos_read_members" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'org-logos' AND EXISTS (
    SELECT 1 FROM public.organization_members m WHERE m.user_id = auth.uid() AND m.status = 'active'
      AND m.org_id::text = (storage.foldername(name))[1]));
CREATE POLICY "org_logos_write_admins" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'org-logos' AND EXISTS (
    SELECT 1 FROM public.organization_members m WHERE m.user_id = auth.uid() AND m.status = 'active'
      AND m.role IN ('owner','admin') AND m.org_id::text = (storage.foldername(name))[1]));
CREATE POLICY "org_logos_delete_admins" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'org-logos' AND EXISTS (
    SELECT 1 FROM public.organization_members m WHERE m.user_id = auth.uid() AND m.status = 'active'
      AND m.role IN ('owner','admin') AND m.org_id::text = (storage.foldername(name))[1]));