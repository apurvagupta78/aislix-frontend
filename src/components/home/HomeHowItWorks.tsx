import { howItWorksSteps } from "@/lib/home/homepage-data";

export function HomeHowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-20 bg-card py-20 lg:py-28"
      aria-labelledby="how-title"
    >
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-[#2A6FA8]">How it works</p>
          <h2
            id="how-title"
            className="mt-3 text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl"
          >
            From shelf photo to retail action in four steps.
          </h2>
        </div>

        <ol className="relative mt-14 grid gap-10 md:grid-cols-4 md:gap-8">
          <div
            className="absolute left-5 right-5 top-5 hidden h-px bg-border md:block"
            aria-hidden="true"
          />
          {howItWorksSteps.map(({ icon: Icon, title, lead, body }, i) => (
            <li key={title} className="relative flex gap-5 md:block">
              <span className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--aislix-primary)] text-sm font-bold text-white ring-8 ring-card">
                {i + 1}
              </span>
              <div className="md:mt-6">
                <p className="flex items-center gap-2 text-sm font-semibold text-[#2A6FA8]">
                  <Icon className="size-4" aria-hidden="true" />
                  {title}
                </p>
                <h3 className="mt-2 text-lg font-semibold text-foreground">{lead}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
