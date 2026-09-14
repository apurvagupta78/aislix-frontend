import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  Archive,
  ArchiveRestore,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  MapPin,
  MoreHorizontal,
  Pencil,
  Phone,
  Trash2,
  TriangleAlert,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Skeleton } from "@/components/States";
import { cn } from "@/lib/utils";
import { countryOptions, timezoneOptions } from "@/lib/account";
import {
  accountStatusLabels,
  archiveOrgStore,
  createOrgStore,
  deleteOrgStore,
  fetchStoreTeam,
  formatConfidence,
  formatDateTime,
  formatNumber,
  formatScore,
  grantStoreAccess,
  healthTone,
  restoreOrgStore,
  scansRemaining,
  storeLocation,
  updateOrgStore,
  usagePercent,
  type Organization,
  type OrgStore,
  type StoreInput,
} from "@/lib/organization";
import { fetchAssignableMembers } from "@/lib/assignments";


/* -------------------------------------------------------------------------- */
/* Organization dashboard                                                     */
/* -------------------------------------------------------------------------- */

export function OrgStat({
  label,
  value,
  hint,
  loading,
  accent,
}: {
  label: string;
  value?: string | number | undefined;
  hint?: string | undefined;
  loading?: boolean | undefined;
  accent?: boolean | undefined;
}) {
  return (
    <div className="card-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-24" />
      ) : (
        <p
          className={cn(
            "mt-2 text-2xl font-semibold tracking-tight",
            accent ? "text-brand" : "text-foreground",
          )}
        >
          {value ?? "—"}
        </p>
      )}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function OrganizationOverview({
  org,
  loading,
}: {
  org?: Organization | undefined;
  loading?: boolean | undefined;
}) {
  const remaining = scansRemaining(org);
  const percent = usagePercent(org);
  const status = org?.account_status;

  return (
    <div className="space-y-4">
      <div className="card-surface p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-surface">
              {org?.logo_url ? (
                <img
                  src={org.logo_url}
                  alt={`${org.name} logo`}
                  className="size-full object-contain"
                  loading="lazy"
                />
              ) : (
                <Building2 className="size-6 text-muted-foreground" />
              )}
            </span>
            <div className="min-w-0">
              {loading ? (
                <>
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="mt-2 h-4 w-32" />
                </>
              ) : (
                <>
                  <h2 className="truncate text-lg font-semibold tracking-tight text-foreground">
                    {org?.name ?? "Organization"}
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="rounded-md">
                      {org?.plan_name ?? "Plan pending"}
                    </Badge>
                    {status && (
                      <Badge
                        variant={status === "active" || status === "trialing" ? "outline" : "destructive"}
                        className="rounded-md"
                      >
                        {accountStatusLabels[status]}
                      </Badge>
                    )}
                    {org?.gst_number && <span>GSTIN {org.gst_number}</span>}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Button asChild variant="subtle" size="sm" className="rounded-xl">
              <Link to="/settings">Company settings</Link>
            </Button>
            <Button asChild variant="brand" size="sm" className="rounded-xl">
              <Link to="/billing">Manage plan</Link>
            </Button>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="font-medium text-foreground">Monthly audit usage</p>
            <p className="text-muted-foreground">
              {loading
                ? "…"
                : org?.scans_included === null
                  ? `${formatNumber(org?.scans_used)} audits · unlimited plan`
                  : `${formatNumber(org?.scans_used)} of ${formatNumber(org?.scans_included)} audits`}
            </p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-gradient-brand transition-all"
              style={{ width: `${percent ?? 0}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {remaining === null
              ? "Fair usage policy applies on your plan."
              : remaining === undefined
                ? "Usage syncs once billing data is available."
                : `${formatNumber(remaining)} audits remaining this cycle.`}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <OrgStat label="Total stores" value={formatNumber(org?.total_stores)} loading={loading} hint={
          org ? `${formatNumber(org.active_stores)} active · ${formatNumber(org.archived_stores)} archived` : undefined
        } />
        <OrgStat label="Active users" value={formatNumber(org?.active_users)} loading={loading} />
        <OrgStat
          label="Audits used"
          value={formatNumber(org?.scans_used)}
          loading={loading}
          hint="Current billing cycle"
        />
        <OrgStat
          label="Remaining audits"
          value={remaining === null ? "Unlimited" : formatNumber(remaining ?? undefined)}
          loading={loading}
          accent
          hint={org?.billing_period_end ? `Renews ${formatDateTime(org.billing_period_end)}` : undefined}
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Store card                                                                 */
/* -------------------------------------------------------------------------- */

const toneClasses: Record<string, string> = {
  good: "bg-brand-soft text-brand",
  warn: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  bad: "bg-destructive/10 text-destructive",
  unknown: "bg-muted text-muted-foreground",
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-surface px-3 py-2">
      <p className="truncate text-[0.68rem] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function StoreCard({
  store,
  selected,
  onToggleSelect,
  onEdit,
  onArchiveToggle,
  onDelete,
}: {
  store: OrgStore;
  selected: boolean;
  onToggleSelect: (id: string, next: boolean) => void;
  onEdit: (store: OrgStore) => void;
  onArchiveToggle: (store: OrgStore) => void;
  onDelete: (store: OrgStore) => void;
}) {
  const metrics = store.metrics;
  const tone = healthTone(metrics?.shelf_health_score);
  const archived = store.status === "archived";
  const location = storeLocation(store);

  return (
    <article
      className={cn(
        "card-surface card-hover flex flex-col p-5",
        archived && "opacity-80",
        selected && "ring-2 ring-brand/40",
      )}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
        <Checkbox
          checked={selected}
          onCheckedChange={(v) => onToggleSelect(store.id, v === true)}
          aria-label={`Select ${store.name}`}
          className="mt-1 shrink-0"
        />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate font-semibold tracking-tight text-foreground">{store.name}</h3>
            {archived && (
              <Badge variant="secondary" className="shrink-0 rounded-md">
                Archived
              </Badge>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {store.store_code ? `${store.store_code} · ` : ""}
            {location || "Location not set"}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 shrink-0 rounded-lg">
              <MoreHorizontal className="size-4" />
              <span className="sr-only">Store actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 rounded-xl">
            <DropdownMenuItem onClick={() => onEdit(store)}>
              <Pencil className="mr-2 size-4" /> Edit store
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onArchiveToggle(store)}>
              {archived ? (
                <>
                  <ArchiveRestore className="mr-2 size-4" /> Restore
                </>
              ) : (
                <>
                  <Archive className="mr-2 size-4" /> Archive
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onDelete(store)}
            >
              <Trash2 className="mr-2 size-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span
          className={cn(
            "grid size-14 shrink-0 place-items-center rounded-2xl text-lg font-semibold",
            toneClasses[tone],
          )}
        >
          {formatScore(metrics?.shelf_health_score)}
        </span>
        <div className="min-w-0 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Shelf health score</p>
          <p className="mt-0.5 flex items-center gap-1 truncate">
            <Clock className="size-3.5 shrink-0" />
            Last audit {formatDateTime(metrics?.last_scan_at)}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Metric label="Total audits" value={formatNumber(metrics?.total_scans)} />
        <Metric label="Avg confidence" value={formatConfidence(metrics?.average_confidence)} />
        <Metric label="Low stock" value={formatNumber(metrics?.low_stock_alerts)} />
        <Metric label="Out of stock" value={formatNumber(metrics?.out_of_stock_alerts)} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {store.manager_name && (
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" /> {store.manager_name}
          </span>
        )}
        {store.contact_number && (
          <span className="inline-flex items-center gap-1">
            <Phone className="size-3.5" /> {store.contact_number}
          </span>
        )}
        {store.timezone && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" /> {store.timezone}
          </span>
        )}
      </div>

      <StoreTeamStrip storeId={store.id} />

      <Button asChild variant="subtle" size="sm" className="mt-4 w-full rounded-xl">
        <Link to="/stores/$storeId" params={{ storeId: store.id }}>
          Quick view
        </Link>
      </Button>
    </article>
  );
}

const teamRoleClasses: Record<string, string> = {
  owner: "bg-brand-soft text-brand",
  admin: "bg-brand-soft text-brand",
  manager: "bg-accent-green/12 text-accent-green",
  store_manager: "bg-accent-green/12 text-accent-green",
  member: "bg-muted text-muted-foreground",
  viewer: "bg-muted text-muted-foreground",
};

/** Team with access to this store — explicit scope or org-wide access. */
function StoreTeamStrip({ storeId }: { storeId: string }) {
  const query = useQuery({
    queryKey: ["store-team", storeId],
    queryFn: () => fetchStoreTeam(storeId),
    retry: false,
    staleTime: 60_000,
  });

  if (query.isPending) {
    return (
      <div className="mt-4 border-t border-border pt-3">
        <Skeleton className="h-4 w-40" />
      </div>
    );
  }
  const items = query.data?.items ?? [];

  return (
    <div className="mt-4 border-t border-border pt-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Team with access
      </p>
      {items.length === 0 ? (
        <p className="mt-1.5 text-xs text-muted-foreground">
          No one is scoped to this store yet.
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {items.slice(0, 4).map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 truncate">
                <span className="font-medium text-foreground">{member.name ?? member.email}</span>
                {member.status === "invited" && (
                  <span className="ml-1.5 text-muted-foreground">(invited)</span>
                )}
              </span>
              <Badge
                variant="secondary"
                className={cn(
                  "shrink-0 rounded-full border-0 text-[11px] font-medium",
                  teamRoleClasses[member.role] ?? "bg-muted text-muted-foreground",
                )}
              >
                {member.all_stores ? "All stores" : member.role.replace("_", " ")}
              </Badge>
            </li>
          ))}
          {items.length > 4 && (
            <li className="text-xs text-muted-foreground">+{items.length - 4} more</li>
          )}
        </ul>
      )}
    </div>
  );
}


export function StoreCardSkeleton() {
  return (
    <div className="card-surface space-y-4 p-5">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-14 w-full" />
      <div className="grid grid-cols-2 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Add / edit store dialog                                                    */
/* -------------------------------------------------------------------------- */

const blankStore: StoreInput = {
  name: "",
  store_code: "",
  address: "",
  city: "",
  state: "",
  country: "India",
  manager_name: "",
  contact_number: "",
  timezone: "Asia/Kolkata",
  latitude: null,
  longitude: null,
  geofence_radius_m: 200,
};

export function StoreFormDialog({
  open,
  store,
  onOpenChange,
}: {
  open: boolean;
  store?: OrgStore | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<StoreInput>(blankStore);
  const [teamIds, setTeamIds] = useState<string[]>([]);

  const membersQuery = useQuery({
    queryKey: ["assignable-members"],
    queryFn: () => fetchAssignableMembers(),
    retry: false,
    enabled: open && !store,
    staleTime: 60_000,
  });

  const territoriesQuery = useQuery({
    queryKey: ["territories"],
    queryFn: async () => {
      const { fetchTerritories } = await import("@/lib/territories");
      return fetchTerritories();
    },
    retry: false,
    enabled: open,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!open) return;
    setTeamIds([]);
    setForm(
      store
        ? {
            name: store.name ?? "",
            store_code: store.store_code ?? "",
            address: store.address ?? "",
            city: store.city ?? "",
            state: store.state ?? "",
            country: store.country ?? "India",
            manager_name: store.manager_name ?? "",
            contact_number: store.contact_number ?? "",
            timezone: store.timezone ?? "Asia/Kolkata",
            territory_id: store.territory_id ?? null,
            latitude: store.latitude ?? null,
            longitude: store.longitude ?? null,
            geofence_radius_m: store.geofence_radius_m ?? 200,
          }
        : blankStore,
    );
  }, [open, store]);

  const mutation = useMutation({
    mutationFn: async (input: StoreInput) => {
      if (store) return updateOrgStore(store.id, input);
      const created = await createOrgStore(input);
      if (teamIds.length) await grantStoreAccess(created.id, teamIds);
      return created;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["stores"] });
      void queryClient.invalidateQueries({ queryKey: ["organization"] });
      void queryClient.invalidateQueries({ queryKey: ["store-team"] });
      toast.success(store ? "Store updated" : "Store added");
      onOpenChange(false);
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Could not save the store."),
  });

  const set = (key: keyof StoreInput, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          latitude: Math.round(pos.coords.latitude * 1e6) / 1e6,
          longitude: Math.round(pos.coords.longitude * 1e6) / 1e6,
        }));
        toast.success("Store pin set from your current location.");
      },
      () => toast.error("Could not read GPS. Enter coordinates manually."),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  const mapPreviewUrl =
    form.latitude != null && form.longitude != null
      ? `https://www.openstreetmap.org/export/embed.html?bbox=${form.longitude - 0.01}%2C${form.latitude - 0.01}%2C${form.longitude + 0.01}%2C${form.latitude + 0.01}&layer=mapnik&marker=${form.latitude}%2C${form.longitude}`
      : null;

  const members = membersQuery.data ?? [];
  const toggleMember = (userId: string) =>
    setTeamIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{store ? "Edit store" : "Add store"}</DialogTitle>
          <DialogDescription>
            Store details are used across audits, reports and multi-location dashboards.
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!form.name.trim()) {
              toast.error("Store name is required.");
              return;
            }
            mutation.mutate(form);
          }}
        >
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="store-name">Store name</Label>
            <Input
              id="store-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="MoreMart Indiranagar"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="store-code">Store ID</Label>
            <Input
              id="store-code"
              value={form.store_code ?? ""}
              onChange={(e) => set("store_code", e.target.value)}
              placeholder="BLR-004"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="store-manager">Store manager</Label>
            <Input
              id="store-manager"
              value={form.manager_name ?? ""}
              onChange={(e) => set("manager_name", e.target.value)}
              placeholder="Full name"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Territory / region</Label>
            <Select
              value={form.territory_id ?? "none"}
              onValueChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  territory_id: value === "none" ? null : value,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="No territory" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No territory</SelectItem>
                {(territoriesQuery.data ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="store-address">Address</Label>
            <Textarea
              id="store-address"
              rows={2}
              value={form.address ?? ""}
              onChange={(e) => set("address", e.target.value)}
              placeholder="Street, area, landmark, PIN"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="store-city">City</Label>
            <Input
              id="store-city"
              value={form.city ?? ""}
              onChange={(e) => set("city", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="store-state">State</Label>
            <Input
              id="store-state"
              value={form.state ?? ""}
              onChange={(e) => set("state", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Country</Label>
            <Select value={form.country ?? ""} onValueChange={(v) => set("country", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {countryOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Time zone</Label>
            <Select value={form.timezone ?? ""} onValueChange={(v) => set("timezone", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select time zone" />
              </SelectTrigger>
              <SelectContent>
                {timezoneOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="store-contact">Contact number</Label>
            <Input
              id="store-contact"
              type="tel"
              value={form.contact_number ?? ""}
              onChange={(e) => set("contact_number", e.target.value)}
              placeholder="+91 98765 43210"
            />
          </div>

          <div className="space-y-3 rounded-2xl border border-border bg-surface p-4 sm:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Store pin &amp; geofence</p>
                <p className="text-xs text-muted-foreground">
                  Used to verify auditors are at the store during Digital Audits.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={useCurrentLocation}>
                <MapPin className="size-4" /> Use my location
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="store-lat">Latitude</Label>
                <Input
                  id="store-lat"
                  type="number"
                  step="any"
                  value={form.latitude ?? ""}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      latitude: e.target.value === "" ? null : Number(e.target.value),
                    }))
                  }
                  placeholder="28.6139"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="store-lng">Longitude</Label>
                <Input
                  id="store-lng"
                  type="number"
                  step="any"
                  value={form.longitude ?? ""}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      longitude: e.target.value === "" ? null : Number(e.target.value),
                    }))
                  }
                  placeholder="77.2090"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="store-geofence">Geofence radius (m)</Label>
                <Input
                  id="store-geofence"
                  type="number"
                  min={50}
                  max={5000}
                  value={form.geofence_radius_m ?? 200}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      geofence_radius_m: Number(e.target.value) || 200,
                    }))
                  }
                />
              </div>
            </div>
            {mapPreviewUrl ? (
              <iframe
                title="Store location preview"
                src={mapPreviewUrl}
                className="h-40 w-full rounded-xl border border-border"
                loading="lazy"
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                Set latitude and longitude to preview the store pin on the map.
              </p>
            )}
          </div>

          {!store && (
            <div className="space-y-2 rounded-2xl border border-border bg-surface p-4 sm:col-span-2">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-brand" />
                <p className="text-sm font-medium">Team access</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Members you select can audit and report on this store. Owners, admins and managers
                already have access to every store.
              </p>
              {membersQuery.isPending ? (
                <Skeleton className="h-5 w-48" />
              ) : members.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No team members yet —{" "}
                  <Link to="/team" className="text-brand hover:underline">
                    invite your team
                  </Link>
                  .
                </p>
              ) : (
                <ul className="mt-1 grid gap-2 sm:grid-cols-2">
                  {members.map((member) => (
                    <li key={member.user_id} className="flex items-center gap-2">
                      <Checkbox
                        id={`store-team-${member.user_id}`}
                        checked={teamIds.includes(member.user_id)}
                        onCheckedChange={() => toggleMember(member.user_id)}
                      />
                      <Label
                        htmlFor={`store-team-${member.user_id}`}
                        className="min-w-0 truncate text-sm font-normal"
                      >
                        {member.name}
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          {member.role.replace("_", " ")}
                        </span>
                      </Label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}


          <DialogFooter className="sm:col-span-2">
            <Button
              type="button"
              variant="subtle"
              className="rounded-xl"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="brand" className="rounded-xl" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : store ? "Save changes" : "Add store"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Destructive + archive actions                                              */
/* -------------------------------------------------------------------------- */

export function useStoreActions() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["stores"] });
    void queryClient.invalidateQueries({ queryKey: ["organization"] });
  };

  const archive = useMutation({
    mutationFn: (store: OrgStore) =>
      store.status === "archived" ? restoreOrgStore(store.id) : archiveOrgStore(store.id),
    onSuccess: (_data, store) => {
      invalidate();
      toast.success(store.status === "archived" ? "Store restored" : "Store archived");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Could not update the store."),
  });

  const remove = useMutation({
    mutationFn: (store: OrgStore) => deleteOrgStore(store.id),
    onSuccess: () => {
      invalidate();
      toast.success("Store deleted");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Could not delete the store."),
  });

  return { archive, remove };
}

export function DeleteStoreDialog({
  store,
  onOpenChange,
  onConfirm,
  pending,
}: {
  store?: OrgStore | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (store: OrgStore) => void;
  pending?: boolean | undefined;
}) {
  return (
    <AlertDialog open={!!store} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {store?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Audits and reports linked to this store are removed from the organization dashboard. This
            cannot be undone — archive the store instead if you only want to hide it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={pending}
            onClick={() => store && onConfirm(store)}
          >
            Delete store
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Bulk operations                                                            */
/* -------------------------------------------------------------------------- */

export function BulkOperationsPanel({
  selectedCount,
  onExport,
  onImport,
  onBulkArchive,
  onAssignUsers,
  busy,
}: {
  selectedCount: number;
  onExport: () => void;
  onImport: (file: File) => void;
  onBulkArchive: () => void;
  onAssignUsers: () => void;
  busy?: boolean | undefined;
}) {
  return (
    <div className="card-surface p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="font-semibold tracking-tight text-foreground">Bulk operations</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {selectedCount > 0
              ? `${selectedCount} store${selectedCount > 1 ? "s" : ""} selected.`
              : "Select stores to archive them together or assign users in one step."}
          </p>
        </div>
        {selectedCount > 0 && (
          <Badge variant="secondary" className="shrink-0 rounded-md">
            {selectedCount} selected
          </Badge>
        )}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <label className="contents">
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImport(file);
              e.target.value = "";
            }}
          />
          <Button variant="subtle" size="sm" className="w-full rounded-xl" asChild>
            <span role="button" tabIndex={0}>
              <Upload className="size-4" /> Upload stores (CSV)
            </span>
          </Button>
        </label>
        <Button variant="subtle" size="sm" className="w-full rounded-xl" onClick={onExport} disabled={busy}>
          <Download className="size-4" /> Export store list
        </Button>
        <Button
          variant="subtle"
          size="sm"
          className="w-full rounded-xl"
          onClick={onAssignUsers}
          disabled={selectedCount === 0 || busy}
        >
          <UserPlus className="size-4" /> Assign users
        </Button>
        <Button
          variant="subtle"
          size="sm"
          className="w-full rounded-xl"
          onClick={onBulkArchive}
          disabled={selectedCount === 0 || busy}
        >
          <Archive className="size-4" /> Bulk archive
        </Button>
      </div>
      <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
        Bulk endpoints are wired to the Aislix API and activate as soon as the service exposes them
        for your organization.
      </p>
    </div>
  );
}

export function InlineOk({ children }: { children: string }) {
  return (
    <p className="inline-flex items-center gap-1.5 text-xs text-brand">
      <CheckCircle2 className="size-3.5" /> {children}
    </p>
  );
}
