import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { NeedsReviewBadge, reviewCount } from "@/components/scan-results/NeedsReview";
import {
  EmailShareDialog,
  TeamShareDialog,
} from "@/components/scan-results/ShareDialogs";
import { createScanShareLink } from "@/lib/scan-share.functions";
import { Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  Brain,

  Building2,
  CalendarClock,
  CheckCircle2,
  Copy,
  Gauge,
  LayoutDashboard,
  MapPin,
  Loader2,
  Mail,
  Printer,
  ScanLine,
  Sparkles,
  Tags,
  Timer,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/States";

import { ResultSection } from "@/components/scan-results/ResultParts";
import { cn } from "@/lib/utils";
import { formatAssignmentId } from "@/components/AssignmentId";
import {
  formatConfidence,
  formatDuration,
  formatScanDate,
  normalizeConfidence,
  type ScanResult,
  type ScanStatus,
} from "@/lib/scan-results";

/* --------------------------------- header --------------------------------- */

const statusStyles: Record<ScanStatus, string> = {
  completed: "border-accent-green/30 bg-accent-green/10 text-accent-green",
  processing: "border-brand/25 bg-brand-soft text-brand",
  queued: "border-border bg-muted text-muted-foreground",
  failed: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function ScanStatusBadge({ status }: { status?: ScanStatus | undefined }) {
  const value: ScanStatus = status ?? "completed";
  const Icon = value === "completed" ? CheckCircle2 : value === "failed" ? BadgeCheck : Loader2;
  return (
    <Badge
      variant="outline"
      className={cn("rounded-full capitalize", statusStyles[value])}
    >
      <Icon className={cn("size-3.5", value === "processing" && "animate-spin")} /> {value}
    </Badge>
  );
}
export function LearnedCatalogBadge({
  size,
  added,
}: {
  size?: number | undefined;
  added?: number | undefined;
}) {
  if (typeof size !== "number" || !Number.isFinite(size)) return null;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="rounded-full border-brand/25 bg-brand-soft text-brand"
          >
            <Brain className="size-3.5" /> Learned catalog: {size} SKUs
            {typeof added === "number" && added > 0 ? ` · +${added} new` : ""}
          </Badge>
        </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            AI-identified SKUs saved for faster matching on future scans
          </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}


function MetaItem({
  icon,
  label,
  value,
  loading,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | undefined;
  loading?: boolean | undefined;
  accent?: boolean | undefined;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {loading ? (
          <Skeleton className="mt-1.5 h-4 w-24" />
        ) : (
          <p
            className={cn(
              "truncate text-sm font-semibold text-foreground",
              accent && "text-accent-green",
            )}
          >
            {value ?? "—"}
          </p>
        )}
      </div>
    </div>
  );
}

export function ScanResultHeader({
  data,
  loading,
  assignmentId,
}: {
  data?: ScanResult | undefined;
  loading?: boolean | undefined;
  assignmentId?: string | null | undefined;
}) {
  const summary = data?.summary;
  const health =
    typeof summary?.shelf_health_score === "number"
      ? `${Math.round(normalizeConfidence(summary.shelf_health_score))} / 100`
      : undefined;

  return (
    <div className="card-surface rounded-2xl p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold tracking-tight">
              {loading ? "Loading scan…" : (data?.scan_id ?? "Scan")}
            </h2>
            <ScanStatusBadge status={data?.status} />
            {assignmentId ? (
              <Link to="/assigned-scans" search={{ tab: "assignments" as const }}>
                <Badge
                  variant="outline"
                  className="rounded-full border-brand/25 bg-brand-soft font-mono text-brand"
                >
                  Assignment {formatAssignmentId(assignmentId)}
                </Badge>
              </Link>
            ) : null}
            <LearnedCatalogBadge
              size={summary?.learned_catalog_size}
              added={summary?.learned_new_this_scan}
            />
            <NeedsReviewBadge count={reviewCount(data)} />
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            {[data?.scan_category, data?.scan_sub_category, data?.location].some(Boolean)
              ? [data?.scan_category, data?.scan_sub_category, data?.location]
                  .filter(Boolean)
                  .join(" · ")
              : "AI shelf audit result"}
          </p>
        </div>
        <ResultNavigation />
      </div>

      <div className="mt-5 grid gap-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <MetaItem
          icon={<Building2 className="size-4" />}
          label="Store"
          value={data?.store}
          loading={loading}
        />
        <MetaItem
          icon={<MapPin className="size-4" />}
          label="Location"
          value={data?.location}
          loading={loading}
        />
        <MetaItem
          icon={<Tags className="size-4" />}
          label="Category"
          value={
            [data?.scan_category, data?.scan_sub_category].filter(Boolean).join(" · ") || undefined
          }
          loading={loading}
        />
        <MetaItem
          icon={<CalendarClock className="size-4" />}
          label="Scan date & time"
          value={formatScanDate(data?.created_at)}
          loading={loading}
        />
        <MetaItem
          icon={<Gauge className="size-4" />}
          label="Shelf health score"
          value={health}
          loading={loading}
          accent
        />
      </div>

      <div className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
        <MetaItem
          icon={<Timer className="size-4" />}
          label="Processing time"
          value={summary ? formatDuration(summary.processing_time_ms) : undefined}
          loading={loading}
        />
        <MetaItem
          icon={<Sparkles className="size-4" />}
          label="Avg AI confidence"
          value={summary ? formatConfidence(summary.average_confidence) : undefined}
          loading={loading}
        />
      </div>


    </div>
  );
}

/* ------------------------------- navigation -------------------------------- */

export function ResultNavigation() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="brand" size="sm" className="rounded-xl">
        <Link to="/scan">
          <ScanLine className="size-4" /> Scan again
        </Link>
      </Button>
      <Button asChild variant="subtle" size="sm" className="rounded-xl">
        <Link to="/history">History</Link>
      </Button>
      <Button asChild variant="subtle" size="sm" className="rounded-xl">
        <Link to="/dashboard">
          <LayoutDashboard className="size-4" /> Dashboard
        </Link>
      </Button>
    </div>
  );
}

/* ---------------------------------- share ---------------------------------- */

export function SharePanel({
  data,
  loading,
}: {
  data?: ScanResult | undefined;
  loading?: boolean | undefined;
}) {
  const [copied, setCopied] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const scanId = data?.scan_id;
  const createLink = useServerFn(createScanShareLink);

  const linkMutation = useMutation({
    mutationFn: async () => {
      if (!scanId) throw new Error("Scan is still loading.");
      if (linkUrl) return { url: linkUrl };
      return createLink({ data: { scanId } });
    },
    onSuccess: async (result) => {
      setLinkUrl(result.url);
      try {
        await navigator.clipboard.writeText(result.url);
        setCopied(true);
        toast.success("Share link copied — valid for 7 days");
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.info(result.url, { description: "Copy this link manually" });
      }
    },
    onError: (error: Error) => toast.error(error.message || "Could not create a share link."),
  });

  const ready = Boolean(scanId) && !loading;

  return (
    <ResultSection
      title="Share"
      description="Distribute this audit to store teams and stakeholders."
    >
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <Button
            variant="subtle"
            size="lg"
            className="w-full rounded-xl"
            disabled={!ready || linkMutation.isPending}
            onClick={() => linkMutation.mutate()}
          >
            {linkMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Copy className="size-4" />
            )}
            {copied ? "Copied" : "Copy share link"}
          </Button>
          <Button
            variant="subtle"
            size="lg"
            className="w-full rounded-xl"
            disabled={!ready}
            onClick={() => setEmailOpen(true)}
          >
            <Mail className="size-4" /> Email report
          </Button>
          <Button
            variant="subtle"
            size="lg"
            className="w-full rounded-xl"
            disabled={!ready}
            onClick={() => setTeamOpen(true)}
          >
            <Users className="size-4" /> Share with team
          </Button>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        {linkUrl
          ? `Anyone with this link can view the report until it expires: ${linkUrl}`
          : "Share links are read-only, expire after 7 days and include the PDF and annotated shelf image."}
      </p>

      {scanId ? (
        <>
          <EmailShareDialog scanId={scanId} open={emailOpen} onOpenChange={setEmailOpen} />
          <TeamShareDialog scanId={scanId} open={teamOpen} onOpenChange={setTeamOpen} />
        </>
      ) : null}
    </ResultSection>
  );
}

/* ------------------------------- print button ------------------------------ */

export function PrintReportButton({ disabled }: { disabled?: boolean | undefined }) {
  return (
    <Button
      variant="subtle"
      size="lg"
      className="w-full rounded-xl"
      disabled={disabled}
      onClick={() => window.print()}
    >
      <Printer className="size-4" /> Print report
    </Button>
  );
}

/* ----------------------------- processing state ---------------------------- */

export function ProcessingState({ scanId }: { scanId?: string | undefined }) {
  return (
    <div className="card-surface flex flex-col items-center gap-3 rounded-2xl p-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
        <Loader2 className="size-6 animate-spin" />
      </span>
      <h3 className="text-base font-semibold">Scan is still processing</h3>
      <p className="max-w-md text-sm text-muted-foreground">
        The vision pipeline is detecting products for {scanId ?? "this scan"}. Results appear here
        automatically as soon as processing completes.
      </p>
    </div>
  );
}
