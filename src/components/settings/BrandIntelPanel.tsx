import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Target, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorState } from "@/components/States";
import { Field, FormSkeleton, SaveBar, SettingsCard } from "@/components/settings/SettingsParts";
import { fetchBrandConfig, saveBrandConfig, type BrandConfig } from "@/lib/brand-intel";

const empty: BrandConfig = { primary_brand: "", competitor_brands: [] };

export function BrandIntelPanel() {
  const queryClient = useQueryClient();
  const configQuery = useQuery({
    queryKey: ["brand-config"],
    queryFn: fetchBrandConfig,
    retry: false,
  });

  const [form, setForm] = useState<BrandConfig>(empty);
  const [competitorsText, setCompetitorsText] = useState("");

  useEffect(() => {
    if (configQuery.data) {
      setForm(configQuery.data);
      setCompetitorsText(configQuery.data.competitor_brands.join(", "));
    }
  }, [configQuery.data]);

  const dirty = useMemo(() => {
    const parsed = competitorsText
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const next = { primary_brand: form.primary_brand.trim(), competitor_brands: parsed };
    const source = configQuery.data ?? empty;
    return JSON.stringify(source) !== JSON.stringify(next);
  }, [form.primary_brand, competitorsText, configQuery.data]);

  const save = useMutation({
    mutationFn: () => {
      const competitor_brands = competitorsText
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      return saveBrandConfig({ primary_brand: form.primary_brand, competitor_brands });
    },
    onSuccess: (data) => {
      setForm(data);
      setCompetitorsText(data.competitor_brands.join(", "));
      void queryClient.invalidateQueries({ queryKey: ["brand-config"] });
      void queryClient.invalidateQueries({ queryKey: ["workspace-context"] });
      toast.success("Brand intelligence settings saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <SettingsCard
      title="Brand & competitor intelligence"
      description="Configure your primary brand and tracked competitors for share-of-shelf on scan results."
      icon={Target}
    >
      {configQuery.isLoading ? (
        <FormSkeleton rows={2} />
      ) : configQuery.isError ? (
        <ErrorState
          title="Couldn't load brand settings"
          description={(configQuery.error as Error).message}
          onRetry={() => void configQuery.refetch()}
        />
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your primary brand" className="sm:col-span-2">
              <Input
                value={form.primary_brand}
                onChange={(e) => setForm((prev) => ({ ...prev, primary_brand: e.target.value }))}
                placeholder="e.g. Lipton"
                className="rounded-xl"
              />
            </Field>
            <Field
              label="Competitor brands"
              hint="Comma-separated. Used for competitor presence and share on scan results."
              className="sm:col-span-2"
            >
              <Input
                value={competitorsText}
                onChange={(e) => setCompetitorsText(e.target.value)}
                placeholder="Tetley, Tata Tea, Brooke Bond"
                className="rounded-xl"
              />
            </Field>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="brand" className="rounded-xl" disabled={!dirty || save.isPending}>
              {save.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Saving…
                </>
              ) : (
                "Save brand settings"
              )}
            </Button>
          </div>
        </form>
      )}
    </SettingsCard>
  );
}
