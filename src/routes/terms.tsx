import { createFileRoute } from "@tanstack/react-router";
import { LegalDoc } from "@/components/legal/LegalDoc";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Aislix" },
      {
        name: "description",
        content:
          "The agreement governing use of the Aislix AI shelf intelligence platform: account usage, acceptable use, AI limitations, subscription and payment terms.",
      },
      { property: "og:title", content: "Aislix Terms of Service" },
      {
        property: "og:description",
        content: "Account usage, subscription terms, payments, cancellation, IP and liability.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <LegalDoc
      title="Terms of Service"
      updated="1 August 2026"
      intro="These terms govern your access to the Aislix shelf intelligence platform. By creating a workspace or using any Aislix service you agree to them on behalf of yourself and the organisation you represent."
      sections={[
        {
          heading: "Account usage",
          body: [
            "You must provide accurate registration details and keep your credentials secure. You are responsible for all activity in your workspace, including actions taken by team members you invite.",
            "Seats are per named user. Sharing a single login across multiple people is not permitted.",
          ],
        },
        {
          heading: "Acceptable use",
          body: ["You agree not to use Aislix to:"],
          bullets: [
            "Upload images you do not have the right to capture or process.",
            "Upload content containing identifiable individuals as the subject of the scan, or any unlawful material.",
            "Reverse engineer, resell or白 relabel the platform without a written agreement.",
            "Circumvent scan limits, rate limits or the fair usage policy through automation.",
            "Probe, scan or disrupt platform security or another customer's workspace.",
          ],
        },
        {
          heading: "AI limitations",
          body: [
            "Aislix outputs are statistical predictions. Detection accuracy depends on image quality, lighting, occlusion and packaging similarity, and results may contain errors.",
            "Outputs are decision support, not a guaranteed inventory record. You remain responsible for verifying critical actions such as replenishment orders, audits, contractual compliance claims and financial decisions.",
          ],
        },
        {
          heading: "Subscription terms",
          body: [
            "Plans are Free, Starter, Professional and Enterprise. Paid plans renew automatically each billing period until cancelled.",
            "Free and Starter include the scan volumes listed on the pricing page. Professional includes unlimited scans under a fair usage policy: sustained volumes far beyond typical retail workloads may be rate limited after we contact you.",
            "Upgrades take effect immediately with a prorated charge. Downgrades take effect at the end of the current billing period.",
          ],
        },
        {
          heading: "Payment terms",
          body: [
            "Prices are in Indian Rupees and exclusive of 18% GST unless stated otherwise. Annual plans are billed for ten months, giving two months free.",
            "Payments are collected through our payment partner. Failed payments are retried; if payment remains outstanding, scanning may be paused until the balance is cleared. GST tax invoices are issued for every payment when a valid GSTIN is on file.",
          ],
        },
        {
          heading: "Cancellation policy",
          body: [
            "You can cancel at any time from the billing page. Cancellation stops future renewals and your plan continues until the end of the paid period, after which the workspace moves to the Free plan.",
            "You can resume a cancelled subscription before the period ends without losing data.",
          ],
        },
        {
          heading: "Intellectual property",
          body: [
            "Aislix retains all rights in the platform, models, software and documentation. You retain all rights in your shelf images, workspace data and reports.",
            "You grant Aislix a limited licence to process your images solely to deliver the service to you.",
          ],
        },
        {
          heading: "Liability",
          body: [
            "The service is provided without warranties beyond those required by law. To the maximum extent permitted, Aislix is not liable for indirect, incidental or consequential losses, lost profits or lost data.",
            "Our aggregate liability is limited to the fees you paid in the twelve months preceding the claim.",
          ],
        },
        {
          heading: "Governing law",
          body: [
            "These terms are governed by the laws of India. Courts at Bengaluru, Karnataka have exclusive jurisdiction, without prejudice to mandatory consumer protections in your jurisdiction.",
          ],
        },
        {
          heading: "Contact details",
          body: [
            "Questions about these terms: hello@aislix.com. Enterprise agreements, DPAs and SLAs are available through the same address.",
          ],
        },
      ]}
    />
  ),
});
