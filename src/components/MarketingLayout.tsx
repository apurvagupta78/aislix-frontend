import { forwardRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { scrollHomeSectionIntoView } from "@/lib/home/scroll-home-section";
import { cn } from "@/lib/utils";

export { SiteFooter } from "@/components/Footer";

const mobileNav = [
  { label: "Platform", to: "/" as const, hash: "platform" },
  { label: "Features", to: "/features" as const },
  { label: "How it works", to: "/" as const, hash: "photo-to-action" },
  { label: "Pricing", to: "/pricing" as const },
  { label: "About", to: "/about" as const },
  { label: "Contact", to: "/contact" as const },
  { label: "Security", to: "/security" as const },
];

const HomeHashLink = forwardRef<
  HTMLAnchorElement,
  {
    hash: string;
    children: ReactNode;
    className?: string;
    onNavigated?: () => void;
  }
>(function HomeHashLink({ hash, children, className, onNavigated }, ref) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <a
      ref={ref}
      href={`/#${hash}`}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        onNavigated?.();
        if (pathname === "/") {
          void navigate({ to: "/", hash, replace: true });
          scrollHomeSectionIntoView(hash);
          return;
        }
        void navigate({ to: "/", hash });
      }}
    >
      {children}
    </a>
  );
});

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center gap-6 px-5 sm:px-8">
        <Logo />
        <nav className="ml-auto flex items-center gap-1 sm:gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden rounded-lg lg:inline-flex">
            <HomeHashLink hash="platform">Platform</HomeHashLink>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden rounded-lg lg:inline-flex">
            <HomeHashLink hash="photo-to-action">How it works</HomeHashLink>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden rounded-lg lg:inline-flex">
            <Link to="/pricing">Pricing</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden rounded-lg lg:inline-flex">
            <Link to="/contact">Contact</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden rounded-lg lg:inline-flex">
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild variant="brand" size="sm" className="hidden rounded-lg px-5 lg:inline-flex">
            <Link to="/signup">Start free</Link>
          </Button>

          <Button asChild variant="brand" size="sm" className="rounded-lg lg:hidden">
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
                {mobileNav.map((n) =>
                  "hash" in n && n.hash ? (
                    <HomeHashLink
                      key={n.label}
                      hash={n.hash}
                      onNavigated={() => setOpen(false)}
                      className={cn(
                        "rounded-xl px-3 py-2.5 text-base text-foreground transition-colors hover:bg-muted",
                      )}
                    >
                      {n.label}
                    </HomeHashLink>
                  ) : (
                    <Link
                      key={n.label}
                      to={n.to}
                      onClick={() => setOpen(false)}
                      className="rounded-xl px-3 py-2.5 text-base text-foreground transition-colors hover:bg-muted"
                    >
                      {n.label}
                    </Link>
                  ),
                )}
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

export function MarketingPage({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
