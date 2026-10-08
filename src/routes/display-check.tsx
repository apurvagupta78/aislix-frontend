import { useMemo, useRef, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { requireOrgId } from "@/lib/db/context";
import {
  DISPLAY_PLACEMENT_LABEL,
  DISPLAY_STATUS_LABEL,
  DISPLAY_TYPES,
  DISPLAY_TYPE_LABEL,
  type DisplayCheckStatus,
  type DisplayItem,
} from "@/lib/display-check/display-check-parse";
import { DISPLAY_CHECK_FOLDER, runDisplayCheck } from "@/lib/display-check/display-check.functions";
import { photoExtension, shrinkPhoto } from "@/lib/photo/shrink-photo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/display-check")({
  head: () => ({
    meta: [
      { title: "Display check — Aislix" },
      {
        name: "description",
        content: "Photograph a store display. AI checks which displays are there, whose brand, their condition and placement.",
      },
    ],
  }),
  component: DisplayCheckPage,
});

type StoreOption = { id: string; name: string; city: string | null };

type CheckRow = {
  id: string;
  store_id: string;
  storage_path: string;
  expected_brand: string | null;
  status: DisplayCheckStatus;
  items: DisplayItem[];
  summary: string | null;
  image_quality: string | null;
  issues_raised: number;
  created_at: string;
  stores: { name: string | null; city: string | null } | null;
};

const ANY_TYPE = "any";

const STATUS_STYLE: Record<DisplayCheckStatus, string> = {
  good: "border-[#79E2A8] bg-[#79E2A8]/15 text-[#04203F]",
  needs_fix: "border-[#F6CFDC] bg-[#FFEAF1] text-[#04203F]",
  missing: "border-[#F6CFDC] bg-[#FFEAF1] text-[#04203F]",
  none_found: "border-[#D9E2E8] bg-[#EEF1F4] text-[#667085]",
  unclear: "border-[#D9E2E8] bg-[#EEF1F4] text-[#667085]",
};

const CONDITION_LABEL: Record<DisplayItem["condition"], string> = {
  good: "Good",
  damaged: "Damaged",
  missing: "Empty / missing",
};

function certainty(c: number | null): string {
  if (c == null) return "Check on site";
  if (c >= 0.75) return "Sure";
  if (c >= 0.5) return "Likely";
  return "Check on site";
}

function DisplayCheckPage() {
  const queryClient = useQueryClient();
  const [storeId, setStoreId] = useState<string>("");
  const [brand, setBrand] = useState("");
  const [displayType, setDisplayType] = useState<string>(ANY_TYPE);
  const [file, setFile] = useState<File | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const stores = useQuery({
    queryKey: ["display-check-stores"],
    queryFn: async (): Promise<StoreOption[]> => {
      const orgId = await requireOrgId();
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, city")
        .eq("org_id", orgId)
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return (data ?? []) as StoreOption[];
    },
  });

  const checks = useQuery({
    queryKey: ["display-checks"],
    queryFn: async () => {
      const orgId = await requireOrgId();
      const { data, error } = await supabase
        .from("display_checks" as never)
        .select(
          "id, store_id, storage_path, expected_brand, status, items, summary, image_quality, issues_raised, created_at, stores(name, city)",
        )
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      const rows = (data ?? []) as unknown as CheckRow[];
      const { data: signed } = rows.length
        ? await supabase.storage.from("audit-evidence").createSignedUrls(
            rows.map((r) => r.storage_path),
            3600,
          )
        : { data: [] };
      const urls = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
      return rows.map((r) => ({ ...r, photoUrl: urls.get(r.storage_path) ?? null }));
    },
  });

  const run = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Add a photo of the display.");
      if (!storeId) throw new Error("Pick a store.");
      const orgId = await requireOrgId();
      const photo = await shrinkPhoto(file);
      const path = `${orgId}/${DISPLAY_CHECK_FOLDER}/${crypto.randomUUID()}.${photoExtension(photo)}`;
      const { error } = await supabase.storage
        .from("audit-evidence")
        .upload(path, photo, { upsert: false, contentType: photo.type || "image/jpeg" });
      if (error) throw new Error("Could not upload the photo. Try again.");
      return runDisplayCheck({
        data: {
          activeOrgId: orgId,
          storeId,
          storagePath: path,
          expectedBrand: brand.trim() || null,
          expectedDisplay: displayType === ANY_TYPE ? null : DISPLAY_TYPE_LABEL[displayType as DisplayItem["type"]],
        },
      });
    },
    onSuccess: async (out) => {
      toast.success(
        out.issuesRaised
          ? `Checked. ${out.issuesRaised} fix${out.issuesRaised === 1 ? "" : "es"} opened.`
          : `Checked: ${DISPLAY_STATUS_LABEL[out.result.status]}`,
      );
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      await queryClient.invalidateQueries({ queryKey: ["display-checks"] });
      setSelectedId(out.id);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "The display check failed."),
  });

  const rows = checks.data ?? [];
  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? rows[0] ?? null, [rows, selectedId]);

  return (
    <AppShell
      title="Display check"
      description="Photograph a display or POSM. AI checks which displays are there, whose brand, their condition and placement."
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <section
          aria-labelledby="new-check"
          className="h-fit rounded-2xl border border-[#D9E2E8] bg-white p-4 shadow-sm sm:p-5"
        >
          <h2 id="new-check" className="text-base font-semibold text-[#04203F]">
            New display check
          </h2>
          <p className="mt-1 text-sm text-[#667085]">Is the display there, is it ours, and is it in good shape?</p>

          <div className="mt-4 space-y-3">
            <Select value={storeId} onValueChange={setStoreId} disabled={!stores.data?.length}>
              <SelectTrigger className="h-10 rounded-xl" aria-label="Store">
                <SelectValue
                  placeholder={
                    stores.isPending ? "Loading stores…" : stores.data?.length ? "Choose a store" : "No stores in your access"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {(stores.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.city && !s.name.toLowerCase().includes(s.city.toLowerCase()) ? `${s.name} · ${s.city}` : s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={brand}
              maxLength={80}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Expected brand (optional), e.g. Dove"
              aria-label="Expected brand"
            />
            <Select value={displayType} onValueChange={setDisplayType}>
              <SelectTrigger className="h-10 rounded-xl" aria-label="Expected display type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_TYPE}>Any display type</SelectItem>
                {DISPLAY_TYPES.filter((t) => t !== "other").map((t) => (
                  <SelectItem key={t} value={t}>
                    {DISPLAY_TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-3 py-3 text-sm transition-colors duration-150",
                file ? "border-[#7DB7D6] bg-[#EEF6FA] text-[#04203F]" : "border-[#D9E2E8] text-[#667085] hover:bg-[#F4F7F9]",
              )}
            >
              <Camera className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 truncate">{file ? file.name : "Take or choose a photo of the display"}</span>
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <Button
              variant="brand"
              className="w-full rounded-xl"
              disabled={!file || !storeId || run.isPending}
              onClick={() => run.mutate()}
            >
              {run.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Checking display…
                </>
              ) : (
                "Check display"
              )}
            </Button>
            <p className="text-xs text-[#667085]">
              Damaged, empty or missing displays open a fix in{" "}
              <Link to="/corrective-actions" className="underline">
                Corrective Actions
              </Link>
              .
            </p>
          </div>
        </section>

        <section aria-labelledby="check-result" className="space-y-4">
          {checks.isPending ? (
            <div className="h-48 animate-pulse rounded-2xl border border-[#D9E2E8] bg-[#F4F7F9]" aria-busy="true" />
          ) : checks.isError ? (
            <Notice title="Display checks unavailable" body="Refresh the page to try again." />
          ) : !selected ? (
            <Notice
              title="No display checks yet"
              body="Pick a store, take a photo of a display and run your first check."
            />
          ) : (
            <CheckResult row={selected} />
          )}

          {rows.length > 1 ? (
            <div className="rounded-2xl border border-[#D9E2E8] bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-[#04203F]">Recent checks</h3>
              <ul className="mt-2 divide-y divide-[#EEF1F4]">
                {rows.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors duration-150 hover:bg-[#F4F7F9]",
                        selected?.id === r.id && "bg-[#F4F7F9]",
                      )}
                    >
                      {r.photoUrl ? (
                        <img src={r.photoUrl} alt="" className="size-10 shrink-0 rounded-md object-cover" />
                      ) : (
                        <span className="size-10 shrink-0 rounded-md bg-[#EEF1F4]" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-[#04203F]">
                          {r.stores?.name ?? "Store"}
                          {r.expected_brand ? ` · ${r.expected_brand}` : ""}
                        </span>
                        <span className="block text-xs text-[#667085]">
                          {new Date(r.created_at).toLocaleString(undefined, {
                            day: "numeric",
                            month: "short",
                            hour: "numeric",
                            minute: "2-digit",
                          })}{" "}
                          · {r.items.length} display{r.items.length === 1 ? "" : "s"}
                        </span>
                      </span>
                      <StatusPill status={r.status} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}

function StatusPill({ status }: { status: DisplayCheckStatus }) {
  return (
    <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold", STATUS_STYLE[status])}>
      {DISPLAY_STATUS_LABEL[status]}
    </span>
  );
}

function CheckResult({ row }: { row: CheckRow & { photoUrl: string | null } }) {
  return (
    <div id="check-result" className="rounded-2xl border border-[#D9E2E8] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[#04203F]">
            {row.stores?.name ?? "Store"}
            {row.expected_brand ? ` · ${row.expected_brand}` : ""}
          </h2>
          <p className="mt-0.5 text-xs text-[#667085]">
            {new Date(row.created_at).toLocaleString()}
            {row.issues_raised ? ` · ${row.issues_raised} fix${row.issues_raised === 1 ? "" : "es"} opened` : ""}
          </p>
        </div>
        <StatusPill status={row.status} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[200px_minmax(0,1fr)]">
        {row.photoUrl ? (
          <a href={row.photoUrl} target="_blank" rel="noopener noreferrer" className="block">
            <img
              src={row.photoUrl}
              alt="Display photo"
              className="aspect-[3/4] w-full rounded-xl border border-[#D9E2E8] object-cover"
            />
          </a>
        ) : (
          <div className="flex aspect-[3/4] items-center justify-center rounded-xl bg-[#EEF1F4] text-xs text-[#667085]">
            Photo unavailable
          </div>
        )}
        <div className="min-w-0 space-y-3">
          {row.summary ? (
            <p className="flex gap-2 text-sm text-[#04203F]">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-[#9B86D9]" aria-hidden />
              <span>{row.summary}</span>
            </p>
          ) : null}
          {row.status === "unclear" && row.items.length ? (
            <p className="rounded-xl bg-[#EEF1F4] px-3 py-2 text-sm text-[#667085]">
              The photo is too unclear for a verdict, so no fixes were opened. Retake it closer and in better light.
            </p>
          ) : null}
          {row.items.length ? (
            <div className="overflow-x-auto rounded-xl border border-[#D9E2E8]">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-[#F4F7F9] text-left text-xs text-[#667085]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Display</th>
                    <th className="px-3 py-2 font-medium">Brand</th>
                    <th className="px-3 py-2 font-medium">Condition</th>
                    <th className="px-3 py-2 font-medium">Placement</th>
                    <th className="px-3 py-2 font-medium">AI certainty</th>
                  </tr>
                </thead>
                <tbody>
                  {row.items.map((item, i) => (
                    <tr key={i} className="border-t border-[#EEF1F4] align-top">
                      <td className="px-3 py-2 text-[#04203F]">
                        {DISPLAY_TYPE_LABEL[item.type] ?? "Display"}
                        {item.notes ? <span className="block text-xs text-[#667085]">{item.notes}</span> : null}
                      </td>
                      <td className="px-3 py-2 text-[#04203F]">{item.brand ?? "Not readable"}</td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            item.condition === "good" ? "bg-[#79E2A8]/20 text-[#04203F]" : "bg-[#FFEAF1] text-[#04203F]",
                          )}
                        >
                          {CONDITION_LABEL[item.condition] ?? item.condition}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[#667085]">
                        {DISPLAY_PLACEMENT_LABEL[item.placement] ?? "Placement unclear"}
                        {item.visible === false ? <span className="block text-xs">Blocked from view</span> : null}
                      </td>
                      <td className="px-3 py-2 text-[#667085]">{certainty(item.confidence)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-xl bg-[#EEF1F4] px-3 py-3 text-sm text-[#667085]">
              {row.status === "unclear"
                ? "The photo is too unclear to judge displays. Retake it closer and in better light."
                : "No displays were found in this photo."}
            </p>
          )}
          <p className="text-xs text-[#667085]">AI detected · Status decided by Aislix</p>
        </div>
      </div>
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-[#D9E2E8] bg-[#EEF1F4]/80 px-4 py-6">
      <p className="text-sm font-semibold text-[#04203F]">{title}</p>
      <p className="mt-1 text-sm text-[#667085]">{body}</p>
    </div>
  );
}
