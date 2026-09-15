import { Download, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

export function DashboardSectionHeader({
  title,
  description,
  viewAllTo,
  viewAllSearch,
  onDownloadCsv,
  downloadLabel = "Download CSV",
}: {
  title: string;
  description?: string;
  viewAllTo: string;
  viewAllSearch?: Record<string, string | undefined>;
  onDownloadCsv?: () => void;
  downloadLabel?: string;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {onDownloadCsv ? (
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onDownloadCsv}>
            <Download className="mr-1 size-3" />
            {downloadLabel}
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" className="h-8 text-xs text-brand" asChild>
          <Link to={viewAllTo} search={viewAllSearch}>
            View All <ArrowRight className="ml-1 size-3" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
