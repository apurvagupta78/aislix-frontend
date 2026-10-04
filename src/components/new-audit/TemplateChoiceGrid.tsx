import { useMemo, useState } from "react";
import { CheckCircle2, Eye, Search } from "lucide-react";

import { TemplatePreviewSheet } from "@/components/audit-engine/TemplatePreviewSheet";
import { Input } from "@/components/ui/input";
import type { OperatingModel } from "@/lib/audit-builder/types";
import type { AuditTemplate } from "@/lib/audit-templates";
import { OPERATING_MODEL_CARDS } from "@/lib/audit-engine/operating-model-catalog";
import { PURPOSE_SECTION_LABELS } from "@/lib/audit-engine/template-catalog-ui";
import {
  getBrowseAllTemplates,
  getSystemTemplateSpec,
  type SystemTemplateSpec,
} from "@/lib/audit-engine/template-factory";
import { cn } from "@/lib/utils";

type Props = {
  operatingModel: OperatingModel;
  templateChoice: string;
  /** Organisation + personal templates already filtered to this operating model. */
  savedTemplates: AuditTemplate[];
  onSelect: (choice: string, meta: { name: string; systemKey?: string }) => void;
};

function systemKeyOf(t: AuditTemplate): string | undefined {
  const raw = t.purpose_config?.systemTemplateKey;
  return typeof raw === "string" ? raw : undefined;
}

function TemplateTile({
  name,
  description,
  tag,
  selected,
  onUse,
  onPreview,
}: {
  name: string;
  description: string;
  tag?: string;
  selected: boolean;
  onUse: () => void;
  onPreview: () => void;
}) {
  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-col rounded-xl border bg-white p-3 transition-colors",
        selected
          ? "border-[var(--aislix-primary)] bg-[#F4F7F9] ring-1 ring-[var(--aislix-primary)]"
          : "border-[var(--aislix-border)] hover:border-[#7DB7D6]",
      )}
    >
      <button type="button" onClick={onUse} className="min-w-0 text-left" aria-pressed={selected}>
        <span className="flex items-start gap-2">
          <span className="min-w-0 flex-1 text-sm font-semibold leading-snug text-[var(--aislix-primary)]">
            {name}
          </span>
          {selected ? <CheckCircle2 className="size-4 shrink-0 text-[var(--aislix-primary)]" /> : null}
        </span>
        {description ? (
          <span className="mt-1 line-clamp-2 block text-xs text-[var(--aislix-secondary)]">{description}</span>
        ) : null}
      </button>
      <div className="mt-2 flex items-center gap-2 pt-1">
        {tag ? (
          <span className="rounded-full border border-[var(--aislix-border)] px-2 py-0.5 text-[10px] font-semibold text-[var(--aislix-secondary)]">
            {tag}
          </span>
        ) : null}
        <button
          type="button"
          onClick={onPreview}
          className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-[var(--aislix-secondary)] hover:text-[var(--aislix-primary)]"
        >
          <Eye className="size-3" /> Preview
        </button>
        <button
          type="button"
          onClick={onUse}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-semibold",
            selected
              ? "bg-[var(--aislix-primary)] text-white"
              : "border border-[var(--aislix-border)] text-[var(--aislix-primary)] hover:bg-[#F4F7F9]",
          )}
        >
          {selected ? "Selected" : "Use"}
        </button>
      </div>
    </div>
  );
}

/** Every template for the chosen operating model, grouped by purpose, picked in place. */
export function TemplateChoiceGrid({ operatingModel, templateChoice, savedTemplates, onSelect }: Props) {
  const [search, setSearch] = useState("");
  const [previewSpec, setPreviewSpec] = useState<SystemTemplateSpec | null>(null);
  const modelLabel = OPERATING_MODEL_CARDS.find((c) => c.id === operatingModel)?.title ?? "this operation";
  const term = search.trim().toLowerCase();

  const systemSpecs = useMemo(() => getBrowseAllTemplates(operatingModel), [operatingModel]);
  const groups = useMemo(() => {
    const matching = systemSpecs.filter(
      (s) => !term || s.name.toLowerCase().includes(term) || s.shortDescription.toLowerCase().includes(term),
    );
    const byPurpose = new Map<string, SystemTemplateSpec[]>();
    for (const spec of matching) {
      const label = PURPOSE_SECTION_LABELS[spec.purpose] ?? spec.category;
      byPurpose.set(label, [...(byPurpose.get(label) ?? []), spec]);
    }
    return [...byPurpose.entries()];
  }, [systemSpecs, term]);

  const saved = useMemo(() => {
    const systemKeys = new Set(systemSpecs.map((s) => s.key));
    const systemNames = new Set(systemSpecs.map((s) => s.name));
    return savedTemplates.filter((t) => {
      if (term && !t.name.toLowerCase().includes(term)) return false;
      const key = systemKeyOf(t);
      if (key && systemKeys.has(key)) return false;
      if (t.is_system_template && systemNames.has(t.name)) return false;
      return true;
    });
  }, [savedTemplates, systemSpecs, term]);

  const total = groups.reduce((n, [, specs]) => n + specs.length, 0) + saved.length;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{modelLabel} templates</h2>
          <p className="text-sm text-muted-foreground">
            Pick the template that fits this audit. Its fields appear below so you can set up the lines.
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--aislix-secondary)]" />
          <Input
            className="h-9 rounded-lg border-[var(--aislix-border)] bg-white pl-9 text-sm"
            placeholder="Search templates…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {total === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--aislix-border)] bg-[#F4F7F9] px-4 py-6 text-center text-sm text-[var(--aislix-secondary)]">
          No templates match “{search}”.
        </p>
      ) : null}

      {saved.length ? (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--aislix-secondary)]">
            Your templates
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {saved.map((t) => (
              <TemplateTile
                key={t.id}
                name={t.name}
                description={t.short_description ?? t.description ?? ""}
                tag={t.visibility === "private" ? "My template" : "Organisation"}
                selected={templateChoice === t.id}
                onUse={() => onSelect(t.id, { name: t.name })}
                onPreview={() => {
                  const key = systemKeyOf(t);
                  const spec = key ? getSystemTemplateSpec(key) : undefined;
                  if (spec) setPreviewSpec(spec);
                  else window.open(`/audit-templates/${t.id}/preview`, "_blank", "noopener,noreferrer");
                }}
              />
            ))}
          </div>
        </div>
      ) : null}

      {groups.map(([label, specs]) => (
        <div key={label} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--aislix-secondary)]">{label}</h3>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {specs.map((spec) => (
              <TemplateTile
                key={spec.key}
                name={spec.name}
                description={spec.shortDescription}
                tag={spec.recommended ? "Recommended" : undefined}
                selected={templateChoice === `system:${spec.key}`}
                onUse={() => onSelect(`system:${spec.key}`, { name: spec.name, systemKey: spec.key })}
                onPreview={() => setPreviewSpec(spec)}
              />
            ))}
          </div>
        </div>
      ))}

      <TemplatePreviewSheet
        spec={previewSpec}
        open={previewSpec !== null}
        onOpenChange={(o) => !o && setPreviewSpec(null)}
      />
    </section>
  );
}
