import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Skeleton } from "@/components/States";
import { toUserMessage } from "@/lib/api/errors";
import { createBlankAuditTemplate } from "@/lib/audit-templates";
import { isOrgManager } from "@/lib/assignments";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/audit-templates/new")({
  head: () => ({ meta: [{ title: "New audit template — Aislix" }] }),
  component: NewTemplatePage,
});

function NewTemplatePage() {
  const navigate = useNavigate();
  const managerQuery = useQuery({ queryKey: ["is-org-manager"], queryFn: () => isOrgManager() });

  const createMutation = useMutation({
    mutationFn: () => createBlankAuditTemplate({}),
    onSuccess: (t) => {
      void navigate({ to: "/audit-templates/$templateId", params: { templateId: t.id } });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  useEffect(() => {
    if (managerQuery.data === true && !createMutation.isPending && !createMutation.isSuccess) {
      createMutation.mutate();
    }
  }, [managerQuery.data, createMutation.isPending, createMutation.isSuccess]);

  return (
    <AppShell title="Create audit template">
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <Loader2 className="size-8 animate-spin text-brand" />
        <Skeleton className="h-4 w-48" />
        <p className="text-sm text-muted-foreground">Setting up your audit template builder…</p>
      </div>
    </AppShell>
  );
}
