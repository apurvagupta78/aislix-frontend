import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { AssignmentPreview } from "@/lib/assignment-engine";
import { ASSIGNMENT_MODE_LABELS } from "@/lib/assignment-engine";

type Props = {
  preview: AssignmentPreview;
};

export function AssignmentPreviewPanel({ preview }: Props) {
  return (
    <div className="space-y-4 rounded-xl border bg-muted/10 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Assignment preview
      </p>

      <div className="grid gap-2 text-sm">
        <Row label="Audit" value={preview.templateName} />
        <Row label="Mode" value={ASSIGNMENT_MODE_LABELS[preview.mode]} />
        <Row label="Schedule" value={preview.scheduleLabel} />
        <Row label="Due" value={preview.dueLabel} />
        <Row label="Locations" value={String(preview.locationCount)} />
        {preview.cities.length ? (
          <Row label="Cities" value={preview.cities.join(", ")} />
        ) : null}
        {preview.countries.length ? (
          <Row label="Countries" value={preview.countries.join(", ")} />
        ) : null}
        <Row label="Team" value={`${preview.teamCount} auditor(s)`} />
        <Row label="Expected assignments" value={String(preview.expectedAssignments)} />
      </div>

      {preview.distribution.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Distribution
          </p>
          <div className="space-y-1">
            {preview.distribution.map((entry) => (
              <div
                key={entry.assigneeId}
                className="flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-sm"
              >
                <span>{entry.assigneeName}</span>
                <Badge variant="secondary">{entry.storeCount}</Badge>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {preview.conflicts.length > 0 ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>
            <p className="font-medium">Scheduling warnings</p>
            <ul className="mt-1 list-inside list-disc text-xs">
              {preview.conflicts.slice(0, 5).map((c) => (
                <li key={c.id}>{c.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
