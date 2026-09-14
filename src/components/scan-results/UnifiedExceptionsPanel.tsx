import { useMemo, useState } from "react";
import { AlertTriangle, Filter, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResultSection } from "@/components/scan-results/ResultParts";
import type { PlanogramComparison } from "@/lib/planogram-compliance";
import type { ResultViewMode } from "@/lib/customer-context";
import {
  buildUnifiedExceptions,
  exceptionCategoryLabel,
  exceptionCountsByCategory,
  filterExceptions,
  type ExceptionCategory,
  type UnifiedException,
} from "@/lib/unified-exceptions";
import type { ScanResult } from "@/lib/scan-results";
import { cn } from "@/lib/utils";

const SEVERITY_CLASS: Record<UnifiedException["severity"], string> = {
  critical: "border-destructive/30 bg-destructive/10 text-destructive",
  high: "border-warning/30 bg-warning/10 text-warning",
  medium: "border-brand/20 bg-brand-soft/40 text-brand",
  low: "border-border bg-muted text-muted-foreground",
};

const CATEGORIES: Array<ExceptionCategory | "all"> = [
  "all",
  "planogram",
  "availability",
  "placement",
  "pricing",
  "review",
  "compliance",
  "action",
  "opportunity",
];

export function UnifiedExceptionsPanel({
  data,
  comparison,
  view,
  loading,
}: {
  data?: ScanResult | null;
  comparison?: PlanogramComparison | null;
  view?: ResultViewMode;
  loading?: boolean;
}) {
  const [category, setCategory] = useState<ExceptionCategory | "all">("all");
  const [severity, setSeverity] = useState<UnifiedException["severity"] | "all">("all");
  const [query, setQuery] = useState("");

  const all = useMemo(
    () => buildUnifiedExceptions(data, comparison, view),
    [data, comparison, view],
  );
  const filtered = useMemo(
    () => filterExceptions(all, { category, severity, query }),
    [all, category, severity, query],
  );
  const counts = useMemo(() => exceptionCountsByCategory(all), [all]);

  if (loading) {
    return (
      <ResultSection title="Exceptions dashboard" description="Loading audit exceptions…">
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
      </ResultSection>
    );
  }

  return (
    <ResultSection
      title="Exceptions dashboard"
      description="All planogram, availability, pricing, compliance, and AI review issues in one place."
      actions={
        all.length > 0 ? (
          <Badge variant="outline" className="rounded-full border-brand/25 bg-brand-soft/50 text-brand">
            <AlertTriangle className="size-3.5" /> {all.length} open
          </Badge>
        ) : null
      }
    >
      <div className="flex flex-wrap gap-2">
        {Object.entries(counts).map(([key, count]) => (
          <Badge key={key} variant="secondary" className="rounded-full capitalize">
            {exceptionCategoryLabel(key as ExceptionCategory)} · {count}
          </Badge>
        ))}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="rounded-xl pl-9"
            placeholder="Search exceptions…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select value={category} onValueChange={(v) => setCategory(v as ExceptionCategory | "all")}>
          <SelectTrigger className="w-full rounded-xl sm:w-44">
            <Filter className="mr-2 size-4 shrink-0" />
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c === "all" ? "All categories" : exceptionCategoryLabel(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={severity} onValueChange={(v) => setSeverity(v as UnifiedException["severity"] | "all")}>
          <SelectTrigger className="w-full rounded-xl sm:w-36">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            {(["all", "critical", "high", "medium", "low"] as const).map((s) => (
              <SelectItem key={s} value={s}>
                {s === "all" ? "All severities" : s.charAt(0).toUpperCase() + s.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-4 rounded-xl border border-border bg-surface px-4 py-8 text-center text-sm text-muted-foreground">
          {all.length === 0
            ? "No exceptions detected on this audit."
            : "No exceptions match your filters."}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-brand text-xs uppercase tracking-wide text-brand-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Severity</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 font-medium">Issue</th>
                <th className="px-3 py-2 font-medium">Expected</th>
                <th className="px-3 py-2 font-medium">Actual</th>
                <th className="px-3 py-2 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <Badge variant="outline" className={cn("rounded-full capitalize", SEVERITY_CLASS[row.severity])}>
                      {row.severity}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 capitalize text-muted-foreground">
                    {exceptionCategoryLabel(row.category)}
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium text-foreground">{row.title}</p>
                    {row.detail ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{row.detail}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{row.expected ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.actual ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{row.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ResultSection>
  );
}
