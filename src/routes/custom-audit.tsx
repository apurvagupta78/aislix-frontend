import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { AuditExecutionForm } from "@/components/audit-builder/AuditExecutionForm";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/States";
import { toUserMessage } from "@/lib/api/errors";
import type { AuditResponseValue, TemplateField } from "@/lib/audit-builder/types";
import {
  fetchCustomAuditResponses,
  loadCustomAuditSession,
  saveCustomAuditField,
  submitCustomAudit,
  uploadCustomAuditImage,
  type ResponseMap,
} from "@/lib/custom-audit";

export const Route = createFileRoute("/custom-audit")({
  validateSearch: (search: Record<string, unknown>) => ({
    assignmentId:
      typeof search.assignmentId === "string" ? search.assignmentId : undefined,
    test: search.test === true || search.test === "true",
  }),
  head: () => ({ meta: [{ title: "Custom Audit — Aislix" }] }),
  component: CustomAuditPage,
});

function CustomAuditPage() {
  const { assignmentId, test } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [responses, setResponses] = useState<ResponseMap>({});

  const sessionQuery = useQuery({
    queryKey: ["custom-audit-session", assignmentId],
    queryFn: () => loadCustomAuditSession(assignmentId!),
    enabled: Boolean(assignmentId),
  });

  const responsesQuery = useQuery({
    queryKey: ["custom-audit-responses", assignmentId],
    queryFn: () => fetchCustomAuditResponses(assignmentId!),
    enabled: Boolean(assignmentId),
  });

  useEffect(() => {
    if (responsesQuery.data) setResponses(responsesQuery.data);
  }, [responsesQuery.data]);

  const submitMutation = useMutation({
    mutationFn: () =>
      submitCustomAudit({
        assignmentId: assignmentId!,
        session: sessionQuery.data!,
        responses,
        testMode: test,
      }),
    onSuccess: ({ scanId, findingsCount }) => {
      if (test) {
        toast.success("Test audit validated successfully.");
        return;
      }
      toast.success(
        `Audit submitted${findingsCount ? ` — ${findingsCount} finding(s) flagged` : ""}.`,
      );
      void queryClient.invalidateQueries({ queryKey: ["my-scans"] });
      if (scanId) navigate({ to: "/results", search: { scanId } });
      else navigate({ to: "/my-scans" });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  if (!assignmentId) {
    return (
      <AppShell title="Custom Audit">
        <ErrorState description="Open this page from My Work with a custom template assignment." />
      </AppShell>
    );
  }

  if (sessionQuery.isLoading) {
    return (
      <AppShell title="Custom Audit">
        <Skeleton className="h-96 w-full" />
      </AppShell>
    );
  }

  const session = sessionQuery.data;
  if (sessionQuery.isError || !session) {
    return (
      <AppShell title="Custom Audit">
        <ErrorState
          description={
            toUserMessage(sessionQuery.error) ||
            "This assignment does not use a custom audit template."
          }
        />
      </AppShell>
    );
  }

  const handleSaveField = async (
    sectionKey: string,
    recordIndex: number,
    field: TemplateField,
    value: AuditResponseValue,
  ) => {
    await saveCustomAuditField({
      assignmentId: assignmentId!,
      templateId: session.template.id,
      templateVersion: session.template.version,
      sectionKey,
      recordIndex,
      field,
      value,
    });
  };

  return (
    <AppShell
      title={session.template.name}
      description="Complete the configured audit workflow."
      actions={
        <Button
          variant="brand"
          disabled={submitMutation.isPending}
          onClick={() => submitMutation.mutate()}
        >
          {submitMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : test ? (
            "Validate Test Audit"
          ) : (
            "Submit Audit"
          )}
        </Button>
      }
    >
      <div className="mx-auto max-w-lg pb-24">
        <AuditExecutionForm
          definition={session.definition}
          templateName={session.template.name}
          storeName={session.storeName}
          dueAt={session.dueAt}
          responses={responses}
          onChange={setResponses}
          onSaveField={handleSaveField}
          onUploadImage={(file) => uploadCustomAuditImage(assignmentId!, file)}
        />
      </div>
    </AppShell>
  );
}
