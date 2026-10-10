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
  VerdictPill,
  formatCheckTime,
  uploadQuickCheckPhoto,
  useQuickCheckResult,
  type QuickCheckRowBase,
} from "@/components/quick-checks/QuickCheckParts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  HYGIENE_VERDICT_LABEL,
  hygieneTypeLabel,
  type HygieneIssue,
  type HygieneSeverity,
  type HygieneVerdict,
} from "@/lib/quick-checks/quick-check-parse";
import { QUICK_CHECK_FOLDERS, runHygieneCheck } from "@/lib/quick-checks/quick-checks.functions";
import { cn } from "@/lib/utils";

const DESCRIPTION = "Photograph a shelf. AI says whether hygiene passed, and exactly what to clean or fix if it failed.";

export const Route = createFileRoute("/hygiene-check")({
  head: () => ({
    meta: [{ title: "Hygiene check — Aislix" }, { name: "description", content: DESCRIPTION }],
  }),
  component: HygieneCheckPage,
});

type CheckRow = QuickCheckRowBase & {
  area: string | null;
  verdict: HygieneVerdict;
  issues: HygieneIssue[];
  summary: string | null;
};

const COLUMNS = "area, verdict, issues, summary";

const TONE: Record<HygieneVerdict, "good" | "bad" | "neutral"> = {
  passed: "good",
  failed: "bad",
  check_manually: "neutral",
};

const SEVERITY_LABEL: Record<HygieneSeverity, string> = { high: "High", medium: "Medium", low: "Low" };

const SEVERITY_EDGE: Record<HygieneSeverity, string> = {
  high: "border-l-[#ECBDCC]",
  medium: "border-l-[#9B86D9]",
  low: "border-l-[#D9E2E8]",
};

function checkTitle(row: CheckRow): string {
  return `${row.stores?.name ?? "Store"}${row.area ? ` · ${row.area}` : ""}`;
}

function HygieneCheckPage() {
  const [storeId, setStoreId] = useState("");
  const [area, setArea] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [lastId, setLastId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const check = useQuickCheckResult<CheckRow>("hygiene_checks", COLUMNS, lastId);

  const run = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Add a photo of the shelf.");
      if (!storeId) throw new Error("Pick a store.");
      const { orgId, path } = await uploadQuickCheckPhoto(file, QUICK_CHECK_FOLDERS.hygiene);
      return runHygieneCheck({ data: { activeOrgId: orgId, storeId, storagePath: path, hint: area.trim() || null } });
    },
    onSuccess: (out) => {
      toast.success(`Hygiene ${HYGIENE_VERDICT_LABEL[out.result.verdict].toLowerCase()}.`);
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      setLastId(out.id);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "The hygiene check failed."),
  });

  return (
    <AppShell title="Hygiene check" description={DESCRIPTION}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <section aria-labelledby="new-check" className="h-fit rounded-2xl border border-[#D9E2E8] bg-white p-4 sm:p-5">
          <h2 id="new-check" className="text-base font-semibold text-[#04203F]">
            New hygiene check
          </h2>
          <p className="mt-1 text-sm text-[#667085]">Is this shelf clean, safe and tidy?</p>
          <div className="mt-4 space-y-3">
            <StorePicker value={storeId} onChange={setStoreId} />
            <Input
              value={area}
              maxLength={80}
              onChange={(e) => setArea(e.target.value)}
              placeholder="Area (optional), e.g. Dairy chiller"
              aria-label="Area"
            />
            <PhotoPicker file={file} onChange={setFile} inputRef={fileInput} placeholder="Take or choose a photo of the shelf" />
            <Button
              variant="brand"
              className="h-11 w-full rounded-xl"
              disabled={!file || !storeId || run.isPending}
              onClick={() => run.mutate()}
            >
              {run.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Checking hygiene…
                </>
              ) : (
                "Check hygiene"
              )}
            </Button>
            <p className="text-xs text-[#667085]">Include the shelf surfaces and the floor below in the photo.</p>
          </div>
        </section>

        <section aria-labelledby="check-result" className="min-w-0 space-y-4">
          <QuickCheckResultSlot
            id={lastId}
            query={check}
            running={run.isPending}
            emptyTitle="Your result will appear here"
            emptyBody="Pick a store, photograph a shelf and check whether hygiene is maintained."
          >
            {(row) => <HygieneResult row={row} />}
          </QuickCheckResultSlot>
        </section>
      </div>
    </AppShell>
  );
}

function HygieneResult({ row }: { row: CheckRow & { photoUrl: string | null } }) {
  const issues = Array.isArray(row.issues) ? row.issues : [];
  return (
    <div id="check-result" className="rounded-2xl border border-[#D9E2E8] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[#04203F]">{checkTitle(row)}</h2>
          <p className="mt-0.5 text-xs text-[#667085]">{formatCheckTime(row.created_at)}</p>
        </div>
        <VerdictPill label={`Hygiene ${HYGIENE_VERDICT_LABEL[row.verdict].toLowerCase()}`} tone={TONE[row.verdict]} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[200px_minmax(0,1fr)]">
        <CheckPhoto url={row.photoUrl} alt="Shelf photo" />
        <div className="min-w-0 space-y-3">
          {row.summary ? (
            <p className="flex gap-2 text-sm text-[#04203F]">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-[#9B86D9]" aria-hidden />
              <span>{row.summary}</span>
            </p>
          ) : null}
          {issues.length ? (
            <div>
              <h3 className="text-sm font-semibold text-[#04203F]">What to fix</h3>
              <ol className="mt-2 space-y-2">
                {issues.map((issue, i) => (
                  <li
                    key={i}
                    className={cn("rounded-xl border border-l-4 border-[#D9E2E8] bg-white px-3 py-2", SEVERITY_EDGE[issue.severity])}
                  >
                    <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium text-[#04203F]">
                      {hygieneTypeLabel(issue.type)}
                      <span className="text-xs font-normal text-[#667085]">
                        {SEVERITY_LABEL[issue.severity]}
                        {issue.where ? ` · ${issue.where}` : ""}
                      </span>
                    </p>
                    {issue.whatToDo ? <p className="mt-0.5 text-sm text-[#667085]">{issue.whatToDo}</p> : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : row.verdict === "passed" ? (
            <p className="rounded-xl border border-[#D9E2E8] px-3 py-2 text-sm text-[#04203F]">
              No hygiene issues found. Nothing to fix.
            </p>
          ) : null}
          {row.verdict === "check_manually" ? (
            <p className="rounded-xl bg-[#EEF1F4] px-3 py-2 text-sm text-[#667085]">
              The photo is too unclear for a verdict. Retake it in better light with the whole shelf in frame.
            </p>
          ) : null}
          <p className="text-xs text-[#667085]">AI detected · Read from image</p>
        </div>
      </div>
      <div className="mt-4">
        <QuickCheckDisclaimer />
      </div>
    </div>
  );
}
