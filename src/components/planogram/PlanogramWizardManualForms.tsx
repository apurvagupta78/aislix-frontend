/**
 * Manual entry forms for planogram audit package sections (assortment, prices, promotions).
 */

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  AssortmentEntry,
  PlanogramAuditPackage,
  PriceRequirement,
  PromotionEntry,
} from "@/lib/planogram-audit-package";
import {
  DEFAULT_SHELF_PRICE_CURRENCY,
  SHELF_PRICE_CURRENCIES,
} from "@/lib/planogram-price-template";
import {
  HOMEPAGE_ASSORTMENT_FIELD_HELP,
  HOMEPAGE_PRICE_FIELD_HELP,
  homepageRequiredProductTypeLabel,
} from "@/lib/planogram-wizard-homepage-copy";

type PatchFn = (partial: Partial<PlanogramAuditPackage>) => void;

export function AssortmentManualForm({
  pkg,
  onPatch,
  simplifiedCopy = false,
}: {
  pkg: PlanogramAuditPackage;
  onPatch: PatchFn;
  simplifiedCopy?: boolean;
}) {
  const [draft, setDraft] = useState<AssortmentEntry>({
    sku: "",
    list_type: "mandatory_assortment",
    outlet_scope: "all",
    valid_from: "",
    valid_to: "",
    substitution_allowed: false,
  });

  function addEntry() {
    if (!draft.sku.trim()) return;
    const entry: AssortmentEntry = {
      ...draft,
      sku: draft.sku.trim(),
      outlet_scope: draft.outlet_scope.trim() || "all",
    };
    if (entry.list_type === "msl") {
      onPatch({ msl_skus: [...pkg.msl_skus, entry] });
    } else {
      onPatch({ assortment_skus: [...pkg.assortment_skus, entry] });
    }
    setDraft({
      sku: "",
      list_type: draft.list_type,
      outlet_scope: draft.outlet_scope,
      valid_from: "",
      valid_to: "",
      substitution_allowed: false,
    });
  }

  function removeEntry(sku: string, listType: AssortmentEntry["list_type"]) {
    if (listType === "msl") {
      onPatch({ msl_skus: pkg.msl_skus.filter((r) => r.sku !== sku) });
    } else {
      onPatch({ assortment_skus: pkg.assortment_skus.filter((r) => r.sku !== sku) });
    }
  }

  const all = [...pkg.assortment_skus, ...pkg.msl_skus];

  return (
    <div className="space-y-4 rounded-xl border border-dashed border-border p-4">
      <p
        className={
          simplifiedCopy
            ? "text-sm font-medium text-foreground"
            : "text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        }
      >
        {simplifiedCopy ? "Add a Required Product" : "Add manually"}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{simplifiedCopy ? "Product / SKU *" : "SKU *"}</Label>
          <Input
            className="h-9 rounded-lg text-sm"
            value={draft.sku}
            onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
            placeholder={simplifiedCopy ? "e.g. COL-MAX-150" : "COL-MAX-150"}
          />
          {simplifiedCopy ? (
            <p className="text-[11px] text-muted-foreground">{HOMEPAGE_ASSORTMENT_FIELD_HELP.sku}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{simplifiedCopy ? "Requirement Type *" : "List type *"}</Label>
          <Select
            value={draft.list_type === "optional" && simplifiedCopy ? "mandatory_assortment" : draft.list_type}
            onValueChange={(v) =>
              setDraft({ ...draft, list_type: v as AssortmentEntry["list_type"] })
            }
          >
            <SelectTrigger className="h-9 rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mandatory_assortment">
                {simplifiedCopy ? "Required Assortment" : "Mandatory assortment"}
              </SelectItem>
              <SelectItem value="msl">{simplifiedCopy ? "Must-Stock" : "Must-stock list (MSL)"}</SelectItem>
              {!simplifiedCopy ? <SelectItem value="optional">Optional</SelectItem> : null}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{simplifiedCopy ? "Store / Outlet" : "Outlet scope"}</Label>
          <Input
            className="h-9 rounded-lg text-sm"
            value={draft.outlet_scope}
            onChange={(e) => setDraft({ ...draft, outlet_scope: e.target.value })}
            placeholder="all"
          />
          {simplifiedCopy ? (
            <p className="text-[11px] text-muted-foreground">
              {HOMEPAGE_ASSORTMENT_FIELD_HELP.outletScope}
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{simplifiedCopy ? "Start Date" : "Valid from"}</Label>
          <Input
            type="date"
            className="h-9 rounded-lg text-sm"
            value={draft.valid_from ?? ""}
            onChange={(e) => setDraft({ ...draft, valid_from: e.target.value })}
          />
          {simplifiedCopy ? (
            <p className="text-[11px] text-muted-foreground">{HOMEPAGE_ASSORTMENT_FIELD_HELP.validFrom}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{simplifiedCopy ? "End Date" : "Valid until"}</Label>
          <Input
            type="date"
            className="h-9 rounded-lg text-sm"
            value={draft.valid_to ?? ""}
            onChange={(e) => setDraft({ ...draft, valid_to: e.target.value })}
          />
          {simplifiedCopy ? (
            <p className="text-[11px] text-muted-foreground">{HOMEPAGE_ASSORTMENT_FIELD_HELP.validTo}</p>
          ) : null}
        </div>
      </div>
      <Button type="button" variant="subtle" size="sm" className="rounded-lg" onClick={addEntry}>
        <Plus className="size-3.5" /> {simplifiedCopy ? "Add Required Product" : "Add assortment row"}
      </Button>
      {all.length > 0 && (
        <ul className="space-y-1 text-xs">
          {all.map((row) => (
            <li key={`${row.list_type}-${row.sku}`} className="flex items-center justify-between gap-2">
              <span>
                <span className="font-mono">{row.sku}</span> —{" "}
                {simplifiedCopy
                  ? homepageRequiredProductTypeLabel(row.list_type)
                  : row.list_type.replace(/_/g, " ")}{" "}
                ({row.outlet_scope})
              </span>
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive"
                aria-label="Remove"
                onClick={() => removeEntry(row.sku, row.list_type)}
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function emptyPriceDraft(currency: string): PriceRequirement {
  return {
    sku: "",
    label_location: "shelf_tag",
    expected_price: 0,
    currency,
    price_basis: "item",
    valid_from: "",
    valid_to: "",
  };
}

export function PriceManualForm({
  pkg,
  onPatch,
  simplifiedCopy = false,
}: {
  pkg: PlanogramAuditPackage;
  onPatch: PatchFn;
  simplifiedCopy?: boolean;
}) {
  const defaultCurrency = simplifiedCopy ? DEFAULT_SHELF_PRICE_CURRENCY : "INR";
  const [draft, setDraft] = useState<PriceRequirement>(() => emptyPriceDraft(defaultCurrency));

  function addEntry() {
    if (!draft.sku.trim() || !draft.expected_price) return;
    onPatch({
      price_requirements: [
        ...pkg.price_requirements,
        {
          ...draft,
          sku: draft.sku.trim(),
          expected_price: Number(draft.expected_price),
        },
      ],
    });
    setDraft(emptyPriceDraft(draft.currency || defaultCurrency));
  }

  return (
    <div className="space-y-4 rounded-xl border border-dashed border-border p-4">
      <p
        className={
          simplifiedCopy
            ? "text-sm font-medium text-foreground"
            : "text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        }
      >
        {simplifiedCopy ? "Add a Shelf Price" : "Add manually"}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{simplifiedCopy ? "Product / SKU *" : "SKU *"}</Label>
          <Input
            className="h-9 rounded-lg text-sm"
            value={draft.sku}
            onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
            placeholder={simplifiedCopy ? "e.g. COL-MAX-150" : undefined}
          />
          {simplifiedCopy ? (
            <p className="text-[11px] text-muted-foreground">{HOMEPAGE_PRICE_FIELD_HELP.sku}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">
            {simplifiedCopy ? "Price Label Location" : "Label location"}
          </Label>
          <Input
            className="h-9 rounded-lg text-sm"
            value={draft.label_location}
            onChange={(e) => setDraft({ ...draft, label_location: e.target.value })}
            placeholder={simplifiedCopy ? "e.g. shelf tag" : "shelf_tag"}
          />
          {simplifiedCopy ? (
            <p className="text-[11px] text-muted-foreground">
              {HOMEPAGE_PRICE_FIELD_HELP.labelLocation}
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{simplifiedCopy ? "Expected Price *" : "Expected price *"}</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            className="h-9 rounded-lg text-sm"
            value={draft.expected_price || ""}
            onChange={(e) =>
              setDraft({ ...draft, expected_price: e.target.value ? Number(e.target.value) : 0 })
            }
          />
          {simplifiedCopy ? (
            <p className="text-[11px] text-muted-foreground">
              {HOMEPAGE_PRICE_FIELD_HELP.expectedPrice}
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Currency</Label>
          {simplifiedCopy ? (
            <Select value={draft.currency} onValueChange={(v) => setDraft({ ...draft, currency: v })}>
              <SelectTrigger className="h-9 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHELF_PRICE_CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              className="h-9 rounded-lg text-sm"
              value={draft.currency}
              onChange={(e) => setDraft({ ...draft, currency: e.target.value })}
              placeholder="INR"
            />
          )}
          {simplifiedCopy ? (
            <p className="text-[11px] text-muted-foreground">{HOMEPAGE_PRICE_FIELD_HELP.currency}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{simplifiedCopy ? "Price Basis" : "Price basis"}</Label>
          <Select
            value={draft.price_basis}
            onValueChange={(v) => setDraft({ ...draft, price_basis: v })}
          >
            <SelectTrigger className="h-9 rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="item">Per item</SelectItem>
              <SelectItem value="pack">Per pack</SelectItem>
              <SelectItem value="kg">Per kg</SelectItem>
              <SelectItem value="litre">Per litre</SelectItem>
              {simplifiedCopy ? <SelectItem value="other">Other</SelectItem> : null}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{simplifiedCopy ? "Start Date" : "Valid from"}</Label>
          <Input
            type="date"
            className="h-9 rounded-lg text-sm"
            value={draft.valid_from ?? ""}
            onChange={(e) => setDraft({ ...draft, valid_from: e.target.value })}
          />
          {simplifiedCopy ? (
            <p className="text-[11px] text-muted-foreground">{HOMEPAGE_PRICE_FIELD_HELP.validFrom}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{simplifiedCopy ? "End Date" : "Valid until"}</Label>
          <Input
            type="date"
            className="h-9 rounded-lg text-sm"
            value={draft.valid_to ?? ""}
            onChange={(e) => setDraft({ ...draft, valid_to: e.target.value })}
          />
          {simplifiedCopy ? (
            <p className="text-[11px] text-muted-foreground">{HOMEPAGE_PRICE_FIELD_HELP.validTo}</p>
          ) : null}
        </div>
      </div>
      <Button type="button" variant="subtle" size="sm" className="rounded-lg" onClick={addEntry}>
        <Plus className="size-3.5" /> {simplifiedCopy ? "Add Price" : "Add price requirement"}
      </Button>
      {!simplifiedCopy && pkg.price_requirements.length > 0 && (
        <ul className="space-y-1 text-xs">
          {pkg.price_requirements.map((row) => (
            <li key={`${row.sku}-${row.label_location}`} className="flex justify-between gap-2">
              <span>
                {row.sku}: {row.currency} {row.expected_price} ({row.price_basis})
              </span>
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive"
                onClick={() =>
                  onPatch({
                    price_requirements: pkg.price_requirements.filter(
                      (r) => !(r.sku === row.sku && r.label_location === row.label_location),
                    ),
                  })
                }
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PromotionManualForm({ pkg, onPatch }: { pkg: PlanogramAuditPackage; onPatch: PatchFn }) {
  const [draft, setDraft] = useState({
    promotion_id: "",
    participating_skus: "",
    start_date: "",
    end_date: "",
    required_location: "",
    expected_offer_text: "",
    expected_promo_price: "",
    required_facings: "",
  });

  function addEntry() {
    if (!draft.promotion_id.trim()) return;
    const entry: PromotionEntry = {
      promotion_id: draft.promotion_id.trim(),
      participating_skus: draft.participating_skus
        .split(/[,|]/)
        .map((s) => s.trim())
        .filter(Boolean),
      start_date: draft.start_date || undefined,
      end_date: draft.end_date || undefined,
      required_location: draft.required_location || undefined,
      expected_offer_text: draft.expected_offer_text || undefined,
      expected_promo_price: draft.expected_promo_price ? Number(draft.expected_promo_price) : null,
      required_facings: draft.required_facings ? Number(draft.required_facings) : null,
    };
    onPatch({ promotions: [...pkg.promotions, entry] });
    setDraft({
      promotion_id: "",
      participating_skus: "",
      start_date: "",
      end_date: "",
      required_location: "",
      expected_offer_text: "",
      expected_promo_price: "",
      required_facings: "",
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-dashed border-border p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Add manually
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Promotion ID *</Label>
          <Input
            className="h-9 rounded-lg text-sm"
            value={draft.promotion_id}
            onChange={(e) => setDraft({ ...draft, promotion_id: e.target.value })}
            placeholder="PROMO-01"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Participating SKUs (comma-separated)</Label>
          <Input
            className="h-9 rounded-lg text-sm"
            value={draft.participating_skus}
            onChange={(e) => setDraft({ ...draft, participating_skus: e.target.value })}
            placeholder="COL-001, COL-002"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Start date</Label>
          <Input
            type="date"
            className="h-9 rounded-lg text-sm"
            value={draft.start_date}
            onChange={(e) => setDraft({ ...draft, start_date: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">End date</Label>
          <Input
            type="date"
            className="h-9 rounded-lg text-sm"
            value={draft.end_date}
            onChange={(e) => setDraft({ ...draft, end_date: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Required location</Label>
          <Input
            className="h-9 rounded-lg text-sm"
            value={draft.required_location}
            onChange={(e) => setDraft({ ...draft, required_location: e.target.value })}
            placeholder="Shelf 2 / end cap"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Expected offer text</Label>
          <Input
            className="h-9 rounded-lg text-sm"
            value={draft.expected_offer_text}
            onChange={(e) => setDraft({ ...draft, expected_offer_text: e.target.value })}
            placeholder="Buy 2 Save 10%"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Promotional price</Label>
          <Input
            type="number"
            min={0}
            className="h-9 rounded-lg text-sm"
            value={draft.expected_promo_price}
            onChange={(e) => setDraft({ ...draft, expected_promo_price: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Required facings</Label>
          <Input
            type="number"
            min={0}
            className="h-9 rounded-lg text-sm"
            value={draft.required_facings}
            onChange={(e) => setDraft({ ...draft, required_facings: e.target.value })}
          />
        </div>
      </div>
      <Button type="button" variant="subtle" size="sm" className="rounded-lg" onClick={addEntry}>
        <Plus className="size-3.5" /> Add promotion
      </Button>
      {pkg.promotions.length > 0 && (
        <ul className="space-y-2 text-xs">
          {pkg.promotions.map((promo) => (
            <li
              key={promo.promotion_id}
              className="flex items-start justify-between gap-2 rounded-lg border border-border p-2"
            >
              <span>
                <span className="font-medium">{promo.promotion_id}</span>
                {promo.expected_offer_text ? ` — ${promo.expected_offer_text}` : ""}
                <br />
                <span className="text-muted-foreground">
                  SKUs: {promo.participating_skus.join(", ") || "—"}
                </span>
              </span>
              <button
                type="button"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() =>
                  onPatch({
                    promotions: pkg.promotions.filter((p) => p.promotion_id !== promo.promotion_id),
                  })
                }
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
