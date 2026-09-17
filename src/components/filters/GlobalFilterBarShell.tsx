import { useRouterState } from "@tanstack/react-router";
import { DashboardFilterBar } from "@/components/dashboard/DashboardFilterBar";
import {
  pathShowsGlobalFilterBarInShell,
  useOptionalGlobalFilters,
} from "@/lib/global-filters";
import { cn } from "@/lib/utils";

export function WorkspaceFilterBar({ className }: { className?: string }) {
  const ctx = useOptionalGlobalFilters();

  if (!ctx) return null;

  const { filters, setFilters, options, optionsLoading } = ctx;
  if (optionsLoading && !options) return null;

  return (
    <div className={cn("rounded-xl border border-border bg-surface p-3 shadow-soft", className)}>
      <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Workspace filters · persists across pages
      </p>
      <DashboardFilterBar
        filters={filters}
        onChange={setFilters}
        options={
          options ?? {
            stores: [],
            countries: [],
            cities: [],
            categories: [],
            subcategories: [],
            team_members: [],
            kri_options: [],
            only_self: true,
            current_user_id: null,
          }
        }
      />
    </div>
  );
}

export function GlobalFilterBarShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (!pathShowsGlobalFilterBarInShell(pathname)) return null;

  return <WorkspaceFilterBar className="mb-6" />;
}
