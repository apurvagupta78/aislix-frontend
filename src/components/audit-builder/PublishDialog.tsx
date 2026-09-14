import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { summarizePublish } from "@/lib/audit-builder/validation";
import type { TemplateDefinition } from "@/lib/audit-builder/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateName: string;
  version: number;
  definition: TemplateDefinition;
  publishing: boolean;
  onConfirm: () => void;
};

export function PublishDialog({
  open,
  onOpenChange,
  templateName,
  version,
  definition,
  publishing,
  onConfirm,
}: Props) {
  const summary = summarizePublish(definition);
  const nextVersion = version + 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publish Template</DialogTitle>
          <DialogDescription>
            Published templates create a frozen version. In-flight audits keep their original
            configuration.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid gap-2 text-sm">
          <Row label="Template" value={templateName} />
          <Row label="Version" value={`v${nextVersion}`} />
          <Row label="Sections" value={String(definition.sections.length)} />
          <Row label="Fields" value={String(summary.fieldCount)} />
          <Row label="Required fields" value={String(summary.requiredCount)} />
          <Row label="Conditional rules" value={String(summary.ruleCount)} />
          <Row label="Evidence requirements" value={String(summary.evidenceCount)} />
          <Row label="AI features" value={String(summary.aiFeatureCount)} />
        </dl>
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
          Publishing creates a version of this template. Future changes will create a new version
          and will not alter completed historical audits.
        </p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="brand" disabled={publishing} onClick={onConfirm}>
            {publishing ? <Loader2 className="size-4 animate-spin" /> : "Publish Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 rounded-lg border border-border px-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
