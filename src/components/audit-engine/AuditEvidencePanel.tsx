import { useEffect, useState, type ReactNode } from "react";
import { Camera, CheckCircle2, Loader2, MapPin, Smartphone, Upload, Video, X } from "lucide-react";

import { EvidenceImage } from "@/components/audit-builder/AuditExecutionForm";
import { Button } from "@/components/ui/button";
import { AISLIX_PALETTE, ACCENT_TINT } from "@/lib/ai-audit/kpi-palette";
import {
  AUDIT_EVIDENCE_SECTION,
  SHELF_EVIDENCE_SECTION,
  auditEvidenceValues,
  listValue,
  shelfEvidenceValues,
  type DeviceMetadata,
  type GpsFix,
  type GridRequirement,
  type ShelfPhotoKey,
  type ShelfSlot,
  type StoreCheck,
} from "@/lib/audit-engine/grid-evidence";
import { formatGpsPoint, formatVideoDuration, type SessionVideoMeta } from "@/lib/audit-engine/session-video";
import { formatDistance } from "@/lib/geo/distance";
import type { ResponseMap } from "@/lib/custom-audit-shared";
import { resolveAuditEvidenceUrl } from "@/lib/custom-audit";

export type EvidenceTarget = {
  section: typeof AUDIT_EVIDENCE_SECTION | typeof SHELF_EVIDENCE_SECTION;
  recordIndex: number;
  key: string;
  shelfName?: string;
};

export const targetId = (t: EvidenceTarget) => `${t.section}:${t.recordIndex}:${t.key}`;

type Props = {
  requirements: GridRequirement[];
  slots: ShelfSlot[];
  responses: ResponseMap;
  readOnly: boolean;
  busyTarget: string | null;
  gps: GpsFix | null;
  gpsError: string | null;
  locating: boolean;
  device: DeviceMetadata | null;
  videoMeta?: SessionVideoMeta[];
  /** False when the audit only accepts in-app capture. */
  allowVideoUpload?: boolean;
  onRetryGps: () => void;
  onAddPhoto: (target: EvidenceTarget) => void;
  onAddVideo: (mode: "record" | "upload") => void;
  onRemove: (target: EvidenceTarget, ref: string) => void;
};

function StatusPill({ requirement }: { requirement: GridRequirement }) {
  const notNeeded = requirement.total === 0;
  const style = requirement.ok
    ? { background: ACCENT_TINT.green, border: `1px solid ${AISLIX_PALETTE.green}` }
    : { background: AISLIX_PALETTE.pink, border: `1px dashed ${AISLIX_PALETTE.secondary}` };
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium text-[#04203F]"
      style={notNeeded ? { background: AISLIX_PALETTE.grey, border: `1px solid ${AISLIX_PALETTE.border}` } : style}
    >
      {notNeeded ? "Not needed yet" : requirement.ok ? "Done" : `${requirement.done} of ${requirement.total}`}
    </span>
  );
}

export function EvidenceVideo({ stored, className }: { stored: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void resolveAuditEvidenceUrl(stored).then((url) => {
      if (active) setSrc(url);
    });
    return () => {
      active = false;
    };
  }, [stored]);
  if (!src) return <div className={className ?? "h-24 w-40 rounded-md bg-[#EEF1F4]"} />;
  return <video src={src} controls preload="metadata" className={className ?? "h-24 w-40 rounded-md border border-[#D9E2E8] bg-black"} />;
}

function Thumbs({
  refs,
  readOnly,
  onRemove,
  video,
}: {
  refs: string[];
  readOnly: boolean;
  onRemove: (ref: string) => void;
  video?: boolean;
}) {
  if (!refs.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {refs.map((ref) => (
        <span key={ref} className="group relative">
          {video ? (
            <EvidenceVideo stored={ref} />
          ) : (
            <EvidenceImage stored={ref} className="size-10 rounded border border-[#D9E2E8] object-cover" />
          )}
          {!readOnly ? (
            <button
              type="button"
              aria-label="Remove"
              className="absolute -right-1 -top-1 hidden rounded-full border border-[#D9E2E8] bg-white p-px text-[#667085] group-hover:block"
              onClick={() => onRemove(ref)}
            >
              <X className="size-2.5" />
            </button>
          ) : null}
        </span>
      ))}
    </div>
  );
}

function AddPhotoButton({ busy, disabled, onClick, label = "Add photo" }: { busy: boolean; disabled: boolean; onClick: () => void; label?: string }) {
  return (
    <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={disabled || busy} onClick={onClick}>
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />} {label}
    </Button>
  );
}

function Block({ requirement, children }: { requirement: GridRequirement; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-[#D9E2E8] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#04203F]">{requirement.label}</p>
          <p className="text-xs text-[#667085]">{requirement.hint}</p>
          {!requirement.ok && requirement.missing.length ? (
            <p className="mt-0.5 text-xs text-[#04203F]">
              Missing: {requirement.missing.slice(0, 6).join(", ")}
              {requirement.missing.length > 6 ? ` +${requirement.missing.length - 6} more` : ""}
            </p>
          ) : null}
        </div>
        <StatusPill requirement={requirement} />
      </div>
      {children ? <div className="mt-2.5">{children}</div> : null}
    </div>
  );
}

const ROW_LEVEL = new Set(["per_sku_photo", "variance_photo", "barcode", "expiry_date", "expired_removal", "variance_explanation"]);

const ROW_LEVEL_HINT: Record<string, string> = {
  barcode: "Use Scan in the Barcode column of the table.",
  expiry_date: "Use Scan date in the Expiry date column of the table.",
  expired_removal: "In the Expiry date column: tick Removed from shelf and add a photo.",
  variance_explanation: "Pick a reason in the table on every row marked Mismatch.",
};

const STORE_CHECK_STYLE: Record<StoreCheck, { label: (gps: GpsFix) => string; background: string; border: string }> = {
  at_store: {
    label: (g) => `At the store${g.storeDistanceM != null ? ` · ${formatDistance(g.storeDistanceM)} away` : ""}`,
    background: ACCENT_TINT.green,
    border: `1px solid ${AISLIX_PALETTE.green}`,
  },
  near_store: {
    label: (g) => `Near the store${g.storeDistanceM != null ? ` · ${formatDistance(g.storeDistanceM)} away` : ""}`,
    background: ACCENT_TINT.blue,
    border: `1px solid ${AISLIX_PALETTE.blue}`,
  },
  outside: {
    label: (g) => `Outside the store area${g.storeDistanceM != null ? ` · ${formatDistance(g.storeDistanceM)} away` : ""}`,
    background: AISLIX_PALETTE.pink,
    border: `1px solid ${AISLIX_PALETTE.secondary}`,
  },
  store_location_missing: {
    label: () => "Store location not set — can't check distance",
    background: AISLIX_PALETTE.grey,
    border: `1px solid ${AISLIX_PALETTE.border}`,
  },
};

/** Live / uploaded label for a session video, with recording time and GPS when recorded live. */
export function SessionVideoProof({ meta }: { meta: SessionVideoMeta | undefined }) {
  if (!meta?.live) {
    return (
      <span
        className="inline-block rounded-md px-2 py-0.5 text-[11px] font-medium text-[#04203F]"
        style={{ background: AISLIX_PALETTE.grey, border: `1px solid ${AISLIX_PALETTE.border}` }}
      >
        {meta ? "Uploaded — not recorded live" : "Recorded before live stamping"}
      </span>
    );
  }
  const started = meta.startedAt ? new Date(meta.startedAt) : null;
  const ended = meta.endedAt ? new Date(meta.endedAt) : null;
  const where = meta.gpsStart ?? meta.gpsEnd;
  const check = meta.storeCheck ? STORE_CHECK_STYLE[meta.storeCheck] : null;
  return (
    <span className="block max-w-[260px] space-y-1 text-[11px] text-[#04203F]">
      <span
        className="inline-block rounded-md px-2 py-0.5 font-medium"
        style={{ background: ACCENT_TINT.green, border: `1px solid ${AISLIX_PALETTE.green}` }}
      >
        Recorded live in Aislix
      </span>
      {started ? (
        <span className="block text-[#667085]">
          {started.toLocaleString()}
          {ended ? ` – ${ended.toLocaleTimeString()}` : ""}
          {meta.durationS != null ? ` · ${formatVideoDuration(meta.durationS)}` : ""}
          {meta.timezone ? ` · ${meta.timezone}` : ""}
        </span>
      ) : null}
      <span className="block text-[#667085]">
        {where ? (
          <a
            className="underline underline-offset-2"
            href={`https://www.google.com/maps?q=${where.lat},${where.lng}`}
            target="_blank"
            rel="noreferrer"
          >
            GPS {formatGpsPoint(where)}
          </a>
        ) : (
          "GPS unavailable while recording"
        )}
      </span>
      {check && where ? (
        <span
          className="inline-block whitespace-nowrap rounded-md px-2 py-0.5 font-medium"
          style={{ background: check.background, border: check.border }}
        >
          {check.label({
            lat: where.lat,
            lng: where.lng,
            accuracyM: where.accuracyM,
            capturedAt: where.at,
            storeDistanceM: meta.storeDistanceM,
          })}
        </span>
      ) : null}
    </span>
  );
}

export function GpsSummary({ gps }: { gps: GpsFix }) {
  const check = gps.storeCheck ? STORE_CHECK_STYLE[gps.storeCheck] : null;
  return (
    <span className="min-w-0 space-y-1">
      <span className="block tabular-nums">
        {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}
        {gps.accuracyM != null ? ` · ±${Math.round(gps.accuracyM)} m` : ""}
      </span>
      {gps.address ? <span className="block text-[#667085]">{gps.address}</span> : null}
      {check ? (
        <span
          className="inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium text-[#04203F]"
          style={{ background: check.background, border: check.border }}
        >
          {check.label(gps)}
        </span>
      ) : null}
    </span>
  );
}

export function AuditEvidencePanel({
  requirements,
  slots,
  responses,
  readOnly,
  busyTarget,
  gps,
  gpsError,
  locating,
  device,
  videoMeta = [],
  allowVideoUpload = true,
  onRetryGps,
  onAddPhoto,
  onAddVideo,
  onRemove,
}: Props) {
  if (!requirements.length) return null;
  const audit = auditEvidenceValues(responses);
  const met = requirements.filter((r) => r.ok).length;
  const byId = new Map(requirements.map((r) => [r.id, r]));
  const shelfReq = byId.get("shelf_photo");
  const beforeAfterReq = byId.get("before_after");
  const shelfKeys: ShelfPhotoKey[] = beforeAfterReq ? ["shelf_photo", "after_photo"] : ["shelf_photo"];
  const auditTarget = (key: string): EvidenceTarget => ({ section: AUDIT_EVIDENCE_SECTION, recordIndex: 0, key });

  const singleUpload = (requirement: GridRequirement, key: string) => {
    const target = auditTarget(key);
    return (
      <Block key={requirement.id} requirement={requirement}>
        <div className="flex flex-wrap items-center gap-2">
          <Thumbs refs={listValue(audit[key])} readOnly={readOnly} onRemove={(ref) => onRemove(target, ref)} />
          {!readOnly ? <AddPhotoButton busy={busyTarget === targetId(target)} disabled={readOnly} onClick={() => onAddPhoto(target)} /> : null}
        </div>
      </Block>
    );
  };

  const shelfBlock = (requirement: GridRequirement) => (
    <Block key="shelf-evidence" requirement={requirement}>
      <div className="max-h-72 space-y-1.5 overflow-auto">
        {slots.map((slot) => {
          const values = shelfEvidenceValues(responses, slot);
          return (
            <div key={slot.index} className="flex flex-wrap items-center gap-3 rounded-lg bg-[#F4F7F9] px-2.5 py-1.5">
              <span className="min-w-[8rem] text-xs font-medium text-[#04203F]">{slot.label}</span>
              {shelfKeys.map((key) => {
                const target: EvidenceTarget = { section: SHELF_EVIDENCE_SECTION, recordIndex: slot.index, key, shelfName: slot.name };
                const refs = listValue(values[key]);
                return (
                  <span key={key} className="inline-flex flex-wrap items-center gap-1.5">
                    {beforeAfterReq ? <span className="text-[11px] text-[#667085]">{key === "after_photo" ? "After" : "Before"}</span> : null}
                    <Thumbs refs={refs} readOnly={readOnly} onRemove={(ref) => onRemove(target, ref)} />
                    {!readOnly ? (
                      <AddPhotoButton
                        busy={busyTarget === targetId(target)}
                        disabled={readOnly}
                        label={refs.length ? "Add" : "Add photo"}
                        onClick={() => onAddPhoto(target)}
                      />
                    ) : refs.length ? null : (
                      <span className="text-[11px] text-[#667085]">None</span>
                    )}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    </Block>
  );

  let shelfRendered = false;
  return (
    <section className="rounded-2xl border border-[#D9E2E8] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[#04203F]">Evidence checklist</h3>
          <p className="text-xs text-[#667085]">Everything below is required by your manager before you can submit.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#04203F]">
          <CheckCircle2 className="size-4" style={{ color: met === requirements.length ? AISLIX_PALETTE.green : AISLIX_PALETTE.secondary }} />
          {met} of {requirements.length} done
        </span>
      </div>
      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        {requirements.map((requirement) => {
          switch (requirement.id) {
            case "context_photo":
              return singleUpload(requirement, "context_photo");
            case "quarantine_contents":
              return singleUpload(requirement, "quarantine_contents");
            case "sealed_container":
              return singleUpload(requirement, "sealed_container");
            case "shelf_photo":
            case "before_after": {
              if (shelfRendered) return null;
              shelfRendered = true;
              const combined: GridRequirement =
                shelfReq && beforeAfterReq
                  ? {
                      ...beforeAfterReq,
                      label: `${shelfReq.label} · ${beforeAfterReq.label}`,
                      ok: shelfReq.ok && beforeAfterReq.ok,
                    }
                  : requirement;
              return shelfBlock(combined);
            }
            case "live_session_video": {
              const target = auditTarget("session_video");
              const busy = busyTarget === targetId(target);
              return (
                <Block key={requirement.id} requirement={requirement}>
                  <div className="space-y-2">
                    {listValue(audit.session_video).map((ref) => (
                      <div key={ref} className="flex flex-wrap items-start gap-2">
                        <Thumbs video refs={[ref]} readOnly={readOnly} onRemove={(r) => onRemove(target, r)} />
                        <SessionVideoProof meta={videoMeta.find((m) => m.ref === ref)} />
                      </div>
                    ))}
                    {!readOnly ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={busy} onClick={() => onAddVideo("record")}>
                          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Video className="size-3.5" />} Record live
                        </Button>
                        {allowVideoUpload ? (
                          <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={busy} onClick={() => onAddVideo("upload")}>
                            <Upload className="size-3.5" /> Upload video
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                    {!readOnly ? (
                      <p className="text-[11px] text-[#667085]">
                        Live recordings show the date, time and GPS on every frame.
                        {allowVideoUpload ? " Uploaded videos are marked as not recorded live." : ""}
                      </p>
                    ) : null}
                  </div>
                </Block>
              );
            }
            case "gps":
              return (
                <Block key={requirement.id} requirement={requirement}>
                  <div className="flex flex-wrap items-start gap-2 text-xs text-[#04203F]">
                    <MapPin className="mt-0.5 size-3.5 shrink-0 text-[#667085]" />
                    {gps ? (
                      <GpsSummary gps={gps} />
                    ) : (
                      <span className="text-[#667085]">{gpsError ?? (locating ? "Getting your location…" : "Location not captured yet.")}</span>
                    )}
                    {!readOnly && (!gps || gps.storeCheck === "outside" || gps.storeCheck === "near_store") ? (
                      <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={locating} onClick={onRetryGps}>
                        {locating ? <Loader2 className="size-3.5 animate-spin" /> : <MapPin className="size-3.5" />}{" "}
                        {gps ? "Update location" : "Allow location"}
                      </Button>
                    ) : null}
                  </div>
                </Block>
              );
            case "device_metadata":
              return (
                <Block key={requirement.id} requirement={requirement}>
                  <p className="flex items-center gap-1.5 text-xs text-[#667085]">
                    <Smartphone className="size-3.5" />
                    {device
                      ? `Opened ${new Date(device.openedAt).toLocaleString()}${device.timezone ? ` · ${device.timezone}` : ""}${device.platform ? ` · ${device.platform}` : ""}`
                      : "Recorded when you open the audit."}
                  </p>
                </Block>
              );
            default:
              return ROW_LEVEL.has(requirement.id) ? (
                <Block key={requirement.id} requirement={requirement}>
                  <p className="text-xs text-[#667085]">
                    {ROW_LEVEL_HINT[requirement.id] ?? "Add photos in the Evidence column of the table."}
                  </p>
                </Block>
              ) : null;
          }
        })}
      </div>
    </section>
  );
}
