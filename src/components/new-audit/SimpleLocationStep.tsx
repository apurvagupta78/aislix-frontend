import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Plus, Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { fetchStores, type Store } from "@/lib/account";
import { getTerminology } from "@/lib/audit-engine/operating-model-catalog";
import { LocationScopePicker } from "@/components/assignment-engine/LocationScopePicker";
import { cn } from "@/lib/utils";

type Props = {
  operatingModel: OperatingModel;
  value: LocationScope;
  onChange: (scope: LocationScope) => void;
  error?: string | null;
};

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

  const toggleStore = (store: Store) => {
    const ids = new Set(value.storeIds);
    if (ids.has(store.id)) ids.delete(store.id);
    else ids.add(store.id);
    const selected = stores.filter((s) => ids.has(s.id));
    onChange({
      ...value,
      storeIds: [...ids],
      stores: selected.map((s) => ({
        id: s.id,
        name: s.name,
        city: s.city,
        country: s.country,
      })),
      countries: [...new Set(selected.map((s) => s.country).filter(Boolean))] as string[],
      cities: [...new Set(selected.map((s) => s.city).filter(Boolean))] as string[],
    });
  };

  const removeStore = (storeId: string) => {
    onChange({
      ...value,
      storeIds: value.storeIds.filter((id) => id !== storeId),
      stores: (value.stores ?? []).filter((s) => s.id !== storeId),
    });
  };

  const selectAllFiltered = () => {
    const ids = filteredStores.map((s) => s.id);
    onChange({
      ...value,
      storeIds: ids,
      stores: filteredStores.map((s) => ({
        id: s.id,
        name: s.name,
        city: s.city,
        country: s.country,
      })),
      countries: [...new Set(filteredStores.map((s) => s.country).filter(Boolean))] as string[],
      cities: [...new Set(filteredStores.map((s) => s.city).filter(Boolean))] as string[],
    });
  };

  const count = value.storeIds.length;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Where do you want to audit?</h2>
        <p className="text-sm text-muted-foreground">Choose one or more {locationLabel}.</p>
      </div>

      {operatingModel === "fmcg_distributor" ? (
        <div className="rounded-2xl border border-border bg-card p-4">
          <LocationScopePicker
            operatingModel={operatingModel}
            value={value}
            onChange={onChange}
          />
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger>
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
              <SelectTrigger>
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
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder={`Search ${locationLabel}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {count} {count === 1 ? terminology.location.toLowerCase() : locationLabel} selected
            </Badge>
            <Button type="button" variant="outline" size="sm" onClick={selectAllFiltered}>
              Select all matching
            </Button>
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  <Plus className="mr-1 size-3.5" /> Select locations
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
                <SheetHeader>
                  <SheetTitle>Select locations</SheetTitle>
                  <SheetDescription>
                    Search and choose {locationLabel} for this audit.
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-4 max-h-[70vh] space-y-2 overflow-y-auto">
                  {filteredStores.map((store) => {
                    const selected = value.storeIds.includes(store.id);
                    return (
                      <button
                        key={store.id}
                        type="button"
                        onClick={() => toggleStore(store)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border p-3 text-left",
                          selected ? "border-brand bg-brand-soft/30" : "border-border",
                        )}
                      >
                        <MapPin className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{store.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {[store.city, store.country].filter(Boolean).join(", ")}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {count > 0 ? (
            <div className="flex flex-wrap gap-2">
              {(value.stores ?? []).map((store) => (
                <Badge
                  key={store.id}
                  variant="outline"
                  className="gap-1 rounded-full px-3 py-1.5 text-sm"
                >
                  {store.name}
                  <button
                    type="button"
                    aria-label={`Remove ${store.name}`}
                    onClick={() => removeStore(store.id)}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
              Pick {locationLabel} from the list above or use Select locations.
            </div>
          )}
        </>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
