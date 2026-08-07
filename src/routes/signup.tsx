import { createFileRoute, Link } from "@tanstack/react-router";
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

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create your Aislix workspace — Free shelf audits" },
      {
        name: "description",
        content:
          "Sign up for Aislix and get 50 free AI shelf scans for your supermarket, distribution network or local store.",
      },
      { property: "og:title", content: "Create your Aislix workspace" },
      { property: "og:description", content: "Start auditing retail shelves with AI in minutes." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  return (
    <AuthLayout
      title="Create your workspace"
      subtitle="50 free shelf scans. No card required."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-brand hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="first">First name</Label>
            <Input id="first" placeholder="Rahul" className="h-11 rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last">Last name</Label>
            <Input id="last" placeholder="Kapoor" className="h-11 rounded-xl" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" type="email" placeholder="you@company.com" className="h-11 rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="company">Company</Label>
          <Input id="company" placeholder="MoreMart Retail Pvt Ltd" className="h-11 rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="type">Business type</Label>
          <Select>
            <SelectTrigger id="type" className="h-11 rounded-xl">
              <SelectValue placeholder="Select business type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="supermarket">Supermarket / Hypermarket</SelectItem>
              <SelectItem value="fmcg">FMCG brand</SelectItem>
              <SelectItem value="distributor">Distributor</SelectItem>
              <SelectItem value="local">local store</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" placeholder="At least 8 characters" className="h-11 rounded-xl" />
        </div>
        <label className="flex gap-2 pt-1 text-sm text-muted-foreground">
          <Checkbox id="terms" className="mt-0.5" />
          I agree to the Aislix Terms of Service and Privacy Policy.
        </label>
        <Button asChild variant="brand" size="lg" className="w-full">
          <Link to="/dashboard">Create workspace</Link>
        </Button>
      </form>
    </AuthLayout>
  );
}
