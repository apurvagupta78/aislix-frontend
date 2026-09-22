/**
 * End-of-report share & download actions — shown at the bottom of every
 * completed /results report (AI with/without planogram and digital audits).
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmailShareDialog, TeamShareDialog } from "@/components/scan-results/ShareDialogs";
import { ResultSection } from "@/components/scan-results/ResultParts";
import {
  CopyBrandIcon,
  EmailBrandIcon,
  PdfBrandIcon,
  SlackBrandIcon,
  TeamBrandIcon,
  WhatsAppBrandIcon,
} from "@/components/scan-results/BrandShareIcons";
import { createScanShareLink } from "@/lib/scan-share.functions";
import { downloadScanCsv, downloadScanPdf, type ScanResult } from "@/lib/scan-results";
import { GENERIC_EXPORT, networkErrorMessage } from "@/lib/api-errors";

function shareTextFromResult(result: { url: string; share_text?: string }) {
  return result.share_text?.trim() || result.url;
}

export function ReportActionsFooter({
  data,
  loading = false,
}: {
  data?: ScanResult | undefined;
  loading?: boolean | undefined;
}) {
  const [teamOpen, setTeamOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [shareText, setShareText] = useState<string | null>(null);
  const createLink = useServerFn(createScanShareLink);
  const scanId = data?.scan_id;
  const ready = Boolean(scanId) && !loading;

  const pdfMutation = useMutation({
    mutationFn: async () => {
      if (!scanId) throw new Error("Audit is still loading.");
      await downloadScanPdf(scanId, data?.downloads?.pdf_url);
    },
    onSuccess: () => toast.success("PDF report downloaded"),
    onError: (error: Error) => toast.error(networkErrorMessage(error, GENERIC_EXPORT)),
  });

  const csvMutation = useMutation({
    mutationFn: async () => {
      if (!scanId) throw new Error("Audit is still loading.");
      await downloadScanCsv(scanId, data?.downloads?.csv_url);
    },
    onSuccess: () => toast.success("CSV downloaded"),
    onError: (error: Error) => toast.error(networkErrorMessage(error, GENERIC_EXPORT)),
  });

  const linkMutation = useMutation({
    mutationFn: async () => {
      if (!scanId) throw new Error("Audit is still loading.");
      if (linkUrl && shareText) return { url: linkUrl, share_text: shareText };
      return createLink({ data: { scanId } });
    },
    onError: (error: Error) => toast.error(error.message || "Could not create a share link."),
  });

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  };

  const rememberLink = (result: { url: string; share_text?: string }) => {
    setLinkUrl(result.url);
    setShareText(shareTextFromResult(result));
  };

  const handleCopyLink = () => {
    linkMutation.mutate(undefined, {
      onSuccess: async (result) => {
        rememberLink(result);
        const text = shareTextFromResult(result);
        if (await copyText(text)) toast.success("Share message copied ✓");
        else toast.info(text, { description: "Copy this message manually" });
      },
    });
  };

  const handleWhatsApp = () => {
    linkMutation.mutate(undefined, {
      onSuccess: (result) => {
        rememberLink(result);
        const text = encodeURIComponent(shareTextFromResult(result));
        window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
      },
    });
  };

  const handleSlack = () => {
    linkMutation.mutate(undefined, {
      onSuccess: async (result) => {
        rememberLink(result);
        const text = shareTextFromResult(result);
        if (await copyText(text)) toast.success("Share message copied — paste it in Slack");
        else toast.info(text, { description: "Copy this message and paste it in Slack" });
        window.open("https://app.slack.com/", "_blank", "noopener,noreferrer");
      },
    });
  };

  return (
    <ResultSection
      title="Share & download"
      description="Export this report or share it with your team."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Button
          variant="brand"
          size="lg"
          className="w-full rounded-xl"
          disabled={!ready || pdfMutation.isPending}
          onClick={() => pdfMutation.mutate()}
        >
          {pdfMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <PdfBrandIcon className="size-5 shrink-0" />
          )}
          Download PDF
        </Button>

        <Button
          variant="subtle"
          size="lg"
          className="w-full rounded-xl"
          disabled={!ready || csvMutation.isPending}
          onClick={() => csvMutation.mutate()}
        >
          {csvMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="size-5 shrink-0" />
          )}
          Download CSV
        </Button>

        <Button
          variant="subtle"
          size="lg"
          className="w-full rounded-xl"
          disabled={!ready}
          onClick={() => setTeamOpen(true)}
        >
          <TeamBrandIcon className="size-5 shrink-0" /> Share with team
        </Button>

        <Button
          variant="subtle"
          size="lg"
          className="w-full rounded-xl"
          disabled={!ready}
          onClick={() => setEmailOpen(true)}
        >
          <EmailBrandIcon className="size-5 shrink-0" /> Email report
        </Button>

        <Button
          variant="subtle"
          size="lg"
          className="w-full rounded-xl"
          disabled={!ready || linkMutation.isPending}
          onClick={handleCopyLink}
        >
          {linkMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CopyBrandIcon className="size-5 shrink-0" />
          )}
          Copy share message
        </Button>

        <Button
          variant="subtle"
          size="lg"
          className="w-full rounded-xl"
          disabled={!ready || linkMutation.isPending}
          onClick={handleWhatsApp}
        >
          <WhatsAppBrandIcon className="size-5 shrink-0" /> Share on WhatsApp
        </Button>

        <Button
          variant="subtle"
          size="lg"
          className="w-full rounded-xl"
          disabled={!ready || linkMutation.isPending}
          onClick={handleSlack}
        >
          <SlackBrandIcon className="size-5 shrink-0" /> Share on Slack
        </Button>
      </div>

      {linkUrl ? (
        <div className="mt-4 space-y-2">
          {shareText ? (
            <textarea
              readOnly
              value={shareText}
              rows={6}
              className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs leading-relaxed text-foreground"
            />
          ) : (
            <p className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {linkUrl}
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() =>
              void copyText(shareText || linkUrl).then(
                (ok) => ok && toast.success("Share message copied ✓"),
              )
            }
          >
            <CopyBrandIcon className="size-4 shrink-0" /> Copy message
          </Button>
        </div>
      ) : null}

      {scanId ? (
        <>
          <TeamShareDialog scanId={scanId} open={teamOpen} onOpenChange={setTeamOpen} />
          <EmailShareDialog scanId={scanId} open={emailOpen} onOpenChange={setEmailOpen} />
        </>
      ) : null}
    </ResultSection>
  );
}
