import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Bot,
  ClipboardList,
  CloudOff,
  Loader2,
  Smartphone,
} from "lucide-react";

export type CollectionMethod = "digital" | "ai" | "hybrid" | "ai_assisted";

export function CollectionMethodBadge({
  mode,
  className,
}: {
  mode: CollectionMethod | string | null | undefined;
  className?: string;
}) {
  const m = mode ?? "ai";
  const config: Record<string, { label: string; icon: typeof Bot; className: string }> = {
    digital: {
      label: "Digital Audit",
      icon: ClipboardList,
      className: "bg-brand-soft text-brand border-brand/20",
    },
    ai: {
      label: "AI Audit",
      icon: Bot,
      className: "bg-status-ai-soft text-status-ai-strong border-status-ai/25",
    },
    ai_assisted: {
      label: "AI-Assisted",
      icon: Bot,
      className: "bg-status-warn-soft text-status-warn-strong border-status-warn/25",
    },
    hybrid: {
      label: "Hybrid",
      icon: Smartphone,
      className: "bg-surface text-foreground",
    },
  };
  const c = config[m] ?? config.ai!;
  const Icon = c.icon;
  return (
    <Badge variant="outline" className={cn("gap-1 rounded-full border font-medium", c.className, className)}>
      <Icon className="size-3" aria-hidden />
      {c.label}
    </Badge>
  );
}

export function WorkflowBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const label = status.replace(/_/g, " ");
  const tone =
    status === "approved" || status === "completed"
      ? "bg-accent-green/12 text-accent-green"
      : status === "pending_review" || status === "submitted"
        ? "bg-brand-soft text-brand"
        : status === "rejected" || status === "needs_correction"
          ? "bg-destructive/10 text-destructive"
          : status === "in_progress"
            ? "bg-warning/10 text-warning"
            : "bg-muted text-muted-foreground";
  return (
    <Badge variant="secondary" className={cn("rounded-full border-0 capitalize", tone, className)}>
      {label}
    </Badge>
  );
}

export function SeverityBadge({
  tier,
  className,
}: {
  tier: "critical" | "attention" | "normal";
  className?: string;
}) {
  if (tier === "critical") {
    return (
      <Badge variant="destructive" className={cn("gap-1 rounded-full", className)}>
        <AlertTriangle className="size-3" aria-hidden />
        Critical
      </Badge>
    );
  }
  if (tier === "attention") {
    return (
      <Badge className={cn("gap-1 rounded-full bg-warning text-warning-foreground", className)}>
        <AlertTriangle className="size-3" aria-hidden />
        Attention
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className={cn("rounded-full", className)}>
      Normal
    </Badge>
  );
}

export function SyncBadge({
  state,
  pendingCount,
  className,
}: {
  state: "synced" | "offline" | "pending" | "syncing";
  pendingCount?: number;
  className?: string;
}) {
  if (state === "offline") {
    return (
      <Badge variant="outline" className={cn("gap-1 text-warning", className)}>
        <CloudOff className="size-3" aria-hidden />
        Offline
        {pendingCount ? ` · ${pendingCount} unsynced` : ""}
      </Badge>
    );
  }
  if (state === "pending" || state === "syncing") {
    return (
      <Badge variant="outline" className={cn("gap-1", className)}>
        <Loader2 className="size-3 animate-spin" aria-hidden />
        {state === "syncing" ? "Syncing" : `Queued${pendingCount ? ` (${pendingCount})` : ""}`}
      </Badge>
    );
  }
  return null;
}
