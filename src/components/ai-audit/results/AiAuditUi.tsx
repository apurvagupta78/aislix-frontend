import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AiAuditCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card shadow-sm",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function AiMetricStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 px-3 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

export function AiResultsHero({
  scanId,
  modeLabel,
  operatingModel,
  timestamp,
}: {
  scanId: string;
  modeLabel: string;
  operatingModel?: string;
  timestamp?: string;
}) {
  return (
    <div className="rounded-2xl border border-brand/20 bg-gradient-to-br from-brand-soft/30 to-card px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="gap-1 rounded-full bg-status-ai-soft text-status-ai-strong">
          <Sparkles className="size-3" /> AI Audit
        </Badge>
        <Badge variant="outline">{modeLabel}</Badge>
        {operatingModel ? <Badge variant="secondary">{operatingModel}</Badge> : null}
        {timestamp ? (
          <span className="text-[11px] text-muted-foreground">
            {new Date(timestamp).toLocaleString()}
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm" className="rounded-xl text-xs">
          <Link to="/results/debug" search={{ scan: scanId }}>
            Raw Astra payload
          </Link>
        </Button>
      </div>
    </div>
  );
}

export function AiEvidencePanel({ imageUrl }: { imageUrl?: string | null }) {
  if (!imageUrl) return null;
  return (
    <AiAuditCard title="Shelf evidence" description="Annotated image from Astra vision analysis">
      <img
        src={imageUrl}
        alt="Shelf audit evidence"
        className="max-h-[520px] w-full rounded-lg object-contain bg-muted/20"
      />
    </AiAuditCard>
  );
}

export function AiExecutiveSummary({ text }: { text?: string | null }) {
  if (!text?.trim()) return null;
  return (
    <AiAuditCard title="Executive summary" description="Astra narrative assessment">
      <p className="text-sm leading-relaxed text-foreground">{text}</p>
    </AiAuditCard>
  );
}
