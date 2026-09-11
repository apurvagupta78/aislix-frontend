/**
 * Compact download + share actions — same footer for demo and dashboard results.
 * Replaces in-scroll Downloads / Share sections for parity layout.
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Download, Loader2, Mail, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  EmailShareDialog,
  TeamShareDialog,
} from "@/components/scan-results/ShareDialogs";
import { createScanShareLink } from "@/lib/scan-share.functions";
import {
  buildFullScanReportExcel,
  downloadBlobBytes,
  downloadDemoFullReportExcel,
  type ScanResult,
} from "@/lib/scan-results";

type ScanResultsActionsFooterProps = {
  data: ScanResult;
  loading?: boolean;
};

export function ScanResultsActionsFooter({ data, loading = false }: ScanResultsActionsFooterProps) {
  const [copied, setCopied] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const scanId = data.scan_id;
  const createLink = useServerFn(createScanShareLink);
  const ready = Boolean(scanId) && !loading;

  const linkMutation = useMutation({
    mutationFn: async () => {
      if (!scanId) throw new Error("Scan is still loading.");
      if (linkUrl) return { url: linkUrl };
      return createLink({ data: { scanId } });
    },
    onSuccess: async (result) => {
      setLinkUrl(result.url);
      try {
        await navigator.clipboard.writeText(result.url);
        setCopied(true);
        toast.success("Share link copied — valid for 7 days");
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.info(result.url, { description: "Copy this link manually" });
      }
    },
    onError: (error: Error) => toast.error(error.message || "Could not create a share link."),
  });

  const downloadExcel = () => {
    if (data.scan_id && !data.scan_id.startsWith("demo")) {
      downloadBlobBytes(
        buildFullScanReportExcel(data),
        `aislix-${data.scan_id}-full-report.xlsx`,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
    } else {
      downloadDemoFullReportExcel(data);
    }
    toast.success("Excel report downloaded");
  };

  return (
    <>
      <div className="mt-4 flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          disabled={!ready || linkMutation.isPending}
          onClick={() => linkMutation.mutate()}
        >
          {linkMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Copy className="size-4" />
          )}
          {copied ? "Link copied" : "Copy share link"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          disabled={!ready}
          onClick={() => setEmailOpen(true)}
        >
          <Mail className="size-4" /> Email report
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          disabled={!ready}
          onClick={() => setTeamOpen(true)}
        >
          <Users className="size-4" /> Share with team
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          disabled={!ready}
          onClick={downloadExcel}
        >
          <Download className="size-4" /> Download full report (Excel)
        </Button>
      </div>
      {scanId ? (
        <>
          <EmailShareDialog scanId={scanId} open={emailOpen} onOpenChange={setEmailOpen} />
          <TeamShareDialog scanId={scanId} open={teamOpen} onOpenChange={setTeamOpen} />
        </>
      ) : null}
    </>
  );
}
