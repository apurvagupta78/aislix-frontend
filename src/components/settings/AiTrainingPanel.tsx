/**
 * Admin export of the accuracy-correction loop: downloads every recorded scan
 * correction as JSON for the backend benchmark importer.
 */

import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SettingsCard } from "@/components/settings/SettingsParts";
import { exportCorrectionsJson, fetchOrgCorrections } from "@/lib/scan-corrections";

export function AiTrainingPanel() {
  const corrections = useQuery({
    queryKey: ["scan-corrections", "org"],
    queryFn: () => fetchOrgCorrections(),
    retry: false,
  });

  const exportJson = useMutation({
    mutationFn: () => exportCorrectionsJson(),
    onSuccess: (count) =>
      count === 0
        ? toast.info("No corrections recorded yet — the export file is empty.")
        : toast.success(`Exported ${count} correction${count === 1 ? "" : "s"}`),
    onError: (error: Error) => toast.error(error.message),
  });

  const count = corrections.data?.length ?? 0;

  return (
    <SettingsCard
      title="AI accuracy corrections"
      description="Every SKU fix your team makes on audit results, exportable for benchmark training."
      icon={Sparkles}
      action={
        <Button
          variant="brand"
          size="sm"
          className="rounded-xl"
          disabled={exportJson.isPending}
          onClick={() => exportJson.mutate()}
        >
          {exportJson.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Export corrections
        </Button>
      }
    >
      <p className="text-sm text-muted-foreground">
        {corrections.isPending
          ? "Counting recorded corrections…"
          : `${count} correction${count === 1 ? "" : "s"} recorded in this workspace.`}{" "}
        The JSON export feeds the recognition benchmark; corrections never block audit completion.
      </p>
    </SettingsCard>
  );
}
