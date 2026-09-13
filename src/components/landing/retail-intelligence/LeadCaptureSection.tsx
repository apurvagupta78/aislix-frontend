import { useState } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trackLandingEvent } from "@/lib/landing-analytics";
import { captureLandingLead, signupUrlWithLanding } from "@/lib/landing-scan-api";

export function LeadCaptureSection({ landingSessionId }: { landingSessionId: string | null }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    if (!landingSessionId) {
      setError("Run the sample audit or upload a shelf photo first so we can save your results.");
      document.getElementById("demo")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
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
    <section id="lead" className="border-t border-border bg-surface py-16 sm:py-20">
      <div className="mx-auto max-w-xl px-5 sm:px-8">
        <div className="rounded-lg border border-border bg-card p-6 shadow-lift sm:p-9">
          {done ? (
            <div className="text-center">
              <span className="mx-auto grid size-11 place-items-center rounded-full bg-brand-soft text-brand">
                <CheckCircle2 className="size-6" />
              </span>
              <p className="text-xs font-semibold uppercase tracking-wider text-brand">Continue with Aislix</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-normal">You&apos;re all set.</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Your shelf audit is saved to this session. Create your workspace to continue.
              </p>
              <Button
                className="mt-6 min-h-11 w-full bg-accent-green text-brand-foreground hover:bg-accent-green/90"
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
              <p className="text-xs font-semibold uppercase tracking-wider text-brand">Continue with Aislix</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-normal sm:text-3xl">
                Save your shelf audit &amp; unlock 5 free audits
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Enter your work email. No credit card required.
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
                    <Label htmlFor="lead-name">Full name</Label>
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

              <Button
                type="submit"
                className="mt-6 min-h-11 w-full bg-accent-green text-brand-foreground hover:bg-accent-green/90"
                disabled={saving}
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                Continue
              </Button>
              <Button
                type="button"
                variant="link"
                onClick={() => {
                  trackLandingEvent("signup_started", { location: "lead_skip" });
                  window.location.assign(signupUrlWithLanding());
                }}
                className="mt-3 w-full text-xs text-muted-foreground"
              >
                Skip for now
              </Button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
