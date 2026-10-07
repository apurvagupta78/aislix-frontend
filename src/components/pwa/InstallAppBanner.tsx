import { Download, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/lib/pwa";

/** Offers "Install Aislix" when the browser allows it (Android Chrome, desktop Chrome/Edge). */
export function InstallAppBanner() {
  const { showBanner, install, dismiss } = useInstallPrompt();
  if (!showBanner) return null;

  return (
    <div
      role="region"
      aria-label="Install the Aislix app"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-[#D9E2E8] bg-white p-3 shadow-lg sm:inset-x-auto sm:right-4"
    >
      <img src="/icon-192.png" alt="" className="size-10 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#102A43]">Install Aislix</p>
        <p className="text-xs text-[#667085]">Open audits from your home screen with full-screen camera.</p>
      </div>
      <Button
        size="sm"
        variant="brand"
        className="rounded-xl"
        onClick={() => {
          void install();
        }}
      >
        <Download className="size-4" /> Install
      </Button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Not now"
        className="rounded-lg p-1 text-[#667085] hover:bg-[#F4F7F9]"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
