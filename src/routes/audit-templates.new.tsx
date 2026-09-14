import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Skeleton } from "@/components/States";
import { toUserMessage } from "@/lib/api/errors";
import { createAuditTemplate } from "@/lib/audit-templates";
import { isOrgManager } from "@/lib/assignments";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/audit-templates/new")({
  head: () => ({ meta: [{ title: "New Audit Template — Aislix" }] }),
  component: NewTemplatePage,
});

function NewTemplatePage() {
  const navigate = useNavigate();
  const managerQuery = useQuery({ queryKey: ["is-org-manager"], queryFn: () => isOrgManager() });

  const createMutation = useMutation({
    mutationFn: () =>
      createAuditTemplate({
        name: "Untitled Audit Template",
        template_type: "custom",
        audit_mode: "digital",
        sections: [
          { key: "store_info", title: "Store Information", order: 0 },
          { key: "product", title: "Product Information", order: 1, repeatable: true, repeatBy: "sku" },
          { key: "quantity", title: "Quantity", order: 2, repeatable: true, repeatBy: "sku" },
          { key: "expiry", title: "Expiry", order: 3, repeatable: true, repeatBy: "sku" },
          { key: "quality", title: "Quality", order: 4, repeatable: true, repeatBy: "sku" },
          { key: "evidence", title: "Evidence", order: 5, repeatable: true, repeatBy: "sku" },
          { key: "rca", title: "RCA", order: 6, repeatable: true, repeatBy: "sku" },
        ],
      }),
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
    <AppShell title="Create Audit Template">
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <Loader2 className="size-8 animate-spin text-brand" />
        <Skeleton className="h-4 w-48" />
        <p className="text-sm text-muted-foreground">Setting up your audit template builder…</p>
      </div>
    </AppShell>
  );
}
