/**
 * Tabbed planogram editor — products, assortment/MSL, prices, promotions, scoring.
 * Uses Aislix brand colors (navy primary, brand-soft surfaces).
 */

import { useRef, useState } from "react";
import { CheckCircle2, Download, FileJson, Loader2, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlanogramBuilder } from "@/components/planogram/PlanogramBuilder";
import type { ShelfCategory } from "@/lib/categories.data";
import type { DraftRow } from "@/lib/planogram";
import {
  autoPopulateAuditPackage,
  computeReadiness,
  exportPlanogramPackageJson,
  fetchPackageCsvTemplate,
  mergeAssortmentLists,
  parsePackageCsv,
  parsePlanogramPackageImport,
  splitAssortmentRows,
  type AssortmentEntry,
  type PlanogramAuditPackage,
  type PriceRequirement,
  type PromotionEntry,
  type ScoringTargets,
} from "@/lib/planogram-audit-package";
import { cn } from "@/lib/utils";

function CsvImportPanel({
  label,
  kind,
  onImport,
}: {
  label: string;
  kind: "assortment" | "prices" | "promotions";
  onImport: (rows: unknown[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const download = async () => {
    const text = await fetchPackageCsvTemplate(kind);
    const blob = new Blob([text], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `planogram-${kind}-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = async (file: File) => {
    setBusy(true);
    setErrors([]);
    try {
      const content = await file.text();
      const result = await parsePackageCsv(kind, content);
      if (result.errors.length) {
        setErrors(result.errors.slice(0, 6));
        toast.error(`Could not import ${label}`, { description: result.errors[0] });
        return;
      }
      const data = result.rows.filter((r) => r.valid && r.data).map((r) => r.data);
      onImport(data);
      toast.success(`${label} imported`, { description: `${data.length} row(s) added.` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-brand/15 bg-brand-soft/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" className="rounded-lg border-brand/20" onClick={() => void download()}>
            <Download className="mr-1.5 size-4" /> Template
          </Button>
          <Button
            type="button"
            variant="brand"
            size="sm"
            className="rounded-lg"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Upload className="mr-1.5 size-4" />}
            Upload CSV
          </Button>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />
      {errors.length > 0 && (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription className="text-xs">{errors.join(" · ")}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function ReadinessPanel({ rows, pkg }: { rows: DraftRow[]; pkg: PlanogramAuditPackage }) {
  const items = computeReadiness(rows, pkg);
  return (
    <div className="rounded-xl border border-brand/15 bg-card p-4">
      <p className="text-sm font-semibold text-brand">KPI readiness</p>
      <p className="mt-0.5 text-xs text-muted-foreground">Which audit KPIs can run from the data you have supplied.</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.kpi_id} className="flex items-center gap-2 text-sm">
            {item.ready ? (
              <CheckCircle2 className="size-4 shrink-0 text-brand" />
            ) : (
              <XCircle className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span className={item.ready ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type PlanogramAuditTabsProps = {
  rows: DraftRow[];
  onRowsChange: (rows: DraftRow[]) => void;
  categories: ShelfCategory[];
  auditPackage: PlanogramAuditPackage;
  onAuditPackageChange: (pkg: PlanogramAuditPackage) => void;
  onFilename?: (name: string) => void;
  onSource?: (source: "csv" | "manual") => void;
  tableActions?: React.ReactNode;
  planogramName?: string;
};

export function PlanogramAuditTabs({
  rows,
  onRowsChange,
  categories,
  auditPackage,
  onAuditPackageChange,
  onFilename,
  onSource,
  tableActions,
  planogramName = "planogram",
}: PlanogramAuditTabsProps) {
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const [jsonBusy, setJsonBusy] = useState(false);
  const allAssortment = mergeAssortmentLists(auditPackage.assortment_skus, auditPackage.msl_skus);

  const patch = (partial: Partial<PlanogramAuditPackage>) =>
    onAuditPackageChange({ ...auditPackage, ...partial });

  const patchScoring = (partial: ScoringTargets) =>
    patch({ scoring: { ...auditPackage.scoring, ...partial } });

  return (
    <Tabs defaultValue="products" className="space-y-4">
      <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-xl border border-brand/15 bg-brand-soft/30 p-1">
        {[
          ["details", "Details"],
          ["products", "Products"],
          ["assortment", "Assortment & MSL"],
          ["prices", "Prices"],
          ["promotions", "Promotions"],
          ["scoring", "Scoring"],
        ].map(([value, label]) => (
          <TabsTrigger
            key={value}
            value={value}
            className={cn(
              "rounded-lg px-3 py-2 text-sm data-[state=active]:bg-brand data-[state=active]:text-brand-foreground",
            )}
          >
            {label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="details" className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Fixture / rack ID</Label>
            <Input
              className="rounded-xl"
              placeholder="e.g. Oral-Care-A1"
              value={auditPackage.fixture_id ?? ""}
              onChange={(e) => patch({ fixture_id: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Store timezone</Label>
            <Input
              className="rounded-xl"
              placeholder="Asia/Kolkata"
              value={auditPackage.store_timezone ?? ""}
              onChange={(e) => patch({ store_timezone: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Primary brand (SOS / FMCG)</Label>
            <Input
              className="rounded-xl"
              placeholder="e.g. Colgate"
              value={auditPackage.primary_brand ?? ""}
              onChange={(e) => patch({ primary_brand: e.target.value })}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="brand"
            size="sm"
            className="rounded-lg"
            disabled={!rows.length}
            onClick={() => {
              onAuditPackageChange(autoPopulateAuditPackage(rows, auditPackage));
              toast.success("KPI reference data filled from product rows");
            }}
          >
            Auto-fill KPI data from products
          </Button>
          <p className="self-center text-xs text-muted-foreground">
            Derives assortment, MSL, prices, and brand scope from the Products tab.
          </p>
        </div>
        <div className="rounded-xl border border-brand/15 bg-brand-soft/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-foreground">Full planogram package</p>
              <p className="text-xs text-muted-foreground">
                Export or import products, assortment, prices, promotions, and scoring in one JSON file.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-lg border-brand/20"
                onClick={() => exportPlanogramPackageJson(planogramName, rows, auditPackage)}
              >
                <FileJson className="mr-1.5 size-4" /> Export JSON
              </Button>
              <Button
                type="button"
                variant="brand"
                size="sm"
                className="rounded-lg"
                disabled={jsonBusy}
                onClick={() => jsonInputRef.current?.click()}
              >
                {jsonBusy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Upload className="mr-1.5 size-4" />}
                Import JSON
              </Button>
            </div>
          </div>
          <input
            ref={jsonInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setJsonBusy(true);
              void file
                .text()
                .then((text) => {
                  const parsed = JSON.parse(text) as unknown;
                  const result = parsePlanogramPackageImport(parsed);
                  if (result.errors.length) {
                    toast.error("Could not import planogram package", {
                      description: result.errors.slice(0, 3).join(" · "),
                    });
                    return;
                  }
                  if (result.rows.length) onRowsChange(result.rows);
                  onAuditPackageChange(result.auditPackage);
                  if (result.name) onFilename?.(result.name);
                  onSource?.("manual");
                  toast.success("Planogram package imported", {
                    description: `${result.rows.length} product row(s) loaded.`,
                  });
                })
                .catch(() => toast.error("Invalid JSON file."))
                .finally(() => setJsonBusy(false));
            }}
          />
        </div>
        <ReadinessPanel rows={rows} pkg={auditPackage} />
      </TabsContent>

      <TabsContent value="products">
        <PlanogramBuilder
          rows={rows}
          onRowsChange={onRowsChange}
          categories={categories}
          onFilename={onFilename}
          onSource={onSource}
          tableTitle="Shelf layout & products"
          tableActions={tableActions}
        />
      </TabsContent>

      <TabsContent value="assortment" className="space-y-4">
        <CsvImportPanel
          label="Assortment & must-stock list"
          kind="assortment"
          onImport={(imported) => {
            const entries = imported as AssortmentEntry[];
            const split = splitAssortmentRows(entries);
            patch({ assortment_skus: split.assortment_skus, msl_skus: split.msl_skus });
          }}
        />
        {allAssortment.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-brand text-brand-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">SKU</th>
                  <th className="px-3 py-2 text-left font-medium">List</th>
                  <th className="px-3 py-2 text-left font-medium">Scope</th>
                </tr>
              </thead>
              <tbody>
                {allAssortment.map((row, i) => (
                  <tr key={`${row.sku}-${i}`} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs">{row.sku}</td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary" className="capitalize">
                        {row.list_type.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{row.outlet_scope}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No assortment or MSL rows yet — upload a CSV or skip if using planogram products only.</p>
        )}
      </TabsContent>

      <TabsContent value="prices" className="space-y-4">
        <CsvImportPanel
          label="Price requirements"
          kind="prices"
          onImport={(imported) => patch({ price_requirements: imported as PriceRequirement[] })}
        />
        {rows.some((r) => r.mrp_inr != null) && (
          <p className="text-xs text-muted-foreground">
            {rows.filter((r) => r.mrp_inr != null).length} product row(s) include MRP from the Products tab.
          </p>
        )}
        {auditPackage.price_requirements.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-brand text-brand-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">SKU</th>
                  <th className="px-3 py-2 text-left">Expected</th>
                  <th className="px-3 py-2 text-left">Basis</th>
                </tr>
              </thead>
              <tbody>
                {auditPackage.price_requirements.map((row) => (
                  <tr key={row.sku} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs">{row.sku}</td>
                    <td className="px-3 py-2">
                      {row.currency} {row.expected_price}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{row.price_basis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TabsContent>

      <TabsContent value="promotions" className="space-y-4">
        <CsvImportPanel
          label="Active promotions"
          kind="promotions"
          onImport={(imported) => patch({ promotions: imported as PromotionEntry[] })}
        />
        {auditPackage.promotions.length > 0 ? (
          <div className="space-y-2">
            {auditPackage.promotions.map((promo) => (
              <div key={promo.promotion_id} className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
                <p className="font-medium text-brand">{promo.promotion_id}</p>
                <p className="text-muted-foreground">{promo.expected_offer_text || "—"}</p>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                  SKUs: {promo.participating_skus.join(", ")}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No promotions configured — promotional KPI will show Not applicable.</p>
        )}
      </TabsContent>

      <TabsContent value="scoring" className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Optional KPI targets (%). Leave blank to show results without a target comparison.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              ["osa_target", "OSA target %"],
              ["planogram_target", "Planogram target %"],
              ["assortment_target", "Assortment target %"],
              ["price_target", "Price target %"],
              ["promotional_target", "Promotional target %"],
              ["msl_target", "MSL target %"],
              ["share_of_shelf_target", "Share of shelf target %"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="space-y-1.5">
              <Label className="text-xs">{label}</Label>
              <Input
                type="number"
                min={0}
                max={100}
                className="rounded-xl"
                value={auditPackage.scoring?.[key] ?? ""}
                onChange={(e) => {
                  const v = e.target.value === "" ? undefined : Number(e.target.value);
                  patchScoring({ [key]: v });
                }}
              />
            </div>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}
