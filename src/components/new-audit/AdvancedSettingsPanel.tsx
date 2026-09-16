import { ChevronDown } from "lucide-react";

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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  EVIDENCE_PROOF_OPTIONS,
  type AuditEvidencePolicy,
  type EvidenceLevel,
} from "@/lib/audit-evidence-policy";

type Props = {
  evidenceLevel: EvidenceLevel;
  evidencePolicy: AuditEvidencePolicy;
  requireRca: boolean;
  onEvidenceLevelChange: (level: EvidenceLevel) => void;
  onToggleProof: (proof: AuditEvidencePolicy["requiredProof"][number], checked: boolean) => void;
  onEvidencePolicyChange: (patch: Partial<AuditEvidencePolicy>) => void;
  onRequireRcaChange: (value: boolean) => void;
};

export function AdvancedSettingsPanel({
  evidenceLevel,
  evidencePolicy,
  requireRca,
  onEvidenceLevelChange,
  onToggleProof,
  onEvidencePolicyChange,
  onRequireRcaChange,
}: Props) {
  return (
    <Collapsible defaultOpen={false}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3 text-left">
        <span>
          <span className="block text-sm font-semibold">Advanced settings</span>
          <span className="block text-xs text-muted-foreground">
            Evidence, AI, RCA, rules, approval, and scheduling options
          </span>
        </span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-5 rounded-2xl border border-border p-5">
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
                className="flex cursor-pointer items-center gap-2 rounded-xl border p-3 capitalize"
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
                className="flex cursor-pointer items-start gap-3 rounded-xl border p-3"
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
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Minimum photos</Label>
            <Select
              value={String(evidencePolicy.minimumPhotos)}
              onValueChange={(v) =>
                onEvidencePolicyChange({ minimumPhotos: Number(v) })
              }
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
        </div>
        <Label className="flex items-start gap-3 rounded-xl border border-brand/30 bg-brand-soft/30 p-4">
          <Checkbox checked={requireRca} onCheckedChange={(v) => onRequireRcaChange(v === true)} />
          <span>
            <span className="block text-sm font-semibold">
              Require explanation for every variance
            </span>
            <span className="block text-xs font-normal text-muted-foreground">
              Auditors must explain shortages or excess quantities before submitting.
            </span>
          </span>
        </Label>
      </CollapsibleContent>
    </Collapsible>
  );
}
