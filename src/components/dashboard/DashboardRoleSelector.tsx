import { Package, ShoppingCart, Store, Truck, Warehouse } from "lucide-react";

import { HOMEPAGE_ROLE_OPTIONS } from "@/lib/planogram-wizard-homepage-role-flow";
import { dashboardRoleContext } from "@/lib/dashboard-role-context";
import type { AuditRoleTab } from "@/lib/role-audit-ui";
import { roleTabLabel } from "@/lib/role-audit-ui";
import { cn } from "@/lib/utils";

const ROLE_ICONS: Record<AuditRoleTab, typeof Store> = {
  supermarket: ShoppingCart,
  darkstore: Warehouse,
  fmcg: Package,
  distributor: Truck,
  local: Store,
};

const ROLE_DESCRIPTIONS = Object.fromEntries(
  HOMEPAGE_ROLE_OPTIONS.map((option) => [option.role, option.description]),
) as Record<AuditRoleTab, string>;

export function DashboardRoleSelector({
  value,
  onChange,
}: {
  value: AuditRoleTab;
  onChange: (role: AuditRoleTab) => void;
}) {
  const context = dashboardRoleContext(value);

  return (
    <section className="mb-5 space-y-3" aria-label="View as role">
      <div>
        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          View as
        </p>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Your role controls the metrics, insights and workflows shown in this dashboard.
        </p>
      </div>

      <div className="-mx-1 overflow-x-auto px-1 pb-0.5">
        <div className="flex min-w-max gap-2 sm:min-w-0 sm:flex-wrap">
          {HOMEPAGE_ROLE_OPTIONS.map((option) => {
            const selected = value === option.role;
            const Icon = ROLE_ICONS[option.role];
            return (
              <button
                key={option.role}
                type="button"
                onClick={() => onChange(option.role)}
                aria-pressed={selected}
                className={cn(
                  "min-w-[148px] max-w-[180px] shrink-0 rounded-xl border px-3 py-2.5 text-left transition-all sm:min-w-0 sm:flex-1 sm:basis-[calc(20%-0.5rem)]",
                  selected
                    ? "border-brand bg-brand text-brand-foreground shadow-sm"
                    : "border-border/60 bg-white text-foreground shadow-none hover:border-brand/25 hover:bg-muted/20",
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon
                    className={cn(
                      "size-3.5 shrink-0",
                      selected ? "text-brand-foreground/90" : "text-muted-foreground",
                    )}
                  />
                  <span className="text-xs font-semibold tracking-tight">
                    {roleTabLabel(option.role)}
                  </span>
                </div>
                <p
                  className={cn(
                    "mt-1 line-clamp-2 text-[10px] leading-relaxed",
                    selected ? "text-brand-foreground/80" : "text-muted-foreground",
                  )}
                >
                  {ROLE_DESCRIPTIONS[option.role]}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-muted/10 px-3 py-2.5">
        <p className="text-xs font-medium text-foreground">{context.positioning}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
          {context.supporting}
        </p>
      </div>
    </section>
  );
}
