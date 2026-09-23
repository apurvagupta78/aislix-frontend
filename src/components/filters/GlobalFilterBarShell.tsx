import { useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { DashboardFilterBar } from "@/components/dashboard/DashboardFilterBar";
import {
  pathShowsGlobalFilterBarInShell,
  useOptionalGlobalFilters,
} from "@/lib/global-filters";
import { cn } from "@/lib/utils";

export function WorkspaceFilterBar({
  className,
  embedded,
  footer,
}: {
  className?: string;
  /** When true, renders inside a parent card (no outer border/radius). */
  embedded?: boolean;
  /** Extra controls rendered inside the filter card (e.g. completion chips). */
  footer?: ReactNode;
}) {
  const ctx = useOptionalGlobalFilters();

  if (!ctx) return null;

  const { filters, setFilters, options, optionsLoading } = ctx;
  if (optionsLoading && !options) return null;

  const body = (
    <>
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
        {footer ? <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">{footer}</div> : null}
      </div>
    </>
  );

  if (embedded) return <div className={className}>{body}</div>;

  return (
    <div className={cn("overflow-hidden rounded-xl border border-line bg-white shadow-card", className)}>
      {body}
    </div>
  );
}

export function GlobalFilterBarShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Operations dashboard embeds filters below Ask / above Last 10 — never in AppShell top.
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return null;

  if (!pathShowsGlobalFilterBarInShell(pathname)) return null;

  return <WorkspaceFilterBar className="mb-6" />;
}
