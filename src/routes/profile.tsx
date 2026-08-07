import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Camera,
  Download,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  Sun,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ErrorState } from "@/components/States";
import { Field, FormSkeleton, SaveBar, SettingsCard } from "@/components/settings/SettingsParts";
import {
  countryOptions,
  deleteAccount,
  exportAccountData,
  fetchProfile,
  timezoneOptions,
  updateProfile,
  uploadAvatar,
  type UserProfile,
} from "@/lib/account";
import { useTheme, type ThemeChoice } from "@/lib/theme";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your Profile — Aislix Account" },
      {
        name: "description",
        content:
          "Manage your Aislix profile: name, company, contact details, job title, country, time zone, appearance and account data.",
      },
      { property: "og:title", content: "Your Aislix profile" },
      {
        property: "og:description",
        content: "Personal details, appearance preferences and account management for Aislix.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

const emptyProfile: UserProfile = {
  full_name: "",
  company_name: "",
  email: "",
  mobile: "",
  job_title: "",
  country: "",
  timezone: "",
  avatar_url: null,
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "—";
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function ProfilePage() {
  const navigate = useNavigate();
  const profileQuery = useQuery({
    queryKey: ["account", "profile"],
    queryFn: ({ signal }) => fetchProfile(signal),
    retry: false,
  });

  const [form, setForm] = useState<UserProfile>(emptyProfile);
  const [saved, setSaved] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profileQuery.data) {
      setForm({ ...emptyProfile, ...profileQuery.data });
      setAvatarPreview(profileQuery.data.avatar_url ?? null);
    }
  }, [profileQuery.data]);

  const dirty = useMemo(() => {
    const source = profileQuery.data ? { ...emptyProfile, ...profileQuery.data } : emptyProfile;
    return JSON.stringify(source) !== JSON.stringify(form);
  }, [form, profileQuery.data]);

  const save = useMutation({
    mutationFn: (input: UserProfile) => updateProfile(input),
    onSuccess: (data) => {
      setForm({ ...emptyProfile, ...data });
      setSaved(true);
      toast.success("Profile updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const avatar = useMutation({
    mutationFn: (file: File) => uploadAvatar(file),
    onSuccess: (data) => {
      setAvatarPreview(data.avatar_url);
      toast.success("Profile photo updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const dataExport = useMutation({
    mutationFn: exportAccountData,
    onSuccess: (data) => {
      if (data.download_url) window.open(data.download_url, "_blank", "noopener");
      else toast.success("Export queued — we'll email you the download link.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removal = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      toast.success("Account deletion requested");
      void navigate({ to: "/" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const set = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => {
    setSaved(false);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onPickAvatar = (file: File | undefined) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Use a JPG, PNG or WEBP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be 5 MB or smaller.");
      return;
    }
    setAvatarPreview(URL.createObjectURL(file));
    avatar.mutate(file);
  };

  return (
    <AppShell title="Profile" description="Your personal details, appearance and account controls.">
      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          <SettingsCard title="Profile photo" description="JPG, PNG or WEBP up to 5 MB." icon={Camera}>
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <Avatar className="size-24">
                  {avatarPreview && <AvatarImage src={avatarPreview} alt="Profile photo" />}
                  <AvatarFallback className="bg-brand-soft text-xl font-semibold text-brand">
                    {initials(form.full_name)}
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  aria-label="Upload profile photo"
                  className="absolute -bottom-1 -right-1 grid size-9 place-items-center rounded-full bg-brand text-brand-foreground shadow-card transition-transform hover:scale-105"
                >
                  {avatar.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Camera className="size-4" />
                  )}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => onPickAvatar(event.target.files?.[0])}
                />
              </div>
              <p className="mt-4 text-sm font-semibold tracking-tight">
                {form.full_name || "Your name"}
              </p>
              <p className="text-xs text-muted-foreground">{form.job_title || "Job title"}</p>
              <Button
                type="button"
                variant="subtle"
                size="sm"
                className="mt-4 rounded-xl"
                onClick={() => fileRef.current?.click()}
                disabled={avatar.isPending}
              >
                Upload new photo
              </Button>
            </div>
          </SettingsCard>

          <AppearanceCard />
          <AccountCard
            onExport={() => dataExport.mutate()}
            exporting={dataExport.isPending}
            onDelete={() => removal.mutate()}
            deleting={removal.isPending}
            onSignOut={() => void navigate({ to: "/login" })}
          />
        </div>

        <SettingsCard
          title="Personal information"
          description="Used across audit reports, invitations and email notifications."
          icon={User}
        >
          {profileQuery.isLoading ? (
            <FormSkeleton rows={4} />
          ) : profileQuery.isError ? (
            <ErrorState
              title="Couldn't load your profile"
              description={(profileQuery.error as Error).message}
              onRetry={() => void profileQuery.refetch()}
            />
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                save.mutate(form);
              }}
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Full name" htmlFor="full_name">
                  <Input
                    id="full_name"
                    value={form.full_name}
                    required
                    maxLength={100}
                    onChange={(e) => set("full_name", e.target.value)}
                  />
                </Field>
                <Field label="Company name" htmlFor="company_name">
                  <Input
                    id="company_name"
                    value={form.company_name}
                    maxLength={120}
                    onChange={(e) => set("company_name", e.target.value)}
                  />
                </Field>
                <Field label="Email address" htmlFor="email" hint="Used for sign-in and report delivery.">
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    required
                    maxLength={255}
                    onChange={(e) => set("email", e.target.value)}
                  />
                </Field>
                <Field label="Mobile number" htmlFor="mobile">
                  <Input
                    id="mobile"
                    type="tel"
                    inputMode="tel"
                    value={form.mobile}
                    maxLength={20}
                    placeholder="+91 ..."
                    onChange={(e) => set("mobile", e.target.value)}
                  />
                </Field>
                <Field label="Job title" htmlFor="job_title">
                  <Input
                    id="job_title"
                    value={form.job_title}
                    maxLength={80}
                    onChange={(e) => set("job_title", e.target.value)}
                  />
                </Field>
                <Field label="Country">
                  <Select value={form.country || undefined} onValueChange={(v) => set("country", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      {countryOptions.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Time zone" hint="Scan timestamps and scheduled reports use this zone.">
                  <Select value={form.timezone || undefined} onValueChange={(v) => set("timezone", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select time zone" />
                    </SelectTrigger>
                    <SelectContent>
                      {timezoneOptions.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <SaveBar
                dirty={dirty}
                saving={save.isPending}
                saved={saved}
                onReset={() =>
                  setForm(profileQuery.data ? { ...emptyProfile, ...profileQuery.data } : emptyProfile)
                }
                error={save.isError ? (save.error as Error).message : null}
              />
            </form>
          )}
        </SettingsCard>
      </div>
    </AppShell>
  );
}

const themeOptions: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

function AppearanceCard() {
  const { theme, setTheme } = useTheme();
  return (
    <SettingsCard title="Appearance" description="Applies to this browser." icon={Sun}>
      <div className="grid grid-cols-3 gap-2">
        {themeOptions.map((option) => {
          const active = theme === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setTheme(option.value)}
              aria-pressed={active}
              className={`flex flex-col items-center gap-2 rounded-2xl border px-2 py-4 text-xs font-medium transition-all ${
                active
                  ? "border-brand bg-brand-soft text-brand shadow-card"
                  : "border-border text-muted-foreground hover:border-brand/40 hover:text-foreground"
              }`}
            >
              <option.icon className="size-4" />
              {option.label}
            </button>
          );
        })}
      </div>
    </SettingsCard>
  );
}

function AccountCard({
  onExport,
  exporting,
  onDelete,
  deleting,
  onSignOut,
}: {
  onExport: () => void;
  exporting: boolean;
  onDelete: () => void;
  deleting: boolean;
  onSignOut: () => void;
}) {
  return (
    <SettingsCard title="Account" description="Export your data or close your account." icon={Download}>
      <div className="space-y-2.5">
        <Button
          type="button"
          variant="subtle"
          size="sm"
          className="w-full justify-start rounded-xl"
          onClick={onExport}
          disabled={exporting}
        >
          {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Export account data
        </Button>
        <Button
          type="button"
          variant="subtle"
          size="sm"
          className="w-full justify-start rounded-xl"
          onClick={onSignOut}
        >
          <LogOut className="size-4" /> Sign out
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-4" /> Delete account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your Aislix account?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes your profile, stores, scan history and reports. This action cannot
                be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={onDelete}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete account
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </SettingsCard>
  );
}
