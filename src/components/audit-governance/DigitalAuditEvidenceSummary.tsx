import type { ReactNode } from "react";
import { MapPin, Smartphone } from "lucide-react";

import { EvidenceImage } from "@/components/audit-builder/AuditExecutionForm";
import { EvidenceVideo, GpsSummary, SessionVideoProof } from "@/components/audit-engine/AuditEvidencePanel";
import { SESSION_VIDEO_META_KEY, parseSessionVideoMeta } from "@/lib/audit-engine/session-video";
import { AISLIX_PALETTE, ACCENT_TINT } from "@/lib/ai-audit/kpi-palette";
import {
  auditEvidenceValues,
  GPS_KEY,
  listValue,
  parseGps,
  shelfEvidenceValues,
  shelfSlots,
  type GridRequirement,
} from "@/lib/audit-engine/grid-evidence";
import type { DigitalAuditEvidence } from "@/lib/new-audit/digital-columns";

function Status({ requirement }: { requirement: GridRequirement }) {
  if (requirement.total === 0) {
    return (
      <span className="rounded-md px-2 py-0.5 text-[11px] font-medium text-[#04203F]" style={{ background: AISLIX_PALETTE.grey, border: `1px solid ${AISLIX_PALETTE.border}` }}>
        Not needed
      </span>
    );
  }
  return requirement.ok ? (
    <span className="rounded-md px-2 py-0.5 text-[11px] font-medium text-[#04203F]" style={{ background: ACCENT_TINT.green, border: `1px solid ${AISLIX_PALETTE.green}` }}>
      Complete{requirement.total > 1 ? ` · ${requirement.done}/${requirement.total}` : ""}
    </span>
  ) : (
    <span className="rounded-md px-2 py-0.5 text-[11px] font-medium text-[#04203F]" style={{ background: AISLIX_PALETTE.pink, border: `1px dashed ${AISLIX_PALETTE.secondary}` }}>
      Missing · {requirement.done}/{requirement.total}
    </span>
  );
}

function Photos({ refs }: { refs: string[] }) {
  if (!refs.length) return <span className="text-xs text-[#667085]">None</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {refs.slice(0, 8).map((ref) => (
        <EvidenceImage key={ref} stored={ref} className="size-10 rounded border border-[#D9E2E8] object-cover" />
      ))}
    </div>
  );
}

function Item({ requirement, children }: { requirement: GridRequirement; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-[#D9E2E8] p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-[#04203F]">{requirement.label}</p>
        <Status requirement={requirement} />
      </div>
      {!requirement.ok && requirement.missing.length ? (
        <p className="mt-0.5 text-xs text-[#667085]">
          Missing: {requirement.missing.slice(0, 6).join(", ")}
          {requirement.missing.length > 6 ? ` +${requirement.missing.length - 6} more` : ""}
        </p>
      ) : null}
      {children ? <div className="mt-2">{children}</div> : null}
    </div>
  );
}

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);

export function DigitalAuditEvidenceSummary({
  evidence,
  requirements,
}: {
  evidence: DigitalAuditEvidence;
  requirements: GridRequirement[];
}) {
  if (!requirements.length) return null;
  const audit = auditEvidenceValues(evidence.responses);
  const slots = shelfSlots(evidence.dataset, evidence.columns.shelfColumnId);
  const hasBeforeAfter = requirements.some((r) => r.id === "before_after");
  const gps = parseGps(audit[GPS_KEY]) ?? (evidence.deviceInfo?.gps as ReturnType<typeof parseGps>) ?? null;
  const device = evidence.deviceInfo ?? {};
  const complete = requirements.filter((r) => r.ok).length;
  let shelfShown = false;

  return (
    <div className="rounded-2xl border border-[#D9E2E8] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-[#04203F]">Evidence captured</h3>
          <p className="mt-0.5 text-xs text-[#667085]">
            What the manager required and what the auditor captured. Status is calculated by Aislix.
          </p>
        </div>
        <span className="text-xs font-medium text-[#04203F]">
          {complete} of {requirements.length} requirements complete
        </span>
      </div>
      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        {requirements.map((r) => {
          switch (r.id) {
            case "context_photo":
            case "quarantine_contents":
            case "sealed_container":
              return (
                <Item key={r.id} requirement={r}>
                  <Photos refs={listValue(audit[r.id])} />
                </Item>
              );
            case "shelf_photo":
            case "before_after": {
              if (shelfShown) return <Item key={r.id} requirement={r} />;
              shelfShown = true;
              return (
                <Item key={r.id} requirement={r}>
                  <div className="max-h-64 space-y-1 overflow-auto">
                    {evidence.shelfColumnName ? (
                      <p className="text-[11px] text-[#667085]">Shelves from the “{evidence.shelfColumnName}” column</p>
                    ) : null}
                    {slots.map((slot) => {
                      const values = shelfEvidenceValues(evidence.responses, slot);
                      return (
                        <div key={slot.index} className="flex flex-wrap items-center gap-3 rounded-lg bg-[#F4F7F9] px-2.5 py-1.5">
                          <span className="min-w-[7rem] text-xs font-medium text-[#04203F]">{slot.label}</span>
                          <span className="inline-flex items-center gap-1.5">
                            {hasBeforeAfter ? <span className="text-[11px] text-[#667085]">Before</span> : null}
                            <Photos refs={listValue(values.shelf_photo)} />
                          </span>
                          {hasBeforeAfter ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="text-[11px] text-[#667085]">After</span>
                              <Photos refs={listValue(values.after_photo)} />
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </Item>
              );
            }
            case "live_session_video": {
              const videos = listValue(audit.session_video);
              const videoMeta = parseSessionVideoMeta(audit[SESSION_VIDEO_META_KEY]);
              return (
                <Item key={r.id} requirement={r}>
                  {videos.length ? (
                    <div className="flex flex-wrap gap-3">
                      {videos.map((v) => (
                        <div key={v} className="space-y-1.5">
                          <EvidenceVideo stored={v} className="h-32 w-56 rounded-md border border-[#D9E2E8] bg-black" />
                          <SessionVideoProof meta={videoMeta.find((m) => m.ref === v)} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-[#667085]">None</span>
                  )}
                </Item>
              );
            }
            case "gps":
              return (
                <Item key={r.id} requirement={r}>
                  {gps ? (
                    <div className="flex items-start gap-1.5 text-xs text-[#04203F]">
                      <MapPin className="mt-0.5 size-3.5 shrink-0 text-[#667085]" />
                      <div className="min-w-0">
                        <GpsSummary gps={gps} />
                        <p className="mt-1 text-[#667085]">
                          Read from device ·{" "}
                          <a
                            className="underline underline-offset-2"
                            href={`https://www.google.com/maps?q=${gps.lat},${gps.lng}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open map
                          </a>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-[#667085]">Location not captured</span>
                  )}
                </Item>
              );
            case "device_metadata":
              return (
                <Item key={r.id} requirement={r}>
                  <div className="space-y-0.5 text-xs text-[#04203F]">
                    <p className="flex items-center gap-1.5">
                      <Smartphone className="size-3.5 text-[#667085]" />
                      {[text(device.platform), text(device.timezone), text(device.screen)].filter(Boolean).join(" · ") || "Device details recorded"}
                    </p>
                    {text(device.openedAt) ? <p className="text-[#667085]">Opened {new Date(String(device.openedAt)).toLocaleString()}</p> : null}
                    {text(device.submittedAt) ? <p className="text-[#667085]">Submitted {new Date(String(device.submittedAt)).toLocaleString()}</p> : null}
                  </div>
                </Item>
              );
            default:
              return (
                <Item key={r.id} requirement={r}>
                  <p className="text-xs text-[#667085]">
                    {r.id === "barcode"
                      ? `Scans are in the table below${evidence.barcodeColumnName ? ` (checked against “${evidence.barcodeColumnName}”)` : ""}.`
                      : r.id === "variance_explanation"
                        ? "Reasons are in the table below."
                        : r.id === "expiry_date"
                          ? "Expiry photos, dates and status are in the table below."
                          : r.id === "expired_removal"
                            ? "Removal confirmations and photos are in the table below."
                            : "Row photos are in the table below."}
                  </p>
                </Item>
              );
          }
        })}
      </div>
    </div>
  );
}
