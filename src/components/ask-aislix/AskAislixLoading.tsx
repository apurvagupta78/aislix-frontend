import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export function AskAislixLoading({
  phase,
  variant = "light",
}: {
  phase?: string;
  variant?: "light" | "dark";
}) {
  const isDark = variant === "dark";

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-5 shadow-card",
        isDark ? "border-white/15 bg-white/10" : "border-line bg-white",
      )}
    >
      <Loader2 className={cn("h-5 w-5 animate-spin", isDark ? "text-white" : "text-primary")} />
      <div>
        <p className={cn("text-sm font-medium", isDark ? "text-white" : "text-navy")}>
          Analyzing your audits...
        </p>
        {phase ? (
          <p className={cn("text-xs", isDark ? "text-white/70" : "text-mp-muted")}>{phase}</p>
        ) : null}
      </div>
    </div>
  );
}
