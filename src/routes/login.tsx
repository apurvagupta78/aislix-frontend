import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — Aislix Shelf Intelligence" },
      { name: "description", content: "Log in to your Aislix workspace to run and review AI shelf audits." },
      { property: "og:title", content: "Log in — Aislix" },
      { property: "og:description", content: "Access your Aislix retail shelf intelligence workspace." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to continue auditing your shelves."
      footer={
        <>
          New to Aislix?{" "}
          <Link to="/signup" className="font-medium text-brand hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" type="email" placeholder="you@company.com" className="h-11 rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" placeholder="••••••••" className="h-11 rounded-xl" />
        </div>
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox id="remember" /> Remember me
          </label>
          <Link to="/forgot-password" className="text-sm text-brand hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button asChild variant="brand" size="lg" className="w-full">
          <Link to="/dashboard">Log in</Link>
        </Button>
        <div className="relative py-2 text-center">
          <span className="relative z-10 bg-background px-3 text-xs text-muted-foreground">
            or continue with
          </span>
          <span className="absolute left-0 top-1/2 h-px w-full bg-border" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="subtle" size="lg" type="button">
            Google
          </Button>
          <Button variant="subtle" size="lg" type="button">
            Microsoft
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
