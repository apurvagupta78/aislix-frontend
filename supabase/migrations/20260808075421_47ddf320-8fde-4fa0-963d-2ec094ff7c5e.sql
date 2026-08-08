CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_org_member(_org_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.org_id = _org_id AND m.user_id = _user_id AND m.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION private.has_org_role(_org_id uuid, _user_id uuid, _roles public.app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.org_id = _org_id AND m.user_id = _user_id
      AND m.status = 'active' AND m.role = ANY(_roles)
  );
$$;

CREATE OR REPLACE FUNCTION private.scan_in_my_org(_scan_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shelf_scans s
    JOIN public.organization_members m ON m.org_id = s.org_id
    WHERE s.id = _scan_id AND m.user_id = auth.uid() AND m.status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION private.is_org_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.has_org_role(uuid, uuid, public.app_role[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.scan_in_my_org(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_org_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_org_role(uuid, uuid, public.app_role[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.scan_in_my_org(uuid) TO authenticated, service_role;

-- organizations
DROP POLICY IF EXISTS orgs_select_members ON public.organizations;
CREATE POLICY orgs_select_members ON public.organizations FOR SELECT TO authenticated
  USING ((owner_id = auth.uid()) OR private.is_org_member(id, auth.uid()));
DROP POLICY IF EXISTS orgs_update_admins ON public.organizations;
CREATE POLICY orgs_update_admins ON public.organizations FOR UPDATE TO authenticated
  USING ((owner_id = auth.uid()) OR private.has_org_role(id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role]))
  WITH CHECK ((owner_id = auth.uid()) OR private.has_org_role(id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role]));

-- organization_members
DROP POLICY IF EXISTS org_members_select ON public.organization_members;
CREATE POLICY org_members_select ON public.organization_members FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR private.is_org_member(org_id, auth.uid()));
DROP POLICY IF EXISTS org_members_insert_admins ON public.organization_members;
CREATE POLICY org_members_insert_admins ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (private.has_org_role(org_id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role])
    OR EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = organization_members.org_id AND o.owner_id = auth.uid()));
DROP POLICY IF EXISTS org_members_update_admins ON public.organization_members;
CREATE POLICY org_members_update_admins ON public.organization_members FOR UPDATE TO authenticated
  USING (private.has_org_role(org_id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role]))
  WITH CHECK (private.has_org_role(org_id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role]));
DROP POLICY IF EXISTS org_members_delete_admins ON public.organization_members;
CREATE POLICY org_members_delete_admins ON public.organization_members FOR DELETE TO authenticated
  USING (private.has_org_role(org_id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role]));

-- stores
DROP POLICY IF EXISTS stores_select_members ON public.stores;
CREATE POLICY stores_select_members ON public.stores FOR SELECT TO authenticated
  USING (private.is_org_member(org_id, auth.uid()));
DROP POLICY IF EXISTS stores_insert_admins ON public.stores;
CREATE POLICY stores_insert_admins ON public.stores FOR INSERT TO authenticated
  WITH CHECK (private.has_org_role(org_id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role]));
DROP POLICY IF EXISTS stores_update_managers ON public.stores;
CREATE POLICY stores_update_managers ON public.stores FOR UPDATE TO authenticated
  USING (private.has_org_role(org_id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role,'store_manager'::app_role]))
  WITH CHECK (private.has_org_role(org_id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role,'store_manager'::app_role]));
DROP POLICY IF EXISTS stores_delete_admins ON public.stores;
CREATE POLICY stores_delete_admins ON public.stores FOR DELETE TO authenticated
  USING (private.has_org_role(org_id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role]));

-- subscriptions
DROP POLICY IF EXISTS subs_select_members ON public.subscriptions;
CREATE POLICY subs_select_members ON public.subscriptions FOR SELECT TO authenticated
  USING (private.is_org_member(org_id, auth.uid()));
DROP POLICY IF EXISTS subs_insert_admins ON public.subscriptions;
CREATE POLICY subs_insert_admins ON public.subscriptions FOR INSERT TO authenticated
  WITH CHECK (private.has_org_role(org_id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role]));
DROP POLICY IF EXISTS subs_update_admins ON public.subscriptions;
CREATE POLICY subs_update_admins ON public.subscriptions FOR UPDATE TO authenticated
  USING (private.has_org_role(org_id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role]))
  WITH CHECK (private.has_org_role(org_id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role]));

-- shelf_scans
DROP POLICY IF EXISTS scans_select_members ON public.shelf_scans;
CREATE POLICY scans_select_members ON public.shelf_scans FOR SELECT TO authenticated
  USING (private.is_org_member(org_id, auth.uid()));
DROP POLICY IF EXISTS scans_insert_members ON public.shelf_scans;
CREATE POLICY scans_insert_members ON public.shelf_scans FOR INSERT TO authenticated
  WITH CHECK (private.is_org_member(org_id, auth.uid()) AND created_by = auth.uid());
DROP POLICY IF EXISTS scans_update_managers ON public.shelf_scans;
CREATE POLICY scans_update_managers ON public.shelf_scans FOR UPDATE TO authenticated
  USING ((created_by = auth.uid()) OR private.has_org_role(org_id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role,'store_manager'::app_role]))
  WITH CHECK (private.is_org_member(org_id, auth.uid()));
DROP POLICY IF EXISTS scans_delete_admins ON public.shelf_scans;
CREATE POLICY scans_delete_admins ON public.shelf_scans FOR DELETE TO authenticated
  USING ((created_by = auth.uid()) OR private.has_org_role(org_id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role]));

-- scan_images
DROP POLICY IF EXISTS scan_images_select ON public.scan_images;
CREATE POLICY scan_images_select ON public.scan_images FOR SELECT TO authenticated USING (private.scan_in_my_org(scan_id));
DROP POLICY IF EXISTS scan_images_insert ON public.scan_images;
CREATE POLICY scan_images_insert ON public.scan_images FOR INSERT TO authenticated WITH CHECK (private.scan_in_my_org(scan_id));
DROP POLICY IF EXISTS scan_images_update ON public.scan_images;
CREATE POLICY scan_images_update ON public.scan_images FOR UPDATE TO authenticated USING (private.scan_in_my_org(scan_id)) WITH CHECK (private.scan_in_my_org(scan_id));
DROP POLICY IF EXISTS scan_images_delete ON public.scan_images;
CREATE POLICY scan_images_delete ON public.scan_images FOR DELETE TO authenticated USING (private.scan_in_my_org(scan_id));

-- scan_results
DROP POLICY IF EXISTS scan_results_select ON public.scan_results;
CREATE POLICY scan_results_select ON public.scan_results FOR SELECT TO authenticated USING (private.scan_in_my_org(scan_id));
DROP POLICY IF EXISTS scan_results_insert ON public.scan_results;
CREATE POLICY scan_results_insert ON public.scan_results FOR INSERT TO authenticated WITH CHECK (private.scan_in_my_org(scan_id));
DROP POLICY IF EXISTS scan_results_update ON public.scan_results;
CREATE POLICY scan_results_update ON public.scan_results FOR UPDATE TO authenticated USING (private.scan_in_my_org(scan_id)) WITH CHECK (private.scan_in_my_org(scan_id));

-- detected_products
DROP POLICY IF EXISTS detected_products_select ON public.detected_products;
CREATE POLICY detected_products_select ON public.detected_products FOR SELECT TO authenticated USING (private.scan_in_my_org(scan_id));
DROP POLICY IF EXISTS detected_products_insert ON public.detected_products;
CREATE POLICY detected_products_insert ON public.detected_products FOR INSERT TO authenticated WITH CHECK (private.scan_in_my_org(scan_id));
DROP POLICY IF EXISTS detected_products_update ON public.detected_products;
CREATE POLICY detected_products_update ON public.detected_products FOR UPDATE TO authenticated USING (private.scan_in_my_org(scan_id)) WITH CHECK (private.scan_in_my_org(scan_id));
DROP POLICY IF EXISTS detected_products_delete ON public.detected_products;
CREATE POLICY detected_products_delete ON public.detected_products FOR DELETE TO authenticated USING (private.scan_in_my_org(scan_id));

-- shelf_analytics
DROP POLICY IF EXISTS analytics_select_members ON public.shelf_analytics;
CREATE POLICY analytics_select_members ON public.shelf_analytics FOR SELECT TO authenticated USING (private.is_org_member(org_id, auth.uid()));
DROP POLICY IF EXISTS analytics_insert_members ON public.shelf_analytics;
CREATE POLICY analytics_insert_members ON public.shelf_analytics FOR INSERT TO authenticated WITH CHECK (private.is_org_member(org_id, auth.uid()));
DROP POLICY IF EXISTS analytics_update_members ON public.shelf_analytics;
CREATE POLICY analytics_update_members ON public.shelf_analytics FOR UPDATE TO authenticated USING (private.is_org_member(org_id, auth.uid())) WITH CHECK (private.is_org_member(org_id, auth.uid()));
DROP POLICY IF EXISTS analytics_delete_admins ON public.shelf_analytics;
CREATE POLICY analytics_delete_admins ON public.shelf_analytics FOR DELETE TO authenticated USING (private.has_org_role(org_id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role]));

-- drop the API-exposed helpers
DROP FUNCTION IF EXISTS public.is_org_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.has_org_role(uuid, uuid, public.app_role[]);
DROP FUNCTION IF EXISTS public.scan_in_my_org(uuid);