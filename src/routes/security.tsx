import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CloudCog,
  DatabaseZap,
  Fingerprint,
  HardDriveDownload,
  Lock,
  ScrollText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { MarketingPage } from "@/components/MarketingLayout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/security")({
  head: () => ({
    meta: [
      { property: "og:url", content: "https://aislix.com/security" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Security at Aislix — Encryption, access control & responsible AI" },
      {
        name: "description",
        content:
          "How Aislix protects shelf images and workspace data: TLS and AES-256 encryption, isolated storage, MFA access control, responsible AI practices and disaster recovery.",
      },
      { property: "og:title", content: "Security at Aislix" },
      {
        property: "og:description",
        content:
          "Encryption, secure storage, authentication, data privacy, responsible AI, cloud infrastructure and recovery.",
      },
      
      
    ],
    links: [{ rel: "canonical", href: "https://aislix.com/security" }],
  }),
  component: SecurityPage,
});

const pillars = [
  {
    icon: Lock,
    title: "Encryption",
    body: "All traffic is served over HTTPS with TLS 1.2+ and modern cipher suites. Shelf images, reports and database records are encrypted at rest with AES-256. Secrets and API keys are stored in a managed secret store, never in application code.",
  },
  {
    icon: DatabaseZap,
    title: "Secure storage",
    body: "Every image and scan record is scoped to a single workspace and protected by row-level security policies enforced in the database, so one customer can never read another customer's data. Object storage buckets are private with short-lived signed URLs for downloads.",
  },
  {
    icon: Fingerprint,
    title: "Authentication",
    body: "Email and password sign-in with hashed credentials, session revocation from your profile, and role-based access for Owner, Admin, Manager and Viewer. Two-factor authentication and SSO are on the roadmap for Enterprise workspaces.",
  },
  {
    icon: ShieldCheck,
    title: "Data privacy",
    body: "You own your shelf images and results. We never sell data, never share images between customers, and never use your images to train shared models. Deletion requests remove originals, annotations and reports from active storage immediately.",
  },
  {
    icon: Sparkles,
    title: "Responsible AI",
    body: "Detections are returned with confidence scores so low-certainty results are visible rather than hidden. Models are evaluated on shelf diversity across categories and lighting conditions, and outputs are positioned as decision support that a human can verify.",
  },
  {
    icon: CloudCog,
    title: "Cloud infrastructure",
    body: "Aislix runs on managed cloud infrastructure with isolated environments for development, preview and production. Deployments are automated and auditable, and production access requires multi-factor authentication and is logged.",
  },
  {
    icon: HardDriveDownload,
    title: "Disaster recovery",
    body: "Databases use point-in-time recovery with automated daily backups; object storage is replicated. Recovery procedures are documented with a target recovery point of 24 hours and a target recovery time of 4 hours.",
  },
  {
    icon: ScrollText,
    title: "Compliance",
    body: "We align our controls with recognised industry practice, support GDPR-ready data-processing terms, and issue GST-compliant invoices for Indian businesses. Formal certification work is in progress and we will publish the status here as it completes.",
  },
];

function SecurityPage() {
  return (
    <MarketingPage>
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16">
          <p className="text-xs font-medium uppercase tracking-widest text-brand">Security</p>
          <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Shelf data is commercial data. We treat it that way.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Aislix processes store photography, product distribution and share-of-shelf performance
            — information that reveals how a business trades. This page describes the controls that
            protect it and the practices behind our AI.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild variant="brand" className="rounded-xl">
              <Link to="/contact" search={{ subject: "Sales enquiry" }}>
                Request security documentation
              </Link>
            </Button>
            <Button asChild variant="subtle" className="rounded-xl">
              <Link to="/privacy">Read the Privacy Policy</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        <div className="grid gap-5 sm:grid-cols-2">
          {pillars.map((p) => (
            <div key={p.title} className="card-surface card-hover p-6">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
                <p.icon className="size-5" />
              </span>
              <h2 className="mt-4 text-base font-semibold tracking-tight">{p.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-8">
        <div className="card-surface flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              Found a vulnerability?
            </h2>
            <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
              Report it to hello@aislix.com with reproduction steps. We acknowledge reports within
              one business day, keep you updated, and will not pursue action against good-faith
              research.
            </p>
          </div>
          <Button asChild variant="subtle" className="rounded-xl">
            <a href="mailto:hello@aislix.com">Report an issue</a>
          </Button>
        </div>
      </section>
    </MarketingPage>
  );
}
