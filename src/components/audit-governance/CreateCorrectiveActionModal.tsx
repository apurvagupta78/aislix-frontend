import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { toUserMessage } from "@/lib/api/errors";
import { fetchAssignableMembers } from "@/lib/assignments";
import type { Finding } from "@/lib/findings";
import { createActionFromFinding } from "@/lib/corrective-action-lifecycle";
import { findingTypeLabel } from "@/lib/findings";

const SLA_OPTIONS = [
  { hours: 4, label: "4 hours" },
  { hours: 12, label: "12 hours" },
  { hours: 24, label: "24 hours" },
  { hours: 48, label: "48 hours" },
  { hours: 72, label: "72 hours" },
] as const;

const PRIORITIES = ["low", "medium", "high", "critical"] as const;

function formatDuePreview(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Today, ${time}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow, ${time}`;
  return d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function CreateCorrectiveActionModal({
  finding,
  open,
  onOpenChange,
  onCreated,
}: {
  finding: Finding;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (actionId: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(finding.severity);
  const [assigneeId, setAssigneeId] = useState("");
  const [slaHours, setSlaHours] = useState<number | "custom">(24);
  const [customDue, setCustomDue] = useState("");
  const [escalationLevel, setEscalationLevel] = useState("1");
  const [notes, setNotes] = useState("");

  const membersQuery = useQuery({
    queryKey: ["assignable-members"],
    queryFn: fetchAssignableMembers,
    enabled: open,
  });

  const dueAt = useMemo(() => {
    if (slaHours === "custom" && customDue) return new Date(customDue).toISOString();
    if (typeof slaHours === "number") return new Date(Date.now() + slaHours * 36e5).toISOString();
    return null;
  }, [slaHours, customDue]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!assigneeId) throw new Error("Select an owner.");
      const actionTitle =
        title.trim() ||
        `Investigate ${findingTypeLabel(finding.finding_type).toLowerCase()} — ${finding.product_name || finding.sku || "SKU"}`;
      const actionDescription =
        [description.trim(), notes.trim()].filter(Boolean).join("\n\n") ||
        undefined;
      return createActionFromFinding({
        finding,
        title: actionTitle,
        description: actionDescription,
        assignedTo: assigneeId,
        dueAt,
      });
    },
    onSuccess: (actionId) => {
      toast.success("Corrective action created.");
      onOpenChange(false);
      onCreated?.(actionId);
    },
    onError: (err) => toast.error(toUserMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>Create corrective action</DialogTitle>
          <DialogDescription>
            Assign ownership and SLA for {finding.product_name || finding.sku || "this finding"} at{" "}
            {finding.store_name}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div>
            <Label>Finding</Label>
            <p className="mt-1 text-sm text-muted-foreground">
              {findingTypeLabel(finding.finding_type)} · {finding.store_name}
            </p>
          </div>
          <div>
            <Label htmlFor="ca-title">Action title</Label>
            <Input
              id="ca-title"
              className="mt-1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Investigate inventory shortage"
            />
          </div>
          <div>
            <Label htmlFor="ca-desc">Description</Label>
            <Textarea
              id="ca-desc"
              className="mt-1"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What needs to be corrected on the shelf?"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(value) => setPriority(value as (typeof PRIORITIES)[number])}
              >
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Assigned to</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Owner" /></SelectTrigger>
                <SelectContent>
                  {(membersQuery.data ?? []).map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>SLA</Label>
              <Select
                value={String(slaHours)}
                onValueChange={(v) => setSlaHours(v === "custom" ? "custom" : Number(v))}
              >
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SLA_OPTIONS.map((opt) => (
                    <SelectItem key={opt.hours} value={String(opt.hours)}>{opt.label}</SelectItem>
                  ))}
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Escalation level</Label>
              <Select value={escalationLevel} onValueChange={setEscalationLevel}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Level 1 — Store team</SelectItem>
                  <SelectItem value="2">Level 2 — Store manager</SelectItem>
                  <SelectItem value="3">Level 3 — Regional manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {slaHours === "custom" ? (
            <div>
              <Label htmlFor="ca-due">Due date</Label>
              <Input
                id="ca-due"
                type="datetime-local"
                className="mt-1"
                value={customDue}
                onChange={(e) => setCustomDue(e.target.value)}
              />
            </div>
          ) : null}
          {dueAt ? (
            <p className="rounded-xl bg-muted/50 px-3 py-2 text-sm">
              <span className="font-medium">Due:</span> {formatDuePreview(dueAt)}
            </p>
          ) : null}
          <div>
            <Label htmlFor="ca-notes">Notes</Label>
            <Textarea id="ca-notes" className="mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={mutation.isPending || !assigneeId} onClick={() => mutation.mutate()}>
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Create action
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
