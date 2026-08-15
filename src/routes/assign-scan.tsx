import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, RotateCcw, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { formatAssignmentId } from "@/components/AssignmentId";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/States";
import { toUserMessage } from "@/lib/api/errors";
import { fetchShelfCategories } from "@/lib/categories.functions";
import { FALLBACK_CATEGORIES, type ShelfCategory } from "@/lib/categories.data";
import {
  createAssignmentPlanogramVersion,
  dominantScopeFromRows,
  fetchPlanogramItems,
  fetchPlanogramSnapshot,
  fetchPlanogramStores,
  type DraftRow,
  type SourceType,
} from "@/lib/planogram";
import { markPlanogramAssigned, updateStorePlanogram } from "@/lib/planogram-library";
import { PlanogramBuilder, StickyError } from "@/components/planogram/PlanogramBuilder";
import { dominantScope } from "@/components/planogram/AssignScanDialog";
import { CategorySubcategoryPicker } from "@/components/scan/CategorySubcategoryPicker";
import {
  selectionsFromLegacy,
  type CategorySelection,
} from "@/lib/category-selections";

import {
  createScanAssignment,
  fetchAssignableMembers,
  isOrgManager,
  type ScopeType,
} from "@/lib/assignments";


export const Route = createFileRoute("/assign-scan")({
  validateSearch: (search: Record<string, unknown>) => ({
    store: typeof search.store === "string" ? search.store : undefined,
    scope: search.scope === "planogram" ? ("planogram" as const) : undefined,
    planogramVersion:
      typeof search.planogramVersion === "string" ? search.planogramVersion : undefined,
  }),

  head: () => ({
    meta: [
      { title: "Assign Scan — Delegate a shelf audit | Aislix" },
      {
        name: "description",
        content:
          "Assign a shelf audit to a team member by category, sub-category, shelf location or an exact planogram product list.",
      },
      { property: "og:title", content: "Assign Scan — Aislix" },
      {
        property: "og:description",
        content: "Delegate shelf audits to your store team and track them to completion in Aislix.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AssignScanPage,
});

const card = "rounded-2xl border border-border bg-card p-5 shadow-sm";

function AssignScanPage() {
  const navigate = useNavigate();
  const {
    store: storeFromSearch,
    scope: scopeFromSearch,
    planogramVersion: versionFromSearch,
  } = Route.useSearch();
  const [storeId, setStoreId] = useState(storeFromSearch ?? "");

  const [scopeType, setScopeType] = useState<ScopeType>(
    scopeFromSearch === "planogram" ? "planogram" : "category",
  );
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [subSelections, setSubSelections] = useState<CategorySelection[]>([]);
  const [location, setLocation] = useState("");

  const [assigneeId, setAssigneeId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [instructions, setInstructions] = useState("");

  // Planogram scope — the assignment's own expected product list.
  const [planogramRows, setPlanogramRows] = useState<DraftRow[]>([]);
  const [sources, setSources] = useState<{ csv: boolean; manual: boolean }>({
    csv: false,
    manual: false,
  });
  const [csvFilename, setCsvFilename] = useState<string | null>(null);
  const [planogramError, setPlanogramError] = useState<string | null>(null);


  const accessQuery = useQuery({
    queryKey: ["assignment-manager"],
    queryFn: () => isOrgManager(),
    retry: false,
  });
  const storesQuery = useQuery({
    queryKey: ["planogram-stores"],
    queryFn: () => fetchPlanogramStores(),
    retry: false,
  });
  const membersQuery = useQuery({
    queryKey: ["assignable-members"],
    queryFn: () => fetchAssignableMembers(),
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
  const subCategories = useMemo(
    () => categories.find((item) => item.name === category)?.subcategories ?? [],
    [categories, category],
  );

  const planogramMode = scopeType === "planogram";

  // Arriving from the Planogram page with a filter scope: pre-fill and lock it.
  const fromPlanogram = Boolean(storeFromSearch) && scopeFromSearch !== "planogram";
  const snapshotQuery = useQuery({
    queryKey: ["planogram-snapshot", storeId],
    queryFn: () => fetchPlanogramSnapshot(storeId),
    enabled: Boolean(storeFromSearch) && Boolean(storeId),
    retry: false,
  });
  const activeRows = snapshotQuery.data?.activeRows ?? [];
  const activeVersionId = snapshotQuery.data?.active?.id ?? null;
  const planogramScope = useMemo(
    () =>
      dominantScope(
        activeRows.map((row) => ({
          location: row.location,
          category: row.category,
          sub_category: row.sub_category,
        })),
      ),
    [activeRows],
  );

  useEffect(() => {
    if (!fromPlanogram || !activeRows.length) return;
    setScopeType(planogramScope.location ? "location" : planogramScope.subCategory ? "sub_category" : "category");
    setCategory(planogramScope.category);
    setSubCategory(planogramScope.subCategory);
    setLocation(planogramScope.location);
  }, [fromPlanogram, activeRows.length, planogramScope]);

  /** Rows of a specific planogram version, used to pre-load the Planogram tab. */
  const preloadVersionId = versionFromSearch ?? null;
  const preloadQuery = useQuery({
    queryKey: ["planogram-items", preloadVersionId],
    queryFn: () => fetchPlanogramItems(preloadVersionId!),
    enabled: scopeFromSearch === "planogram" && Boolean(preloadVersionId),
    retry: false,
  });

  const [preloaded, setPreloaded] = useState(false);
  useEffect(() => {
    if (preloaded || scopeFromSearch !== "planogram") return;
    const rows = preloadVersionId ? preloadQuery.data : activeRows;
    if (!rows?.length) return;
    setPlanogramRows(rows);
    setPreloaded(true);
  }, [preloaded, scopeFromSearch, preloadVersionId, preloadQuery.data, activeRows]);

  const planogramSummary = useMemo(() => dominantScopeFromRows(planogramRows), [planogramRows]);
  const sourceType: SourceType =
    sources.csv && sources.manual ? "mixed" : sources.manual ? "manual" : "csv";

  const loadActiveMutation = useMutation({
    mutationFn: async () => {
      if (!storeId) throw new Error("Select a store first.");
      const snapshot = await fetchPlanogramSnapshot(storeId);
      if (!snapshot.active) throw new Error("This store has no active planogram yet.");
      return fetchPlanogramItems(snapshot.active.id);
    },
    onSuccess: (rows) => {
      setPlanogramRows(rows);
      setSources({ csv: false, manual: false });
      setPlanogramError(null);
      toast.success(`Loaded ${rows.length} product${rows.length === 1 ? "" : "s"}.`);
    },
    onError: (error) => setPlanogramError(toUserMessage(error)),
  });

  const members = membersQuery.data ?? [];

  const assignee = members.find((member) => member.user_id === assigneeId);

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (planogramMode) {
        // Coming from the store's planogram library: reuse that version (any row
        // edits made here are saved back to it) instead of cloning a new one.
        let versionId: string;
        if (preloadVersionId) {
          await updateStorePlanogram({
            versionId: preloadVersionId,
            storeId,
            rows: planogramRows,
            sourceType,
          });
          await markPlanogramAssigned(preloadVersionId);
          versionId = preloadVersionId;
        } else {
          versionId = await createAssignmentPlanogramVersion({
            storeId,
            rows: planogramRows,
            sourceType,
            sourceFilename: csvFilename,
          });
        }
        return createScanAssignment({
          storeId,
          scopeType: "planogram",
          scopeValues: {
            ...(planogramSummary.category ? { category: planogramSummary.category } : {}),
            ...(planogramSummary.sub_category
              ? { sub_category: planogramSummary.sub_category }
              : {}),
            ...(planogramSummary.location ? { location: planogramSummary.location } : {}),
            product_count: planogramSummary.productCount,
            facing_count: planogramSummary.facingCount,
          },
          planogramVersionId: versionId,
          assigneeId,
          assigneeName: assignee?.name ?? "team member",
          dueAt: dueAt || null,
          instructions,
        });
      }
      return createScanAssignment({
        storeId,
        scopeType,
        scopeValues: fromPlanogram
          ? {
              ...(category ? { category } : {}),
              ...(subCategory ? { sub_category: subCategory } : {}),
              ...(location.trim() ? { location: location.trim() } : {}),
            }
          : scopeType === "location"
            ? { location: location.trim() }
            : scopeType === "sub_category"
              ? {
                  category: subSelections[0]?.category_name ?? category,
                  sub_category:
                    subSelections[0]?.sub_category_label ??
                    subSelections[0]?.sub_category_id ??
                    subCategory,
                  category_selections: subSelections,
                  categories: subSelections.map((s) => s.category_name),
                  sub_categories: subSelections.map((s) => s.sub_category_id),
                }
              : { category },

        planogramVersionId: fromPlanogram ? activeVersionId : null,
        assigneeId,
        assigneeName: assignee?.name ?? "team member",
        dueAt: dueAt || null,
        instructions,
      });
    },
    onSuccess: (assignmentId) => {
      toast.success(
        `Scan assigned to ${assignee?.name ?? "team member"} — ID: ${formatAssignmentId(assignmentId)}`,
      );
      void navigate({ to: "/assigned-scans" });
    },
    onError: (error) => toast.error(toUserMessage(error)),
  });

  function submit(): void {
    if (!storeId) {
      toast.error("Select a store first.");
      return;
    }
    if (!assigneeId) {
      toast.error("Select a team member to assign to.");
      return;
    }
    if (planogramMode) {
      if (!planogramRows.length) {
        setPlanogramError("Add at least one expected product before assigning this scan.");
        return;
      }
      setPlanogramError(null);
      assignMutation.mutate();
      return;
    }
    if (scopeType === "location" && !location.trim()) {
      toast.error("Enter the location or shelf label.");
      return;
    }
    if (scopeType === "sub_category" && !subSelections.length) {
      toast.error("Add at least one shelf type (category · subcategory).");
      return;
    }
    if (scopeType === "category" && !category) {
      toast.error("Select a category.");
      return;
    }
    assignMutation.mutate();
  }


  if (accessQuery.data === false) {
    return (
      <AppShell title="Assign Scan" description="Delegate a shelf audit to your team.">
        <EmptyState
          title="Manager access required"
          description="Only owners, admins and managers can assign scans. Ask your workspace owner for access."
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Assign Scan"
      description="Send a scoped shelf audit to a team member and track it through to completion."
    >
      <div className="max-w-3xl space-y-6">
        {fromPlanogram ? (
          <section className={card}>
            <h2 className="text-sm font-semibold text-foreground">Store &amp; scope</h2>
            <p className="mt-2 text-sm font-medium text-foreground">
              Store ·{" "}
              {(storesQuery.data ?? []).find((store) => store.id === storeId)?.name ?? "Store"}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              {[planogramScope.category, planogramScope.subCategory, planogramScope.location]
                .filter(Boolean)
                .map((value) => (
                  <span
                    key={value}
                    className="rounded-lg bg-surface px-2 py-1 font-medium text-foreground"
                  >
                    {value}
                  </span>
                ))}
              <span className="rounded-lg bg-brand-soft px-2 py-1 font-medium text-brand">
                {activeRows.length} expected products from active planogram
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Read-only — set by this store&apos;s active planogram.
            </p>
          </section>
        ) : (
          <>
            <section className={card}>
              <h2 className="text-sm font-semibold text-foreground">Step 1 · Select store</h2>
              <div className="mt-3 max-w-xs">
                {storesQuery.isLoading ? (
                  <Skeleton className="h-10 w-full rounded-xl" />
                ) : (
                  <Select value={storeId} onValueChange={setStoreId}>
                    <SelectTrigger className="rounded-xl">
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
            </section>

            <section className={card}>
              <h2 className="text-sm font-semibold text-foreground">Step 2 · Scope</h2>
              <Tabs
                value={scopeType}
                onValueChange={(value) => setScopeType(value as ScopeType)}
                className="mt-3"
              >
                <TabsList className="flex-wrap rounded-xl">
                  <TabsTrigger value="category">By category</TabsTrigger>
                  <TabsTrigger value="sub_category">By sub-category</TabsTrigger>
                  <TabsTrigger value="location">By location</TabsTrigger>
                  <TabsTrigger value="planogram">By planogram</TabsTrigger>
                </TabsList>
              </Tabs>

              {planogramMode && (
                <div className="mt-4 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Define the exact products this audit must cover — upload a CSV or add rows
                    manually. The assignee scans against this list only.
                  </p>

                  {planogramError && (
                    <StickyError
                      title="Planogram needs attention"
                      message={planogramError}
                      onDismiss={() => setPlanogramError(null)}
                    />
                  )}

                  {!storeId ? (
                    <p className="text-sm text-muted-foreground">
                      Select a store in Step 1 to build its planogram.
                    </p>
                  ) : (
                    <PlanogramBuilder
                      rows={planogramRows}
                      onRowsChange={setPlanogramRows}
                      categories={categories}
                      onFilename={setCsvFilename}
                      onSource={(source) =>
                        setSources((prev) => ({ ...prev, [source]: true }))
                      }
                      tableTitle="Expected products for this assignment"
                      tableActions={
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-xl"
                            disabled={loadActiveMutation.isPending}
                            onClick={() => loadActiveMutation.mutate()}
                          >
                            {loadActiveMutation.isPending ? (
                              <Loader2 className="mr-2 size-4 animate-spin" />
                            ) : (
                              <RotateCcw className="mr-2 size-4" />
                            )}
                            Load active planogram
                          </Button>
                          {planogramRows.length > 0 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="rounded-xl text-destructive"
                              onClick={() => {
                                setPlanogramRows([]);
                                setSources({ csv: false, manual: false });
                                setCsvFilename(null);
                              }}
                            >
                              <Trash2 className="mr-2 size-4" />
                              Clear all
                            </Button>
                          )}
                        </div>
                      }
                    />
                  )}

                  {planogramRows.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      <span className="rounded-lg bg-brand-soft px-2 py-1 font-medium text-brand">
                        {planogramSummary.productCount} products ·{" "}
                        {planogramSummary.facingCount} expected facings
                      </span>
                      {[
                        planogramSummary.category,
                        planogramSummary.sub_category,
                        planogramSummary.location,
                      ]
                        .filter(Boolean)
                        .map((value) => (
                          <span
                            key={value}
                            className="rounded-lg bg-surface px-2 py-1 font-medium text-foreground"
                          >
                            {value}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {!planogramMode && scopeType !== "location" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Category</Label>
                    <Select
                      value={category}
                      onValueChange={(value) => {
                        setCategory(value);
                        setSubCategory("");
                      }}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((item) => (
                          <SelectItem key={item.name} value={item.name}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {scopeType === "sub_category" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Sub-category</Label>
                    <Select
                      value={subCategory}
                      onValueChange={setSubCategory}
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
                  </div>
                )}
                {scopeType === "location" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground" htmlFor="location">
                      Location / shelf label
                    </Label>
                    <Input
                      id="location"
                      className="rounded-xl"
                      placeholder="e.g. A-1-Z"
                      value={location}
                      onChange={(event) => setLocation(event.target.value)}
                    />
                  </div>
                )}
              </div>
            </section>
          </>
        )}


        <section className={card}>
          <h2 className="text-sm font-semibold text-foreground">Step 3 · Assign to team member</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Assign to team member</Label>
              {membersQuery.isLoading ? (
                <Skeleton className="h-10 w-full rounded-xl" />
              ) : members.length ? (
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select a team member" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((member) => (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        {member.name}
                        {member.email ? ` · ${member.email}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Invite a team member first —{" "}
                  <Link to="/team" className="font-medium text-brand underline">
                    go to Team
                  </Link>
                  .
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground" htmlFor="due">
                Due date (optional)
              </Label>
              <Input
                id="due"
                type="date"
                className="rounded-xl"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs text-muted-foreground" htmlFor="instructions">
                Instructions (optional)
              </Label>
              <Textarea
                id="instructions"
                className="rounded-xl"
                rows={3}
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="brand"
              className="rounded-xl"
              disabled={assignMutation.isPending || !members.length}
              onClick={submit}
            >
              {assignMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 size-4" />
              )}
              Assign scan
            </Button>
            <Button variant="outline" className="rounded-xl" asChild>
              <Link to="/assigned-scans">View assigned scans</Link>
            </Button>
          </div>
          {membersQuery.isError && (
            <p className="mt-3 text-sm text-destructive">{toUserMessage(membersQuery.error)}</p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
