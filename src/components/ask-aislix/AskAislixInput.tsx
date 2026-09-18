import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      className={cn("flex gap-2", className)}
      onSubmit={(e) => {
        e.preventDefault();
        if (!loading && value.trim()) onSubmit();
      }}
    >
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="What needs attention today?"
        disabled={loading}
        className={cn(
          "h-12 flex-1 rounded-xl text-base",
          isDark
            ? "border-[#536277]/50 text-navy placeholder:text-mp-muted focus-visible:ring-[#536277]/40"
            : "border-line bg-white",
        )}
        style={isDark ? { backgroundColor: ASK_AISLIX_SECTION.inputBackground } : undefined}
      />
      <Button
        type="submit"
        size="lg"
        disabled={loading || !value.trim()}
        className={cn("h-12 rounded-xl px-5", isDark && "hover:brightness-110")}
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
