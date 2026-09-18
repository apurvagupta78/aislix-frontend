import { Button } from "@/components/ui/button";

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
}: {
  onSelect: (question: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {ASK_AISLIX_SUGGESTIONS.map((suggestion) => (
        <Button
          key={suggestion}
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="rounded-full border-line bg-white text-xs md:text-sm"
          onClick={() => onSelect(suggestion)}
        >
          {suggestion}
        </Button>
      ))}
    </div>
  );
}
