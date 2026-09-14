import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, FlaskConical, Loader2, Save, Send } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { AuditExecutionForm } from "@/components/audit-builder/AuditExecutionForm";
import { BuilderCanvas } from "@/components/audit-builder/BuilderCanvas";
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
  const [testMode, setTestMode] = useState(false);
  const [testResponses, setTestResponses] = useState({});

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
    if (templateQuery.data) setDraft(templateQuery.data);
  }, [templateQuery.data]);

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
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/audit-templates">
              <ArrowLeft className="mr-1 size-3" /> Templates
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="mr-1 size-3" />}
            Save Draft
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setTestMode((v) => !v)}>
            <FlaskConical className="mr-1 size-3" />
            {testMode ? "Exit Test" : "Test Audit"}
          </Button>
          <Button type="button" variant="brand" size="sm" onClick={() => setPublishOpen(true)}>
            <Send className="mr-1 size-3" /> Publish
          </Button>
        </div>
      }
    >
      {testMode ? (
        <div className="mx-auto max-w-lg">
          <AuditExecutionForm
            definition={definition}
            templateName={`${draft.name} (Test)`}
            storeName="Sample Store #102"
            dueAt={new Date().toISOString()}
            responses={testResponses}
            onChange={setTestResponses}
            onSaveField={async () => {}}
            onUploadImage={async () => "https://placehold.co/120x120?text=Photo"}
            readOnly={false}
          />
        </div>
      ) : (
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

            <div className="grid h-[min(70vh,720px)] gap-4 lg:grid-cols-[240px_1fr_280px]">
              <FieldLibraryPanel onAddField={(item) => handleAddField(item)} />
              <BuilderCanvas
                sections={definition.sections}
                fields={definition.fields}
                selectedFieldId={selectedFieldId}
                onSelectField={setSelectedFieldId}
                onRemoveField={handleRemoveField}
                onAddSection={handleAddSection}
                onDropField={(item, sectionKey) => handleAddField(item, sectionKey)}
                onReorderField={handleReorder}
              />
              <FieldConfigPanel field={selectedField} onChange={handleFieldChange} />
            </div>
          </TabsContent>

          <TabsContent value="rules">
            <RulesBuilder
              rules={definition.rules}
              fields={definition.fields}
              onChange={(rules: TemplateRule[]) => updateDefinition({ rules })}
            />
          </TabsContent>

          <TabsContent value="workflow">
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
      )}

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
