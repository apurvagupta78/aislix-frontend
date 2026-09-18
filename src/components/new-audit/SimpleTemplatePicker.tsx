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
import {
  getSystemTemplateSpec,
  type SystemTemplateSpec,
} from "@/lib/audit-engine/template-factory";
import { TemplatePreviewSheet } from "@/components/audit-engine/TemplatePreviewSheet";
import {
  formatRecentLabel,
  getRecentTemplates,
  type RecentTemplateEntry,
} from "@/lib/new-audit/recent-templates";
import { SEMANTIC_PALETTE } from "@/lib/design-system";
import { cn } from "@/lib/utils";

type SourceFilter = "all" | "mine" | "organization" | "aislix";

const MODEL_BADGE: Record<string, string> = {
  "Local Store": "border-[var(--aislix-local-border)] bg-[var(--aislix-local-bg)]",
  Supermarket: "border-[var(--aislix-supermarket-border)] bg-[var(--aislix-supermarket-bg)]",
  "Dark Store": "border-[var(--aislix-darkstore-border)] bg-[var(--aislix-darkstore-bg)]",
  Warehouse: "border-[var(--aislix-warehouse-border)] bg-[var(--aislix-warehouse-bg)]",
  "FMCG / Distributor": "border-[var(--aislix-fmcg-border)] bg-[var(--aislix-fmcg-bg)]",
  FMCG: "border-[var(--aislix-fmcg-border)] bg-[var(--aislix-fmcg-bg)]",
  Distributor: "border-[var(--aislix-fmcg-border)] bg-[var(--aislix-fmcg-bg)]",
  Custom: "border-[var(--aislix-custom-border)] bg-[var(--aislix-custom-bg)]",
};

const SPECIAL_BADGE: Record<string, string> = {
  AI: `${SEMANTIC_PALETTE.ai.border} ${SEMANTIC_PALETTE.ai.bg}`,
  Evidence: `${SEMANTIC_PALETTE.evidence.border} ${SEMANTIC_PALETTE.evidence.bg}`,
  Aislix: `${SEMANTIC_PALETTE.brand.border} ${SEMANTIC_PALETTE.brand.bg}`,
  Organization: `${SEMANTIC_PALETTE.success.border} ${SEMANTIC_PALETTE.success.bg}`,
  "My Template": `${SEMANTIC_PALETTE.warning.border} ${SEMANTIC_PALETTE.warning.bg}`,
};

const PURPOSE_BADGE = `${SEMANTIC_PALETTE.info.border} ${SEMANTIC_PALETTE.info.bg}`;

/** Five distinct operating-model tints from the design system — rotate so no two neighbors match. */
const USE_TEMPLATE_BUTTON: Record<OperatingModel, string> = {
  local_store:
    "border-[var(--aislix-local-border)] bg-[var(--aislix-local-bg)] text-[var(--aislix-primary)] hover:bg-[var(--aislix-local-border)]/40",
  supermarket:
    "border-[var(--aislix-supermarket-border)] bg-[var(--aislix-supermarket-bg)] text-[var(--aislix-primary)] hover:bg-[var(--aislix-supermarket-border)]/40",
  dark_store:
    "border-[var(--aislix-darkstore-border)] bg-[var(--aislix-darkstore-bg)] text-[var(--aislix-primary)] hover:bg-[var(--aislix-darkstore-border)]/40",
  warehouse:
    "border-[var(--aislix-warehouse-border)] bg-[var(--aislix-warehouse-bg)] text-[var(--aislix-primary)] hover:bg-[var(--aislix-warehouse-border)]/40",
  fmcg_distributor:
    "border-[var(--aislix-fmcg-border)] bg-[var(--aislix-fmcg-bg)] text-[var(--aislix-primary)] hover:bg-[var(--aislix-fmcg-border)]/40",
  custom:
    "border-[var(--aislix-custom-border)] bg-[var(--aislix-custom-bg)] text-[var(--aislix-primary)] hover:bg-[var(--aislix-custom-border)]/40",
};

const USE_TEMPLATE_BUTTON_ROTATION: OperatingModel[] = [
  "local_store",
  "supermarket",
  "dark_store",
  "warehouse",
  "custom",
];

function badgeTone(label: string) {
  return MODEL_BADGE[label] ?? SPECIAL_BADGE[label] ?? PURPOSE_BADGE;
}

function useTemplateButtonClass(colorIndex: number) {
  const tone = USE_TEMPLATE_BUTTON_ROTATION[colorIndex % USE_TEMPLATE_BUTTON_ROTATION.length];
  return USE_TEMPLATE_BUTTON[tone];
}

function systemKeyFromTemplate(t: AuditTemplate): string | undefined {
  const raw = t.purpose_config?.systemTemplateKey;
  return typeof raw === "string" ? raw : undefined;
}

function resolveSpecForTemplate(t: AuditTemplate): SystemTemplateSpec | undefined {
  const key = systemKeyFromTemplate(t);
  if (key) return getSystemTemplateSpec(key);
  return undefined;
}

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
  colorIndex,
  onUse,
  onPreview,
}: {
  name: string;
  description: string;
  badges: string[];
  selected?: boolean;
  colorIndex: number;
  onUse: () => void;
  onPreview: () => void;
}) {
  return (
    <div
      className={cn(
        "play-card flex h-full min-w-0 flex-col rounded-2xl border border-[var(--aislix-border)] bg-white p-4 transition-shadow",
        selected && "ring-2 ring-[var(--aislix-primary)]/15",
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
            className={cn(
              "rounded-full border text-[10px] font-semibold text-[var(--aislix-primary)]",
              badgeTone(b),
            )}
          >
            {b}
          </Badge>
        ))}
      </div>
      <div className="mt-auto flex w-full min-w-0 gap-2 pt-4">
        <Button
          size="sm"
          variant="outline"
          onClick={onPreview}
          className="min-w-0 flex-1 border-[var(--aislix-border)] bg-white text-[var(--aislix-primary)] hover:bg-[var(--aislix-surface)]"
        >
          <Eye className="size-3 shrink-0" /> Preview
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onUse}
          className={cn("min-w-0 flex-1 font-semibold shadow-soft", useTemplateButtonClass(colorIndex))}
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
  const systemSlice = allSystem.slice(0, source === "aislix" ? 24 : 12);
  const systemKeys = new Set(systemSlice.map((spec) => spec.key));
  const systemNames = new Set(systemSlice.map((spec) => `${spec.operatingModel}:${spec.name}`));

  const dbVisible = [...publishedTemplates, ...myTemplates]
    .filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i)
    .filter(filterDb)
    .filter((t) => {
      if (source === "mine" || source === "organization" || source === "aislix") return true;
      const key = systemKeyFromTemplate(t);
      if (key && systemKeys.has(key)) return false;
      if (t.is_system_template && systemNames.has(`${t.operating_model}:${t.name}`)) return false;
      return true;
    });

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

  function openPreviewForSpec(spec: SystemTemplateSpec) {
    setPreviewSpec(spec);
  }

  function openPreviewForTemplate(t: AuditTemplate) {
    const spec = resolveSpecForTemplate(t);
    if (spec) {
      setPreviewSpec(spec);
      return;
    }
    window.open(`/audit-templates/${t.id}/preview`, "_blank", "noopener,noreferrer");
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
              {recommended.slice(0, 4).map((spec, index) => (
                <SimpleTemplateCard
                  key={spec.key}
                  name={spec.name}
                  description={spec.shortDescription}
                  badges={badgesForSpec(spec)}
                  selected={templateChoice === `system:${spec.key}`}
                  colorIndex={index}
                  onPreview={() => openPreviewForSpec(spec)}
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
          <div className="grid auto-rows-fr gap-3 sm:grid-cols-2">
            {(() => {
              let colorIndex = 0;
              const nextColorIndex = () => colorIndex++;
              return (
                <>
                  {source !== "mine" && source !== "organization"
                    ? systemSlice.map((spec) => (
                        <SimpleTemplateCard
                          key={spec.key}
                          name={spec.name}
                          description={spec.shortDescription}
                          badges={badgesForSpec(spec)}
                          selected={templateChoice === `system:${spec.key}`}
                          colorIndex={nextColorIndex()}
                          onPreview={() => openPreviewForSpec(spec)}
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
                      colorIndex={nextColorIndex()}
                      onPreview={() => openPreviewForTemplate(t)}
                      onUse={() => {
                        onSelect(t.id, { name: t.name });
                        onOpenChange(false);
                      }}
                    />
                  ))}
                </>
              );
            })()}
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
