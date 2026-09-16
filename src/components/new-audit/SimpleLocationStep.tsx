import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, MapPin, Search, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { OperatingModel } from "@/lib/audit-builder/types";
import type { LocationScope } from "@/lib/assignment-engine";
import { fetchStores, type Store as OrgStore } from "@/lib/account";
import { getTerminology } from "@/lib/audit-engine/operating-model-catalog";
import { LocationScopePicker } from "@/components/assignment-engine/LocationScopePicker";
import { cn } from "@/lib/utils";

type Props = {
  operatingModel: OperatingModel;
  value: LocationScope;
  onChange: (scope: LocationScope) => void;
  error?: string | null;
};

const VISIBLE_CARD_LIMIT = 6;

function applySelection(stores: OrgStore[], ids: string[]): LocationScope {
  const selected = stores.filter((s) => ids.includes(s.id));
  return {
    storeIds: ids,
    stores: selected.map((s) => ({
      id: s.id,
      name: s.name,
      city: s.city,
      country: s.country,
    })),
    countries: [...new Set(selected.map((s) => s.country).filter(Boolean))] as string[],
    cities: [...new Set(selected.map((s) => s.city).filter(Boolean))] as string[],
  };
}

export function SimpleLocationStep({ operatingModel, value, onChange, error }: Props) {
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const terminology = getTerminology(operatingModel);
  const locationLabel =
    operatingModel === "fmcg_distributor"
      ? "outlets"
      : operatingModel === "warehouse"
        ? "warehouses"
        : operatingModel === "dark_store"
          ? "dark stores"
          : "stores";

  const storesQuery = useQuery({
    queryKey: ["stores", "new-audit-location"],
    queryFn: () => fetchStores().then((r) => r.items),
  });

  const stores = storesQuery.data ?? [];

  const countries = useMemo(
    () => [...new Set(stores.map((s) => s.country).filter(Boolean))] as string[],
    [stores],
  );

  const cities = useMemo(() => {
    const filtered =
      countryFilter === "all" ? stores : stores.filter((s) => s.country === countryFilter);
    return [...new Set(filtered.map((s) => s.city).filter(Boolean))] as string[];
  }, [stores, countryFilter]);

  const filteredStores = useMemo(() => {
    return stores.filter((s) => {
      if (countryFilter !== "all" && s.country !== countryFilter) return false;
      if (cityFilter !== "all" && s.city !== cityFilter) return false;
      if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [stores, countryFilter, cityFilter, search]);

  const toggleStore = (store: OrgStore) => {
    const ids = new Set(value.storeIds);
    if (ids.has(store.id)) ids.delete(store.id);
    else ids.add(store.id);
    onChange(applySelection(stores, [...ids]));
  };

  const selectAllFiltered = () => {
    onChange(applySelection(stores, filteredStores.map((s) => s.id)));
  };

  const clearAll = () => {
    onChange({ storeIds: [], stores: [] });
  };

  const count = value.storeIds.length;
  const previewCards = filteredStores.slice(0, VISIBLE_CARD_LIMIT);

  const renderStoreCard = (store: OrgStore, compact?: boolean) => {
    const selected = value.storeIds.includes(store.id);
    return (
      <button
        key={store.id}
        type="button"
        onClick={() => toggleStore(store)}
        className={cn(
          "flex w-full flex-col rounded-2xl border p-4 text-left transition-all",
          selected
            ? "border-brand bg-brand-soft/30 ring-2 ring-brand/20"
            : "border-border bg-card hover:border-brand/30 hover:shadow-sm",
          compact && "p-3",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted/60">
            <Store className="size-4 text-muted-foreground" />
          </span>
          {selected ? (
            <span className="flex size-6 items-center justify-center rounded-full bg-brand text-brand-foreground">
              <Check className="size-3.5" />
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Select</span>
          )}
        </div>
        <p className="mt-2 font-semibold leading-snug">{store.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {[store.city, store.state, store.country].filter(Boolean).join(" · ") || "—"}
        </p>
        {store.address ? (
          <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">{store.address}</p>
        ) : null}
      </button>
    );
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Where?</h2>
        <p className="text-sm text-muted-foreground">Choose one or more {locationLabel}.</p>
      </div>

      {operatingModel === "fmcg_distributor" ? (
        <div className="play-surface rounded-2xl p-4">
          <LocationScopePicker operatingModel={operatingModel} value={value} onChange={onChange} />
        </div>
      ) : storesQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : storesQuery.isError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm">
          Could not load your locations. Try refreshing the page.
        </div>
      ) : !stores.length ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center">
          <MapPin className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="font-medium">No locations added yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add stores to your organization before creating an audit.
          </p>
          <Button asChild variant="brand" size="sm" className="mt-4 rounded-xl">
            <Link to="/store-master">Manage Locations</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All countries</SelectItem>
                {countries.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={cityFilter} onValueChange={setCityFilter}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="City" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All cities</SelectItem>
                {cities.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="rounded-xl pl-9"
                placeholder="Search locations…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">
              {count} {count === 1 ? terminology.location.toLowerCase() : locationLabel} selected
            </span>
            <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={selectAllFiltered}>
              Select all matching
            </Button>
            {count > 0 ? (
              <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
                Clear all
              </Button>
            ) : null}
            {filteredStores.length > VISIBLE_CARD_LIMIT ? (
              <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
                <SheetTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="rounded-xl">
                    View all ({filteredStores.length})
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
                  <SheetHeader>
                    <SheetTitle>Select locations</SheetTitle>
                    <SheetDescription>Search and choose {locationLabel} for this audit.</SheetDescription>
                  </SheetHeader>
                  <div className="mt-4 grid gap-2">
                    {filteredStores.map((store) => renderStoreCard(store, true))}
                  </div>
                </SheetContent>
              </Sheet>
            ) : null}
          </div>

          {count > 0 ? (
            <div className="flex flex-wrap gap-2">
              {(value.stores ?? []).map((store) => (
                <span
                  key={store.id}
                  className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand-soft/40 px-3 py-1 text-sm font-medium"
                >
                  {store.name}
                  <button
                    type="button"
                    aria-label={`Remove ${store.name}`}
                    onClick={() =>
                      onChange(applySelection(stores, value.storeIds.filter((id) => id !== store.id)))
                    }
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : null}

          {!filteredStores.length ? (
            <p className="text-sm text-muted-foreground">No locations match your filters.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {previewCards.map((store) => renderStoreCard(store))}
            </div>
          )}
        </>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
