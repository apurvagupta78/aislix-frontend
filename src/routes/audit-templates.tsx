import { useMemo, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  BarChart3,
  Copy,
  Eye,
  FileStack,
  History,
  Loader2,
  Pencil,
  Plus,
  Share2,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import {
  EmptyState,
  FilterBar,
  FilterRow,
  FilterSearch,
  PageHeader,
  TemplateLibraryCard,
} from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorState, Skeleton } from "@/components/States";
import { toUserMessage } from "@/lib/api/errors";
import type { AuditPurpose, OperatingModel } from "@/lib/audit-builder/types";
import { DuplicateTemplateDialog } from "@/components/audit-builder/DuplicateTemplateDialog";
import {
  archiveAuditTemplate,
  duplicateAuditTemplate,
  fetchAuditTemplates,
  fetchTemplateUsageCounts,
  isCustomBuilderTemplate,
  shareAuditTemplateWithOrganization,
  updateAuditTemplate,
  type AuditTemplate,
  type TemplateStatus,
} from "@/lib/audit-templates";
import { templateHasSavedCsvConfig } from "@/lib/audit-builder/load-saved-template-audit";
import { requireUserId } from "@/lib/db/context";
import { isOrgManager } from "@/lib/assignments";
import { OPERATING_MODEL_CARDS } from "@/lib/audit-engine/operating-model-catalog";
import { TemplateCatalogCard } from "@/components/audit-engine/TemplateCatalogCard";
import { TemplatePreviewSheet } from "@/components/audit-engine/TemplatePreviewSheet";
import { UseTemplateConfirmDialog } from "@/components/audit-engine/UseTemplateConfirmDialog";
import { ensureSystemTemplate, seedSystemTemplatesForOrg } from "@/lib/audit-engine/seed-templates";
import {
  getDiscoverySections,
  purposeOptionsForFilter,
} from "@/lib/audit-engine/template-catalog-ui";
import {
  STARTER_TEMPLATE_LIBRARY,
  type SystemTemplateSpec,
} from "@/lib/audit-engine/template-factory";

export const Route = createFileRoute("/audit-templates")({
  head: () => ({ meta: [{ title: "Audit Templates — Aislix" }] }),
  component: AuditTemplatesPage,
});

type LibraryTab = "recommended" | "my_templates" | "organization" | "aislix_system";
type SourceFilter = "all" | "system" | "customer";

function AuditTemplatesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [libraryTab, setLibraryTab] = useState<LibraryTab>("recommended");
  const [previewSpec, setPreviewSpec] = useState<SystemTemplateSpec | null>(null);
  const [useSpec, setUseSpec] = useState<SystemTemplateSpec | null>(null);
  const [browseAllExpanded, setBrowseAllExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<"all" | TemplateStatus>("all");
  const [operatingModelFilter, setOperatingModelFilter] = useState<OperatingModel | "all">("all");
  const [purposeFilter, setPurposeFilter] = useState<AuditPurpose | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [aiEnabledOnly, setAiEnabledOnly] = useState(false);
  const [evidenceRequiredOnly, setEvidenceRequiredOnly] = useState(false);
  const [activeOnly, setActiveOnly] = useState(false);
  const [duplicateTarget, setDuplicateTarget] = useState<AuditTemplate | null>(null);

  const managerQuery = useQuery({
    queryKey: ["is-org-manager"],
    queryFn: () => isOrgManager(),
  });

  const templatesQuery = useQuery({
    queryKey: [
      "audit-templates",
      statusTab,
      operatingModelFilter,
      purposeFilter,
      aiEnabledOnly,
      evidenceRequiredOnly,
      activeOnly,
      search,
    ],
    queryFn: () =>
      fetchAuditTemplates({
        search,
        status: statusTab === "all" ? "all" : statusTab,
        operatingModel: operatingModelFilter,
        auditPurpose: purposeFilter,
        aiEnabled: aiEnabledOnly || undefined,
        evidenceRequired: evidenceRequiredOnly || undefined,
        activeOnly,
      }),
    enabled: managerQuery.data === true,
  });

  const duplicateMutation = useMutation({
    mutationFn: async ({ sourceId, name }: { sourceId: string; name: string }) => {
      const copy = await duplicateAuditTemplate(sourceId);
      await updateAuditTemplate(copy.id, { name, is_system_template: false });
      return copy;
    },
    onSuccess: (t) => {
      toast.success("Template duplicated as editable customer draft.");
      setDuplicateTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["audit-templates"] });
      window.location.href = `/audit-templates/${t.id}`;
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const archiveMutation = useMutation({
    mutationFn: archiveAuditTemplate,
    onSuccess: () => {
      toast.success("Template archived.");
      void queryClient.invalidateQueries({ queryKey: ["audit-templates"] });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const shareMutation = useMutation({
    mutationFn: shareAuditTemplateWithOrganization,
    onSuccess: () => {
      toast.success("Template shared with your organization.");
      void queryClient.invalidateQueries({ queryKey: ["audit-templates"] });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const currentUserQuery = useQuery({
    queryKey: ["current-user-id"],
    queryFn: requireUserId,
    enabled: managerQuery.data === true,
  });

  const seedAllMutation = useMutation({
    mutationFn: () => seedSystemTemplatesForOrg(),
    onSuccess: ({ created, skipped, errors }) => {
      if (errors.length) {
        toast.error(`Seeded ${created}, skipped ${skipped}. ${errors.length} error(s) — check console.`);
        console.error("Template seed errors:", errors);
      } else {
        toast.success(`System library seeded: ${created} created, ${skipped} already present.`);
      }
      void queryClient.invalidateQueries({ queryKey: ["audit-templates"] });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const dbTemplates = templatesQuery.data ?? [];

  const myTemplates = useMemo(() => {
    const userId = currentUserQuery.data;
    return dbTemplates.filter(
      (t) =>
        !t.is_system_template &&
        t.visibility === "private" &&
        (!userId || t.owner_user_id === userId),
    );
  }, [dbTemplates, currentUserQuery.data]);

  const organizationTemplates = useMemo(
    () =>
      dbTemplates.filter((t) => !t.is_system_template && t.visibility === "organization"),
    [dbTemplates],
  );

  const filteredDbTemplates = useMemo(() => {
    const base =
      libraryTab === "my_templates"
        ? myTemplates
        : libraryTab === "organization"
          ? organizationTemplates
          : dbTemplates;
    if (sourceFilter === "system") return base.filter((t) => t.is_system_template);
    if (sourceFilter === "customer") return base.filter((t) => !t.is_system_template);
    return base;
  }, [dbTemplates, sourceFilter, libraryTab, myTemplates, organizationTemplates]);

  const usageQuery = useQuery({
    queryKey: ["template-usage", filteredDbTemplates.map((t) => t.id).join(",")],
    queryFn: () => fetchTemplateUsageCounts(filteredDbTemplates.map((t) => t.id)),
    enabled:
      (libraryTab === "my_templates" || libraryTab === "organization") &&
      filteredDbTemplates.length > 0,
  });

  const seededKeySet = useMemo(
    () =>
      new Set(
        dbTemplates
          .filter((t) => t.is_system_template)
          .map((t) => `${t.operating_model}:${t.name}`),
      ),
    [dbTemplates],
  );

  const discovery = useMemo(
    () =>
      getDiscoverySections(
        operatingModelFilter,
        purposeFilter,
        search,
        aiEnabledOnly,
        evidenceRequiredOnly,
      ),
    [operatingModelFilter, purposeFilter, search, aiEnabledOnly, evidenceRequiredOnly],
  );

  const purposeOptions = useMemo(
    () => purposeOptionsForFilter(operatingModelFilter),
    [operatingModelFilter],
  );

  const useTemplateMutation = useMutation({
    mutationFn: async (spec: SystemTemplateSpec) => {
      const template = await ensureSystemTemplate(spec.key);
      if (!template) throw new Error("Could not seed template");
      return template;
    },
    onSuccess: (template) => {
      toast.success("Template ready for assignment.");
      setUseSpec(null);
      void queryClient.invalidateQueries({ queryKey: ["audit-templates"] });
      void navigate({
        to: "/new-audit",
        search: { templateId: template.id, systemKey: undefined },
      });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const resolveDbTemplate = (spec: SystemTemplateSpec) =>
    dbTemplates.find(
      (t) =>
        t.is_system_template &&
        (t.purpose_config?.systemTemplateKey === spec.key ||
          (t.operating_model === spec.operatingModel && t.name === spec.name)),
    );

  const counts = useMemo(() => {
    return {
      draft: dbTemplates.filter((t) => t.status === "draft").length,
      published: dbTemplates.filter((t) => t.status === "published").length,
      archived: dbTemplates.filter((t) => t.status === "archived").length,
      system: dbTemplates.filter((t) => t.is_system_template).length,
      customer: dbTemplates.filter((t) => !t.is_system_template).length,
    };
  }, [dbTemplates]);

  if (managerQuery.isLoading) {
    return (
      <AppShell title="" hidePageHeader>
        <Skeleton className="h-48 w-full" />
      </AppShell>
    );
  }

  if (!managerQuery.data) {
    return (
      <AppShell title="" hidePageHeader>
        <EmptyState
          title="Manager access required"
          description="Only organization admins and authorized managers can manage audit templates."
        />
      </AppShell>
    );
  }

  const renderDbTemplateCard = (t: AuditTemplate) => (
    <TemplateLibraryCard
      key={t.id}
      template={t}
      usageCount={usageQuery.data?.[t.id] ?? 0}
      sourceLabel={t.is_system_template ? "Aislix System" : "Organization"}
      onPreview={() =>
        void navigate({
          to: "/audit-templates/$templateId/preview",
          params: { templateId: t.id },
        })
      }
      onUse={() =>
        void navigate({
          to: "/new-audit",
          search: { templateId: t.id, systemKey: undefined },
        })
      }
      advancedMenu={
        <>
          <DropdownMenuItem asChild>
            <Link
              to="/new-audit"
              search={{ templateId: t.id, systemKey: undefined, assign: true }}
            >
              <UserPlus className="mr-2 size-3.5" /> Assign
            </Link>
          </DropdownMenuItem>
          {!t.is_system_template &&
          isCustomBuilderTemplate(t) &&
          !templateHasSavedCsvConfig(t) ? (
            <DropdownMenuItem asChild>
              <Link to="/audit-templates/$templateId" params={{ templateId: t.id }}>
                <Pencil className="mr-2 size-3.5" /> Edit
              </Link>
            </DropdownMenuItem>
          ) : t.is_system_template ? (
            <DropdownMenuItem asChild>
              <Link to="/audit-templates/$templateId" params={{ templateId: t.id }}>
                <Eye className="mr-2 size-3.5" /> View
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={() => setDuplicateTarget(t)}>
            <Copy className="mr-2 size-3.5" /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/audit-templates/$templateId/versions" params={{ templateId: t.id }}>
              <History className="mr-2 size-3.5" /> Version History
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/audit-templates/$templateId/intelligence" params={{ templateId: t.id }}>
              <BarChart3 className="mr-2 size-3.5" /> Audit Intelligence
            </Link>
          </DropdownMenuItem>
          {t.visibility === "private" ? (
            <DropdownMenuItem onClick={() => shareMutation.mutate(t.id)}>
              <Share2 className="mr-2 size-3.5" /> Share with Organization
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          {!t.is_system_template && t.status !== "archived" ? (
            <DropdownMenuItem onClick={() => archiveMutation.mutate(t.id)}>
              <Archive className="mr-2 size-3.5" /> Archive
            </DropdownMenuItem>
          ) : null}
        </>
      }
    />
  );

  return (
    <AppShell title="" hidePageHeader>
      <div className="play-canvas space-y-5">
        <PageHeader
          title="Audit Templates"
          description="Browse ready-made audits or manage your team's template library."
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={seedAllMutation.isPending}
                onClick={() => seedAllMutation.mutate()}
              >
                {seedAllMutation.isPending ? (
                  <Loader2 className="mr-1 size-3 animate-spin" />
                ) : (
                  <Sparkles className="mr-1 size-3" />
                )}
                Seed System Library
              </Button>
              <Button asChild variant="brand" size="sm">
                <Link to="/audit-templates/new">
                  <Plus className="mr-1 size-3" /> Create Template
                </Link>
              </Button>
            </>
          }
        />

        <Tabs value={libraryTab} onValueChange={(v) => setLibraryTab(v as LibraryTab)}>
          <TabsList className="rounded-xl">
            <TabsTrigger value="recommended" className="rounded-lg">
              Recommended
            </TabsTrigger>
            <TabsTrigger value="my_templates" className="rounded-lg">
              My Templates ({myTemplates.length})
            </TabsTrigger>
            <TabsTrigger value="organization" className="rounded-lg">
              Organization ({organizationTemplates.length})
            </TabsTrigger>
            <TabsTrigger value="aislix_system" className="rounded-lg">
              Aislix System ({STARTER_TEMPLATE_LIBRARY.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <FilterBar>
          {(libraryTab === "organization" || libraryTab === "my_templates") && (
            <Tabs value={statusTab} onValueChange={(v) => setStatusTab(v as typeof statusTab)}>
              <TabsList className="h-8">
                <TabsTrigger value="all" className="text-xs">
                  All
                </TabsTrigger>
                <TabsTrigger value="draft" className="text-xs">
                  Drafts ({counts.draft})
                </TabsTrigger>
                <TabsTrigger value="published" className="text-xs">
                  Published ({counts.published})
                </TabsTrigger>
                <TabsTrigger value="archived" className="text-xs">
                  Archived ({counts.archived})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          <FilterRow>
            <FilterSearch
              value={search}
              onChange={setSearch}
              placeholder="Search templates…"
            />
            <Select
              value={operatingModelFilter}
              onValueChange={(v) => setOperatingModelFilter(v as OperatingModel | "all")}
            >
              <SelectTrigger className="w-[180px] rounded-xl">
                <SelectValue placeholder="Operating model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All operating models</SelectItem>
                {OPERATING_MODEL_CARDS.filter((c) => c.id !== "custom").map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={purposeFilter}
              onValueChange={(v) => setPurposeFilter(v as AuditPurpose | "all")}
            >
              <SelectTrigger className="w-[180px] rounded-xl">
                <SelectValue placeholder="Purpose" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All purposes</SelectItem>
                {purposeOptions.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(libraryTab === "organization" || libraryTab === "my_templates") && (
              <Select
                value={sourceFilter}
                onValueChange={(v) => setSourceFilter(v as SourceFilter)}
              >
                <SelectTrigger className="w-[160px] rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  <SelectItem value="system">Aislix System</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                </SelectContent>
              </Select>
            )}
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={aiEnabledOnly} onCheckedChange={(c) => setAiEnabledOnly(Boolean(c))} />
              AI enabled
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={evidenceRequiredOnly}
                onCheckedChange={(c) => setEvidenceRequiredOnly(Boolean(c))}
              />
              Evidence required
            </label>
          </FilterRow>
        </FilterBar>

        {libraryTab === "recommended" ? (
          templatesQuery.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : discovery.recommended.length === 0 ? (
            <EmptyState
              icon={<FileStack className="size-6" />}
              title="No recommended templates match"
              description="Try clearing filters or browse the full Aislix system library."
              action={
                <Button variant="brand" onClick={() => setLibraryTab("aislix_system")}>
                  Browse Aislix System
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {discovery.recommended.map((spec) => {
                const dedupeKey = `${spec.operatingModel}:${spec.name}`;
                return (
                  <TemplateCatalogCard
                    key={spec.key}
                    spec={spec}
                    seeded={seededKeySet.has(dedupeKey)}
                    dbTemplate={resolveDbTemplate(spec)}
                    onPreview={() => setPreviewSpec(spec)}
                    onUse={() => setUseSpec(spec)}
                  />
                );
              })}
            </div>
          )
        ) : libraryTab === "aislix_system" ? (
          templatesQuery.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="space-y-8">
              {discovery.recommended.length > 0 ? (
                <section>
                  <h3 className="mb-1 text-sm font-semibold">Recommended for You</h3>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Flagship and recommended templates for your selected scope.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {discovery.recommended.map((spec) => {
                      const dedupeKey = `${spec.operatingModel}:${spec.name}`;
                      return (
                        <TemplateCatalogCard
                          key={spec.key}
                          spec={spec}
                          seeded={seededKeySet.has(dedupeKey)}
                          dbTemplate={resolveDbTemplate(spec)}
                          onPreview={() => setPreviewSpec(spec)}
                          onUse={() => setUseSpec(spec)}
                        />
                      );
                    })}
                  </div>
                </section>
              ) : null}

              {operatingModelFilter === "all"
                ? discovery.byModel.map((group) => (
                    <section key={group.model}>
                      <h3 className="mb-3 text-sm font-semibold">By Operating Model — {group.label}</h3>
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {group.templates.slice(0, 6).map((spec) => {
                          const dedupeKey = `${spec.operatingModel}:${spec.name}`;
                          return (
                            <TemplateCatalogCard
                              key={spec.key}
                              spec={spec}
                              seeded={seededKeySet.has(dedupeKey)}
                              dbTemplate={resolveDbTemplate(spec)}
                              onPreview={() => setPreviewSpec(spec)}
                              onUse={() => setUseSpec(spec)}
                              compact
                            />
                          );
                        })}
                      </div>
                    </section>
                  ))
                : null}

              {discovery.byPurpose.slice(0, 6).map((group) => (
                <section key={group.purpose}>
                  <h3 className="mb-3 text-sm font-semibold">By Audit Purpose — {group.label}</h3>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {group.templates.slice(0, 3).map((spec) => {
                      const dedupeKey = `${spec.operatingModel}:${spec.name}`;
                      return (
                        <TemplateCatalogCard
                          key={spec.key}
                          spec={spec}
                          seeded={seededKeySet.has(dedupeKey)}
                          dbTemplate={resolveDbTemplate(spec)}
                          onPreview={() => setPreviewSpec(spec)}
                          onUse={() => setUseSpec(spec)}
                          compact
                        />
                      );
                    })}
                  </div>
                </section>
              ))}

              <section>
                <button
                  type="button"
                  className="mb-3 flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-sm font-semibold"
                  onClick={() => setBrowseAllExpanded((v) => !v)}
                >
                  Browse All Templates ({discovery.browseAll.length})
                  <span className="text-xs font-normal text-muted-foreground">
                    {browseAllExpanded ? "Collapse" : "Expand full library"}
                  </span>
                </button>
                {browseAllExpanded ? (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {discovery.browseAll.map((spec) => {
                      const dedupeKey = `${spec.operatingModel}:${spec.name}`;
                      return (
                        <TemplateCatalogCard
                          key={spec.key}
                          spec={spec}
                          seeded={seededKeySet.has(dedupeKey)}
                          dbTemplate={resolveDbTemplate(spec)}
                          onPreview={() => setPreviewSpec(spec)}
                          onUse={() => setUseSpec(spec)}
                        />
                      );
                    })}
                  </div>
                ) : null}
              </section>
            </div>
          )
        ) : templatesQuery.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : templatesQuery.isError ? (
          <ErrorState description={toUserMessage(templatesQuery.error)} />
        ) : !filteredDbTemplates.length ? (
          <EmptyState
            icon={<FileStack className="size-6" />}
            title={
              libraryTab === "my_templates"
                ? "No personal templates yet"
                : "No organization templates match"
            }
            description={
              libraryTab === "my_templates"
                ? "Save a CSV audit as a template from New Audit, or duplicate an existing template."
                : "Seed the Aislix system library, share a personal template, or create a custom template."
            }
            action={
              libraryTab === "my_templates" ? (
                <Button asChild variant="brand">
                  <Link to="/new-audit">Create from New Audit</Link>
                </Button>
              ) : (
                <Button variant="brand" onClick={() => seedAllMutation.mutate()}>
                  Seed System Library
                </Button>
              )
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredDbTemplates.map((t) => renderDbTemplateCard(t))}
          </div>
        )}
      </div>

      <DuplicateTemplateDialog
        open={duplicateTarget !== null}
        onOpenChange={(open) => !open && setDuplicateTarget(null)}
        defaultName={duplicateTarget ? `${duplicateTarget.name} — Copy` : ""}
        duplicating={duplicateMutation.isPending}
        onConfirm={(name) =>
          duplicateTarget && duplicateMutation.mutate({ sourceId: duplicateTarget.id, name })
        }
      />

      <TemplatePreviewSheet
        spec={previewSpec}
        open={previewSpec !== null}
        onOpenChange={(open) => !open && setPreviewSpec(null)}
      />

      <UseTemplateConfirmDialog
        spec={useSpec}
        open={useSpec !== null}
        onOpenChange={(open) => !open && setUseSpec(null)}
        seeded={
          useSpec
            ? seededKeySet.has(`${useSpec.operatingModel}:${useSpec.name}`)
            : false
        }
        existingVersion={useSpec ? resolveDbTemplate(useSpec)?.version : undefined}
        loading={useTemplateMutation.isPending}
        onConfirm={() => useSpec && useTemplateMutation.mutate(useSpec)}
      />
    </AppShell>
  );
}
