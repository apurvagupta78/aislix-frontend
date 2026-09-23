import { useState } from "react";
import { platformFeatures } from "@/lib/home/homepage-data";
import { statusDot, toneCard, toneText } from "@/lib/home/homepage-tone";

export function HomePlatformSection() {
  const [activeId, setActiveId] = useState(platformFeatures[0].id);
  const active = platformFeatures.find((f) => f.id === activeId) ?? platformFeatures[0];
  const ActiveIcon = active.icon;

  return (
    <section
      id="platform"
      className="scroll-mt-20 bg-surface py-20 lg:py-28"
      aria-labelledby="platform-title"
    >
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-[#2A6FA8]">The Aislix platform</p>
          <h2
            id="platform-title"
            className="mt-3 text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl"
          >
            Turn shelf visits into structured retail intelligence.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Stop relying on manual counting, scattered photos and subjective store reports. Aislix
            turns shelf images into consistent, measurable and actionable retail audits.
          </p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12">
          <div
            role="tablist"
            aria-label="Platform capabilities"
            aria-orientation="vertical"
            className="flex flex-col"
          >
            {platformFeatures.map((f) => {
              const selected = f.id === activeId;
              const Icon = f.icon;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  id={`tab-${f.id}`}
                  aria-selected={selected}
                  aria-controls="platform-panel"
                  onClick={() => setActiveId(f.id)}
                  className={`group flex gap-4 border-l-2 py-4 pl-5 pr-2 text-left transition-colors duration-150 focus:outline-none focus-visible:bg-white ${
                    selected
                      ? "border-[var(--aislix-primary)]"
                      : "border-border hover:border-muted-foreground"
                  }`}
                >
                  <Icon
                    className={`mt-0.5 size-5 shrink-0 ${
                      selected ? "text-[var(--aislix-primary)]" : "text-muted-foreground"
                    }`}
                    aria-hidden="true"
                  />
                  <span>
                    <span
                      className={`block text-base font-semibold ${
                        selected
                          ? "text-foreground"
                          : "text-muted-foreground group-hover:text-foreground"
                      }`}
                    >
                      {f.title}
                    </span>
                    {selected && (
                      <span className="mt-1.5 block text-sm leading-relaxed text-muted-foreground">
                        {f.body}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            id="platform-panel"
            role="tabpanel"
            aria-labelledby={`tab-${active.id}`}
            className="rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-8"
          >
            <div key={active.id} className="animate-in fade-in duration-200">
              <div
                className={`flex items-end justify-between gap-4 rounded-2xl border p-6 ${toneCard[active.tone]}`}
              >
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{active.metric.label}</p>
                  <p className="mt-1 text-6xl font-bold tracking-[-0.03em] text-foreground">
                    {active.metric.value}
                  </p>
                </div>
                <span className="flex size-12 items-center justify-center rounded-xl bg-white">
                  <ActiveIcon className={`size-6 ${toneText[active.tone]}`} aria-hidden="true" />
                </span>
              </div>
              <ul className="mt-6 divide-y divide-border">
                {active.rows.map((r) => (
                  <li key={r.name} className="flex items-center justify-between gap-4 py-4">
                    <span className="flex items-center gap-3 text-sm font-medium text-foreground">
                      <span
                        className={`size-2 rounded-full ${statusDot[r.status]}`}
                        aria-hidden="true"
                      />
                      {r.name}
                    </span>
                    <span className="text-sm text-muted-foreground">{r.value}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-muted-foreground">
                Example output from an oral care shelf audit.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
