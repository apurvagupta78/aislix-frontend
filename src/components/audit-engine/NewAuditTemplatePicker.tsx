import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bot, Camera, ChevronDown, ChevronUp, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { AuditPurpose, OperatingModel } from "@/lib/audit-builder/types";
import type { AuditTemplate } from "@/lib/audit-templates";
import {
  getBrowseAllTemplates,
  getRecommendedTemplates,
  type SystemTemplateSpec,
} from "@/lib/audit-engine/template-factory";

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
          <Badge variant="secondary" className="text-[10px]">
            {badge}
          </Badge>
        ) : null}
        {meta ? <span className="text-[10px] text-muted-foreground">{meta}</span> : null}
      </div>
      <p className="text-sm font-semibold leading-snug">{title}</p>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{description}</p>
    </button>
  );
}

function SystemSpecCard({
  spec,
  selected,
  onSelect,
}: {
  spec: SystemTemplateSpec;
  selected: boolean;
  onSelect: () => void;
}) {
  const def = useMemo(() => spec.build(), [spec]);
  return (
    <TemplateCard
      title={spec.name}
      description={spec.shortDescription}
      badge={spec.flagship ? "Flagship" : spec.recommended ? "Recommended" : "Aislix System"}
      meta={`${def.fields.length} fields · ${def.rules.length} rules${def.ai?.enabled ? " · AI" : ""}${def.evidence?.photoRequired ? " · Evidence" : ""}`}
      selected={selected}
      onClick={onSelect}
    />
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

  const recommended = useMemo(
    () => getRecommendedTemplates(operatingModel, auditPurpose),
    [operatingModel, auditPurpose],
  );
  const browseSpecs = useMemo(
    () => getBrowseAllTemplates(operatingModel, auditPurpose),
    [operatingModel, auditPurpose],
  );
  const publishedForScope = publishedTemplates.filter(
    (t) =>
      (!t.operating_model || t.operating_model === operatingModel) &&
      (!t.audit_purpose || t.audit_purpose === auditPurpose),
  );

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
        <div className="grid gap-2 sm:grid-cols-2">
          {recommended.map((spec) => (
            <SystemSpecCard
              key={spec.key}
              spec={spec}
              selected={templateChoice === `system:${spec.key}`}
              onSelect={() => onTemplateChoice(`system:${spec.key}`)}
            />
          ))}
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
                badge={t.is_system_template ? "Aislix System" : "Customer"}
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
          Browse all templates for this purpose ({browseSpecs.length})
          {browseAll ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
        {browseAll ? (
          <div className="mt-2 grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">
            {browseSpecs.map((spec) => (
              <SystemSpecCard
                key={spec.key}
                spec={spec}
                selected={templateChoice === `system:${spec.key}`}
                onSelect={() => onTemplateChoice(`system:${spec.key}`)}
              />
            ))}
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
    </div>
  );
}
