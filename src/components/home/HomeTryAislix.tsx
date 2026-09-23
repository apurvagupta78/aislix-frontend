import { ScanSearch, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEMO_SHELF_IMAGE } from "@/lib/home/homepage-data";
import { trackLandingEvent } from "@/lib/landing-analytics";
import { markGuestMode } from "@/lib/guest-mode";

function openGuestDashboard(intent: "sample" | "upload") {
  markGuestMode();
  trackLandingEvent("demo_scan_started", { mode: intent === "sample" ? "sample" : "upload" });
  window.open(`/dashboard?intent=${intent}`, "_blank", "noopener,noreferrer");
}

/** Lightweight Try Aislix — opens the real dashboard in Guest mode. */
export function HomeTryAislix() {
  return (
    <section
      id="live-dashboard"
      className="scroll-mt-20 bg-card py-20 lg:py-28"
      aria-labelledby="try-title"
    >
      <div className="mx-auto grid max-w-7xl gap-10 px-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8">
        <div>
          <p className="text-sm font-semibold text-[#2A6FA8]">Try Aislix free</p>
          <h2
            id="try-title"
            className="mt-3 text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl"
          >
            See what Aislix can find on your shelf.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Open the real operations dashboard in Guest mode. Explore Demo ON data, then run the
            sample audit or upload your own shelf photo — no login required.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              size="xl"
              variant="default"
              className="rounded-xl"
              onClick={() => openGuestDashboard("sample")}
            >
              <ScanSearch className="size-4" />
              Run audit
            </Button>
            <Button
              type="button"
              size="xl"
              variant="outline"
              className="rounded-xl"
              onClick={() => openGuestDashboard("upload")}
            >
              <Upload className="size-4" />
              Upload shelf photo
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Opens /dashboard in a new tab · Guest mode · Demo ON
          </p>
        </div>

        <div className="grid gap-3 rounded-3xl border border-border bg-surface p-3 sm:grid-cols-[1.2fr_1fr] sm:p-4">
          <div className="overflow-hidden rounded-2xl bg-white">
            <img
              src={DEMO_SHELF_IMAGE}
              alt="Sample grocery shelf for the Aislix guest demo"
              className="aspect-[4/3] h-full w-full object-cover"
              width={640}
              height={480}
              loading="lazy"
            />
          </div>
          <div className="flex flex-col items-center justify-center rounded-2xl bg-white p-6 text-center">
            <ScanSearch className="size-8 text-border" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-foreground">Real dashboard</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Same Operations AI Dashboard signed-in teams use — with Guest demo data.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
