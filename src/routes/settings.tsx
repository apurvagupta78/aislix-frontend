import { createFileRoute } from "@tanstack/react-router";
import { Building2, Bell, ShieldCheck, Users, Plug, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Aislix Workspace" },
      {
        name: "description",
        content:
          "Configure your Aislix workspace: organisation details, scan thresholds, alerts, team access and integrations.",
      },
      { property: "og:title", content: "Aislix workspace settings" },
      { property: "og:description", content: "Organisation, detection, alert and team configuration." },
    ],
  }),
  component: SettingsPage,
});

const team = [
  { name: "Rahul Kapoor", email: "ops@moremart.in", role: "Admin" },
  { name: "Meera Iyer", email: "meera@moremart.in", role: "Manager" },
  { name: "Arjun Rao", email: "arjun@moremart.in", role: "Field auditor" },
  { name: "Priya Nair", email: "priya@moremart.in", role: "Analyst" },
];

const integrations = [
  { name: "SAP Retail", desc: "Sync SKU master and stock levels", on: true },
  { name: "Slack", desc: "Post low-stock alerts to #retail-ops", on: true },
  { name: "Google Drive", desc: "Archive PDF audit reports", on: false },
  { name: "Power BI", desc: "Stream shelf metrics to dashboards", on: false },
];

function Card({ title, icon: Icon, children }: { title: string; icon: typeof Bell; children: React.ReactNode }) {
  return (
    <div className="card-surface p-6">
      <h2 className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight">
        <Icon className="size-4 text-brand" /> {title}
      </h2>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function SettingsPage() {
  return (
    <AppShell title="Settings" description="Manage your workspace, detection thresholds and team access.">
      <Tabs defaultValue="general">
        <TabsList className="rounded-xl">
          <TabsTrigger value="general" className="rounded-lg">General</TabsTrigger>
          <TabsTrigger value="detection" className="rounded-lg">Detection</TabsTrigger>
          <TabsTrigger value="notifications" className="rounded-lg">Notifications</TabsTrigger>
          <TabsTrigger value="team" className="rounded-lg">Team</TabsTrigger>
          <TabsTrigger value="integrations" className="rounded-lg">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-5 space-y-4">
          <Card title="Organisation" icon={Building2}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="org">Organisation name</Label>
                <Input id="org" defaultValue="MoreMart Retail Pvt Ltd" className="h-11 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gst">GSTIN</Label>
                <Input id="gst" defaultValue="29ABCDE1234F1Z5" className="h-11 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tz">Timezone</Label>
                <Select defaultValue="ist">
                  <SelectTrigger id="tz" className="h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ist">Asia/Kolkata (IST)</SelectItem>
                    <SelectItem value="gst">Asia/Dubai (GST)</SelectItem>
                    <SelectItem value="utc">UTC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cur">Currency</Label>
                <Select defaultValue="inr">
                  <SelectTrigger id="cur" className="h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inr">INR — ₹</SelectItem>
                    <SelectItem value="usd">USD — $</SelectItem>
                    <SelectItem value="aed">AED — د.إ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button variant="brand" size="sm" className="rounded-xl">
                Save organisation
              </Button>
            </div>
          </Card>

          <Card title="Danger zone" icon={Trash2}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Delete workspace</p>
                <p className="text-xs text-muted-foreground">
                  Permanently removes all scans, reports and store data.
                </p>
              </div>
              <Button variant="destructive" size="sm" className="rounded-xl">
                Delete workspace
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="detection" className="mt-5">
          <Card title="Detection thresholds" icon={ShieldCheck}>
            <div className="space-y-8">
              <div>
                <div className="flex justify-between text-sm">
                  <Label>Minimum AI confidence to accept a detection</Label>
                  <span className="font-medium text-brand">88%</span>
                </div>
                <Slider defaultValue={[88]} max={100} step={1} className="mt-4" />
              </div>
              <div>
                <div className="flex justify-between text-sm">
                  <Label>Low-stock facing threshold</Label>
                  <span className="font-medium text-brand">4 facings</span>
                </div>
                <Slider defaultValue={[4]} max={20} step={1} className="mt-4" />
              </div>
              <Separator />
              {[
                { l: "Auto-reject blurry images", d: "Ask the field rep to re-shoot", on: true },
                { l: "Require GPS match", d: "Reject scans outside the store geofence", on: true },
                { l: "Detect competitor brands", d: "Include non-portfolio SKUs in results", on: true },
                { l: "Price tag OCR by default", d: "Read MRP tags on every scan", on: false },
              ].map((o) => (
                <div key={o.l} className="flex items-start gap-3">
                  <Switch defaultChecked={o.on} className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{o.l}</p>
                    <p className="text-xs text-muted-foreground">{o.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-5">
          <Card title="Notifications" icon={Bell}>
            <div className="space-y-5">
              {[
                { l: "Scan completed", d: "Email when an audit finishes processing", on: true },
                { l: "Critical out-of-stock", d: "Instant alert when a facing hits zero", on: true },
                { l: "Shelf health drop", d: "Notify when a store drops below 70", on: true },
                { l: "Weekly digest", d: "Monday summary of all store performance", on: true },
                { l: "Product updates", d: "New Aislix features and model releases", on: false },
              ].map((o) => (
                <div key={o.l} className="flex items-start gap-3">
                  <Switch defaultChecked={o.on} className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{o.l}</p>
                    <p className="text-xs text-muted-foreground">{o.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="mt-5">
          <Card title="Team members" icon={Users}>
            <div className="divide-y divide-border">
              {team.map((m) => (
                <div key={m.email} className="flex items-center gap-4 py-3 first:pt-0">
                  <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-xs font-medium text-brand">
                    {m.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                  </div>
                  <Badge variant="secondary" className="rounded-full bg-muted">
                    {m.role}
                  </Badge>
                  <Button variant="ghost" size="sm" className="rounded-lg">
                    Manage
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-center gap-3">
              <Input placeholder="teammate@company.com" className="h-11 rounded-xl" />
              <Button variant="brand" className="rounded-xl">
                Invite
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="mt-5">
          <Card title="Integrations" icon={Plug}>
            <div className="grid gap-4 sm:grid-cols-2">
              {integrations.map((i) => (
                <div
                  key={i.name}
                  className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-5"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">{i.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{i.desc}</p>
                  </div>
                  <Switch defaultChecked={i.on} />
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
