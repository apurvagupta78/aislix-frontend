-- Fix: demo seed failed in SQL editor with "Manager access required"
-- seed_hierarchy_profiles() checks auth.uid(); SQL editor has no JWT session.

CREATE OR REPLACE FUNCTION public.seed_hierarchy_profiles_bootstrap(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.hierarchy_profiles (org_id, operating_model, name, is_default, is_system, levels)
  VALUES
    (p_org_id, 'local_store', 'Local Store Default', true, true, jsonb_build_array(
      jsonb_build_object('key','region','label','Region','order',1),
      jsonb_build_object('key','city','label','City','order',2),
      jsonb_build_object('key','store','label','Store','order',3,'masterDataSource','store'),
      jsonb_build_object('key','department','label','Department/Aisle','order',4),
      jsonb_build_object('key','shelf','label','Shelf','order',5),
      jsonb_build_object('key','sku','label','SKU','order',6,'masterDataSource','product')
    )),
    (p_org_id, 'supermarket', 'Supermarket Default', true, true, jsonb_build_array(
      jsonb_build_object('key','region','label','Region','order',1),
      jsonb_build_object('key','city','label','City','order',2),
      jsonb_build_object('key','store','label','Store','order',3,'masterDataSource','store'),
      jsonb_build_object('key','department','label','Department','order',4),
      jsonb_build_object('key','aisle','label','Aisle','order',5),
      jsonb_build_object('key','shelf','label','Shelf','order',6),
      jsonb_build_object('key','sku','label','SKU','order',7,'masterDataSource','product')
    )),
    (p_org_id, 'dark_store', 'Dark Store Default', true, true, jsonb_build_array(
      jsonb_build_object('key','region','label','Region','order',1),
      jsonb_build_object('key','city','label','City','order',2),
      jsonb_build_object('key','dark_store','label','Dark Store','order',3,'masterDataSource','store'),
      jsonb_build_object('key','zone','label','Zone','order',4),
      jsonb_build_object('key','shelf','label','Shelf/Pick Face','order',5),
      jsonb_build_object('key','sku','label','SKU','order',6,'masterDataSource','product'),
      jsonb_build_object('key','batch','label','Batch/Unit','order',7)
    )),
    (p_org_id, 'warehouse', 'Warehouse Default', true, true, jsonb_build_array(
      jsonb_build_object('key','region','label','Region','order',1),
      jsonb_build_object('key','city','label','City','order',2),
      jsonb_build_object('key','warehouse','label','Warehouse','order',3,'masterDataSource','warehouse'),
      jsonb_build_object('key','zone','label','Zone','order',4),
      jsonb_build_object('key','aisle','label','Aisle','order',5),
      jsonb_build_object('key','rack','label','Rack','order',6),
      jsonb_build_object('key','bin','label','Bin','order',7),
      jsonb_build_object('key','sku','label','SKU/Batch','order',8,'masterDataSource','product')
    )),
    (p_org_id, 'fmcg_distributor', 'FMCG / Distributor Default', true, true, jsonb_build_array(
      jsonb_build_object('key','region','label','Region','order',1),
      jsonb_build_object('key','territory','label','Territory','order',2),
      jsonb_build_object('key','area','label','Area','order',3),
      jsonb_build_object('key','distributor','label','Distributor','order',4,'masterDataSource','distributor'),
      jsonb_build_object('key','sales_rep','label','Sales Representative','order',5,'masterDataSource','employee'),
      jsonb_build_object('key','beat','label','Beat','order',6),
      jsonb_build_object('key','outlet','label','Outlet','order',7,'masterDataSource','outlet'),
      jsonb_build_object('key','category','label','Category','order',8,'masterDataSource','category'),
      jsonb_build_object('key','brand','label','Brand','order',9,'masterDataSource','brand'),
      jsonb_build_object('key','sku','label','SKU','order',10,'masterDataSource','product')
    ))
  ON CONFLICT (org_id, operating_model, name) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_hierarchy_profiles_bootstrap(UUID) FROM PUBLIC;

-- Patch demo seed to use bootstrap (no auth.uid() manager gate)
CREATE OR REPLACE FUNCTION public.seed_aislix_demo_environment(
  p_owner_user_id UUID,
  p_force BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org UUID := public.aislix_demo_org_id();
  v_source_org UUID;
  v_tpl RECORD;
  v_scenario INT;
  v_created_at TIMESTAMPTZ;
  v_completed_at TIMESTAMPTZ;
  v_store_id UUID;
  v_audits INT := 0;
  v_templates INT := 0;
  v_days INT;
BEGIN
  IF p_owner_user_id IS NULL THEN
    RAISE EXCEPTION 'owner user id required';
  END IF;

  INSERT INTO public.organizations (id, name, slug, owner_id, is_demo, country, industry, customer_type)
  VALUES (v_org, 'Aislix Demo Showcase', 'aislix-demo', p_owner_user_id, true, 'India', 'retail', 'demo')
  ON CONFLICT (id) DO UPDATE SET is_demo = true, name = EXCLUDED.name;

  INSERT INTO public.organization_members (org_id, user_id, role, status)
  VALUES (v_org, p_owner_user_id, 'owner', 'active')
  ON CONFLICT (org_id, user_id) DO UPDATE SET role = 'owner', status = 'active';

  PERFORM public.seed_hierarchy_profiles_bootstrap(v_org);

  INSERT INTO public.stores (id, org_id, name, city, country, status, store_type)
  VALUES
    ('d0000001-0000-4000-8000-000000000001', v_org, 'More Mart — Bandra', 'Mumbai', 'India', 'active', 'supermarket'),
    ('d0000001-0000-4000-8000-000000000002', v_org, 'Big Bazaar — Koramangala', 'Bangalore', 'India', 'active', 'supermarket'),
    ('d0000001-0000-4000-8000-000000000003', v_org, 'Reliance Fresh — Connaught Place', 'Delhi', 'India', 'active', 'supermarket'),
    ('d0000002-0000-4000-8000-000000000001', v_org, 'Blinkit Dark Store — Sec 54 Gurgaon', 'Gurgaon', 'India', 'active', 'dark_store'),
    ('d0000002-0000-4000-8000-000000000002', v_org, 'Zepto Dark Store — HSR Layout', 'Bangalore', 'India', 'active', 'dark_store'),
    ('d0000003-0000-4000-8000-000000000001', v_org, 'Sharma Kirana — Pune Camp', 'Pune', 'India', 'active', 'local_store'),
    ('d0000003-0000-4000-8000-000000000002', v_org, 'Gupta General Store — Jaipur', 'Jaipur', 'India', 'active', 'local_store'),
    ('d0000004-0000-4000-8000-000000000001', v_org, 'Delhivery WH — Bhiwandi', 'Mumbai', 'India', 'active', 'warehouse'),
    ('d0000004-0000-4000-8000-000000000002', v_org, 'Flipkart FC — Hyderabad', 'Hyderabad', 'India', 'active', 'warehouse'),
    ('d0000005-0000-4000-8000-000000000001', v_org, 'HUL Distributor — Andheri East', 'Mumbai', 'India', 'active', 'outlet'),
    ('d0000005-0000-4000-8000-000000000002', v_org, 'PepsiCo Outlet — Saket', 'Delhi', 'India', 'active', 'outlet')
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = 'active';

  IF p_force THEN
    DELETE FROM public.corrective_actions WHERE org_id = v_org;
    DELETE FROM public.findings WHERE org_id = v_org;
    DELETE FROM public.digital_audit_lines WHERE org_id = v_org;
    DELETE FROM public.audit_evidence WHERE org_id = v_org;
    DELETE FROM public.shelf_scans WHERE org_id = v_org;
    DELETE FROM public.scan_assignments WHERE org_id = v_org;
  ELSIF EXISTS (SELECT 1 FROM public.scan_assignments WHERE org_id = v_org LIMIT 1) THEN
    RETURN jsonb_build_object(
      'org_id', v_org,
      'skipped', true,
      'message', 'Demo audits already exist. Pass p_force=true to reseed.'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.audit_templates WHERE org_id = v_org AND is_system_template LIMIT 1) THEN
    SELECT o.id INTO v_source_org
    FROM public.organizations o
    WHERE o.owner_id = p_owner_user_id
      AND o.id <> v_org
      AND COALESCE(o.is_demo, false) = false
    ORDER BY o.created_at
    LIMIT 1;

    IF v_source_org IS NOT NULL THEN
      INSERT INTO public.audit_templates (
        org_id, name, description, template_type, audit_mode, scope_type, scope_values,
        instructions, evidence_required, published, status, category, icon, audit_level,
        sections, field_definitions, rules, workflow_settings, scoring_config, ai_config,
        evidence_config, calculated_fields, operating_model, audit_purpose, subject_type,
        is_system_template, purpose_config, hierarchy_profile_id, hierarchy_bindings,
        visibility, short_description, version, created_by, is_active
      )
      SELECT
        v_org, t.name, t.description, t.template_type, t.audit_mode, t.scope_type, t.scope_values,
        t.instructions, t.evidence_required, t.published, t.status, t.category, t.icon, t.audit_level,
        t.sections, t.field_definitions, t.rules, t.workflow_settings, t.scoring_config, t.ai_config,
        t.evidence_config, t.calculated_fields, t.operating_model, t.audit_purpose, t.subject_type,
        t.is_system_template, t.purpose_config,
        hp_demo.id,
        t.hierarchy_bindings, t.visibility, t.short_description, t.version, p_owner_user_id, t.is_active
      FROM public.audit_templates t
      LEFT JOIN public.hierarchy_profiles hp_src
        ON hp_src.id = t.hierarchy_profile_id
      LEFT JOIN public.hierarchy_profiles hp_demo
        ON hp_demo.org_id = v_org
       AND hp_demo.operating_model = COALESCE(t.operating_model, hp_src.operating_model)
       AND hp_demo.is_default = true
      WHERE t.org_id = v_source_org
        AND t.is_system_template = true
        AND t.status = 'published';
    END IF;
  END IF;

  FOR v_tpl IN
    SELECT id, operating_model, name
    FROM public.audit_templates
    WHERE org_id = v_org AND is_system_template = true AND status = 'published'
    ORDER BY operating_model, name
  LOOP
    v_templates := v_templates + 1;

    SELECT id INTO v_store_id FROM public.stores
    WHERE org_id = v_org AND status = 'active'
      AND (
        (v_tpl.operating_model = 'supermarket' AND store_type = 'supermarket')
        OR (v_tpl.operating_model = 'dark_store' AND store_type = 'dark_store')
        OR (v_tpl.operating_model = 'local_store' AND store_type = 'local_store')
        OR (v_tpl.operating_model = 'warehouse' AND store_type = 'warehouse')
        OR (v_tpl.operating_model = 'fmcg_distributor' AND store_type = 'outlet')
      )
    ORDER BY created_at
    LIMIT 1;

    IF v_store_id IS NULL THEN
      SELECT id INTO v_store_id FROM public.stores WHERE org_id = v_org LIMIT 1;
    END IF;

    FOR v_scenario IN 0..4 LOOP
      v_days := 12 + (v_scenario * 14) + (v_templates % 7);
      v_created_at := now() - (v_days || ' days')::interval;
      v_completed_at := v_created_at + interval '4 hours';

      PERFORM public.seed_demo_completed_audit(
        v_org, v_store_id, v_tpl.id, p_owner_user_id, p_owner_user_id,
        v_created_at, v_completed_at, v_scenario,
        v_tpl.operating_model, v_tpl.name
      );
      v_audits := v_audits + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'org_id', v_org,
    'templates_seeded', v_templates,
    'audits_created', v_audits,
    'stores', (SELECT count(*) FROM public.stores WHERE org_id = v_org)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_aislix_demo_environment(UUID, BOOLEAN) TO authenticated;
