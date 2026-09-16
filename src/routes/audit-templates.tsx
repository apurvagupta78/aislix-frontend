import { useMemo, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  BarChart3,
  Bot,
  Camera,
  Copy,
  Eye,
  FileStack,
  History,
  LayoutGrid,
  List,
  Loader2,
  MoreHorizontal,
  Play,
  Plus,
  Search,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { CollectionMethodBadge } from "@/components/audit/AuditStatusBadges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, Skeleton } from "@/components/States";
import { toUserMessage } from "@/lib/api/errors";
import type { AuditPurpose, OperatingModel } from "@/lib/audit-builder/types";
import { DuplicateTemplateDialog } from "@/components/audit-builder/DuplicateTemplateDialog";
import {
  TEMPLATE_TYPES,
  archiveAuditTemplate,
  duplicateAuditTemplate,
  fetchAuditTemplates,
  fetchTemplateUsageCounts,
  fetchTemplateVersions,
  isCustomBuilderTemplate,
  shareAuditTemplateWithOrganization,
  updateAuditTemplate,
  type AuditTemplate,
  type TemplateStatus,
} from "@/lib/audit-templates";
import { templateHasSavedCsvConfig } from "@/lib/audit-builder/load-saved-template-audit";
import { requireUserId } from "@/lib/db/context";
import { isOrgManager } from "@/lib/assignments";
import {
  getPurposesForModel,
  OPERATING_MODEL_CARDS,
} from "@/lib/audit-engine/operating-model-catalog";
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

type ViewMode = "cards" | "table";
type LibraryTab = "system_catalog" | "my_templates" | "organization";
type SourceFilter = "all" | "system" | "customer";

function AuditTemplatesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [libraryTab, setLibraryTab] = useState<LibraryTab>("system_catalog");
  const [previewSpec, setPreviewSpec] = useState<SystemTemplateSpec | null>(null);
  const [useSpec, setUseSpec] = useState<SystemTemplateSpec | null>(null);
  const [browseAllExpanded, setBrowseAllExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<"all" | TemplateStatus>("all");
  const [operatingModelFilter, setOperatingModelFilter] = useState<OperatingModel | "all">("all");
  const [purposeFilter, setPurposeFilter] = useState<AuditPurpose | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [aiEnabledOnly, setAiEnabledOnly] = useState(false);
  const [evidenceRequiredOnly, setEvidenceRequiredOnly] = useState(false);
  const [activeOnly, setActiveOnly] = useState(false);
  const [versionTemplateId, setVersionTemplateId] = useState<string | null>(null);
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

  const versionsQuery = useQuery({
    queryKey: ["template-versions", versionTemplateId],
    queryFn: () => fetchTemplateVersions(versionTemplateId!),
    enabled: Boolean(versionTemplateId),
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
    enabled: libraryTab !== "system_catalog" && filteredDbTemplates.length > 0,
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
      <AppShell title="Audit Templates">
        <Skeleton className="h-48 w-full" />
      </AppShell>
    );
  }

  if (!managerQuery.data) {
    return (
      <AppShell title="Audit Templates">
        <EmptyState
          title="Manager access required"
          description="Only organization admins and authorized managers can manage audit templates."
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Audit Templates"
      description="Discover Aislix system templates or manage your organization's custom audit templates."
      actions={
        <div className="flex flex-wrap gap-2">
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
            Seed System Library ({STARTER_TEMPLATE_LIBRARY.length})
          </Button>
          <Button asChild variant="brand" size="sm">
            <Link to="/audit-templates/new">
              <Plus className="mr-1 size-3" /> Create Audit Template
            </Link>
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Tabs value={libraryTab} onValueChange={(v) => setLibraryTab(v as LibraryTab)}>
          <TabsList>
            <TabsTrigger value="system_catalog">
              Aislix System Library ({STARTER_TEMPLATE_LIBRARY.length})
            </TabsTrigger>
            <TabsTrigger value="my_templates">My Templates ({myTemplates.length})</TabsTrigger>
            <TabsTrigger value="organization">
              Organization Templates ({organizationTemplates.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <FilterBar
          search={search}
          onSearchChange={setSearch}
          operatingModelFilter={operatingModelFilter}
          onOperatingModelChange={setOperatingModelFilter}
          purposeFilter={purposeFilter}
          onPurposeChange={setPurposeFilter}
          purposeOptions={purposeOptions}
          sourceFilter={sourceFilter}
          onSourceFilterChange={setSourceFilter}
          showSourceFilter={libraryTab === "organization" || libraryTab === "my_templates"}
          aiEnabledOnly={aiEnabledOnly}
          onAiEnabledChange={setAiEnabledOnly}
          evidenceRequiredOnly={evidenceRequiredOnly}
          onEvidenceRequiredChange={setEvidenceRequiredOnly}
          activeOnly={activeOnly}
          onActiveOnlyChange={setActiveOnly}
          showStatusFilters={libraryTab === "organization" || libraryTab === "my_templates"}
          statusTab={statusTab}
          onStatusTabChange={setStatusTab}
          counts={counts}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {libraryTab === "system_catalog" ? (
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
        ) : viewMode === "cards" ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredDbTemplates.map((t) => (
              <OrganizationTemplateCard
                key={t.id}
                template={t}
                usageCount={usageQuery.data?.[t.id] ?? 0}
                onDuplicate={() => setDuplicateTarget(t)}
                onArchive={() => archiveMutation.mutate(t.id)}
                onShare={
                  t.visibility === "private"
                    ? () => shareMutation.mutate(t.id)
                    : undefined
                }
              />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Template</TableHead>
                  <TableHead>Operating Model</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fields</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDbTemplates.map((t) => (
                  <TemplateRow
                    key={t.id}
                    template={t}
                    onDuplicate={() => setDuplicateTarget(t)}
                    onArchive={() => archiveMutation.mutate(t.id)}
                    onVersionHistory={() =>
                      setVersionTemplateId(versionTemplateId === t.id ? null : t.id)
                    }
                    showVersions={versionTemplateId === t.id}
                    versions={versionTemplateId === t.id ? versionsQuery.data ?? [] : []}
                  />
                ))}
              </TableBody>
            </Table>
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

function FilterBar({
  search,
  onSearchChange,
  operatingModelFilter,
  onOperatingModelChange,
  purposeFilter,
  onPurposeChange,
  purposeOptions,
  sourceFilter,
  onSourceFilterChange,
  showSourceFilter,
  aiEnabledOnly,
  onAiEnabledChange,
  evidenceRequiredOnly,
  onEvidenceRequiredChange,
  activeOnly,
  onActiveOnlyChange,
  showStatusFilters,
  statusTab,
  onStatusTabChange,
  counts,
  viewMode,
  onViewModeChange,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  operatingModelFilter: OperatingModel | "all";
  onOperatingModelChange: (v: OperatingModel | "all") => void;
  purposeFilter: AuditPurpose | "all";
  onPurposeChange: (v: AuditPurpose | "all") => void;
  purposeOptions: { value: AuditPurpose; label: string }[];
  sourceFilter: SourceFilter;
  onSourceFilterChange: (v: SourceFilter) => void;
  showSourceFilter: boolean;
  aiEnabledOnly: boolean;
  onAiEnabledChange: (v: boolean) => void;
  evidenceRequiredOnly: boolean;
  onEvidenceRequiredChange: (v: boolean) => void;
  activeOnly: boolean;
  onActiveOnlyChange: (v: boolean) => void;
  showStatusFilters: boolean;
  statusTab: "all" | TemplateStatus;
  onStatusTabChange: (v: "all" | TemplateStatus) => void;
  counts: { draft: number; published: number; archived: number };
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      {showStatusFilters ? (
        <Tabs value={statusTab} onValueChange={(v) => onStatusTabChange(v as typeof statusTab)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="draft">Drafts ({counts.draft})</TabsTrigger>
            <TabsTrigger value="published">Published ({counts.published})</TabsTrigger>
            <TabsTrigger value="archived">Archived ({counts.archived})</TabsTrigger>
          </TabsList>
        </Tabs>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search templates…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <Select
          value={operatingModelFilter}
          onValueChange={(v) => onOperatingModelChange(v as OperatingModel | "all")}
        >
          <SelectTrigger className="w-[180px]">
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
        <Select value={purposeFilter} onValueChange={(v) => onPurposeChange(v as AuditPurpose | "all")}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Audit purpose" />
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
        {showSourceFilter ? (
          <Select value={sourceFilter} onValueChange={(v) => onSourceFilterChange(v as SourceFilter)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="system">Aislix System</SelectItem>
              <SelectItem value="customer">Customer</SelectItem>
            </SelectContent>
          </Select>
        ) : null}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={aiEnabledOnly} onCheckedChange={(c) => onAiEnabledChange(Boolean(c))} />
            AI enabled
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={evidenceRequiredOnly}
              onCheckedChange={(c) => onEvidenceRequiredChange(Boolean(c))}
            />
            Evidence required
          </label>
          {showSourceFilter ? (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={activeOnly} onCheckedChange={(c) => onActiveOnlyChange(Boolean(c))} />
              Active only
            </label>
          ) : null}
        </div>
        {showSourceFilter ? (
          <div className="flex gap-1">
            <Button
              variant={viewMode === "cards" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => onViewModeChange("cards")}
            >
              <LayoutGrid className="size-4" />
            </Button>
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => onViewModeChange("table")}
            >
              <List className="size-4" />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function OrganizationTemplateCard({
  template: t,
  usageCount = 0,
  onDuplicate,
  onArchive,
  onShare,
}: {
  template: AuditTemplate;
  usageCount?: number;
  onDuplicate: () => void;
  onArchive: () => void;
  onShare?: () => void;
}) {
  const typeLabel =
    TEMPLATE_TYPES.find((x) => x.value === t.template_type)?.label ?? t.template_type;
  const modelLabel =
    OPERATING_MODEL_CARDS.find((c) => c.id === t.operating_model)?.title ?? t.operating_model;

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="mb-2 flex flex-wrap gap-1">
            <Badge
              variant={t.is_system_template ? "secondary" : "outline"}
              className="text-[10px]"
            >
              {t.is_system_template ? "Aislix System" : "Customer Template"}
            </Badge>
            {!t.is_system_template ? (
              <Badge variant="outline" className="text-[10px] uppercase">
                {t.visibility === "private" ? "Private" : "Organization"}
              </Badge>
            ) : null}
          </div>
          <Link
            to="/new-audit"
            search={{ templateId: t.id, systemKey: undefined, assign: true }}
            className="font-medium hover:text-brand"
          >
            {t.name}
          </Link>
          {t.short_description || t.description ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {t.short_description ?? t.description}
            </p>
          ) : null}
        </div>
        <StatusBadge status={t.status} published={t.published} />
      </div>
      <div className="mb-3 flex flex-wrap gap-1">
        {modelLabel ? (
          <Badge variant="outline" className="text-[10px]">
            {modelLabel}
          </Badge>
        ) : null}
        <Badge variant="outline" className="text-[10px]">
          {typeLabel}
        </Badge>
        {t.ai_config?.enabled ? (
          <Badge variant="outline" className="text-[10px]">
            AI
          </Badge>
        ) : null}
        {t.evidence_required ? (
          <Badge variant="outline" className="text-[10px]">
            Evidence
          </Badge>
        ) : null}
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        v{t.version} · {t.field_definitions.length} fields · {t.rules.length} rules · Used{" "}
        {usageCount}× · Updated {new Date(t.updated_at).toLocaleDateString()}
      </p>
      <div className="mt-auto flex flex-wrap gap-2">
        <Button asChild size="sm" variant="brand">
          <Link
            to="/new-audit"
            search={{ templateId: t.id, systemKey: undefined, assign: true }}
          >
            <UserPlus className="mr-1 size-3" /> Assign
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/new-audit" search={{ templateId: t.id, systemKey: undefined }}>
            <Play className="mr-1 size-3" /> Use
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/audit-templates/$templateId/preview" params={{ templateId: t.id }}>
            Preview
          </Link>
        </Button>
        <Button size="sm" variant="outline" onClick={onDuplicate}>
          <Copy className="mr-1 size-3" /> Duplicate
        </Button>
        {onShare ? (
          <Button size="sm" variant="outline" onClick={onShare}>
            Share with Organization
          </Button>
        ) : null}
        {!t.is_system_template && t.status !== "archived" ? (
          <Button size="sm" variant="ghost" onClick={onArchive}>
            Archive
          </Button>
        ) : null}
        {t.is_system_template ? (
          <Button asChild size="sm" variant="outline">
            <Link to="/audit-templates/$templateId" params={{ templateId: t.id }}>
              View
            </Link>
          </Button>
        ) : isCustomBuilderTemplate(t) && !templateHasSavedCsvConfig(t) ? (
          <Button asChild size="sm" variant="outline">
            <Link to="/audit-templates/$templateId" params={{ templateId: t.id }}>
              Configure
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function TemplateRow({
  template: t,
  onDuplicate,
  onArchive,
  onVersionHistory,
  showVersions,
  versions,
}: {
  template: AuditTemplate;
  onDuplicate: () => void;
  onArchive: () => void;
  onVersionHistory: () => void;
  showVersions: boolean;
  versions: { version: number; change_summary: string | null; created_at: string }[];
}) {
  const typeLabel =
    TEMPLATE_TYPES.find((x) => x.value === t.template_type)?.label ?? t.template_type;
  const modelLabel =
    OPERATING_MODEL_CARDS.find((c) => c.id === t.operating_model)?.title ?? "—";

  return (
    <>
      <TableRow className={t.status === "draft" ? "bg-muted/20" : undefined}>
        <TableCell>
          <div>
            <Link
              to="/audit-templates/$templateId"
              params={{ templateId: t.id }}
              className="font-medium hover:text-brand"
            >
              {t.name}
            </Link>
            <div className="mt-1 flex flex-wrap gap-1">
              <Badge variant={t.is_system_template ? "secondary" : "outline"} className="text-[10px]">
                {t.is_system_template ? "System" : "Customer"}
              </Badge>
              {isCustomBuilderTemplate(t) ? (
                <Badge variant="outline" className="text-[10px]">
                  Custom Builder
                </Badge>
              ) : null}
            </div>
          </div>
        </TableCell>
        <TableCell className="text-sm">{modelLabel}</TableCell>
        <TableCell className="text-sm">{t.audit_purpose ?? "—"}</TableCell>
        <TableCell>
          <Badge variant="outline">v{t.version}</Badge>
        </TableCell>
        <TableCell>
          <StatusBadge status={t.status} published={t.published} />
          <CollectionMethodBadge mode={t.audit_mode} />
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {t.field_definitions.length} fields · {t.rules.length} rules
        </TableCell>
        <TableCell className="text-right">
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
                  search={{ templateId: t.id, systemKey: undefined, assign: true }}
                >
                  <UserPlus className="mr-2 size-3.5" /> Assign Audit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/new-audit" search={{ templateId: t.id, systemKey: undefined }}>
                  <Play className="mr-2 size-3.5" /> Use Template
                </Link>
              </DropdownMenuItem>
              {!t.is_system_template &&
              isCustomBuilderTemplate(t) &&
              !templateHasSavedCsvConfig(t) ? (
                <DropdownMenuItem asChild>
                  <Link to="/audit-templates/$templateId" params={{ templateId: t.id }}>
                    Configure Template
                  </Link>
                </DropdownMenuItem>
              ) : t.is_system_template ? (
                <DropdownMenuItem asChild>
                  <Link to="/audit-templates/$templateId" params={{ templateId: t.id }}>
                    View Template
                  </Link>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="mr-2 size-3.5" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/audit-templates/$templateId/preview" params={{ templateId: t.id }}>
                  <Eye className="mr-2 size-3.5" /> Preview
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/audit-templates/$templateId/intelligence" params={{ templateId: t.id }}>
                  <BarChart3 className="mr-2 size-3.5" /> View Audit Intelligence
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/audit-templates/$templateId/versions" params={{ templateId: t.id }}>
                  <History className="mr-2 size-3.5" /> Version History
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onVersionHistory}>
                <History className="mr-2 size-3.5" /> Quick Version History
              </DropdownMenuItem>
              {!t.is_system_template && t.status !== "archived" ? (
                <DropdownMenuItem onClick={onArchive}>
                  <Archive className="mr-2 size-3.5" /> Archive
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
      {showVersions ? (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/30 py-3">
            <p className="mb-2 text-xs font-semibold">Version History</p>
            {versions.length === 0 ? (
              <p className="text-xs text-muted-foreground">No published versions yet.</p>
            ) : (
              <ul className="space-y-1 text-xs">
                {versions.map((v) => (
                  <li key={v.version} className="flex justify-between gap-4">
                    <span>
                      v{v.version} — {v.change_summary ?? "Published"}
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(v.created_at).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

function StatusBadge({ status, published }: { status: TemplateStatus; published: boolean }) {
  if (status === "archived") return <Badge variant="outline">Archived</Badge>;
  if (status === "published" || published) {
    return <Badge variant="secondary">Published</Badge>;
  }
  return <Badge variant="outline">Draft</Badge>;
}
