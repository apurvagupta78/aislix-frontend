import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { uploadOptionsForPolicy, useEvidenceUpload } from "@/components/audit-builder/useEvidenceUpload";
import { AuditEvidencePanel, targetId, type EvidenceTarget } from "@/components/audit-engine/AuditEvidencePanel";
import type { AuditResponseValue, TemplateField } from "@/lib/audit-builder/types";
import { encodeEvidenceFlag } from "@/lib/audit-engine/execution-table";
import {
  AUDIT_EVIDENCE_SECTION,
  DEVICE_METADATA_KEY,
  EVIDENCE_FLAG_LIST_KEY,
  GPS_KEY,
  SHELF_EVIDENCE_SECTION,
  auditEvidenceValues,
  collectDeviceMetadata,
  evidenceField,
  listValue,
  parseDeviceMetadata,
  parseGps,
  storeCheckFor,
  type GpsFix,
  type GridRequirement,
  type ShelfSlot,
  type StoreLocation,
} from "@/lib/audit-engine/grid-evidence";
import type { AuditEvidencePolicy } from "@/lib/audit-evidence-policy";
import type { ResponseMap } from "@/lib/custom-audit";
import { readDeviceLocation } from "@/lib/device-location";
import { isVideoFile } from "@/lib/digital-audit";
import { reverseGeocode } from "@/lib/geo/reverse-geocode.functions";

type SetValue = (section: string, recordIndex: number, field: TemplateField, value: AuditResponseValue) => Promise<void>;

/**
 * Audit-wide evidence (contextual / shelf / before-after / quarantine / sealed photos, session video,
 * GPS and device details) for any digital audit screen. GPS and device details are captured
 * automatically once saved responses have loaded.
 */
export function useAuditEvidenceCapture(input: {
  responses: ResponseMap;
  setValue: SetValue;
  onUploadImage: (file: File) => Promise<string>;
  onUploadVideo?: (file: File) => Promise<string>;
  policy: Partial<AuditEvidencePolicy> | null | undefined;
  storeLocation?: StoreLocation | null;
  readOnly: boolean;
  canCapture: boolean;
}) {
  const { responses, setValue, canCapture } = input;
  const requiredProof = input.policy?.requiredProof ?? [];
  const evidenceUpload = useEvidenceUpload(input.onUploadImage);
  const [target, setTarget] = useState<EvidenceTarget | null>(null);
  const [videoBusy, setVideoBusy] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRecordRef = useRef<HTMLInputElement>(null);
  const videoUploadRef = useRef<HTMLInputElement>(null);

  const auditValues = auditEvidenceValues(responses);
  const gps = parseGps(auditValues[GPS_KEY]);
  const device = parseDeviceMetadata(auditValues[DEVICE_METADATA_KEY]);

  const saveAuditEvidence = (key: string, type: TemplateField["type"], value: AuditResponseValue) =>
    setValue(AUDIT_EVIDENCE_SECTION, 0, evidenceField(AUDIT_EVIDENCE_SECTION, key, type), value);

  const handlePhoto = async (file: File) => {
    const current = target;
    if (!current) return;
    try {
      const { url, flags } = await evidenceUpload.upload(file, uploadOptionsForPolicy(input.policy, device?.openedAt ?? null));
      const record = responses[current.section]?.[current.recordIndex] ?? {};
      if (current.section === SHELF_EVIDENCE_SECTION) {
        await setValue(current.section, current.recordIndex, evidenceField(current.section, "shelf", "short_text"), current.shelfName ?? "");
      }
      await setValue(
        current.section,
        current.recordIndex,
        evidenceField(current.section, current.key, "multiple_images"),
        [...listValue(record[current.key]), url],
      );
      if (flags.length) {
        await setValue(
          current.section,
          current.recordIndex,
          evidenceField(current.section, EVIDENCE_FLAG_LIST_KEY, "short_text"),
          [...listValue(record[EVIDENCE_FLAG_LIST_KEY]), ...flags.map((f) => encodeEvidenceFlag(url, f))],
        );
        toast.warning(`Photo added but needs review: ${flags[0]}`, { duration: 6000 });
      } else {
        toast.success("Photo added.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not upload photo.");
    } finally {
      setTarget((prev) => (prev === current ? null : prev));
    }
  };

  const removeEvidence = (t: EvidenceTarget, ref: string) => {
    const record = responses[t.section]?.[t.recordIndex] ?? {};
    void setValue(
      t.section,
      t.recordIndex,
      evidenceField(t.section, t.key, "multiple_images"),
      listValue(record[t.key]).filter((r) => r !== ref),
    );
  };

  const handleVideo = async (file: File) => {
    if (!input.onUploadVideo) return;
    if (!isVideoFile(file)) {
      toast.error("Choose a video file (MP4, MOV or WebM).");
      return;
    }
    setVideoBusy(true);
    try {
      const ref = await input.onUploadVideo(file);
      await saveAuditEvidence("session_video", "multiple_images", [...listValue(auditValues.session_video), ref]);
      toast.success("Session video added.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not upload the video.");
    } finally {
      setVideoBusy(false);
    }
  };

  const requestGps = async () => {
    setLocating(true);
    setGpsError(null);
    try {
      const location = await readDeviceLocation();
      const fix: GpsFix = {
        lat: location.lat,
        lng: location.lng,
        accuracyM: location.accuracyM,
        capturedAt: location.capturedAt,
        ...storeCheckFor(location, input.storeLocation),
      };
      await saveAuditEvidence(GPS_KEY, "short_text", JSON.stringify(fix));
      setLocating(false);
      const { address } = await reverseGeocode({ data: { lat: fix.lat, lng: fix.lng } }).catch(() => ({ address: null }));
      if (address) await saveAuditEvidence(GPS_KEY, "short_text", JSON.stringify({ ...fix, address }));
    } catch (e) {
      setGpsError(e instanceof Error ? e.message : "Could not get your location.");
    } finally {
      setLocating(false);
    }
  };

  const needsGps = requiredProof.includes("gps");
  const hasGps = Boolean(gps);
  const hasDevice = Boolean(device);
  const autoCapture = useRef({ gps: false, device: false });
  useEffect(() => {
    if (!canCapture) return;
    // Wait for saved responses to load so a reopened audit keeps its first values.
    const timer = window.setTimeout(() => {
      if (!hasDevice && !autoCapture.current.device) {
        autoCapture.current.device = true;
        void saveAuditEvidence(DEVICE_METADATA_KEY, "short_text", JSON.stringify(collectDeviceMetadata()));
      }
      if (needsGps && !hasGps && !autoCapture.current.gps) {
        autoCapture.current.gps = true;
        void requestGps();
      }
    }, 1500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canCapture, hasDevice, hasGps, needsGps]);

  const renderPanel = (requirements: GridRequirement[], slots: ShelfSlot[]) => (
    <AuditEvidencePanel
      requirements={requirements}
      slots={slots}
      responses={responses}
      readOnly={input.readOnly}
      busyTarget={
        videoBusy
          ? targetId({ section: AUDIT_EVIDENCE_SECTION, recordIndex: 0, key: "session_video" })
          : evidenceUpload.uploading && target
            ? targetId(target)
            : null
      }
      gps={gps}
      gpsError={gpsError}
      locating={locating}
      device={device}
      onRetryGps={() => void requestGps()}
      onAddPhoto={(t) => {
        setTarget(t);
        photoRef.current?.click();
      }}
      onAddVideo={(mode) => (mode === "record" ? videoRecordRef : videoUploadRef).current?.click()}
      onRemove={removeEvidence}
    />
  );

  const hiddenInputs = (
    <>
      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handlePhoto(file);
          else setTarget(null);
          e.target.value = "";
        }}
      />
      <input
        ref={videoRecordRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleVideo(file);
          e.target.value = "";
        }}
      />
      <input
        ref={videoUploadRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm,.m4v"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleVideo(file);
          e.target.value = "";
        }}
      />
    </>
  );

  return { gps, device, renderPanel, hiddenInputs };
}
