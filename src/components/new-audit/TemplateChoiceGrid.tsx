import { useMemo, useState, type ReactNode } from "react";
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
  /** Extra control next to the search box (e.g. "Cancel" when re-opening the list). */
  headerAction?: ReactNode;
};

type Tab = "aislix" | "yours";

type Row = {
  key: string;
  name: string;
  description: string;
  recommended: boolean;
  selected: boolean;
  onUse: () => void;
  onPreview: () => void;
};

function systemKeyOf(t: AuditTemplate): string | undefined {
  const raw = t.purpose_config?.systemTemplateKey;
  return typeof raw === "string" ? raw : undefined;
}

function TemplateRow({ row }: { row: Row }) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 bg-white px-3 py-2.5 transition-colors",
        row.selected ? "bg-[#F4F7F9]" : "hover:bg-[#F4F7F9]",
      )}
    >
      <button
        type="button"
        onClick={row.onUse}
        aria-pressed={row.selected}
        title={row.description || row.name}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
      >
        {row.selected ? (
          <CheckCircle2 className="size-4 shrink-0 text-[#04203F]" aria-hidden />
        ) : (
          <span className="size-4 shrink-0 rounded-full border border-[#D9E2E8]" aria-hidden />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium text-[#04203F]">{row.name}</span>
            {row.recommended ? (
              <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-[#667085]">
                <span className="size-1.5 rounded-full bg-[#79E2A8]" aria-hidden />
                Recommended
              </span>
            ) : null}
          </span>
          {row.description ? (
            <span className="block truncate text-xs text-[#667085]">{row.description}</span>
          ) : null}
        </span>
      </button>
      <button
        type="button"
        onClick={row.onPreview}
        aria-label={`Preview ${row.name}`}
        title="Preview"
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-[#667085] transition-colors hover:bg-white hover:text-[#04203F]"
      >
        <Eye className="size-4" />
      </button>
    </div>
  );
}

/** Every template for the chosen operating model as a compact, tabbed list. */
export function TemplateChoiceGrid({ operatingModel, templateChoice, savedTemplates, onSelect, headerAction }: Props) {
  const [search, setSearch] = useState("");
  const [previewSpec, setPreviewSpec] = useState<SystemTemplateSpec | null>(null);
  const modelLabel = OPERATING_MODEL_CARDS.find((c) => c.id === operatingModel)?.title ?? "this operation";
  const term = search.trim().toLowerCase();

  const systemSpecs = useMemo(() => getBrowseAllTemplates(operatingModel), [operatingModel]);

  const ownTemplates = useMemo(() => {
    const systemKeys = new Set(systemSpecs.map((s) => s.key));
    const systemNames = new Set(systemSpecs.map((s) => s.name));
    return savedTemplates.filter((t) => {
      const key = systemKeyOf(t);
      if (key && systemKeys.has(key)) return false;
      if (t.is_system_template && systemNames.has(t.name)) return false;
      return true;
    });
  }, [savedTemplates, systemSpecs]);

  const [tab, setTab] = useState<Tab>(() =>
    ownTemplates.some((t) => t.id === templateChoice) ? "yours" : "aislix",
  );
  const activeTab: Tab = ownTemplates.length ? tab : "aislix";

  const aislixRows = useMemo<Row[]>(
    () =>
      systemSpecs
        .filter(
          (s) =>
            !term ||
            s.name.toLowerCase().includes(term) ||
            s.shortDescription.toLowerCase().includes(term) ||
            (PURPOSE_SECTION_LABELS[s.purpose] ?? s.category).toLowerCase().includes(term),
        )
        .map((spec) => ({
          key: spec.key,
          name: spec.name,
          description: spec.shortDescription,
          recommended: Boolean(spec.recommended),
          selected: templateChoice === `system:${spec.key}`,
          onUse: () => onSelect(`system:${spec.key}`, { name: spec.name, systemKey: spec.key }),
          onPreview: () => setPreviewSpec(spec),
        })),
    [systemSpecs, term, templateChoice, onSelect],
  );

  const yourRows = useMemo<Row[]>(
    () =>
      ownTemplates
        .filter(
          (t) =>
            !term ||
            t.name.toLowerCase().includes(term) ||
            (t.short_description ?? t.description ?? "").toLowerCase().includes(term),
        )
        .map((t) => ({
          key: t.id,
          name: t.name,
          description: t.short_description ?? t.description ?? "",
          recommended: false,
          selected: templateChoice === t.id,
          onUse: () => onSelect(t.id, { name: t.name }),
          onPreview: () => {
            const key = systemKeyOf(t);
            const spec = key ? getSystemTemplateSpec(key) : undefined;
            if (spec) setPreviewSpec(spec);
            else window.open(`/audit-templates/${t.id}/preview`, "_blank", "noopener,noreferrer");
          },
        })),
    [ownTemplates, term, templateChoice, onSelect],
  );

  const rows = activeTab === "yours" ? yourRows : aislixRows;
  const otherTab: Tab = activeTab === "yours" ? "aislix" : "yours";
  const otherCount = activeTab === "yours" ? aislixRows.length : yourRows.length;

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "aislix", label: "Aislix templates", count: aislixRows.length },
    { id: "yours", label: "Your templates", count: yourRows.length },
  ];

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{modelLabel} templates</h2>
          <p className="text-sm text-muted-foreground">Pick one — its fields appear below.</p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="relative flex-1 sm:w-64 sm:flex-none">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--aislix-secondary)]" />
            <Input
              className="h-9 rounded-lg border-[var(--aislix-border)] bg-white pl-9 text-sm"
              placeholder="Search templates…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {headerAction}
        </div>
      </div>

      {ownTemplates.length ? (
        <div
          role="tablist"
          aria-label="Template source"
          className="inline-flex rounded-lg border border-[#D9E2E8] bg-white p-0.5"
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                activeTab === t.id
                  ? "bg-[#F4F7F9] text-[#04203F]"
                  : "text-[#667085] hover:text-[#04203F]",
              )}
            >
              {t.label} <span className="text-[#667085]">({t.count})</span>
            </button>
          ))}
        </div>
      ) : null}

      {rows.length ? (
        <div className="grid gap-px overflow-hidden rounded-xl border border-[#D9E2E8] bg-[#D9E2E8] lg:grid-cols-2">
          {rows.map((row) => (
            <TemplateRow key={row.key} row={row} />
          ))}
          {rows.length % 2 === 1 ? <div className="hidden bg-white lg:block" aria-hidden /> : null}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-[#D9E2E8] px-4 py-5 text-center text-sm text-[#667085]">
          {term ? <>No templates match “{search}”.</> : "No templates yet."}
          {term && otherCount && ownTemplates.length ? (
            <>
              {" "}
              <button
                type="button"
                onClick={() => setTab(otherTab)}
                className="font-medium text-[#04203F] underline underline-offset-2"
              >
                {otherCount} in {otherTab === "yours" ? "Your templates" : "Aislix templates"}
              </button>
            </>
          ) : null}
        </p>
      )}

      <TemplatePreviewSheet
        spec={previewSpec}
        open={previewSpec !== null}
        onOpenChange={(o) => !o && setPreviewSpec(null)}
      />
    </section>
  );
}
