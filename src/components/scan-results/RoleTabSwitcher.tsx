import {
  AUDIT_ROLE_TABS,
  ROLE_TAB_THEME,
  roleTabLabel,
  type AuditRoleTab,
} from "@/lib/role-audit-ui";
import { cn } from "@/lib/utils";

export function RoleTabSwitcher({
  value,
  onChange,
}: {
  value: AuditRoleTab;
  onChange: (role: AuditRoleTab) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Audit role">
      {AUDIT_ROLE_TABS.map((role) => {
        const theme = ROLE_TAB_THEME[role];
        const active = value === role;
        return (
          <button
            key={role}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-medium transition-colors sm:px-3.5 sm:py-2 sm:text-sm",
              active ? theme.tabActive : theme.tabInactive,
            )}
            onClick={() => onChange(role)}
          >
            {roleTabLabel(role)}
          </button>
        );
      })}
    </div>
  );
}
