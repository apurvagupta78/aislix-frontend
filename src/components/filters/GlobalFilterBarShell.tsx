import { useRouterState } from "@tanstack/react-router";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";
import { DashboardFilterBar } from "@/components/dashboard/DashboardFilterBar";
import { dashboardFilterChips, type DashboardFilterOptions } from "@/lib/dashboard-filters";
import {
  pathShowsGlobalFilterBarInShell,
  useOptionalGlobalFilters,
} from "@/lib/global-filters";
import { cn } from "@/lib/utils";

const EMPTY_OPTIONS: DashboardFilterOptions = {
  stores: [],
  countries: [],
  cities: [],
  categories: [],
  subcategories: [],
  team_members: [],
  kri_options: [],
  only_self: true,
  current_user_id: null,
};

export function WorkspaceFilterBar({
  className,
  embedded,
  footer,
  extended,
}: {
  className?: string;
  /** When true, renders inside a parent card (no outer border/radius). */
  embedded?: boolean;
  /** Extra controls rendered inside the filter card (e.g. completion chips). */
  footer?: ReactNode;
  /** Team and SKU search in the main row. */
  extended?: boolean;
}) {
  const ctx = useOptionalGlobalFilters();

  if (!ctx) return null;

  const { filters, setFilters, options, optionsLoading } = ctx;
  if (optionsLoading && !options) return null;

  const body = (
    <div className="p-3 md:p-4">
      <DashboardFilterBar filters={filters} onChange={setFilters} options={options ?? EMPTY_OPTIONS} extended={extended} />
      {footer ? <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">{footer}</div> : null}
    </div>
  );

  if (embedded) return <div className={className}>{body}</div>;

  return (
    <div className={cn("overflow-hidden rounded-xl border border-line bg-white", className)}>
      {body}
    </div>
  );
}

/** "Filters (n)" button; the caller decides where the expanded bar renders. */
export function WorkspaceFiltersToggle({
  open,
  onToggle,
  className,
}: {
  open: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const ctx = useOptionalGlobalFilters();

  if (!ctx) return null;
  const { filters, options, optionsLoading } = ctx;
  if (optionsLoading && !options) return null;

  const activeCount = dashboardFilterChips(filters, options ?? EMPTY_OPTIONS).length;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-lg border bg-white px-3 text-sm font-medium text-navy transition-colors hover:bg-muted",
        activeCount > 0 ? "border-navy/40" : "border-line",
        className,
      )}
    >
      <SlidersHorizontal className="size-4 text-mp-muted" aria-hidden />
      Filters{activeCount > 0 ? ` (${activeCount})` : ""}
      <ChevronDown className={cn("size-4 text-mp-muted transition-transform", open && "rotate-180")} aria-hidden />
    </button>
  );
}

/** List pages: a single "Filters" button that expands to the full filter bar. */
function CollapsedWorkspaceFilters({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={className}>
      <WorkspaceFiltersToggle open={open} onToggle={() => setOpen((v) => !v)} />
      {open ? <WorkspaceFilterBar className="mt-3" /> : null}
    </div>
  );
}

export function GlobalFilterBarShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Operations dashboard embeds filters below Ask / above Last 10 — never in AppShell top.
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return null;

  if (!pathShowsGlobalFilterBarInShell(pathname)) return null;

  return <CollapsedWorkspaceFilters className="mb-6" />;
}
