import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/processing")({
  head: () => ({
    meta: [
      { title: "Analyzing shelf scan — Aislix" },
      {
        name: "description",
        content: "Aislix is running detection, brand matching and planogram compliance on your shelf images.",
      },
      { property: "og:title", content: "Analyzing your shelf scan — Aislix" },
      { property: "og:description", content: "Computer vision pipeline in progress." },
    ],
  }),
  component: Processing,
});

const stages = [
  "Uploading images",
  "Detecting shelf structure",
  "Identifying products & packs",
  "Matching brands and SKUs",
  "Scoring planogram compliance",
  "Generating audit report",
];

function Processing() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(6);

  useEffect(() => {
    const t = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(t);
          return 100;
        }
        return p + 2;
      });
    }, 120);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (progress >= 100) {
      const t = setTimeout(() => navigate({ to: "/results" }), 900);
      return () => clearTimeout(t);
    }
  }, [progress, navigate]);

  const activeStage = Math.min(stages.length - 1, Math.floor((progress / 100) * stages.length));

  return (
    <AppShell title="Processing scan" description="SCN-10429 · MoreMart Superstore · Aisle 4 · Beverages">
      <div className="mx-auto max-w-2xl">
        <div className="card-surface p-9 text-center">
          <div className="relative mx-auto grid size-28 place-items-center">
            <div className="absolute inset-0 animate-pulse rounded-full bg-brand-soft" />
            <div className="relative grid size-20 place-items-center rounded-full bg-gradient-brand shadow-card">
              <Loader2 className="size-8 animate-spin text-brand-foreground" />
            </div>
          </div>
          <h2 className="mt-7 text-xl font-semibold tracking-tight">
            {progress >= 100 ? "Analysis complete" : "Analyzing your shelf"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {progress >= 100
              ? "Opening your scan results…"
              : "This usually takes under 30 seconds. You can leave this page — we'll notify you."}
          </p>

          <div className="mt-8">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{stages[activeStage]}</span>
              <span>{Math.min(progress, 100)}%</span>
            </div>
            <Progress value={Math.min(progress, 100)} className="mt-2 h-2 rounded-full" />
          </div>

          <ul className="mt-8 space-y-3 text-left">
            {stages.map((s, i) => {
              const done = i < activeStage || progress >= 100;
              const active = i === activeStage && progress < 100;
              return (
                <li key={s} className="flex items-center gap-3">
                  <span
                    className={`grid size-6 place-items-center rounded-full text-brand-foreground ${
                      done ? "bg-brand" : active ? "bg-brand/60" : "bg-muted"
                    }`}
                  >
                    {done ? (
                      <Check className="size-3.5" />
                    ) : active ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <span className="size-1.5 rounded-full bg-muted-foreground" />
                    )}
                  </span>
                  <span
                    className={`text-sm ${done || active ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {s}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="mt-9 flex justify-center gap-2">
            <Button asChild variant="subtle" size="sm" className="rounded-xl">
              <Link to="/dashboard">Back to dashboard</Link>
            </Button>
            <Button asChild variant="brand" size="sm" className="rounded-xl">
              <Link to="/results">Skip to results</Link>
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
