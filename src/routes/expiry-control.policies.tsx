import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/AppShell";
import { EmptyState, Skeleton } from "@/components/States";
import { fetchPolicies } from "@/lib/expiry-control";

export const Route = createFileRoute("/expiry-control/policies")({
  head: () => ({ meta: [{ title: "Expiry Policies — Aislix" }] }),
  component: PoliciesPage,
});

function PoliciesPage() {
  const query = useQuery({ queryKey: ["expiry-policies"], queryFn: fetchPolicies, retry: false });

  return (
    <AppShell
      title="Expiry Policies"
      description="Versioned policies — near-expiry thresholds, evidence requirements, and quarantine SLAs."
    >
      {query.isLoading && <Skeleton className="h-48" />}
      {query.data?.length === 0 && (
        <EmptyState title="No policies" description="Seed demo data or create a policy after migration." />
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {(query.data ?? []).map((p) => (
          <div key={p.id} className="rounded-2xl border p-4">
            <p className="font-semibold">
              {p.name} v{p.version}
            </p>
            <p className="text-sm text-muted-foreground capitalize">{p.status}</p>
            <p className="mt-2 text-sm">Near expiry: {p.near_expiry_days} days</p>
            {p.published_at ? (
              <p className="text-xs text-muted-foreground">Published {new Date(p.published_at).toLocaleDateString()}</p>
            ) : null}
          </div>
        ))}
      </div>
    </AppShell>
  );
}
