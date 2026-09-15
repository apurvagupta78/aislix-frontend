import { Bot, Camera, Shield, Workflow } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import type { TemplateDefinition } from "@/lib/audit-builder/types";
import { OPERATING_MODEL_CARDS } from "@/lib/audit-engine/operating-model-catalog";
import { PURPOSE_SECTION_LABELS } from "@/lib/audit-engine/template-catalog-ui";
import type { SystemTemplateSpec } from "@/lib/audit-engine/template-factory";

export function TemplatePreviewSheet({
  spec,
  open,
  onOpenChange,
}: {
  spec: SystemTemplateSpec | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!spec) return null;
  const def: TemplateDefinition = spec.build();
  const modelLabel =
    OPERATING_MODEL_CARDS.find((c) => c.id === spec.operatingModel)?.title ?? spec.operatingModel;
  const purposeLabel = PURPOSE_SECTION_LABELS[spec.purpose] ?? spec.category;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{spec.name}</SheetTitle>
          <SheetDescription>{spec.shortDescription}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary">System Template · Read-only</Badge>
            {spec.flagship ? <Badge variant="default">Flagship</Badge> : null}
            {spec.recommended ? <Badge variant="outline">Recommended</Badge> : null}
          </div>

          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Operating model</dt>
            <dd className="font-medium">{modelLabel}</dd>
            <dt className="text-muted-foreground">Purpose</dt>
            <dd className="font-medium">{purposeLabel}</dd>
            <dt className="text-muted-foreground">Subject type</dt>
            <dd className="font-medium">{spec.subjectType}</dd>
            <dt className="text-muted-foreground">Version</dt>
            <dd className="font-medium">1.0</dd>
          </dl>

          <Separator />

          <section>
            <h4 className="mb-2 text-sm font-semibold">Sections ({def.sections.length})</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {def.sections.map((s) => (
                <li key={s.id}>· {s.title}</li>
              ))}
            </ul>
          </section>

          <section>
            <h4 className="mb-2 text-sm font-semibold">Fields ({def.fields.length})</h4>
            <div className="flex flex-wrap gap-1">
              {def.fields.slice(0, 12).map((f) => (
                <Badge key={f.id} variant="outline" className="text-[10px]">
                  {f.label}
                </Badge>
              ))}
              {def.fields.length > 12 ? (
                <Badge variant="outline" className="text-[10px]">
                  +{def.fields.length - 12} more
                </Badge>
              ) : null}
            </div>
          </section>

          <section>
            <h4 className="mb-2 flex items-center gap-1 text-sm font-semibold">
              <Shield className="size-3.5" /> Rules ({def.rules.length})
            </h4>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {def.rules.slice(0, 6).map((r) => (
                <li key={r.id}>· {r.name ?? r.id}</li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-border bg-muted/20 p-3 text-sm">
            <h4 className="mb-2 font-semibold">Capabilities</h4>
            <div className="flex flex-wrap gap-2">
              {def.evidence?.photoRequired ? (
                <Badge variant="outline">
                  <Camera className="mr-1 size-3" /> Evidence required
                </Badge>
              ) : (
                <Badge variant="outline">Evidence optional</Badge>
              )}
              {def.ai?.enabled ? (
                <Badge variant="outline">
                  <Bot className="mr-1 size-3" /> AI assist
                </Badge>
              ) : (
                <Badge variant="outline">Digital only</Badge>
              )}
              {def.workflow ? (
                <Badge variant="outline">
                  <Workflow className="mr-1 size-3" /> Workflow configured
                </Badge>
              ) : null}
            </div>
          </section>

          <section className="rounded-xl border border-brand/20 bg-brand-soft/20 p-3">
            <h4 className="mb-1 text-sm font-semibold">Employee View Preview</h4>
            <p className="text-xs text-muted-foreground">
              Auditors will see {def.sections.length} section(s), {def.fields.length} field(s), and{" "}
              {def.evidence?.photoRequired ? "photo evidence capture" : "digital entry"} on mobile.
              {def.ai?.enabled ? " AI will assist detection with human confirmation." : ""}
            </p>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
