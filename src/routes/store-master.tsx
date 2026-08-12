import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
  Plus,
  Trash2,
  Upload,
  UserPlus,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, ErrorState } from "@/components/States";
import { toUserMessage } from "@/lib/api/errors";
import { fetchShelfCategories } from "@/lib/categories.functions";
import { FALLBACK_CATEGORIES, type ShelfCategory } from "@/lib/categories.data";
import {
  activatePlanogram,
  buildHierarchy,
  canManagePlanogram,
  emptyRow,
  fetchPlanogramSnapshot,
  fetchPlanogramStores,
  normalizePlanogramRow,
  parsePlanogramCsv,
  savePlanogramDraft,
  toDraftRow,
  SAMPLE_CSV_TEMPLATE,
  type CsvParseRow,
  type DraftRow,
  type PlanogramRow,
  type SourceType,
} from "@/lib/planogram";
import { AssignScanDialog } from "@/components/planogram/AssignScanDialog";


export const Route = createFileRoute("/store-master")({
  head: () => ({
    meta: [
      { title: "Planogram | Aislix — Expected shelf data" },
      {
        name: "description",
        content:
          "Define the expected planogram for every store: upload a CSV or add products manually, review the draft and activate the source of truth for shelf audits.",
      },
      { property: "og:title", content: "Planogram Management — Aislix" },
      {
        property: "og:description",
        content:
          "Upload or enter expected shelf data per store and activate it as the planogram baseline for Aislix shelf audits.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StoreMasterPage,
});

const card = "rounded-2xl border border-border bg-card p-5 shadow-sm";

function StoreMasterPage() {
  const queryClient = useQueryClient();
  const [storeId, setStoreId] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);

  const [draft, setDraft] = useState<DraftRow[]>([]);
  const [sources, setSources] = useState<{ csv: boolean; manual: boolean }>({
    csv: false,
    manual: false,
  });
  const [filename, setFilename] = useState<string | null>(null);
  const [preview, setPreview] = useState<CsvParseRow[] | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [form, setForm] = useState<PlanogramRow>(emptyRow());
  const [csvError, setCsvError] = useState<string | null>(null);
  const [manualError, setManualError] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);

  const accessQuery = useQuery({
    queryKey: ["planogram-access"],
    queryFn: () => canManagePlanogram(),
    retry: false,
  });
  const storesQuery = useQuery({
    queryKey: ["planogram-stores"],
    queryFn: () => fetchPlanogramStores(),
    retry: false,
  });
  const categoriesQuery = useQuery({
    queryKey: ["shelf-categories"],
    queryFn: () => fetchShelfCategories(),
    staleTime: 10 * 60_000,
  });
  const categories: ShelfCategory[] = categoriesQuery.data?.length
    ? categoriesQuery.data
    : FALLBACK_CATEGORIES;
  const subCategories =
    categories.find((c) => c.name === form.category)?.subcategories ?? [];

  const snapshotQuery = useQuery({
    queryKey: ["planogram-snapshot", storeId],
    queryFn: () => fetchPlanogramSnapshot(storeId),
    enabled: Boolean(storeId),
    retry: false,
  });
  const snapshot = snapshotQuery.data;

  const sourceType: SourceType =
    sources.csv && sources.manual ? "mixed" : sources.manual ? "manual" : "csv";

  const parseMutation = useMutation({
    mutationFn: (file: File) => parsePlanogramCsv(file),
    onMutate: () => setCsvError(null),
    onSuccess: (result) => {
      setPreview(result.rows);
      if (result.error_count > 0 && result.valid_count === 0) {
        const details = (result.errors.length
          ? result.errors
          : result.rows.flatMap((row) => row.errors ?? [])
        ).slice(0, 5);
        setCsvError(
          `CSV has ${result.error_count} error${result.error_count === 1 ? "" : "s"} and no valid rows.${
            details.length ? `\n• ${details.join("\n• ")}` : ""
          }\nRequired columns: location, category, sub_category, brand, product_name, expected_qty, sku, shelf_position.`,
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
      setDraft((rows) => [...rows, row]);
      setSources((s) => ({ ...s, manual: true }));
      toast.success("Product added to the draft.");
    },
    onError: (error) => setManualError(toUserMessage(error)),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      savePlanogramDraft({ storeId, rows: draft, sourceType, sourceFilename: filename }),
    onMutate: () => setDraftError(null),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["planogram-snapshot", storeId] });
      toast.success(`Draft saved — ${draft.length} product${draft.length === 1 ? "" : "s"}.`);
    },
    onError: (error) => setDraftError(toUserMessage(error)),
  });

  const activateMutation = useMutation({
    mutationFn: async () => {
      const version = await savePlanogramDraft({
        storeId,
        rows: draft,
        sourceType,
        sourceFilename: filename,
      });
      return activatePlanogram({ storeId, versionId: version.id, rowCount: draft.length });
    },
    onMutate: () => setDraftError(null),
    onSuccess: async () => {
      const count = draft.length;
      setDraft([]);
      setPreview(null);
      setSources({ csv: false, manual: false });
      setFilename(null);
      await queryClient.invalidateQueries({ queryKey: ["planogram-snapshot", storeId] });
      toast.success(`Planogram activated — ${count} products expected`);
    },
    onError: (error) => setDraftError(toUserMessage(error)),
  });

  function downloadTemplate() {
    const blob = new Blob([SAMPLE_CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "aislix-planogram-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function selectStore(id: string) {
    setStoreId(id);
    setDraft([]);
    setPreview(null);
    setSources({ csv: false, manual: false });
    setFilename(null);
    setEditingKey(null);
    setCsvError(null);
    setManualError(null);
    setDraftError(null);
  }

  function importValidRows() {
    const valid = (preview ?? []).filter((row) => row.valid && row.data);
    if (!valid.length) {
      setCsvError("No valid rows to import. Fix the highlighted rows in your CSV and upload again.");
      return;
    }
    setDraft((rows) => [...rows, ...valid.map((row) => toDraftRow(row.data))]);
    setSources((s) => ({ ...s, csv: true }));
    setPreview(null);
    setCsvError(null);
    toast.success(`${valid.length} row${valid.length === 1 ? "" : "s"} added to the draft.`);
  }

  function submitManual(keepContext: boolean) {
    if (!form.category || !form.brand.trim() || !form.product_name.trim()) {
      setManualError("Category, brand and product name are required.");
      return;
    }
    normalizeMutation.mutate(form, {
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
      },
    });
  }

  const activeHierarchy = useMemo(
    () => buildHierarchy(snapshot?.activeRows ?? []),
    [snapshot?.activeRows],
  );

  const canManage = accessQuery.data !== false;

  if (accessQuery.data === false) {
    return (
      <AppShell title="Planogram" description="Expected planogram data per store.">
        <EmptyState
          title="Manager access required"
          description="Only owners, admins and managers can create or activate planograms. Ask your workspace owner for access."
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Planogram"
      description="Upload and activate expected shelf data (planograms) per store — source of truth for Expected vs Actual audits."
      actions={
        <Button
          variant="brand"
          className="rounded-xl"
          disabled={!snapshot?.active || !storeId}
          title={
            snapshot?.active && storeId
              ? undefined
              : storeId
                ? "Activate a planogram for this store to assign a scan."
                : "Select a store with an active planogram to assign a scan."
          }
          onClick={() => setAssignOpen(true)}
        >
          <UserPlus className="mr-2 size-4" /> Assign scan
        </Button>
      }


    >
      <div className="space-y-6">
        {/* Step 1 — store */}
        <section className={card}>
          <h2 className="text-sm font-semibold text-foreground">Step 1 · Select store</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Planograms are per store. Select a store to upload or activate.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="w-full max-w-xs">
              <Label className="sr-only" htmlFor="store">
                Store
              </Label>
              {storesQuery.isLoading ? (
                <Skeleton className="h-10 w-full rounded-xl" />
              ) : (
                <Select value={storeId} onValueChange={selectStore}>
                  <SelectTrigger id="store" className="rounded-xl">
                    <SelectValue placeholder="Choose a store" />
                  </SelectTrigger>
                  <SelectContent>
                    {(storesQuery.data ?? []).map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                        {store.code ? ` · ${store.code}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {storeId && snapshot?.active && (
              <Badge variant="secondary" className="rounded-lg">
                Active planogram · {snapshot.active.row_count} products
              </Badge>
            )}
            {storeId && snapshot && !snapshot.active && (
              <span className="text-sm text-muted-foreground">No active planogram yet.</span>
            )}
          </div>
          {storesQuery.isError && (
            <p className="mt-3 text-sm text-destructive">
              {toUserMessage(storesQuery.error)}
            </p>
          )}
          {!storesQuery.isLoading && !(storesQuery.data ?? []).length && (
            <p className="mt-3 text-sm text-muted-foreground">
              Add a store first from the Stores page.
            </p>
          )}
        </section>

        {storeId && (
          <>
            {/* Step 2 — inputs */}
            <section id="planogram-upload" className={card}>
              <h2 className="text-sm font-semibold text-foreground">Step 2 · Add expected products</h2>
              <Tabs defaultValue="csv" className="mt-4">
                <TabsList className="rounded-xl">
                  <TabsTrigger value="csv">Upload CSV</TabsTrigger>
                  <TabsTrigger value="manual">Add manually</TabsTrigger>
                </TabsList>

                <TabsContent value="csv" className="mt-4 space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Input
                      type="file"
                      accept=".csv,text/csv"
                      className="max-w-sm rounded-xl"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        setFilename(file.name);
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
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-xs text-muted-foreground">
                      Columns: location, category, sub_category, brand, product_name,
                      expected_qty, sku, shelf_position.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={downloadTemplate}
                    >
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
                              <th className="px-3 py-2">Brand</th>
                              <th className="px-3 py-2">Product</th>
                              <th className="px-3 py-2">Category</th>
                              <th className="px-3 py-2 text-right">Qty</th>
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
                                <td className="px-3 py-2">{row.data?.brand ?? "—"}</td>
                                <td className="px-3 py-2">{row.data?.product_name ?? "—"}</td>
                                <td className="px-3 py-2">{row.data?.category ?? "—"}</td>
                                <td className="px-3 py-2 text-right">
                                  {row.data?.expected_qty ?? "—"}
                                </td>
                                <td className="px-3 py-2">
                                  {row.valid ? (
                                    <span className="flex items-center gap-1.5 text-accent">
                                      <CheckCircle2 className="size-4" /> Valid
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-1.5 text-destructive">
                                      <XCircle className="size-4" />
                                      {(row.errors ?? []).join(", ") || "Invalid row"}
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

                <TabsContent value="manual" className="mt-4">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Location (optional — zone or shelf label, e.g. A-1-Z)">
                      <Input
                        className="rounded-xl"
                        value={form.location}
                        onChange={(e) => setForm({ ...form, location: e.target.value })}
                      />
                    </Field>
                    <Field label="Category">
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
                    <Field label="Sub-category">
                      <Select
                        value={form.sub_category}
                        onValueChange={(value) => setForm({ ...form, sub_category: value })}
                        disabled={!subCategories.length}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue
                            placeholder={
                              subCategories.length ? "Select sub-category" : "Select a category first"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {subCategories.map((sub) => (
                            <SelectItem key={sub.id} value={sub.label}>
                              {sub.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Brand">
                      <Input
                        className="rounded-xl"
                        value={form.brand}
                        onChange={(e) => setForm({ ...form, brand: e.target.value })}
                      />
                    </Field>
                    <Field label="Product name">
                      <Input
                        className="rounded-xl"
                        value={form.product_name}
                        onChange={(e) => setForm({ ...form, product_name: e.target.value })}
                      />
                    </Field>
                    <Field label="Expected qty">
                      <Input
                        type="number"
                        min={1}
                        className="rounded-xl"
                        value={form.expected_qty}
                        onChange={(e) =>
                          setForm({ ...form, expected_qty: Number(e.target.value) || 1 })
                        }
                      />
                    </Field>
                    <Field label="SKU (optional)">
                      <Input
                        className="rounded-xl"
                        value={form.sku}
                        onChange={(e) => setForm({ ...form, sku: e.target.value })}
                      />
                    </Field>
                    <Field label="Shelf position (optional)">
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
                      Save product
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      disabled={normalizeMutation.isPending}
                      onClick={() => submitManual(true)}
                    >
                      Save &amp; add another
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
            </section>

            {/* Step 3 — draft table */}
            <section className={card}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-foreground">
                  Step 3 · Draft planogram ({draft.length})
                </h2>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    disabled={!draft.length || saveMutation.isPending}
                    onClick={() => saveMutation.mutate()}
                  >
                    {saveMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                    Save draft
                  </Button>
                  <Button
                    variant="brand"
                    className="rounded-xl"
                    disabled={!draft.length || activateMutation.isPending || !canManage}
                    onClick={() => activateMutation.mutate()}
                  >
                    {activateMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                    Activate planogram
                  </Button>
                </div>
              </div>

              {draftError && (
                <div className="mt-4">
                  <StickyError
                    title="Could not save the planogram"
                    message={draftError}
                    onDismiss={() => setDraftError(null)}
                  />
                </div>
              )}



              {!draft.length ? (
                <div className="mt-4">
                  <EmptyState
                    title="No planogram yet"
                    description="No planogram yet — upload CSV or add products manually."
                  />
                </div>
              ) : (
                <div className="mt-4 overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Location</th>
                        <th className="px-3 py-2">Category</th>
                        <th className="px-3 py-2">Sub-category</th>
                        <th className="px-3 py-2">Brand</th>
                        <th className="px-3 py-2">Product</th>
                        <th className="px-3 py-2 text-right">Expected qty</th>
                        <th className="px-3 py-2">SKU</th>
                        <th className="px-3 py-2">Shelf position</th>
                        <th className="px-3 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draft.map((row) => {
                        const editing = editingKey === row.key;
                        const update = (patch: Partial<DraftRow>) =>
                          setDraft((rows) =>
                            rows.map((r) => (r.key === row.key ? { ...r, ...patch } : r)),
                          );
                        const cell = (
                          value: string,
                          onChange: (next: string) => void,
                        ) =>
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
                              {cell(row.location, (v) => update({ location: v }))}
                            </td>
                            <td className="px-3 py-2">
                              {cell(row.category, (v) => update({ category: v }))}
                            </td>
                            <td className="px-3 py-2">
                              {cell(row.sub_category, (v) => update({ sub_category: v }))}
                            </td>
                            <td className="px-3 py-2">
                              {cell(row.brand, (v) => update({ brand: v }))}
                            </td>
                            <td className="px-3 py-2">
                              {cell(row.product_name, (v) => update({ product_name: v }))}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {editing ? (
                                <Input
                                  type="number"
                                  min={1}
                                  className="h-8 w-20 rounded-lg text-right"
                                  value={row.expected_qty}
                                  onChange={(e) =>
                                    update({ expected_qty: Number(e.target.value) || 1 })
                                  }
                                />
                              ) : (
                                row.expected_qty
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {cell(row.sku, (v) => update({ sku: v }))}
                            </td>
                            <td className="px-3 py-2">
                              {cell(row.shelf_position, (v) => update({ shelf_position: v }))}
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
                                  onClick={() =>
                                    setDraft((rows) => rows.filter((r) => r.key !== row.key))
                                  }
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
            </section>

            {/* Step 4 — active hierarchy */}
            {snapshotQuery.isError ? (
              <ErrorState
                title="Could not load the planogram"
                description={toUserMessage(snapshotQuery.error)}
                onRetry={() => void snapshotQuery.refetch()}
              />
            ) : snapshot?.active ? (
              <section className={card}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">
                      Active planogram · {snapshot.active.row_count} products expected
                    </h2>
                    {snapshot.active.activated_at && (
                      <span className="text-xs text-muted-foreground">
                        Activated {new Date(snapshot.active.activated_at).toLocaleString("en-IN")}
                      </span>
                    )}
                  </div>
                  <Button variant="brand" size="sm" className="rounded-xl" asChild>
                    <Link to="/assign-scan" search={{ store: storeId }}>
                      <UserPlus className="mr-2 size-4" /> Assign scan to team member
                    </Link>
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="rounded-xl" asChild>
                    <Link to="/assign-scan" search={{ store: storeId }}>
                      Assign scan to team member
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-xl" asChild>
                    <Link
                      to="/assigned-scans"
                      search={{ tab: "assignments", store: storeId }}
                    >
                      View assignments
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-xl" asChild>
                    <a href="#planogram-upload">Upload new version</a>
                  </Button>
                </div>
                <div className="mt-4 space-y-4">
                  {activeHierarchy.map((category) => (
                    <div key={category.category} className="rounded-xl border border-border p-4">
                      <p className="text-sm font-medium text-foreground">{category.category}</p>
                      {category.subCategories.map((sub) => (
                        <div key={sub.sub_category} className="mt-3 pl-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {sub.sub_category}
                          </p>
                          <ul className="mt-1.5 space-y-1">
                            {sub.products.map((product, index) => (
                              <li
                                key={`${product.brand}-${product.product_name}-${index}`}
                                className="flex items-center justify-between gap-3 text-sm"
                              >
                                <span>
                                  {product.brand} · {product.product_name}
                                  {product.location ? (
                                    <span className="text-muted-foreground"> · {product.location}</span>
                                  ) : null}
                                </span>
                                <span className="shrink-0 text-muted-foreground">
                                  Expected {product.expected_qty}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}

/** Inline destructive alert that stays until dismissed — never auto-hides. */
function StickyError({
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
