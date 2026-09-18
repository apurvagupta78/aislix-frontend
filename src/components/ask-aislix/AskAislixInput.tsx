import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ASK_AISLIX_SECTION } from "@/lib/aislix-theme";
import { cn } from "@/lib/utils";

export function AskAislixInput({
  value,
  onChange,
  onSubmit,
  loading,
  className,
  variant = "light",
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading?: boolean;
  className?: string;
  variant?: "light" | "dark";
}) {
  const isDark = variant === "dark";

  return (
    <form
      className={cn("flex flex-col gap-2 sm:flex-row sm:items-start", className)}
      onSubmit={(e) => {
        e.preventDefault();
        if (!loading && value.trim()) onSubmit();
      }}
    >
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="What needs attention today?"
        disabled={loading}
        rows={3}
        className={cn(
          "min-h-[96px] w-full flex-1 resize-y rounded-xl text-base leading-relaxed",
          isDark
            ? "border-[#536277]/50 text-navy placeholder:text-mp-muted focus-visible:ring-[#536277]/40"
            : "border-line bg-white",
        )}
        style={isDark ? { backgroundColor: ASK_AISLIX_SECTION.inputBackground } : undefined}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (!loading && value.trim()) onSubmit();
          }
        }}
      />
      <Button
        type="submit"
        size="lg"
        disabled={loading || !value.trim()}
        className={cn("h-12 shrink-0 rounded-xl px-5 sm:self-start", isDark && "hover:brightness-110")}
        style={
          isDark
            ? {
                backgroundColor: ASK_AISLIX_SECTION.askButton,
                color: ASK_AISLIX_SECTION.heading,
              }
            : undefined
        }
      >
        <Send className="mr-2 h-4 w-4" />
        Ask
      </Button>
    </form>
  );
}
