import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
            ? "border-white/20 bg-white text-navy placeholder:text-mp-muted focus-visible:ring-white/30"
            : "border-line bg-white",
        )}
      />
      <Button
        type="submit"
        size="lg"
        disabled={loading || !value.trim()}
        className={cn(
          "h-12 rounded-xl px-5",
          isDark && "bg-white text-navy hover:bg-white/90",
        )}
      >
        <Send className="mr-2 h-4 w-4" />
        Ask
      </Button>
    </form>
  );
}
