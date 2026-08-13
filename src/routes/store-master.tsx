import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  fetchPlanogramSnapshot,
  fetchPlanogramStores,
  savePlanogramDraft,
  type DraftRow,
  type SourceType,
} from "@/lib/planogram";
import { PlanogramBuilder, StickyError } from "@/components/planogram/PlanogramBuilder";
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

  const snapshotQuery = useQuery({
    queryKey: ["planogram-snapshot", storeId],
    queryFn: () => fetchPlanogramSnapshot(storeId),
    enabled: Boolean(storeId),
    retry: false,
  });
  const snapshot = snapshotQuery.data;

  const sourceType: SourceType =
    sources.csv && sources.manual ? "mixed" : sources.manual ? "manual" : "csv";

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
      setSources({ csv: false, manual: false });
      setFilename(null);
      await queryClient.invalidateQueries({ queryKey: ["planogram-snapshot", storeId] });
      toast.success(`Planogram activated — ${count} products expected`);
    },
    onError: (error) => setDraftError(toUserMessage(error)),
  });

  function selectStore(id: string) {
    setStoreId(id);
    setDraft([]);
    setSources({ csv: false, manual: false });
    setFilename(null);
    setDraftError(null);
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
            <p className="mt-3 text-sm text-destructive">{toUserMessage(storesQuery.error)}</p>
          )}
          {!storesQuery.isLoading && !(storesQuery.data ?? []).length && (
            <p className="mt-3 text-sm text-muted-foreground">
              Add a store first from the Stores page.
            </p>
          )}
        </section>

        {storeId && (
          <>
            {/* Step 2 — expected products */}
            <section id="planogram-upload" className={card}>
              <h2 className="text-sm font-semibold text-foreground">
                Step 2 · Add expected products
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Location, Category, Sub category, Brand and Product Name are required. Variant, SKU
                and Shelf Position are optional.
              </p>
              {draftError && (
                <div className="mt-4">
                  <StickyError
                    title="Could not save the planogram"
                    message={draftError}
                    onDismiss={() => setDraftError(null)}
                  />
                </div>
              )}
              <div className="mt-4">
                <PlanogramBuilder
                  rows={draft}
                  onRowsChange={setDraft}
                  categories={categories}
                  onFilename={setFilename}
                  onSource={(source) => setSources((s) => ({ ...s, [source]: true }))}
                  tableTitle="Draft planogram"
                  tableActions={
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
                        {activateMutation.isPending && (
                          <Loader2 className="mr-2 size-4 animate-spin" />
                        )}
                        Activate planogram
                      </Button>
                    </div>
                  }
                />
              </div>
            </section>

            {/* Step 3 — active hierarchy */}
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
                  <Button
                    variant="brand"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setAssignOpen(true)}
                  >
                    <UserPlus className="mr-2 size-4" /> Assign scan to team member
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="rounded-xl" asChild>
                    <Link to="/assigned-scans" search={{ tab: "assignments", store: storeId }}>
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
                                    <span className="text-muted-foreground">
                                      {" "}
                                      · {product.location}
                                    </span>
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
      <AssignScanDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        storeId={storeId}
        storeName={(storesQuery.data ?? []).find((store) => store.id === storeId)?.name ?? "Store"}
        rows={(snapshot?.activeRows ?? []).map((row) => ({
          location: row.location,
          category: row.category,
          sub_category: row.sub_category,
        }))}
      />
    </AppShell>
  );
}
