/** Compact ad-landing hero: one H1, one subhead, one trust line. */
export function HeroSection() {
  return (
    <section id="hero" className="relative overflow-hidden bg-hero-glow">
      <div className="absolute inset-0 grid-lines opacity-30 [mask-image:radial-gradient(70%_60%_at_50%_0%,black,transparent)]" />
      <div className="relative mx-auto max-w-3xl px-5 py-14 text-center sm:px-8 sm:py-16">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs text-muted-foreground shadow-soft">
          <span className="size-1.5 rounded-full bg-brand" />
          AI-Powered Retail Shelf Intelligence
        </span>
        <h1 className="mt-6 text-3xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-5xl">
          Turn Any Shelf Photo Into Retail Intelligence
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Upload a shelf photo and Aislix detects products, brands, quantities and availability
          gaps in under a minute.
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          3 free shelf scans • No credit card required
        </p>
      </div>
    </section>
  );
}
