# Astra / Railway vision contract

Frontend sends shelf photos and structured context to Railway FastAPI. **OpenAI credentials stay on Railway only.**

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `AISLIX_AI_API_URL` | Frontend host (Vercel/Lovable) | Railway FastAPI base URL |
| `AISLIX_AI_API_KEY` | Frontend host | Auth header to Railway (`Authorization: Bearer …`, `x-api-key`) |
| `OPENAI_API_KEY` | **Railway only** | Astra GPT vision calls |

Local dev: add `AISLIX_AI_API_KEY` to `.env` when testing scans locally.

## Request (POST `/scan` or `/landing/scan`)

```json
{
  "scan_id": "uuid",
  "image_urls": ["signed-url"],
  "customer_type": "supermarket",
  "operating_model": "supermarket",
  "analysis_mode": "planogram_comparison | expected_products | shelf_only",
  "vision_prompt": "full Astra prompt text",
  "planogram_items": [],
  "expected_products": [],
  "category": "Personal Care",
  "sub_category": "toothpaste",
  "audit_package": {}
}
```

### Mode selection

| Condition | `analysis_mode` | List sent |
|---|---|---|
| Planogram rows present | `planogram_comparison` | `planogram_items` (14 CSV fields) |
| No planogram, expected products added | `expected_products` | `expected_products` (6 fields) |
| No planogram, no products | `shelf_only` | neither list |

### Planogram item fields

`location`, `category`, `sub_category`, `brand`, `product_name`, `variant`, `expected_facings`, `min_facings`, `max_facings`, `expected_shelf_units`, `mrp_inr`, `avg_daily_sales`, `sku`, `shelf_position`, `expected_qty`

### Expected product fields

`location`, `category`, `sub_category`, `brand`, `product_name`, `variant`, `expected_facings`, `expected_shelf_units`

## Response

### Planogram comparison

Key: `astra_planogram_analysis`

```json
{
  "operating_model": "supermarket",
  "image_quality": { "status": "GOOD", "reason": "..." },
  "rows": [],
  "summary": {
    "total_planogram_rows": 0,
    "matched_rows": 0,
    "not_found_rows": 0,
    "non_compliant_rows": 0,
    "not_verifiable_rows": 0,
    "overall_compliance_percent": 0
  }
}
```

### Expected products (no planogram)

Key: `astra_expected_products_analysis`

```json
{
  "operating_model": "supermarket",
  "image_quality": { "status": "GOOD", "reason": "..." },
  "products": [
    {
      "location": "string",
      "category": "string",
      "category_status": "MATCHED | MISMATCHED | UNVERIFIABLE",
      "sub_category": "string",
      "subcategory_status": "MATCHED | MISMATCHED | UNVERIFIABLE",
      "brand": "string",
      "brand_status": "MATCHED | MISMATCHED | UNVERIFIABLE",
      "product_name": "string",
      "product_status": "MATCHED | MISMATCHED | NOT_FOUND | NOT_VERIFIABLE",
      "variant": "string",
      "variant_status": "MATCHED | MISMATCHED | UNVERIFIABLE",
      "expected_facings": 0,
      "actual_facings": 0,
      "facing_variance": 0,
      "facing_status": "MATCHED | BELOW_EXPECTED | ABOVE_EXPECTED | UNVERIFIABLE",
      "expected_shelf_units": 0,
      "actual_visible_units": 0,
      "shelf_unit_variance": 0,
      "shelf_unit_status": "MATCHED | BELOW_EXPECTED | ABOVE_EXPECTED | UNVERIFIABLE",
      "overall_status": "COMPLIANT | PARTIALLY_COMPLIANT | NON_COMPLIANT | NOT_FOUND | NOT_VERIFIABLE",
      "confidence": 0.0,
      "evidence_note": "string"
    }
  ],
  "summary": {
    "total_products": 0,
    "matched_products": 0,
    "not_found_products": 0,
    "not_verifiable_products": 0,
    "products_below_expected_facings": 0,
    "products_below_expected_units": 0,
    "products_above_expected_facings": 0,
    "products_above_expected_units": 0
  }
}
```

### Shelf-only fallback

Return legacy `inventory[]` + metrics. No comparison table.

## Frontend files

- Prompt builders: `src/lib/ai-audit/astra-prompt.ts`
- Payload assembly: `src/lib/ai-audit/astra-analysis.ts`
- Scan pipeline: `src/lib/scan-pipeline.server.ts` → `buildVisionRequest()`
- Landing proxy: `src/routes/api/public/landing/scan.ts`
- Results UI: `src/components/ai-audit/AstraComparisonResults.tsx`
- CSV export: `src/lib/ai-audit/astra-comparison-export.ts`
