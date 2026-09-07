import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { register } from "@/lib/api/auth";
import { SocialAuthButtons } from "@/components/auth/SocialAuthButtons";
import { toUserMessage } from "@/lib/api/errors";
import { convertLandingSession, loadLandingSessionId } from "@/lib/landing-scan-api";
import { trackWorkspaceSignupConversion } from "@/lib/linkedin-conversion";
import { trackEvent } from "@/lib/analytics";


export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create your Aislix workspace — Free shelf audits" },
      {
        name: "description",
        content:
          "Sign up for Aislix and get 3 free AI shelf scans per day — built for supermarkets, dark stores, warehouses, FMCG brands, distributors and local stores.",
      },
      { property: "og:title", content: "Create your Aislix workspace" },
      { property: "og:description", content: "Start auditing retail shelves with AI in minutes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    first: "",
    last: "",
    email: "",
    company: "",
    businessType: "",
    password: "",
  });
  const [agreed, setAgreed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const conversionTracked = useRef(false);
  const set = (key: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const signUp = useMutation({
    mutationFn: () => {
      trackEvent("signup_started", { location: "signup_form" });
      return
      register({
        email: form.email.trim(),
        password: form.password,
        full_name: `${form.first} ${form.last}`.trim(),
        company_name: form.company.trim() || undefined,
      });
    },
    onSuccess: (session) => {
      trackEvent("signup_completed", { has_company: form.company.trim().length > 0 });
      // The register request resolved with a created user; fire once per signup.
      if (session?.user?.id && !conversionTracked.current) {
        conversionTracked.current = true;
        trackWorkspaceSignupConversion();
      }
      // Best-effort landing-demo attribution; never blocks the auth flow.
      const sid =
        new URLSearchParams(window.location.search).get("landing_session_id") ??
        loadLandingSessionId();
      if (sid && session?.user?.id) void convertLandingSession(sid, session.user.id);
      // Always land on the dedicated verification page — never a toast only.
      navigate({ to: "/verify-email", search: { email: form.email.trim() }, replace: true });
    },

    onError: (error: unknown) =>
      toast.error("Could not create your workspace", { description: toUserMessage(error) }),
  });

  const disabled =
    signUp.isPending ||
    !agreed ||
    form.first.trim().length === 0 ||
    form.email.trim().length === 0 ||
    form.password.length < 8;

  return (
    <AuthLayout
      title="Create your workspace"
      subtitle="5 free shelf scans every 24 hours. No card required."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-brand hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!disabled) signUp.mutate();
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="first">First name</Label>
            <Input
              id="first"
              placeholder="Rahul"
              className="h-11 rounded-xl"
              value={form.first}
              onChange={(e) => set("first")(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last">Last name</Label>
            <Input
              id="last"
              placeholder="Kapoor"
              className="h-11 rounded-xl"
              value={form.last}
              onChange={(e) => set("last")(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            className="h-11 rounded-xl"
            value={form.email}
            onChange={(e) => set("email")(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="company">Company</Label>
          <Input
            id="company"
            placeholder="MoreMart Retail Pvt Ltd"
            className="h-11 rounded-xl"
            value={form.company}
            onChange={(e) => set("company")(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="type">Business type</Label>
          <Select value={form.businessType} onValueChange={set("businessType")}>
            <SelectTrigger id="type" className="h-11 rounded-xl">
              <SelectValue placeholder="Select business type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="supermarket">Supermarket / Hypermarket</SelectItem>
              <SelectItem value="darkstore">Dark store</SelectItem>
              <SelectItem value="warehouse">Warehouse</SelectItem>
              <SelectItem value="fmcg">FMCG brand</SelectItem>
              <SelectItem value="distributor">Distributor</SelectItem>
              <SelectItem value="local">Local store</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className="h-11 rounded-xl pr-10"
              value={form.password}
              onChange={(e) => set("password")(e.target.value)}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <label className="flex gap-2 pt-1 text-sm text-muted-foreground">
          <Checkbox
            id="terms"
            className="mt-0.5"
            checked={agreed}
            onCheckedChange={(v) => setAgreed(v === true)}
          />
          I agree to the Aislix Terms of Service and Privacy Policy.
        </label>
        <Button variant="brand" size="lg" className="w-full" type="submit" disabled={disabled}>
          {signUp.isPending ? "Creating workspace…" : "Create workspace"}
        </Button>
      </form>
      <div className="mt-5">
        <SocialAuthButtons />
      </div>
    </AuthLayout>
  );
}
