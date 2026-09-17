import type { ReactNode } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type FilterBarProps = {
  children?: ReactNode;
  className?: string;
};

/** Shared filter surface — search, selects, and toggles in one row. */
export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div className={cn("space-y-3 rounded-xl border border-line bg-white p-4 shadow-card", className)}>
      {children}
    </div>
  );
}

type FilterSearchProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export function FilterSearch({
  value,
  onChange,
  placeholder = "Search…",
  className,
}: FilterSearchProps) {
  return (
    <div className={cn("relative min-w-[200px] flex-1", className)}>
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mp-muted" />
      <Input
        aria-label={placeholder}
        className="rounded-lg border-line bg-canvas pl-9"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function FilterRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center gap-3", className)}>{children}</div>;
}
