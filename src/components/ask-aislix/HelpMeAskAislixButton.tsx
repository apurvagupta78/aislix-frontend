import { Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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
        isDark
          ? "border border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white"
          : "border border-line bg-white/80 text-navy hover:bg-white",
      )}
    >
      <Wand2 className="mr-2 h-4 w-4" />
      Help me ask Aislix
    </Button>
  );
}
