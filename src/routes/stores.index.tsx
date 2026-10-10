import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Plus, Search, Store as StoreIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/design-system/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/States";
import {
  BulkOperationsPanel,
  DeleteStoreDialog,
  OrganizationOverview,
  StoreFormDialog,
  useStoreActions,
} from "@/components/org/OrgParts";
import {
  bulkArchiveStores,
  exportStoreList,
  fetchOrganization,
  fetchStoreList,
  formatDateTime,
  grantStoresAccess,
  importStoresCsv,
  storeFilterLabels,
  storeLocation,
  type OrgStore,
  type StoreFilter,
} from "@/lib/organization";
import { STORE_TYPES, normalizeStoreType, storeTypeLabel } from "@/lib/store-types";
import { cn } from "@/lib/utils";
import { fetchAssignableMembers } from "@/lib/assignments";
import { getMembership } from "@/lib/db/context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PAGE_SIZE = 25;
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
      { title: "Stores — Aislix" },
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
  const [assignOpen, setAssignOpen] = useState(false);

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

  const modelLabel = model ? storeTypeLabel(model) : null;

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
      const detail = data.issues
        .slice(0, 3)
        .map((i) => `Row ${i.line}: ${i.reason}`)
        .join(" · ");
      if (data.created === 0 && data.failed > 0) toast.error(parts.join(" · "), { description: detail });
      else toast.success(parts.join(" · "), detail ? { description: detail } : undefined);
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Bulk import is not available yet."),
  });

  const busy = bulkArchive.isPending || exportList.isPending || importList.isPending;

  const headerActions = canDelete && (
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
          title="Stores"
          description="Add, edit or delete your supermarkets, FMCG brands, local stores, dark stores, distributors, warehouses and outlets, and see how many audits each one has."
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
            canManage={canDelete}
            loading={orgQuery.isPending || (Boolean(model) && storesQuery.isPending)}
            scopedStoreCount={model ? total : null}
            scopedStoreLabel={modelLabel ?? undefined}
          />
        )}

        <div className="overflow-hidden rounded-xl border border-line bg-white p-5">
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
            <div className="flex flex-wrap gap-2">
              <Select
                value={normalizeStoreType(model) ?? model ?? "all"}
                onValueChange={(value) => setSearch({ model: value === "all" ? undefined : value, page: 1 })}
              >
                <SelectTrigger className="w-full rounded-xl sm:w-44" aria-label="Type">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {STORE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" variant="subtle" className="flex-1 rounded-xl lg:flex-none">
                Search
              </Button>
              {(q || filter !== "all" || model) && (
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

          {canDelete && stores.length > 0 && (
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
          <div className="rounded-xl border border-line bg-white p-4">
            <TableSkeleton rows={6} cols={5} />
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
                : modelLabel
                  ? `No ${modelLabel.toLowerCase()} locations yet`
                  : "No stores yet"
            }
            description={
              q || filter !== "all"
                ? "Try a different search term, or clear the filters to see every location."
                : model
                  ? "Add a location with this type, or choose All types to see every location."
                  : canDelete
                    ? "Add your first store to start auditing shelves. Enterprises can bulk-upload a store list."
                    : "No stores are assigned to you yet. Ask a workspace owner or admin for access."
            }
            action={
              canDelete && (
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
              )
            }
          />
        ) : (
          <>
            <h2 className="text-sm font-semibold text-foreground">Your stores ({total})</h2>
            <StoresTable
              stores={stores}
              canManage={canDelete}
              selected={selected}
              onToggleSelect={(id, next) =>
                setSelected((prev) => (next ? [...prev, id] : prev.filter((x) => x !== id)))
              }
              onOpen={(s) => void navigate({ to: "/stores/$storeId", params: { storeId: s.id } })}
              onEdit={(s) => {
                setEditing(s);
                setFormOpen(true);
              }}
              onArchiveToggle={(s) => archive.mutate(s)}
              onDelete={(s) => setDeleting(s)}
            />

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

        {canDelete && (
          <BulkOperationsPanel
            selectedCount={selected.length}
            busy={busy}
            onExport={() => exportList.mutate()}
            onImport={(file) => importList.mutate(file)}
            onBulkArchive={() => bulkArchive.mutate()}
            onAssignUsers={() => setAssignOpen(true)}
          />
        )}



        {canDelete && (
          <p className="text-xs text-muted-foreground">
            Looking for company-wide details like GSTIN and branding?{" "}
            <Link to="/settings" className="text-brand hover:underline">
              Open company settings
            </Link>
            .
          </p>
        )}
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
      <AssignStoresDialog
        open={assignOpen}
        storeIds={selected}
        onOpenChange={setAssignOpen}
        onDone={() => setSelected([])}
      />
    </AppShell>
  );
}

type StoreRowActions = {
  canManage: boolean;
  onOpen: (store: OrgStore) => void;
  onEdit: (store: OrgStore) => void;
  onArchiveToggle: (store: OrgStore) => void;
  onDelete: (store: OrgStore) => void;
};

function auditCount(value: number | undefined): string {
  return typeof value === "number" ? value.toLocaleString() : "—";
}

function StoreActionsMenu({ store, onEdit, onArchiveToggle, onDelete }: { store: OrgStore } & Omit<StoreRowActions, "canManage" | "onOpen">) {
  const archived = store.status === "archived";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 rounded-lg" onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal className="size-4" />
          <span className="sr-only">Actions for {store.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 rounded-xl" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={() => onEdit(store)}>
          <Pencil className="mr-2 size-4" /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onArchiveToggle(store)}>
          {archived ? <ArchiveRestore className="mr-2 size-4" /> : <Archive className="mr-2 size-4" />}
          {archived ? "Restore" : "Archive"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(store)}>
          <Trash2 className="mr-2 size-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StatusLabel({ archived }: { archived: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[#667085]">
      <span aria-hidden className="size-1.5 rounded-full" style={{ background: archived ? "#D9E2E8" : "#79E2A8" }} />
      {archived ? "Archived" : "Active"}
    </span>
  );
}

function StoresTable({
  stores,
  selected,
  onToggleSelect,
  ...actions
}: {
  stores: OrgStore[];
  selected: string[];
  onToggleSelect: (id: string, next: boolean) => void;
} & StoreRowActions) {
  const { canManage, onOpen } = actions;
  return (
    <div className="overflow-hidden rounded-xl border border-[#D9E2E8] bg-white">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-[#F4F7F9] text-xs text-[#667085]">
            <tr>
              {canManage ? <th className="w-10 px-3 py-2.5" aria-label="Select" /> : null}
              <th className="px-3 py-2.5 font-medium">Name</th>
              <th className="px-3 py-2.5 font-medium">Type</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 text-right font-medium">AI audits</th>
              <th className="px-3 py-2.5 text-right font-medium">Digital audits</th>
              <th className="px-3 py-2.5 font-medium">Last audit</th>
              {canManage ? <th className="w-12 px-3 py-2.5" aria-label="Actions" /> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEF1F4] text-[#04203F]">
            {stores.map((store) => {
              const archived = store.status === "archived";
              const location = storeLocation(store);
              return (
                <tr
                  key={store.id}
                  className={cn(
                    "cursor-pointer transition-colors duration-150 hover:bg-[#F4F7F9]",
                    selected.includes(store.id) && "bg-[#F4F7F9]",
                  )}
                  onClick={() => onOpen(store)}
                >
                  {canManage ? (
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.includes(store.id)}
                        onCheckedChange={(v) => onToggleSelect(store.id, v === true)}
                        aria-label={`Select ${store.name}`}
                      />
                    </td>
                  ) : null}
                  <td className="max-w-[280px] px-3 py-2.5">
                    <Link
                      to="/stores/$storeId"
                      params={{ storeId: store.id }}
                      className="block truncate font-medium hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {store.name}
                    </Link>
                    <span className="block truncate text-xs text-[#667085]">
                      {[store.store_code, location].filter(Boolean).join(" · ") || "Location not set"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-[#667085]">{storeTypeLabel(store.store_type)}</td>
                  <td className="px-3 py-2.5">
                    <StatusLabel archived={archived} />
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{auditCount(store.metrics?.ai_audits)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                    {auditCount(store.metrics?.digital_audits)}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-[#667085]">
                    {store.metrics?.last_scan_at ? formatDateTime(store.metrics.last_scan_at) : "No audits yet"}
                  </td>
                  {canManage ? (
                    <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <StoreActionsMenu store={store} {...actions} />
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-[#EEF1F4] md:hidden">
        {stores.map((store) => (
          <li
            key={store.id}
            className="flex cursor-pointer items-start gap-3 px-3 py-3 transition-colors duration-150 hover:bg-[#F4F7F9]"
            onClick={() => onOpen(store)}
          >
            {canManage ? (
              <span onClick={(e) => e.stopPropagation()} className="pt-0.5">
                <Checkbox
                  checked={selected.includes(store.id)}
                  onCheckedChange={(v) => onToggleSelect(store.id, v === true)}
                  aria-label={`Select ${store.name}`}
                />
              </span>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[#04203F]">{store.name}</p>
              <p className="truncate text-xs text-[#667085]">
                {storeTypeLabel(store.store_type)}
                {storeLocation(store) ? ` · ${storeLocation(store)}` : ""}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#667085]">
                <span>
                  AI audits <span className="font-semibold tabular-nums text-[#04203F]">{auditCount(store.metrics?.ai_audits)}</span>
                </span>
                <span>
                  Digital audits{" "}
                  <span className="font-semibold tabular-nums text-[#04203F]">{auditCount(store.metrics?.digital_audits)}</span>
                </span>
                <StatusLabel archived={store.status === "archived"} />
              </div>
            </div>
            {canManage ? (
              <span onClick={(e) => e.stopPropagation()}>
                <StoreActionsMenu store={store} {...actions} />
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

const ALL_STORE_ROLES = new Set(["owner", "admin"]);

function AssignStoresDialog({
  open,
  storeIds,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  storeIds: string[];
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [picked, setPicked] = useState<string[]>([]);
  const membersQuery = useQuery({
    queryKey: ["assignable-members"],
    queryFn: fetchAssignableMembers,
    enabled: open,
    retry: false,
  });
  const members = membersQuery.data ?? [];

  const assign = useMutation({
    mutationFn: () => grantStoresAccess(storeIds, picked),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["stores"] });
      void queryClient.invalidateQueries({ queryKey: ["store-team"] });
      toast.success(
        `${picked.length} ${picked.length === 1 ? "person" : "people"} can now access ${storeIds.length} ${storeIds.length === 1 ? "store" : "stores"}`,
      );
      setPicked([]);
      onOpenChange(false);
      onDone();
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Could not update store access."),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setPicked([]);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign users to stores</DialogTitle>
          <DialogDescription>
            Give the people you pick access to the {storeIds.length} selected{" "}
            {storeIds.length === 1 ? "store" : "stores"}. Their existing store access is kept.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {membersQuery.isPending ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading your team…</p>
          ) : members.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No other team members yet. Invite people from the Team page first.
            </p>
          ) : (
            members.map((m) => {
              const allStores = ALL_STORE_ROLES.has(m.role.toLowerCase());
              const checked = allStores || picked.includes(m.user_id);
              return (
                <label
                  key={m.user_id}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted/40"
                >
                  <Checkbox
                    checked={checked}
                    disabled={allStores || assign.isPending}
                    onCheckedChange={(v) =>
                      setPicked((prev) =>
                        v === true ? [...prev, m.user_id] : prev.filter((id) => id !== m.user_id),
                      )
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{m.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {allStores ? "Owner / admin — already sees every store" : m.email}
                    </span>
                  </span>
                </label>
              );
            })
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={assign.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => assign.mutate()}
            disabled={picked.length === 0 || storeIds.length === 0 || assign.isPending}
          >
            {assign.isPending ? "Assigning…" : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
