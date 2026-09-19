import { NewAuditStepSection } from "@/components/new-audit/NewAuditStepSection";
import { AdvancedSettingsPanel } from "@/components/new-audit/AdvancedSettingsPanel";
import type {
  AuditEvidencePolicy,
  EvidenceLevel,
  EvidenceProof,
} from "@/lib/audit-evidence-policy";

type Props = {
  evidenceLevel: EvidenceLevel;
  evidencePolicy: AuditEvidencePolicy;
  requireRca: boolean;
  onEvidenceLevelChange: (level: EvidenceLevel) => void;
  onToggleProof: (proof: EvidenceProof, checked: boolean) => void;
  onEvidencePolicyChange: (patch: Partial<AuditEvidencePolicy>) => void;
  onRequireRcaChange: (value: boolean) => void;
  complete?: boolean;
  error?: string | null;
};

export function NewAuditStep6Evidence({
  evidenceLevel,
  evidencePolicy,
  requireRca,
  onEvidenceLevelChange,
  onToggleProof,
  onEvidencePolicyChange,
  onRequireRcaChange,
  complete,
  error,
}: Props) {
  return (
    <NewAuditStepSection
      id="step-6-evidence"
      stepNumber={6}
      title="Evidence Level"
      description="Configure proof requirements for this audit."
      complete={complete}
      error={error}
    >
      <AdvancedSettingsPanel
        defaultOpen
        evidenceLevel={evidenceLevel}
        evidencePolicy={evidencePolicy}
        requireRca={requireRca}
        onEvidenceLevelChange={onEvidenceLevelChange}
        onToggleProof={onToggleProof}
        onEvidencePolicyChange={onEvidencePolicyChange}
        onRequireRcaChange={onRequireRcaChange}
      />
    </NewAuditStepSection>
  );
}
