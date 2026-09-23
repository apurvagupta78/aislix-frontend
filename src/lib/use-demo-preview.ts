import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchProfile } from "@/lib/account";
import {
  canUseDemoPreview,
  readDemoPreviewPreference,
  writeDemoPreviewPreference,
} from "@/lib/demo-environment";
import { useIsGuest } from "@/lib/use-is-guest";

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
  const [enabled, setEnabledState] = useState(() => readDemoPreviewPreference());

  const previewDemo = isGuest ? true : eligible && enabled;

  const setPreviewDemo = useCallback(
    (next: boolean) => {
      if (isGuest || !eligible) return;
      writeDemoPreviewPreference(next);
      setEnabledState(next);
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
