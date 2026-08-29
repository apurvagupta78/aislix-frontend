import { useState } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trackLandingEvent } from "@/lib/landing-analytics";
import { signupUrl } from "@/lib/landing-utm";
import { captureLandingLead, loadLandingSessionId } from "@/lib/landing-scan-api";
import { CYAN_BTN } from "./shared";

export function WideLeadCapture({ landingSessionId }: { landingSessionId: string | null }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSaving(true);
    setError(null);
    const sessionId = landingSessionId ?? loadLandingSessionId();
    try {
      if (sessionId) {
        await captureLandingLead({
          landing_session_id: sessionId,
          email: email.trim(),
          name: [name.trim(), role.trim()].filter(Boolean).join(" · ") || undefined,
          company: company.trim() || undefined,
        });
      }
      trackLandingEvent("landing_lead_captured", { has_session: Boolean(sessionId) });
      setDone(true);
    } catch {
      setError("Could not save your details. You can still create your free account.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="lead" className="scroll-mt-16 bg-landing-surface py-16 sm:py-20">
      <div className="mx-auto max-w-4xl px-5 sm:px-8">
        <div className="rounded-2xl border border-landing-border bg-card p-6 shadow-lift sm:p-10">
          {done ? (
            <div className="text-center">
              <span className="mx-auto grid size-11 place-items-center rounded-full bg-landing-cyan-soft text-landing-cyan">
                <CheckCircle2 className="size-6" />
              </span>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
                You&apos;re all set.
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Create your free workspace to keep scanning shelves.
              </p>
              <Button
                size="xl"
                className={`mt-6 min-h-11 w-full sm:w-auto ${CYAN_BTN}`}
                onClick={() => {
                  trackLandingEvent("signup_started", { location: "lead_success" });
                  window.location.assign(signupUrl());
                }}
              >
                Create free account <ArrowRight className="size-4" />
              </Button>
            </div>
          ) : (
            <form onSubmit={submit}>
              <div className="text-center">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  Get Your Free Shelf Intelligence Access
                </h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  Enter your work email to start scanning. No credit card required.
                </p>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="rsi-email">Work email *</Label>
                  <Input
                    id="rsi-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="min-h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rsi-name">Full name</Label>
                  <Input
                    id="rsi-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="min-h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rsi-company">Company</Label>
                  <Input
                    id="rsi-company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="min-h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rsi-role">Role</Label>
                  <Input
                    id="rsi-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="Retail ops, brand, field sales…"
                    className="min-h-11"
                  />
                </div>
              </div>

              {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

              <div className="mt-7 flex flex-col items-center gap-3">
                <Button
                  type="submit"
                  size="xl"
                  className={`min-h-11 w-full sm:w-auto sm:min-w-64 ${CYAN_BTN}`}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                  Start free shelf scan
                </Button>
                <p className="text-xs text-muted-foreground">
                  We only use your email to set up your Aislix workspace.
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
