-- Demo people hierarchy for AISLIX_DEMO_ORG only.
-- Owner → North/South managers → auditors (member role).
-- Idempotent: reuses auth users by email / fixed ids; does not touch customer orgs.

CREATE OR REPLACE FUNCTION private.demo_ensure_auth_user(
  p_id UUID,
  p_email TEXT,
  p_full_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_id UUID;
  v_instance UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
  SELECT u.id INTO v_id
  FROM auth.users u
  WHERE lower(u.email) = lower(p_email)
  LIMIT 1;

  IF v_id IS NULL THEN
    SELECT u.id INTO v_id FROM auth.users u WHERE u.id = p_id LIMIT 1;
  END IF;

  IF v_id IS NULL THEN
    v_id := p_id;
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      invited_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token,
      is_sso_user,
      is_anonymous
    ) VALUES (
      v_instance,
      v_id,
      'authenticated',
      'authenticated',
      lower(p_email),
      extensions.crypt('demo-only-not-for-login', extensions.gen_salt('bf')),
      now(),
      now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object('full_name', p_full_name, 'name', p_full_name, 'demo', true),
      now(),
      now(),
      '',
      '',
      '',
      '',
      false,
      false
    );
  END IF;

  -- email on auth.identities is generated from identity_data
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  SELECT
    gen_random_uuid(),
    v_id,
    jsonb_build_object(
      'sub', v_id::text,
      'email', lower(p_email),
      'email_verified', true,
      'full_name', p_full_name
    ),
    'email',
    v_id::text,
    now(),
    now(),
    now()
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.identities i
    WHERE i.user_id = v_id AND i.provider = 'email'
  );

  INSERT INTO public.profiles (id, email, full_name)
  VALUES (v_id, lower(p_email), p_full_name)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        updated_at = now();

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION private.demo_ensure_auth_user(UUID, TEXT, TEXT) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.seed_demo_people_hierarchy()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_org UUID := public.aislix_demo_org_id();
  v_owner UUID;
  v_north UUID;
  v_south UUID;
  v_a1 UUID;
  v_a2 UUID;
  v_a3 UUID;
  v_store_count INT;
  -- Existing demo store ids (from seed_aislix_demo_environment)
  v_s_more UUID := 'd0000001-0000-4000-8000-000000000001';
  v_s_bigb UUID := 'd0000001-0000-4000-8000-000000000002';
  v_s_rel  UUID := 'd0000001-0000-4000-8000-000000000003';
  v_s_blink UUID := 'd0000002-0000-4000-8000-000000000001';
  v_s_zepto UUID := 'd0000002-0000-4000-8000-000000000002';
  v_s_sharma UUID := 'd0000003-0000-4000-8000-000000000001';
  v_s_gupta UUID := 'd0000003-0000-4000-8000-000000000002';
  v_s_delh UUID := 'd0000004-0000-4000-8000-000000000001';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = v_org AND COALESCE(o.is_demo, false) = true
  ) THEN
    RAISE EXCEPTION 'Demo org % missing or not flagged is_demo; refuse people hierarchy seed.', v_org;
  END IF;

  SELECT o.owner_id INTO v_owner
  FROM public.organizations o
  WHERE o.id = v_org;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Demo org has no owner_id';
  END IF;

  -- Ensure owner membership (do not overwrite store_ids / reports_to)
  INSERT INTO public.organization_members (org_id, user_id, role, status, store_ids, reports_to_user_id)
  VALUES (v_org, v_owner, 'owner', 'active', '{}'::uuid[], NULL)
  ON CONFLICT (org_id, user_id) DO UPDATE
    SET role = 'owner',
        status = 'active';

  -- Ensure ≥6–8 active stores (North/South naming when creating fallbacks)
  SELECT count(*) INTO v_store_count
  FROM public.stores
  WHERE org_id = v_org AND status = 'active';

  IF v_store_count < 6 THEN
    INSERT INTO public.stores (id, org_id, name, city, country, status, store_type)
    VALUES
      ('d0000001-0000-4000-8000-000000000001', v_org, 'DEMO North — Store A', 'Delhi', 'India', 'active', 'supermarket'),
      ('d0000001-0000-4000-8000-000000000002', v_org, 'DEMO South — Store A', 'Bangalore', 'India', 'active', 'supermarket'),
      ('d0000001-0000-4000-8000-000000000003', v_org, 'DEMO North — Store B', 'Gurgaon', 'India', 'active', 'supermarket'),
      ('d0000002-0000-4000-8000-000000000001', v_org, 'DEMO North — Dark Store', 'Delhi', 'India', 'active', 'dark_store'),
      ('d0000002-0000-4000-8000-000000000002', v_org, 'DEMO South — Dark Store', 'Bangalore', 'India', 'active', 'dark_store'),
      ('d0000003-0000-4000-8000-000000000001', v_org, 'DEMO South — Kirana', 'Pune', 'India', 'active', 'local_store'),
      ('d0000003-0000-4000-8000-000000000002', v_org, 'DEMO North — Kirana', 'Jaipur', 'India', 'active', 'local_store'),
      ('d0000004-0000-4000-8000-000000000001', v_org, 'DEMO South — Warehouse', 'Hyderabad', 'India', 'active', 'warehouse')
    ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          status = 'active',
          org_id = v_org;
  END IF;

  -- People (fixed ids for stable demos)
  v_north := private.demo_ensure_auth_user(
    'd0000010-0000-4000-8000-000000000001',
    'demo.north.manager@aislix.demo',
    'DEMO DATA — North Manager'
  );
  v_south := private.demo_ensure_auth_user(
    'd0000010-0000-4000-8000-000000000002',
    'demo.south.manager@aislix.demo',
    'DEMO DATA — South Manager'
  );
  v_a1 := private.demo_ensure_auth_user(
    'd0000010-0000-4000-8000-000000000003',
    'demo.auditor.1@aislix.demo',
    'DEMO DATA — Auditor 1 (North)'
  );
  v_a2 := private.demo_ensure_auth_user(
    'd0000010-0000-4000-8000-000000000004',
    'demo.auditor.2@aislix.demo',
    'DEMO DATA — Auditor 2 (North)'
  );
  v_a3 := private.demo_ensure_auth_user(
    'd0000010-0000-4000-8000-000000000005',
    'demo.auditor.3@aislix.demo',
    'DEMO DATA — Auditor 3 (South)'
  );

  -- Managers report to owner (insert/update managers first for reports_to validation)
  INSERT INTO public.organization_members (
    org_id, user_id, role, status, store_ids, reports_to_user_id, invited_email
  ) VALUES
    (
      v_org, v_north, 'manager', 'active',
      ARRAY[v_s_more, v_s_rel, v_s_blink, v_s_gupta]::uuid[],
      v_owner,
      'demo.north.manager@aislix.demo'
    ),
    (
      v_org, v_south, 'manager', 'active',
      ARRAY[v_s_bigb, v_s_zepto, v_s_sharma, v_s_delh]::uuid[],
      v_owner,
      'demo.south.manager@aislix.demo'
    )
  ON CONFLICT (org_id, user_id) DO UPDATE
    SET role = EXCLUDED.role,
        status = 'active',
        store_ids = EXCLUDED.store_ids,
        reports_to_user_id = EXCLUDED.reports_to_user_id,
        invited_email = EXCLUDED.invited_email,
        updated_at = now();

  -- Auditors (member) under regional managers — distinct direct stores
  INSERT INTO public.organization_members (
    org_id, user_id, role, status, store_ids, reports_to_user_id, invited_email
  ) VALUES
    (
      v_org, v_a1, 'member', 'active',
      ARRAY[v_s_more]::uuid[],
      v_north,
      'demo.auditor.1@aislix.demo'
    ),
    (
      v_org, v_a2, 'member', 'active',
      ARRAY[v_s_blink]::uuid[],
      v_north,
      'demo.auditor.2@aislix.demo'
    ),
    (
      v_org, v_a3, 'member', 'active',
      ARRAY[v_s_bigb]::uuid[],
      v_south,
      'demo.auditor.3@aislix.demo'
    )
  ON CONFLICT (org_id, user_id) DO UPDATE
    SET role = EXCLUDED.role,
        status = 'active',
        store_ids = EXCLUDED.store_ids,
        reports_to_user_id = EXCLUDED.reports_to_user_id,
        invited_email = EXCLUDED.invited_email,
        updated_at = now();

  RETURN jsonb_build_object(
    'org_id', v_org,
    'owner_user_id', v_owner,
    'north_manager_user_id', v_north,
    'south_manager_user_id', v_south,
    'auditor_1_user_id', v_a1,
    'auditor_2_user_id', v_a2,
    'auditor_3_user_id', v_a3,
    'stores', (SELECT count(*) FROM public.stores WHERE org_id = v_org AND status = 'active'),
    'members', (
      SELECT count(*) FROM public.organization_members
      WHERE org_id = v_org AND status = 'active'
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_demo_people_hierarchy() TO authenticated, service_role;

-- Apply once on migration
SELECT public.seed_demo_people_hierarchy();
