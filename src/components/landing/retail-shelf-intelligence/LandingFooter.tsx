import { Logo } from "@/components/Logo";

export function LandingFooter() {
  return (
    <footer className="border-t border-landing-border bg-card py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 sm:px-8 md:flex-row md:items-center md:justify-between">
        <div>
          <Logo to="/retail-shelf-intelligence" />
          <p className="mt-3 text-xs text-muted-foreground">
            AI-powered retail shelf intelligence.
          </p>
        </div>

        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <a href="#features" className="hover:text-foreground">
            Product
          </a>
          <a href="#features" className="hover:text-foreground">
            Features
          </a>
          <a href="#use-cases" className="hover:text-foreground">
            Use cases
          </a>
          <a href="/contact" className="hover:text-foreground">
            Contact
          </a>
          <a href="/privacy" className="hover:text-foreground">
            Privacy
          </a>
          <a href="/terms" className="hover:text-foreground">
            Terms
          </a>
        </nav>

        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Aislix</p>
      </div>
    </footer>
  );
}
