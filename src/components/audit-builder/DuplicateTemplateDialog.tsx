import { Loader2 } from "lucide-react";
import { useState } from "react";

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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName: string;
  duplicating: boolean;
  onConfirm: (name: string) => void;
};

export function DuplicateTemplateDialog({
  open,
  onOpenChange,
  defaultName,
  duplicating,
  onConfirm,
}: Props) {
  const [name, setName] = useState(defaultName);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>Duplicate Template</DialogTitle>
          <DialogDescription>
            Creates a new draft copy. The original template is not modified.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label>New template name</Label>
          <Input
            className="mt-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="FNV QC Audit — Delhi"
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="brand"
            disabled={!name.trim() || duplicating}
            onClick={() => onConfirm(name.trim())}
          >
            {duplicating ? <Loader2 className="size-4 animate-spin" /> : "Create as Draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
