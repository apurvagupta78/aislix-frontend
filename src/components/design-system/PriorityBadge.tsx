import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type PriorityLevel = "high" | "medium" | "low";

const meta: Record<PriorityLevel, { label: string; className: string; Icon: typeof ArrowUp }> = {
  high: {
    label: "Fix first",
    className: "bg-status-danger-soft text-status-danger-strong",
    Icon: ArrowUp,
  },
  medium: {
    label: "Fix soon",
    className: "bg-status-warn-soft text-status-warn-strong",
    Icon: Minus,
  },
  low: { label: "Can wait", className: "bg-muted text-muted-foreground", Icon: ArrowDown },
};

type Props = {
  level: PriorityLevel;
  className?: string;
};

export function PriorityBadge({ level, className }: Props) {
  const item = meta[level];
  const Icon = item.Icon;
  return (
    <Badge
      role="status"
      variant="secondary"
      className={cn(
        "gap-1.5 rounded-full border-0 px-2.5 py-1 text-xs font-semibold",
        item.className,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {item.label}
    </Badge>
  );
}
