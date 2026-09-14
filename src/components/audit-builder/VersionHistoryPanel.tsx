import { GitCompare } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TemplateVersion } from "@/lib/audit-builder/types";

type Props = {
  templateName: string;
  currentVersion: number;
  versions: TemplateVersion[];
};

export function VersionHistoryPanel({ templateName, currentVersion, versions }: Props) {
  const [compare, setCompare] = useState<{ from: number; to: number } | null>(null);

  const sorted = [...versions].sort((a, b) => b.version - a.version);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{templateName}</h2>
        <p className="text-sm text-muted-foreground">Version history — historical audits stay linked to their version.</p>
      </div>
      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          This template has only one version. Publish to create version history.
        </div>
      ) : (
        <ul className="space-y-2">
          {sorted.map((v, idx) => {
            const prev = sorted[idx + 1];
            return (
              <li
                key={v.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">v{v.version}</span>
                    {v.version === currentVersion ? (
                      <Badge variant="secondary">Current</Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {v.change_summary ?? "Published"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(v.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  {prev ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setCompare({ from: prev.version, to: v.version })}
                    >
                      <GitCompare className="mr-1 size-3" />
                      Compare v{prev.version} → v{v.version}
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={compare !== null} onOpenChange={() => setCompare(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              v{compare?.from} → v{compare?.to}
            </DialogTitle>
          </DialogHeader>
          <VersionCompare from={compare?.from ?? 0} to={compare?.to ?? 0} versions={sorted} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VersionCompare({
  from,
  to,
  versions,
}: {
  from: number;
  to: number;
  versions: TemplateVersion[];
}) {
  const newer = versions.find((v) => v.version === to)?.snapshot as Record<string, unknown> | undefined;
  const older = versions.find((v) => v.version === from)?.snapshot as Record<string, unknown> | undefined;

  const newFields = ((newer?.field_definitions as unknown[]) ?? []) as { key: string; label: string; required?: boolean }[];
  const oldFields = ((older?.field_definitions as unknown[]) ?? []) as { key: string; label: string; required?: boolean }[];
  const oldKeys = new Set(oldFields.map((f) => f.key));
  const newKeys = new Set(newFields.map((f) => f.key));

  const added = newFields.filter((f) => !oldKeys.has(f.key));
  const removed = oldFields.filter((f) => !newKeys.has(f.key));
  const changed = newFields.filter((f) => {
    const old = oldFields.find((o) => o.key === f.key);
    return old && old.required !== f.required;
  });

  return (
    <dl className="space-y-3 text-sm">
      <div>
        <dt className="font-medium text-emerald-700 dark:text-emerald-400">Added</dt>
        <dd className="mt-1 text-muted-foreground">
          {added.length ? added.map((f) => f.label).join(", ") : "None"}
        </dd>
      </div>
      <div>
        <dt className="font-medium text-amber-700 dark:text-amber-400">Changed</dt>
        <dd className="mt-1 text-muted-foreground">
          {changed.length
            ? changed.map((f) => `${f.label} → Required`).join(", ")
            : "None"}
        </dd>
      </div>
      <div>
        <dt className="font-medium text-destructive">Removed</dt>
        <dd className="mt-1 text-muted-foreground">
          {removed.length ? removed.map((f) => f.label).join(", ") : "None"}
        </dd>
      </div>
    </dl>
  );
}
