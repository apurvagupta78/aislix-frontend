/** Normalized Astra payloads returned by Railway. */

export type AstraImageQuality = {
  status: "GOOD" | "LIMITED" | "POOR" | string;
  reason?: string;
};

export type AstraPlanogramProduct = {
  location: string;
  category: string;
  subcategory: string;
  brand: string;
  brand_status: string;
  product_name: string;
  product_status: string;
  variant: string;
  variant_status: string;
  sku: string;
  sku_status: string;
  expected_facings: number;
  /** Null when not detected / unverifiable — never coerce to a fake 0. */
  actual_facings: number | null;
  facing_variance: number | null;
  facing_compliance_percent: number | null;
  min_facings: number;
  max_facings: number;
  facing_range_status: string;
  expected_shelf_units: number;
  actual_visible_units: number | null;
  shelf_unit_variance: number | null;
  shelf_unit_compliance_percent: number | null;
  expected_shelf_position: string;
  actual_shelf_position: string;
  placement_status: string;
  expected_mrp_inr: number;
  visible_price: string | null;
  price_status: string;
  avg_daily_sales: number;
  estimated_visible_shelf_coverage_days: number | null;
  visible_unit_shortfall: number | null;
  potential_visible_unit_value_gap_inr: number | null;
  risk_status: string;
  overall_status: string;
  match_status: string;
  confidence: number;
  evidence_note: string;
};

export type AstraPlanogramBrandAnalysis = {
  brand: string;
  expected_facings: number;
  actual_facings: number;
  expected_share_percent: number;
  actual_share_percent: number;
  share_variance_pp: number;
  status: string;
};

export type AstraPlanogramCategoryAnalysis = {
  category: string;
  expected_facings: number;
  actual_facings: number;
  expected_share_percent: number;
  actual_share_percent: number;
  compliance_percent: number | null;
  status: string;
};

export type AstraPlanogramSubcategoryAnalysis = {
  subcategory: string;
  expected_facings: number;
  actual_facings: number;
  compliance_percent: number | null;
  status: string;
};

export type AstraUnplannedProduct = {
  brand: string;
  product_name: string;
  variant: string;
  actual_facings: number;
  actual_visible_units: number;
  confidence: number;
};

export type AstraPlanogramSummary = {
  total_planogram_rows: number;
  products_matched: number;
  products_not_found: number;
  products_not_verifiable: number;
  non_compliant_products: number;
  products_below_expected_facings: number;
  products_below_minimum_facings: number;
  products_above_maximum_facings: number;
  products_below_expected_units: number;
  wrong_placements: number;
  price_mismatches: number;
  high_priority_execution_risks: number;
  total_expected_facings: number;
  total_actual_facings: number;
  total_expected_shelf_units: number;
  total_actual_visible_units: number;
  overall_facing_compliance_percent: number | null;
  overall_shelf_unit_compliance_percent: number | null;
  overall_planogram_compliance_percent: number | null;
  total_potential_visible_unit_value_gap_inr: number;
};

export type AstraShelfProduct = {
  brand: string;
  brand_status: string;
  product_name: string;
  product_status: string;
  variant: string;
  variant_status: string;
  category: string;
  category_status: string;
  subcategory: string;
  subcategory_status: string;
  shelf_position: string;
  actual_facings: number;
  actual_visible_units: number;
  confidence: number;
  evidence_note: string;
};

export type AstraShelfBrandAnalysis = {
  brand: string;
  facings: number;
  visible_units: number;
  share_of_facings_percent: number;
  share_of_visible_units_percent: number;
  rank_by_facings: number;
  rank_by_visible_units: number;
  confidence: number;
};

export type AstraShelfCategoryAnalysis = {
  category: string;
  facings: number;
  visible_units: number;
  share_of_facings_percent: number;
  share_of_visible_units_percent: number;
  confidence: number;
};

export type AstraFocusBrandAnalysis = {
  brand: string;
  facings: number;
  visible_units: number;
  share_of_facings_percent: number;
  share_of_visible_units_percent: number;
  status: string;
};

export type AstraShelfStructure = {
  visible_shelf_levels: number;
  notes: string;
};

export type AstraVisiblePrice = {
  product_name?: string;
  brand?: string;
  price?: string;
  price_type?: string;
  confidence?: number;
};

export type AstraVisiblePromotion = {
  brand?: string;
  product_name?: string;
  product_or_brand?: string;
  promotion_text?: string;
  promotion_type?: string;
  confidence?: number;
};

export type AstraShelfIssue = {
  issue_type?: string;
  description?: string;
  shelf_position?: string;
  severity?: string;
  confidence?: number;
};

export type AstraShelfSummary = {
  products_identified: number;
  brands_identified: number;
  variants_identified: number;
  visible_facings: number;
  visible_units: number;
  prices_read: number;
  promotions_identified: number;
  shelf_issues_identified: number;
};

export type NormalizedAstraAnalysis =
  | {
      mode: "planogram";
      operating_model?: string;
      location?: string;
      image_quality?: AstraImageQuality;
      products: AstraPlanogramProduct[];
      brand_analysis: AstraPlanogramBrandAnalysis[];
      category_analysis: AstraPlanogramCategoryAnalysis[];
      subcategory_analysis: AstraPlanogramSubcategoryAnalysis[];
      observed_unplanned_products: AstraUnplannedProduct[];
      summary: AstraPlanogramSummary;
    }
  | {
      mode: "shelf_only";
      operating_model?: string;
      location?: string;
      location_status?: string;
      image_quality?: AstraImageQuality;
      shelf_structure?: AstraShelfStructure;
      products: AstraShelfProduct[];
      brand_analysis: AstraShelfBrandAnalysis[];
      category_analysis: AstraShelfCategoryAnalysis[];
      focus_brand_analysis?: AstraFocusBrandAnalysis;
      visible_prices: AstraVisiblePrice[];
      visible_promotions: AstraVisiblePromotion[];
      shelf_issues: AstraShelfIssue[];
      summary: AstraShelfSummary;
    }
  | { mode: "incomplete"; reason: string };

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "N/A") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function pickRecord(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  return payload as Record<string, unknown>;
}

function pickArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function imageQuality(raw: unknown): AstraImageQuality | undefined {
  const obj = pickRecord(raw);
  if (!obj) return undefined;
  const status = str(obj.status);
  if (!status) return undefined;
  return { status, reason: str(obj.reason) || undefined };
}

function metricField(raw: unknown): number | null {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return numOrNull((raw as Record<string, unknown>).value);
  }
  return numOrNull(raw);
}

function displayBrandName(brand: string): string {
  const t = brand.trim();
  if (/^(lays|louis)$/i.test(t)) return "Lay's";
  return t;
}

function statusToken(...values: unknown[]): string {
  for (const value of values) {
    const s = str(value).trim();
    if (s) return s.toUpperCase();
  }
  return "";
}

function isUnverifiableToken(value: string): boolean {
  return /UNVERIFIABLE|UNIDENTIFIED|UNKNOWN/.test(value.toUpperCase());
}

function isMatchedToken(value: string): boolean {
  const u = value.toUpperCase();
  return u.includes("MATCHED") || u === "IDENTIFIED" || u === "COMPLIANT" || u === "PRESENT";
}

function isNotFoundToken(value: string): boolean {
  const u = value.toUpperCase();
  return u.includes("NOT_FOUND") || u.includes("MISSING") || u === "ABSENT";
}

function normalizePlanogramProduct(raw: unknown): AstraPlanogramProduct {
  const r = (raw ?? {}) as Record<string, unknown>;
  const facingCompliance = r.facing_compliance_percent ?? r.facing_compliance;
  const shelfUnitCompliance = r.shelf_unit_compliance_percent ?? r.shelf_unit_compliance;
  const facingVariance = r.facing_variance;
  const shelfUnitVariance = r.shelf_unit_variance;
  const shortfall = r.visible_unit_shortfall;
  const valueGap = r.potential_visible_unit_value_gap ?? r.potential_visible_unit_value_gap_inr;
  const coverage = r.estimated_visible_shelf_coverage_days;
  const matchStatus = statusToken(r.match_status);
  const overallStatus = statusToken(
    r.overall_status,
    r.overall_row_status,
    r.match_status,
    r.product_status,
  );
  return {
    location: str(r.location),
    category: str(r.category),
    subcategory: str(r.subcategory ?? r.sub_category),
    brand: displayBrandName(str(r.brand)),
    brand_status: str(r.brand_status),
    product_name: str(r.product_name),
    product_status: str(r.product_status),
    variant: str(r.variant),
    variant_status: str(r.variant_status),
    sku: str(r.sku),
    sku_status: str(r.sku_status),
    expected_facings: num(r.expected_facings),
    actual_facings: numOrNull(r.actual_facings),
    facing_variance: numOrNull(
      typeof facingVariance === "object" ? metricField(facingVariance) : facingVariance,
    ),
    facing_compliance_percent: metricField(facingCompliance),
    min_facings: num(r.min_facings),
    max_facings: num(r.max_facings),
    facing_range_status: str(r.facing_range_status ?? r.facings_range_status ?? r.min_max_facing_status),
    expected_shelf_units: num(r.expected_shelf_units),
    actual_visible_units: numOrNull(r.actual_visible_units),
    shelf_unit_variance: numOrNull(
      typeof shelfUnitVariance === "object" ? metricField(shelfUnitVariance) : shelfUnitVariance,
    ),
    shelf_unit_compliance_percent: metricField(shelfUnitCompliance),
    expected_shelf_position: str(r.expected_shelf_position),
    actual_shelf_position: str(r.actual_shelf_position),
    placement_status: str(r.placement_status),
    expected_mrp_inr: num(r.expected_mrp_inr),
    visible_price: r.visible_price != null ? String(r.visible_price) : null,
    price_status: str(r.price_status),
    avg_daily_sales: num(r.avg_daily_sales),
    estimated_visible_shelf_coverage_days: metricField(coverage),
    visible_unit_shortfall: numOrNull(typeof shortfall === "object" ? metricField(shortfall) : shortfall),
    potential_visible_unit_value_gap_inr: numOrNull(
      typeof valueGap === "object" ? metricField(valueGap) : valueGap,
    ),
    risk_status: str(r.risk_status),
    overall_status: overallStatus,
    match_status: matchStatus || overallStatus,
    confidence: num(r.confidence),
    evidence_note: str(r.evidence_note),
  };
}

function summaryLooksEmpty(summary: AstraPlanogramSummary): boolean {
  return (
    summary.total_planogram_rows === 0 &&
    summary.products_matched === 0 &&
    summary.products_not_found === 0 &&
    summary.products_not_verifiable === 0 &&
    summary.non_compliant_products === 0 &&
    summary.total_expected_facings === 0 &&
    summary.total_actual_facings === 0
  );
}

function derivePlanogramSummaryFromProducts(
  products: AstraPlanogramProduct[],
  calc: Record<string, unknown> | null,
  countValidation: Record<string, unknown> | null,
  base: AstraPlanogramSummary,
): AstraPlanogramSummary {
  let matched = 0;
  let notFound = 0;
  let unverifiable = 0;
  let nonCompliant = 0;
  let belowExpFacings = 0;
  let belowMinFacings = 0;
  let aboveMaxFacings = 0;
  let belowExpUnits = 0;
  let wrongPlacements = 0;
  let priceMismatches = 0;
  let expectedFacings = 0;
  let actualFacings = 0;
  let expectedUnits = 0;
  let actualUnits = 0;
  let valueGap = 0;

  for (const row of products) {
    expectedFacings += row.expected_facings || 0;
    expectedUnits += row.expected_shelf_units || 0;
    if (row.actual_facings != null) actualFacings += row.actual_facings;
    if (row.actual_visible_units != null) actualUnits += row.actual_visible_units;
    if (row.potential_visible_unit_value_gap_inr != null) {
      valueGap += row.potential_visible_unit_value_gap_inr;
    }

    const status = statusToken(row.match_status, row.overall_status, row.product_status);
    if (isNotFoundToken(status)) notFound += 1;
    else if (isUnverifiableToken(status) || isUnverifiableToken(row.variant_status)) unverifiable += 1;
    else if (isMatchedToken(status) || isMatchedToken(row.brand_status)) matched += 1;
    else if (status) nonCompliant += 1;

    if (row.actual_facings != null && row.expected_facings > 0 && row.actual_facings < row.expected_facings) {
      belowExpFacings += 1;
    }
    if (row.min_facings > 0 && row.actual_facings != null && row.actual_facings < row.min_facings) {
      belowMinFacings += 1;
    }
    if (row.max_facings > 0 && row.actual_facings != null && row.actual_facings > row.max_facings) {
      aboveMaxFacings += 1;
    }
    if (
      row.actual_visible_units != null &&
      row.expected_shelf_units > 0 &&
      row.actual_visible_units < row.expected_shelf_units
    ) {
      belowExpUnits += 1;
    }
    if (/WRONG/i.test(row.placement_status)) wrongPlacements += 1;
    if (/MISMATCH/i.test(row.price_status)) priceMismatches += 1;
  }

  const verifiedFacings = numOrNull(
    pickRecord(countValidation?.total_actual_facings)?.verified_value ??
      pickRecord(countValidation?.total_actual_facings)?.product_sum,
  );
  const verifiedUnits = numOrNull(
    pickRecord(countValidation?.total_actual_visible_units)?.verified_value ??
      pickRecord(countValidation?.total_actual_visible_units)?.product_sum,
  );
  const calcActualFacings = metricField(calc?.total_actual_facings);
  const calcActualUnits = metricField(calc?.total_actual_visible_units);
  const calcFacingPct = metricField(calc?.overall_facing_compliance);
  const calcPlanoPct = metricField(calc?.planogram_compliance);

  return {
    total_planogram_rows: products.length || base.total_planogram_rows,
    products_matched: matched || base.products_matched,
    products_not_found: notFound || base.products_not_found,
    products_not_verifiable: unverifiable || base.products_not_verifiable,
    non_compliant_products: nonCompliant || base.non_compliant_products,
    products_below_expected_facings: belowExpFacings || base.products_below_expected_facings,
    products_below_minimum_facings: belowMinFacings || base.products_below_minimum_facings,
    products_above_maximum_facings: aboveMaxFacings || base.products_above_maximum_facings,
    products_below_expected_units: belowExpUnits || base.products_below_expected_units,
    wrong_placements: wrongPlacements || base.wrong_placements,
    price_mismatches: priceMismatches || base.price_mismatches,
    high_priority_execution_risks: base.high_priority_execution_risks,
    total_expected_facings: expectedFacings || base.total_expected_facings,
    total_actual_facings:
      verifiedFacings ?? calcActualFacings ?? actualFacings ?? base.total_actual_facings,
    total_expected_shelf_units: expectedUnits || base.total_expected_shelf_units,
    total_actual_visible_units:
      verifiedUnits ?? calcActualUnits ?? actualUnits ?? base.total_actual_visible_units,
    overall_facing_compliance_percent:
      calcFacingPct ?? base.overall_facing_compliance_percent,
    overall_shelf_unit_compliance_percent: base.overall_shelf_unit_compliance_percent,
    overall_planogram_compliance_percent:
      calcPlanoPct ?? base.overall_planogram_compliance_percent,
    total_potential_visible_unit_value_gap_inr:
      valueGap || base.total_potential_visible_unit_value_gap_inr,
  };
}

/**
 * When planogram matching left a row UNVERIFIABLE with null actuals, but shelf CV
 * counted the same brand/product as an UNVERIFIABLE variant with matching facings,
 * attribute those counts so the UI does not show a fake zero.
 */
function attributeUnverifiableShelfFacings(
  products: AstraPlanogramProduct[],
  root: Record<string, unknown>,
): AstraPlanogramProduct[] {
  const nested = pickRecord(root.metrics) ?? pickRecord(root.result);
  const shelfRows = [
    ...pickArray(root.products),
    ...pickArray(nested?.products),
  ] as Record<string, unknown>[];
  if (!shelfRows.length) return products;

  const pool = shelfRows
    .map((row) => ({
      brand: displayBrandName(str(row.brand)).toLowerCase(),
      product: str(row.product_name ?? row.name).toLowerCase(),
      variant: str(row.variant).toUpperCase(),
      facings: numOrNull(row.facings ?? row.actual_facings),
      units: numOrNull(row.quantity ?? row.actual_visible_units ?? row.facings),
      used: false,
    }))
    .filter((row) => isUnverifiableToken(row.variant) && row.facings != null && row.facings > 0);

  if (!pool.length) return products;

  return products.map((product) => {
    if (product.actual_facings != null) return product;
    const status = statusToken(product.match_status, product.overall_status, product.variant_status);
    if (!isUnverifiableToken(status) && !isNotFoundToken(status)) return product;

    const brand = product.brand.toLowerCase().replace(/['']/g, "");
    const name = product.product_name.toLowerCase();
    const hit =
      pool.find(
        (row) =>
          !row.used &&
          row.brand.replace(/['']/g, "") === brand &&
          (row.product === name ||
            (!!row.product && !!name && (row.product.includes(name) || name.includes(row.product))) ||
            row.product.includes("chip") === name.includes("chip")) &&
          row.facings === product.expected_facings,
      ) ??
      pool.find(
        (row) =>
          !row.used &&
          row.brand.replace(/['']/g, "") === brand &&
          row.facings === product.expected_facings,
      );
    if (!hit || hit.facings == null) return product;
    hit.used = true;
    return {
      ...product,
      actual_facings: hit.facings,
      actual_visible_units: hit.units ?? hit.facings,
      facing_variance:
        product.expected_facings > 0 ? hit.facings - product.expected_facings : null,
      facing_compliance_percent:
        product.expected_facings > 0
          ? Math.round((hit.facings / product.expected_facings) * 1000) / 10
          : null,
      overall_status: product.overall_status || "UNVERIFIABLE",
      match_status: product.match_status || "UNVERIFIABLE",
      variant_status: product.variant_status || "UNVERIFIABLE",
      evidence_note:
        product.evidence_note ||
        "Variant text was unreadable; facings attributed from an unverifiable shelf detection with the same expected count.",
    };
  });
}

/**
 * When aggregate facing totals exceed the sum of row actuals, attribute the residual
 * gap to the unique UNVERIFIABLE/null planogram row (prefer expected_facings === gap).
 * Universal — not scan-specific.
 */
function attributeResidualUnverifiableFacings(
  products: AstraPlanogramProduct[],
  totalActualFacings: number | null,
  totalActualUnits: number | null,
): AstraPlanogramProduct[] {
  if (totalActualFacings == null || totalActualFacings <= 0) return products;
  const knownFacings = products.reduce((sum, row) => sum + (row.actual_facings ?? 0), 0);
  const facingGap = totalActualFacings - knownFacings;
  if (facingGap <= 0) return products;

  const openIdx = products
    .map((row, idx) => ({ row, idx }))
    .filter(({ row }) => {
      if (row.actual_facings != null) return false;
      const status = statusToken(row.match_status, row.overall_status, row.variant_status);
      return isUnverifiableToken(status) || isNotFoundToken(status) || !status;
    });
  if (!openIdx.length) return products;

  const exact = openIdx.filter(({ row }) => row.expected_facings === facingGap);
  const pick = exact.length === 1 ? exact[0] : openIdx.length === 1 ? openIdx[0] : null;
  if (!pick) return products;

  const knownUnits = products.reduce((sum, row) => sum + (row.actual_visible_units ?? 0), 0);
  const unitGap =
    totalActualUnits != null && totalActualUnits > knownUnits
      ? totalActualUnits - knownUnits
      : facingGap;

  return products.map((row, idx) => {
    if (idx !== pick.idx) return row;
    return {
      ...row,
      actual_facings: facingGap,
      actual_visible_units: row.actual_visible_units ?? unitGap,
      facing_variance:
        row.expected_facings > 0 ? facingGap - row.expected_facings : null,
      facing_compliance_percent:
        row.expected_facings > 0
          ? Math.round((facingGap / row.expected_facings) * 1000) / 10
          : null,
      overall_status: row.overall_status || "UNVERIFIABLE",
      match_status: row.match_status || "UNVERIFIABLE",
      evidence_note:
        row.evidence_note ||
        "Facings attributed from verified shelf total residual; variant text was not readable.",
    };
  });
}

function normalizePlanogramSummary(raw: unknown): AstraPlanogramSummary {
  const s = (raw ?? {}) as Record<string, unknown>;
  return {
    total_planogram_rows: num(s.total_planogram_rows),
    products_matched: num(s.products_matched ?? s.matched_rows),
    products_not_found: num(s.products_not_found ?? s.not_found_rows),
    products_not_verifiable: num(s.products_not_verifiable ?? s.not_verifiable_rows),
    non_compliant_products: num(s.non_compliant_products ?? s.non_compliant_rows),
    products_below_expected_facings: num(s.products_below_expected_facings),
    products_below_minimum_facings: num(s.products_below_minimum_facings),
    products_above_maximum_facings: num(s.products_above_maximum_facings),
    products_below_expected_units: num(s.products_below_expected_units),
    wrong_placements: num(s.wrong_placements),
    price_mismatches: num(s.price_mismatches),
    high_priority_execution_risks: num(s.high_priority_execution_risks),
    total_expected_facings: num(s.total_expected_facings),
    total_actual_facings: num(s.total_actual_facings),
    total_expected_shelf_units: num(s.total_expected_shelf_units),
    total_actual_visible_units: num(s.total_actual_visible_units),
    overall_facing_compliance_percent: numOrNull(s.overall_facing_compliance_percent),
    overall_shelf_unit_compliance_percent: numOrNull(s.overall_shelf_unit_compliance_percent),
    overall_planogram_compliance_percent: numOrNull(
      s.overall_planogram_compliance_percent ?? s.overall_compliance_percent,
    ),
    total_potential_visible_unit_value_gap_inr: num(s.total_potential_visible_unit_value_gap_inr),
  };
}

function normalizePlanogramBlock(
  block: Record<string, unknown>,
  root?: Record<string, unknown> | null,
): NormalizedAstraAnalysis | null {
  const rows = pickArray(block.rows).length
    ? pickArray(block.rows)
    : pickArray(block.products);
  if (!rows.length) return null;
  const calc = pickRecord(block.calculated_metrics);
  const countValidation = pickRecord(block.count_validation);
  const planoCompliance = metricField(calc?.planogram_compliance);
  const facingCompliance = metricField(calc?.overall_facing_compliance);
  const summaryRaw = pickRecord(block.summary);
  let products = rows.map(normalizePlanogramProduct);
  if (root) {
    products = attributeUnverifiableShelfFacings(products, root);
  }
  const verifiedFacings = numOrNull(
    pickRecord(countValidation?.total_actual_facings)?.verified_value ??
      pickRecord(countValidation?.total_actual_facings)?.product_sum,
  );
  const verifiedUnits = numOrNull(
    pickRecord(countValidation?.total_actual_visible_units)?.verified_value ??
      pickRecord(countValidation?.total_actual_visible_units)?.product_sum,
  );
  products = attributeResidualUnverifiableFacings(
    products,
    verifiedFacings ?? metricField(calc?.total_actual_facings),
    verifiedUnits ?? metricField(calc?.total_actual_visible_units),
  );
  const baseSummary = normalizePlanogramSummary(block.summary ?? summaryRaw);
  const derivedSummary = derivePlanogramSummaryFromProducts(
    products,
    calc,
    countValidation,
    baseSummary,
  );
  const summary = summaryLooksEmpty(baseSummary)
    ? derivedSummary
    : {
        ...derivedSummary,
        // Prefer explicit Astra summary funnel counts when present; keep derived totals.
        products_matched: baseSummary.products_matched || derivedSummary.products_matched,
        products_not_found: baseSummary.products_not_found || derivedSummary.products_not_found,
        products_not_verifiable:
          baseSummary.products_not_verifiable || derivedSummary.products_not_verifiable,
        non_compliant_products:
          baseSummary.non_compliant_products || derivedSummary.non_compliant_products,
      };

  return {
    mode: "planogram",
    operating_model: str(block.operating_model) || undefined,
    location: str(block.location) || undefined,
    image_quality: imageQuality(block.image_quality),
    products,
    brand_analysis: pickArray(block.brand_analysis).map((raw) => {
      const b = (raw ?? {}) as Record<string, unknown>;
      return {
        brand: displayBrandName(str(b.brand)),
        expected_facings: num(b.expected_facings),
        actual_facings: num(b.actual_facings),
        expected_share_percent: num(b.expected_share_percent),
        actual_share_percent: num(b.actual_share_percent),
        share_variance_pp: num(b.share_variance_pp),
        status: str(b.status),
      };
    }),
    category_analysis: pickArray(block.category_analysis).map((raw) => {
      const c = (raw ?? {}) as Record<string, unknown>;
      return {
        category: str(c.category),
        expected_facings: num(c.expected_facings),
        actual_facings: num(c.actual_facings),
        expected_share_percent: num(c.expected_share_percent),
        actual_share_percent: num(c.actual_share_percent),
        compliance_percent: numOrNull(c.compliance_percent),
        status: str(c.status),
      };
    }),
    subcategory_analysis: pickArray(block.subcategory_analysis).map((raw) => {
      const sc = (raw ?? {}) as Record<string, unknown>;
      return {
        subcategory: str(sc.subcategory),
        expected_facings: num(sc.expected_facings),
        actual_facings: num(sc.actual_facings),
        compliance_percent: numOrNull(sc.compliance_percent),
        status: str(sc.status),
      };
    }),
    observed_unplanned_products: pickArray(block.observed_unplanned_products).map((raw) => {
      const u = (raw ?? {}) as Record<string, unknown>;
      return {
        brand: displayBrandName(str(u.brand)),
        product_name: str(u.product_name),
        variant: str(u.variant),
        actual_facings: num(u.actual_facings),
        actual_visible_units: num(u.actual_visible_units),
        confidence: num(u.confidence),
      };
    }),
    summary: {
      ...summary,
      overall_planogram_compliance_percent:
        planoCompliance ?? summary.overall_planogram_compliance_percent,
      overall_facing_compliance_percent:
        facingCompliance ?? summary.overall_facing_compliance_percent,
    },
  };
}

function normalizeShelfProduct(raw: unknown): AstraShelfProduct {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    brand: str(r.brand),
    brand_status: str(r.brand_status),
    product_name: str(r.product_name),
    product_status: str(r.product_status),
    variant: str(r.variant),
    variant_status: str(r.variant_status),
    category: str(r.category),
    category_status: str(r.category_status),
    subcategory: str(r.subcategory ?? r.sub_category),
    subcategory_status: str(r.subcategory_status ?? r.sub_category_status),
    shelf_position: str(r.shelf_position),
    actual_facings: num(r.actual_facings ?? r.facings),
    actual_visible_units: num(r.actual_visible_units ?? r.quantity),
    confidence: num(r.confidence),
    evidence_note: str(r.evidence_note),
  };
}

function normalizeShelfSummary(raw: unknown): AstraShelfSummary {
  const s = (raw ?? {}) as Record<string, unknown>;
  return {
    products_identified: num(s.products_identified),
    brands_identified: num(s.brands_identified),
    variants_identified: num(s.variants_identified),
    visible_facings: num(s.visible_facings),
    visible_units: num(s.visible_units),
    prices_read: num(s.prices_read),
    promotions_identified: num(s.promotions_identified),
    shelf_issues_identified: num(s.shelf_issues_identified),
  };
}

function normalizeShelfBlock(block: Record<string, unknown>): NormalizedAstraAnalysis | null {
  const products = pickArray(block.products);
  if (
    !products.length &&
    str(block.mode).toLowerCase() !== "image_only_shelf_analysis" &&
    str(block.analysis_type) !== "shelf_cv"
  ) {
    return null;
  }
  const calc = pickRecord(block.calculated_metrics);
  const summaryRaw = pickRecord(block.summary);
  const focus = pickRecord(block.focus_brand_analysis);
  const shelfStructure = pickRecord(block.shelf_structure);

  const brandRows = pickArray(block.brand_analysis).map((raw) => {
    const b = (raw ?? {}) as Record<string, unknown>;
    const shareBlock = pickRecord(b.share);
    const shareValue =
      typeof b.share_of_facings_percent === "number"
        ? num(b.share_of_facings_percent)
        : shareBlock
          ? num(shareBlock.value)
          : 0;
    return {
      brand: str(b.brand),
      facings: num(b.facings ?? b.actual_facings),
      visible_units: num(b.visible_units ?? b.actual_visible_units),
      share_of_facings_percent: shareValue,
      share_of_visible_units_percent: num(b.share_of_visible_units_percent),
      rank_by_facings: num(b.rank_by_facings),
      rank_by_visible_units: num(b.rank_by_visible_units),
      confidence: num(b.confidence),
    };
  });

  // If Aislix returned brand_analysis without ranks, rank by facings for the UI.
  if (brandRows.some((row) => !row.rank_by_facings) && brandRows.length) {
    const ranked = [...brandRows].sort((a, b) => b.facings - a.facings);
    ranked.forEach((row, index) => {
      if (!row.rank_by_facings) row.rank_by_facings = index + 1;
    });
  }

  return {
    mode: "shelf_only",
    operating_model: str(block.operating_model) || undefined,
    location: str(block.location) || undefined,
    location_status: str(block.location_status) || undefined,
    image_quality: imageQuality(block.image_quality),
    shelf_structure: shelfStructure
      ? {
          visible_shelf_levels: num(shelfStructure.visible_shelf_levels),
          notes: str(shelfStructure.notes),
        }
      : undefined,
    products: products.map(normalizeShelfProduct),
    brand_analysis: brandRows,
    category_analysis: pickArray(block.category_analysis).map((raw) => {
      const c = (raw ?? {}) as Record<string, unknown>;
      return {
        category: str(c.category),
        facings: num(c.facings ?? c.actual_facings),
        visible_units: num(c.visible_units ?? c.actual_visible_units),
        share_of_facings_percent: num(c.share_of_facings_percent),
        share_of_visible_units_percent: num(c.share_of_visible_units_percent),
        confidence: num(c.confidence),
      };
    }),
    focus_brand_analysis: focus
      ? {
          brand: str(focus.brand),
          facings: num(focus.facings ?? focus.actual_facings),
          visible_units: num(focus.visible_units ?? focus.actual_visible_units),
          share_of_facings_percent: num(focus.share_of_facings_percent),
          share_of_visible_units_percent: num(focus.share_of_visible_units_percent),
          status: str(focus.status),
        }
      : undefined,
    visible_prices: pickArray(block.visible_prices),
    visible_promotions: pickArray(block.visible_promotions),
    shelf_issues: pickArray(block.shelf_issues),
    summary: {
      ...normalizeShelfSummary(block.summary ?? summaryRaw),
      products_identified: (() => {
        const fromMetric = metricField(calc?.products_identified);
        const fromSummary = normalizeShelfSummary(block.summary ?? summaryRaw).products_identified;
        if (fromMetric != null && fromMetric > 0) return fromMetric;
        if (fromSummary > 0) return fromSummary;
        return products.length;
      })(),
      brands_identified: (() => {
        const fromMetric = metricField(calc?.brands_identified);
        const fromSummary = normalizeShelfSummary(block.summary ?? summaryRaw).brands_identified;
        if (fromMetric != null && fromMetric > 0) return fromMetric;
        if (fromSummary > 0) return fromSummary;
        const brands = new Set(
          products
            .map((p) => str((p as Record<string, unknown>).brand).trim().toLowerCase())
            .filter(Boolean),
        );
        return brands.size;
      })(),
      variants_identified: (() => {
        const fromMetric = metricField(calc?.variants_identified);
        if (fromMetric != null && fromMetric > 0) return fromMetric;
        const fromSummary = normalizeShelfSummary(block.summary ?? summaryRaw).variants_identified;
        if (fromSummary > 0) return fromSummary;
        return products.length;
      })(),
      visible_facings:
        metricField(calc?.total_actual_facings) ??
        num(summaryRaw?.total_actual_facings) ??
        normalizeShelfSummary(block.summary ?? summaryRaw).visible_facings,
      visible_units:
        metricField(calc?.total_actual_visible_units) ??
        num(summaryRaw?.total_actual_visible_units) ??
        normalizeShelfSummary(block.summary ?? summaryRaw).visible_units,
    },
  };
}

function analysisModeHint(root: Record<string, unknown>): string {
  return (
    str(root.analysis_mode).toLowerCase() ||
    str(root.mode).toLowerCase()
  );
}

function findPlanogramBlock(root: Record<string, unknown>): Record<string, unknown> | null {
  const nested = pickRecord(root.metrics) ?? pickRecord(root.result);
  const aislix = pickRecord(root.aislix_planogram_analysis) ?? pickRecord(nested?.aislix_planogram_analysis);
  if (aislix) return aislix;
  return (
    pickRecord(root.astra_planogram_analysis) ??
    pickRecord(nested?.astra_planogram_analysis) ??
    (analysisModeHint(root) === "planogram_comparison" && str(root.analysis_type) !== "shelf_cv" ? root : null) ??
    (str(root.analysis_type) === "shelf_cv" &&
    ["with_planogram", "planogram_comparison"].includes(analysisModeHint(root))
      ? root
      : null)
  );
}

function findShelfBlock(root: Record<string, unknown>): Record<string, unknown> | null {
  const nested = pickRecord(root.metrics) ?? pickRecord(root.result);
  const intel = pickRecord(root.retail_intelligence) ?? pickRecord(nested?.retail_intelligence);
  const aislix = pickRecord(root.aislix_shelf_analysis) ?? pickRecord(nested?.aislix_shelf_analysis);
  if (aislix) return aislix;
  const cv = pickRecord(root.astra_cv_analysis) ?? pickRecord(nested?.astra_cv_analysis);
  if (cv) return cv;
  return (
    pickRecord(root.astra_shelf_analysis) ??
    pickRecord(nested?.astra_shelf_analysis) ??
    pickRecord(intel?.astra_shelf_analysis) ??
    (analysisModeHint(root) === "image_only_shelf_analysis" ? root : null) ??
    (["shelf_only", "no_planogram"].includes(analysisModeHint(root)) && pickArray(root.products).length
      ? root
      : null) ??
    (str(root.analysis_type) === "shelf_cv" ? root : null)
  );
}

function shelfCvIncompleteReason(root: Record<string, unknown>): string | null {
  const nested = pickRecord(root.metrics) ?? pickRecord(root.result);
  const validation =
    pickRecord(root.astra_cv_validation) ?? pickRecord(nested?.astra_cv_validation);
  if (validation?.count_verification_status === "COUNT_MISMATCH") {
    return "Visual count verification pending review.";
  }
  if (nested?.scan_complete === false || root.scan_complete === false) {
    return "Scan requires review before verified KPIs can be displayed.";
  }
  const refCache =
    str(root.reference_cache) ||
    str(nested?.reference_cache) ||
    str(pickRecord(root.astra_shelf_analysis)?.reference_cache) ||
    str(pickRecord(nested?.astra_shelf_analysis)?.reference_cache);
  if (refCache) {
    return `This scan used the landing demo reference cache (${refCache}) instead of a live Astra CV analysis. Re-run the scan — AI Audit now skips that cache.`;
  }
  return null;
}

/** Extract Astra analysis from a vision API payload or stored metrics. */
export function normalizeAstraAnalysis(payload: unknown): NormalizedAstraAnalysis {
  const root = pickRecord(payload);
  if (!root) return { mode: "incomplete", reason: "No Astra payload found." };

  const cvIncomplete = shelfCvIncompleteReason(root);
  if (cvIncomplete) {
    return { mode: "incomplete", reason: cvIncomplete };
  }

  const planogramBlock = findPlanogramBlock(root);
  if (planogramBlock) {
    const parsed = normalizePlanogramBlock(planogramBlock, root);
    if (parsed) return parsed;
  }

  const shelfBlock = findShelfBlock(root);
  if (shelfBlock) {
    const parsed = normalizeShelfBlock(shelfBlock);
    if (parsed?.products.length) return parsed;
  }

  const stored = pickRecord(root.astra_analysis);
  if (stored?.mode === "planogram") {
    const parsed = normalizePlanogramBlock(stored);
    if (parsed) return parsed;
  }

  return { mode: "incomplete", reason: "Structured Astra JSON was not returned for this scan." };
}

export function astraAnalysisFromScanResult(result: {
  analysis_mode?: string | null;
  retail_intelligence?: Record<string, unknown> | null;
  astra_planogram_analysis?: Record<string, unknown> | null;
  astra_shelf_analysis?: Record<string, unknown> | null;
  metrics?: Record<string, unknown> | null;
  aislix_planogram_analysis?: Record<string, unknown> | null;
  aislix_shelf_analysis?: Record<string, unknown> | null;
  astra_cv_analysis?: Record<string, unknown> | null;
  inventory?: Array<{
    brand?: string | null;
    product?: string | null;
    name?: string | null;
    variant?: string | null;
    facings?: number | null;
    quantity?: number | null;
  }> | null;
}): NormalizedAstraAnalysis {
  const metrics = pickRecord(result.metrics);
  // Prefer explicit calc / CV blocks (stored under metrics or top-level).
  const aislixShelf =
    pickRecord(result.aislix_shelf_analysis) ?? pickRecord(metrics?.aislix_shelf_analysis);
  const aislixPlanogram =
    pickRecord(result.aislix_planogram_analysis) ?? pickRecord(metrics?.aislix_planogram_analysis);
  const astraCv = pickRecord(result.astra_cv_analysis) ?? pickRecord(metrics?.astra_cv_analysis);
  const shelfProductsForAttribution =
    (Array.isArray(metrics?.products) ? metrics.products : null) ??
    (Array.isArray(result.inventory)
      ? result.inventory.map((item) => ({
          brand: item.brand,
          product_name: item.product ?? item.name,
          variant: item.variant,
          facings: item.facings,
          quantity: item.quantity ?? item.facings,
        }))
      : null);

  if (aislixPlanogram) {
    const parsed = normalizeAstraAnalysis({
      aislix_planogram_analysis: aislixPlanogram,
      metrics: metrics ?? undefined,
      products: shelfProductsForAttribution ?? undefined,
      analysis_mode: result.analysis_mode ?? metrics?.analysis_mode,
    });
    if (parsed.mode !== "incomplete") return parsed;
  }
  if (aislixShelf || astraCv) {
    const parsed = normalizeAstraAnalysis({
      ...(aislixShelf ? { aislix_shelf_analysis: aislixShelf } : {}),
      ...(astraCv ? { astra_cv_analysis: astraCv } : {}),
      metrics: metrics ?? undefined,
      analysis_mode: result.analysis_mode ?? metrics?.analysis_mode,
    });
    if (parsed.mode !== "incomplete") return parsed;
  }

  if (metrics) {
    const fromMetrics = normalizeAstraAnalysis({
      ...metrics,
      analysis_mode: result.analysis_mode ?? metrics.analysis_mode,
    });
    if (fromMetrics.mode !== "incomplete") return fromMetrics;
  }
  if (result.astra_planogram_analysis) {
    return normalizeAstraAnalysis({ astra_planogram_analysis: result.astra_planogram_analysis });
  }
  if (result.astra_shelf_analysis) {
    return normalizeAstraAnalysis({ astra_shelf_analysis: result.astra_shelf_analysis });
  }
  if (result.analysis_mode === "shelf_only") {
    const fromIntel = (result.retail_intelligence as Record<string, unknown> | undefined)
      ?.astra_shelf_analysis;
    if (fromIntel && typeof fromIntel === "object") {
      return normalizeAstraAnalysis({ astra_shelf_analysis: fromIntel });
    }
  }
  const intel = result.retail_intelligence as Record<string, unknown> | undefined;
  if (intel?.astra_planogram_analysis || intel?.astra_shelf_analysis) {
    return normalizeAstraAnalysis(intel);
  }
  if (intel?.astra_analysis) {
    const stored = pickRecord(intel.astra_analysis);
    if (stored) return normalizeAstraAnalysis({ astra_analysis: stored, ...stored });
  }
  return normalizeAstraAnalysis({
    ...(intel ?? {}),
    analysis_mode: result.analysis_mode ?? undefined,
    // Keep shelf products available for unverifiable facing attribution.
    products: metrics?.products ?? intel?.products,
  });
}

/** @deprecated Use AstraPlanogramProduct */
export type AstraPlanogramRow = AstraPlanogramProduct;
