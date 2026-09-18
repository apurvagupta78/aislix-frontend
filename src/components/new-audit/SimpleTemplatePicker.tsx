import { useMemo, useState } from "react";
import { Eye, Play, Search } from "lucide-react";

import { PreviewDrawer } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { AuditPurpose, OperatingModel } from "@/lib/audit-builder/types";
import type { AuditTemplate } from "@/lib/audit-templates";
import { OPERATING_MODEL_CARDS } from "@/lib/audit-engine/operating-model-catalog";
import { PURPOSE_SECTION_LABELS } from "@/lib/audit-engine/template-catalog-ui";
import { getDiscoverySections } from "@/lib/audit-engine/template-catalog-ui";
import type { SystemTemplateSpec } from "@/lib/audit-engine/template-factory";
import { TemplatePreviewSheet } from "@/components/audit-engine/TemplatePreviewSheet";
import {
  formatRecentLabel,
  getRecentTemplates,
  type RecentTemplateEntry,
} from "@/lib/new-audit/recent-templates";
import { cn } from "@/lib/utils";

type SourceFilter = "all" | "mine" | "organization" | "aislix";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operatingModel: OperatingModel;
  auditPurpose: AuditPurpose;
  templateChoice: string;
  userId?: string;
  publishedTemplates: AuditTemplate[];
  myTemplates: AuditTemplate[];
  onSelect: (choice: string, meta?: { name: string; systemKey?: string }) => void;
};

function SimpleTemplateCard({
  name,
  description,
  badges,
  selected,
  onUse,
  onPreview,
}: {
  name: string;
  description: string;
  badges: string[];
  selected?: boolean;
  onUse: () => void;
  onPreview?: () => void;
}) {
  return (
    <div
      className={cn(
        "play-card flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--aislix-border)] bg-white p-4 transition-shadow",
        selected && "border-[var(--aislix-local-border)] ring-2 ring-[var(--aislix-local-bg)]",
      )}
    >
      <h3 className="font-display text-[15px] font-semibold leading-snug text-[var(--aislix-primary)]">
        {name}
      </h3>
      {description ? (
        <p className="mt-1 line-clamp-2 text-xs text-[var(--aislix-secondary)]">{description}</p>
      ) : null}
      <div className="mt-2 flex min-w-0 flex-wrap gap-1">
        {badges.map((b) => (
          <Badge
            key={b}
            variant="outline"
            className="border-[var(--aislix-border)] bg-[var(--aislix-surface)] text-[10px] font-semibold text-[var(--aislix-primary)]"
          >
            {b}
          </Badge>
        ))}
      </div>
      <div className="mt-auto flex w-full min-w-0 flex-wrap gap-2 pt-4">
        {onPreview ? (
          <Button
            size="sm"
            variant="outline"
            onClick={onPreview}
            className="min-w-0 flex-1 border-[var(--aislix-border)] bg-white text-[var(--aislix-primary)] hover:bg-[var(--aislix-surface)]"
          >
            <Eye className="size-3 shrink-0" /> Preview
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="default"
          onClick={onUse}
          className="min-w-0 flex-1 bg-[var(--aislix-primary)] text-white hover:bg-[#1B3B58]"
        >
          <Play className="size-3 shrink-0" /> Use Template
        </Button>
      </div>
    </div>
  );
}

export function SimpleTemplatePicker({
  open,
  onOpenChange,
  operatingModel,
  auditPurpose,
  templateChoice,
  userId,
  publishedTemplates,
  myTemplates,
  onSelect,
}: Props) {
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<SourceFilter>("all");
  const [previewSpec, setPreviewSpec] = useState<SystemTemplateSpec | null>(null);

  const discovery = useMemo(
    () => getDiscoverySections(operatingModel, auditPurpose, search, false, false),
    [operatingModel, auditPurpose, search],
  );

  const recent = getRecentTemplates(userId, 5);
  const modelLabel =
    OPERATING_MODEL_CARDS.find((c) => c.id === operatingModel)?.title ?? operatingModel;

  const orgTemplates = publishedTemplates.filter(
    (t) => !t.is_system_template && t.visibility === "organization",
  );

  const filterSpec = (spec: SystemTemplateSpec) => {
    const term = search.trim().toLowerCase();
    if (term && !spec.name.toLowerCase().includes(term) && !spec.shortDescription.toLowerCase().includes(term)) {
      return false;
    }
    if (source === "mine" || source === "organization") return false;
    return true;
  };

  const filterDb = (t: AuditTemplate) => {
    const term = search.trim().toLowerCase();
    if (term && !t.name.toLowerCase().includes(term)) return false;
    if (source === "aislix") return t.is_system_template;
    if (source === "mine") return myTemplates.some((m) => m.id === t.id);
    if (source === "organization") return t.visibility === "organization" && !t.is_system_template;
    return true;
  };

  const recommended = discovery.recommended.filter(filterSpec);
  const allSystem = discovery.browseAll.filter(filterSpec);
  const dbVisible = [...publishedTemplates, ...myTemplates]
    .filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i)
    .filter(filterDb);

  function resolveRecent(entry: RecentTemplateEntry) {
    if (entry.systemKey) return `system:${entry.systemKey}`;
    return entry.id;
  }

  function badgesForSpec(spec: SystemTemplateSpec) {
    const def = spec.build();
    const out = [modelLabel, PURPOSE_SECTION_LABELS[spec.purpose] ?? spec.category];
    if (def.ai?.enabled) out.push("AI");
    if (def.evidence?.photoRequired) out.push("Evidence");
    return out;
  }

  function badgesForTemplate(t: AuditTemplate) {
    const out: string[] = [];
    const ml = OPERATING_MODEL_CARDS.find((c) => c.id === t.operating_model)?.title;
    if (ml) out.push(ml);
    if (t.audit_purpose) out.push(String(t.audit_purpose));
    if (t.ai_config?.enabled) out.push("AI");
    if (t.evidence_required) out.push("Evidence");
    if (t.is_system_template) out.push("Aislix");
    else if (t.visibility === "private") out.push("My Template");
    else out.push("Organization");
    return out;
  }

  const chips: { id: SourceFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "mine", label: "My Templates" },
    { id: "organization", label: "Organization" },
    { id: "aislix", label: "Aislix Templates" },
  ];

  return (
    <>
      <PreviewDrawer
        open={open}
        onOpenChange={onOpenChange}
        title="Choose an audit template"
        description="Pick a ready-made workflow for your operating model."
        className="sm:max-w-2xl"
      >
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--aislix-secondary)]" />
          <Input
            className="rounded-xl border-[var(--aislix-border)] bg-white pl-9 text-[var(--aislix-primary)] placeholder:text-[var(--aislix-secondary)]"
            placeholder="Search templates…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {recent.length > 0 ? (
          <section className="mb-6">
            <h3 className="mb-2 font-display text-sm font-semibold text-[var(--aislix-primary)]">
              Recently Used
            </h3>
            <div className="space-y-2">
              {recent.map((entry) => (
                <button
                  key={`${entry.id}-${entry.systemKey}`}
                  type="button"
                  className="flex w-full items-center justify-between rounded-xl border border-[var(--aislix-border)] bg-white px-3 py-2 text-left hover:bg-[var(--aislix-surface)]"
                  onClick={() => {
                    onSelect(resolveRecent(entry), { name: entry.name, systemKey: entry.systemKey });
                    onOpenChange(false);
                  }}
                >
                  <span className="text-sm font-medium text-[var(--aislix-primary)]">{entry.name}</span>
                  <span className="text-xs text-[var(--aislix-secondary)]">
                    {formatRecentLabel(entry.usedAt)}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {recommended.length > 0 ? (
          <section className="mb-6">
            <h3 className="mb-1 font-display text-sm font-semibold text-[var(--aislix-primary)]">
              Recommended for you
            </h3>
            <p className="mb-3 text-xs text-[var(--aislix-secondary)]">Based on {modelLabel}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {recommended.slice(0, 4).map((spec) => (
                <SimpleTemplateCard
                  key={spec.key}
                  name={spec.name}
                  description={spec.shortDescription}
                  badges={badgesForSpec(spec)}
                  selected={templateChoice === `system:${spec.key}`}
                  onPreview={() => setPreviewSpec(spec)}
                  onUse={() => {
                    onSelect(`system:${spec.key}`, { name: spec.name, systemKey: spec.key });
                    onOpenChange(false);
                  }}
                />
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <h3 className="mb-3 font-display text-sm font-semibold text-[var(--aislix-primary)]">
            All templates
          </h3>
          <div className="mb-3 flex flex-wrap gap-2">
            {chips.map((chip) => (
              <Button
                key={chip.id}
                type="button"
                size="sm"
                variant={source === chip.id ? "default" : "outline"}
                className={cn(
                  "rounded-full",
                  source === chip.id
                    ? "border-[var(--aislix-primary)] bg-[var(--aislix-primary)] text-white hover:bg-[#1B3B58]"
                    : "border-[var(--aislix-border)] bg-white text-[var(--aislix-primary)] hover:bg-[var(--aislix-surface)]",
                )}
                onClick={() => setSource(chip.id)}
              >
                {chip.label}
              </Button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {source !== "mine" && source !== "organization"
              ? allSystem.slice(0, source === "aislix" ? 24 : 12).map((spec) => (
                  <SimpleTemplateCard
                    key={spec.key}
                    name={spec.name}
                    description={spec.shortDescription}
                    badges={badgesForSpec(spec)}
                    selected={templateChoice === `system:${spec.key}`}
                    onPreview={() => setPreviewSpec(spec)}
                    onUse={() => {
                      onSelect(`system:${spec.key}`, { name: spec.name, systemKey: spec.key });
                      onOpenChange(false);
                    }}
                  />
                ))
              : null}
            {dbVisible.map((t) => (
              <SimpleTemplateCard
                key={t.id}
                name={t.name}
                description={t.short_description ?? t.description ?? ""}
                badges={badgesForTemplate(t)}
                selected={templateChoice === t.id}
                onUse={() => {
                  onSelect(t.id, { name: t.name });
                  onOpenChange(false);
                }}
              />
            ))}
          </div>
        </section>
      </PreviewDrawer>

      <TemplatePreviewSheet
        spec={previewSpec}
        open={previewSpec !== null}
        onOpenChange={(o) => !o && setPreviewSpec(null)}
      />
    </>
  );
}
