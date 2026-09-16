import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  to: string;
  search?: Record<string, unknown>;
  label?: string;
  className?: string;
};

export function ViewAllLink({ to, search, label = "View all", className }: Props) {
  return (
    <Link
      to={to}
      search={search}
      className={cn(
        "inline-flex items-center gap-1 text-sm font-medium text-brand transition-colors hover:text-brand/80",
        className,
      )}
    >
      {label}
      <ArrowRight className="size-3.5" />
    </Link>
  );
}
