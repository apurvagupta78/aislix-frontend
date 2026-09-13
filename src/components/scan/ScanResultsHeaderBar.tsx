import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DEMO_PLANOGRAM_LABEL } from "@/lib/demo-oral-care-planogram";

type ScanResultsHeaderBarProps = {
  timestamp?: string | null;
  showDemoPlanogramBadge?: boolean;
  assignmentId?: string | null;
  extra?: ReactNode;
};

export function ScanResultsHeaderBar({
  timestamp,
  showDemoPlanogramBadge = false,
  assignmentId,
  extra,
}: ScanResultsHeaderBarProps) {
  return (
    <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
      <Badge className="gap-1.5 rounded-md bg-brand text-brand-foreground">
        <Sparkles className="size-3" /> Live AI analysis
      </Badge>
      {showDemoPlanogramBadge ? (
        <Badge variant="outline" className="text-[10px]">
          {DEMO_PLANOGRAM_LABEL}
        </Badge>
      ) : null}
      {timestamp ? (
        <span className="text-[11px] text-muted-foreground">
          {new Date(timestamp).toLocaleString()}
        </span>
      ) : null}
      {assignmentId ? (
        <Badge variant="outline" className="rounded-md font-mono text-xs">
          Assignment
        </Badge>
      ) : null}
      {extra}
    </div>
  );
}
