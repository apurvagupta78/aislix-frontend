import { Loader2 } from "lucide-react";

import { ASK_AISLIX_SECTION } from "@/lib/aislix-theme";
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
        isDark ? "" : "border-line bg-white",
      )}
      style={
        isDark
          ? {
              backgroundColor: ASK_AISLIX_SECTION.chipBackground,
              borderColor: ASK_AISLIX_SECTION.chipBorder,
            }
          : undefined
      }
    >
      <Loader2
        className={cn("h-5 w-5 animate-spin", !isDark && "text-primary")}
        style={isDark ? { color: ASK_AISLIX_SECTION.heading } : undefined}
      />
      <div>
        <p
          className={cn("text-sm font-medium", !isDark && "text-navy")}
          style={isDark ? { color: ASK_AISLIX_SECTION.heading } : undefined}
        >
          Analyzing your audits...
        </p>
        {phase ? (
          <p
            className={cn("text-xs", !isDark && "text-mp-muted")}
            style={isDark ? { color: ASK_AISLIX_SECTION.subtitle } : undefined}
          >
            {phase}
          </p>
        ) : null}
      </div>
    </div>
  );
}
