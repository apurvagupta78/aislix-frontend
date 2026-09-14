import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createAssignment, fetchAssignments } from "@/lib/expiry-control";
import { fetchStores } from "@/lib/account";
import { fetchAssignableMembers } from "@/lib/assignments";
import { requireUserId } from "@/lib/db/context";

export const Route = createFileRoute("/expiry-control/planner")({
  head: () => ({ meta: [{ title: "Inspection Planner — Expiry Control" }] }),
  component: PlannerPage,
});

function PlannerPage() {
  const navigate = useNavigate();
  const storesQuery = useQuery({ queryKey: ["stores"], queryFn: () => fetchStores().then((r) => r.items) });
  const membersQuery = useQuery({ queryKey: ["assignable-members"], queryFn: fetchAssignableMembers });
  const listQuery = useQuery({ queryKey: ["expiry-assignments"], queryFn: fetchAssignments, retry: false });

  const [storeId, setStoreId] = useState("");
  const [title, setTitle] = useState("");
  const [sku, setSku] = useState("");
  const [auditorId, setAuditorId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [assurance, setAssurance] = useState("standard");
  const [instructions, setInstructions] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      const userId = await requireUserId();
      return createAssignment({
        storeId,
        title: title || `Expiry inspection — ${sku || "SKU"}`,
        auditorId: auditorId || userId,
        dueAt: dueAt || undefined,
        sku: sku || undefined,
        assuranceLevel: assurance,
        instructions: instructions || undefined,
      });
    },
    onSuccess: (attemptId) => {
      navigate({ to: "/expiry-control/inspect/$attemptId", params: { attemptId } });
    },
  });

  return (
    <AppShell title="Inspection Planner" description="Assign expiry inspections with policy snapshots and required locations.">
      <div className="grid gap-8 lg:grid-cols-2">
        <form
          className="space-y-3 rounded-2xl border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <div>
            <Label>Store</Label>
            <Select value={storeId} onValueChange={setStoreId}>
              <SelectTrigger>
                <SelectValue placeholder="Select store" />
              </SelectTrigger>
              <SelectContent>
                {(storesQuery.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Maggi main shelf check" />
          </div>
          <div>
            <Label>SKU</Label>
            <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="MAGGI-70G" />
          </div>
          <div>
            <Label>Auditor</Label>
            <Select value={auditorId} onValueChange={setAuditorId}>
              <SelectTrigger>
                <SelectValue placeholder="Assign auditor" />
              </SelectTrigger>
              <SelectContent>
                {(membersQuery.data ?? []).map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Due date</Label>
            <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </div>
          <div>
            <Label>Evidence assurance</Label>
            <Select value={assurance} onValueChange={setAssurance}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="high">High (live camera)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Instructions</Label>
            <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">
            Shelf-only inspections are never labeled store fully checked. Required locations: main shelf + backroom by default when configured.
          </p>
          <Button type="submit" disabled={!storeId || createMutation.isPending}>
            Create & open inspection
          </Button>
        </form>

        <div className="space-y-2">
          <h3 className="font-semibold">Recent assignments</h3>
          {(listQuery.data ?? []).map((a) => (
            <div key={a.id} className="rounded-xl border px-3 py-2 text-sm">
              <p className="font-medium">{a.title}</p>
              <p className="text-muted-foreground">{a.status} · {a.sku_filters?.sku ?? "All SKUs"}</p>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
