import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Building2, ImageUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorState } from "@/components/States";
import { Field, FormSkeleton, SaveBar, SettingsCard } from "@/components/settings/SettingsParts";
import {
  currencyOptions,
  dateFormatOptions,
  fetchCompany,
  languageOptions,
  updateCompany,
  uploadCompanyLogo,
  type CompanySettings,
} from "@/lib/account";

const empty: CompanySettings = {
  company_name: "",
  logo_url: null,
  gst_number: "",
  address: "",
  currency: "",
  date_format: "",
  language: "",
};

export function CompanyPanel() {
  const companyQuery = useQuery({
    queryKey: ["account", "company"],
    queryFn: ({ signal }) => fetchCompany(signal),
    retry: false,
  });

  const [form, setForm] = useState<CompanySettings>(empty);
  const [logo, setLogo] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (companyQuery.data) {
      setForm({ ...empty, ...companyQuery.data });
      setLogo(companyQuery.data.logo_url ?? null);
    }
  }, [companyQuery.data]);

  const dirty = useMemo(() => {
    const source = companyQuery.data ? { ...empty, ...companyQuery.data } : empty;
    return JSON.stringify(source) !== JSON.stringify(form);
  }, [form, companyQuery.data]);

  const save = useMutation({
    mutationFn: () => updateCompany(form),
    onSuccess: (data) => {
      setForm({ ...empty, ...data });
      setSaved(true);
      toast.success("Company settings saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const logoUpload = useMutation({
    mutationFn: (file: File) => uploadCompanyLogo(file),
    onSuccess: (data) => {
      setLogo(data.logo_url);
      toast.success("Company logo updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const set = <K extends keyof CompanySettings>(key: K, value: CompanySettings[K]) => {
    setSaved(false);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onPick = (file: File | undefined) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/svg+xml", "image/webp"].includes(file.type)) {
      toast.error("Use a JPG, PNG, WEBP or SVG logo.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo must be 5 MB or smaller.");
      return;
    }
    setLogo(URL.createObjectURL(file));
    logoUpload.mutate(file);
  };

  return (
    <SettingsCard
      title="Company settings"
      description="Appears on audit PDFs, GST invoices and shared reports."
      icon={Building2}
    >
      {companyQuery.isLoading ? (
        <FormSkeleton rows={3} />
      ) : companyQuery.isError ? (
        <ErrorState
          title="Couldn't load company settings"
          description={(companyQuery.error as Error).message}
          onRetry={() => void companyQuery.refetch()}
        />
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-surface p-4">
            <div className="grid h-16 w-28 place-items-center overflow-hidden rounded-xl border border-border bg-background">
              {logo ? (
                <img src={logo} alt="Company logo" className="h-full w-full object-contain p-2" />
              ) : (
                <ImageUp className="size-5 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">Company logo</p>
              <p className="text-xs text-muted-foreground">PNG, SVG, JPG or WEBP up to 5 MB.</p>
            </div>
            <Button
              type="button"
              variant="subtle"
              size="sm"
              className="ml-auto rounded-xl"
              onClick={() => fileRef.current?.click()}
              disabled={logoUpload.isPending}
            >
              {logoUpload.isPending ? <Loader2 className="size-4 animate-spin" /> : <ImageUp className="size-4" />}
              Upload logo
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(event) => onPick(event.target.files?.[0])}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Company name" htmlFor="company">
              <Input
                id="company"
                required
                maxLength={120}
                value={form.company_name}
                onChange={(event) => set("company_name", event.target.value)}
              />
            </Field>
            <Field label="GST number" htmlFor="gstin" hint="Optional — added to tax invoices.">
              <Input
                id="gstin"
                maxLength={15}
                value={form.gst_number ?? ""}
                placeholder="22AAAAA0000A1Z5"
                onChange={(event) => set("gst_number", event.target.value.toUpperCase())}
              />
            </Field>
            <Field label="Business address" htmlFor="address" className="sm:col-span-2">
              <Textarea
                id="address"
                rows={3}
                maxLength={400}
                value={form.address}
                onChange={(event) => set("address", event.target.value)}
              />
            </Field>
            <Field label="Preferred currency">
              <Select value={form.currency} onValueChange={(value) => set("currency", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {currencyOptions.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Preferred date format">
              <Select value={form.date_format} onValueChange={(value) => set("date_format", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  {dateFormatOptions.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Preferred language">
              <Select value={form.language} onValueChange={(value) => set("language", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  {languageOptions.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
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
            onReset={() => setForm(companyQuery.data ? { ...empty, ...companyQuery.data } : empty)}
            error={save.isError ? (save.error as Error).message : null}
          />
        </form>
      )}
    </SettingsCard>
  );
}
