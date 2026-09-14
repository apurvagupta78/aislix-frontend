import { MapPin, User } from "lucide-react";
import type { AuditEvidence } from "@/lib/digital-audit";
import { Badge } from "@/components/ui/badge";

export function EvidenceViewerPanel({
  evidence,
  selectedBin,
  onSelectBin,
  meta,
}: {
  evidence: AuditEvidence[];
  selectedBin: string | null;
  onSelectBin: (bin: string) => void;
  meta?: {
    geofence_status?: string | null;
    submitted_at?: string | null;
    auditor_name?: string | null;
  };
}) {
  const active = evidence.find((e) => e.bin_key === selectedBin) ?? evidence[0];

  return (
    <aside className="space-y-4 rounded-xl border border-border bg-card p-4 lg:sticky lg:top-4">
      <div>
        <h3 className="font-semibold">Evidence</h3>
        <p className="text-xs text-muted-foreground">
          Original shelf photos with capture metadata. One photo per bin required.
        </p>
      </div>

      {meta ? (
        <div className="flex flex-wrap gap-2 text-xs">
          {meta.geofence_status ? (
            <Badge variant="outline">GPS: {meta.geofence_status}</Badge>
          ) : null}
          {meta.submitted_at ? (
            <Badge variant="outline">
              Submitted {new Date(meta.submitted_at).toLocaleString()}
            </Badge>
          ) : null}
          {meta.auditor_name ? (
            <Badge variant="outline" className="gap-1">
              <User className="size-3" /> {meta.auditor_name}
            </Badge>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {evidence.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => onSelectBin(e.bin_key)}
            className={`rounded-lg border px-2 py-1 text-xs ${
              active?.id === e.id ? "border-brand bg-brand-soft text-brand" : "border-border"
            }`}
          >
            {e.bin_key === "default" ? "Main shelf" : e.bin_key}
          </button>
        ))}
      </div>

      {active?.signed_url ? (
        <div className="overflow-hidden rounded-xl border border-border bg-black/5">
          <img
            src={active.signed_url}
            alt={`Evidence for ${active.bin_key}`}
            className="max-h-80 w-full object-contain"
          />
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
          No evidence photos attached
        </div>
      )}

      {active ? (
        <dl className="grid gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <MapPin className="size-3" />
            Bin: {active.bin_key}
          </div>
          <div>Captured: {new Date(active.captured_at).toLocaleString()}</div>
        </dl>
      ) : null}
    </aside>
  );
}
