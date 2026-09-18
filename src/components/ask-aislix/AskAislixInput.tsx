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
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading?: boolean;
  className?: string;
}) {
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
        placeholder="Ask a question like 'Which stores have the highest inventory variance this month?'"
        disabled={loading}
        className="h-12 flex-1 rounded-xl border-line bg-white text-base"
      />
      <Button type="submit" size="lg" disabled={loading || !value.trim()} className="h-12 rounded-xl px-5">
        <Send className="mr-2 h-4 w-4" />
        Ask
      </Button>
    </form>
  );
}
