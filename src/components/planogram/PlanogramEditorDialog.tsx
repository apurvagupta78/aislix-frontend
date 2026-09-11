/**
 * Add / edit a planogram in a store's library — tabbed audit package editor.
 */

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
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
import { PlanogramAuditTabs } from "@/components/planogram/PlanogramAuditTabs";
import { StickyError } from "@/components/planogram/PlanogramBuilder";
import { toUserMessage } from "@/lib/api/errors";
import type { ShelfCategory } from "@/lib/categories.data";
import { dominantScopeFromRows, type DraftRow, type SourceType } from "@/lib/planogram";
import {
  EMPTY_AUDIT_PACKAGE,
  type PlanogramAuditPackage,
} from "@/lib/planogram-audit-package";
import {
  createStorePlanogram,
  loadPlanogramForEdit,
  updateStorePlanogram,
} from "@/lib/planogram-library";

export type PlanogramEditorTarget =
  | { mode: "create" }
  | { mode: "edit"; versionId: string; name: string };

export function PlanogramEditorDialog({
  open,
  onOpenChange,
  storeId,
  storeName,
  categories,
  target,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  storeName: string;
  categories: ShelfCategory[];
  target: PlanogramEditorTarget;
  onSaved: () => void;
}) {
  const editing = target.mode === "edit";
  const [name, setName] = useState("");
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [auditPackage, setAuditPackage] = useState<PlanogramAuditPackage>({ ...EMPTY_AUDIT_PACKAGE });
  const [sources, setSources] = useState<{ csv: boolean; manual: boolean }>({
    csv: false,
    manual: false,
  });
  const [filename, setFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const sourceType: SourceType =
    sources.csv && sources.manual ? "mixed" : sources.manual ? "manual" : "csv";
  const summary = dominantScopeFromRows(rows);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSources({ csv: false, manual: false });
    setFilename(null);
    setAuditPackage({ ...EMPTY_AUDIT_PACKAGE });
    if (target.mode === "create") {
      setName("");
      setRows([]);
      return;
    }
    setName(target.name);
    setRows([]);
    setLoading(true);
    loadPlanogramForEdit(target.versionId)
      .then((data) => {
        setName(data.name);
        setRows(data.rows);
        setAuditPackage(data.auditPackage ?? { ...EMPTY_AUDIT_PACKAGE });
        setSources({ csv: data.source_type !== "manual", manual: data.source_type !== "csv" });
      })
      .catch((err) => setError(toUserMessage(err)))
      .finally(() => setLoading(false));
  }, [open, target]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!rows.length) throw new Error("Add at least one expected product.");
      if (target.mode === "edit") {
        await updateStorePlanogram({
          versionId: target.versionId,
          storeId,
          rows,
          sourceType,
          name,
          auditPackage,
        });
        return "updated" as const;
      }
      await createStorePlanogram({
        storeId,
        rows,
        sourceType,
        name,
        sourceFilename: filename,
        auditPackage,
      });
      return "created" as const;
    },
    onMutate: () => setError(null),
    onSuccess: (result) => {
      toast.success(
        result === "created"
          ? "Planogram saved — ready to assign"
          : "Planogram updated — ready to assign",
      );
      onSaved();
      onOpenChange(false);
    },
    onError: (err) => setError(toUserMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto border-brand/10">
        <DialogHeader>
          <DialogTitle className="text-brand">{editing ? "Edit planogram" : "Add planogram"}</DialogTitle>
          <DialogDescription>
            Build a complete audit package for {storeName} — products, assortment, prices, promotions and KPI
            targets.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="max-w-sm space-y-1.5">
            <Label className="text-xs" htmlFor="planogram-name">
              Planogram name
            </Label>
            <Input
              id="planogram-name"
              className="rounded-xl border-brand/20 focus-visible:ring-brand/30"
              placeholder={
                summary.location || summary.sub_category
                  ? [summary.location, summary.sub_category || summary.category]
                      .filter(Boolean)
                      .join(" · ")
                  : "e.g. Shampoo row A-1-Z"
              }
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          {error && (
            <StickyError
              title="Could not save this planogram"
              message={error}
              onDismiss={() => setError(null)}
            />
          )}

          {loading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-brand" /> Loading planogram…
            </p>
          ) : (
            <PlanogramAuditTabs
              rows={rows}
              onRowsChange={setRows}
              categories={categories}
              auditPackage={auditPackage}
              onAuditPackageChange={setAuditPackage}
              onFilename={setFilename}
              onSource={(source) => setSources((prev) => ({ ...prev, [source]: true }))}
              tableActions={
                rows.length > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-xl text-destructive"
                    onClick={() => setRows([])}
                  >
                    <Trash2 className="mr-2 size-4" /> Clear all
                  </Button>
                ) : null
              }
            />
          )}

          {rows.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {summary.productCount} product{summary.productCount === 1 ? "" : "s"} ·{" "}
              {summary.facingCount} expected facings
              {[summary.category, summary.sub_category, summary.location].filter(Boolean).length
                ? ` · ${[summary.category, summary.sub_category, summary.location]
                    .filter(Boolean)
                    .join(" · ")}`
                : ""}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="brand"
            className="rounded-xl"
            disabled={!rows.length || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {editing ? "Save changes" : "Save planogram"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
