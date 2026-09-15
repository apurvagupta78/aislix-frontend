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
import { OPERATING_MODEL_CARDS } from "@/lib/audit-engine/operating-model-catalog";
import { PURPOSE_SECTION_LABELS } from "@/lib/audit-engine/template-catalog-ui";
import type { SystemTemplateSpec } from "@/lib/audit-engine/template-factory";

export function UseTemplateConfirmDialog({
  spec,
  open,
  onOpenChange,
  seeded,
  existingVersion,
  loading,
  onConfirm,
}: {
  spec: SystemTemplateSpec | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seeded: boolean;
  existingVersion?: string;
  loading?: boolean;
  onConfirm: () => void;
}) {
  if (!spec) return null;

  const modelLabel =
    OPERATING_MODEL_CARDS.find((c) => c.id === spec.operatingModel)?.title ?? spec.operatingModel;
  const purposeLabel = PURPOSE_SECTION_LABELS[spec.purpose] ?? spec.category;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Use Template</DialogTitle>
          <DialogDescription>
            {seeded
              ? "This system template is already available in your organization."
              : "Seed this Aislix system template into your organization library."}
          </DialogDescription>
        </DialogHeader>

        <dl className="space-y-2 rounded-xl border border-border bg-muted/20 p-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Template</dt>
            <dd className="text-right font-medium">{spec.name}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Operating Model</dt>
            <dd className="font-medium">{modelLabel}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Purpose</dt>
            <dd className="font-medium">{purposeLabel}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Version</dt>
            <dd className="font-medium">{existingVersion ?? "1.0"}</dd>
          </div>
        </dl>

        {seeded ? (
          <p className="text-xs text-muted-foreground">
            No duplicate will be created. You will proceed to New Audit with the existing organization
            template.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            A published system template will be created once. Future uses reuse the same organization
            copy.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="brand" onClick={onConfirm} disabled={loading}>
            {loading ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
            {seeded ? "Continue to New Audit" : "Use Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
