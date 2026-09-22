import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Store as StoreIcon } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/design-system/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState } from "@/components/States";
import {
  BulkOperationsPanel,
  DeleteStoreDialog,
  OrganizationOverview,
  StoreCard,
  StoreCardSkeleton,
  StoreFormDialog,
  useStoreActions,
} from "@/components/org/OrgParts";
import {
  bulkArchiveStores,
  exportStoreList,
  fetchOrganization,
  fetchStoreList,
  importStoresCsv,
  storeFilterLabels,
  type OrgStore,
  type StoreFilter,
} from "@/lib/organization";
import { getMembership } from "@/lib/db/context";

const PAGE_SIZE = 12;
const filters: StoreFilter[] = ["all", "active", "archived", "healthy", "alerts"];

export const Route = createFileRoute("/stores/")({
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    q?: string | undefined;
    filter?: StoreFilter | undefined;
    page?: number | undefined;
    model?: string | undefined;
  } => {
    const q = typeof search['q'] === "string" && search['q'] ? { q: search['q'] as string } : {};
    const rawFilter = search['filter'];
    const filter =
      typeof rawFilter === "string" && filters.includes(rawFilter as StoreFilter)
        ? { filter: rawFilter as StoreFilter }
        : {};
    const rawPage = Number(search['page']);
    const page = Number.isFinite(rawPage) && rawPage > 1 ? { page: Math.floor(rawPage) } : {};
    const model =
      typeof search['model'] === "string" && search['model']
        ? { model: search['model'] as string }
        : {};
    return { ...q, ...filter, ...page, ...model };
  },
  head: () => ({
    meta: [
      { title: "Organization & Stores — Aislix" },
      {
        name: "description",
        content:
          "Manage your Aislix organization: subscription usage, active users and every store's shelf health, alerts and team access.",
      },
      { property: "og:title", content: "Organization & store management — Aislix" },
      {
        property: "og:description",
        content: "One dashboard for single stores or hundreds of retail locations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StoresPage,
});

function StoresPage() {
  const { q, filter = "all", page = 1, model } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState(q ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<OrgStore | null>(null);
  const [deleting, setDeleting] = useState<OrgStore | null>(null);

  const orgQuery = useQuery({
    queryKey: ["organization"],
    queryFn: ({ signal }) => fetchOrganization(signal),
    retry: false,
  });

  const storesQuery = useQuery({
    queryKey: ["stores", { q, filter, page, model }],
    queryFn: ({ signal }) =>
      fetchStoreList(
        {
          ...(q ? { search: q } : {}),
          filter,
          page,
          page_size: PAGE_SIZE,
          ...(model ? { model } : {}),
        },
        signal,
      ),
    retry: false,
  });

  const { archive, remove } = useStoreActions();

  const roleQuery = useQuery({
    queryKey: ["membership-role"],
    queryFn: () => getMembership(),
    retry: false,
  });
  const canDelete =
    roleQuery.data?.role === "owner" || roleQuery.data?.role === "admin";

  const stores = storesQuery.data?.items ?? [];
  const total = storesQuery.data?.total ?? stores.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const allSelected = stores.length > 0 && stores.every((s) => selected.includes(s.id));

  const setSearch = (next: {
    q?: string | undefined;
    filter?: StoreFilter | undefined;
    page?: number | undefined;
    model?: string | undefined;
  }) => navigate({ to: "/stores", search: { q, filter, page, model, ...next } });

  const modelTitle =
    model === "supermarket"
      ? "Supermarkets"
      : model === "warehouse"
        ? "Warehouses"
        : model === "fmcg_distributor"
          ? "Distributors"
          : "Organization & stores";
  const modelDescription =
    model === "supermarket"
      ? "Supermarket locations — same store master, filtered by store type."
      : model === "warehouse"
        ? "Warehouse locations — same store master, filtered by store type."
        : model === "fmcg_distributor"
          ? "Distributor locations — same store master, filtered by store type."
          : "Manage every retail location, its shelf performance and who can access it.";

  const bulkArchive = useMutation({
    mutationFn: () => bulkArchiveStores(selected),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["stores"] });
      setSelected([]);
      toast.success(`${data.archived} stores archived`);
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Bulk archive is not available yet."),
  });

  const exportList = useMutation({
    mutationFn: () => exportStoreList(filter),
    onSuccess: (data) => {
      if (data.download_url) {
        window.open(data.download_url, "_blank", "noopener");
        toast.success("Store list export ready");
      } else {
        toast.success("Export queued — you'll get an email when it's ready.");
      }
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Export is not available yet."),
  });

  const importList = useMutation({
    mutationFn: (file: File) => importStoresCsv(file),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["stores"] });
      const parts = [`${data.created} created`];
      if (data.skippedDuplicates > 0) parts.push(`${data.skippedDuplicates} duplicates skipped`);
      if (data.failed > 0) parts.push(`${data.failed} failed`);
      toast.success(parts.join(" · "));
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Bulk import is not available yet."),
  });

  const busy = bulkArchive.isPending || exportList.isPending || importList.isPending;

  const skeletons = useMemo(() => Array.from({ length: 6 }, (_, i) => i), []);

  const headerActions = (
    <Button
      variant="brand"
      size="sm"
      className="rounded-xl"
      onClick={() => {
        setEditing(null);
        setFormOpen(true);
      }}
    >
      <Plus className="size-4" /> Add store
    </Button>
  );

  return (
    <AppShell title="" hidePageHeader>
      <div className="space-y-5">
        <PageHeader
          eyebrow="Organization"
          title={modelTitle}
          description={modelDescription}
          actions={headerActions}
        />
        {orgQuery.isError ? (
          <ErrorState
            title="Couldn't load organization"
            description={
              orgQuery.error instanceof Error ? orgQuery.error.message : "Organization data is unavailable."
            }
            onRetry={() => void orgQuery.refetch()}
          />
        ) : (
          <OrganizationOverview
            org={orgQuery.data}
            loading={orgQuery.isPending || (Boolean(model) && storesQuery.isPending)}
            scopedStoreCount={model ? total : null}
            scopedStoreLabel={
              model === "supermarket"
                ? "Supermarkets"
                : model === "warehouse"
                  ? "Warehouses"
                  : model === "fmcg_distributor"
                    ? "Distributors"
                    : undefined
            }
          />
        )}

        <div className="overflow-hidden rounded-xl border border-line bg-white p-5 shadow-card">
          <form
            className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              setSearch({ q: searchInput.trim() || undefined, page: 1 });
            }}
          >
            <div className="relative min-w-0">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by store name, city or manager"
                className="rounded-xl pl-9"
                aria-label="Search stores"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="subtle" className="flex-1 rounded-xl lg:flex-none">
                Search
              </Button>
              {(q || filter !== "all") && (
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-xl"
                  onClick={() => {
                    setSearchInput("");
                    void navigate({ to: "/stores", search: {} });
                  }}
                >
                  Reset
                </Button>
              )}
            </div>
          </form>

          <Tabs
            value={filter}
            onValueChange={(value) => setSearch({ filter: value as StoreFilter, page: 1 })}
            className="mt-4"
          >
            <TabsList className="w-full justify-start overflow-x-auto rounded-xl">
              {filters.map((f) => (
                <TabsTrigger key={f} value={f} className="rounded-lg whitespace-nowrap">
                  {storeFilterLabels[f]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {stores.length > 0 && (
            <label className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(v) =>
                  setSelected(v === true ? stores.map((s) => s.id) : [])
                }
                aria-label="Select all stores on this page"
              />
              Select all on this page
            </label>
          )}
        </div>

        {storesQuery.isPending ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {skeletons.map((i) => (
              <StoreCardSkeleton key={i} />
            ))}
          </div>
        ) : storesQuery.isError ? (
          <ErrorState
            title="Couldn't load stores"
            description={
              storesQuery.error instanceof Error
                ? storesQuery.error.message
                : "The store service did not respond."
            }
            onRetry={() => void storesQuery.refetch()}
          />
        ) : stores.length === 0 ? (
          <EmptyState
            icon={<StoreIcon className="size-5" />}
            title={
              q || filter !== "all"
                ? "No stores match these filters"
                : model === "warehouse"
                  ? "No warehouses yet"
                  : model === "supermarket"
                    ? "No supermarkets yet"
                    : model === "fmcg_distributor"
                      ? "No distributors yet"
                      : "No stores yet"
            }
            description={
              q || filter !== "all"
                ? "Try a different search term, or clear the filters to see every location."
                : model
                  ? "Add a location with this store type, or open Organization & stores to manage all locations."
                  : "Add your first store to start auditing shelves. Enterprises can bulk-upload a store list."
            }
            action={
              <Button
                variant="brand"
                size="sm"
                className="rounded-xl"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="size-4" /> Add store
              </Button>
            }
          />
        ) : (
          <>
            <h2 className="text-sm font-semibold text-foreground">Your stores ({total})</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">

              {stores.map((store) => (
                <StoreCard
                  key={store.id}
                  store={store}
                  selected={selected.includes(store.id)}
                  onToggleSelect={(id, next) =>
                    setSelected((prev) => (next ? [...prev, id] : prev.filter((x) => x !== id)))
                  }
                  onEdit={(s) => {
                    setEditing(s);
                    setFormOpen(true);
                  }}
                  onArchiveToggle={(s) => archive.mutate(s)}
                  onDelete={(s) => {
                    if (!canDelete) {
                      toast.error("Only owners and admins can delete a store.");
                      return;
                    }
                    setDeleting(s);
                  }}
                />
              ))}
            </div>

            {pageCount > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {pageCount} · {total} stores
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="subtle"
                    size="sm"
                    className="rounded-xl"
                    disabled={page <= 1}
                    onClick={() => setSearch({ page: page - 1 })}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="subtle"
                    size="sm"
                    className="rounded-xl"
                    disabled={page >= pageCount}
                    onClick={() => setSearch({ page: page + 1 })}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        <BulkOperationsPanel
          selectedCount={selected.length}
          busy={busy}
          onExport={() => exportList.mutate()}
          onImport={(file) => importList.mutate(file)}
          onBulkArchive={() => bulkArchive.mutate()}
          onAssignUsers={() =>
            toast.info("Open a store to assign users — bulk assignment ships with the roles engine.")
          }
        />



        <p className="text-xs text-muted-foreground">
          Looking for company-wide details like GSTIN and branding?{" "}
          <Link to="/settings" className="text-brand hover:underline">
            Open company settings
          </Link>
          .
        </p>
      </div>

      <StoreFormDialog
        open={formOpen}
        store={editing}
        onOpenChange={setFormOpen}
        defaultStoreType={model ?? null}
      />
      <DeleteStoreDialog
        store={deleting}
        pending={remove.isPending}
        onOpenChange={(open) => !open && setDeleting(null)}
        onConfirm={(store) =>
          remove.mutate(store, {
            onSuccess: () => setDeleting(null),
          })
        }
      />
    </AppShell>
  );
}
