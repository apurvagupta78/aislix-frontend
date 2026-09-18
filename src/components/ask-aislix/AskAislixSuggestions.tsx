import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const ASK_AISLIX_SUGGESTIONS = [
  "What needs attention today?",
  "Show overdue actions",
  "Which stores are at risk?",
  "Why did audit completion drop?",
  "Show expiry risks",
  "Compare this month vs last month",
] as const;

export function AskAislixSuggestions({
  onSelect,
  disabled,
  variant = "light",
}: {
  onSelect: (question: string) => void;
  disabled?: boolean;
  variant?: "light" | "dark";
}) {
  const isDark = variant === "dark";

  return (
    <div className="flex flex-wrap gap-2">
      {ASK_AISLIX_SUGGESTIONS.map((suggestion) => (
        <Button
          key={suggestion}
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn(
            "rounded-full text-xs md:text-sm",
            isDark
              ? "border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              : "border-line bg-white",
          )}
          onClick={() => onSelect(suggestion)}
        >
          {suggestion}
        </Button>
      ))}
    </div>
  );
}
