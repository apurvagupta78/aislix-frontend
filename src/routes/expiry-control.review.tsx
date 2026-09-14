import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/AppShell";
import { ReviewPanel } from "@/components/expiry-control/ReviewPanel";
import { EmptyState, Skeleton } from "@/components/States";
import { fetchReviewQueue } from "@/lib/expiry-control";

export const Route = createFileRoute("/expiry-control/review")({
  validateSearch: (s: Record<string, unknown>) => ({
    attemptId: typeof s.attemptId === "string" ? s.attemptId : undefined,
  }),
  head: () => ({ meta: [{ title: "Review Queue — Expiry Control" }] }),
  component: ReviewPage,
});

function ReviewPage() {
  const { attemptId } = Route.useSearch();
  const queueQuery = useQuery({ queryKey: ["expiry-review"], queryFn: fetchReviewQueue, retry: false });
  const selected = attemptId ?? queueQuery.data?.[0]?.id;

  return (
    <AppShell title="Review Queue" description="Verify evidence, reconciliation, and removal — no self-approval.">
      {queueQuery.isLoading && <Skeleton className="h-48" />}
      {!selected && !queueQuery.isLoading && (
        <EmptyState title="No inspections awaiting review" description="Submitted inspections appear here." />
      )}
      {selected ? <ReviewPanel attemptId={selected} /> : null}
      {(queueQuery.data ?? []).length > 1 ? (
        <div className="mt-6 space-y-1">
          <p className="text-sm font-medium">Queue</p>
          {(queueQuery.data ?? []).map((a) => (
            <p key={a.id} className="text-sm text-muted-foreground">
              {a.sku} — {a.inspection_status} · removal {a.removal_status}
            </p>
          ))}
        </div>
      ) : null}
    </AppShell>
  );
}
