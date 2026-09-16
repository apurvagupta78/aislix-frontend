import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { OperatingModel } from "@/lib/audit-builder/types";
import type { LocationScope } from "@/lib/assignment-engine";
import { fetchStores, type Store } from "@/lib/account";
import { fetchHierarchyProfiles, searchHierarchyNodes } from "@/lib/hierarchy";
import { FmcgHierarchyScopePicker } from "./FmcgHierarchyScopePicker";

type Props = {
  operatingModel: OperatingModel;
  value: LocationScope;
  onChange: (scope: LocationScope) => void;
  singleStore?: boolean;
};

export function LocationScopePicker({ operatingModel, value, onChange, singleStore }: Props) {
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const showFmcgHierarchy = operatingModel === "fmcg_distributor";

  const storesQuery = useQuery({
    queryKey: ["stores", "assignment-scope"],
    queryFn: () => fetchStores().then((r) => r.items),
  });

  const hierarchyQuery = useQuery({
    queryKey: ["hierarchy-profiles", operatingModel],
    queryFn: () => fetchHierarchyProfiles(operatingModel),
  });

  const profileId = hierarchyQuery.data?.[0]?.id;

  const nodesQuery = useQuery({
    queryKey: ["hierarchy-nodes", profileId, search],
    queryFn: () =>
      profileId
        ? searchHierarchyNodes({ profileId, query: search, activeOnly: true, limit: 50 })
        : Promise.resolve([]),
    enabled: Boolean(profileId) && search.length >= 2,
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
    if (singleStore) {
      onChange({
        storeIds: [store.id],
        stores: [{ id: store.id, name: store.name, city: store.city, country: store.country }],
      });
      return;
    }
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

  const selectAllFiltered = () => {
    const ids = singleStore
      ? filteredStores.slice(0, 1).map((s) => s.id)
      : filteredStores.map((s) => s.id);
    const selected = stores.filter((s) => ids.includes(s.id));
    onChange({
      ...value,
      storeIds: ids,
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

  const storeList = (
    <>
      <div className="grid gap-3 md:grid-cols-4">
        <div className="relative md:col-span-2">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search stores..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
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
      </div>

      {!singleStore ? (
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={selectAllFiltered}>
            Select all ({filteredStores.length})
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange({ storeIds: [], stores: [] })}
          >
            Clear
          </Button>
        </div>
      ) : null}

      <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-2">
        {filteredStores.map((store) => {
          const checked = value.storeIds.includes(store.id);
          return (
            <Label
              key={store.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50"
            >
              <Checkbox checked={checked} onCheckedChange={() => toggleStore(store)} />
              <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{store.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[store.city, store.country].filter(Boolean).join(" · ") || "—"}
                </span>
              </span>
            </Label>
          );
        })}
        {!filteredStores.length ? (
          <p className="p-4 text-center text-sm text-muted-foreground">No stores match filters.</p>
        ) : null}
      </div>

      {nodesQuery.data?.length ? (
        <div className="rounded-lg border border-dashed p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Hierarchy matches
          </p>
          <div className="flex flex-wrap gap-1">
            {nodesQuery.data.slice(0, 8).map((node) => (
              <Badge key={node.id} variant="outline">
                {node.name} ({node.level_key})
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );

  return (
    <div className="space-y-4 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Where?</p>
          <p className="text-sm text-muted-foreground">
            Select locations for this audit. Supports multi-store, multi-city, and multi-country.
          </p>
        </div>
        <Badge variant="secondary">{value.storeIds.length} location(s) selected</Badge>
      </div>

      {showFmcgHierarchy ? (
        <Tabs defaultValue="stores">
          <TabsList>
            <TabsTrigger value="stores">Stores</TabsTrigger>
            <TabsTrigger value="hierarchy">FMCG Hierarchy</TabsTrigger>
          </TabsList>
          <TabsContent value="stores" className="mt-3 space-y-4">
            {storeList}
          </TabsContent>
          <TabsContent value="hierarchy" className="mt-3">
            <FmcgHierarchyScopePicker value={value} onChange={onChange} />
          </TabsContent>
        </Tabs>
      ) : (
        storeList
      )}
    </div>
  );
}
