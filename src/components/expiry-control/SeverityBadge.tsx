import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  critical: "bg-status-danger-soft text-status-danger-strong border-status-danger",
  high: "bg-status-warn-soft text-status-warn-strong border-status-warn",
  medium: "bg-status-warn-soft text-status-warn-strong border-status-warn",
  low: "bg-muted text-muted-foreground",
};

export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <Badge variant="outline" className={cn("capitalize", STYLES[severity] ?? STYLES.low)}>
      {severity}
    </Badge>
  );
}

export function ClassificationBadge({ value }: { value: string }) {
  const styles: Record<string, string> = {
    sellable: "bg-status-good-soft text-status-good-strong border-status-good",
    near_expiry: "bg-status-warn-soft text-status-warn-strong border-status-warn",
    expired: "bg-status-danger-soft text-status-danger-strong border-status-danger",
    unresolved: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={cn("capitalize", styles[value] ?? styles.unresolved)}>
      {value.replace("_", " ")}
    </Badge>
  );
}
