import {
  HOMEPAGE_ROLE_OPTIONS,
  HOMEPAGE_ROLE_STEP,
} from "@/lib/planogram-wizard-homepage-role-flow";
import { roleTabLabel, type AuditRoleTab } from "@/lib/role-audit-ui";
import { cn } from "@/lib/utils";

export function HomepageRolePicker({
  value,
  onChange,
  compact = false,
}: {
  value: AuditRoleTab;
  onChange: (role: AuditRoleTab) => void;
  compact?: boolean;
}) {
  return (
    <div className="space-y-4">
      {!compact ? (
        <>
          <p className="text-base font-semibold text-foreground">{HOMEPAGE_ROLE_STEP.heading}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {HOMEPAGE_ROLE_STEP.description}
          </p>
        </>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {HOMEPAGE_ROLE_OPTIONS.map((option) => {
          const selected = value === option.role;
          return (
            <button
              key={option.role}
              type="button"
              onClick={() => onChange(option.role)}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors",
                selected
                  ? "border-brand bg-brand-soft/50 shadow-sm"
                  : "border-border bg-card hover:border-brand/30",
              )}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
                {roleTabLabel(option.role).toUpperCase()}
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                {option.description}
              </p>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">{HOMEPAGE_ROLE_STEP.helper}</p>
    </div>
  );
}
