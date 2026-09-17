import { useMemo, useState, type ComponentType } from "react";
import { Link } from "@tanstack/react-router";
import {
  Calendar,
  Check,
  ChevronsUpDown,
  ClipboardList,
  Gauge,
  Globe2,
  Layers,
  MapPin,
  Plus,
  SlidersHorizontal,
  Store,
  Tag,
  Users,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DASHBOARD_ASSIGNMENT_OPTIONS,
  DASHBOARD_DATE_PRESETS,
  clearDashboardFilterChip,
  dashboardFilterChips,
  isDefaultDashboardFilters,
  type DashboardFilterOptions,
  type DashboardFilterState,
} from "@/lib/dashboard-filters";
import { clearDashboardFiltersPreservingRole } from "@/lib/dashboard-role-context";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

const CONTROL =
  "h-9 shrink-0 rounded-lg border border-border bg-card px-2.5 text-xs font-normal text-foreground shadow-soft hover:bg-brand-soft/55 focus:ring-2 focus:ring-ring/60";

function CompactSelect({
  label,
  icon: Icon,
  value,
  onValueChange,
  options,
  allLabel,
  className,
}: {
  label: string;
  icon: ComponentType<{ className?: string }>;
  value: string;
  onValueChange: (v: string) => void;
  options: Option[];
  allLabel: string;
  className?: string;
}) {
  const display =
    value === "all" ? allLabel : options.find((o) => o.value === value)?.label ?? value;

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={cn(CONTROL, "gap-1.5", className)} aria-label={label}>
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{display}</span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SearchableSelect({
  label,
  icon: Icon,
  value,
  onValueChange,
  options,
  allLabel,
  className,
}: {
  label: string;
  icon: ComponentType<{ className?: string }>;
  value: string;
  onValueChange: (v: string) => void;
  options: Option[];
  allLabel: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const searchable = options.length > 8;
  const display =
    value === "all" ? allLabel : options.find((o) => o.value === value)?.label ?? value;

  if (!searchable) {
    return (
      <CompactSelect
        label={label}
        icon={Icon}
        value={value}
        onValueChange={onValueChange}
        options={options}
        allLabel={allLabel}
        className={className}
      />
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={label}
          className={cn(CONTROL, "justify-between gap-1", className)}
        >
          <span className="flex min-w-0 items-center gap-1.5 truncate">
            <Icon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{display}</span>
          </span>
          <ChevronsUpDown className="size-3 shrink-0 opacity-40" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search…`} className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={allLabel}
                onSelect={() => {
                  onValueChange("all");
                  setOpen(false);
                }}
              >
                <Check className={cn("mr-2 size-3.5", value === "all" ? "opacity-100" : "opacity-0")} />
                {allLabel}
              </CommandItem>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.label}
                  onSelect={() => {
                    onValueChange(o.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("mr-2 size-3.5", value === o.value ? "opacity-100" : "opacity-0")}
                  />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function DateControl({
  filters,
  onChange,
  stacked,
}: {
  filters: DashboardFilterState;
  onChange: (next: DashboardFilterState) => void;
  stacked?: boolean;
}) {
  if (stacked) {
    return (
      <div className="space-y-2">
        <DatePresetSelect filters={filters} onChange={onChange} />
        {filters.datePreset === "custom" ? (
          <div className="flex w-full gap-2">
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
              className="h-9 rounded-lg text-xs"
              aria-label="From date"
            />
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
              className="h-9 rounded-lg text-xs"
              aria-label="To date"
            />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <DatePresetSelect filters={filters} onChange={onChange} />
      {filters.datePreset === "custom" ? (
        <div className="flex gap-2">
          <Input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
            className="h-9 rounded-lg text-xs"
            aria-label="From date"
          />
          <Input
            type="date"
            value={filters.dateTo}
            onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
            className="h-9 rounded-lg text-xs"
            aria-label="To date"
          />
        </div>
      ) : null}
    </>
  );
}

function DatePresetSelect({
  filters,
  onChange,
}: {
  filters: DashboardFilterState;
  onChange: (next: DashboardFilterState) => void;
}) {
  return (
    <Select
        value={filters.datePreset}
        onValueChange={(v) =>
          onChange({
            ...filters,
            datePreset: v as DashboardFilterState["datePreset"],
            ...(v !== "custom" ? { dateFrom: "", dateTo: "" } : {}),
          })
        }
      >
        <SelectTrigger className={cn(CONTROL, "min-w-[118px] gap-1.5")} aria-label="Date">
          <Calendar className="size-3.5 shrink-0 text-muted-foreground" />
          <SelectValue placeholder="Last 7 days" />
        </SelectTrigger>
        <SelectContent>
          {DASHBOARD_DATE_PRESETS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
  );
}

function MoreFiltersPopover({
  filters,
  onChange,
  options,
  open,
  onOpenChange,
  activeCount,
}: {
  filters: DashboardFilterState;
  onChange: (next: DashboardFilterState) => void;
  options: DashboardFilterOptions;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeCount: number;
}) {
  const subCategoryOptions = useMemo(() => {
    const subs =
      filters.category === "all"
        ? options.subcategories
        : options.subcategories.filter((s) => s.category === filters.category);
    return subs.map((s) => ({ value: s.value, label: s.label }));
  }, [filters.category, options.subcategories]);

  const teamOptions = useMemo(
    () => options.team_members.map((m) => ({ value: m.user_id, label: m.name || m.email })),
    [options.team_members],
  );

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(CONTROL, "gap-1 px-2.5", activeCount > 0 && "border-brand/30 bg-brand-soft/30")}
        >
          <SlidersHorizontal className="size-3.5 text-muted-foreground" />
          <span>More filters</span>
          <Plus className="size-3 text-muted-foreground" />
          {activeCount > 0 ? (
            <span className="ml-0.5 rounded-full bg-brand px-1.5 text-[10px] font-semibold text-brand-foreground">
              {activeCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,320px)] space-y-2 p-3" align="start">
        <SearchableSelect
          label="Sub-category"
          icon={Layers}
          value={filters.subCategory}
          onValueChange={(v) => onChange({ ...filters, subCategory: v })}
          options={subCategoryOptions}
          allLabel="All sub-categories"
          className="w-full"
        />
        {options.only_self && options.team_members.length <= 1 ? (
          <div className="flex h-9 items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-2.5 text-xs text-muted-foreground">
            <Users className="size-3.5" />
            <span>Only you</span>
            <Link to="/settings" className="font-medium text-brand hover:underline">
              Invite teammates →
            </Link>
          </div>
        ) : (
          <SearchableSelect
            label="Team member"
            icon={Users}
            value={filters.teamMemberId}
            onValueChange={(v) =>
              onChange({
                ...filters,
                teamMemberId: v,
                ...(v !== "all" ? { auditAssignment: "all" as const } : {}),
              })
            }
            options={teamOptions}
            allLabel="All team members"
            className="w-full"
          />
        )}
        <CompactSelect
          label="Audit assignment"
          icon={ClipboardList}
          value={filters.auditAssignment}
          onValueChange={(v) =>
            onChange({
              ...filters,
              auditAssignment: v as DashboardFilterState["auditAssignment"],
              ...(v !== "all" ? { teamMemberId: "all" } : {}),
            })
          }
          options={DASHBOARD_ASSIGNMENT_OPTIONS.filter((o) => o.value !== "all").map((o) => ({
            value: o.value,
            label: o.label,
          }))}
          allLabel="All audits"
          className="w-full"
        />
      </PopoverContent>
    </Popover>
  );
}

function useFilterOptions(filters: DashboardFilterState, options: DashboardFilterOptions) {
  const countryOptions = useMemo(
    () => options.countries.map((c) => ({ value: c, label: c })),
    [options.countries],
  );

  const cityOptions = useMemo(() => {
    const cities =
      filters.country === "all"
        ? options.cities
        : [
            ...new Set(
              options.stores
                .filter((s) => s.country === filters.country)
                .map((s) => s.city)
                .filter(Boolean) as string[],
            ),
          ].sort();
    return cities.map((c) => ({ value: c, label: c }));
  }, [filters.country, options.cities, options.stores]);

  const storeOptions = useMemo(() => {
    let stores = options.stores;
    if (filters.country !== "all") stores = stores.filter((s) => s.country === filters.country);
    if (filters.city !== "all") stores = stores.filter((s) => s.city === filters.city);
    return stores.map((s) => ({ value: s.id, label: s.name }));
  }, [filters.country, filters.city, options.stores]);

  const categoryOptions = useMemo(
    () => options.categories.map((c) => ({ value: c, label: c })),
    [options.categories],
  );

  const kriOptions = useMemo(
    () => options.kri_options.map((o) => ({ value: o.value, label: o.label })),
    [options.kri_options],
  );

  return { countryOptions, cityOptions, storeOptions, categoryOptions, kriOptions };
}

function DesktopToolbar({
  filters,
  onChange,
  options,
}: {
  filters: DashboardFilterState;
  onChange: (next: DashboardFilterState) => void;
  options: DashboardFilterOptions;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const { countryOptions, cityOptions, storeOptions, categoryOptions, kriOptions } =
    useFilterOptions(filters, options);

  const moreActive =
    (filters.subCategory !== "all" ? 1 : 0) +
    (filters.teamMemberId !== "all" ? 1 : 0) +
    (filters.auditAssignment !== "all" ? 1 : 0);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <DateControl filters={filters} onChange={onChange} />
      <SearchableSelect
        label="Country"
        icon={Globe2}
        value={filters.country}
        onValueChange={(v) =>
          onChange({ ...filters, country: v, city: "all", storeId: "all" })
        }
        options={countryOptions}
        allLabel="All countries"
        className="min-w-[120px] max-w-[150px]"
      />
      <SearchableSelect
        label="City"
        icon={MapPin}
        value={filters.city}
        onValueChange={(v) => onChange({ ...filters, city: v, storeId: "all" })}
        options={cityOptions}
        allLabel="All cities"
        className="min-w-[110px] max-w-[140px]"
      />
      {kriOptions.length ? (
        <CompactSelect
          label="KRI"
          icon={Gauge}
          value={filters.kri}
          onValueChange={(v) => onChange({ ...filters, kri: v as DashboardFilterState["kri"] })}
          options={kriOptions}
          allLabel="All KRIs"
          className="min-w-[108px] max-w-[150px]"
        />
      ) : null}
      <SearchableSelect
        label="Store"
        icon={Store}
        value={filters.storeId}
        onValueChange={(v) => onChange({ ...filters, storeId: v })}
        options={storeOptions}
        allLabel="All stores"
        className="min-w-[108px] max-w-[150px]"
      />
      <SearchableSelect
        label="Category"
        icon={Tag}
        value={filters.category}
        onValueChange={(v) => onChange({ ...filters, category: v, subCategory: "all" })}
        options={categoryOptions}
        allLabel="All categories"
        className="min-w-[118px] max-w-[160px]"
      />
      <MoreFiltersPopover
        filters={filters}
        onChange={onChange}
        options={options}
        open={moreOpen}
        onOpenChange={setMoreOpen}
        activeCount={moreActive}
      />
      {!isDefaultDashboardFilters(filters) ? (
        <button
          type="button"
          onClick={() => onChange(clearDashboardFiltersPreservingRole(filters))}
          className="inline-flex h-9 shrink-0 items-center gap-1 px-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-brand"
        >
          <X className="size-3.5" />
          Clear
        </button>
      ) : null}
    </div>
  );
}

function MobileFilters({
  filters,
  onChange,
  options,
  activeCount,
}: {
  filters: DashboardFilterState;
  onChange: (next: DashboardFilterState) => void;
  options: DashboardFilterOptions;
  activeCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const { countryOptions, cityOptions, storeOptions, categoryOptions, kriOptions } =
    useFilterOptions(draft, options);

  const subCategoryOptions = useMemo(() => {
    const subs =
      draft.category === "all"
        ? options.subcategories
        : options.subcategories.filter((s) => s.category === draft.category);
    return subs.map((s) => ({ value: s.value, label: s.label }));
  }, [draft.category, options.subcategories]);

  const teamOptions = useMemo(
    () => options.team_members.map((m) => ({ value: m.user_id, label: m.name || m.email })),
    [options.team_members],
  );

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDraft(filters);
      }}
    >
      <SheetTrigger asChild>
        <Button variant="outline" className={cn(CONTROL, "gap-1.5")}>
          <SlidersHorizontal className="size-3.5" />
          Filters ({activeCount})
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto rounded-t-2xl px-4 pb-6 pt-4">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-left text-sm font-semibold">Filters</SheetTitle>
        </SheetHeader>
        <div className="space-y-3">
          <DateControl filters={draft} onChange={setDraft} stacked />
          <SearchableSelect
            label="Country"
            icon={Globe2}
            value={draft.country}
            onValueChange={(v) => setDraft({ ...draft, country: v, city: "all", storeId: "all" })}
            options={countryOptions}
            allLabel="All countries"
            className="w-full"
          />
          <SearchableSelect
            label="City"
            icon={MapPin}
            value={draft.city}
            onValueChange={(v) => setDraft({ ...draft, city: v, storeId: "all" })}
            options={cityOptions}
            allLabel="All cities"
            className="w-full"
          />
          {kriOptions.length ? (
            <CompactSelect
              label="KRI"
              icon={Gauge}
              value={draft.kri}
              onValueChange={(v) => setDraft({ ...draft, kri: v as DashboardFilterState["kri"] })}
              options={kriOptions}
              allLabel="All KRIs"
              className="w-full"
            />
          ) : null}
          <SearchableSelect
            label="Store"
            icon={Store}
            value={draft.storeId}
            onValueChange={(v) => setDraft({ ...draft, storeId: v })}
            options={storeOptions}
            allLabel="All stores"
            className="w-full"
          />
          <SearchableSelect
            label="Category"
            icon={Tag}
            value={draft.category}
            onValueChange={(v) => setDraft({ ...draft, category: v, subCategory: "all" })}
            options={categoryOptions}
            allLabel="All categories"
            className="w-full"
          />
          <SearchableSelect
            label="Sub-category"
            icon={Layers}
            value={draft.subCategory}
            onValueChange={(v) => setDraft({ ...draft, subCategory: v })}
            options={subCategoryOptions}
            allLabel="All sub-categories"
            className="w-full"
          />
          {options.only_self && options.team_members.length <= 1 ? (
            <div className="flex h-9 items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-2.5 text-xs text-muted-foreground">
              <Users className="size-3.5" />
              <span>Only you</span>
              <Link to="/settings" className="font-medium text-brand hover:underline">
                Invite teammates →
              </Link>
            </div>
          ) : (
            <SearchableSelect
              label="Team member"
              icon={Users}
              value={draft.teamMemberId}
              onValueChange={(v) =>
                setDraft({
                  ...draft,
                  teamMemberId: v,
                  ...(v !== "all" ? { auditAssignment: "all" as const } : {}),
                })
              }
              options={teamOptions}
              allLabel="All team members"
              className="w-full"
            />
          )}
          <CompactSelect
            label="Audit assignment"
            icon={ClipboardList}
            value={draft.auditAssignment}
            onValueChange={(v) =>
              setDraft({
                ...draft,
                auditAssignment: v as DashboardFilterState["auditAssignment"],
                ...(v !== "all" ? { teamMemberId: "all" } : {}),
              })
            }
            options={DASHBOARD_ASSIGNMENT_OPTIONS.filter((o) => o.value !== "all").map((o) => ({
              value: o.value,
              label: o.label,
            }))}
            allLabel="All audits"
            className="w-full"
          />
        </div>
        <div className="mt-5 flex gap-2">
          <Button
            type="button"
            variant="subtle"
            className="flex-1 rounded-lg"
            onClick={() => {
              const next = clearDashboardFiltersPreservingRole(filters);
              setDraft(next);
              onChange(next);
              setOpen(false);
            }}
          >
            Reset
          </Button>
          <Button
            type="button"
            variant="brand"
            className="flex-1 rounded-lg"
            onClick={() => {
              onChange(draft);
              setOpen(false);
            }}
          >
            Apply filters
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function DashboardFilterBar({
  filters,
  onChange,
  options,
  summaryLabel,
}: {
  filters: DashboardFilterState;
  onChange: (next: DashboardFilterState) => void;
  options: DashboardFilterOptions;
  summaryLabel?: string;
}) {
  const chips = dashboardFilterChips(filters, options);
  const activeCount = chips.length;

  return (
    <section className="space-y-1.5" aria-label="Dashboard filters">
      <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Filter view
      </p>

      <div className="hidden md:block">
        <DesktopToolbar filters={filters} onChange={onChange} options={options} />
      </div>

      <div className="md:hidden">
        <MobileFilters
          filters={filters}
          onChange={onChange}
          options={options}
          activeCount={activeCount}
        />
      </div>

      {!isDefaultDashboardFilters(filters) && summaryLabel ? (
        <p className="text-[11px] text-muted-foreground">{summaryLabel}</p>
      ) : null}

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {chips.map((chip) => (
            <button
              key={`${chip.key}-${chip.label}`}
              type="button"
              onClick={() => onChange(clearDashboardFilterChip(filters, chip.key))}
              className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-white px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:border-brand/30 hover:bg-brand-soft/20"
            >
              {chip.label}
              <X className="size-2.5 opacity-50" aria-hidden />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/** Compact filter toolbar row — shared with Recent Audits section. */
export function DashboardCompactFilterToolbar({
  filters,
  onChange,
  options,
}: {
  filters: DashboardFilterState;
  onChange: (next: DashboardFilterState) => void;
  options: DashboardFilterOptions;
}) {
  return <DesktopToolbar filters={filters} onChange={onChange} options={options} />;
}
