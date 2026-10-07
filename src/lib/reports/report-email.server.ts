import type { ReportDocument } from "@/lib/reports/report-document";

export type ReportEmailOptions = {
  doc: ReportDocument;
  recipients: string[];
  senderName: string;
  message: string | null;
  reportUrl: string;
  scheduled: boolean;
  /** Unique per send attempt so a retry never emails the same person twice. */
  idempotencyPrefix: string;
};

export async function sendReportSummaryEmails(opts: ReportEmailOptions): Promise<{ sent: number; skipped: number }> {
  const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
  const { doc } = opts;
  let sent = 0;
  let skipped = 0;
  for (const email of opts.recipients) {
    const result = await sendTemplateEmail("report-summary", email, {
      idempotencyKey: `${opts.idempotencyPrefix}-${email}`,
      templateData: {
        senderName: opts.senderName,
        title: doc.title,
        subtitle: doc.subtitle,
        question: doc.question,
        headline: doc.empty ? doc.emptyMessage : doc.headline,
        kpis: doc.empty ? [] : doc.kpis.map((k) => ({ label: k.label, value: k.value, context: k.context })),
        labeledDemo: doc.labeledDemo,
        message: opts.message,
        reportUrl: opts.reportUrl,
        scheduled: opts.scheduled,
      },
    });
    if (result.sent) sent += 1;
    else skipped += 1;
  }
  return { sent, skipped };
}
