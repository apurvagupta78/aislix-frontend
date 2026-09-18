import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Bot, Camera, Eye, MoreHorizontal, Play } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OPERATING_MODEL_CARDS } from "@/lib/audit-engine/operating-model-catalog";
import { TEMPLATE_TYPES, type AuditTemplate } from "@/lib/audit-templates";
import { StatusBadge } from "./StatusBadge";

type Props = {
  template: AuditTemplate;
  purposeLabel?: string;
  usageCount?: number;
  onPreview: () => void;
  onUse: () => void;
  advancedMenu?: ReactNode;
  sourceLabel?: string;
};

/** Visual template library card — name, model, purpose, AI/evidence/fields. */
export function TemplateLibraryCard({
  template: t,
  purposeLabel,
  usageCount = 0,
  onPreview,
  onUse,
  advancedMenu,
  sourceLabel,
}: Props) {
  const typeLabel =
    TEMPLATE_TYPES.find((x) => x.value === t.template_type)?.label ?? t.template_type;
  const modelLabel =
    OPERATING_MODEL_CARDS.find((c) => c.id === t.operating_model)?.title ?? t.operating_model;
  const purpose = purposeLabel ?? t.audit_purpose ?? typeLabel;

  return (
    <div className="play-card flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--aislix-border)] bg-white p-4 transition-shadow hover:shadow-md">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap gap-1">
            {sourceLabel ? (
              <Badge variant="secondary" className="text-[10px]">
                {sourceLabel}
              </Badge>
            ) : null}
            {!t.is_system_template && t.visibility === "private" ? (
              <Badge variant="outline" className="text-[10px]">
                Private
              </Badge>
            ) : null}
          </div>
          <h3 className="font-display font-semibold leading-snug text-[var(--aislix-primary)]">{t.name}</h3>
          {(t.short_description || t.description) && (
            <p className="mt-1 line-clamp-2 text-xs text-[var(--aislix-secondary)]">
              {t.short_description ?? t.description}
            </p>
          )}
        </div>
        <StatusBadge kind="template" status={t.status} published={t.published} />
      </div>

      <div className="mb-3 flex flex-wrap gap-1">
        {modelLabel ? (
          <Badge variant="outline" className="text-[10px]">
            {modelLabel}
          </Badge>
        ) : null}
        <Badge variant="outline" className="text-[10px]">
          {purpose}
        </Badge>
        {t.ai_config?.enabled ? (
          <Badge variant="outline" className="gap-0.5 text-[10px]">
            <Bot className="size-3" /> AI
          </Badge>
        ) : null}
        {t.evidence_required ? (
          <Badge variant="outline" className="gap-0.5 text-[10px]">
            <Camera className="size-3" /> Evidence
          </Badge>
        ) : null}
      </div>

      <p className="mb-4 text-[11px] text-muted-foreground">
        {t.field_definitions.length} fields
        {usageCount > 0 ? ` · Used ${usageCount}×` : ""}
        {t.updated_at ? ` · Updated ${new Date(t.updated_at).toLocaleDateString()}` : ""}
      </p>

      <div className="mt-auto flex w-full min-w-0 flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onPreview}
          className="min-w-0 flex-1 border-[var(--aislix-border)] bg-white text-[var(--aislix-primary)] hover:bg-[var(--aislix-surface)] sm:flex-none"
        >
          <Eye className="size-3 shrink-0" /> Preview
        </Button>
        <Button
          size="sm"
          variant="default"
          onClick={onUse}
          className="min-w-0 flex-1 bg-[var(--aislix-primary)] text-white hover:bg-[#1B3B58] sm:flex-none"
        >
          <Play className="size-3 shrink-0" /> Use Template
        </Button>
        {advancedMenu ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 shrink-0 text-[var(--aislix-primary)]">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">{advancedMenu}</DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  );
}

export function templateUseLink(templateId: string) {
  return (
    <Link to="/new-audit" search={{ templateId, systemKey: undefined }}>
      Use Template
    </Link>
  );
}

export function templateAssignLink(templateId: string) {
  return (
    <Link to="/new-audit" search={{ templateId, systemKey: undefined, assign: true }}>
      Assign
    </Link>
  );
}
