import { createFileRoute } from "@tanstack/react-router";
import { LegalDoc } from "@/components/legal/LegalDoc";

export const Route = createFileRoute("/refunds")({
  head: () => ({
    meta: [
      { property: "og:url", content: "https://aislix.com/refunds" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Refund Policy — Aislix" },
      {
        name: "description",
        content:
          "Aislix refund policy for subscriptions: refund eligibility, trial terms, cancellations, billing errors and how to raise a refund request.",
      },
      { property: "og:title", content: "Aislix Refund Policy" },
      {
        property: "og:description",
        content: "Subscription refunds, trial policy, cancellation, billing errors and contact process.",
      },
      
      
    ],
    links: [{ rel: "canonical", href: "https://aislix.com/refunds" }],
  }),
  component: () => (
    <LegalDoc
      title="Refund Policy"
      updated="1 August 2026"
      intro="We want you to pay only for shelf audits that deliver value. This policy explains when a subscription payment can be refunded, how trials and cancellations work, and how billing errors are corrected."
      sections={[
        {
          heading: "Subscription refunds",
          body: [
            "Monthly plans are refundable in full within 7 days of the first payment on a new workspace if fewer than 25 scans have been processed.",
            "Annual plans are refundable in full within 14 days of purchase. After that window we refund the unused whole months on a prorated basis if you cancel mid-term for a documented service issue.",
            "Add-on scan packs and AI credits are refundable only while unused.",
          ],
        },
        {
          heading: "Trial policy",
          body: [
            "The Free plan is a permanent trial: three scans per day with no card required, so you can validate detection quality on your own shelves before paying.",
            "Time-limited trials of paid features, when offered, convert to a paid subscription only after you explicitly confirm. If a trial converts without your confirmation, we refund it in full.",
          ],
        },
        {
          heading: "Cancellation",
          body: [
            "Cancelling stops future renewals immediately and your plan stays active until the end of the paid period. We do not charge a cancellation fee.",
            "Cancellation alone does not trigger a refund of the current period unless it falls inside the refund windows above.",
          ],
        },
        {
          heading: "Billing errors",
          body: [
            "Duplicate charges, incorrect plan amounts, incorrect GST treatment or charges after a confirmed cancellation are refunded in full once verified.",
            "Report a suspected billing error within 60 days of the invoice date. Approved refunds are returned to the original payment method, typically within 5–7 business days depending on your bank.",
          ],
        },
        {
          heading: "Contact process",
          body: [
            "Email hello@aislix.com with your workspace name, invoice number and the reason for the request. We acknowledge within one business day and confirm the outcome within 5 business days.",
            "If a request falls outside this policy we will explain why and, where possible, offer scan credits instead.",
          ],
        },
      ]}
    />
  ),
});
