import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import {
  CheckPhoto,
  PhotoPicker,
  QuickCheckDisclaimer,
  QuickCheckResultSlot,
  StorePicker,
  formatCheckTime,
  uploadQuickCheckPhoto,
  useQuickCheckResult,
  type QuickCheckRowBase,
} from "@/components/quick-checks/QuickCheckParts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DISPLAY_PLACEMENT_LABEL,
  DISPLAY_STATUS_LABEL,
  DISPLAY_TYPES,
  DISPLAY_TYPE_LABEL,
  type DisplayCheckStatus,
  type DisplayItem,
} from "@/lib/display-check/display-check-parse";
import { DISPLAY_CHECK_FOLDER, runDisplayCheck } from "@/lib/display-check/display-check.functions";
import { cn } from "@/lib/utils";

const DESCRIPTION =
  "Photograph a display or POSM. AI checks which displays are there, whose brand, their condition and placement.";

export const Route = createFileRoute("/display-check")({
  head: () => ({
    meta: [{ title: "Display check — Aislix" }, { name: "description", content: DESCRIPTION }],
  }),
  component: DisplayCheckPage,
});

type CheckRow = QuickCheckRowBase & {
  expected_brand: string | null;
  status: DisplayCheckStatus;
  items: DisplayItem[];
  summary: string | null;
};

const COLUMNS = "expected_brand, status, items, summary";
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
  const [storeId, setStoreId] = useState("");
  const [brand, setBrand] = useState("");
  const [displayType, setDisplayType] = useState<string>(ANY_TYPE);
  const [file, setFile] = useState<File | null>(null);
  const [lastId, setLastId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const check = useQuickCheckResult<CheckRow>("display_checks", COLUMNS, lastId);

  const run = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Add a photo of the display.");
      if (!storeId) throw new Error("Pick a store.");
      const { orgId, path } = await uploadQuickCheckPhoto(file, DISPLAY_CHECK_FOLDER);
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
    onSuccess: (out) => {
      toast.success(`Checked: ${DISPLAY_STATUS_LABEL[out.result.status]}`);
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      setLastId(out.id);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "The display check failed."),
  });

  return (
    <AppShell title="Display check" description={DESCRIPTION}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <section aria-labelledby="new-check" className="h-fit rounded-2xl border border-[#D9E2E8] bg-white p-4 sm:p-5">
          <h2 id="new-check" className="text-base font-semibold text-[#04203F]">
            New display check
          </h2>
          <p className="mt-1 text-sm text-[#667085]">Is the display there, is it ours, and is it in good shape?</p>

          <div className="mt-4 space-y-3">
            <StorePicker value={storeId} onChange={setStoreId} />
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
            <PhotoPicker file={file} onChange={setFile} inputRef={fileInput} placeholder="Take or choose a photo of the display" />
            <Button
              variant="brand"
              className="h-11 w-full rounded-xl"
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
            <p className="text-xs text-[#667085]">Stand back so the whole display and its surroundings are in the photo.</p>
          </div>
        </section>

        <section aria-labelledby="check-result" className="min-w-0 space-y-4">
          <QuickCheckResultSlot
            id={lastId}
            query={check}
            running={run.isPending}
            emptyTitle="Your result will appear here"
            emptyBody="Pick a store, take a photo of a display and run the check."
          >
            {(row) => <CheckResult row={row} />}
          </QuickCheckResultSlot>
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
  const items = Array.isArray(row.items) ? row.items : [];
  return (
    <div id="check-result" className="rounded-2xl border border-[#D9E2E8] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[#04203F]">
            {row.stores?.name ?? "Store"}
            {row.expected_brand ? ` · ${row.expected_brand}` : ""}
          </h2>
          <p className="mt-0.5 text-xs text-[#667085]">{formatCheckTime(row.created_at)}</p>
        </div>
        <StatusPill status={row.status} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[200px_minmax(0,1fr)]">
        <CheckPhoto url={row.photoUrl} alt="Display photo" />
        <div className="min-w-0 space-y-3">
          {row.summary ? (
            <p className="flex gap-2 text-sm text-[#04203F]">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-[#9B86D9]" aria-hidden />
              <span>{row.summary}</span>
            </p>
          ) : null}
          {row.status === "unclear" && items.length ? (
            <p className="rounded-xl bg-[#EEF1F4] px-3 py-2 text-sm text-[#667085]">
              The photo is too unclear for a verdict. Retake it closer and in better light.
            </p>
          ) : null}
          {items.length ? (
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
                  {items.map((item, i) => (
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
      <div className="mt-4">
        <QuickCheckDisclaimer />
      </div>
    </div>
  );
}
