import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Linkedin, Youtube } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ENQUIRY_INBOX } from "@/lib/contact";

const itemClass =
  "text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25 rounded-sm";

function ColumnTitle({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  );
}

function Soon({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground/70">
      {label}
      <span className="rounded-full bg-brand-soft px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-brand">
        Soon
      </span>
    </span>
  );
}

/** Global Aislix footer — single source of truth for every page. */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/80 bg-surface">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.35fr_repeat(4,minmax(0,1fr))] lg:gap-10">
          <div className="sm:col-span-2 lg:col-span-1">
            <Logo />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              AI-powered retail shelf intelligence for supermarkets, dark stores, FMCG brands,
              distributors and local stores. Turn shelf photos into actionable insights and track
              improvement over time.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <a
                href="https://www.linkedin.com/company/aislix/"
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Aislix on LinkedIn"
                className="grid size-9 place-items-center rounded-xl border border-border/80 bg-card text-muted-foreground transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25"
              >
                <Linkedin className="size-4" />
              </a>
              <a
                href="https://x.com/aislix_ai"
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Aislix on X"
                className="grid size-9 place-items-center rounded-xl border border-border/80 bg-card text-sm font-semibold text-muted-foreground transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25"
              >
                X
              </a>
              <a
                href="https://www.youtube.com/@AislixAI"
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Aislix on YouTube"
                className="grid size-9 place-items-center rounded-xl border border-border/80 bg-card text-muted-foreground transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25"
              >
                <Youtube className="size-4" />
              </a>
            </div>
          </div>

          <div className="space-y-2.5">
            <ColumnTitle>Product</ColumnTitle>
            <ul className="space-y-2">
              <li>
                <Link to="/platform" className={itemClass}>
                  Platform
                </Link>
              </li>
              <li>
                <Link to="/features" className={itemClass}>
                  Features
                </Link>
              </li>
              <li>
                <Link to="/how-it-works" className={itemClass}>
                  How it works
                </Link>
              </li>
              <li>
                <Link to="/pricing" className={itemClass}>
                  Pricing
                </Link>
              </li>
              <li>
                <Link to="/contact" search={{ subject: "API access" }} className={itemClass}>
                  API Access
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className={itemClass}>
                  Demo
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <ColumnTitle>Company</ColumnTitle>
            <ul className="space-y-2">
              <li>
                <Link to="/about" className={itemClass}>
                  About
                </Link>
              </li>
              <li>
                <Link to="/contact" className={itemClass}>
                  Contact
                </Link>
              </li>
              <li>
                <Soon label="Careers" />
              </li>
              <li>
                <Soon label="Blog" />
              </li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <ColumnTitle>Resources</ColumnTitle>
            <ul className="space-y-2">
              <li>
                <Link to="/contact" className={itemClass}>
                  Contact us
                </Link>
              </li>
              <li>
                <Link to="/contact" search={{ subject: "Help & support" }} className={itemClass}>
                  Support
                </Link>
              </li>
              <li>
                <Soon label="Status" />
              </li>
              <li>
                <Link to="/security" className={itemClass}>
                  Security
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <ColumnTitle>Legal</ColumnTitle>
            <ul className="space-y-2">
              <li>
                <Link to="/privacy" className={itemClass}>
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className={itemClass}>
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/cookies" className={itemClass}>
                  Cookie Policy
                </Link>
              </li>
              <li>
                <Link to="/refunds" className={itemClass}>
                  Refund Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-border/80 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            © {year} Aislix Technologies. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Enquiries:{" "}
            <a
              href={`mailto:${ENQUIRY_INBOX}`}
              className="text-brand transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25 rounded-sm"
            >
              {ENQUIRY_INBOX}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

/** Alias for explicit global footer imports. */
export const Footer = SiteFooter;
