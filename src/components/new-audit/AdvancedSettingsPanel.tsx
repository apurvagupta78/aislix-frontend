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

const SELECTED_CARD =
  "border-[var(--aislix-warehouse-border)] bg-[var(--aislix-warehouse-bg)]/60";
const UNSELECTED_CARD = "border-[#D9E2E8] bg-white";
const NONE = "__none__";

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
  const showShelfPicker = Boolean(onShelfColumnChange) && fileColumns.length > 0 && policyUsesShelfColumn(evidencePolicy);
  const showBarcodePicker = Boolean(onBarcodeColumnChange) && fileColumns.length > 0 && policyNeedsBarcodeColumn(evidencePolicy);
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
              required
              columns={fileColumns}
              value={barcodeColumnId}
              onChange={onBarcodeColumnChange!}
              hint={
                barcodeColumnId
                  ? `${barcodeCount} row${barcodeCount === 1 ? "" : "s"} with a barcode — the auditee scans each one.`
                  : "Which column holds the product barcode (EAN / UPC)?"
              }
            />
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Minimum photos</Label>
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
              <SelectItem value="manager">Manager review</SelectItem>
              <SelectItem value="independent">Independent reviewer</SelectItem>
              <SelectItem value="supervisor_receipt">Supervisor receipt</SelectItem>
              <SelectItem value="none">No additional review</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {evidencePolicy.reviewMode === "independent" && onReviewerChange ? (
          <div className="space-y-1.5">
            <Label>
              Reviewer<span className="text-[#667085]"> *</span>
            </Label>
            <Select value={reviewerId || NONE} onValueChange={(v) => onReviewerChange(v === NONE ? "" : v)}>
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
          </div>
        ) : null}
      </div>
      <Label className="flex items-start gap-3 rounded-xl border border-brand/30 bg-brand-soft/30 p-4">
        <Checkbox checked={requireRca} onCheckedChange={(v) => onRequireRcaChange(v === true)} />
        <span>
          <span className="block text-sm font-semibold">Require explanation for every variance</span>
          <span className="block text-xs font-normal text-muted-foreground">
            Auditors must pick a reason wherever their value differs from the provided one before submitting.
          </span>
        </span>
      </Label>
    </div>
  );
}
