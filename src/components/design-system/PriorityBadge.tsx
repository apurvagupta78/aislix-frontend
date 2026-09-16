import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type PriorityLevel = "high" | "medium" | "low";

const meta: Record<PriorityLevel, { label: string; className: string; Icon: typeof ArrowUp }> = {
  high: { label: "High", className: "bg-red-50 text-red-800", Icon: ArrowUp },
  medium: { label: "Medium", className: "bg-amber-50 text-amber-900", Icon: Minus },
  low: { label: "Low", className: "bg-slate-100 text-slate-600", Icon: ArrowDown },
};

type Props = {
  level: PriorityLevel;
  className?: string;
};

export function PriorityBadge({ level, className }: Props) {
  const item = meta[level];
  const Icon = item.Icon;
  return (
    <Badge variant="secondary" className={cn("gap-1 rounded-full border-0 font-medium", item.className, className)}>
      <Icon className="size-3" aria-hidden />
      {item.label}
    </Badge>
  );
}
