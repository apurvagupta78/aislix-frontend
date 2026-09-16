import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GitBranch, Loader2, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LocationScope } from "@/lib/assignment-engine";
import { fetchHierarchyProfiles, searchHierarchyNodes } from "@/lib/hierarchy";
import {
  FMCG_ASSIGNMENT_LEVELS,
  resolveHierarchyOutlets,
  type FmcgAssignmentLevel,
} from "@/lib/hierarchy/routing";

type Props = {
  value: LocationScope;
  onChange: (scope: LocationScope) => void;
  onResolvedStoreCount?: (count: number) => void;
};

export function FmcgHierarchyScopePicker({ value, onChange, onResolvedStoreCount }: Props) {
  const [levelKey, setLevelKey] = useState<FmcgAssignmentLevel>("region");
  const [search, setSearch] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    value.hierarchyNodeIds?.[0] ?? null,
  );
  const [selectedNodeName, setSelectedNodeName] = useState<string>("");

  const profileQuery = useQuery({
    queryKey: ["hierarchy-profiles", "fmcg_distributor"],
    queryFn: () => fetchHierarchyProfiles("fmcg_distributor"),
  });

  const profileId = profileQuery.data?.[0]?.id;

  const nodesQuery = useQuery({
    queryKey: ["hierarchy-nodes", profileId, levelKey, search],
    queryFn: () =>
      profileId
        ? searchHierarchyNodes({
            profileId,
            levelKey,
            query: search.length >= 2 ? search : undefined,
            activeOnly: true,
            limit: 30,
          })
        : Promise.resolve([]),
    enabled: Boolean(profileId),
  });

  const resolveQuery = useQuery({
    queryKey: ["hierarchy-outlets", profileId, selectedNodeId],
    queryFn: () =>
      profileId && selectedNodeId
        ? resolveHierarchyOutlets(profileId, selectedNodeId)
        : Promise.resolve([]),
    enabled: Boolean(profileId && selectedNodeId),
  });

  const outletCount = resolveQuery.data?.length ?? 0;

  useEffect(() => {
    onResolvedStoreCount?.(outletCount);
  }, [outletCount, onResolvedStoreCount]);

  const applyResolution = () => {
    const outlets = resolveQuery.data ?? [];
    const storeIds = [...new Set(outlets.map((o) => o.storeId))];
    onChange({
      ...value,
      storeIds,
      hierarchyNodeIds: selectedNodeId ? [selectedNodeId] : [],
      stores: outlets.map((o) => ({
        id: o.storeId,
        name: o.nodeName,
      })),
      regions: selectedNodeName ? [selectedNodeName] : value.regions,
    });
  };

  return (
    <div className="space-y-4 rounded-xl border border-dashed p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-semibold">
            <GitBranch className="size-4" />
            FMCG Hierarchy Routing
          </p>
          <p className="text-sm text-muted-foreground">
            Assign by Region, Territory, Distributor, Sales Rep, Beat, or Outlet — outlets resolve to
            stores automatically.
          </p>
        </div>
        {outletCount > 0 ? (
          <Badge variant="secondary">{outletCount} outlet(s) resolved</Badge>
        ) : null}
      </div>

      {!profileId && !profileQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">
          No FMCG hierarchy profile found. Seed hierarchy profiles from Master Data first.
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <Label className="text-xs">Hierarchy level</Label>
          <Select value={levelKey} onValueChange={(v) => setLevelKey(v as FmcgAssignmentLevel)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FMCG_ASSIGNMENT_LEVELS.map((level) => (
                <SelectItem key={level.key} value={level.key}>
                  {level.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="relative md:col-span-2">
          <Label className="text-xs">Search node</Label>
          <Search className="absolute bottom-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder={`Search ${levelKey.replace("_", " ")}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-2">
        {nodesQuery.isLoading ? (
          <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading hierarchy nodes...
          </div>
        ) : null}
        {(nodesQuery.data ?? []).map((node) => (
          <button
            key={node.id}
            type="button"
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-muted/50 ${
              selectedNodeId === node.id ? "bg-brand-soft/30 ring-1 ring-brand/30" : ""
            }`}
            onClick={() => {
              setSelectedNodeId(node.id);
              setSelectedNodeName(node.name);
            }}
          >
            <span>{node.name}</span>
            <Badge variant="outline" className="text-xs">
              {node.level_key}
            </Badge>
          </button>
        ))}
        {!nodesQuery.isLoading && !(nodesQuery.data ?? []).length ? (
          <p className="p-3 text-center text-sm text-muted-foreground">
            No nodes at this level. Try a different search or level.
          </p>
        ) : null}
      </div>

      {selectedNodeId ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Selected: <strong>{selectedNodeName || selectedNodeId}</strong>
          </span>
          <Button
            type="button"
            size="sm"
            disabled={resolveQuery.isLoading || outletCount === 0}
            onClick={applyResolution}
          >
            {resolveQuery.isLoading ? (
              <>
                <Loader2 className="mr-1 size-3.5 animate-spin" />
                Resolving...
              </>
            ) : (
              `Apply ${outletCount} outlet(s) to assignment`
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
