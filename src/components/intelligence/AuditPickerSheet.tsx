import { useMemo, useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { FilterSearch } from "@/components/design-system";
import { ErrorState, Skeleton } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type AuditOption = {
  id: string;
  code: string;
  created_at: string;
  mode: "ai" | "digital";
  name: string;
  description: string | null;
  store: string;
};

type ModeFilter = "all" | "ai" | "digital";

export function formatAuditDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function ModePill({ mode }: { mode: "ai" | "digital" }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#D9E2E8] px-2 py-0.5 text-[11px] text-[#667085]">
      <span
        aria-hidden
        className="size-1.5 rounded-full"
        style={{ background: mode === "digital" ? "#7DB7D6" : "#9B86D9" }}
      />
      {mode === "digital" ? "Digital" : "AI"}
    </span>
  );
}

export function AuditIdButton({ id, code }: { id: string; code: string }) {
  const copy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(id);
      toast.success("Audit ID copied");
    } catch {
      toast.error("Could not copy the audit ID.");
    }
  };
  return (
    <button
      type="button"
      onClick={(e) => void copy(e)}
      title={`Copy full audit ID (${id})`}
      aria-label={`Copy audit ID ${code}`}
      className="inline-flex items-center gap-1 rounded-md px-1 font-mono text-[11px] text-[#667085] transition-colors duration-150 hover:bg-[#F4F7F9] hover:text-[#04203F]"
    >
      {code}
      <Copy className="size-3" />
    </button>
  );
}

export function AuditPickerSheet({
  open,
  onOpenChange,
  options,
  loading,
  error,
  onRetry,
  selected,
  max,
  onToggle,
  onClear,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: AuditOption[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  selected: string[];
  max: number;
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<ModeFilter>("all");
  const full = selected.length >= max;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return options.filter((a) => {
      if (mode !== "all" && a.mode !== mode) return false;
      if (!q) return true;
      return [a.name, a.description, a.store, a.code, a.id, formatAuditDate(a.created_at)].some((v) =>
        v?.toLowerCase().includes(q),
      );
    });
  }, [options, search, mode]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-[#D9E2E8] px-5 pb-4 pt-5 text-left">
          <SheetTitle className="text-base text-[#04203F]">Select audits</SheetTitle>
          <SheetDescription className="text-[#667085]">
            Completed AI and Digital audits you can see. Pick up to {max}.
          </SheetDescription>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <FilterSearch value={search} onChange={setSearch} placeholder="Search name, store, ID or date" />
            <div className="flex rounded-lg border border-[#D9E2E8] p-0.5 text-xs" role="group" aria-label="Audit type">
              {(
                [
                  ["all", "All"],
                  ["ai", "AI"],
                  ["digital", "Digital"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  aria-pressed={mode === value}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 transition-colors duration-150",
                    mode === value ? "bg-[#F4F7F9] font-medium text-[#04203F]" : "text-[#667085] hover:text-[#04203F]",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-4">
              <ErrorState onRetry={onRetry} />
            </div>
          ) : !visible.length ? (
            <p className="px-5 py-10 text-center text-sm text-[#667085]">
              {options.length ? "No audits match your search." : "No completed audits yet. Run an audit first."}
            </p>
          ) : (
            <ul className="divide-y divide-[#EEF1F4]">
              {visible.map((a) => {
                const checked = selected.includes(a.id);
                const disabled = !checked && full;
                return (
                  <li key={a.id}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-3 px-5 py-3 transition-colors duration-150 hover:bg-[#F4F7F9]",
                        checked && "bg-[#F4F7F9]",
                        disabled && "cursor-not-allowed opacity-60",
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={() => onToggle(a.id)}
                        className="mt-0.5"
                        aria-label={`Select ${a.name}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="line-clamp-1 text-sm font-medium text-[#04203F]">{a.name}</span>
                          <ModePill mode={a.mode} />
                        </span>
                        {a.description ? (
                          <span className="mt-0.5 line-clamp-2 block text-xs text-[#667085]">{a.description}</span>
                        ) : null}
                        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#667085]">
                          <AuditIdButton id={a.id} code={a.code} />
                          <span aria-hidden>·</span>
                          <span>{formatAuditDate(a.created_at)}</span>
                          {a.name.startsWith(a.store) ? null : (
                            <>
                              <span aria-hidden>·</span>
                              <span className="truncate">{a.store}</span>
                            </>
                          )}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[#D9E2E8] px-5 py-3">
          <span className={cn("text-sm tabular-nums", full ? "font-medium text-[#04203F]" : "text-[#667085]")}>
            {selected.length} of {max} selected
          </span>
          <div className="flex gap-2">
            {selected.length ? (
              <Button variant="outline" size="sm" className="rounded-xl" onClick={onClear}>
                Clear
              </Button>
            ) : null}
            <Button variant="brand" size="sm" className="rounded-xl" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
