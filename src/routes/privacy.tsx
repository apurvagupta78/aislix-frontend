import { createFileRoute } from "@tanstack/react-router";
import { LegalDoc } from "@/components/legal/LegalDoc";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Aislix" },
      {
        name: "description",
        content:
          "How Aislix collects, processes and protects shelf images, account data and analytics, including retention, GDPR readiness and your data rights.",
      },
      { property: "og:title", content: "Aislix Privacy Policy" },
      {
        property: "og:description",
        content: "Data collection, image storage, AI processing, cookies, security and user rights.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <LegalDoc
      title="Privacy Policy"
      updated="1 August 2026"
      intro="This policy explains what Aislix Technologies collects when you use the Aislix shelf intelligence platform, how shelf images are processed by our AI models, how long we keep data, and the rights you can exercise at any time."
      sections={[
        {
          heading: "Data collection",
          body: [
            "We collect only the data required to operate shelf audits, bill your subscription and support your team.",
          ],
          bullets: [
            "Account data: name, work email, phone number, company, role and password hash.",
            "Workspace data: store names, locations, team members and their access roles.",
            "Scan data: shelf images you upload, detection results, annotations and generated reports.",
            "Billing data: plan, billing cycle, GSTIN, billing address and invoice records.",
            "Technical data: device, browser, IP address, timestamps and error diagnostics.",
          ],
        },
        {
          heading: "User data",
          body: [
            "Your workspace data belongs to you. We act as a processor for the shelf images and scan results you submit, and as a controller for account and billing records we must keep for legal and tax purposes.",
            "We never sell personal data and we never share your shelf images with other customers.",
          ],
        },
        {
          heading: "Image storage",
          body: [
            "Shelf images and annotated outputs are stored in encrypted object storage, scoped to your workspace. Access requires an authenticated session belonging to your workspace, enforced by row-level security policies.",
            "You can delete an individual scan at any time. Deletion removes the original image, annotated image and derived report from active storage, and from backups within 30 days.",
          ],
        },
        {
          heading: "AI processing",
          body: [
            "Uploaded images are analysed by computer-vision models to detect products, brands, facings, empty space and planogram deviations. Processing is automated; no human reviews your images unless you explicitly ask our support team to investigate a specific scan.",
            "We do not use your images to train shared or third-party foundation models. Custom models are trained only on the data of the customer that requested them, under a separate agreement.",
          ],
        },
        {
          heading: "Cookies",
          body: [
            "We use strictly necessary cookies for authentication and security, plus optional analytics and functional cookies. See the Cookie Policy for the full list and how to change your preferences.",
          ],
        },
        {
          heading: "Security",
          body: [
            "Data is encrypted in transit with TLS 1.2+ and at rest with AES-256. Access to production systems is limited to authorised engineers using multi-factor authentication and is logged.",
            "Details of our controls are described on the Security page.",
          ],
        },
        {
          heading: "GDPR readiness",
          body: [
            "For customers in the EEA and UK we support data-processing terms, documented sub-processors, records of processing activity and standard contractual clauses for international transfers.",
          ],
          bullets: [
            "Lawful bases: contract performance, legitimate interests and consent for optional cookies.",
            "Data-processing agreement available on request for all paid plans.",
            "Breach notification to affected customers without undue delay.",
          ],
        },
        {
          heading: "Data retention",
          body: [
            "Retention follows your plan and legal obligations.",
          ],
          bullets: [
            "Free plan: scan history retained for 7 days.",
            "Paid plans: scan history retained for the life of the workspace, or until you delete it.",
            "Account records: kept while your workspace is active, then deleted within 90 days of closure.",
            "Invoices and tax records: retained as required by applicable Indian tax law.",
          ],
        },
        {
          heading: "User rights",
          body: [
            "You can access, correct, export or delete your data from your profile and settings, or by contacting us.",
          ],
          bullets: [
            "Export a machine-readable copy of your workspace data.",
            "Request correction of inaccurate account information.",
            "Request deletion of your account and associated scans.",
            "Object to or restrict specific processing activities.",
            "Withdraw cookie consent at any time.",
          ],
        },
        {
          heading: "Contact information",
          body: [
            "Privacy questions and data-rights requests: hello@aislix.com. We acknowledge every request within one business day and respond substantively within 30 days.",
          ],
        },
      ]}
    />
  ),
});
