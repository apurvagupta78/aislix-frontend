import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { BuilderCanvas } from "@/components/audit-builder/BuilderCanvas";
import { BuilderTopBar } from "@/components/audit-builder/BuilderTopBar";
import { CalculatedFieldsPanel } from "@/components/audit-builder/CalculatedFieldsPanel";
import { ExpiryVerificationPanel } from "@/components/audit-builder/ExpiryVerificationPanel";
import { FieldConfigPanel } from "@/components/audit-builder/FieldConfigPanel";
import { FieldLibraryPanel } from "@/components/audit-builder/FieldLibraryPanel";
import { PublishDialog } from "@/components/audit-builder/PublishDialog";
import { RulesBuilder } from "@/components/audit-builder/RulesBuilder";
import { TemplatePreview } from "@/components/audit-builder/TemplatePreview";
import { WorkflowSettingsPanel } from "@/components/audit-builder/WorkflowSettingsPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorState, Skeleton } from "@/components/States";
import { toUserMessage } from "@/lib/api/errors";
import {
  AUDIT_LEVEL_OPTIONS,
  AUDIT_TYPE_OPTIONS,
  createFieldFromLibrary,
  type FieldLibraryItem,
} from "@/lib/audit-builder/field-library";
import type {
  AiConfig,
  AuditLevel,
  EvidenceConfig,
  ScoringConfig,
  TemplateDefinition,
  TemplateField,
  TemplateRule,
  TemplateSection,
  WorkflowSettings,
} from "@/lib/audit-builder/types";
import {
  definitionToPatch,
  fetchAuditTemplate,
  publishAuditTemplate,
  templateToDefinition,
  updateAuditTemplate,
  type AuditTemplate,
  type TemplateType,
} from "@/lib/audit-templates";
import { isOrgManager } from "@/lib/assignments";

export const Route = createFileRoute("/audit-templates/$templateId")({
  head: () => ({ meta: [{ title: "Audit Template Builder — Aislix" }] }),
  component: TemplateBuilderPage,
});

function TemplateBuilderPage() {
  const { templateId } = Route.useParams();
  const queryClient = useQueryClient();
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<string>("");
  const [mobilePanel, setMobilePanel] = useState<"fields" | "canvas" | "settings">("canvas");

  const managerQuery = useQuery({
    queryKey: ["is-org-manager"],
    queryFn: () => isOrgManager(),
  });

  const templateQuery = useQuery({
    queryKey: ["audit-template", templateId],
    queryFn: () => fetchAuditTemplate(templateId),
    enabled: managerQuery.data === true,
  });

  const [draft, setDraft] = useState<AuditTemplate | null>(null);

  useEffect(() => {
    if (templateQuery.data) {
      setDraft(templateQuery.data);
      setSavedSnapshot(JSON.stringify(templateQuery.data));
      setDirty(false);
    }
  }, [templateQuery.data]);

  useEffect(() => {
    if (!draft || !savedSnapshot) return;
    setDirty(JSON.stringify(draft) !== savedSnapshot);
  }, [draft, savedSnapshot]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const definition = useMemo<TemplateDefinition | null>(() => {
    if (!draft) return null;
    return templateToDefinition(draft);
  }, [draft]);

  const selectedField = draft?.field_definitions.find((f) => f.id === selectedFieldId) ?? null;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!draft || !definition) return;
      await updateAuditTemplate(templateId, {
        name: draft.name,
        description: draft.description ?? undefined,
        template_type: draft.template_type,
        category: draft.category ?? undefined,
        icon: draft.icon ?? undefined,
        audit_level: draft.audit_level,
        ...definitionToPatch(definition),
      });
    },
    onSuccess: () => {
      toast.success("Draft saved.");
      if (draft) setSavedSnapshot(JSON.stringify(draft));
      setDirty(false);
      void queryClient.invalidateQueries({ queryKey: ["audit-templates"] });
      void queryClient.invalidateQueries({ queryKey: ["audit-template", templateId] });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!draft || !definition) return;
      await updateAuditTemplate(templateId, {
        name: draft.name,
        description: draft.description ?? undefined,
        ...definitionToPatch(definition),
      });
      return publishAuditTemplate(templateId);
    },
    onSuccess: (version) => {
      toast.success(`Template published as v${version ?? ""}.`);
      setPublishOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["audit-templates"] });
      void queryClient.invalidateQueries({ queryKey: ["audit-template", templateId] });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const updateDefinition = useCallback((patch: Partial<TemplateDefinition>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      setDirty(true);
      return {
        ...prev,
        sections: patch.sections ?? prev.sections,
        field_definitions: patch.fields ?? prev.field_definitions,
        rules: patch.rules ?? prev.rules,
        workflow_settings: patch.workflow ?? prev.workflow_settings,
        scoring_config: patch.scoring ?? prev.scoring_config,
        ai_config: patch.ai ?? prev.ai_config,
        evidence_config: patch.evidence ?? prev.evidence_config,
        calculated_fields: patch.calculatedFields ?? prev.calculated_fields,
        audit_level: patch.auditLevel ?? prev.audit_level,
      };
    });
  }, []);

  const handleAddField = (item: FieldLibraryItem, sectionKey?: string) => {
    if (!draft || !definition) return;
    const sec = sectionKey ?? draft.sections[0]?.key ?? "default";
    const order = draft.field_definitions.filter((f) => f.section === sec).length;
    const field = createFieldFromLibrary(item, sec, order);
    updateDefinition({ fields: [...definition.fields, field] });
    setSelectedFieldId(field.id);
  };

  const handleRemoveField = (id: string) => {
    if (!definition) return;
    updateDefinition({ fields: definition.fields.filter((f) => f.id !== id) });
    if (selectedFieldId === id) setSelectedFieldId(null);
  };

  const handleDuplicateField = (id: string) => {
    if (!definition) return;
    const source = definition.fields.find((f) => f.id === id);
    if (!source) return;
    const copy: TemplateField = {
      ...source,
      id: crypto.randomUUID(),
      key: `${source.key}_copy`,
      label: `${source.label} (copy)`,
      order: source.order + 1,
    };
    updateDefinition({ fields: [...definition.fields, copy] });
    setSelectedFieldId(copy.id);
  };

  const handleUpdateSection = (key: string, patch: Partial<TemplateSection>) => {
    if (!definition) return;
    updateDefinition({
      sections: definition.sections.map((s) => (s.key === key ? { ...s, ...patch } : s)),
    });
  };

  const handleReorderSection = (key: string, direction: "up" | "down") => {
    if (!definition) return;
    const sorted = [...definition.sections].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((s) => s.key === key);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx]!;
    const b = sorted[swapIdx]!;
    updateDefinition({
      sections: definition.sections.map((s) => {
        if (s.key === a.key) return { ...s, order: b.order };
        if (s.key === b.key) return { ...s, order: a.order };
        return s;
      }),
    });
  };

  const handleFieldChange = (patch: Partial<TemplateField>) => {
    if (!definition || !selectedFieldId) return;
    updateDefinition({
      fields: definition.fields.map((f) =>
        f.id === selectedFieldId ? { ...f, ...patch, config: patch.config ?? f.config } : f,
      ),
    });
  };

  const handleReorder = (fieldId: string, direction: "up" | "down") => {
    if (!definition) return;
    const field = definition.fields.find((f) => f.id === fieldId);
    if (!field) return;
    const siblings = definition.fields
      .filter((f) => f.section === field.section)
      .sort((a, b) => a.order - b.order);
    const idx = siblings.findIndex((f) => f.id === fieldId);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;
    const swap = siblings[swapIdx]!;
    const next = definition.fields.map((f) => {
      if (f.id === field.id) return { ...f, order: swap.order };
      if (f.id === swap.id) return { ...f, order: field.order };
      return f;
    });
    updateDefinition({ fields: next });
  };

  const handleAddSection = () => {
    if (!definition) return;
    const key = `section_${crypto.randomUUID().slice(0, 8)}`;
    const section: TemplateSection = {
      key,
      title: "New Section",
      order: definition.sections.length,
      repeatable: draft?.audit_level === "one_per_sku",
    };
    updateDefinition({ sections: [...definition.sections, section] });
  };

  if (managerQuery.isLoading || templateQuery.isLoading) {
    return (
      <AppShell title="Template Builder">
        <Skeleton className="h-96 w-full" />
      </AppShell>
    );
  }

  if (!managerQuery.data) {
    return (
      <AppShell title="Template Builder">
        <ErrorState description="Manager access required to edit audit templates." />
      </AppShell>
    );
  }

  if (templateQuery.isError || !draft || !definition) {
    return (
      <AppShell title="Template Builder">
        <ErrorState description={toUserMessage(templateQuery.error ?? "Template not found")} />
      </AppShell>
    );
  }

  return (
    <AppShell
      title={draft.name}
      description="Custom Audit Builder — configure fields, rules, evidence, AI and workflow."
      actions={
        <Button asChild variant="outline" size="sm">
          <Link to="/audit-templates">
            <ArrowLeft className="mr-1 size-3" /> Templates
          </Link>
        </Button>
      }
    >
      <BuilderTopBar
        templateId={templateId}
        status={draft.status}
        dirty={dirty}
        saving={saveMutation.isPending}
        onSave={() => saveMutation.mutate()}
        onPublish={() => setPublishOpen(true)}
      />
      <Tabs defaultValue="builder" className="space-y-4">
          <TabsList>
            <TabsTrigger value="builder">Field Builder</TabsTrigger>
            <TabsTrigger value="rules">Rules</TabsTrigger>
            <TabsTrigger value="workflow">Workflow & AI</TabsTrigger>
            <TabsTrigger value="preview">
              <Eye className="mr-1 size-3" /> Preview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="builder" className="space-y-4">
            <section className="rounded-xl border border-border bg-muted/20 p-4">
              <h2 className="text-sm font-semibold">Step 1 — Basic Information</h2>
              <div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <Label>Template Name</Label>
                  <Input
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Audit Type</Label>
                  <Select
                    value={draft.template_type}
                    onValueChange={(v) =>
                      setDraft({ ...draft, template_type: v as TemplateType })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AUDIT_TYPE_OPTIONS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Audit Level</Label>
                  <Select
                    value={draft.audit_level}
                    onValueChange={(v) => {
                      const level = v as AuditLevel;
                      setDraft({ ...draft, audit_level: level });
                      if (level === "one_per_sku") {
                        updateDefinition({
                          auditLevel: level,
                          sections: definition.sections.map((s) =>
                            s.key === "product" || s.title.toLowerCase().includes("product")
                              ? { ...s, repeatable: true }
                              : s,
                          ),
                        });
                      } else {
                        updateDefinition({ auditLevel: level });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AUDIT_LEVEL_OPTIONS.map((l) => (
                        <SelectItem key={l.value} value={l.value}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2 lg:col-span-3">
                  <Label>Description</Label>
                  <Textarea
                    rows={2}
                    value={draft.description ?? ""}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  />
                </div>
              </div>
            </section>

            <div className="mb-3 flex gap-2 lg:hidden">
              {(["fields", "canvas", "settings"] as const).map((p) => (
                <Button
                  key={p}
                  type="button"
                  size="sm"
                  variant={mobilePanel === p ? "brand" : "outline"}
                  className="capitalize"
                  onClick={() => setMobilePanel(p)}
                >
                  {p}
                </Button>
              ))}
            </div>
            <div className="grid h-[min(70vh,720px)] gap-4 lg:grid-cols-[240px_1fr_280px]">
              <div className={mobilePanel === "fields" ? "block h-full" : "hidden lg:block"}>
                <FieldLibraryPanel onAddField={(item) => handleAddField(item)} />
              </div>
              <div className={mobilePanel === "canvas" ? "block h-full" : "hidden lg:block"}>
                <BuilderCanvas
                  sections={definition.sections}
                  fields={definition.fields}
                  selectedFieldId={selectedFieldId}
                  onSelectField={(id) => {
                    setSelectedFieldId(id);
                    setMobilePanel("settings");
                  }}
                  onRemoveField={handleRemoveField}
                  onDuplicateField={handleDuplicateField}
                  onAddSection={handleAddSection}
                  onUpdateSection={handleUpdateSection}
                  onReorderSection={handleReorderSection}
                  onDropField={(item, sectionKey) => handleAddField(item, sectionKey)}
                  onReorderField={handleReorder}
                />
              </div>
              <div className={mobilePanel === "settings" ? "block h-full" : "hidden lg:block"}>
                <FieldConfigPanel field={selectedField} onChange={handleFieldChange} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="rules" className="space-y-4">
            <RulesBuilder
              rules={definition.rules}
              fields={definition.fields}
              onChange={(rules: TemplateRule[]) => updateDefinition({ rules })}
            />
            <CalculatedFieldsPanel
              fields={definition.calculatedFields}
              onChange={(calculatedFields) => updateDefinition({ calculatedFields })}
            />
          </TabsContent>

          <TabsContent value="workflow" className="space-y-4">
            <ExpiryVerificationPanel
              evidence={definition.evidence}
              onChange={(evidence) => updateDefinition({ evidence })}
            />
            <WorkflowSettingsPanel
              workflow={definition.workflow}
              evidence={definition.evidence}
              scoring={definition.scoring}
              ai={definition.ai}
              onWorkflowChange={(workflow: WorkflowSettings) => updateDefinition({ workflow })}
              onEvidenceChange={(evidence: EvidenceConfig) => updateDefinition({ evidence })}
              onScoringChange={(scoring: ScoringConfig) => updateDefinition({ scoring })}
              onAiChange={(ai: AiConfig) => updateDefinition({ ai })}
            />
          </TabsContent>

          <TabsContent value="preview">
            <TemplatePreview templateName={draft.name} definition={definition} />
          </TabsContent>
        </Tabs>

      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        templateName={draft.name}
        version={draft.version}
        definition={definition}
        publishing={publishMutation.isPending}
        onConfirm={() => publishMutation.mutate()}
      />
    </AppShell>
  );
}
