import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-amber-100 text-amber-900 border-amber-200",
  medium: "bg-amber-50 text-amber-800 border-amber-100",
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
    sellable: "bg-emerald-100 text-emerald-800 border-emerald-200",
    near_expiry: "bg-amber-100 text-amber-900 border-amber-200",
    expired: "bg-red-100 text-red-800 border-red-200",
    unresolved: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return (
    <Badge variant="outline" className={cn("capitalize", styles[value] ?? styles.unresolved)}>
      {value.replace("_", " ")}
    </Badge>
  );
}
