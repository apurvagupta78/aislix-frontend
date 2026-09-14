import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { SeverityBadge } from "@/components/audit/AuditStatusBadges";
import { AssignOwnerDialog } from "@/components/exceptions/AssignOwnerDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorState, Skeleton } from "@/components/States";
import { toUserMessage } from "@/lib/api/errors";
import {
  exceptionLifecycleLabel,
  fetchExceptionById,
  updateExceptionLifecycle,
  type ExceptionLifecycle,
} from "@/lib/exceptions";
import { isOrgManager } from "@/lib/assignments";

export const Route = createFileRoute("/exceptions/$exceptionId")({
  head: () => ({ meta: [{ title: "Exception detail — Aislix" }] }),
  component: ExceptionDetailPage,
});

function ExceptionDetailPage() {
  const { exceptionId } = Route.useParams();
  const queryClient = useQueryClient();
  const [assignOpen, setAssignOpen] = useState(false);

  const managerQuery = useQuery({
    queryKey: ["is-org-manager"],
    queryFn: () => isOrgManager(),
  });

  const query = useQuery({
    queryKey: ["exception", exceptionId],
    queryFn: () => fetchExceptionById(exceptionId),
    enabled: managerQuery.data === true,
  });

  const lifecycleMutation = useMutation({
    mutationFn: (lifecycle: ExceptionLifecycle) => updateExceptionLifecycle(exceptionId, lifecycle),
    onSuccess: () => {
      toast.success("Exception updated.");
      void queryClient.invalidateQueries({ queryKey: ["exception", exceptionId] });
      void queryClient.invalidateQueries({ queryKey: ["exceptions"] });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  if (managerQuery.isLoading || query.isLoading) {
    return (
      <AppShell title="Exception">
        <Skeleton className="h-48 w-full" />
      </AppShell>
    );
  }

  if (!managerQuery.data) {
    return (
      <AppShell title="Exception">
        <ErrorState title="Access denied" description="Managers only." />
      </AppShell>
    );
  }

  const ex = query.data;
  if (!ex) {
    return (
      <AppShell title="Exception">
        <ErrorState title="Not found" description="This exception record could not be loaded." />
      </AppShell>
    );
  }

  return (
    <AppShell title={`Exception · ${ex.title}`} description={ex.store_name}>
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link to="/exceptions">
          <ArrowLeft className="size-4" /> All exceptions
        </Link>
      </Button>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap gap-2">
            <SeverityBadge tier={ex.severity} />
            <Badge variant="outline">{exceptionLifecycleLabel(ex.lifecycle)}</Badge>
            <Badge variant="secondary">{ex.source_type.replace("_", " ")}</Badge>
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Store</dt>
              <dd className="font-medium">{ex.store_name}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Shelf / SKU</dt>
              <dd>
                {ex.shelf_label} · {ex.sku_label}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Impact</dt>
              <dd>{ex.impact_label ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Owner</dt>
              <dd>{ex.owner_name}</dd>
            </div>
          </dl>

          {ex.description ? (
            <p className="text-sm text-muted-foreground">{ex.description}</p>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Approving an audit does not auto-close this exception. Verification may require a
            follow-up audit or manager acceptance.
          </p>
        </div>

        <aside className="space-y-4 rounded-xl border border-border bg-card p-4">
          <h3 className="font-semibold">Next actions</h3>
          {ex.scan_id ? (
            <Button asChild className="w-full">
              <Link to="/audit-review/$scanId" params={{ scanId: ex.scan_id }}>
                Open evidence & review
              </Link>
            </Button>
          ) : null}
          <Button className="w-full" variant="outline" onClick={() => setAssignOpen(true)}>
            Assign owner
          </Button>
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-xs font-medium text-muted-foreground">Update lifecycle</p>
            <Select
              value={ex.lifecycle}
              onValueChange={(v) => lifecycleMutation.mutate(v as ExceptionLifecycle)}
              disabled={lifecycleMutation.isPending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  [
                    "open",
                    "acknowledged",
                    "investigating",
                    "action_assigned",
                    "awaiting_verification",
                    "resolved",
                    "reopened",
                  ] as ExceptionLifecycle[]
                ).map((s) => (
                  <SelectItem key={s} value={s}>
                    {exceptionLifecycleLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {lifecycleMutation.isPending ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : null}
          </div>
          <Button asChild variant="subtle" className="w-full">
            <Link to="/corrective-actions">View corrective actions</Link>
          </Button>
        </aside>
      </div>

      <AssignOwnerDialog exception={ex} open={assignOpen} onOpenChange={setAssignOpen} />
    </AppShell>
  );
}
