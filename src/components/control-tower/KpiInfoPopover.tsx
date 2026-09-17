import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { KpiDefinition } from "@/lib/kpi-engine";
import type { ControlTowerKpi } from "@/lib/control-tower";
import { getKpiDefinition } from "@/lib/kpi-engine";

type Props = {
  kpi: ControlTowerKpi;
  scopeLabel?: string;
  periodLabel?: string;
};

function InfoSection({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm leading-snug">{value}</p>
    </div>
  );
}

export function KpiInfoPopover({ kpi, scopeLabel, periodLabel }: Props) {
  const def = getKpiDefinition(kpi.id);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Info about ${kpi.label}`}
        >
          <Info className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="start" onClick={(e) => e.stopPropagation()}>
        <div>
          <p className="font-semibold">{kpi.label}</p>
          {!kpi.available && def?.unavailableReason ? (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{def.unavailableReason}</p>
          ) : null}
        </div>

        {def ? (
          <>
            <InfoSection label="What it means" value={def.description} />
            <InfoSection label="Calculation" value={def.calculation} />
            <InfoSection label="Data source" value={def.dataSource} />
            {def.dataSourceRoles.length ? (
              <InfoSection
                label="Source roles"
                value={def.dataSourceRoles.map((r) => r.replaceAll("_", " ")).join(" · ")}
              />
            ) : null}
            <InfoSection label="Scope" value={scopeLabel ?? "Current dashboard filters"} />
            <InfoSection label="Time period" value={periodLabel ?? "Selected dashboard period"} />
            <InfoSection label="How to interpret" value={def.interpretation} />
            {def.whyItMatters ? (
              <InfoSection label="Why this matters" value={def.whyItMatters} />
            ) : null}
          </>
        ) : (
          <>
            <InfoSection label="Detail" value={kpi.detail} />
            {kpi.source ? <InfoSection label="Data source" value={kpi.source} /> : null}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function KpiInfoPanel({ def, scopeLabel, periodLabel }: { def: KpiDefinition; scopeLabel?: string; periodLabel?: string }) {
  return (
    <div className="space-y-3 text-sm">
      <InfoSection label="What it means" value={def.description} />
      <InfoSection label="Calculation" value={def.calculation} />
      <InfoSection label="Data source" value={def.dataSource} />
      <InfoSection label="Scope" value={scopeLabel ?? "Current filters"} />
      <InfoSection label="Time period" value={periodLabel ?? "Selected period"} />
      <InfoSection label="How to interpret" value={def.interpretation} />
    </div>
  );
}
