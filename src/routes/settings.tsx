import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  Bug,
  Building2,
  KeySquare,
  LifeBuoy,
  Lightbulb,
  LogOut,
  MessageSquare,
  ShieldCheck,
  Store as StoreIcon,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettingsCard } from "@/components/settings/SettingsParts";
import { CompanyPanel } from "@/components/settings/CompanyPanel";
import { TeamManager } from "@/components/settings/TeamManager";
import { NotificationsPanel } from "@/components/settings/NotificationsPanel";
import { SecurityPanel } from "@/components/settings/SecurityPanel";
import { ApiAccessPanel } from "@/components/settings/ApiAccessPanel";
import { AiTrainingPanel } from "@/components/settings/AiTrainingPanel";
import { BrandIntelPanel } from "@/components/settings/BrandIntelPanel";
import { TerritoryPanel } from "@/components/settings/TerritoryPanel";
import { CustomerProfilePanel } from "@/components/settings/CustomerProfilePanel";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Workspace Settings — Aislix" },
      {
        name: "description",
        content:
          "Manage your Aislix workspace: company details, stores, team roles, notifications, security, API keys and support.",
      },
      { property: "og:title", content: "Aislix workspace settings" },
      {
        property: "og:description",
        content: "Company, stores, team, notifications, security and API access for your Aislix workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

const tabs = [
  { value: "company", label: "Company", icon: Building2 },
  { value: "stores", label: "Stores", icon: StoreIcon },
  { value: "team", label: "Team", icon: Users },
  { value: "notifications", label: "Notifications", icon: Bell },
  { value: "security", label: "Security", icon: ShieldCheck },
  { value: "api", label: "API access", icon: KeySquare },
  { value: "support", label: "Support", icon: LifeBuoy },
];

function SettingsPage() {
  return (
    <AppShell
      title="Settings"
      description="Company profile, stores, team access, notifications, security and API keys."
    >
      <Tabs defaultValue="company" className="space-y-5">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-2xl bg-muted/60 p-1.5">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="gap-2 rounded-xl px-3 py-2 text-sm data-[state=active]:shadow-card"
            >
              <tab.icon className="size-4" />
              <span>{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="company" className="mt-0 space-y-4">
          <CustomerProfilePanel />
          <CompanyPanel />
          <BrandIntelPanel />
          <TerritoryPanel />
        </TabsContent>
        <TabsContent value="stores" className="mt-0">
          <StoresRedirectCard />
        </TabsContent>
        <TabsContent value="team" className="mt-0">
          <TeamManager />
        </TabsContent>
        <TabsContent value="notifications" className="mt-0">
          <NotificationsPanel />
        </TabsContent>
        <TabsContent value="security" className="mt-0">
          <SecurityPanel />
        </TabsContent>
        <TabsContent value="api" className="mt-0 space-y-4">
          <ApiAccessPanel />
          <AiTrainingPanel />
        </TabsContent>
        <TabsContent value="support" className="mt-0">
          <SupportPanel />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

const supportLinks = [
  {
    title: "Help center",
    description: "Guides for auditing, reports and shelf metrics.",
    icon: LifeBuoy,
    href: "https://docs.lovable.dev",
    cta: "Open help center",
  },
  {
    title: "Contact support",
    description: "Reach the Aislix retail intelligence team.",
    icon: MessageSquare,
    href: "mailto:support@aislix.com?subject=Aislix%20support%20request",
    cta: "Email support",
  },
  {
    title: "Report a bug",
    description: "Something misdetected or broken? Send details and we'll investigate.",
    icon: Bug,
    href: "mailto:support@aislix.com?subject=Aislix%20bug%20report",
    cta: "Report a bug",
  },
  {
    title: "Feature request",
    description: "Tell us what would make your shelf audits faster.",
    icon: Lightbulb,
    href: "mailto:product@aislix.com?subject=Aislix%20feature%20request",
    cta: "Suggest a feature",
  },
];

function SupportPanel() {
  const navigate = useNavigate();
  return (
    <div className="space-y-4">
      <SettingsCard title="Support" description="Get help or share feedback with the Aislix team." icon={LifeBuoy}>
        <div className="grid gap-3 sm:grid-cols-2">
          {supportLinks.map((link) => (
            <div
              key={link.title}
              className="flex flex-col rounded-2xl border border-border bg-surface p-4 transition-all hover:border-brand/30 hover:shadow-card"
            >
              <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand">
                <link.icon className="size-4" />
              </span>
              <p className="mt-3 text-sm font-medium">{link.title}</p>
              <p className="mt-1 flex-1 text-xs text-muted-foreground">{link.description}</p>
              <Button variant="subtle" size="sm" className="mt-4 w-fit rounded-xl" asChild>
                <a href={link.href} target="_blank" rel="noreferrer">
                  {link.cta}
                </a>
              </Button>
            </div>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard title="Session" description="Sign out of Aislix on this device." icon={LogOut}>
        <Button
          variant="subtle"
          size="sm"
          className="rounded-xl"
          onClick={() => void navigate({ to: "/login" })}
        >
          <LogOut className="size-4" /> Sign out
        </Button>
      </SettingsCard>
    </div>
  );
}

function StoresRedirectCard() {
  return (
    <SettingsCard
      title="Store management"
      description="Stores, shelf health and per-store team access now live in the organization module."
    >
      <p className="text-sm text-muted-foreground">
        Add, edit, archive and audit every retail location — including bulk upload and export — from
        the organization dashboard.
      </p>
      <Button asChild variant="brand" size="sm" className="mt-4 rounded-xl">
        <Link to="/stores">Open organization &amp; stores</Link>
      </Button>
    </SettingsCard>
  );
}
