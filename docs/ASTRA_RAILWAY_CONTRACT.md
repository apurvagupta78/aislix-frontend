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
  "analysis_mode": "planogram_comparison | shelf_only",
  "vision_prompt": "full Astra prompt text",
  "planogram_items": [],
  "category": "Personal Care",
  "sub_category": "toothpaste",
  "audit_package": {}
}
```

### Mode selection (two modes only)

| Condition | `analysis_mode` | List sent |
|---|---|---|
| Planogram rows present | `planogram_comparison` | `planogram_items` (14 CSV fields) |
| No planogram | `shelf_only` | none — image-only shelf analysis |

### Planogram item fields

`location`, `category`, `sub_category`, `brand`, `product_name`, `variant`, `expected_facings`, `min_facings`, `max_facings`, `expected_shelf_units`, `mrp_inr`, `avg_daily_sales`, `sku`, `shelf_position`, `expected_qty`

## Response

**Results pages require native structured Astra JSON.** Legacy `inventory[]`-only payloads show an incomplete state and prompt re-run.

### Planogram comparison

Key: `astra_planogram_analysis` (or top-level with `"mode": "planogram_comparison"`)

Prompt: `src/lib/ai-audit/prompts/planogram-comparison.prompt.ts`

```json
{
  "mode": "planogram_comparison",
  "operating_model": "supermarket",
  "location": "string",
  "image_quality": { "status": "GOOD", "reason": "..." },
  "products": [],
  "rows": [],
  "brand_analysis": [],
  "category_analysis": [],
  "subcategory_analysis": [],
  "observed_unplanned_products": [],
  "summary": { }
}
```

Each product row includes all fields from the planogram prompt (identity match statuses, facings, units, placement, price, coverage days, risk, evidence).

### Shelf-only (image-only, no planogram)

Key: `astra_shelf_analysis` or top-level `"mode": "image_only_shelf_analysis"`

Prompt: `src/lib/ai-audit/prompts/shelf-only.prompt.ts`

```json
{
  "mode": "image_only_shelf_analysis",
  "operating_model": "supermarket",
  "location": "string",
  "location_status": "MATCHED | UNVERIFIABLE",
  "image_quality": { "status": "GOOD", "reason": "..." },
  "shelf_structure": { "visible_shelf_levels": 0, "notes": "..." },
  "products": [],
  "brand_analysis": [],
  "category_analysis": [],
  "focus_brand_analysis": {},
  "visible_prices": [],
  "visible_promotions": [],
  "shelf_issues": [],
  "summary": { }
}
```

Request may include `focus_brand` (org primary brand) for share analysis.

## Frontend files

- Prompt builders: `src/lib/ai-audit/astra-prompt.ts`
- Planogram prompt: `src/lib/ai-audit/prompts/planogram-comparison.prompt.ts`
- Shelf-only prompt: `src/lib/ai-audit/prompts/shelf-only.prompt.ts`
- Payload assembly: `src/lib/ai-audit/astra-analysis.ts`
- Normalization: `src/lib/ai-audit/astra-response.ts`
- Display context: `src/lib/ai-audit/astra-display.ts`
- Scan pipeline: `src/lib/scan-pipeline.server.ts` → `buildVisionRequest()`
- Landing proxy: `src/routes/api/public/landing/scan.ts`
- Results UI: `src/components/ai-audit/AiAuditResultsPage.tsx`
- CSV export: `src/lib/ai-audit/astra-comparison-export.ts`
