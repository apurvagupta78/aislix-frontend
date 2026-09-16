import { Link } from "@tanstack/react-router";
import { Bot, Camera, Eye, MoreHorizontal, Play, UserPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OPERATING_MODEL_CARDS } from "@/lib/audit-engine/operating-model-catalog";
import { PURPOSE_SECTION_LABELS } from "@/lib/audit-engine/template-catalog-ui";
import type { AuditTemplate } from "@/lib/audit-templates";
import type { SystemTemplateSpec } from "@/lib/audit-engine/template-factory";

export function TemplateCatalogCard({
  spec,
  seeded,
  dbTemplate,
  onPreview,
  onUse,
  compact,
}: {
  spec: SystemTemplateSpec;
  seeded: boolean;
  dbTemplate?: AuditTemplate;
  onPreview: () => void;
  onUse: () => void;
  compact?: boolean;
}) {
  const def = spec.build();
  const modelLabel =
    OPERATING_MODEL_CARDS.find((c) => c.id === spec.operatingModel)?.title ?? spec.operatingModel;
  const purposeLabel = PURPOSE_SECTION_LABELS[spec.purpose] ?? spec.category;

  return (
    <div
      className={`play-card flex flex-col rounded-2xl transition-shadow hover:shadow-md ${compact ? "p-3" : "p-4"}`}
    >
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap gap-1">
            <Badge variant="secondary" className="text-[10px]">
              System Template
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              Read-only
            </Badge>
            {spec.flagship ? (
              <Badge className="text-[10px] bg-brand text-brand-foreground">Flagship</Badge>
            ) : null}
            {seeded ? (
              <Badge variant="outline" className="text-[10px] text-success border-success/30">
                In org library
              </Badge>
            ) : null}
          </div>
          <h3 className={`font-semibold leading-snug ${compact ? "text-sm" : "text-base"}`}>
            {spec.name}
          </h3>
          {!compact ? (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{spec.shortDescription}</p>
          ) : null}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1">
        <Badge variant="outline" className="text-[10px]">
          {modelLabel}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          {purposeLabel}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          {spec.subjectType}
        </Badge>
        {def.ai?.enabled ? (
          <Badge variant="outline" className="text-[10px]">
            <Bot className="mr-0.5 size-3" /> AI
          </Badge>
        ) : null}
        {def.evidence?.photoRequired ? (
          <Badge variant="outline" className="text-[10px]">
            <Camera className="mr-0.5 size-3" /> Evidence
          </Badge>
        ) : null}
      </div>

      <p className="mb-3 text-[11px] text-muted-foreground">
        {def.fields.length} fields · {def.rules.length} rules · {def.sections.length} sections · v
        {dbTemplate?.version ?? "1.0"}
      </p>

      <div className="mt-auto flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={onPreview}>
          <Eye className="mr-1 size-3" /> Preview
        </Button>
        <Button size="sm" variant="brand" onClick={onUse}>
          <Play className="mr-1 size-3" /> Use Template
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link
                to="/new-audit"
                search={{
                  templateId: dbTemplate?.id,
                  systemKey: dbTemplate ? undefined : spec.key,
                  assign: true,
                }}
              >
                <UserPlus className="mr-2 size-3.5" /> Assign
              </Link>
            </DropdownMenuItem>
            {dbTemplate ? (
              <DropdownMenuItem asChild>
                <Link to="/audit-templates/$templateId/preview" params={{ templateId: dbTemplate.id }}>
                  Full preview
                </Link>
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
