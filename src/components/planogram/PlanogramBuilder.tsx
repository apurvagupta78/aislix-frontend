/**
 * Shared "expected products" builder used by Planogram (Store Master step 2)
 * and by the optional planogram section on the New Scan page.
 *
 * Field order is fixed: Location, Category, Sub category, Brand, Product Name,
 * Variant (optional), Expected qty, SKU (optional), Shelf Position (optional).
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/States";
import { toUserMessage } from "@/lib/api/errors";
import {
  convertToInr,
  formatStoredPrice,
  inrToDisplayAmount,
  priceFieldLabel,
  useDisplayCurrency,
} from "@/lib/display-currency";
import type { ShelfCategory } from "@/lib/categories.data";
import {
  PLANOGRAM_CSV_OPTIONAL_LABEL,
  PLANOGRAM_CSV_REQUIRED_LABEL,
  SAMPLE_CSV_HEADERS,
  emptyRow,
  fetchPlanogramCsvTemplate,
  normalizePlanogramRow,
  parsePlanogramCsv,
  toDraftRow,
  validatePlanogramRow,
  type CsvParseRow,
  type DraftRow,
  type PlanogramRow,
} from "@/lib/planogram";
import { HOMEPAGE_PRODUCT_FIELD_HELP, HOMEPAGE_PRODUCTS_TAB_HELPER } from "@/lib/planogram-wizard-homepage-copy";

export type PlanogramContext = {
  /** Shelf/aisle code applied to every row. */
  location: string;
  /** Category name from GET /categories. */
  category: string;
  /** Sub-category label stored on rows. */
  subCategoryLabel: string;
};

export type PlanogramBuilderProps = {
  rows: DraftRow[];
  onRowsChange: (next: DraftRow[]) => void;
  categories: ShelfCategory[];
  /** Called with the parsed CSV filename whenever a file is imported. */
  onFilename?: (filename: string) => void;
  /** Called with the source of the added rows so callers can track csv/manual/mixed. */
  onSource?: (source: "csv" | "manual") => void;
  /** Optional slot rendered next to the rows table heading. */
  tableActions?: React.ReactNode;
  tableTitle?: string;
  tableDescription?: string;
  /** Simplified customer-facing helpers for homepage shelf setup */
  simplifiedCopy?: boolean;
  /** Step-by-step manual setup — forms only, no CSV upload tab */
  manualEntryOnly?: boolean;
  /**
   * When set, Location / Category / Sub category are owned by the caller: the
   * manual form only asks product fields and CSV rows are validated against it.
   */
  context?: PlanogramContext;
};


/** Inline destructive alert that stays until dismissed — never auto-hides. */
export function StickyError({
  title,
  message,
  onDismiss,
}: {
  title: string;
  message: string;
  onDismiss: () => void;
}) {
  return (
    <Alert variant="destructive" className="relative pr-10">
      <AlertCircle className="size-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="whitespace-pre-wrap">{message}</AlertDescription>
      <button
        type="button"
        className="absolute right-3 top-3 text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Dismiss error"
        onClick={onDismiss}
      >
        <X className="size-4" />
      </button>
    </Alert>
  );
}

function Field({
  label,
  required,
  helper,
  children,
}: {
  label: string;
  required?: boolean;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
      {helper ? <p className="text-[11px] text-muted-foreground">{helper}</p> : null}
    </div>
  );
}

export function PlanogramBuilder({
  rows,
  onRowsChange,
  categories,
  onFilename,
  onSource,
  tableActions,
  tableTitle = "Expected products",
  tableDescription,
  simplifiedCopy = false,
  manualEntryOnly = false,
  context,
}: PlanogramBuilderProps) {
  const { currency } = useDisplayCurrency();
  const priceLabel = priceFieldLabel(currency);
  const [preview, setPreview] = useState<CsvParseRow[] | null>(null);
  const [form, setForm] = useState<PlanogramRow>(emptyRow());
  const [priceDisplay, setPriceDisplay] = useState<number | undefined>();
  const [csvError, setCsvError] = useState<string | null>(null);
  const [manualError, setManualError] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const subCategories = categories.find((c) => c.name === form.category)?.subcategories ?? [];
  const hasLegacyAisle = (preview ?? []).some((row) =>
    Boolean((row.data as Record<string, unknown> | null | undefined)?.["aisle"]),
  );

  const norm = (value: unknown) => String(value ?? "").trim().toLowerCase();

  /** Row-level mismatch against the caller's scan context (Option 2 only). */
  const contextIssue = (row: CsvParseRow): string | null => {
    if (!context || !row.data) return null;
    const rowLocation = norm(row.data.location);
    if (context.location && rowLocation && rowLocation !== norm(context.location)) {
      return `Location "${row.data.location}" does not match ${context.location}`;
    }
    return null;
  };

  const withContext = (row: PlanogramRow): PlanogramRow =>
    context
      ? {
          ...row,
          location: context.location,
          category: context.category,
          sub_category: context.subCategoryLabel || row.sub_category,
        }
      : row;


  const parseMutation = useMutation({
    mutationFn: (file: File) => parsePlanogramCsv(file),
    onMutate: () => setCsvError(null),
    onSuccess: (result) => {
      setPreview(result.rows);
      if (result.error_count > 0 && result.valid_count === 0) {
        const details = (
          result.errors.length ? result.errors : result.rows.flatMap((row) => row.errors ?? [])
        ).slice(0, 5);
        setCsvError(
          `CSV has ${result.error_count} error${result.error_count === 1 ? "" : "s"} and no valid rows.${
            details.length ? `\n• ${details.join("\n• ")}` : ""
          }\nRequired: ${PLANOGRAM_CSV_REQUIRED_LABEL}.`,
        );
      } else if (result.errors.length) {
        setCsvError(`Some rows could not be read:\n• ${result.errors.slice(0, 5).join("\n• ")}`);
      } else if (!result.rows.length) {
        setCsvError("No rows found in this CSV file. Download the template and try again.");
      }
    },
    onError: (error) => setCsvError(toUserMessage(error)),
  });

  const normalizeMutation = useMutation({
    mutationFn: (row: PlanogramRow) => normalizePlanogramRow(row),
    onMutate: () => setManualError(null),
    onSuccess: (row) => {
      onRowsChange([...rows, row]);
      onSource?.("manual");
      toast.success("Product added.");
    },
    onError: (error) => setManualError(toUserMessage(error)),
  });

  async function downloadTemplate() {
    const csv = await fetchPlanogramCsvTemplate();
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "aislix-planogram-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function importValidRows() {
    const all = (preview ?? []).filter((row) => row.valid && row.data);
    const mismatched = all.filter((row) => contextIssue(row));
    const valid = all.filter((row) => !contextIssue(row));
    if (!valid.length) {
      setCsvError(
        mismatched.length
          ? `No rows match this scan's location (${context?.location}). Fix the highlighted rows or change the location above.`
          : "No valid rows to import. Fix the highlighted rows in your CSV and upload again.",
      );
      return;
    }
    onRowsChange([...rows, ...valid.map((row) => toDraftRow(row.data))]);
    onSource?.("csv");
    setPreview(null);
    setCsvError(
      mismatched.length
        ? `${mismatched.length} row${mismatched.length === 1 ? " was" : "s were"} skipped because the location did not match ${context?.location}.`
        : null,
    );
    toast.success(`${valid.length} row${valid.length === 1 ? "" : "s"} added.`);
  }

  function submitManual(keepContext: boolean) {
    const candidate = withContext({
      ...form,
      mrp_inr:
        priceDisplay != null && Number.isFinite(priceDisplay)
          ? convertToInr(priceDisplay, currency)
          : undefined,
    });
    const problem = validatePlanogramRow(candidate);
    if (problem) {
      setManualError(
        context && /^(Location|Category|Sub category) is required/.test(problem)
          ? "Set location, category and subcategory in the scan context above first."
          : problem,
      );
      return;
    }
    normalizeMutation.mutate(candidate, {
      onSuccess: () => {
        setForm((prev) =>
          keepContext
            ? {
                ...emptyRow(),
                location: prev.location,
                category: prev.category,
                sub_category: prev.sub_category,
              }
            : emptyRow(),
        );
        setPriceDisplay(undefined);
      },
    });
  }


  const update = (key: string, patch: Partial<DraftRow>) =>
    onRowsChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  return (
    <div className="space-y-5">
      <Tabs defaultValue={manualEntryOnly ? "manual" : "csv"}>
        {!manualEntryOnly ? (
          <TabsList className="rounded-xl">
            <TabsTrigger value="csv">Upload CSV</TabsTrigger>
            <TabsTrigger value="manual">Add manually</TabsTrigger>
          </TabsList>
        ) : null}
        {simplifiedCopy && !manualEntryOnly ? (
          <p className="mt-2 text-[11px] text-muted-foreground">{HOMEPAGE_PRODUCTS_TAB_HELPER}</p>
        ) : null}

        {!manualEntryOnly ? (
        <TabsContent value="csv" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="file"
              accept=".csv,text/csv"
              className="max-w-sm rounded-xl"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                onFilename?.(file.name);
                parseMutation.mutate(file);
                event.target.value = "";
              }}
            />
            {parseMutation.isPending && (
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Parsing CSV…
              </span>
            )}
          </div>
          <div className="space-y-2">
            <div className="text-xs leading-relaxed text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Required: </span>
                {PLANOGRAM_CSV_REQUIRED_LABEL}
              </p>
              <p className="mt-1">
                <span className="font-medium text-foreground">Optional: </span>
                {PLANOGRAM_CSV_OPTIONAL_LABEL}
              </p>
            </div>
            <pre className="overflow-x-auto rounded-md border border-border bg-muted/30 p-2 text-[10px] leading-relaxed text-muted-foreground">
              {SAMPLE_CSV_HEADERS}
            </pre>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={downloadTemplate}>
              <Download className="mr-2 size-4" /> CSV template
            </Button>
          </div>

          {csvError && (
            <StickyError
              title="Planogram upload failed"
              message={csvError}
              onDismiss={() => setCsvError(null)}
            />
          )}

          {preview && (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Location</th>
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2">Sub category</th>
                      <th className="px-3 py-2">Brand</th>
                      <th className="px-3 py-2">Product</th>
                      <th className="px-3 py-2">Variant</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2">SKU</th>
                      <th className="px-3 py-2">Shelf position</th>
                      {hasLegacyAisle && <th className="px-3 py-2">Aisle (legacy)</th>}
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row) => (
                      <tr
                        key={row.row_num}
                        className={
                          row.valid
                            ? "border-t border-border"
                            : "border-t border-border bg-destructive/5"
                        }
                      >
                        <td className="px-3 py-2 text-muted-foreground">{row.row_num}</td>
                        <td className="px-3 py-2">{row.data?.location ?? "—"}</td>
                        <td className="px-3 py-2">{row.data?.category ?? "—"}</td>
                        <td className="px-3 py-2">{row.data?.sub_category ?? "—"}</td>
                        <td className="px-3 py-2">{row.data?.brand ?? "—"}</td>
                        <td className="px-3 py-2">{row.data?.product_name ?? "—"}</td>
                        <td className="px-3 py-2">{row.data?.variant ?? "—"}</td>
                        <td className="px-3 py-2 text-right">{row.data?.expected_qty ?? "—"}</td>
                        <td className="px-3 py-2">{row.data?.sku ?? "—"}</td>
                        <td className="px-3 py-2">{row.data?.shelf_position ?? "—"}</td>
                        {hasLegacyAisle && (
                          <td className="px-3 py-2 text-muted-foreground">
                            {String(
                              (row.data as Record<string, unknown> | null | undefined)?.["aisle"] ??
                                "—",
                            )}
                          </td>
                        )}
                        <td className="px-3 py-2">
                          {!row.valid ? (
                            <span className="flex items-center gap-1.5 text-destructive">
                              <XCircle className="size-4" />
                              {(row.errors ?? []).join(", ") || "Invalid row"}
                            </span>
                          ) : contextIssue(row) ? (
                            <span className="flex items-center gap-1.5 text-destructive">
                              <XCircle className="size-4" />
                              {contextIssue(row)}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-accent">
                              <CheckCircle2 className="size-4" /> Valid
                            </span>
                          )}
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button variant="brand" className="rounded-xl" onClick={importValidRows}>
                <Upload className="mr-2 size-4" /> Import valid rows
              </Button>
            </div>
          )}
        </TabsContent>
        ) : null}

        <TabsContent value="manual" className={manualEntryOnly ? "mt-0" : "mt-4"}>
          {context && (
            <p className="mb-4 rounded-xl border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
              Applied to every product:{" "}
              <span className="font-medium text-foreground">
                {[context.location, context.category, context.subCategoryLabel]
                  .filter(Boolean)
                  .join(" · ") || "set location and category above"}
              </span>
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {!context && (
              <>
                <Field label="Location" required>
                  <Input
                    className="rounded-xl"
                    placeholder="Shelf / aisle code, e.g. A-1-Z"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                  />
                </Field>
                <Field label="Category" required>
                  <Select
                    value={form.category}
                    onValueChange={(value) =>
                      setForm({ ...form, category: value, sub_category: "" })
                    }
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.name} value={category.name}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Sub category" required>
                  {subCategories.length ? (
                    <Select
                      value={form.sub_category}
                      onValueChange={(value) => setForm({ ...form, sub_category: value })}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Select sub category" />
                      </SelectTrigger>
                      <SelectContent>
                        {subCategories.map((sub) => (
                          <SelectItem key={sub.id} value={sub.label}>
                            {sub.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      className="rounded-xl"
                      placeholder={form.category ? "e.g. Shampoo" : "Select a category first"}
                      value={form.sub_category}
                      onChange={(e) => setForm({ ...form, sub_category: e.target.value })}
                    />
                  )}
                </Field>
              </>
            )}

            <Field
              label="Brand"
              required
              helper={simplifiedCopy ? HOMEPAGE_PRODUCT_FIELD_HELP.brand : undefined}
            >
              <Input
                className="rounded-xl"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
              />
            </Field>
            <Field
              label="Product Name"
              required
              helper={simplifiedCopy ? HOMEPAGE_PRODUCT_FIELD_HELP.productName : undefined}
            >
              <Input
                className="rounded-xl"
                value={form.product_name}
                onChange={(e) => setForm({ ...form, product_name: e.target.value })}
              />
            </Field>
            <Field
              label={simplifiedCopy ? "Variant" : "Variant (optional)"}
              helper={simplifiedCopy ? HOMEPAGE_PRODUCT_FIELD_HELP.variant : undefined}
            >
              <Input
                className="rounded-xl"
                placeholder="e.g. 340ml, 25 bags"
                value={form.variant}
                onChange={(e) => setForm({ ...form, variant: e.target.value })}
              />
            </Field>
            <Field
              label={simplifiedCopy ? "Expected Facings" : "Expected facings"}
              required
              helper={simplifiedCopy ? HOMEPAGE_PRODUCT_FIELD_HELP.expectedFacings : undefined}
            >
              <Input
                type="number"
                min={0}
                className="rounded-xl"
                title="Visible product faces expected on shelf — different from inventory quantity."
                placeholder="e.g. 3"
                value={form.expected_facings ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    expected_facings: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </Field>
            <Field
              label={simplifiedCopy ? "Min / Max Facings" : "Min / max facings (optional)"}
              helper={simplifiedCopy ? HOMEPAGE_PRODUCT_FIELD_HELP.minMaxFacings : undefined}
            >
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={0}
                  className="rounded-xl"
                  placeholder="Min"
                  value={form.min_facings ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, min_facings: e.target.value ? Number(e.target.value) : undefined })
                  }
                />
                <Input
                  type="number"
                  min={0}
                  className="rounded-xl"
                  placeholder="Max"
                  value={form.max_facings ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, max_facings: e.target.value ? Number(e.target.value) : undefined })
                  }
                />
              </div>
            </Field>
            <Field
              label={simplifiedCopy ? "Expected Shelf Units" : "Expected shelf units (optional)"}
              helper={simplifiedCopy ? HOMEPAGE_PRODUCT_FIELD_HELP.expectedShelfUnits : undefined}
            >
              <Input
                type="number"
                min={0}
                className="rounded-xl"
                title="Optional inventory unit expectation — separate from visible facings."
                value={form.expected_shelf_units ?? form.expected_qty ?? ""}
                onChange={(e) => {
                  const n = e.target.value ? Number(e.target.value) : undefined;
                  setForm({ ...form, expected_shelf_units: n, expected_qty: n ?? 0 });
                }}
              />
            </Field>
            <Field
              label={simplifiedCopy ? "Price" : `${priceLabel} (optional)`}
              helper={simplifiedCopy ? HOMEPAGE_PRODUCT_FIELD_HELP.price : undefined}
            >
              <Input
                type="number"
                min={0}
                step="0.01"
                className="rounded-xl"
                placeholder={currency === "INR" ? "e.g. 299" : "e.g. 3.99"}
                value={priceDisplay ?? ""}
                onChange={(e) =>
                  setPriceDisplay(e.target.value ? Number(e.target.value) : undefined)
                }
              />
            </Field>
            <Field
              label={simplifiedCopy ? "Daily Sales" : "Daily sales (optional)"}
              helper={simplifiedCopy ? HOMEPAGE_PRODUCT_FIELD_HELP.dailySales : undefined}
            >
              <Input
                type="number"
                min={0}
                className="rounded-xl"
                placeholder="Units per day"
                value={form.avg_daily_sales ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    avg_daily_sales: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </Field>
            <Field
              label={simplifiedCopy ? "SKU" : "SKU (optional)"}
              helper={simplifiedCopy ? HOMEPAGE_PRODUCT_FIELD_HELP.sku : undefined}
            >
              <Input
                className="rounded-xl"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
              />
            </Field>
            <Field
              label={simplifiedCopy ? "Shelf Position" : "Shelf Position (optional)"}
              helper={simplifiedCopy ? HOMEPAGE_PRODUCT_FIELD_HELP.shelfPosition : undefined}
            >
              <Input
                className="rounded-xl"
                value={form.shelf_position}
                onChange={(e) => setForm({ ...form, shelf_position: e.target.value })}
              />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="brand"
              className="rounded-xl"
              disabled={normalizeMutation.isPending}
              onClick={() => submitManual(false)}
            >
              {normalizeMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Plus className="mr-2 size-4" />
              )}
              {simplifiedCopy ? "Save Product" : "Save product"}
            </Button>
            <Button
              variant="outline"
              className="rounded-xl"
              disabled={normalizeMutation.isPending}
              onClick={() => submitManual(true)}
            >
              {simplifiedCopy ? "Save & Add Another" : "Save & add another"}
            </Button>
          </div>
          {manualError && (
            <div className="mt-4">
              <StickyError
                title="Could not add this product"
                message={manualError}
                onDismiss={() => setManualError(null)}
              />
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {tableTitle} ({rows.length})
            </h3>
            {tableDescription ? (
              <p className="mt-1 text-xs text-muted-foreground">{tableDescription}</p>
            ) : null}
          </div>
          {tableActions}
        </div>
        {!rows.length ? (
          <div className="mt-4">
            <EmptyState
              title="No expected products yet"
              description={
                manualEntryOnly
                  ? "Add products using the form above."
                  : "Upload a CSV or add products manually."
              }
            />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Location</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Sub category</th>
                  <th className="px-3 py-2">Brand</th>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Variant</th>
                  <th className="px-3 py-2 text-right">Facings</th>
                  <th className="px-3 py-2 text-right">Shelf units</th>
                  <th className="px-3 py-2 text-right">{priceLabel}</th>
                  <th className="px-3 py-2 text-right">Sales/d</th>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2">Shelf position</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const editing = editingKey === row.key;
                  const cell = (value: string, onChange: (next: string) => void) =>
                    editing ? (
                      <Input
                        className="h-8 rounded-lg"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                      />
                    ) : (
                      <span>{value || "—"}</span>
                    );
                  return (
                    <tr key={row.key} className="border-t border-border align-middle">
                      <td className="px-3 py-2">
                        {cell(row.location, (v) => update(row.key, { location: v }))}
                      </td>
                      <td className="px-3 py-2">
                        {cell(row.category, (v) => update(row.key, { category: v }))}
                      </td>
                      <td className="px-3 py-2">
                        {cell(row.sub_category, (v) => update(row.key, { sub_category: v }))}
                      </td>
                      <td className="px-3 py-2">
                        {cell(row.brand, (v) => update(row.key, { brand: v }))}
                      </td>
                      <td className="px-3 py-2">
                        {cell(row.product_name, (v) => update(row.key, { product_name: v }))}
                      </td>
                      <td className="px-3 py-2">
                        {cell(row.variant, (v) => update(row.key, { variant: v }))}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {editing ? (
                          <Input
                            type="number"
                            min={0}
                            className="h-8 w-20 rounded-lg text-right"
                            value={row.expected_facings ?? ""}
                            onChange={(e) =>
                              update(row.key, {
                                expected_facings: e.target.value ? Number(e.target.value) : undefined,
                              })
                            }
                          />
                        ) : (
                          row.expected_facings ?? "—"
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {editing ? (
                          <Input
                            type="number"
                            min={0}
                            className="h-8 w-20 rounded-lg text-right"
                            value={row.expected_shelf_units ?? row.expected_qty}
                            onChange={(e) =>
                              update(row.key, {
                                expected_shelf_units: e.target.value ? Number(e.target.value) : undefined,
                                expected_qty: Number(e.target.value) || 0,
                              })
                            }
                          />
                        ) : (
                          row.expected_shelf_units ?? row.expected_qty
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {editing ? (
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            className="h-8 w-24 rounded-lg text-right"
                            value={
                              row.mrp_inr != null ? inrToDisplayAmount(row.mrp_inr, currency) : ""
                            }
                            onChange={(e) =>
                              update(row.key, {
                                mrp_inr: e.target.value
                                  ? convertToInr(Number(e.target.value), currency)
                                  : undefined,
                              })
                            }
                          />
                        ) : (
                          formatStoredPrice(row.mrp_inr, currency)
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {editing ? (
                          <Input
                            type="number"
                            min={0}
                            className="h-8 w-20 rounded-lg text-right"
                            value={row.avg_daily_sales ?? ""}
                            onChange={(e) =>
                              update(row.key, {
                                avg_daily_sales: e.target.value
                                  ? Number(e.target.value)
                                  : undefined,
                              })
                            }
                          />
                        ) : (
                          row.avg_daily_sales ?? "—"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {cell(row.sku, (v) => update(row.key, { sku: v }))}
                      </td>
                      <td className="px-3 py-2">
                        {cell(row.shelf_position, (v) => update(row.key, { shelf_position: v }))}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-lg"
                            onClick={() => setEditingKey(editing ? null : row.key)}
                          >
                            {editing ? "Done" : "Edit"}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="rounded-lg text-destructive"
                            aria-label="Delete row"
                            onClick={() => onRowsChange(rows.filter((r) => r.key !== row.key))}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
