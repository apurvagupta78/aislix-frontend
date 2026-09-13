import { useMemo, useState, type ComponentType } from "react";
import { Link } from "@tanstack/react-router";
import {
  Briefcase,
  Calendar,
  Check,
  ChevronsUpDown,
  ClipboardList,
  Layers,
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
import { DASHBOARD_ROLE_OPTIONS } from "@/lib/dashboard-config";
import {
  DASHBOARD_ASSIGNMENT_OPTIONS,
  DASHBOARD_DATE_PRESETS,
  DEFAULT_DASHBOARD_FILTERS,
  clearDashboardFilterChip,
  dashboardFilterChips,
  isDefaultDashboardFilters,
  type DashboardFilterOptions,
  type DashboardFilterState,
} from "@/lib/dashboard-filters";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

function FilterSelect({
  label,
  icon: Icon,
  value,
  onValueChange,
  options,
  allLabel,
  triggerClassName,
}: {
  label: string;
  icon: ComponentType<{ className?: string }>;
  value: string;
  onValueChange: (v: string) => void;
  options: Option[];
  allLabel: string;
  triggerClassName?: string;
}) {
  const display =
    value === "all" ? allLabel : options.find((o) => o.value === value)?.label ?? value;

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        className={cn(
          "h-9 shrink-0 rounded-xl border-border/80 bg-card text-xs shadow-sm",
          triggerClassName,
        )}
        aria-label={label}
      >
        <span className="flex items-center gap-1.5 truncate">
          <Icon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{display}</span>
        </span>
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

function SearchableFilterSelect({
  label,
  icon: Icon,
  value,
  onValueChange,
  options,
  allLabel,
  triggerClassName,
}: {
  label: string;
  icon: ComponentType<{ className?: string }>;
  value: string;
  onValueChange: (v: string) => void;
  options: Option[];
  allLabel: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const searchable = options.length > 8;
  const display =
    value === "all" ? allLabel : options.find((o) => o.value === value)?.label ?? value;

  if (!searchable) {
    return (
      <FilterSelect
        label={label}
        icon={Icon}
        value={value}
        onValueChange={onValueChange}
        options={options}
        allLabel={allLabel}
        triggerClassName={triggerClassName}
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
          className={cn(
            "h-9 shrink-0 justify-between rounded-xl border-border/80 bg-card px-3 text-xs font-normal shadow-sm hover:bg-card",
            triggerClassName,
          )}
        >
          <span className="flex min-w-0 items-center gap-1.5 truncate">
            <Icon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{display}</span>
          </span>
          <ChevronsUpDown className="ml-1 size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${label.toLowerCase()}…`} />
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
                <Check className={cn("mr-2 size-4", value === "all" ? "opacity-100" : "opacity-0")} />
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
                    className={cn(
                      "mr-2 size-4",
                      value === o.value ? "opacity-100" : "opacity-0",
                    )}
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

function SecondaryFilterControls({
  filters,
  onChange,
  options,
  layout = "row",
}: {
  filters: DashboardFilterState;
  onChange: (next: DashboardFilterState) => void;
  options: DashboardFilterOptions;
  layout?: "row" | "stack";
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

  const wrap = layout === "stack" ? "flex flex-col gap-3" : "flex flex-wrap items-center gap-2";

  return (
    <div className={wrap}>
      <SearchableFilterSelect
        label="Sub-category"
        icon={Layers}
        value={filters.subCategory}
        onValueChange={(v) => onChange({ ...filters, subCategory: v })}
        options={subCategoryOptions}
        allLabel="All sub-categories"
        triggerClassName="min-w-[140px] max-w-[190px]"
      />
      {options.only_self && options.team_members.length <= 1 ? (
        <div className="flex h-9 shrink-0 items-center gap-2 rounded-xl border border-border/80 bg-muted/30 px-3 text-xs text-muted-foreground shadow-sm">
          <Users className="size-3.5 shrink-0" />
          <span>Only you</span>
          <Link to="/settings" className="font-medium text-brand hover:underline">
            Invite teammates →
          </Link>
        </div>
      ) : (
        <SearchableFilterSelect
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
          triggerClassName="min-w-[148px] max-w-[190px]"
        />
      )}
      <FilterSelect
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
        triggerClassName="min-w-[148px]"
      />
    </div>
  );
}

function PrimaryFilterControls({
  filters,
  onChange,
  options,
  layout = "row",
}: {
  filters: DashboardFilterState;
  onChange: (next: DashboardFilterState) => void;
  options: DashboardFilterOptions;
  layout?: "row" | "stack";
}) {
  const storeOptions = useMemo(
    () => options.stores.map((s) => ({ value: s.id, label: s.name })),
    [options.stores],
  );
  const categoryOptions = useMemo(
    () => options.categories.map((c) => ({ value: c, label: c })),
    [options.categories],
  );

  const wrap = layout === "stack" ? "flex flex-col gap-3" : "flex flex-wrap items-center gap-2";

  return (
    <div className={wrap}>
      <div className={layout === "stack" ? "space-y-1.5" : undefined}>
        {layout === "stack" ? (
          <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
            Date
          </p>
        ) : null}
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
          <SelectTrigger className="h-9 w-full min-w-[148px] shrink-0 rounded-xl border-border/80 bg-card text-xs shadow-sm sm:w-[148px]">
            <span className="flex items-center gap-1.5 truncate">
              <Calendar className="size-3.5 shrink-0 text-muted-foreground" />
              <SelectValue placeholder="Date" />
            </span>
          </SelectTrigger>
          <SelectContent>
            {DASHBOARD_DATE_PRESETS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filters.datePreset === "custom" ? (
          <div className={cn("flex gap-2", layout === "stack" ? "mt-2" : "mt-2 w-full basis-full")}>
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
              className="h-9 rounded-xl text-xs"
              aria-label="From date"
            />
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
              className="h-9 rounded-xl text-xs"
              aria-label="To date"
            />
          </div>
        ) : null}
      </div>

      <FilterSelect
        label="Role"
        icon={Briefcase}
        value={filters.role}
        onValueChange={(v) =>
          onChange({
            ...filters,
            role: v as DashboardFilterState["role"],
            storeId: "all",
            category: "all",
            subCategory: "all",
            teamMemberId: "all",
          })
        }
        options={DASHBOARD_ROLE_OPTIONS.filter((o) => o.value !== "all").map((o) => ({
          value: o.value,
          label: o.label,
        }))}
        allLabel="All roles"
        triggerClassName="min-w-[132px]"
      />

      <SearchableFilterSelect
        label="Store"
        icon={Store}
        value={filters.storeId}
        onValueChange={(v) => onChange({ ...filters, storeId: v })}
        options={storeOptions}
        allLabel="All stores"
        triggerClassName="min-w-[132px] max-w-[180px]"
      />

      <SearchableFilterSelect
        label="Category"
        icon={Tag}
        value={filters.category}
        onValueChange={(v) => onChange({ ...filters, category: v, subCategory: "all" })}
        options={categoryOptions}
        allLabel="All categories"
        triggerClassName="min-w-[132px] max-w-[180px]"
      />

    </div>
  );
}

function FilterControls({
  filters,
  onChange,
  options,
  layout = "row",
}: {
  filters: DashboardFilterState;
  onChange: (next: DashboardFilterState) => void;
  options: DashboardFilterOptions;
  layout?: "row" | "stack";
}) {
  return (
    <>
      <PrimaryFilterControls filters={filters} onChange={onChange} options={options} layout={layout} />
      <SecondaryFilterControls filters={filters} onChange={onChange} options={options} layout={layout} />
    </>
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const activeMoreCount =
    (filters.subCategory !== "all" ? 1 : 0) +
    (filters.teamMemberId !== "all" ? 1 : 0) +
    (filters.auditAssignment !== "all" ? 1 : 0);

  return (
    <section className="space-y-3" aria-label="Dashboard filters">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Filter your view
      </p>

      <div className="hidden md:block">
        <div className="rounded-xl border border-border/70 bg-card/80 p-3 shadow-sm">
          <div className="-mx-1 flex flex-wrap items-center gap-2 overflow-x-auto px-1">
            <PrimaryFilterControls filters={filters} onChange={onChange} options={options} layout="row" />
            <Popover open={moreOpen} onOpenChange={setMoreOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 shrink-0 rounded-xl border-border/80 bg-background text-xs font-normal"
                >
                  More filters
                  {activeMoreCount > 0 ? (
                    <span className="ml-1.5 rounded-full bg-brand px-1.5 py-0.5 text-[0.65rem] font-semibold text-brand-foreground">
                      {activeMoreCount}
                    </span>
                  ) : null}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto max-w-[90vw] p-3" align="start">
                <SecondaryFilterControls
                  filters={filters}
                  onChange={onChange}
                  options={options}
                  layout="row"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      <div className="md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 rounded-xl text-xs">
              <SlidersHorizontal className="mr-1.5 size-3.5" />
              Filters ({chips.length + activeMoreCount})
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
            <SheetHeader>
              <SheetTitle className="text-left text-base">Filter dashboard</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <FilterControls
                filters={filters}
                onChange={onChange}
                options={options}
                layout="stack"
              />
            </div>
            <div className="mt-6 flex gap-2">
              <Button
                type="button"
                variant="subtle"
                className="flex-1 rounded-xl"
                onClick={() => onChange({ ...DEFAULT_DASHBOARD_FILTERS })}
              >
                Clear filters
              </Button>
              <Button
                type="button"
                variant="brand"
                className="flex-1 rounded-xl"
                onClick={() => setMobileOpen(false)}
              >
                Apply
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {summaryLabel ? (
        <p className="text-xs text-muted-foreground">{summaryLabel}</p>
      ) : null}

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <button
              key={`${chip.key}-${chip.label}`}
              type="button"
              onClick={() => onChange(clearDashboardFilterChip(filters, chip.key))}
              className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-brand-soft/50 px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-brand-soft"
            >
              {chip.label}
              <X className="size-3 opacity-60" aria-hidden />
              <span className="sr-only">Remove {chip.label} filter</span>
            </button>
          ))}
          {!isDefaultDashboardFilters(filters) ? (
            <button
              type="button"
              onClick={() => onChange({ ...DEFAULT_DASHBOARD_FILTERS })}
              className="text-xs font-medium text-brand hover:underline"
            >
              Clear all
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
