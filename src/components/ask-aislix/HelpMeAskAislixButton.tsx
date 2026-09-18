import { Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ASK_AISLIX_SECTION } from "@/lib/aislix-theme";
import { cn } from "@/lib/utils";

export function HelpMeAskAislixButton({
  onClick,
  disabled,
  variant = "light",
}: {
  onClick: () => void;
  disabled?: boolean;
  variant?: "light" | "dark";
}) {
  const isDark = variant === "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-auto rounded-full px-4 py-2 text-sm font-medium",
        isDark ? "border hover:brightness-110" : "border border-line bg-white/80 text-navy hover:bg-white",
      )}
      style={
        isDark
          ? {
              backgroundColor: ASK_AISLIX_SECTION.chipBackground,
              borderColor: ASK_AISLIX_SECTION.chipBorder,
              color: ASK_AISLIX_SECTION.chipText,
            }
          : undefined
      }
    >
      <Wand2 className="mr-2 h-4 w-4" />
      Generate Prompt
    </Button>
  );
}
