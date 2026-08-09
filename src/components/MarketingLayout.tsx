import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Linkedin, Menu } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const mobileNav = [
  { label: "Platform", to: "/platform" },
  { label: "Features", to: "/features" },
  { label: "How it works", to: "/how-it-works" },
  { label: "Pricing", to: "/pricing" },
  { label: "About", to: "/about" },
  { label: "Contact", to: "/contact" },
  { label: "Security", to: "/security" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-5 sm:px-8">
        <Logo />
        <nav className="ml-auto flex items-center gap-1 sm:gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden rounded-xl lg:inline-flex">
            <Link to="/platform">Platform</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden rounded-xl lg:inline-flex">
            <Link to="/how-it-works">How it works</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden rounded-xl lg:inline-flex">
            <Link to="/pricing">Pricing</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden rounded-xl lg:inline-flex">
            <Link to="/contact">Contact</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden rounded-xl lg:inline-flex">
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild variant="brand" size="sm" className="hidden rounded-xl lg:inline-flex">
            <Link to="/signup">Start free</Link>
          </Button>

          <Button asChild variant="brand" size="sm" className="rounded-xl lg:hidden">
            <Link to="/signup">Start free</Link>
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="flex w-[85vw] max-w-sm flex-col gap-0 overflow-y-auto p-0"
            >
              <div className="border-b border-border px-5 py-4">
                <Logo />
              </div>
              <nav className="flex flex-col gap-1 px-3 py-4">
                {mobileNav.map((n) => (
                  <Link
                    key={n.to}
                    to={n.to}
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-3 py-2.5 text-base text-foreground transition-colors hover:bg-muted"
                  >
                    {n.label}
                  </Link>
                ))}
              </nav>
              <div className="mt-auto flex flex-col gap-2 border-t border-border px-5 py-5">
                <Button asChild variant="outline" className="rounded-xl">
                  <Link to="/login" onClick={() => setOpen(false)}>
                    Sign in
                  </Link>
                </Button>
                <Button asChild variant="brand" className="rounded-xl">
                  <Link to="/signup" onClick={() => setOpen(false)}>
                    Start free
                  </Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </nav>
      </div>
    </header>
  );
}


function ColumnTitle({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  );
}

const itemClass = "text-sm text-muted-foreground transition-colors hover:text-foreground";

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

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="sm:col-span-2 lg:col-span-1">

            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              AI retail shelf intelligence for supermarkets, dark stores, warehouses, FMCG brands,
              distributors and local stores. Audit any shelf from a single photo.
            </p>
            <div className="mt-5 flex items-center gap-2">
              <a
                href="https://www.linkedin.com/company/aislix/"
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Aislix on LinkedIn"
                className="grid size-9 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-brand"
              >
                <Linkedin className="size-4" />
              </a>
              <a
                href="https://x.com/aislix_ai"
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Aislix on X (Twitter)"
                className="grid size-9 place-items-center rounded-xl border border-border bg-card text-sm font-semibold text-muted-foreground transition-colors hover:text-brand"
              >
                X
              </a>
            </div>
          </div>

          <div className="space-y-3">
            <ColumnTitle>Product</ColumnTitle>
            <ul className="space-y-2.5">
              <li>
                <Link to="/platform" className={itemClass}>Platform</Link>
              </li>
              <li>
                <Link to="/features" className={itemClass}>Features</Link>
              </li>
              <li>
                <Link to="/how-it-works" className={itemClass}>How it works</Link>
              </li>
              <li>
                <Link to="/pricing" className={itemClass}>Pricing</Link>
              </li>
              <li>
                <Link to="/contact" search={{ subject: "API access" }} className={itemClass}>
                  API
                </Link>
              </li>
              <li>
                <Link to="/contact" search={{ subject: "Book a demo" }} className={itemClass}>
                  Demo
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <ColumnTitle>Company</ColumnTitle>
            <ul className="space-y-2.5">
              <li>
                <Link to="/about" className={itemClass}>About</Link>
              </li>
              <li>
                <Link to="/contact" className={itemClass}>Contact</Link>
              </li>
              <li><Soon label="Careers" /></li>
              <li><Soon label="Blog" /></li>
            </ul>
          </div>

          <div className="space-y-3">
            <ColumnTitle>Resources</ColumnTitle>
            <ul className="space-y-2.5">
              <li>
                <Link to="/contact" search={{ subject: "Documentation" }} className={itemClass}>
                  Documentation
                </Link>
              </li>
              <li>
                <Link to="/contact" search={{ subject: "Help & support" }} className={itemClass}>
                  Help Center
                </Link>
              </li>
              <li><Soon label="Status" /></li>
              <li>
                <Link to="/security" className={itemClass}>Security</Link>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <ColumnTitle>Legal</ColumnTitle>
            <ul className="space-y-2.5">
              <li>
                <Link to="/privacy" className={itemClass}>Privacy Policy</Link>
              </li>
              <li>
                <Link to="/terms" className={itemClass}>Terms of Service</Link>
              </li>
              <li>
                <Link to="/cookies" className={itemClass}>Cookie Policy</Link>
              </li>
              <li>
                <Link to="/refunds" className={itemClass}>Refund Policy</Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            © 2026 Aislix Technologies. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Enquiries:{" "}
            <a href="mailto:hello@aislix.com" className="text-brand hover:underline">
              hello@aislix.com
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

export function MarketingPage({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
