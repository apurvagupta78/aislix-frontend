import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchProfile } from "@/lib/account";
import {
  canUseDemoPreview,
  DEMO_PREVIEW_STORAGE_KEY,
  readDemoPreviewPreference,
  writeDemoPreviewPreference,
} from "@/lib/demo-environment";
import { useIsGuest } from "@/lib/use-is-guest";

const DEMO_PREVIEW_CHANGE_EVENT = "aislix:demo-preview-change";

function subscribeDemoPreference(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === DEMO_PREVIEW_STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(DEMO_PREVIEW_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(DEMO_PREVIEW_CHANGE_EVENT, onChange);
  };
}

/** SSR has no localStorage; hydrate with the same default, then re-render with the stored value. */
function serverDemoPreference(): boolean {
  return true;
}

export function useDemoPreview(_model?: string, _filters?: Record<string, unknown>) {
  const queryClient = useQueryClient();
  const isGuest = useIsGuest();
  const profileQuery = useQuery({
    queryKey: ["demo-preview-profile"],
    queryFn: fetchProfile,
    staleTime: 60_000,
    enabled: !isGuest,
  });

  const eligible = isGuest || canUseDemoPreview(profileQuery.data?.email);
  const enabled = useSyncExternalStore(
    subscribeDemoPreference,
    readDemoPreviewPreference,
    serverDemoPreference,
  );

  const previewDemo = isGuest ? true : eligible && enabled;

  const setPreviewDemo = useCallback(
    (next: boolean) => {
      if (isGuest || !eligible) return;
      writeDemoPreviewPreference(next);
      window.dispatchEvent(new Event(DEMO_PREVIEW_CHANGE_EVENT));
      void queryClient.invalidateQueries({ queryKey: ["control-tower-dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-ops-ai-v6"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-digital-metrics-v2"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-digital-metrics"] });
    },
    [eligible, isGuest, queryClient],
  );

  return useMemo(
    () => ({
      eligible,
      previewDemo,
      setPreviewDemo,
      userEmail: profileQuery.data?.email ?? null,
    }),
    [eligible, previewDemo, profileQuery.data?.email, setPreviewDemo],
  );
}
