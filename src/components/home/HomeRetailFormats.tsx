import { retailFormats } from "@/lib/home/homepage-data";
import { toneCard, toneText } from "@/lib/home/homepage-tone";

export function HomeRetailFormats() {
  return (
    <section
      className="border-y border-border bg-surface py-20 lg:py-24"
      aria-labelledby="formats-title"
    >
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="formats-title"
            className="text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl"
          >
            One view of execution across every retail format.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            One platform for retailers, brands, distributors and store teams.
          </p>
        </div>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {retailFormats.map(({ icon: Icon, title, body, tone }) => (
            <li
              key={title}
              className={`flex flex-col items-center rounded-2xl border px-5 py-7 text-center shadow-soft ${toneCard[tone]}`}
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-white shadow-sm">
                <Icon className={`size-5 ${toneText[tone]}`} aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
