-- Field-team coverage and claim proof pack reports.
-- SECURITY INVOKER so row-level security decides which visits, stores, photos and people the caller sees.

CREATE OR REPLACE FUNCTION public.aislix_distance_m(
  lat1 double precision,
  lng1 double precision,
  lat2 double precision,
  lng2 double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lat1 IS NULL OR lng1 IS NULL OR lat2 IS NULL OR lng2 IS NULL THEN NULL
    ELSE 6371000 * 2 * asin(sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2)
      + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
    ))
  END
$$;

-- One row per completed visit with the best available GPS fix and where it sits relative to the store.
CREATE OR REPLACE FUNCTION public.aislix_visit_locations(
  p_org_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_store_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  scan_id uuid,
  store_id uuid,
  created_by uuid,
  created_at timestamptz,
  assignment_id uuid,
  audit_mode text,
  lat double precision,
  lng double precision,
  accuracy_m double precision,
  gps_source text,
  distance_m double precision,
  radius_m integer,
  location_status text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.store_id,
    s.created_by,
    s.created_at,
    s.assignment_id,
    s.audit_mode,
    g.lat,
    g.lng,
    g.accuracy_m,
    g.source,
    d.distance_m,
    COALESCE(st.geofence_radius_m, 200),
    CASE
      WHEN g.lat IS NULL THEN 'no_gps'
      WHEN st.latitude IS NULL OR st.longitude IS NULL THEN 'no_store_location'
      WHEN d.distance_m <= COALESCE(st.geofence_radius_m, 200) + LEAST(COALESCE(g.accuracy_m, 0), 100) THEN 'on_site'
      ELSE 'off_site'
    END
  FROM shelf_scans s
  LEFT JOIN stores st ON st.id = s.store_id
  LEFT JOIN LATERAL (
    SELECT ae.lat, ae.lng, ae.accuracy_m
    FROM audit_evidence ae
    WHERE ae.scan_id = s.id AND ae.lat IS NOT NULL AND ae.lng IS NOT NULL
    ORDER BY ae.captured_at NULLS LAST, ae.created_at
    LIMIT 1
  ) ev ON true
  CROSS JOIN LATERAL (
    SELECT
      CASE
        WHEN jsonb_typeof(s.capture_meta -> 'gps') = 'object' THEN aislix_jsonb_num(s.capture_meta -> 'gps' -> 'lat')::double precision
        WHEN s.submitted_lat IS NOT NULL THEN s.submitted_lat
        ELSE ev.lat
      END AS lat,
      CASE
        WHEN jsonb_typeof(s.capture_meta -> 'gps') = 'object' THEN aislix_jsonb_num(s.capture_meta -> 'gps' -> 'lng')::double precision
        WHEN s.submitted_lat IS NOT NULL THEN s.submitted_lng
        ELSE ev.lng
      END AS lng,
      CASE
        WHEN jsonb_typeof(s.capture_meta -> 'gps') = 'object' THEN aislix_jsonb_num(s.capture_meta -> 'gps' -> 'accuracy_m')::double precision
        WHEN s.submitted_lat IS NOT NULL THEN NULL
        ELSE ev.accuracy_m
      END AS accuracy_m,
      CASE
        WHEN jsonb_typeof(s.capture_meta -> 'gps') = 'object' THEN 'capture'
        WHEN s.submitted_lat IS NOT NULL THEN 'submit'
        WHEN ev.lat IS NOT NULL THEN 'photo'
      END AS source
  ) g
  CROSS JOIN LATERAL (
    SELECT aislix_distance_m(g.lat, g.lng, st.latitude::double precision, st.longitude::double precision) AS distance_m
  ) d
  WHERE s.org_id = p_org_id
    AND s.status = 'completed'
    AND s.parent_scan_id IS NULL
    AND s.created_at >= p_from
    AND s.created_at < p_to
    AND (p_store_ids IS NULL OR s.store_id = ANY (p_store_ids))
$$;

CREATE OR REPLACE FUNCTION public.field_team_coverage(
  p_org_id uuid,
  p_from timestamptz DEFAULT now() - interval '30 days',
  p_to timestamptz DEFAULT now(),
  p_store_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
WITH visits AS (
  SELECT * FROM aislix_visit_locations(p_org_id, p_from, p_to, p_store_ids)
),
planned AS (
  SELECT
    a.id,
    a.store_id,
    a.assignee_id,
    COALESCE(a.due_at, a.scheduled_at, a.created_at) AS planned_for,
    a.status = 'completed' OR COALESCE(sc.status::text = 'completed', false) AS done,
    NOT (a.status = 'completed' OR COALESCE(sc.status::text = 'completed', false))
      AND a.due_at IS NOT NULL AND a.due_at < now() AS missed
  FROM scan_assignments a
  LEFT JOIN shelf_scans sc ON sc.id = a.scan_id
  WHERE a.org_id = p_org_id
    AND a.status <> 'cancelled'
    AND COALESCE(a.due_at, a.scheduled_at, a.created_at) >= p_from
    AND COALESCE(a.due_at, a.scheduled_at, a.created_at) < p_to
    AND (p_store_ids IS NULL OR a.store_id = ANY (p_store_ids))
),
totals AS (
  SELECT jsonb_build_object(
    'visits', (SELECT count(*) FROM visits),
    'stores_visited', (SELECT count(DISTINCT store_id) FROM visits),
    'reps', (SELECT count(DISTINCT created_by) FROM visits),
    'gps_visits', (SELECT count(*) FROM visits WHERE location_status <> 'no_gps'),
    'on_site', (SELECT count(*) FROM visits WHERE location_status = 'on_site'),
    'off_site', (SELECT count(*) FROM visits WHERE location_status = 'off_site'),
    'no_store_location', (SELECT count(*) FROM visits WHERE location_status = 'no_store_location'),
    'unplanned_visits', (SELECT count(*) FROM visits WHERE assignment_id IS NULL),
    'planned', (SELECT count(*) FROM planned),
    'planned_done', (SELECT count(*) FROM planned WHERE done),
    'planned_missed', (SELECT count(*) FROM planned WHERE missed),
    'planned_open', (SELECT count(*) FROM planned WHERE NOT done AND NOT missed),
    'stores_planned', (SELECT count(DISTINCT store_id) FROM planned),
    'stores_planned_visited', (
      SELECT count(DISTINCT p.store_id) FROM planned p WHERE p.store_id IN (SELECT store_id FROM visits)
    )
  ) AS j
),
rep_ids AS (
  SELECT created_by AS user_id FROM visits WHERE created_by IS NOT NULL
  UNION
  SELECT assignee_id FROM planned WHERE assignee_id IS NOT NULL
),
reps AS (
  SELECT COALESCE(jsonb_agg(t ORDER BY t.visits DESC, t.name), '[]'::jsonb) AS j
  FROM (
    SELECT
      r.user_id,
      COALESCE(NULLIF(btrim(pr.full_name), ''), pr.email, 'Team member') AS name,
      (SELECT count(*) FROM visits v WHERE v.created_by = r.user_id) AS visits,
      (SELECT count(DISTINCT v.store_id) FROM visits v WHERE v.created_by = r.user_id) AS stores_visited,
      (SELECT count(*) FROM visits v WHERE v.created_by = r.user_id AND v.location_status <> 'no_gps') AS gps_visits,
      (SELECT count(*) FROM visits v WHERE v.created_by = r.user_id AND v.location_status = 'on_site') AS on_site,
      (SELECT count(*) FROM visits v WHERE v.created_by = r.user_id AND v.location_status = 'off_site') AS off_site,
      (SELECT count(*) FROM planned p WHERE p.assignee_id = r.user_id) AS planned,
      (SELECT count(*) FROM planned p WHERE p.assignee_id = r.user_id AND p.done) AS planned_done,
      (SELECT count(*) FROM planned p WHERE p.assignee_id = r.user_id AND p.missed) AS planned_missed,
      (SELECT max(v.created_at) FROM visits v WHERE v.created_by = r.user_id) AS last_visit
    FROM rep_ids r
    LEFT JOIN profiles pr ON pr.id = r.user_id
  ) t
),
store_ids AS (
  SELECT store_id FROM visits WHERE store_id IS NOT NULL
  UNION
  SELECT store_id FROM planned WHERE store_id IS NOT NULL
),
stores_j AS (
  SELECT COALESCE(jsonb_agg(t ORDER BY t.planned_missed DESC, t.visits, t.store_name), '[]'::jsonb) AS j
  FROM (
    SELECT
      si.store_id,
      COALESCE(st.name, 'Unnamed store') AS store_name,
      st.city,
      st.store_type,
      st.latitude IS NOT NULL AND st.longitude IS NOT NULL AS has_location,
      (SELECT count(*) FROM planned p WHERE p.store_id = si.store_id) AS planned,
      (SELECT count(*) FROM planned p WHERE p.store_id = si.store_id AND p.missed) AS planned_missed,
      (SELECT count(*) FROM visits v WHERE v.store_id = si.store_id) AS visits,
      (SELECT count(*) FROM visits v WHERE v.store_id = si.store_id AND v.location_status <> 'no_gps') AS gps_visits,
      (SELECT count(*) FROM visits v WHERE v.store_id = si.store_id AND v.location_status = 'on_site') AS on_site,
      (SELECT max(v.created_at) FROM visits v WHERE v.store_id = si.store_id) AS last_visit
    FROM store_ids si
    LEFT JOIN stores st ON st.id = si.store_id
    LIMIT 500
  ) t
),
daily AS (
  SELECT COALESCE(jsonb_agg(t ORDER BY t.day), '[]'::jsonb) AS j
  FROM (
    SELECT
      created_at::date AS day,
      count(*) AS visits,
      count(*) FILTER (WHERE location_status <> 'no_gps') AS gps_visits
    FROM visits
    GROUP BY 1
  ) t
)
SELECT jsonb_build_object(
  'from', p_from,
  'to', p_to,
  'totals', (SELECT j FROM totals),
  'reps', (SELECT j FROM reps),
  'stores', (SELECT j FROM stores_j),
  'daily', (SELECT j FROM daily)
);
$$;

CREATE OR REPLACE FUNCTION public.claim_proof_pack(
  p_org_id uuid,
  p_from timestamptz DEFAULT now() - interval '30 days',
  p_to timestamptz DEFAULT now(),
  p_store_ids uuid[] DEFAULT NULL,
  p_limit integer DEFAULT 200
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
WITH visits AS (
  SELECT * FROM aislix_visit_locations(p_org_id, p_from, p_to, p_store_ids)
),
pack AS (
  SELECT
    v.scan_id,
    v.store_id,
    COALESCE(st.name, 'Unnamed store') AS store_name,
    st.code AS store_code,
    st.city,
    concat_ws(', ', NULLIF(st.address_line1, ''), NULLIF(st.city, ''), NULLIF(st.pincode, '')) AS address,
    v.created_at,
    COALESCE(NULLIF(btrim(pr.full_name), ''), pr.email, 'Team member') AS captured_by,
    v.audit_mode,
    COALESCE(s.sub_category_label, s.category, s.shelf_label) AS category,
    v.lat,
    v.lng,
    v.accuracy_m,
    v.gps_source,
    round(v.distance_m::numeric, 0) AS distance_m,
    v.location_status,
    img.original_bucket,
    img.original_path,
    img.annotated_path,
    img.photos + COALESCE(ev.photos, 0) AS photo_count,
    sr_read.shelf_read,
    s.osa_percent AS osa,
    CASE WHEN sr_read.shelf_read THEN
      COALESCE(aislix_jsonb_num(r.metrics -> 'shelf_gap_count'), s.out_of_stock_count::numeric)
    END AS gaps,
    CASE WHEN sr_read.shelf_read THEN s.total_products END AS products,
    tb.brands AS top_brands
  FROM visits v
  JOIN shelf_scans s ON s.id = v.scan_id
  LEFT JOIN stores st ON st.id = v.store_id
  LEFT JOIN profiles pr ON pr.id = v.created_by
  LEFT JOIN LATERAL (
    SELECT
      (array_agg(si.storage_bucket ORDER BY si.created_at) FILTER (WHERE si.kind = 'original'))[1] AS original_bucket,
      (array_agg(si.storage_path ORDER BY si.created_at) FILTER (WHERE si.kind = 'original'))[1] AS original_path,
      (array_agg(si.storage_path ORDER BY si.created_at) FILTER (WHERE si.kind = 'annotated'))[1] AS annotated_path,
      count(*) FILTER (WHERE si.kind = 'original') AS photos
    FROM scan_images si
    WHERE si.scan_id = v.scan_id
  ) img ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS photos FROM audit_evidence ae WHERE ae.scan_id = v.scan_id
  ) ev ON true
  LEFT JOIN LATERAL (
    SELECT sr.metrics, sr.brand_share
    FROM scan_results sr
    WHERE sr.scan_id = v.scan_id
    ORDER BY sr.created_at DESC
    LIMIT 1
  ) r ON true
  CROSS JOIN LATERAL (
    SELECT (
      s.osa_percent IS NOT NULL
      OR COALESCE(s.total_products, 0) > 0
      OR COALESCE(r.metrics ? 'shelf_gap_count', false)
    ) AS shelf_read
  ) sr_read
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object('brand', b.brand, 'share', b.share) ORDER BY b.share DESC NULLS LAST) AS brands
    FROM (
      SELECT btrim(e ->> 'brand') AS brand, aislix_jsonb_num(e -> 'share') AS share
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(r.brand_share) = 'array' THEN r.brand_share ELSE '[]'::jsonb END
      ) e
      WHERE lower(regexp_replace(COALESCE(e ->> 'brand', ''), '[^[:alnum:]]', '', 'g'))
        NOT IN ('', 'unknown', 'unbranded', 'unidentified', 'generic', 'na', 'none', 'other', 'others')
      ORDER BY 2 DESC NULLS LAST
      LIMIT 3
    ) b
  ) tb ON true
)
SELECT jsonb_build_object(
  'from', p_from,
  'to', p_to,
  'totals', jsonb_build_object(
    'audits', (SELECT count(*) FROM pack),
    'stores', (SELECT count(DISTINCT store_id) FROM pack),
    'with_photo', (SELECT count(*) FROM pack WHERE photo_count > 0),
    'gps_audits', (SELECT count(*) FROM pack WHERE location_status <> 'no_gps'),
    'on_site', (SELECT count(*) FROM pack WHERE location_status = 'on_site'),
    'off_site', (SELECT count(*) FROM pack WHERE location_status = 'off_site')
  ),
  'audits', COALESCE((
    SELECT jsonb_agg(to_jsonb(x) ORDER BY x.store_name, x.created_at DESC)
    FROM (SELECT * FROM pack ORDER BY created_at DESC LIMIT GREATEST(COALESCE(p_limit, 200), 1)) x
  ), '[]'::jsonb)
);
$$;

GRANT EXECUTE ON FUNCTION public.aislix_distance_m(double precision, double precision, double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aislix_visit_locations(uuid, timestamptz, timestamptz, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.field_team_coverage(uuid, timestamptz, timestamptz, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_proof_pack(uuid, timestamptz, timestamptz, uuid[], integer) TO authenticated;

COMMENT ON FUNCTION public.field_team_coverage(uuid, timestamptz, timestamptz, uuid[]) IS
  'Completed visits per rep and per store, planned vs visited from assignments, and GPS on-site/off-site using the store geofence.';
COMMENT ON FUNCTION public.claim_proof_pack(uuid, timestamptz, timestamptz, uuid[], integer) IS
  'Per-visit evidence for claims: store, time, who captured it, photo paths, GPS fix and distance from the store, and the AI shelf read.';
