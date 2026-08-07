import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2, MapPin, Pencil, Plus, Search, Store as StoreIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { EmptyState, ErrorState, TableSkeleton } from "@/components/States";
import { Field, SettingsCard } from "@/components/settings/SettingsParts";
import {
  createStore,
  deleteStore,
  fetchStores,
  updateStore,
  type Store,
  type StoreInput,
} from "@/lib/account";

const emptyStore: StoreInput = {
  name: "",
  code: "",
  address: "",
  city: "",
  state: "",
  country: "",
  manager_name: "",
};

export function StoreManager() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Store | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Store | null>(null);

  const storesQuery = useQuery({
    queryKey: ["stores"],
    queryFn: ({ signal }) => fetchStores(undefined, signal),
    retry: false,
  });

  const items = storesQuery.data?.items ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((store) =>
      [store.name, store.code, store.city, store.state, store.country, store.manager_name]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(q)),
    );
  }, [items, search]);

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["stores"] });

  const create = useMutation({
    mutationFn: (input: StoreInput) => createStore(input),
    onSuccess: () => {
      setCreating(false);
      invalidate();
      toast.success("Store added");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: StoreInput }) => updateStore(id, input),
    onSuccess: () => {
      setEditing(null);
      invalidate();
      toast.success("Store updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteStore(id),
    onSuccess: () => {
      setPendingDelete(null);
      invalidate();
      toast.success("Store deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <SettingsCard
      title="Stores"
      description="Every outlet you audit with Aislix. Scans are grouped by store."
      icon={StoreIcon}
      action={
        <Button variant="brand" size="sm" className="rounded-xl" onClick={() => setCreating(true)}>
          <Plus className="size-4" /> Add store
        </Button>
      }
    >
      <div className="relative mb-5 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search stores, codes, cities or managers"
          className="pl-9"
          aria-label="Search stores"
        />
      </div>

      {storesQuery.isLoading ? (
        <TableSkeleton rows={4} cols={4} />
      ) : storesQuery.isError ? (
        <ErrorState
          title="Couldn't load stores"
          description={(storesQuery.error as Error).message}
          onRetry={() => void storesQuery.refetch()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<StoreIcon className="size-5" />}
          title={items.length === 0 ? "No stores yet" : "No stores match your search"}
          description={
            items.length === 0
              ? "Add your first outlet to start grouping shelf audits by location."
              : "Try a different store name, code or city."
          }
          action={
            items.length === 0 ? (
              <Button variant="brand" size="sm" className="rounded-xl" onClick={() => setCreating(true)}>
                <Plus className="size-4" /> Add store
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {filtered.map((store) => (
            <li
              key={store.id}
              className="rounded-2xl border border-border bg-surface p-4 transition-all hover:border-brand/30 hover:shadow-card"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold tracking-tight">{store.name}</p>
                  <p className="mt-0.5 font-mono text-xs text-brand">{store.code}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-lg"
                    aria-label={`Edit ${store.name}`}
                    onClick={() => setEditing(store)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Delete ${store.name}`}
                    onClick={() => setPendingDelete(store)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-brand" />
                <span>
                  {[store.address, store.city, store.state, store.country].filter(Boolean).join(", ") || "—"}
                </span>
              </p>
              <p className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                <Building2 className="size-3.5 shrink-0 text-brand" />
                {store.manager_name || "No manager assigned"}
              </p>
            </li>
          ))}
        </ul>
      )}

      <StoreDialog
        open={creating}
        title="Add store"
        description="Stores group your scans, reports and low-stock alerts."
        submitting={create.isPending}
        onOpenChange={(open) => !open && setCreating(false)}
        onSubmit={(input) => create.mutate(input)}
      />
      <StoreDialog
        open={Boolean(editing)}
        title="Edit store"
        description="Update outlet details and the assigned manager."
        initial={editing ?? undefined}
        submitting={update.isPending}
        onOpenChange={(open) => !open && setEditing(null)}
        onSubmit={(input) => editing && update.mutate({ id: editing.id, input })}
      />

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The store and its association with past scans will be removed. Scan history stays available but
              becomes unassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && remove.mutate(pendingDelete.id)}
              disabled={remove.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {remove.isPending && <Loader2 className="size-4 animate-spin" />} Delete store
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsCard>
  );
}

function StoreDialog({
  open,
  title,
  description,
  initial,
  submitting,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  title: string;
  description: string;
  initial?: Store | undefined;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: StoreInput) => void;
}) {
  const [form, setForm] = useState<StoreInput>(emptyStore);
  const [seeded, setSeeded] = useState<string | null>(null);
  const key = open ? (initial?.id ?? "new") : null;

  if (key && seeded !== key) {
    setSeeded(key);
    setForm(initial ? { ...emptyStore, ...initial } : emptyStore);
  }
  if (!key && seeded !== null) setSeeded(null);

  const set = <K extends keyof StoreInput>(field: K, value: StoreInput[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(form);
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Store name" htmlFor="store-name">
              <Input
                id="store-name"
                required
                maxLength={120}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </Field>
            <Field label="Store code" htmlFor="store-code">
              <Input
                id="store-code"
                required
                maxLength={32}
                value={form.code}
                onChange={(e) => set("code", e.target.value.toUpperCase())}
              />
            </Field>
          </div>
          <Field label="Address" htmlFor="store-address">
            <Textarea
              id="store-address"
              rows={2}
              maxLength={300}
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="City" htmlFor="store-city">
              <Input
                id="store-city"
                maxLength={80}
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
              />
            </Field>
            <Field label="State" htmlFor="store-state">
              <Input
                id="store-state"
                maxLength={80}
                value={form.state}
                onChange={(e) => set("state", e.target.value)}
              />
            </Field>
            <Field label="Country" htmlFor="store-country">
              <Input
                id="store-country"
                maxLength={80}
                value={form.country}
                onChange={(e) => set("country", e.target.value)}
              />
            </Field>
          </div>
          <Field label="Store manager" htmlFor="store-manager">
            <Input
              id="store-manager"
              maxLength={100}
              value={form.manager_name}
              onChange={(e) => set("manager_name", e.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="subtle" className="rounded-xl" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="brand" className="rounded-xl" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />} Save store
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
