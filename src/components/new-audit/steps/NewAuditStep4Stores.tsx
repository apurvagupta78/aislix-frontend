import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, MapPin, Search, Store, X } from "lucide-react";

import { LocationScopePicker } from "@/components/assignment-engine/LocationScopePicker";
import { NewAuditStepSection } from "@/components/new-audit/NewAuditStepSection";
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
import { Skeleton } from "@/components/ui/skeleton";
import type { Store as OrgStore } from "@/lib/account";
import type { LocationScope } from "@/lib/assignment-engine";
import type { OperatingModel } from "@/lib/audit-builder/types";
import { storeSelection } from "@/lib/new-audit/store-selection";
import { cn } from "@/lib/utils";

type Props = {
  operatingModel: OperatingModel;
  stores: OrgStore[];
  loading?: boolean;
  loadFailed?: boolean;
  value: LocationScope;
  onChange: (scope: LocationScope) => void;
  /** Extra guidance under the selection, e.g. how "start now" treats several stores. */
  note?: string | null;
  complete?: boolean;
  error?: string | null;
};

const VISIBLE_CARD_LIMIT = 6;

function locationWords(model: OperatingModel): { one: string; many: string } {
  if (model === "fmcg_distributor") return { one: "outlet", many: "outlets" };
  if (model === "warehouse") return { one: "warehouse", many: "warehouses" };
  if (model === "dark_store") return { one: "dark store", many: "dark stores" };
  return { one: "store", many: "stores" };
}

export function NewAuditStep4Stores({
  operatingModel,
  stores,
  loading,
  loadFailed,
  value,
  onChange,
  note,
  complete,
  error,
}: Props) {
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const words = locationWords(operatingModel);

  const countries = useMemo(
    () => [...new Set(stores.map((s) => s.country).filter(Boolean))] as string[],
    [stores],
  );
  const cities = useMemo(() => {
    const inCountry = countryFilter === "all" ? stores : stores.filter((s) => s.country === countryFilter);
    return [...new Set(inCountry.map((s) => s.city).filter(Boolean))] as string[];
  }, [stores, countryFilter]);

  const filteredStores = useMemo(() => {
    const term = search.trim().toLowerCase();
    return stores.filter((s) => {
      if (countryFilter !== "all" && s.country !== countryFilter) return false;
      if (cityFilter !== "all" && s.city !== cityFilter) return false;
      if (
        term &&
        ![s.name, s.code, s.city, s.address].some((field) => field?.toLowerCase().includes(term))
      ) {
        return false;
      }
      return true;
    });
  }, [stores, countryFilter, cityFilter, search]);

  const selectedIds = value.storeIds;
  const count = selectedIds.length;
  const select = (ids: string[]) => onChange(storeSelection(stores, ids));
  const toggleStore = (id: string) =>
    select(selectedIds.includes(id) ? selectedIds.filter((s) => s !== id) : [...selectedIds, id]);
  const selectAllMatching = () =>
    select([...new Set([...selectedIds, ...filteredStores.map((s) => s.id)])]);

  const renderStoreCard = (store: OrgStore, compact?: boolean) => {
    const selected = selectedIds.includes(store.id);
    return (
      <button
        key={store.id}
        type="button"
        aria-pressed={selected}
        onClick={() => toggleStore(store.id)}
        className={cn(
          "flex w-full flex-col rounded-xl border p-4 text-left transition-colors duration-200",
          selected
            ? "border-[var(--aislix-primary)] bg-white"
            : "border-[var(--aislix-border)] bg-white hover:border-[#9FB3C8] hover:bg-muted",
          compact && "p-3",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--aislix-surface)]">
            <Store className="size-4 text-[var(--aislix-secondary)]" />
          </span>
          {selected ? (
            <span className="flex size-6 items-center justify-center rounded-full bg-[var(--aislix-primary)] text-white">
              <Check className="size-3.5" />
            </span>
          ) : (
            <span className="text-xs text-[var(--aislix-secondary)]">Select</span>
          )}
        </div>
        <p className="mt-2 font-semibold leading-snug text-[var(--aislix-primary)]">{store.name}</p>
        <p className="mt-0.5 text-xs text-[var(--aislix-secondary)]">
          {[store.city, store.state, store.country].filter(Boolean).join(" · ") || "Location not set"}
        </p>
        {store.address && !compact ? (
          <p className="mt-1 line-clamp-1 text-[11px] text-[var(--aislix-secondary)]">{store.address}</p>
        ) : null}
      </button>
    );
  };

  return (
    <NewAuditStepSection
      id="step-4-where"
      stepNumber={4}
      title="Where?"
      description={`Choose one or more ${words.many}. Aislix creates a separate audit for each ${words.one}.`}
      complete={complete}
      error={error}
    >
      {operatingModel === "fmcg_distributor" ? (
        <div className="rounded-xl border border-[var(--aislix-border)] p-4">
          <LocationScopePicker operatingModel={operatingModel} value={value} onChange={onChange} />
        </div>
      ) : loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : loadFailed ? (
        <div className="rounded-xl border bg-white p-6 text-center text-sm text-[var(--aislix-primary)] border-[#ECBDCC]">
          Could not load your {words.many}. Refresh the page to try again.
        </div>
      ) : !stores.length ? (
        <div className="rounded-xl border border-dashed border-[var(--aislix-border)] bg-[#EEF1F4]/60 p-8 text-center">
          <MapPin className="mx-auto mb-3 size-8 text-[var(--aislix-secondary)]" />
          <p className="font-medium text-[var(--aislix-primary)]">No {words.many} added yet</p>
          <p className="mt-1 text-sm text-[var(--aislix-secondary)]">
            Add your {words.many} first, then come back to create the audit.
          </p>
          <Button asChild variant="brand" size="sm" className="mt-4 rounded-xl">
            <Link to="/store-master">Add {words.many}</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {stores.length > 1 ? (
            <div className="grid gap-3 md:grid-cols-4">
              {countries.length > 1 ? (
                <Select
                  value={countryFilter}
                  onValueChange={(v) => {
                    setCountryFilter(v);
                    setCityFilter("all");
                  }}
                >
                  <SelectTrigger className="rounded-xl" aria-label="Filter by country">
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
              ) : null}
              {cities.length > 1 ? (
                <Select value={cityFilter} onValueChange={setCityFilter}>
                  <SelectTrigger className="rounded-xl" aria-label="Filter by city">
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
              ) : null}
              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--aislix-secondary)]" />
                <Input
                  className="rounded-xl pl-9"
                  placeholder={`Search ${words.many}…`}
                  aria-label={`Search ${words.many}`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-[var(--aislix-primary)]">
              {count} of {stores.length} {stores.length === 1 ? words.one : words.many} selected
              {count > 1 ? ` · ${count} audits will be created` : ""}
            </span>
            {stores.length > 1 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={selectAllMatching}
                disabled={!filteredStores.length}
              >
                {filteredStores.length === stores.length ? "Select all" : "Select all matching"}
              </Button>
            ) : null}
            {count > 0 ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => select([])}>
                Clear
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
                    <SheetTitle>Choose {words.many}</SheetTitle>
                    <SheetDescription>
                      Aislix creates a separate audit for each {words.one} you choose.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-4 grid gap-2">
                    {filteredStores.map((store) => renderStoreCard(store, true))}
                  </div>
                </SheetContent>
              </Sheet>
            ) : null}
          </div>

          {count > 0 && stores.length > VISIBLE_CARD_LIMIT ? (
            <div className="flex flex-wrap gap-2">
              {(value.stores ?? []).map((store) => (
                <span
                  key={store.id}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--aislix-border)] bg-[var(--aislix-surface)] px-3 py-1 text-sm font-medium text-[var(--aislix-primary)]"
                >
                  {store.name}
                  <button
                    type="button"
                    aria-label={`Remove ${store.name}`}
                    className="text-[var(--aislix-secondary)] hover:text-[var(--aislix-primary)]"
                    onClick={() => toggleStore(store.id)}
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}

          {!filteredStores.length ? (
            <p className="text-sm text-[var(--aislix-secondary)]">No {words.many} match your search.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredStores.slice(0, VISIBLE_CARD_LIMIT).map((store) => renderStoreCard(store))}
            </div>
          )}

          {note ? <p className="text-sm text-[var(--aislix-secondary)]">{note}</p> : null}
        </div>
      )}
    </NewAuditStepSection>
  );
}
