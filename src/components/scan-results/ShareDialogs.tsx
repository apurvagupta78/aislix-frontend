/**
 * Share dialogs for a scan report: email recipients and in-app team sharing.
 * Both mint (or reuse) the scan's 7-day share link on the server.
 */

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  EmailBrandIcon,
  TeamBrandIcon,
} from "@/components/scan-results/BrandShareIcons";
import { Skeleton } from "@/components/States";
import { parseRecipients } from "@/lib/scan-share";
import {
  emailScanReport,
  listShareTargets,
  shareScanWithTeam,
} from "@/lib/scan-share.functions";

/* ------------------------------ email dialog ------------------------------ */

const API = (
  import.meta.env.VITE_AISLIX_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "https://aislix-backend-production.up.railway.app"
).replace(/\/$/, "");

export function EmailAuditDialog({
  scanId,
  open,
  onOpenChange,
  demoMode = false,
  landingSessionId,
  storeName,
  auditDate,
}: {
  scanId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  demoMode?: boolean;
  landingSessionId?: string;
  storeName?: string;
  auditDate?: string;
}) {
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const send = useServerFn(emailScanReport);

  const mutation = useMutation({
    mutationFn: async () => {
      const email = recipient.trim().toLowerCase();
      if (!email || !email.includes("@")) throw new Error("Enter a valid recipient email.");
      if (demoMode) {
        const sessionId = landingSessionId;
        if (!sessionId) throw new Error("Demo session not found.");
        const res = await fetch(`${API}/landing/email-report`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            landing_session_id: sessionId,
            recipient: email,
            message: message || undefined,
          }),
        });
        if (!res.ok) {
          const detail = await res.json().catch(() => ({}));
          throw new Error((detail as { detail?: string }).detail || "Could not send the report.");
        }
        return { sent: 1, skipped: 0 };
      }
      return send({
        data: {
          scanId,
          recipients: [email],
          message,
          includePdf: true,
          includeAnnotated: true,
          includeCsv: true,
        },
      });
    },
    onSuccess: (result) => {
      if (result.sent > 0) {
        setSent(true);
        toast.success("Report sent ✓");
        setTimeout(() => {
          setRecipient("");
          setMessage("");
          setSent(false);
          onOpenChange(false);
        }, 1200);
      } else {
        toast.info("No emails were delivered.");
      }
    },
    onError: (error: Error) => toast.error(error.message || "Could not send the report."),
  });

  const store = storeName ?? "Store";
  const dateLabel = auditDate
    ? new Date(auditDate).toLocaleDateString(undefined, { dateStyle: "medium" })
    : new Date().toLocaleDateString(undefined, { dateStyle: "medium" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Email this audit</DialogTitle>
          <DialogDescription>
            Subject: Aislix Shelf Audit Report — {store} — {dateLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="audit-email-recipient">Recipient email *</Label>
            <Input
              id="audit-email-recipient"
              type="email"
              placeholder="name@company.com"
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="audit-email-message">Optional message</Label>
            <Textarea
              id="audit-email-message"
              rows={3}
              placeholder="Add a note for the recipient…"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Recipients get an email with the store, audit name, description, category,
            subcategory, location, and a link to the full public report.
          </p>
        </div>

        <DialogFooter>
          <Button variant="subtle" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="brand"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || sent}
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : sent ? (
              "Report sent ✓"
            ) : (
              <>Send Report →</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** @deprecated Use EmailAuditDialog */
export function EmailShareDialog({
  scanId,
  open,
  onOpenChange,
}: {
  scanId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [recipients, setRecipients] = useState("");
  const [message, setMessage] = useState("");
  const [includePdf, setIncludePdf] = useState(true);
  const [includeAnnotated, setIncludeAnnotated] = useState(true);
  const [includeCsv, setIncludeCsv] = useState(true);
  const send = useServerFn(emailScanReport);

  const mutation = useMutation({
    mutationFn: async () => {
      const { emails, invalid } = parseRecipients(recipients);
      if (invalid.length) throw new Error(`Not a valid email: ${invalid.join(", ")}`);
      if (!emails.length) throw new Error("Add at least one recipient email.");
      if (emails.length > 5) throw new Error("You can email up to 5 recipients at a time.");
      return send({
        data: { scanId, recipients: emails, message, includePdf, includeAnnotated, includeCsv },
      });
    },
    onSuccess: (result) => {
      if (result.sent > 0) {
        toast.success(
          `Report sent to ${result.sent} recipient${result.sent === 1 ? "" : "s"}${
            result.skipped ? ` · ${result.skipped} skipped` : ""
          }`,
        );
      } else {
        toast.info("No emails were delivered — those addresses are not accepting mail.");
      }
      setRecipients("");
      setMessage("");
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message || "Could not send the report."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Email this report</DialogTitle>
          <DialogDescription>
            Recipients get store, audit name, description, category, subcategory, location, a
            secure report link (expires in 7 days), and optional PDF / annotated image / CSV
            downloads.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="share-emails">Recipients</Label>
            <Input
              id="share-emails"
              placeholder="name@company.com, ops@company.com"
              value={recipients}
              onChange={(event) => setRecipients(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">Up to 5 addresses, comma separated.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="share-message">Message (optional)</Label>
            <Textarea
              id="share-message"
              rows={3}
              placeholder="Add context for the store team…"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </div>

          <div className="space-y-2 rounded-xl border border-border p-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={includePdf}
                onCheckedChange={(value) => setIncludePdf(value === true)}
              />
              Include PDF report link
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={includeAnnotated}
                onCheckedChange={(value) => setIncludeAnnotated(value === true)}
              />
              Include annotated shelf image link
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={includeCsv}
                onCheckedChange={(value) => setIncludeCsv(value === true)}
              />
              Include CSV download link
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="subtle" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="brand"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <EmailBrandIcon className="size-4 shrink-0" />
            )}
            Send report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------- team dialog ------------------------------ */

export function TeamShareDialog({
  scanId,
  open,
  onOpenChange,
}: {
  scanId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [alsoEmail, setAlsoEmail] = useState(false);
  const loadTargets = useServerFn(listShareTargets);
  const share = useServerFn(shareScanWithTeam);

  const targetsQuery = useQuery({
    queryKey: ["scan-share-targets", scanId],
    queryFn: () => loadTargets({ data: { scanId } }),
    enabled: open,
    retry: false,
  });

  const toggle = (userId: string) =>
    setSelected((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    );

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selected.length) throw new Error("Select at least one team member.");
      return share({ data: { scanId, userIds: selected, note, sendEmail: alsoEmail } });
    },
    onSuccess: (result) => {
      toast.success(
        `Shared with ${result.shared} teammate${result.shared === 1 ? "" : "s"}${
          result.emailed ? ` · ${result.emailed} emailed` : ""
        }`,
      );
      setSelected([]);
      setNote("");
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message || "Could not share this report."),
  });

  const targets = targetsQuery.data?.targets ?? [];
  const assigneeId = targetsQuery.data?.assignee_id ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share with your team</DialogTitle>
          <DialogDescription>
            Teammates get an in-app notification linking straight to this audit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-xl border border-border p-2">
            {targetsQuery.isLoading ? (
              <div className="space-y-2 p-1">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : targetsQuery.isError ? (
              <p className="p-3 text-sm text-destructive">Could not load your team.</p>
            ) : targets.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">
                No other active members in this workspace yet.
              </p>
            ) : (
              targets.map((target) => (
                <label
                  key={target.user_id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted"
                >
                  <Checkbox
                    checked={selected.includes(target.user_id)}
                    onCheckedChange={() => toggle(target.user_id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{target.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {target.email}
                    </span>
                  </span>
                  {target.user_id === assigneeId ? (
                    <Badge variant="outline" className="rounded-full">
                      Audited this
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="rounded-full capitalize">
                      {target.role.replace("_", " ")}
                    </Badge>
                  )}
                </label>
              ))
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="team-note">Note (optional)</Label>
            <Textarea
              id="team-note"
              rows={3}
              placeholder="What should they look at?"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={alsoEmail}
              onCheckedChange={(value) => setAlsoEmail(value === true)}
            />
            Also email them the report
          </label>
        </div>

        <DialogFooter>
          <Button variant="subtle" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="brand"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !selected.length}
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <TeamBrandIcon className="size-4 shrink-0" />
            )}
            Share
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
