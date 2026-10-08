import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EVIDENCE_PROOF_OPTIONS,
  PHOTO_AGE_OPTIONS,
  QUALITY_CHECK_OPTIONS,
  REVIEW_MODE_OPTIONS,
  photoAgeLabel,
  policyNearExpiryDays,
  policyNeedsBarcodeColumn,
  policyNeedsShelfColumn,
  policyUsesShelfColumn,
  type AuditEvidencePolicy,
  type EvidenceLevel,
} from "@/lib/audit-evidence-policy";
import type { AuditInputDataset } from "@/lib/audit-input-dataset";
import { distinctShelves } from "@/lib/audit-engine/grid-evidence";

type Props = {
  evidenceLevel: EvidenceLevel;
  evidencePolicy: AuditEvidencePolicy;
  requireRca: boolean;
  onEvidenceLevelChange: (level: EvidenceLevel) => void;
  onToggleProof: (proof: AuditEvidencePolicy["requiredProof"][number], checked: boolean) => void;
  onEvidencePolicyChange: (patch: Partial<AuditEvidencePolicy>) => void;
  onRequireRcaChange: (value: boolean) => void;
  /** Uploaded file for spreadsheet audits; enables the shelf and barcode column pickers. */
  dataset?: AuditInputDataset | null;
  shelfColumnId?: string | null;
  barcodeColumnId?: string | null;
  onShelfColumnChange?: (columnId: string | null) => void;
  onBarcodeColumnChange?: (columnId: string | null) => void;
  members?: Array<{ user_id: string; name: string }>;
  reviewerId?: string;
  onReviewerChange?: (userId: string) => void;
};

const SELECTED_CARD = "border-[var(--aislix-primary)] bg-white";
const UNSELECTED_CARD = "border-[#D9E2E8] bg-white";
const NONE = "__none__";
const NEAR_EXPIRY_OPTIONS = [0, 3, 7, 14, 30];

function ColumnPicker({
  label,
  hint,
  required,
  columns,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  required: boolean;
  columns: AuditInputDataset["columns"];
  value: string | null | undefined;
  onChange: (columnId: string | null) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required ? <span className="text-[#667085]"> *</span> : null}
      </Label>
      <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
        <SelectTrigger aria-label={label}>
          <SelectValue placeholder="Choose a column" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{required ? "Choose a column" : "None"}</SelectItem>
          {columns.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-[#667085]">{hint}</p>
    </div>
  );
}

export function AdvancedSettingsPanel({
  evidenceLevel,
  evidencePolicy,
  requireRca,
  onEvidenceLevelChange,
  onToggleProof,
  onEvidencePolicyChange,
  onRequireRcaChange,
  dataset,
  shelfColumnId,
  barcodeColumnId,
  onShelfColumnChange,
  onBarcodeColumnChange,
  members,
  reviewerId,
  onReviewerChange,
}: Props) {
  const fileColumns = dataset?.columns ?? [];
  const showShelfPicker =
    Boolean(onShelfColumnChange) && fileColumns.length > 0 && policyUsesShelfColumn(evidencePolicy);
  const showBarcodePicker =
    Boolean(onBarcodeColumnChange) &&
    fileColumns.length > 0 &&
    policyNeedsBarcodeColumn(evidencePolicy);
  const shelfCount = distinctShelves(dataset, shelfColumnId ?? null).length;
  const barcodeCount = barcodeColumnId
    ? (dataset?.rows ?? []).filter((r) => (r.values[barcodeColumnId] ?? "").trim()).length
    : 0;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Evidence level</Label>
        <RadioGroup
          value={evidenceLevel}
          onValueChange={(v) => onEvidenceLevelChange(v as EvidenceLevel)}
          className="grid grid-cols-2 gap-2 md:grid-cols-4"
        >
          {(["basic", "standard", "high", "custom"] as EvidenceLevel[]).map((level) => (
            <Label
              key={level}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 capitalize ${
                evidenceLevel === level ? SELECTED_CARD : UNSELECTED_CARD
              }`}
            >
              <RadioGroupItem value={level} /> {level === "high" ? "High assurance" : level}
            </Label>
          ))}
        </RadioGroup>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {EVIDENCE_PROOF_OPTIONS.map((proof) => {
          const checked = evidencePolicy.requiredProof.includes(proof.value);
          return (
            <Label
              key={proof.value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${
                checked ? SELECTED_CARD : UNSELECTED_CARD
              }`}
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(value) => onToggleProof(proof.value, value === true)}
              />
              <span>
                <span className="block text-sm font-medium">{proof.label}</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {proof.description}
                </span>
              </span>
            </Label>
          );
        })}
      </div>

      {evidencePolicy.requiredProof.includes("expiry_date") ? (
        <div className="grid gap-4 rounded-xl border border-[#D9E2E8] bg-[#F4F7F9] p-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Near expiry warning</Label>
            <Select
              value={String(policyNearExpiryDays(evidencePolicy))}
              onValueChange={(v) => onEvidencePolicyChange({ nearExpiryDays: Number(v) })}
            >
              <SelectTrigger aria-label="Near expiry warning">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NEAR_EXPIRY_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n === 0 ? "Only expired items" : `${n} day${n === 1 ? "" : "s"} or less left`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-[#667085]">
              Products this close to their date are flagged “Near expiry”.
            </p>
          </div>
          <p className="self-center text-xs text-[#667085]">
            The auditee photographs the expiry date on every product and AI reads it. Anything past
            today’s date is marked EXPIRED and must be removed from the shelf, with a photo, before
            the audit can be submitted.
          </p>
        </div>
      ) : null}

      {evidencePolicy.requiredProof.includes("gps") || evidencePolicy.requiredProof.includes("barcode") ? (
        <div className="grid gap-4 rounded-xl border border-[#D9E2E8] bg-[#F4F7F9] p-4 md:grid-cols-2">
          {evidencePolicy.requiredProof.includes("gps") ? (
            <Label className="flex cursor-pointer items-start gap-3">
              <Checkbox
                checked={evidencePolicy.blockOutsideStore === true}
                onCheckedChange={(v) => onEvidencePolicyChange({ blockOutsideStore: v === true })}
              />
              <span>
                <span className="block text-sm font-medium">Block submit outside the store</span>
                <span className="block text-xs font-normal text-[#667085]">
                  The auditee can&apos;t submit while their location is outside the store area. Stores
                  without a location set are not checked.
                </span>
              </span>
            </Label>
          ) : null}
          {evidencePolicy.requiredProof.includes("barcode") ? (
            <Label className="flex cursor-pointer items-start gap-3">
              <Checkbox
                checked={evidencePolicy.blockBarcodeMismatch === true}
                onCheckedChange={(v) => onEvidencePolicyChange({ blockBarcodeMismatch: v === true })}
              />
              <span>
                <span className="block text-sm font-medium">Block submit when a barcode doesn&apos;t match</span>
                <span className="block text-xs font-normal text-[#667085]">
                  Every scanned barcode must match the one in your file. Rows without an expected
                  barcode are not checked.
                </span>
              </span>
            </Label>
          ) : null}
        </div>
      ) : null}

      {showShelfPicker || showBarcodePicker ? (
        <div className="grid gap-4 rounded-xl border border-[#D9E2E8] bg-[#F4F7F9] p-4 md:grid-cols-2">
          {showShelfPicker ? (
            <ColumnPicker
              label="Shelf / location column"
              required={policyNeedsShelfColumn(evidencePolicy)}
              columns={fileColumns}
              value={shelfColumnId}
              onChange={onShelfColumnChange!}
              hint={
                shelfColumnId
                  ? `${shelfCount} ${shelfCount === 1 ? "shelf" : "shelves"} found — the auditee adds a photo for each.`
                  : policyNeedsShelfColumn(evidencePolicy)
                    ? "Which column names the shelf, aisle or location of each row?"
                    : "Optional — pick one to take before/after photos per shelf instead of once."
              }
            />
          ) : null}
          {showBarcodePicker ? (
            <ColumnPicker
              label="Barcode column"
              required={false}
              columns={fileColumns}
              value={barcodeColumnId}
              onChange={onBarcodeColumnChange!}
              hint={
                barcodeColumnId
                  ? `${barcodeCount} row${barcodeCount === 1 ? "" : "s"} with a barcode — each scan is checked against it.`
                  : "Optional — pick the barcode (EAN / UPC) column to check each scan against it. Every row is scanned either way."
              }
            />
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Minimum evidence</Label>
          <Select
            value={String(evidencePolicy.minimumPhotos)}
            onValueChange={(v) => onEvidencePolicyChange({ minimumPhotos: Number(v) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-[#667085]">
            Photos needed for every photo requirement above (each shelf, row, before / after…).
            Fewer blocks Submit.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>Review requirement</Label>
          <Select
            value={evidencePolicy.reviewMode}
            onValueChange={(v) =>
              onEvidencePolicyChange({
                reviewMode: v as AuditEvidencePolicy["reviewMode"],
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REVIEW_MODE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-[#667085]">
            {REVIEW_MODE_OPTIONS.find((o) => o.value === evidencePolicy.reviewMode)?.description}
          </p>
        </div>
        {evidencePolicy.reviewMode === "independent" && onReviewerChange ? (
          <div className="space-y-1.5">
            <Label>
              Reviewer<span className="text-[#667085]"> *</span>
            </Label>
            <Select
              value={reviewerId || NONE}
              onValueChange={(v) => onReviewerChange(v === NONE ? "" : v)}
            >
              <SelectTrigger aria-label="Reviewer">
                <SelectValue placeholder="Choose a reviewer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Choose a reviewer</SelectItem>
                {(members ?? []).map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-[#667085]">
              Managers only. Must be someone other than the auditee.
            </p>
          </div>
        ) : null}
      </div>

      <div className="space-y-3 rounded-xl border border-[#D9E2E8] bg-[#F4F7F9] p-4">
        <div>
          <p className="text-sm font-semibold text-[#04203F]">Photo rules</p>
          <p className="text-xs text-[#667085]">
            Checked on the auditee&apos;s phone when each photo is added, then checked again on the
            Aislix server before the audit can be submitted.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Label className="flex cursor-pointer items-start gap-3">
            <Checkbox
              checked={evidencePolicy.captureSource === "in_app_only"}
              onCheckedChange={(v) =>
                onEvidencePolicyChange({ captureSource: v === true ? "in_app_only" : "either" })
              }
            />
            <span>
              <span className="block text-sm font-medium">Only photos taken during the audit</span>
              <span className="block text-xs font-normal text-[#667085]">
                Old photos from the gallery are rejected — photos must be taken after the audit was
                opened.
              </span>
            </span>
          </Label>
          <div className="space-y-1.5">
            <Label>Photo age limit</Label>
            <Select
              value={String(
                PHOTO_AGE_OPTIONS.includes(evidencePolicy.maximumEvidenceAgeMinutes)
                  ? evidencePolicy.maximumEvidenceAgeMinutes
                  : 0,
              )}
              onValueChange={(v) =>
                onEvidencePolicyChange({ maximumEvidenceAgeMinutes: Number(v) })
              }
            >
              <SelectTrigger aria-label="Photo age limit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PHOTO_AGE_OPTIONS.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {photoAgeLabel(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-[#667085]">
              Photos taken longer ago than this are rejected.
            </p>
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {QUALITY_CHECK_OPTIONS.map((check) => {
            const checked = evidencePolicy.qualityChecks.includes(check.value);
            return (
              <Label
                key={check.value}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${checked ? SELECTED_CARD : UNSELECTED_CARD}`}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) =>
                    onEvidencePolicyChange({
                      qualityChecks:
                        v === true
                          ? [...new Set([...evidencePolicy.qualityChecks, check.value])]
                          : evidencePolicy.qualityChecks.filter((c) => c !== check.value),
                    })
                  }
                />
                <span>
                  <span className="block text-sm font-medium">{check.label}</span>
                  <span className="block text-xs font-normal text-[#667085]">
                    {check.description}
                  </span>
                </span>
              </Label>
            );
          })}
        </div>
      </div>

      <Label className="flex items-start gap-3 rounded-xl border border-brand/30 bg-brand-soft/30 p-4">
        <Checkbox checked={requireRca} onCheckedChange={(v) => onRequireRcaChange(v === true)} />
        <span>
          <span className="block text-sm font-semibold">
            Require explanation for every variance
          </span>
          <span className="block text-xs font-normal text-muted-foreground">
            Auditors must pick a reason wherever their value differs from the provided one before
            submitting.
          </span>
        </span>
      </Label>
    </div>
  );
}
