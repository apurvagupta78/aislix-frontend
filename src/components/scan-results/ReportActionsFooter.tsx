/**
 * End-of-report share & download actions — shown at the bottom of every
 * completed /results report (AI with/without planogram and digital audits).
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Copy,
  FileText,
  Link2,
  Loader2,
  Mail,
  MessageCircle,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmailShareDialog, TeamShareDialog } from "@/components/scan-results/ShareDialogs";
import { ResultSection } from "@/components/scan-results/ResultParts";
import { createScanShareLink } from "@/lib/scan-share.functions";
import { downloadScanPdf, type ScanResult } from "@/lib/scan-results";
import { GENERIC_EXPORT, networkErrorMessage } from "@/lib/api-errors";

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

  const linkMutation = useMutation({
    mutationFn: async () => {
      if (!scanId) throw new Error("Audit is still loading.");
      if (linkUrl) return { url: linkUrl };
      return createLink({ data: { scanId } });
    },
    onError: (error: Error) => toast.error(error.message || "Could not create a share link."),
  });

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleCopyLink = () => {
    linkMutation.mutate(undefined, {
      onSuccess: async (result) => {
        setLinkUrl(result.url);
        if (await copyLink(result.url)) toast.success("Link copied ✓");
        else toast.info(result.url, { description: "Copy this link manually" });
      },
    });
  };

  const handleWhatsApp = () => {
    linkMutation.mutate(undefined, {
      onSuccess: (result) => {
        setLinkUrl(result.url);
        const text = encodeURIComponent(`Aislix shelf audit report: ${result.url}`);
        window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
      },
    });
  };

  const handleSlack = () => {
    linkMutation.mutate(undefined, {
      onSuccess: async (result) => {
        setLinkUrl(result.url);
        if (await copyLink(result.url)) toast.success("Link copied — paste it in Slack");
        else toast.info(result.url, { description: "Copy this link and paste it in Slack" });
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
            <FileText className="size-4" />
          )}
          Download PDF
        </Button>

        <Button
          variant="subtle"
          size="lg"
          className="w-full rounded-xl"
          disabled={!ready}
          onClick={() => setTeamOpen(true)}
        >
          <Users className="size-4" /> Share with team
        </Button>

        <Button
          variant="subtle"
          size="lg"
          className="w-full rounded-xl"
          disabled={!ready}
          onClick={() => setEmailOpen(true)}
        >
          <Mail className="size-4" /> Email report
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
            <Copy className="size-4" />
          )}
          Copy public link
        </Button>

        <Button
          variant="subtle"
          size="lg"
          className="w-full rounded-xl"
          disabled={!ready || linkMutation.isPending}
          onClick={handleWhatsApp}
        >
          <MessageCircle className="size-4" /> Share on WhatsApp
        </Button>

        <Button
          variant="subtle"
          size="lg"
          className="w-full rounded-xl"
          disabled={!ready || linkMutation.isPending}
          onClick={handleSlack}
        >
          <Link2 className="size-4" /> Share on Slack
        </Button>
      </div>

      {linkUrl ? (
        <div className="mt-4 flex items-center gap-2">
          <Input readOnly value={linkUrl} className="rounded-xl text-xs" />
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 rounded-xl"
            onClick={() => void copyLink(linkUrl).then((ok) => ok && toast.success("Link copied ✓"))}
          >
            <Copy className="size-4" /> Copy
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
