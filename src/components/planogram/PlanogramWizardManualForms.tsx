/**
 * Manual entry forms for planogram audit package sections (assortment, prices, promotions).
 */

import { useEffect, useState } from "react";
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
  HOMEPAGE_PROMOTION_FIELD_HELP,
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

function emptyPromotionDraft() {
  return {
    promotion_id: "",
    participating_skus: "",
    start_date: "",
    end_date: "",
    required_location: "",
    expected_offer_text: "",
    expected_promo_price: "",
    required_facings: "",
  };
}

export function PromotionManualForm({
  pkg,
  onPatch,
  simplifiedCopy = false,
  seedDraft,
  onSeedDraftApplied,
}: {
  pkg: PlanogramAuditPackage;
  onPatch: PatchFn;
  simplifiedCopy?: boolean;
  seedDraft?: PromotionEntry | null;
  onSeedDraftApplied?: () => void;
}) {
  const [draft, setDraft] = useState(emptyPromotionDraft);
  const [editingPromotionId, setEditingPromotionId] = useState<string | null>(null);

  useEffect(() => {
    if (!seedDraft) return;
    setEditingPromotionId(seedDraft.promotion_id);
    setDraft({
      promotion_id: seedDraft.promotion_id,
      participating_skus: seedDraft.participating_skus.join(", "),
      start_date: seedDraft.start_date ?? "",
      end_date: seedDraft.end_date ?? "",
      required_location: seedDraft.required_location ?? "",
      expected_offer_text: seedDraft.expected_offer_text ?? "",
      expected_promo_price:
        seedDraft.expected_promo_price != null ? String(seedDraft.expected_promo_price) : "",
      required_facings:
        seedDraft.required_facings != null ? String(seedDraft.required_facings) : "",
    });
    onSeedDraftApplied?.();
  }, [seedDraft, onSeedDraftApplied]);

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
    const withoutEdited = editingPromotionId
      ? pkg.promotions.filter((p) => p.promotion_id !== editingPromotionId)
      : pkg.promotions;
    onPatch({ promotions: [...withoutEdited, entry] });
    setEditingPromotionId(null);
    setDraft(emptyPromotionDraft());
  }

  function cancelEdit() {
    setEditingPromotionId(null);
    setDraft(emptyPromotionDraft());
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
        {simplifiedCopy ? "Add a Promotion" : "Add manually"}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{simplifiedCopy ? "Promotion Name *" : "Promotion ID *"}</Label>
          <Input
            className="h-9 rounded-lg text-sm"
            value={draft.promotion_id}
            onChange={(e) => setDraft({ ...draft, promotion_id: e.target.value })}
            placeholder={simplifiedCopy ? "e.g. Summer Sale" : "PROMO-01"}
          />
          {simplifiedCopy ? (
            <p className="text-[11px] text-muted-foreground">
              {HOMEPAGE_PROMOTION_FIELD_HELP.promotionName}
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">
            {simplifiedCopy ? "Products Included" : "Participating SKUs (comma-separated)"}
          </Label>
          <Input
            className="h-9 rounded-lg text-sm"
            value={draft.participating_skus}
            onChange={(e) => setDraft({ ...draft, participating_skus: e.target.value })}
            placeholder={simplifiedCopy ? "e.g. COL-MAX-150, PEP-GER-150" : "COL-001, COL-002"}
          />
          {simplifiedCopy ? (
            <p className="text-[11px] text-muted-foreground">
              {HOMEPAGE_PROMOTION_FIELD_HELP.productsIncluded}
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{simplifiedCopy ? "Start Date" : "Start date"}</Label>
          <Input
            type="date"
            className="h-9 rounded-lg text-sm"
            value={draft.start_date}
            onChange={(e) => setDraft({ ...draft, start_date: e.target.value })}
          />
          {simplifiedCopy ? (
            <p className="text-[11px] text-muted-foreground">
              {HOMEPAGE_PROMOTION_FIELD_HELP.startDate}
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{simplifiedCopy ? "End Date" : "End date"}</Label>
          <Input
            type="date"
            className="h-9 rounded-lg text-sm"
            value={draft.end_date}
            onChange={(e) => setDraft({ ...draft, end_date: e.target.value })}
          />
          {simplifiedCopy ? (
            <p className="text-[11px] text-muted-foreground">
              {HOMEPAGE_PROMOTION_FIELD_HELP.endDate}
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">
            {simplifiedCopy ? "Display Location" : "Required location"}
          </Label>
          <Input
            className="h-9 rounded-lg text-sm"
            value={draft.required_location}
            onChange={(e) => setDraft({ ...draft, required_location: e.target.value })}
            placeholder={simplifiedCopy ? "e.g. Shelf 2 end cap" : "Shelf 2 / end cap"}
          />
          {simplifiedCopy ? (
            <p className="text-[11px] text-muted-foreground">
              {HOMEPAGE_PROMOTION_FIELD_HELP.displayLocation}
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">{simplifiedCopy ? "Offer Text" : "Expected offer text"}</Label>
          <Input
            className="h-9 rounded-lg text-sm"
            value={draft.expected_offer_text}
            onChange={(e) => setDraft({ ...draft, expected_offer_text: e.target.value })}
            placeholder={simplifiedCopy ? "e.g. Buy 2 Save 10%" : "Buy 2 Save 10%"}
          />
          {simplifiedCopy ? (
            <p className="text-[11px] text-muted-foreground">
              {HOMEPAGE_PROMOTION_FIELD_HELP.offerText}
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">
            {simplifiedCopy ? "Promotional Price" : "Promotional price"}
          </Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            className="h-9 rounded-lg text-sm"
            value={draft.expected_promo_price}
            onChange={(e) => setDraft({ ...draft, expected_promo_price: e.target.value })}
          />
          {simplifiedCopy ? (
            <p className="text-[11px] text-muted-foreground">
              {HOMEPAGE_PROMOTION_FIELD_HELP.promotionalPrice}
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">
            {simplifiedCopy ? "Required Facings" : "Required facings"}
          </Label>
          <Input
            type="number"
            min={0}
            className="h-9 rounded-lg text-sm"
            value={draft.required_facings}
            onChange={(e) => setDraft({ ...draft, required_facings: e.target.value })}
          />
          {simplifiedCopy ? (
            <p className="text-[11px] text-muted-foreground">
              {HOMEPAGE_PROMOTION_FIELD_HELP.requiredFacings}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="subtle" size="sm" className="rounded-lg" onClick={addEntry}>
          <Plus className="size-3.5" />{" "}
          {editingPromotionId
            ? simplifiedCopy
              ? "Save Promotion"
              : "Save promotion"
            : simplifiedCopy
              ? "Add Promotion"
              : "Add promotion"}
        </Button>
        {editingPromotionId ? (
          <Button type="button" variant="ghost" size="sm" className="rounded-lg" onClick={cancelEdit}>
            Cancel
          </Button>
        ) : null}
      </div>
      {!simplifiedCopy && pkg.promotions.length > 0 && (
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
