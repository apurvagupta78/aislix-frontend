/**
 * Conversion-focused action bar — share, email, workspace, export.
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, Download, Loader2, Mail, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmailAuditDialog } from "@/components/scan-results/ShareDialogs";
import { WorkspaceShareDialog } from "@/components/scan/WorkspaceShareDialog";
import { DemoAllowanceIndicator } from "@/components/scan/DemoAllowanceIndicator";
import { createScanShareLink } from "@/lib/scan-share.functions";
import { downloadRoleAuditExcel } from "@/lib/audit-excel-export";
import type { DemoAllowance } from "@/lib/demo-allowance";
import { demoAuditShareUrl } from "@/lib/demo-share";
import { signupUrl } from "@/lib/landing-scan-api";
import type { AuditRoleTab } from "@/lib/role-audit-ui";
import {
  downloadDemoFullReportExcel,
  type ScanResult,
} from "@/lib/scan-results";
import { cn } from "@/lib/utils";

export type ScanResultsActionsFooterProps = {
  data: ScanResult;
  loading?: boolean;
  demoMode?: boolean;
  activeRole?: AuditRoleTab;
  landingSessionId?: string;
  demoAllowance?: DemoAllowance | null;
  hasWorkspace?: boolean;
  signupHref?: string;
};

export function ScanResultsActionsFooter({
  data,
  loading = false,
  demoMode = false,
  activeRole = "supermarket",
  landingSessionId,
  demoAllowance,
  hasWorkspace = false,
  signupHref,
}: ScanResultsActionsFooterProps) {
  const [copied, setCopied] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const scanId = data.scan_id;
  const createLink = useServerFn(createScanShareLink);
  const ready = Boolean(scanId) && !loading;
  const workspaceHref = signupHref ?? signupUrl();

  const linkMutation = useMutation({
    mutationFn: async () => {
      if (demoMode) {
        const url = demoAuditShareUrl(landingSessionId);
        if (!url) throw new Error("Demo session not found — refresh and try again.");
        return { url };
      }
      if (!scanId) throw new Error("Audit is still loading.");
      if (linkUrl) return { url: linkUrl };
      return createLink({ data: { scanId } });
    },
    onSuccess: async (result) => {
      setLinkUrl(result.url);
      try {
        await navigator.clipboard.writeText(result.url);
        setCopied(true);
        toast.success("Link copied ✓");
        setTimeout(() => setCopied(false), 2500);
      } catch {
        toast.info(result.url, { description: "Copy this link manually" });
      }
    },
    onError: (error: Error) => toast.error(error.message || "Could not create a share link."),
  });

  const downloadExcel = () => {
    if (demoMode || !scanId || scanId.startsWith("demo")) {
      if (activeRole) {
        downloadRoleAuditExcel(data, activeRole);
      } else {
        downloadDemoFullReportExcel(data);
      }
    } else if (activeRole) {
      downloadRoleAuditExcel(data, activeRole);
    } else {
      downloadDemoFullReportExcel(data);
    }
    toast.success("Excel report downloaded");
  };

  const showWorkspaceCta = demoMode || !hasWorkspace;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="mt-5 shrink-0 rounded-xl border border-border/70 bg-muted/25 p-4 sm:p-5">
        <div
          className={cn(
            "flex flex-col gap-2",
            "sm:flex-row sm:flex-wrap sm:items-center",
          )}
        >
          {showWorkspaceCta ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="brand"
                  size="sm"
                  className="order-1 w-full sm:order-none sm:w-auto"
                  onClick={() => setWorkspaceOpen(true)}
                >
                  <Users className="size-4" />
                  Create Free Workspace to Share
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                Save audits, share reports with your team and keep your shelf history in one place.
              </TooltipContent>
            </Tooltip>
          ) : null}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="order-2 w-full sm:order-none sm:w-auto"
                disabled={!ready || linkMutation.isPending}
                onClick={() => linkMutation.mutate()}
              >
                {linkMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowUpRight className="size-4" />
                )}
                {copied ? "Link copied ✓" : "Share Audit ↗"}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              Create a public link anyone can use to view this audit.
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="order-3 w-full sm:order-none sm:w-auto"
                disabled={!ready}
                onClick={() => setEmailOpen(true)}
              >
                <Mail className="size-4" /> Email Audit Report
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              Send the complete audit report by email.
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="order-4 w-full sm:order-none sm:w-auto"
                disabled={!ready}
                onClick={downloadExcel}
              >
                <Download className="size-4" /> Download Excel Report ↓
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              Download all audit data and KPI details in Excel.
            </TooltipContent>
          </Tooltip>
        </div>

        {demoAllowance ? (
          <DemoAllowanceIndicator allowance={demoAllowance} className="mt-4" />
        ) : null}

        {scanId || demoMode ? (
          <EmailAuditDialog
            scanId={scanId ?? "demo"}
            open={emailOpen}
            onOpenChange={setEmailOpen}
            demoMode={demoMode}
            landingSessionId={landingSessionId}
            storeName={data.store}
            auditDate={data.created_at}
          />
        ) : null}

        <WorkspaceShareDialog
          open={workspaceOpen}
          onOpenChange={setWorkspaceOpen}
          signupHref={workspaceHref}
        />
      </div>
    </TooltipProvider>
  );
}
