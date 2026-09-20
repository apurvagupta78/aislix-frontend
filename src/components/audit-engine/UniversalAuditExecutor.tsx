import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AuditExecutionForm } from "@/components/audit-builder/AuditExecutionForm";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ErrorState, Skeleton } from "@/components/States";
import { toUserMessage } from "@/lib/api/errors";
import type { AuditResponseValue, TemplateField } from "@/lib/audit-builder/types";
import { validateAuditCompletion } from "@/lib/audit-engine/completion";
import {
  auditExecutionPath,
  resolveAuditExecutionRoute,
  type AuditExecutionContext,
} from "@/lib/audit-engine";
import {
  fetchCustomAuditResponses,
  loadCustomAuditSession,
  mergeInputDatasetIntoResponses,
  saveCustomAuditField,
  submitCustomAudit,
  uploadCustomAuditImage,
  type ResponseMap,
} from "@/lib/custom-audit";

type UniversalAuditExecutorProps = {
  assignmentId: string;
  testMode?: boolean;
};

export function UniversalAuditExecutor({ assignmentId, testMode = false }: UniversalAuditExecutorProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [responses, setResponses] = useState<ResponseMap>({});

  const sessionQuery = useQuery({
    queryKey: ["custom-audit-session", assignmentId],
    queryFn: () => loadCustomAuditSession(assignmentId),
  });

  const responsesQuery = useQuery({
    queryKey: ["custom-audit-responses", assignmentId],
    queryFn: () => fetchCustomAuditResponses(assignmentId),
  });

  useEffect(() => {
    if (!responsesQuery.data || !sessionQuery.data) return;
    setResponses(mergeInputDatasetIntoResponses(sessionQuery.data, responsesQuery.data));
  }, [responsesQuery.data, sessionQuery.data]);

  const session = sessionQuery.data;

  useEffect(() => {
    if (!session || testMode) return;
    const ctx: AuditExecutionContext = {
      assignmentId,
      method:
        session.template.audit_mode === "ai"
          ? "ai"
          : session.template.audit_mode === "ai_assisted"
            ? "ai_assisted"
            : "digital",
      templateType: session.template.template_type,
      operatingModel: session.template.operating_model,
      creationSource: null,
      hasFieldDefinitions: (session.template.field_definitions?.length ?? 0) > 0,
    };
    const route = resolveAuditExecutionRoute(ctx);
    if (route !== "universal" && route !== "custom") {
      navigate({ to: auditExecutionPath(assignmentId, route) as "/" });
    }
  }, [assignmentId, navigate, session, testMode]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const completion = await validateAuditCompletion(assignmentId);
      if (!completion.ok && !testMode) {
        const parts: string[] = [];
        if (completion.missingRcaCount) parts.push(`${completion.missingRcaCount} RCA(s) missing`);
        if (completion.missingExpiryCoverageRecords) {
          parts.push(`${completion.missingExpiryCoverageRecords} expiry coverage gap(s)`);
        }
        if (completion.missingEvidenceCount) {
          parts.push(`${completion.missingEvidenceCount} required photo(s) missing`);
        }
        throw new Error(parts.join("; ") || "Audit completion requirements not met.");
      }
      return submitCustomAudit({
        assignmentId,
        session: session!,
        responses,
        testMode,
      });
    },
    onSuccess: ({ scanId, findingsCount }) => {
      if (testMode) {
        toast.success("Test audit validated successfully.");
        return;
      }
      toast.success(
        `Audit submitted${findingsCount ? ` — ${findingsCount} finding(s) flagged` : ""}.`,
      );
      void queryClient.invalidateQueries({ queryKey: ["my-scans"] });
      if (scanId) navigate({ to: "/results", search: { scan: scanId } });
      else navigate({ to: "/my-scans" });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  if (sessionQuery.isLoading) return <Skeleton className="h-64 w-full" />;
  if (sessionQuery.isError || !session) {
    return (
      <ErrorState
        description={
          sessionQuery.error
            ? toUserMessage(sessionQuery.error)
            : "Could not load this audit assignment."
        }
      />
    );
  }

  const handleSaveField = async (
    sectionKey: string,
    recordIndex: number,
    field: TemplateField,
    value: AuditResponseValue,
  ) => {
    await saveCustomAuditField({
      assignmentId,
      templateId: session.template.id,
      templateVersion: session.template.version,
      sectionKey,
      recordIndex,
      field,
      value,
    });
  };

  return (
    <div className="space-y-4">
      {session.template.operating_model && (
        <Alert>
          <AlertDescription>
            Operating model:{" "}
            <strong>{session.template.operating_model.replace(/_/g, " ")}</strong>
            {session.template.audit_purpose
              ? ` · ${session.template.audit_purpose.replace(/_/g, " ")}`
              : ""}
          </AlertDescription>
        </Alert>
      )}
      <div className="mx-auto max-w-lg pb-24">
        <AuditExecutionForm
          definition={session.definition}
          templateName={session.template.name}
          storeName={session.storeName}
          dueAt={session.dueAt}
          responses={responses}
          onChange={setResponses}
          onSaveField={handleSaveField}
          onUploadImage={(file) => uploadCustomAuditImage(assignmentId, file)}
          readOnly={session.status !== "pending" && session.status !== "in_progress"}
          testMode={testMode}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
          {submitMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {testMode ? "Validate test audit" : "Submit audit"}
        </Button>
      </div>
    </div>
  );
}
