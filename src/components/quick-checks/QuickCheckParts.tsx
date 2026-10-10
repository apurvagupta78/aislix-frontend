import type { ReactNode, RefObject } from "react";
import { useQuery } from "@tanstack/react-query";
import { Camera } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { requireOrgId } from "@/lib/db/context";
import { photoExtension, shrinkPhoto } from "@/lib/photo/shrink-photo";
import { cn } from "@/lib/utils";

type StoreOption = { id: string; name: string; city: string | null };

export type QuickCheckRowBase = {
  id: string;
  storage_path: string;
  created_at: string;
  stores: { name: string | null; city: string | null } | null;
};

export function useQuickCheckStores() {
  return useQuery({
    queryKey: ["quick-check-stores"],
    queryFn: async (): Promise<StoreOption[]> => {
      const orgId = await requireOrgId();
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, city")
        .eq("org_id", orgId)
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return (data ?? []) as StoreOption[];
    },
  });
}

/**
 * Quick checks are not kept as a history for users: the page only shows the check just run.
 * Rows stay in the backend table for usage reporting.
 */
export function useQuickCheckResult<T extends QuickCheckRowBase>(table: string, columns: string, id: string | null) {
  return useQuery({
    queryKey: ["quick-check", table, id],
    enabled: Boolean(id),
    queryFn: async (): Promise<T & { photoUrl: string | null }> => {
      const { data, error } = await supabase
        .from(table as never)
        .select(`id, storage_path, created_at, stores(name, city), ${columns}`)
        .eq("id", id!)
        .single();
      if (error || !data) throw error ?? new Error("Check not found.");
      const row = data as unknown as T;
      const { data: signed } = await supabase.storage.from("audit-evidence").createSignedUrl(row.storage_path, 3600);
      return { ...row, photoUrl: signed?.signedUrl ?? null };
    },
  });
}

export const QUICK_CHECK_DISCLAIMER =
  "AI-generated insights may contain errors. Please verify all results before making decisions. These are quick analyses and will not be saved in your audit history.";

export function QuickCheckDisclaimer() {
  return <p className="border-t border-[#EEF1F4] pt-3 text-xs text-[#667085]">{QUICK_CHECK_DISCLAIMER}</p>;
}

/** Placeholder, loading and error states for the result panel before / while a check runs. */
export function QuickCheckResultSlot<T>({
  id,
  query,
  running,
  emptyTitle,
  emptyBody,
  children,
}: {
  id: string | null;
  query: { isPending: boolean; isError: boolean; data: T | undefined };
  running: boolean;
  emptyTitle: string;
  emptyBody: string;
  children: (row: T) => ReactNode;
}) {
  if (running) {
    return <div className="h-48 animate-pulse rounded-2xl border border-[#D9E2E8] bg-[#F4F7F9]" aria-busy="true" />;
  }
  if (!id) return <QuickCheckNotice title={emptyTitle} body={emptyBody} />;
  if (query.isPending) {
    return <div className="h-48 animate-pulse rounded-2xl border border-[#D9E2E8] bg-[#F4F7F9]" aria-busy="true" />;
  }
  if (query.isError || !query.data) {
    return <QuickCheckNotice title="Result unavailable" body="Refresh the page and run the check again." />;
  }
  return <>{children(query.data)}</>;
}

export async function uploadQuickCheckPhoto(file: File, folder: string): Promise<{ orgId: string; path: string }> {
  const orgId = await requireOrgId();
  const photo = await shrinkPhoto(file);
  const path = `${orgId}/${folder}/${crypto.randomUUID()}.${photoExtension(photo)}`;
  const { error } = await supabase.storage
    .from("audit-evidence")
    .upload(path, photo, { upsert: false, contentType: photo.type || "image/jpeg" });
  if (error) throw new Error("Could not upload the photo. Try again.");
  return { orgId, path };
}

export function StorePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const stores = useQuickCheckStores();
  return (
    <Select value={value} onValueChange={onChange} disabled={!stores.data?.length}>
      <SelectTrigger className="h-10 rounded-xl" aria-label="Store">
        <SelectValue
          placeholder={stores.isPending ? "Loading stores…" : stores.data?.length ? "Choose a store" : "No stores in your access"}
        />
      </SelectTrigger>
      <SelectContent>
        {(stores.data ?? []).map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.city && !s.name.toLowerCase().includes(s.city.toLowerCase()) ? `${s.name} · ${s.city}` : s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function PhotoPicker({
  file,
  onChange,
  inputRef,
  placeholder,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  placeholder: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-3 py-3 text-sm transition-colors duration-150",
        file ? "border-[#04203F] bg-white text-[#04203F]" : "border-[#D9E2E8] text-[#667085] hover:bg-[#F4F7F9]",
      )}
    >
      <Camera className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 truncate">{file ? file.name : placeholder}</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="sr-only"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

export function formatCheckTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function CheckPhoto({ url, alt }: { url: string | null; alt: string }) {
  return url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block">
      <img src={url} alt={alt} className="aspect-[3/4] w-full rounded-xl border border-[#D9E2E8] object-cover" />
    </a>
  ) : (
    <div className="flex aspect-[3/4] items-center justify-center rounded-xl bg-[#EEF1F4] text-xs text-[#667085]">
      Photo unavailable
    </div>
  );
}

export function VerdictPill({ label, tone }: { label: string; tone: "good" | "bad" | "neutral" }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        tone === "good" && "border-[#79E2A8] bg-[#79E2A8]/15 text-[#04203F]",
        tone === "bad" && "border-[#F6CFDC] bg-[#FFEAF1] text-[#04203F]",
        tone === "neutral" && "border-[#D9E2E8] bg-[#EEF1F4] text-[#667085]",
      )}
    >
      {label}
    </span>
  );
}

export function QuickCheckNotice({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-[#D9E2E8] bg-white px-4 py-6">
      <p className="text-sm font-semibold text-[#04203F]">{title}</p>
      <p className="mt-1 text-sm text-[#667085]">{body}</p>
    </div>
  );
}
