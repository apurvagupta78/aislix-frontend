import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { scrollToSection } from "@/lib/landing-utm";
import { CYAN_BTN, SignupCta } from "./shared";

const LINKS = [
  { label: "How it works", id: "how-it-works" },
  { label: "Features", id: "features" },
  { label: "Use cases", id: "use-cases" },
  { label: "Demo", id: "demo" },
];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-colors",
        scrolled || open
          ? "border-b border-landing-border bg-background/90 backdrop-blur"
          : "bg-landing-navy",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Logo to="/retail-shelf-intelligence" className={scrolled || open ? "" : "brightness-0 invert"} />

        <nav className="hidden items-center gap-7 md:flex">
          {LINKS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => scrollToSection(l.id)}
              className={cn(
                "text-sm font-medium transition-colors",
                scrolled
                  ? "text-muted-foreground hover:text-foreground"
                  : "text-brand-foreground/75 hover:text-brand-foreground",
              )}
            >
              {l.label}
            </button>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <a
            href="/login"
            className={cn(
              "text-sm font-medium",
              scrolled ? "text-muted-foreground hover:text-foreground" : "text-brand-foreground/80 hover:text-brand-foreground",
            )}
          >
            Log in
          </a>
          <SignupCta location="nav" size="default" />
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <SignupCta location="nav_mobile" size="sm">
            Start free →
          </SignupCta>
          <Button
            variant="ghost"
            size="icon"
            aria-label={open ? "Close menu" : "Open menu"}
            className={scrolled || open ? "" : "text-brand-foreground hover:bg-brand-foreground/10"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </div>

      {open && (
        <div className="border-t border-landing-border bg-background px-5 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            {LINKS.map((l) => (
              <button
                key={l.id}
                type="button"
                className="text-left text-sm font-medium text-foreground"
                onClick={() => {
                  setOpen(false);
                  scrollToSection(l.id);
                }}
              >
                {l.label}
              </button>
            ))}
            <a href="/login" className="text-sm font-medium text-muted-foreground">
              Log in
            </a>
            <SignupCta location="nav_mobile_menu" className={cn("w-full", CYAN_BTN)} />
          </div>
        </div>
      )}
    </header>
  );
}
