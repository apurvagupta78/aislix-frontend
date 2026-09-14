import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileStack, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { CollectionMethodBadge } from "@/components/audit/AuditStatusBadges";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import { EmptyState, ErrorState, Skeleton } from "@/components/States";
import { toUserMessage } from "@/lib/api/errors";
import {
  TEMPLATE_TYPES,
  createAuditTemplate,
  deleteAuditTemplate,
  fetchAuditTemplates,
  publishAuditTemplate,
  type TemplateType,
} from "@/lib/audit-templates";
import type { AuditMode, ScopeType } from "@/lib/assignments";
import { isOrgManager } from "@/lib/assignments";

export const Route = createFileRoute("/audit-templates")({
  head: () => ({ meta: [{ title: "Audit Templates — Aislix" }] }),
  component: AuditTemplatesPage,
});

function AuditTemplatesPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [templateType, setTemplateType] = useState<TemplateType>("shelf_audit");
  const [auditMode, setAuditMode] = useState<AuditMode>("digital");
  const [scopeType, setScopeType] = useState<ScopeType>("planogram");
  const [instructions, setInstructions] = useState("");
  const [evidenceRequired, setEvidenceRequired] = useState(true);

  const managerQuery = useQuery({
    queryKey: ["is-org-manager"],
    queryFn: () => isOrgManager(),
  });

  const templatesQuery = useQuery({
    queryKey: ["audit-templates"],
    queryFn: fetchAuditTemplates,
    enabled: managerQuery.data === true,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createAuditTemplate({
        name,
        description,
        template_type: templateType,
        audit_mode: auditMode,
        scope_type: scopeType,
        scope_values: {},
        instructions,
        evidence_required: evidenceRequired,
        published: false,
      }),
    onSuccess: () => {
      toast.success("Template saved as draft.");
      setName("");
      setDescription("");
      setInstructions("");
      void queryClient.invalidateQueries({ queryKey: ["audit-templates"] });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const publishMutation = useMutation({
    mutationFn: publishAuditTemplate,
    onSuccess: () => {
      toast.success("Template published — version incremented.");
      void queryClient.invalidateQueries({ queryKey: ["audit-templates"] });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAuditTemplate,
    onSuccess: () => {
      toast.success("Template deleted.");
      void queryClient.invalidateQueries({ queryKey: ["audit-templates"] });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  if (managerQuery.isLoading) {
    return (
      <AppShell title="Templates">
        <Skeleton className="h-48 w-full" />
      </AppShell>
    );
  }

  if (!managerQuery.data) {
    return (
      <AppShell title="Templates">
        <EmptyState title="Manager access required" description="Only managers can manage audit templates." />
      </AppShell>
    );
  }

  const templates = templatesQuery.data ?? [];

  return (
    <AppShell
      title="Audit Templates"
      description="Versioned templates for shelf, inventory, planogram, pricing and checklist audits."
      actions={
        <Button asChild variant="outline" size="sm">
          <Link to="/assign-scan">Assign from template →</Link>
        </Button>
      }
    >
      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <Plus className="size-4" /> New template
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Published edits create a new version. In-flight audits keep their original template.
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Shelf audit — personal care" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this template covers"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Template type</Label>
                <Select value={templateType} onValueChange={(v) => setTemplateType(v as TemplateType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Collection method</Label>
                <Select value={auditMode} onValueChange={(v) => setAuditMode(v as AuditMode)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="digital">Digital Audit</SelectItem>
                    <SelectItem value="ai">AI Audit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Scope type</Label>
              <Select value={scopeType} onValueChange={(v) => setScopeType(v as ScopeType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planogram">Planogram product list</SelectItem>
                  <SelectItem value="category">Category</SelectItem>
                  <SelectItem value="sub_category">Sub-category</SelectItem>
                  <SelectItem value="location">Location / aisle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Default instructions</Label>
              <Textarea
                rows={3}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Evidence requirements, blind count policy, etc."
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <Label className="cursor-pointer">Mandatory evidence</Label>
              <Switch checked={evidenceRequired} onCheckedChange={setEvidenceRequired} />
            </div>
            <Button
              className="w-full"
              disabled={!name.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : "Save draft template"}
            </Button>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold">Saved templates</h2>
          {templatesQuery.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : templatesQuery.isError ? (
            <ErrorState description={toUserMessage(templatesQuery.error)} />
          ) : !templates.length ? (
            <EmptyState
              icon={<FileStack className="size-6" />}
              title="No templates yet"
              description="Create a template to speed up recurring assignments."
            />
          ) : (
            templates.map((t) => (
              <article
                key={t.id}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{t.name}</p>
                    {t.description ? (
                      <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <CollectionMethodBadge mode={t.audit_mode} />
                      <Badge variant="outline">v{t.version}</Badge>
                      {t.published ? (
                        <Badge variant="secondary">Published</Badge>
                      ) : (
                        <Badge variant="outline">Draft</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!t.published ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={publishMutation.isPending}
                        onClick={() => publishMutation.mutate(t.id)}
                      >
                        Publish
                      </Button>
                    ) : null}
                    <Button asChild size="sm" variant="brand">
                      <Link
                        to="/assign-scan"
                        search={{ store: undefined, scope: undefined, planogramVersion: undefined }}
                      >
                        Use
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(t.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </AppShell>
  );
}
