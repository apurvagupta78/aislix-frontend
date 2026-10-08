import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Camera, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { computeCalculatedValues } from "@/lib/audit-builder/calculated-fields";
import { isFieldReadOnlyForAuditor, type FieldRole } from "@/lib/audit-builder/field-roles";
import { AISLIX_PALETTE, ACCENT_TINT } from "@/lib/ai-audit/kpi-palette";
import {
  FIELD_ROLE_BADGE_LABELS,
  resolveFieldRole,
} from "@/lib/audit-builder/ensure-field-roles";
import { RequiredInputsSummary } from "@/components/audit-builder/RequiredInputsSummary";
import { isFieldVisible } from "@/lib/audit-builder/rules-engine";
import { isImageField } from "@/lib/audit-builder/field-library";
import { resolveAuditEvidenceUrl } from "@/lib/custom-audit";
import { shouldBlockDuplicates, shouldCheckImageQuality } from "@/lib/audit-builder/evidence-validation";
import { uploadOptionsForPolicy, useEvidenceUpload, type UploadImage } from "@/components/audit-builder/useEvidenceUpload";
import { DEVICE_METADATA_KEY, auditEvidenceValues, parseDeviceMetadata } from "@/lib/audit-engine/grid-evidence";
import type { AuditEvidencePolicy } from "@/lib/audit-evidence-policy";
import { computeCompletion } from "@/lib/audit-builder/validation";
import type { AuditResponseValue, TemplateDefinition, TemplateField } from "@/lib/audit-builder/types";
import type { ResponseMap } from "@/lib/custom-audit";
import { RCA_OPTIONS } from "@/lib/digital-audit";
import { ShelfStackingVisual } from "@/components/audit-builder/ShelfStackingVisual";

/** Plain-language chips for the person doing the audit. */
const EXECUTION_ROLE_CHIPS: Partial<Record<FieldRole, { label: string; tint: string; border: string }>> = {
  reference: { label: "ALREADY PROVIDED", tint: ACCENT_TINT.blue, border: AISLIX_PALETTE.blue },
  auditor_input: { label: "YOU FILL", tint: ACCENT_TINT.purple, border: AISLIX_PALETTE.purple },
};

type Props = {
  definition: TemplateDefinition;
  templateName: string;
  storeName: string | null;
  dueAt: string | null;
  responses: ResponseMap;
  onChange: (responses: ResponseMap) => void;
  onSaveField: (
    sectionKey: string,
    recordIndex: number,
    field: TemplateField,
    value: AuditResponseValue,
  ) => Promise<void>;
  onUploadImage: UploadImage;
  readOnly?: boolean;
  testMode?: boolean;
  previewMode?: boolean;
  evidencePolicy?: Partial<AuditEvidencePolicy> | null;
};

export function AuditExecutionForm({
  definition,
  templateName,
  storeName,
  dueAt,
  responses,
  onChange,
  onSaveField,
  onUploadImage,
  readOnly,
  testMode,
  previewMode,
  evidencePolicy,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<{
    sectionKey: string;
    recordIndex: number;
    field: TemplateField;
  } | null>(null);
  const evidenceUpload = useEvidenceUpload(onUploadImage);
  const uploading = evidenceUpload.uploading;
  const [activeRecord, setActiveRecord] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const repeatableSection = definition.sections.find((s) => s.repeatable);
  const sectionKey = repeatableSection?.key ?? definition.sections[0]?.key ?? "default";

  const records = useMemo(() => {
    const sectionData = responses[sectionKey] ?? { 0: {} };
    const indices = Object.keys(sectionData).map(Number).sort((a, b) => a - b);
    return indices.length ? indices : [0];
  }, [responses, sectionKey]);

  const recordContexts = records.map((idx) => ({
    sectionKey,
    recordIndex: idx,
    values: responses[sectionKey]?.[idx] ?? {},
  }));

  const completion = computeCompletion(definition, [
    ...recordContexts,
    ...definition.sections
      .filter((s) => !s.repeatable)
      .map((s) => ({
        sectionKey: s.key,
        recordIndex: 0,
        values: responses[s.key]?.[0] ?? {},
      })),
  ]);

  const setValue = async (
    sec: string,
    idx: number,
    field: TemplateField,
    value: AuditResponseValue,
  ) => {
    const next: ResponseMap = {
      ...responses,
      [sec]: {
        ...responses[sec],
        [idx]: {
          ...(responses[sec]?.[idx] ?? {}),
          [field.key]: value,
        },
      },
    };
    onChange(next);
    if (!readOnly) await onSaveField(sec, idx, field, value);
  };

  const addSkuRecord = () => {
    const nextIdx = Math.max(...records, -1) + 1;
    onChange({
      ...responses,
      [sectionKey]: {
        ...responses[sectionKey],
        [nextIdx]: {},
      },
    });
    setActiveRecord(nextIdx);
  };

  const aiImageQuality =
    definition.ai.enabled && definition.ai.features?.imageQualityCheck?.enabled;
  const aiDuplicateDetection =
    definition.ai.enabled && definition.ai.features?.duplicateEvidenceDetection?.enabled;

  const handleImageUpload = async (file: File) => {
    if (!uploadTarget) return;
    const { sectionKey: sec, recordIndex, field } = uploadTarget;
    setUploadError(null);

    const forceQuality = shouldCheckImageQuality(field.config, definition.ai.enabled, aiImageQuality);
    const forceDuplicates = shouldBlockDuplicates(field.config, definition.evidence.preventDuplicates, aiDuplicateDetection);
    const qualityRequirement = field.config.imageQualityRequirement ?? "standard";
    try {
      const { url } = await evidenceUpload.upload(
        file,
        evidencePolicy
          ? uploadOptionsForPolicy(
              evidencePolicy,
              parseDeviceMetadata(auditEvidenceValues(responses)[DEVICE_METADATA_KEY])?.openedAt ?? null,
              { forceQuality, forceDuplicates, qualityRequirement },
            )
          : { checkQuality: forceQuality, qualityRequirement, checkDuplicates: forceDuplicates, onProblem: "block" },
      );
      const existing = responses[sec]?.[recordIndex]?.[field.key];
      const list = Array.isArray(existing) ? [...existing, url] : [url];
      await setValue(sec, recordIndex, field, list);
      toast.success("Evidence uploaded.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not upload image.";
      setUploadError(msg);
      toast.error(msg, { duration: 6000 });
    } finally {
      setUploadTarget(null);
    }
  };

  const currentValues = {
    ...(responses[sectionKey]?.[activeRecord] ?? {}),
    ...computeCalculatedValues(definition, responses[sectionKey]?.[activeRecord] ?? {}),
  };

  const physicalQty = Number(
    currentValues.physical_qty ?? currentValues.actual_qty ?? currentValues.actual_quantity ?? 0,
  );
  const imageFields = definition.fields.filter((f) => isImageField(f.type));
  const verifiedUnits = imageFields.reduce((max, f) => {
    const imgs = responses[sectionKey]?.[activeRecord]?.[f.key];
    const count = Array.isArray(imgs) ? imgs.length : imgs ? 1 : 0;
    return Math.max(max, count);
  }, 0);
  const expiryCoverageEnabled = definition.evidence.expiryUnitCoverage && physicalQty > 0;
  const skuLabel =
    String(currentValues.item_name ?? currentValues.sku_id ?? "") || `SKU ${activeRecord + 1}`;

  const renderField = (field: TemplateField, sec: string, idx: number) => {
    if (field.system) return null;
    if (!isFieldVisible(field, currentValues as Record<string, string | number>)) return null;

    const val = responses[sec]?.[idx]?.[field.key];
    const fieldReadOnly = readOnly || isFieldReadOnlyForAuditor(field);
    const role = resolveFieldRole(field);
    const roleChip = EXECUTION_ROLE_CHIPS[role];
    const roleBadge = roleChip ? (
      <Badge
        variant="outline"
        className="ml-2 text-[9px] text-[#04203F]"
        style={{ background: roleChip.tint, borderColor: roleChip.border }}
      >
        {roleChip.label}
      </Badge>
    ) : (
      <Badge variant="outline" className="ml-2 text-[9px]">
        {FIELD_ROLE_BADGE_LABELS[role]}
      </Badge>
    );

    if (field.calculated) {
      const computed = computeCalculatedValues(definition, responses[sec]?.[idx] ?? {});
      return (
        <div key={field.id}>
          <Label className="text-sm">
            {field.label}
            <Badge variant="outline" className="ml-2 text-[9px]">
              CALCULATED
            </Badge>
          </Label>
          <Input
            readOnly
            className="mt-1 bg-muted/40"
            value={String(computed[field.key] ?? "—")}
          />
        </div>
      );
    }

    if (field.type === "qc_status" || field.type === "dropdown") {
      const options = field.config.options ?? ["Pass", "Fail"];
      return (
        <div key={field.id}>
          <Label className="text-sm">
            {field.label}
            {field.required ? <span className="text-destructive"> *</span> : null}
          </Label>
          <Select
            disabled={fieldReadOnly}
            value={String(val ?? "")}
            onValueChange={(v) => void setValue(sec, idx, field, v)}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (field.type === "rca") {
      return (
        <div key={field.id}>
          <Label className="text-sm">
            {field.label}
            {field.required ? <span className="text-destructive"> *</span> : null}
            {roleBadge}
          </Label>
          <Select
            disabled={fieldReadOnly}
            value={String(val ?? "")}
            onValueChange={(v) => void setValue(sec, idx, field, v)}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select RCA…" />
            </SelectTrigger>
            <SelectContent>
              {RCA_OPTIONS.map((o) => (
                <SelectItem key={o.code} value={o.code}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (isImageField(field.type)) {
      const images = Array.isArray(val) ? val : val ? [String(val)] : [];
      const min = field.config.minImages ?? 1;
      const max = field.config.maxImages ?? 8;
      return (
        <div key={field.id}>
          <Label className="text-sm">
            {field.label}
            {field.required ? <span className="text-destructive"> *</span> : null}
          </Label>
          <p className="text-xs text-muted-foreground">
            {images.length} / {min} minimum · max {max}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {images.map((url, i) => (
              <EvidenceImage key={i} stored={url} />
            ))}
            {!fieldReadOnly && images.length < max ? (
              <Button
                type="button"
                variant="outline"
                className="size-16"
                disabled={uploading}
                onClick={() => {
                  setUploadError(null);
                  setUploadTarget({ sectionKey: sec, recordIndex: idx, field });
                  fileRef.current?.click();
                }}
              >
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
              </Button>
            ) : null}
          </div>
          {uploadTarget?.field.id === field.id &&
          uploadTarget.sectionKey === sec &&
          uploadTarget.recordIndex === idx &&
          uploadError ? (
            <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              {uploadError}
            </p>
          ) : null}
          {(field.config.imageQualityCheck ||
            field.config.duplicateDetection ||
            definition.evidence.preventDuplicates) &&
          !readOnly ? (
            <p className="mt-1 text-[10px] text-muted-foreground">
              {field.config.imageQualityCheck || aiImageQuality ? "Quality check on upload" : ""}
              {(field.config.imageQualityCheck || aiImageQuality) &&
              (field.config.duplicateDetection ||
                definition.evidence.preventDuplicates ||
                aiDuplicateDetection)
                ? " · "
                : ""}
              {field.config.duplicateDetection ||
              definition.evidence.preventDuplicates ||
              aiDuplicateDetection
                ? "Duplicates blocked"
                : ""}
            </p>
          ) : null}
        </div>
      );
    }

    if (field.type === "long_text" || field.type === "notes" || field.type === "remarks") {
      return (
        <div key={field.id}>
          <Label className="text-sm">
            {field.label}
            {field.required ? <span className="text-destructive"> *</span> : null}
          </Label>
          <Textarea
            disabled={fieldReadOnly}
            className="mt-1"
            rows={3}
            value={String(val ?? "")}
            onChange={(e) => void setValue(sec, idx, field, e.target.value)}
          />
        </div>
      );
    }

    const inputType =
      field.type.includes("date") || field.type === "mfg_date" || field.type === "expiry_date"
        ? "date"
        : field.type.includes("qty") || field.type === "number"
          ? "number"
          : "text";

    return (
      <div key={field.id}>
        <Label className="text-sm">
          {field.label}
          {field.required ? <span className="text-destructive"> *</span> : null}
          {roleBadge}
        </Label>
        <Input
          disabled={fieldReadOnly}
          readOnly={fieldReadOnly && field.fieldRole === "reference"}
          type={inputType}
          className={fieldReadOnly && field.fieldRole === "reference" ? "mt-1 bg-muted/40" : "mt-1"}
          placeholder={field.config.placeholder}
          value={String(val ?? "")}
          onChange={(e) =>
            void setValue(
              sec,
              idx,
              field,
              inputType === "number" ? Number(e.target.value) : e.target.value,
            )
          }
        />
        {field.config.helpText ? (
          <p className="mt-0.5 text-[10px] text-muted-foreground">{field.config.helpText}</p>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-4 pb-28">
      {testMode ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-center text-sm font-medium text-amber-800 dark:text-amber-300">
          TEST MODE — sample data only, not saved to production audits
        </div>
      ) : null}

      <RequiredInputsSummary definition={definition} />

      {definition.purpose === "shelf_stacking_audit" ? (
        <ShelfStackingVisual
          expectedRows={3}
          expectedCols={4}
          expectedSku={String(recordContexts[activeRecord]?.values.sku_id ?? "SKU")}
          actualCells={[]}
          expectedTotal={Number(recordContexts[activeRecord]?.values.expected_facing ?? 0) || undefined}
          actualTotal={Number(recordContexts[activeRecord]?.values.actual_facing ?? 0) || undefined}
          className="mb-4"
        />
      ) : null}

      <div className="sticky top-0 z-10 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">{templateName}</h2>
            <p className="text-sm text-muted-foreground">
              {storeName ? `Store: ${storeName}` : null}
              {dueAt ? ` · Due: ${new Date(dueAt).toLocaleString()}` : null}
            </p>
            {repeatableSection ? (
              <p className="mt-1 text-sm font-medium">{skuLabel}</p>
            ) : null}
          </div>
          <div className="text-right">
            <Badge variant={completion.complete ? "secondary" : "outline"}>
              Audit Completion {completion.percent}%
            </Badge>
            {!completion.complete ? (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                {completion.missing.length} required item(s) remaining
              </p>
            ) : null}
          </div>
        </div>
        {expiryCoverageEnabled ? (
          <div className="mt-3 rounded-lg border border-brand/20 bg-brand/5 px-3 py-2 text-xs">
            <span className="font-medium">Expiry Verification:</span>{" "}
            {verifiedUnits} / {physicalQty} units verified
            {verifiedUnits < physicalQty ? (
              <span className="text-amber-700 dark:text-amber-400">
                {" "}
                — each unit needs expiry evidence before completion
              </span>
            ) : null}
          </div>
        ) : null}
        {!completion.complete ? (
          <ul className="mt-2 space-y-1 text-xs text-amber-700 dark:text-amber-400">
            {completion.missing.slice(0, 5).map((m) => (
              <li key={`${m.sectionKey}-${m.recordIndex}-${m.fieldKey}`}>Missing: {m.label}</li>
            ))}
          </ul>
        ) : null}
      </div>

      {repeatableSection ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge variant="outline" className="text-sm">
            {repeatableSection.repeatBy === "sku" ? "SKU" : "Record"} {activeRecord + 1} of{" "}
            {records.length}
          </Badge>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={activeRecord === 0}
              onClick={() => setActiveRecord((r) => Math.max(0, r - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              size="sm"
              variant="brand"
              disabled={activeRecord >= records.length - 1}
              onClick={() => setActiveRecord((r) => Math.min(records.length - 1, r + 1))}
            >
              Next SKU →
            </Button>
          </div>
          {!readOnly && !previewMode ? (
            <Button type="button" size="sm" variant="outline" onClick={addSkuRecord}>
              <Plus className="mr-1 size-3" /> Add Another SKU
            </Button>
          ) : null}
        </div>
      ) : null}

      {definition.sections
        .sort((a, b) => a.order - b.order)
        .map((section) => {
          const idx = section.repeatable ? activeRecord : 0;
          const fields = definition.fields
            .filter((f) => f.section === section.key)
            .sort((a, b) => a.order - b.order);

          return (
            <section key={section.key} className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-4 font-semibold">{section.title}</h3>
              <div className="space-y-4">
                {fields.map((f) => renderField(f, section.key, idx))}
              </div>
            </section>
          );
        })}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImageUpload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function EvidenceImage({ stored, className }: { stored: string; className?: string }) {
  const [src, setSrc] = useState(stored);

  useEffect(() => {
    let active = true;
    void resolveAuditEvidenceUrl(stored).then((url) => {
      if (active) setSrc(url);
    });
    return () => {
      active = false;
    };
  }, [stored]);

  return (
    <img
      src={src}
      alt=""
      className={className ?? "size-16 rounded-md border border-border object-cover"}
    />
  );
}
