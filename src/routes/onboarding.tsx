import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSeatUsage } from "@/hooks/use-seat-usage";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Loader2, Plus, Trash2, UploadCloud } from "lucide-react";

import { SiteFooter } from "@/components/Footer";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { createStore } from "@/lib/account";
import {
  activatePlanogram,
  parsePlanogramCsv,
  savePlanogramDraft,
  toDraftRow,
  SAMPLE_CSV_HEADERS,
} from "@/lib/planogram";
import { inviteUser, userRoleLabels, inviteRoles, type UserRole } from "@/lib/team";
import {
  completeOnboarding,
  fetchOnboardingStatus,
  saveOnboardingProfile,
} from "@/lib/onboarding";
import { fetchAuthUser, isEmailVerifiedServer } from "@/lib/auth-routing";
import {
  CUSTOMER_TYPE_LABELS,
  JOB_TITLES_BY_CUSTOMER,
  inferRoleFamily,
  normalizeCustomerType,
  type CustomerType,
} from "@/lib/customer-context";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your workspace — Aislix" },
      {
        name: "description",
        content:
          "Complete your Aislix first-time setup: profile details, your first store, planogram and team access.",
      },
      { property: "og:title", content: "Set up your workspace — Aislix" },
      {
        property: "og:description",
        content: "Four quick steps to get your shelf intelligence workspace ready.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OnboardingPage,
});

const STEPS = [
  { title: "Your details", hint: "Tell us who you are" },
  { title: "First store", hint: "Where you audit shelves" },
  { title: "Planogram", hint: "Set your planogram" },
  { title: "Your team", hint: "Invite your team" },
] as const;


type InviteDraft = { email: string; role: UserRole };

function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);

  // Gate first: only a signed-in, email-verified user may see the wizard.
  const gateQuery = useQuery({
    queryKey: ["onboarding-gate"],
    queryFn: async () => {
      const user = await fetchAuthUser();
      if (!user) return { signedIn: false, verified: false };
      return { signedIn: true, verified: await isEmailVerifiedServer() };
    },
    retry: false,
    staleTime: 0,
  });
  const allowed = gateQuery.data?.signedIn === true && gateQuery.data.verified === true;

  useEffect(() => {
    if (!gateQuery.data) return;
    if (!gateQuery.data.signedIn) {
      void navigate({ to: "/login", replace: true });
      return;
    }
    if (!gateQuery.data.verified) void navigate({ to: "/verify-email", replace: true });
  }, [gateQuery.data, navigate]);

  const statusQuery = useQuery({
    queryKey: ["onboarding-status"],
    queryFn: () => fetchOnboardingStatus(),
    retry: false,
    staleTime: 0,
    enabled: allowed,
  });


  // Entry-only guard: if setup was already finished before this page mounted,
  // send the user on. Never re-checked while the wizard is open.
  const entryChecked = useRef(false);
  useEffect(() => {
    if (!statusQuery.data || entryChecked.current) return;
    entryChecked.current = true;
    if (statusQuery.data.completed) void navigate({ to: "/dashboard", replace: true });
  }, [statusQuery.data, navigate]);

  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [customerType, setCustomerType] = useState<CustomerType>("supermarket");
  useEffect(() => {
    const d = statusQuery.data;
    if (!d) return;
    setFullName((prev) => prev || d.full_name);
    setJobTitle((prev) => prev || d.job_title);
    setCompanyName((prev) => prev || d.company_name);
    if (d.customer_type) setCustomerType(d.customer_type);
  }, [statusQuery.data]);

  const jobTitleOptions = JOB_TITLES_BY_CUSTOMER[customerType] ?? [];

  const [storeName, setStoreName] = useState("");
  const [storeCode, setStoreCode] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [storeCity, setStoreCity] = useState("");
  const [storeState, setStoreState] = useState("");
  const [storeCountry, setStoreCountry] = useState("India");
  const [storeId, setStoreId] = useState<string | null>(null);

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [invites, setInvites] = useState<InviteDraft[]>([{ email: "", role: "member" }]);

  const finishedRef = useRef(false);
  const finish = useMutation({
    mutationFn: () => completeOnboarding(),
    onSuccess: () => {
      finishedRef.current = true;
      queryClient.removeQueries({ queryKey: ["onboarding-status"] });
      void navigate({ to: "/dashboard", replace: true });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Could not finish setup. Please try again."),
  });


  const profileStep = useMutation({
    mutationFn: () =>
      saveOnboardingProfile({
        full_name: fullName,
        job_title: jobTitle,
        company_name: companyName,
        customer_type: customerType,
        role_family: inferRoleFamily(jobTitle, customerType),
      }),
    onSuccess: () => setStep(1),
    onError: (error: Error) => toast.error(error.message),
  });

  const storeStep = useMutation({
    mutationFn: async () => {
      const store = await createStore({
        name: storeName.trim(),
        code: storeCode.trim(),
        address: storeAddress.trim(),
        city: storeCity.trim(),
        state: storeState.trim(),
        country: storeCountry.trim(),
        manager_name: "",
      });
      return store.id;
    },
    onSuccess: (id) => {
      setStoreId(id);
      toast.success("Store created");
      setStep(2);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const planogramStep = useMutation({
    mutationFn: async () => {
      if (!csvFile || !storeId) return 0;
      const parsed = await parsePlanogramCsv(csvFile);
      const rows = parsed.rows
        .filter((row) => row.valid && row.data)
        .map((row) => toDraftRow(row.data));
      if (!rows.length) throw new Error("No valid rows found in that CSV.");
      const version = await savePlanogramDraft({
        storeId,
        rows,
        sourceType: "csv",
        sourceFilename: csvFile.name,
      });
      await activatePlanogram({ storeId, versionId: version.id, rowCount: rows.length });
      return rows.length;
    },
    onSuccess: (count) => {
      if (count) toast.success(`${count} planogram products activated`);
      setStep(3);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const seats = useSeatUsage();

  const teamStep = useMutation({
    mutationFn: async () => {
      const valid = invites.filter((invite) => invite.email.trim());
      for (const invite of valid) {
        await inviteUser({
          name: "",
          email: invite.email.trim(),
          role: invite.role,
          store_ids: storeId ? [storeId] : [],
        });
      }
      return valid.length;
    },
    onSuccess: (count) => {
      if (count) toast.success(`${count} invitation${count > 1 ? "s" : ""} sent`);
      finish.mutate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const busy =
    profileStep.isPending ||
    storeStep.isPending ||
    planogramStep.isPending ||
    teamStep.isPending ||
    finish.isPending;

  if (!allowed || statusQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-5">
          <Logo />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Set up your workspace
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Complete your details and store setup, then add optional planogram and team information.
        </p>

        <ol className="mt-7 grid gap-3 sm:grid-cols-4">
          {STEPS.map((s, index) => (
            <li
              key={s.title}
              className={cn(
                "rounded-xl border p-3",
                index === step
                  ? "border-brand bg-brand-soft/50"
                  : index < step
                    ? "border-border bg-card"
                    : "border-border bg-card opacity-60",
              )}
            >
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                {index < step ? (
                  <Check className="size-3.5 text-brand" />
                ) : (
                  <span className="text-xs text-muted-foreground">{index + 1}.</span>
                )}
                {s.title}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{s.hint}</p>
            </li>
          ))}
        </ol>

        <div className="mt-7 rounded-2xl border border-border bg-card p-6">
          {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="full_name">Full name</Label>
                <Input
                  id="full_name"
                  value={fullName}
                  maxLength={100}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Apurv Sharma"
                  className="mt-1.5"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="customer_type">Business type</Label>
                <Select
                  value={customerType}
                  onValueChange={(value) => {
                    const next = normalizeCustomerType(value);
                    setCustomerType(next);
                    setJobTitle("");
                  }}
                >
                  <SelectTrigger id="customer_type" className="mt-1.5">
                    <SelectValue placeholder="Select business type" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(CUSTOMER_TYPE_LABELS) as [CustomerType, string][]).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="job_title">Role / job title</Label>
                <Select value={jobTitle || undefined} onValueChange={setJobTitle}>
                  <SelectTrigger id="job_title" className="mt-1.5">
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobTitleOptions.map((title) => (
                      <SelectItem key={title} value={title}>
                        {title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="company_name">Company</Label>
                <Input
                  id="company_name"
                  value={companyName}
                  maxLength={120}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Aislix Retail Pvt Ltd"
                  className="mt-1.5"
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="store_name">
                  Store name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="store_name"
                  value={storeName}
                  maxLength={120}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="MG Road Supermarket"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="store_code">Store code (optional)</Label>
                <Input
                  id="store_code"
                  value={storeCode}
                  maxLength={40}
                  onChange={(e) => setStoreCode(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="store_city">City (optional)</Label>
                <Input
                  id="store_city"
                  value={storeCity}
                  maxLength={80}
                  onChange={(e) => setStoreCity(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="store_state">State (optional)</Label>
                <Input
                  id="store_state"
                  value={storeState}
                  maxLength={80}
                  onChange={(e) => setStoreState(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="store_country">Country (optional)</Label>
                <Input
                  id="store_country"
                  value={storeCountry}
                  maxLength={80}
                  onChange={(e) => setStoreCountry(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="store_address">Address (optional)</Label>
                <Input
                  id="store_address"
                  value={storeAddress}
                  maxLength={200}
                  onChange={(e) => setStoreAddress(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                A planogram lists the products, brands and expected facings for each shelf. Upload a
                CSV now to unlock compliance scoring, or skip for now from Planogram management.
              </p>
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface px-6 py-8 text-center">
                <UploadCloud className="size-5 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  {csvFile ? csvFile.name : "Upload planogram CSV"}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {SAMPLE_CSV_HEADERS}
                </span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {!storeId && (
                <p className="text-xs text-muted-foreground">
                  Create a store first to attach a planogram.
                </p>
              )}
            </div>
          )}

          {step === 3 && seats.singleSeat && (
            <div className="mx-auto max-w-md space-y-4 rounded-2xl border border-border bg-muted/30 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Need to add team members? Upgrade to the <strong>Growth plan</strong> or a higher
                plan to invite additional users.
              </p>
              <Button asChild variant="brand" size="lg" className="rounded-xl">
                <Link to="/pricing">View plans &amp; upgrade</Link>
              </Button>
              <p className="text-xs text-muted-foreground">
                Growth includes up to 3 users · Professional up to 5 · Enterprise unlimited
              </p>
            </div>
          )}


          {step === 3 && !seats.singleSeat && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Invite the people who will run scans. You can always add more from Team.
                {seats.remaining !== null ? ` ${seats.remaining} seat${seats.remaining === 1 ? "" : "s"} remaining.` : ""}
              </p>
              <div className="space-y-2">
                {invites.map((invite, index) => (
                  <div key={index} className="flex flex-wrap items-center gap-2">
                    <Input
                      value={invite.email}
                      type="email"
                      maxLength={255}
                      placeholder="teammate@company.com"
                      onChange={(e) =>
                        setInvites((prev) =>
                          prev.map((row, i) =>
                            i === index ? { ...row, email: e.target.value } : row,
                          ),
                        )
                      }
                      className="min-w-56 flex-1"
                    />
                    <Select
                      value={invite.role}
                      onValueChange={(value) =>
                        setInvites((prev) =>
                          prev.map((row, i) =>
                            i === index ? { ...row, role: value as UserRole } : row,
                          ),
                        )
                      }
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {inviteRoles.map((role) => (
                          <SelectItem key={role} value={role}>
                            {userRoleLabels[role]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remove invite"
                      onClick={() =>
                        setInvites((prev) =>
                          prev.length > 1 ? prev.filter((_, i) => i !== index) : prev,
                        )
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInvites((prev) => [...prev, { email: "", role: "member" }])}
              >
                <Plus className="mr-1.5 size-4" /> Add another
              </Button>
            </div>
          )}

          <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
            <Button
              variant="ghost"
              size="sm"
              disabled={step === 0 || busy}
              onClick={() => setStep((prev) => Math.max(0, prev - 1))}
            >
              <ArrowLeft className="mr-1.5 size-4" /> Back
            </Button>
            <div className="flex items-center gap-2">
              {step === 2 && (
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => setStep(3)}>
                  Skip for now
                </Button>
              )}
              {step === 3 && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => setInvites([{ email: "", role: "member" }])}
                >
                  Skip for now
                </Button>
              )}
              <Button
                variant="brand"
                disabled={
                  busy ||
                  (step === 0 && !fullName.trim()) ||
                  (step === 1 && !storeName.trim()) ||
                  (step === 2 && !csvFile)
                }
                onClick={() => {
                  if (step === 0) return profileStep.mutate();
                  if (step === 1) return storeStep.mutate();
                  if (step === 2) return planogramStep.mutate();
                  return teamStep.mutate();
                }}
              >
                {busy && <Loader2 className="mr-1.5 size-4 animate-spin" />}
                {step === 3 ? "Finish setup" : "Continue"}
                {step < 3 && !busy && <ArrowRight className="ml-1.5 size-4" />}
              </Button>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
