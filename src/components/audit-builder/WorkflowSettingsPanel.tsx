import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { AiConfig, EvidenceConfig, ScoringConfig, WorkflowSettings } from "@/lib/audit-builder/types";

type Props = {
  workflow: WorkflowSettings;
  evidence: EvidenceConfig;
  scoring: ScoringConfig;
  ai: AiConfig;
  onWorkflowChange: (w: WorkflowSettings) => void;
  onEvidenceChange: (e: EvidenceConfig) => void;
  onScoringChange: (s: ScoringConfig) => void;
  onAiChange: (a: AiConfig) => void;
};

const AI_FEATURES = [
  { key: "productDetection", label: "Product Detection" },
  { key: "skuIdentification", label: "SKU Identification" },
  { key: "quantityDetection", label: "Quantity Detection" },
  { key: "expiryOcr", label: "Expiry OCR" },
  { key: "batchOcr", label: "Batch OCR" },
  { key: "defectDetection", label: "Defect Detection" },
  { key: "imageQualityCheck", label: "Image Quality Check" },
  { key: "duplicateEvidenceDetection", label: "Duplicate Evidence Detection" },
];

export function WorkflowSettingsPanel({
  workflow,
  evidence,
  scoring,
  ai,
  onWorkflowChange,
  onEvidenceChange,
  onScoringChange,
  onAiChange,
}: Props) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Audit Workflow</h3>
        <div className="mt-3 space-y-3">
          <div>
            <Label>Submission</Label>
            <Select
              value={workflow.submission ?? "manager_approval"}
              onValueChange={(v) =>
                onWorkflowChange({
                  ...workflow,
                  submission: v as WorkflowSettings["submission"],
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="direct">Employee can submit directly</SelectItem>
                <SelectItem value="manager_approval">Manager approval required</SelectItem>
                <SelectItem value="regional_approval">Regional approval required</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ToggleRow
            label="Auto-create finding on variance"
            checked={workflow.autoFindingOnVariance ?? false}
            onChange={(v) => onWorkflowChange({ ...workflow, autoFindingOnVariance: v })}
          />
          <ToggleRow
            label="Auto-create finding on failed QC"
            checked={workflow.autoFindingOnFailedQc ?? false}
            onChange={(v) => onWorkflowChange({ ...workflow, autoFindingOnFailedQc: v })}
          />
          <ToggleRow
            label="Auto-create finding on expired product"
            checked={workflow.autoFindingOnExpired ?? false}
            onChange={(v) => onWorkflowChange({ ...workflow, autoFindingOnExpired: v })}
          />
          <ToggleRow
            label="SLA enabled"
            checked={workflow.slaEnabled ?? false}
            onChange={(v) => onWorkflowChange({ ...workflow, slaEnabled: v })}
          />
          {workflow.slaEnabled ? (
            <div>
              <Label>SLA hours</Label>
              <Select
                value={String(workflow.slaHours ?? 24)}
                onValueChange={(v) => onWorkflowChange({ ...workflow, slaHours: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[4, 12, 24, 48, 72].map((h) => (
                    <SelectItem key={h} value={String(h)}>
                      {h} hours
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Evidence Settings</h3>
        <div className="mt-3 space-y-3">
          <ToggleRow
            label="Photo required"
            checked={evidence.photoRequired ?? true}
            onChange={(v) => onEvidenceChange({ ...evidence, photoRequired: v })}
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Min photos</Label>
              <Select
                value={String(evidence.minPhotos ?? 1)}
                onValueChange={(v) => onEvidenceChange({ ...evidence, minPhotos: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Max photos</Label>
              <Select
                value={String(evidence.maxPhotos ?? 8)}
                onValueChange={(v) => onEvidenceChange({ ...evidence, maxPhotos: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[3, 5, 8, 10, 15].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <ToggleRow
            label="100% expiry unit coverage"
            checked={evidence.expiryUnitCoverage ?? false}
            onChange={(v) => onEvidenceChange({ ...evidence, expiryUnitCoverage: v })}
          />
          <ToggleRow
            label="Prevent duplicate evidence"
            checked={evidence.preventDuplicates ?? false}
            onChange={(v) => onEvidenceChange({ ...evidence, preventDuplicates: v })}
          />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Scoring</h3>
        <div className="mt-3 space-y-3">
          <ToggleRow
            label="Enable scoring"
            checked={scoring.enabled ?? false}
            onChange={(v) => onScoringChange({ ...scoring, enabled: v })}
          />
          {scoring.enabled ? (
            <>
              <div>
                <Label>Passing score</Label>
                <Select
                  value={String(scoring.passingScore ?? 60)}
                  onValueChange={(v) => onScoringChange({ ...scoring, passingScore: Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[50, 60, 70, 80, 90].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">AI Assistance</h3>
        <ToggleRow
          label="Enable AI for this template"
          checked={ai.enabled ?? false}
          onChange={(v) => onAiChange({ ...ai, enabled: v, features: ai.features ?? {} })}
        />
        {ai.enabled ? (
          <ul className="mt-3 space-y-2">
            {AI_FEATURES.map((feat) => {
              const cfg = ai.features?.[feat.key] ?? { enabled: false, mode: "optional" as const };
              return (
                <li
                  key={feat.key}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs"
                >
                  <span>{feat.label}</span>
                  <Switch
                    checked={cfg.enabled}
                    onCheckedChange={(v) =>
                      onAiChange({
                        ...ai,
                        features: {
                          ...ai.features,
                          [feat.key]: { ...cfg, enabled: v, mode: cfg.mode ?? "optional" },
                        },
                      })
                    }
                  />
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
      <Label className="text-xs">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
