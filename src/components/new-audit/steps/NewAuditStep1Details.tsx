import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NewAuditStepSection } from "@/components/new-audit/NewAuditStepSection";

type Props = {
  auditName: string;
  auditDescription: string;
  onAuditNameChange: (value: string) => void;
  onAuditDescriptionChange: (value: string) => void;
  complete?: boolean;
  error?: string | null;
};

export function NewAuditStep1Details({
  auditName,
  auditDescription,
  onAuditNameChange,
  onAuditDescriptionChange,
  complete,
  error,
}: Props) {
  return (
    <NewAuditStepSection
      id="step-1-details"
      stepNumber={1}
      title="Audit details"
      description="Give this audit a clear name and optional description."
      complete={complete}
      error={error}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="audit-name">
            Audit Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="audit-name"
            value={auditName}
            onChange={(e) => onAuditNameChange(e.target.value)}
            placeholder="e.g. Monthly Shelf Compliance Audit"
            className="rounded-xl"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-description">Description</Label>
          <Textarea
            id="audit-description"
            value={auditDescription}
            onChange={(e) => onAuditDescriptionChange(e.target.value)}
            placeholder="Describe what this audit is intended to check..."
            className="min-h-[88px] rounded-xl"
          />
        </div>
      </div>
    </NewAuditStepSection>
  );
}
