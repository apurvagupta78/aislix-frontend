import { createFileRoute } from "@tanstack/react-router";
import { Camera, Mail, MapPin, Phone, ScanLine, Award, Building2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { scans } from "@/lib/aislix-data";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "User Profile — Aislix" },
      {
        name: "description",
        content: "Manage your Aislix profile, contact details, assigned stores and audit activity.",
      },
      { property: "og:title", content: "Your Aislix profile" },
      { property: "og:description", content: "Profile details and shelf audit activity." },
    ],
  }),
  component: Profile,
});

function Profile() {
  return (
    <AppShell title="Profile" description="Your personal details and audit activity on Aislix.">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <div className="card-surface p-6 text-center">
            <div className="relative mx-auto w-fit">
              <Avatar className="size-20">
                <AvatarFallback className="bg-brand-soft text-xl font-medium text-brand">
                  RK
                </AvatarFallback>
              </Avatar>
              <button className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full bg-brand text-brand-foreground shadow-card">
                <Camera className="size-4" />
              </button>
            </div>
            <h2 className="mt-4 text-lg font-semibold tracking-tight">Rahul Kapoor</h2>
            <p className="text-sm text-muted-foreground">Head of Retail Operations</p>
            <Badge className="mt-3 rounded-full bg-brand-soft text-brand hover:bg-brand-soft">
              Workspace admin
            </Badge>
            <div className="mt-6 space-y-3 border-t border-border pt-5 text-left text-sm">
              <p className="flex items-center gap-2.5 text-muted-foreground">
                <Mail className="size-4 text-brand" /> ops@moremart.in
              </p>
              <p className="flex items-center gap-2.5 text-muted-foreground">
                <Phone className="size-4 text-brand" /> +91 98450 22187
              </p>
              <p className="flex items-center gap-2.5 text-muted-foreground">
                <MapPin className="size-4 text-brand" /> Bengaluru, Karnataka
              </p>
              <p className="flex items-center gap-2.5 text-muted-foreground">
                <Building2 className="size-4 text-brand" /> MoreMart Retail Pvt Ltd
              </p>
            </div>
          </div>

          <div className="card-surface p-6">
            <h2 className="text-sm font-semibold tracking-tight">Activity</h2>
            <div className="mt-5 grid grid-cols-2 gap-4">
              {[
                { l: "Scans run", v: "412", i: ScanLine },
                { l: "Stores covered", v: "18", i: Building2 },
                { l: "Avg. confidence", v: "95.1%", i: Award },
                { l: "Reports shared", v: "76", i: Mail },
              ].map((s) => (
                <div key={s.l} className="rounded-2xl border border-border bg-surface p-4">
                  <s.i className="size-4 text-brand" />
                  <p className="mt-2 text-lg font-semibold tracking-tight">{s.v}</p>
                  <p className="text-xs text-muted-foreground">{s.l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div className="card-surface p-6">
            <h2 className="text-sm font-semibold tracking-tight">Personal information</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fn">First name</Label>
                <Input id="fn" defaultValue="Rahul" className="h-11 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ln">Last name</Label>
                <Input id="ln" defaultValue="Kapoor" className="h-11 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="em">Email</Label>
                <Input id="em" defaultValue="ops@moremart.in" className="h-11 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ph">Phone</Label>
                <Input id="ph" defaultValue="+91 98450 22187" className="h-11 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Input id="role" defaultValue="Head of Retail Operations" className="h-11 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loc">Location</Label>
                <Input id="loc" defaultValue="Bengaluru, Karnataka" className="h-11 rounded-xl" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  rows={3}
                  className="rounded-xl"
                  defaultValue="Leading shelf compliance and category execution across 42 MoreMart stores in South India."
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="subtle" size="sm" className="rounded-xl">
                Discard
              </Button>
              <Button variant="brand" size="sm" className="rounded-xl">
                Save changes
              </Button>
            </div>
          </div>

          <div className="card-surface p-6">
            <h2 className="text-sm font-semibold tracking-tight">Recent audits by you</h2>
            <div className="mt-4 divide-y divide-border">
              {scans.slice(0, 5).map((s) => (
                <div key={s.id} className="flex items-center gap-4 py-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-xs font-medium text-brand">
                    {s.id.slice(-3)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.store}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.aisle} · {s.date}
                    </p>
                  </div>
                  <span className="text-sm text-muted-foreground">{s.products} products</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
