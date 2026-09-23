import { Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AISLIX, ASK_AISLIX_SECTION } from "@/lib/aislix-theme";
import { cn } from "@/lib/utils";

export function HelpMeAskAislixButton({
  onClick,
  disabled,
  variant: _variant = "light",
}: {
  onClick: () => void;
  disabled?: boolean;
  variant?: "light" | "dark";
}) {
  void _variant;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={disabled}
      onClick={onClick}
      className={cn("h-auto rounded-full border px-4 py-2 text-sm font-medium hover:brightness-105")}
      style={{
        backgroundColor: AISLIX.warehouseBg,
        borderColor: AISLIX.warehouseBorder,
        color: ASK_AISLIX_SECTION.chipText,
      }}
    >
      <Wand2 className="mr-2 h-4 w-4" />
      Generate Prompt
    </Button>
  );
}
