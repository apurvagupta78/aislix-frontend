import { CheckCircle2, CircleDashed } from "lucide-react";

import {
  roleIntroduction,
  roleTabLabel,
  type AuditRoleTab,
} from "@/lib/role-audit-ui";
import {
  autoPopulateAuditPackage,
  EMPTY_AUDIT_PACKAGE,
  type PlanogramAuditPackage,
} from "@/lib/planogram-audit-package";
import type { PlanogramRow } from "@/lib/planogram";
import { roleKpiReadiness } from "@/lib/role-planogram-requirements";
import { RoleTabSwitcher } from "@/components/scan-results/RoleTabSwitcher";
import { cn } from "@/lib/utils";

type RolePlanogramHeaderProps = {
  role: AuditRoleTab;
  onRoleChange: (role: AuditRoleTab) => void;
  rows: PlanogramRow[];
  auditPackage?: PlanogramAuditPackage;
};

export function RolePlanogramHeader({
  role,
  onRoleChange,
  rows,
  auditPackage,
}: RolePlanogramHeaderProps) {
  const pkg = autoPopulateAuditPackage(rows, auditPackage ?? EMPTY_AUDIT_PACKAGE);
  const readiness = roleKpiReadiness(role, rows, pkg);
  const readyCount = readiness.filter((r) => r.ready).length;

  return (
    <div className="space-y-4 rounded-xl border border-brand/20 bg-brand-soft/30 p-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Audit role
        </p>
        <RoleTabSwitcher value={role} onChange={onRoleChange} />
        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">{roleTabLabel(role)} audit scope: </span>
          {roleIntroduction(role)}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            KPI readiness ({readyCount}/{readiness.length})
          </p>
          <p className="text-[11px] text-muted-foreground">
            Missing optional data marks a KPI as Not configured — never fake scores.
          </p>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {readiness.map((item) => (
            <li
              key={item.kpi_id}
              className={cn(
                "flex items-start gap-2 rounded-lg border px-3 py-2 text-xs",
                item.ready
                  ? "border-success/30 bg-success/5 text-foreground"
                  : "border-border bg-background text-muted-foreground",
              )}
            >
              {item.ready ? (
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
              ) : (
                <CircleDashed className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              )}
              <span>
                <span className="font-medium">{item.label}</span>
                {!item.ready ? " — add planogram data below" : " — ready"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
