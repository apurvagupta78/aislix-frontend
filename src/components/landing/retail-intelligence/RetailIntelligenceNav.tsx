import logoAsset from "@/assets/aislix-logo.png.asset.json";
import { trackLandingEvent } from "@/lib/landing-analytics";

/** Minimal ad-landing header: logo (stays on the landing page) + Log in link. */
export function RetailIntelligenceNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center px-5 sm:px-8">
        <a href="/retail-intelligence" aria-label="Aislix" className="inline-flex items-center">
          <img src={logoAsset.url} alt="Aislix" className="h-8 w-auto" />
        </a>
        <a
          href="/login"
          onClick={() => trackLandingEvent("cta_click", { location: "nav_login" })}
          className="ml-auto rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Log in
        </a>
      </div>
    </header>
  );
}
