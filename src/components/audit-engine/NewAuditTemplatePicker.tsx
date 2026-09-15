import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bot, Camera, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { AuditPurpose, OperatingModel } from "@/lib/audit-builder/types";
import type { AuditTemplate } from "@/lib/audit-templates";
import { toUserMessage } from "@/lib/api/errors";
import { ensureSystemTemplate } from "@/lib/audit-engine/seed-templates";
import { getDiscoverySections } from "@/lib/audit-engine/template-catalog-ui";
import type { SystemTemplateSpec } from "@/lib/audit-engine/template-factory";
import { TemplateCatalogCard } from "./TemplateCatalogCard";
import { TemplatePreviewSheet } from "./TemplatePreviewSheet";
import { UseTemplateConfirmDialog } from "./UseTemplateConfirmDialog";

type Props = {
  operatingModel: OperatingModel;
  auditPurpose: AuditPurpose;
  templateChoice: string;
  onTemplateChoice: (value: string) => void;
  publishedTemplates: AuditTemplate[];
};

function TemplateCard({
  title,
  description,
  badge,
  meta,
  selected,
  onClick,
}: {
  title: string;
  description: string;
  badge?: string;
  meta?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition ${
        selected ? "border-brand bg-brand-soft/40 ring-1 ring-brand/30" : "border-border hover:border-brand/40"
      }`}
    >
      <div className="mb-1 flex flex-wrap items-center gap-1">
        {badge ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">{badge}</span>
        ) : null}
        {meta ? <span className="text-[10px] text-muted-foreground">{meta}</span> : null}
      </div>
      <p className="text-sm font-semibold leading-snug">{title}</p>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{description}</p>
    </button>
  );
}

export function NewAuditTemplatePicker({
  operatingModel,
  auditPurpose,
  templateChoice,
  onTemplateChoice,
  publishedTemplates,
}: Props) {
  const [browseAll, setBrowseAll] = useState(false);
  const [previewSpec, setPreviewSpec] = useState<SystemTemplateSpec | null>(null);
  const [useSpec, setUseSpec] = useState<SystemTemplateSpec | null>(null);

  const discovery = useMemo(
    () => getDiscoverySections(operatingModel, auditPurpose, "", false, false),
    [operatingModel, auditPurpose],
  );

  const publishedForScope = publishedTemplates.filter(
    (t) =>
      (!t.operating_model || t.operating_model === operatingModel) &&
      (!t.audit_purpose || t.audit_purpose === auditPurpose),
  );

  const seededKeySet = useMemo(
    () =>
      new Set(
        publishedTemplates
          .filter((t) => t.is_system_template)
          .map((t) => `${t.operating_model}:${t.name}`),
      ),
    [publishedTemplates],
  );

  const resolveDbTemplate = (spec: SystemTemplateSpec) =>
    publishedTemplates.find(
      (t) =>
        t.is_system_template &&
        (t.purpose_config?.systemTemplateKey === spec.key ||
          (t.operating_model === spec.operatingModel && t.name === spec.name)),
    );

  const useTemplateMutation = useMutation({
    mutationFn: async (spec: SystemTemplateSpec) => {
      const existing = resolveDbTemplate(spec);
      if (existing) return existing;
      const template = await ensureSystemTemplate(spec.key);
      if (!template) throw new Error("Could not seed template");
      return template;
    },
    onSuccess: (template) => {
      setUseSpec(null);
      onTemplateChoice(template.id);
      toast.success("Template selected.");
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const selectSystemSpec = (spec: SystemTemplateSpec) => {
    const existing = resolveDbTemplate(spec);
    if (existing) {
      onTemplateChoice(existing.id);
      return;
    }
    onTemplateChoice(`system:${spec.key}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label>Template</Label>
        <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
          <Link to="/audit-templates">Browse template library →</Link>
        </Button>
      </div>

      <div>
        <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Sparkles className="size-3" /> Recommended
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {discovery.recommended.map((spec) => {
            const dedupeKey = `${spec.operatingModel}:${spec.name}`;
            const selected =
              templateChoice === `system:${spec.key}` ||
              templateChoice === resolveDbTemplate(spec)?.id;
            return (
              <div key={spec.key} className={selected ? "ring-2 ring-brand/30 rounded-2xl" : ""}>
                <TemplateCatalogCard
                  spec={spec}
                  seeded={seededKeySet.has(dedupeKey)}
                  dbTemplate={resolveDbTemplate(spec)}
                  compact
                  onPreview={() => setPreviewSpec(spec)}
                  onUse={() => {
                    if (seededKeySet.has(dedupeKey)) selectSystemSpec(spec);
                    else setUseSpec(spec);
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {publishedForScope.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Seeded in your organization
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {publishedForScope.map((t) => (
              <TemplateCard
                key={t.id}
                title={t.name}
                description={t.short_description ?? t.description ?? ""}
                badge={t.is_system_template ? "Aislix System" : "Organization Template"}
                meta={`v${t.version} · ${t.field_definitions.length} fields`}
                selected={templateChoice === t.id}
                onClick={() => onTemplateChoice(t.id)}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-sm font-medium"
          onClick={() => setBrowseAll((v) => !v)}
        >
          Browse all templates for this purpose ({discovery.browseAll.length})
          {browseAll ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
        {browseAll ? (
          <div className="mt-2 grid max-h-96 gap-3 overflow-y-auto sm:grid-cols-2">
            {discovery.browseAll.map((spec) => {
              const dedupeKey = `${spec.operatingModel}:${spec.name}`;
              return (
                <TemplateCatalogCard
                  key={spec.key}
                  spec={spec}
                  seeded={seededKeySet.has(dedupeKey)}
                  dbTemplate={resolveDbTemplate(spec)}
                  compact
                  onPreview={() => setPreviewSpec(spec)}
                  onUse={() => {
                    if (seededKeySet.has(dedupeKey)) selectSystemSpec(spec);
                    else setUseSpec(spec);
                  }}
                />
              );
            })}
          </div>
        ) : null}
      </div>

      <TemplateCard
        title="Create without template"
        description="Legacy digital/AI flow without a system template definition."
        selected={templateChoice === "general"}
        onClick={() => onTemplateChoice("general")}
      />

      {(templateChoice.startsWith("system:") || templateChoice !== "general") && (
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Camera className="size-3" /> Evidence and rules come from the selected template.
          <Bot className="size-3" /> AI assist enabled when configured on template.
        </p>
      )}

      <TemplatePreviewSheet
        spec={previewSpec}
        open={previewSpec !== null}
        onOpenChange={(open) => !open && setPreviewSpec(null)}
      />

      <UseTemplateConfirmDialog
        spec={useSpec}
        open={useSpec !== null}
        onOpenChange={(open) => !open && setUseSpec(null)}
        seeded={useSpec ? seededKeySet.has(`${useSpec.operatingModel}:${useSpec.name}`) : false}
        existingVersion={useSpec ? resolveDbTemplate(useSpec)?.version : undefined}
        loading={useTemplateMutation.isPending}
        onConfirm={() => useSpec && useTemplateMutation.mutate(useSpec)}
      />
    </div>
  );
}
