import { useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, LayoutList, Loader2, Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { canManagePlanogram, fetchPlanogramStores } from "@/lib/planogram";
import {
  deleteStorePlanogram,
  loadStorePlanograms,
  type PlanogramVersionSummary,
} from "@/lib/planogram-library";
import {
  PlanogramEditorDialog,
  type PlanogramEditorTarget,
} from "@/components/planogram/PlanogramEditorDialog";

export const Route = createFileRoute("/store-master")({
  head: () => ({
    meta: [
      { title: "Planogram library | Aislix — Expected shelf data" },
      {
        name: "description",
        content:
          "Manage every planogram for a store: upload a CSV or add rows manually, edit or delete unassigned planograms, and assign a shelf audit to your team.",
      },
      { property: "og:title", content: "Planogram library — Aislix" },
      {
        property: "og:description",
        content:
          "Upload expected shelf products per store, keep a library of planograms ready to assign, and delegate audits to your team in Aislix.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StoreMasterPage,
});

const card = "rounded-2xl border border-border bg-card p-5 shadow-sm";

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function scopeLine(version: PlanogramVersionSummary): string {
  return [
    version.category,
    version.sub_category,
    version.location,
    `${version.row_count} product${version.row_count === 1 ? "" : "s"}`,
    `${version.facing_count} facing${version.facing_count === 1 ? "" : "s"}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

function StoreMasterPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [storeId, setStoreId] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTarget, setEditorTarget] = useState<PlanogramEditorTarget>({ mode: "create" });
  const [deleteTarget, setDeleteTarget] = useState<PlanogramVersionSummary | null>(null);
  const [assignedOpen, setAssignedOpen] = useState(false);

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

  const libraryQuery = useQuery({
    queryKey: ["planogram-library", storeId],
    queryFn: () => loadStorePlanograms(storeId),
    enabled: Boolean(storeId),
    retry: false,
  });
  const unassigned = libraryQuery.data?.unassigned ?? [];
  const assigned = libraryQuery.data?.assigned ?? [];

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["planogram-library", storeId] });

  const deleteMutation = useMutation({
    mutationFn: (versionId: string) => deleteStorePlanogram(versionId),
    onSuccess: async () => {
      setDeleteTarget(null);
      await refresh();
      toast.success("Planogram deleted.");
    },
    onError: (error) => toast.error(toUserMessage(error)),
  });

  const storeName =
    (storesQuery.data ?? []).find((store) => store.id === storeId)?.name ?? "this store";

  function openCreate() {
    setEditorTarget({ mode: "create" });
    setEditorOpen(true);
  }

  function openEdit(version: PlanogramVersionSummary) {
    setEditorTarget({ mode: "edit", versionId: version.id, name: version.name });
    setEditorOpen(true);
  }

  function assign(version: PlanogramVersionSummary) {
    void navigate({
      to: "/assign-scan",
      search: { store: storeId, scope: "planogram", planogramVersion: version.id },
    });
  }

  if (accessQuery.data === false) {
    return (
      <AppShell title="Planogram" description="Expected planogram data per store.">
        <EmptyState
          title="Manager access required"
          description="Only owners, admins and managers can create or assign planograms. Ask your workspace owner for access."
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Planogram"
      description="Keep a library of expected shelf data (planograms) per store, then assign a audit to your team."
      actions={
        <Button variant="brand" className="rounded-xl" disabled={!storeId} onClick={openCreate}>
          <Plus className="mr-2 size-4" /> Add planogram
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Step 1 — store */}
        <section className={card}>
          <h2 className="text-sm font-semibold text-foreground">Step 1 · Select store</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Planograms are per store. Select a store to manage its library.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="w-full max-w-xs">
              <Label className="sr-only" htmlFor="store">
                Store
              </Label>
              {storesQuery.isLoading ? (
                <Skeleton className="h-10 w-full rounded-xl" />
              ) : (
                <Select value={storeId} onValueChange={setStoreId}>
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
            {storeId && libraryQuery.data && (
              <Badge variant="secondary" className="rounded-lg">
                {unassigned.length} ready to assign · {assigned.length} assigned
              </Badge>
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

        {!storeId ? (
          <EmptyState
            title="Select a store to manage planograms"
            description="Choose a store above to see its planogram library and assign audits."
            icon={<LayoutList className="size-5" />}
          />
        ) : libraryQuery.isError ? (
          <ErrorState
            title="Could not load planograms"
            description={toUserMessage(libraryQuery.error)}
            onRetry={() => void libraryQuery.refetch()}
          />
        ) : (
          <>
            {/* Ready to assign */}
            <section className={card}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    Planograms ready to assign
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Editable until you assign them to a team member.
                  </p>
                </div>
                <Button variant="brand" size="sm" className="rounded-xl" onClick={openCreate}>
                  <Plus className="mr-2 size-4" /> Add planogram
                </Button>
              </div>

              <div className="mt-4 space-y-3">
                {libraryQuery.isLoading ? (
                  <>
                    <Skeleton className="h-24 w-full rounded-xl" />
                    <Skeleton className="h-24 w-full rounded-xl" />
                  </>
                ) : !unassigned.length ? (
                  <EmptyState
                    title="No planograms waiting to assign"
                    description="Upload expected shelf products, then assign a audit to your team."
                    icon={<LayoutList className="size-5" />}
                    action={
                      <Button variant="brand" className="rounded-xl" onClick={openCreate}>
                        <Plus className="mr-2 size-4" /> Add planogram
                      </Button>
                    }
                  />
                ) : (
                  unassigned.map((version) => (
                    <article key={version.id} className="rounded-xl border border-border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {version.name}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">{scopeLine(version)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Uploaded {formatDate(version.created_at)} ·{" "}
                            {version.source_type.toUpperCase()} · {version.status}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl"
                            onClick={() => openEdit(version)}
                          >
                            <Pencil className="mr-2 size-4" /> Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-xl text-destructive"
                            onClick={() => setDeleteTarget(version)}
                          >
                            <Trash2 className="mr-2 size-4" /> Delete
                          </Button>
                          <Button
                            variant="brand"
                            size="sm"
                            className="rounded-xl"
                            onClick={() => assign(version)}
                          >
                            <UserPlus className="mr-2 size-4" /> Assign audit
                          </Button>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

            {/* Assigned to team */}
            <section className={card}>
              <Collapsible open={assignedOpen} onOpenChange={setAssignedOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <span>
                      <span className="text-sm font-semibold text-foreground">
                        Assigned to team ({assigned.length})
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Read-only — the assignment owns this planogram snapshot.
                      </span>
                    </span>
                    <ChevronDown
                      className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                        assignedOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4">
                  {!assigned.length ? (
                    <p className="text-sm text-muted-foreground">
                      No planograms are assigned for this store yet.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2">Planogram</th>
                            <th className="px-3 py-2">Location · Category</th>
                            <th className="px-3 py-2">Assignee</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Due</th>
                            <th className="px-3 py-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {assigned.map((version) => (
                            <tr key={version.id} className="border-t border-border">
                              <td className="px-3 py-2 font-medium text-foreground">
                                {version.name}
                                <span className="block text-xs font-normal text-muted-foreground">
                                  {version.row_count} products · {version.facing_count} facings
                                </span>
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {[version.location, version.category, version.sub_category]
                                  .filter(Boolean)
                                  .join(" · ") || "—"}
                              </td>
                              <td className="px-3 py-2">{version.assignment?.assignee_name}</td>
                              <td className="px-3 py-2">
                                <Badge variant="secondary" className="rounded-lg capitalize">
                                  {version.assignment?.status ?? "pending"}
                                </Badge>
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {formatDate(version.assignment?.due_at ?? null)}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <Button variant="outline" size="sm" className="rounded-xl" asChild>
                                  <Link
                                    to="/assigned-scans"
                                    search={{ tab: "assignments", store: storeId }}
                                  >
                                    View assignment
                                  </Link>
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </section>
          </>
        )}
      </div>

      {storeId && (
        <PlanogramEditorDialog
          open={editorOpen}
          onOpenChange={setEditorOpen}
          storeId={storeId}
          storeName={storeName}
          categories={categories}
          target={editorTarget}
          onSaved={() => void refresh()}
        />
      )}

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this planogram?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete “{deleteTarget?.name}” and all {deleteTarget?.row_count ?? 0} expected
              products? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
              }}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Delete planogram
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
