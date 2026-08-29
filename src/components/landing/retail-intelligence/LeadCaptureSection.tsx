import { useState } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trackLandingEvent } from "@/lib/landing-analytics";
import { captureLandingLead, signupUrlWithLanding } from "@/lib/landing-scan-api";

export function LeadCaptureSection({ landingSessionId }: { landingSessionId: string }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await captureLandingLead({
        landing_session_id: landingSessionId,
        email: email.trim(),
        name: name.trim() || undefined,
        company: company.trim() || undefined,
      });
      trackLandingEvent("landing_lead_captured");
      setDone(true);
    } catch {
      setError("Could not save your details. You can still create your free account.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="lead" className="border-t border-border bg-surface py-14">
      <div className="mx-auto max-w-lg px-5 sm:px-8">
        <div className="card-surface p-6 sm:p-8">
          {done ? (
            <div className="text-center">
              <span className="mx-auto grid size-11 place-items-center rounded-full bg-brand-soft text-brand">
                <CheckCircle2 className="size-6" />
              </span>
              <h2 className="mt-4 text-xl font-semibold tracking-tight">
                Thanks! Create your free account to continue.
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Your scan results are saved to this session.
              </p>
              <Button
                className="mt-6 min-h-11 w-full"
                variant="hero"
                onClick={() => {
                  trackLandingEvent("signup_started", { location: "lead_success" });
                  window.location.assign(signupUrlWithLanding());
                }}
              >
                Create Free Account <ArrowRight className="size-4" />
              </Button>
            </div>
          ) : (
            <form onSubmit={submit}>
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                Save your results & analyze more shelves
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Enter your work email to get 3 free shelf scans in your workspace.
              </p>

              <div className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="lead-email">Work email *</Label>
                  <Input
                    id="lead-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="min-h-11"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="lead-name">Name</Label>
                    <Input
                      id="lead-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="min-h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lead-company">Company</Label>
                    <Input
                      id="lead-company"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="min-h-11"
                    />
                  </div>
                </div>
              </div>

              {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

              <Button type="submit" variant="hero" className="mt-6 min-h-11 w-full" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                Continue
              </Button>
              <button
                type="button"
                onClick={() => {
                  trackLandingEvent("signup_started", { location: "lead_skip" });
                  window.location.assign(signupUrlWithLanding());
                }}
                className="mt-4 block w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                Skip for now
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
