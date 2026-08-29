import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import logoAsset from "@/assets/aislix-logo.png.asset.json";
import { useSignupHref } from "./useSignupHref";
import { trackLandingEvent } from "@/lib/landing-analytics";

const anchors = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Capabilities", href: "#capabilities" },
  { label: "Use cases", href: "#use-cases" },
] as const;

function onSignup(location: string) {
  trackLandingEvent("cta_click", { location });
  trackLandingEvent("signup_started", { location });
}

export function RetailIntelligenceNav() {
  const [open, setOpen] = useState(false);
  const signupHref = useSignupHref();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5 sm:px-8">
        <a href="#hero" aria-label="Aislix" className="inline-flex items-center">
          <img src={logoAsset.url} alt="Aislix" className="h-8 w-auto" />
        </a>

        <nav className="ml-auto hidden items-center gap-1 lg:flex">
          {anchors.map((a) => (
            <a
              key={a.href}
              href={a.href}
              className="rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {a.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-4">
          <Button asChild variant="brand" size="sm" className="hidden min-h-11 rounded-xl sm:inline-flex">
            <a href={signupHref} onClick={() => onSignup("nav")}>
              Start Free Shelf Scan
            </a>
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-xl lg:hidden" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex w-[85vw] max-w-sm flex-col gap-0 p-0">
              <div className="border-b border-border px-5 py-4">
                <img src={logoAsset.url} alt="Aislix" className="h-8 w-auto" />
              </div>
              <nav className="flex flex-col gap-1 px-3 py-4">
                {anchors.map((a) => (
                  <a
                    key={a.href}
                    href={a.href}
                    onClick={() => setOpen(false)}
                    className="min-h-11 rounded-xl px-3 py-2.5 text-base text-foreground transition-colors hover:bg-muted"
                  >
                    {a.label}
                  </a>
                ))}
              </nav>
              <div className="mt-auto border-t border-border px-5 py-5">
                <Button asChild variant="brand" className="min-h-11 w-full rounded-xl">
                  <a
                    href={signupHref}
                    onClick={() => {
                      setOpen(false);
                      onSignup("nav_mobile");
                    }}
                  >
                    Start Free Shelf Scan
                  </a>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
