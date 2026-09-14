import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Copy,
  Eye,
  FileStack,
  History,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { CollectionMethodBadge } from "@/components/audit/AuditStatusBadges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { AUDIT_TYPE_OPTIONS } from "@/lib/audit-builder/field-library";
import {
  TEMPLATE_TYPES,
  archiveAuditTemplate,
  createAuditTemplate,
  duplicateAuditTemplate,
  fetchAuditTemplates,
  fetchTemplateVersions,
  isCustomBuilderTemplate,
  seedFnvQcTemplate,
  type AuditTemplate,
  type TemplateStatus,
} from "@/lib/audit-templates";
import { isOrgManager } from "@/lib/assignments";

export const Route = createFileRoute("/audit-templates")({
  head: () => ({ meta: [{ title: "Audit Templates — Aislix" }] }),
  component: AuditTemplatesPage,
});

function AuditTemplatesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<"all" | TemplateStatus>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [activeOnly, setActiveOnly] = useState(false);
  const [versionTemplateId, setVersionTemplateId] = useState<string | null>(null);

  const managerQuery = useQuery({
    queryKey: ["is-org-manager"],
    queryFn: () => isOrgManager(),
  });

  const templatesQuery = useQuery({
    queryKey: ["audit-templates", statusTab, typeFilter, activeOnly, search],
    queryFn: () =>
      fetchAuditTemplates({
        search,
        status: statusTab === "all" ? "all" : statusTab,
        templateType: typeFilter === "all" ? undefined : typeFilter,
        activeOnly,
      }),
    enabled: managerQuery.data === true,
  });

  const versionsQuery = useQuery({
    queryKey: ["template-versions", versionTemplateId],
    queryFn: () => fetchTemplateVersions(versionTemplateId!),
    enabled: Boolean(versionTemplateId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createAuditTemplate({
        name: "Untitled Audit Template",
        template_type: "custom",
        audit_mode: "digital",
      }),
    onSuccess: (t) => {
      toast.success("Template created — open the builder to add fields.");
      void queryClient.invalidateQueries({ queryKey: ["audit-templates"] });
      window.location.href = `/audit-templates/${t.id}`;
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const duplicateMutation = useMutation({
    mutationFn: duplicateAuditTemplate,
    onSuccess: (t) => {
      toast.success("Template duplicated as draft.");
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

  const seedMutation = useMutation({
    mutationFn: seedFnvQcTemplate,
    onSuccess: (id) => {
      if (id) {
        toast.success("FNV QC sample template created.");
        void queryClient.invalidateQueries({ queryKey: ["audit-templates"] });
        window.location.href = `/audit-templates/${id}`;
      } else {
        toast.message("Sample template requires the audit builder migration.");
      }
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const templates = templatesQuery.data ?? [];

  const counts = useMemo(() => {
    const all = templatesQuery.data ?? [];
    return {
      draft: all.filter((t) => t.status === "draft").length,
      published: all.filter((t) => t.status === "published").length,
      archived: all.filter((t) => t.status === "archived").length,
    };
  }, [templatesQuery.data]);

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
      description="Create and manage reusable audit templates for your retail operations."
      actions={
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={seedMutation.isPending}
            onClick={() => seedMutation.mutate()}
          >
            Load FNV QC Sample
          </Button>
          <Button
            variant="brand"
            size="sm"
            disabled={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Plus className="mr-1 size-3" /> Create Audit Template
              </>
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs
            value={statusTab}
            onValueChange={(v) => setStatusTab(v as typeof statusTab)}
          >
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="draft">Drafts ({counts.draft})</TabsTrigger>
              <TabsTrigger value="published">Published ({counts.published})</TabsTrigger>
              <TabsTrigger value="archived">Archived ({counts.archived})</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search templates…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Audit type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {AUDIT_TYPE_OPTIONS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={activeOnly ? "active" : "all"}
            onValueChange={(v) => setActiveOnly(v === "active")}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {templatesQuery.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : templatesQuery.isError ? (
          <ErrorState description={toUserMessage(templatesQuery.error)} />
        ) : !templates.length ? (
          <EmptyState
            icon={<FileStack className="size-6" />}
            title="No templates yet"
            description="Create a custom audit template or load the FNV QC sample to get started."
            action={
              <Button variant="brand" onClick={() => createMutation.mutate()}>
                <Plus className="mr-1 size-4" /> Create Audit Template
              </Button>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Template</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fields</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t) => (
                  <TemplateRow
                    key={t.id}
                    template={t}
                    onDuplicate={() => duplicateMutation.mutate(t.id)}
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
    </AppShell>
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
            {t.description ? (
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{t.description}</p>
            ) : null}
            {isCustomBuilderTemplate(t) ? (
              <Badge variant="outline" className="mt-1 text-[10px]">
                Custom Builder
              </Badge>
            ) : null}
          </div>
        </TableCell>
        <TableCell className="text-sm">{typeLabel}</TableCell>
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
        <TableCell className="text-sm text-muted-foreground">
          {new Date(t.updated_at).toLocaleDateString()}
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
                <Link to="/audit-templates/$templateId" params={{ templateId: t.id }}>
                  Open / Edit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="mr-2 size-3.5" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  to="/audit-templates/$templateId"
                  params={{ templateId: t.id }}
                  search={{ tab: "preview" }}
                >
                  <Eye className="mr-2 size-3.5" /> Preview
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  to="/assign-scan"
                  search={{
                    store: undefined,
                    scope: undefined,
                    planogramVersion: undefined,
                    templateId: t.id,
                  }}
                >
                  Assign
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onVersionHistory}>
                <History className="mr-2 size-3.5" /> Version History
              </DropdownMenuItem>
              {t.status !== "archived" ? (
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

function StatusBadge({
  status,
  published,
}: {
  status: TemplateStatus;
  published: boolean;
}) {
  if (status === "archived") return <Badge variant="outline">Archived</Badge>;
  if (status === "published" || published) {
    return <Badge variant="secondary">Published</Badge>;
  }
  return <Badge variant="outline">Draft</Badge>;
}
