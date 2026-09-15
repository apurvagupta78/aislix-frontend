import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const VIEWS = [
  { to: "/dashboard", label: "Control Tower", exact: true },
  { to: "/dashboard/my-performance", label: "My Performance", exact: false },
  { to: "/dashboard/executive", label: "Executive View", exact: false },
] as const;

export function DashboardSubNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="mb-6 flex flex-wrap gap-1 border-b border-border pb-3">
      {VIEWS.map((view) => {
        const active = view.exact ? pathname === view.to : pathname.startsWith(view.to);
        return (
          <Link
            key={view.to}
            to={view.to}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm transition-colors",
              active
                ? "bg-brand-soft font-medium text-brand"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {view.label}
          </Link>
        );
      })}
    </div>
  );
}
