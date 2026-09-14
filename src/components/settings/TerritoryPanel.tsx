import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState, Skeleton } from "@/components/States";
import { SettingsCard } from "@/components/settings/SettingsParts";
import { createTerritory, fetchTerritories } from "@/lib/territories";

export function TerritoryPanel() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const query = useQuery({
    queryKey: ["territories"],
    queryFn: fetchTerritories,
    retry: false,
  });

  const create = useMutation({
    mutationFn: () => createTerritory(name),
    onSuccess: () => {
      setName("");
      void queryClient.invalidateQueries({ queryKey: ["territories"] });
      toast.success("Territory created");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <SettingsCard
      title="Territories & regions"
      description="Group stores for roll-up analytics and field team coverage."
      icon={MapPin}
    >
      {query.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : query.isError ? (
        <ErrorState
          title="Couldn't load territories"
          description={(query.error as Error).message}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) create.mutate();
            }}
          >
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="North region, Mumbai zone…"
              className="max-w-xs rounded-xl"
            />
            <Button type="submit" variant="brand" className="rounded-xl" disabled={!name.trim() || create.isPending}>
              <Plus className="size-4" /> Add territory
            </Button>
          </form>
          {query.data?.length ? (
            <ul className="mt-4 space-y-2">
              {query.data.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.store_count} store{t.store_count === 1 ? "" : "s"} · {t.scan_count_30d} audits (30d)
                    </p>
                  </div>
                  {t.avg_compliance_percent !== null && (
                    <span className="font-semibold tabular-nums">{t.avg_compliance_percent}%</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              No territories yet. Create regions, then assign stores from the Stores page.
            </p>
          )}
        </>
      )}
    </SettingsCard>
  );
}
