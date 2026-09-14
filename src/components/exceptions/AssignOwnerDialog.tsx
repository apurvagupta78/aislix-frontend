import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toUserMessage } from "@/lib/api/errors";
import { fetchAssignableMembers } from "@/lib/assignments";
import { assignExceptionOwner, type ExceptionRecord } from "@/lib/exceptions";

export function AssignOwnerDialog({
  exception,
  open,
  onOpenChange,
}: {
  exception: ExceptionRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [ownerId, setOwnerId] = useState("");
  const [dueDate, setDueDate] = useState("");

  const membersQuery = useQuery({
    queryKey: ["assignable-members"],
    queryFn: fetchAssignableMembers,
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: () =>
      assignExceptionOwner({
        exceptionId: exception!.id,
        ownerId,
        dueAt: dueDate ? new Date(dueDate).toISOString() : null,
      }),
    onSuccess: () => {
      toast.success("Owner assigned.");
      void queryClient.invalidateQueries({ queryKey: ["exceptions"] });
      void queryClient.invalidateQueries({ queryKey: ["action-required-queue"] });
      onOpenChange(false);
      setOwnerId("");
      setDueDate("");
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  if (!exception) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign owner</DialogTitle>
          <DialogDescription>
            {exception.store_name} · {exception.sku_label ?? exception.title}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Action owner</Label>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select team member" />
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
            <Label>Due date (optional)</Label>
            <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!ownerId || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : "Confirm assignment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
