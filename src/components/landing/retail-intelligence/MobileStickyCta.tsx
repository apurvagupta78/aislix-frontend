import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackLandingEvent } from "@/lib/landing-analytics";
import { scrollToDemo } from "./demoBus";

/** Mobile-only bottom bar. Always points at the live demo, never signup. */
export function MobileStickyCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 px-4 py-3 backdrop-blur-xl lg:hidden">
      <Button
        variant="hero"
        className="min-h-11 w-full"
        onClick={() => {
          trackLandingEvent("cta_click", { location: "mobile_sticky" });
          scrollToDemo();
        }}
      >
        Analyze a Shelf Photo <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}
