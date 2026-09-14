import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { VersionHistoryPanel } from "@/components/audit-builder/VersionHistoryPanel";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/States";
import { toUserMessage } from "@/lib/api/errors";
import { fetchAuditTemplate, fetchTemplateVersions } from "@/lib/audit-templates";
import { isOrgManager } from "@/lib/assignments";

export const Route = createFileRoute("/audit-templates/$templateId/versions")({
  head: () => ({ meta: [{ title: "Template Version History — Aislix" }] }),
  component: TemplateVersionsPage,
});

function TemplateVersionsPage() {
  const { templateId } = Route.useParams();
  const managerQuery = useQuery({ queryKey: ["is-org-manager"], queryFn: () => isOrgManager() });
  const templateQuery = useQuery({
    queryKey: ["audit-template", templateId],
    queryFn: () => fetchAuditTemplate(templateId),
    enabled: managerQuery.data === true,
  });
  const versionsQuery = useQuery({
    queryKey: ["template-versions", templateId],
    queryFn: () => fetchTemplateVersions(templateId),
    enabled: managerQuery.data === true,
  });

  if (templateQuery.isLoading || versionsQuery.isLoading) {
    return (
      <AppShell title="Version History">
        <Skeleton className="h-64 w-full" />
      </AppShell>
    );
  }

  const template = templateQuery.data;
  if (!template) {
    return (
      <AppShell title="Version History">
        <ErrorState description="Template not found." />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Version History"
      actions={
        <Button asChild variant="outline" size="sm">
          <Link to="/audit-templates/$templateId" params={{ templateId }}>
            <ArrowLeft className="mr-1 size-3" /> Back to Builder
          </Link>
        </Button>
      }
    >
      <VersionHistoryPanel
        templateName={template.name}
        currentVersion={template.version}
        versions={versionsQuery.data ?? []}
      />
    </AppShell>
  );
}
