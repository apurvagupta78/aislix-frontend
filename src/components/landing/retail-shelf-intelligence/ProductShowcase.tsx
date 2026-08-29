import { Check } from "lucide-react";
import { DEFAULT_SAMPLE_IMAGE } from "@/lib/landing-scan-api";
import { SignupCta } from "./shared";

const BULLETS = [
  "Real-time product detection",
  "Product & brand identification",
  "Automated shelf counting",
  "Out-of-stock detection",
  "Shelf health scoring",
  "Actionable retail intelligence",
];

export function ProductShowcase({ imageUrl }: { imageUrl?: string | null }) {
  return (
    <section className="bg-background py-16 sm:py-20">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 sm:px-8 lg:grid-cols-2 lg:items-center lg:gap-14">
        <div className="overflow-hidden rounded-2xl border border-landing-border bg-card shadow-lift">
          <div className="flex items-center gap-2 border-b border-landing-border bg-landing-surface px-4 py-3">
            <span className="size-2 rounded-full bg-landing-cyan" />
            <p className="text-xs font-medium text-muted-foreground">Shelf analysis</p>
          </div>
          <img
            src={imageUrl || DEFAULT_SAMPLE_IMAGE}
            alt="Aislix shelf analysis view"
            loading="lazy"
            className="max-h-[460px] w-full bg-landing-surface object-contain p-3"
          />
        </div>

        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            See What Aislix Sees
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Aislix uses computer vision and AI to turn shelf photos into structured, actionable
            intelligence.
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {BULLETS.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm text-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-landing-cyan" /> {b}
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <SignupCta location="product_showcase" event="feature_cta_click" size="xl">
              Start free shelf scan →
            </SignupCta>
          </div>
        </div>
      </div>
    </section>
  );
}
