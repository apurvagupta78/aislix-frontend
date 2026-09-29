import { MapPin, ScanBarcode, User } from "lucide-react";
import {
  evidenceKeyLabel,
  type AuditEvidence,
  type DigitalAuditLine,
  type EvidenceRequirement,
} from "@/lib/digital-audit";
import { Badge } from "@/components/ui/badge";

export function EvidenceViewerPanel({
  evidence,
  selectedBin,
  onSelectBin,
  meta,
  lines = [],
  requirements,
}: {
  evidence: AuditEvidence[];
  selectedBin: string | null;
  onSelectBin: (bin: string) => void;
  meta?: {
    geofence_status?: string | null;
    submitted_at?: string | null;
    auditor_name?: string | null;
  };
  lines?: DigitalAuditLine[];
  requirements?: EvidenceRequirement[];
}) {
  const media = evidence.filter((e) => e.kind !== "barcode");
  const barcodes = evidence.filter((e) => e.kind === "barcode");
  const active =
    media.find((e) => e.bin_key === selectedBin) ??
    media.find((e) => e.kind === "sku" && lines.find((l) => l.id === e.target)?.bin_key === selectedBin) ??
    media[0];

  return (
    <aside className="space-y-4 rounded-xl border border-border bg-card p-4 lg:sticky lg:top-4">
      <div>
        <h3 className="font-semibold">Evidence</h3>
        <p className="text-xs text-muted-foreground">
          Original photos and proofs with capture metadata.
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

      {requirements?.length ? (
        <ul className="grid gap-1 text-xs">
          {requirements.map((req) => (
            <li key={req.id} className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{req.label}</span>
              <span className={req.ok ? "text-success" : "text-warning"}>
                {req.ok ? "Met" : `${req.done}/${req.total}`}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {media.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => onSelectBin(e.bin_key)}
            className={`rounded-lg border px-2 py-1 text-xs ${
              active?.id === e.id ? "border-brand bg-brand-soft text-brand" : "border-border"
            }`}
          >
            {evidenceKeyLabel(e, lines)}
          </button>
        ))}
      </div>

      {active?.signed_url ? (
        <div className="overflow-hidden rounded-xl border border-border bg-black/5">
          {active.media_type === "video" ? (
            <video src={active.signed_url} controls className="max-h-80 w-full" />
          ) : (
            <img
              src={active.signed_url}
              alt={`Evidence: ${evidenceKeyLabel(active, lines)}`}
              className="max-h-80 w-full object-contain"
            />
          )}
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
            {evidenceKeyLabel(active, lines)}
            {active.lat != null && active.lng != null
              ? ` · ${active.lat.toFixed(5)}, ${active.lng.toFixed(5)}`
              : ""}
          </div>
          <div>Captured: {new Date(active.captured_at).toLocaleString()}</div>
        </dl>
      ) : null}

      {barcodes.length ? (
        <div className="space-y-1 border-t border-border pt-3 text-xs">
          <p className="font-medium">Barcode confirmations</p>
          {barcodes.map((b) => (
            <div key={b.id} className="flex items-center gap-1 text-muted-foreground">
              <ScanBarcode className="size-3" />
              {lines.find((l) => l.id === b.target)?.product_name ?? "SKU"} · {b.barcode_code ?? "—"}
              {b.barcode_method ? ` (${b.barcode_method})` : ""}
            </div>
          ))}
        </div>
      ) : null}
    </aside>
  );
}
