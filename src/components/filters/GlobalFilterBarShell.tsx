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
    <div className={cn("overflow-hidden rounded-xl border border-line bg-white shadow-card", className)}>
      <div className="border-b border-line px-4 py-3 md:px-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-mp-muted">
          Workspace filters · persists across pages
        </p>
      </div>
      <div className="p-3 md:p-4">
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
    </div>
  );
}

export function GlobalFilterBarShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (!pathShowsGlobalFilterBarInShell(pathname)) return null;

  return <WorkspaceFilterBar className="mb-6" />;
}
