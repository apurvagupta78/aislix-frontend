/**
 * Installable web app: service worker registration and the browser's install prompt.
 */

import { useEffect, useState } from "react";

const APP_HOSTS = new Set(["aislix.com", "www.aislix.com", "aislix.lovable.app"]);
const DISMISS_KEY = "aislix:install-dismissed-at";
const DISMISS_MS = 14 * 86_400_000;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

export function isStandaloneApp(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Registers the service worker on the live site only (never in editor previews or local dev). */
export function registerAppServiceWorker(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (!APP_HOSTS.has(window.location.hostname)) return;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });

  const register = () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
  };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}

function dismissedRecently(): boolean {
  const at = Number(window.localStorage.getItem(DISMISS_KEY) ?? 0);
  return Number.isFinite(at) && Date.now() - at < DISMISS_MS;
}

export function useInstallPrompt() {
  const [, setTick] = useState(0);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(dismissedRecently());
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const canInstall = Boolean(deferredPrompt) && !isStandaloneApp();

  return {
    canInstall,
    showBanner: canInstall && !dismissed,
    install: async () => {
      const prompt = deferredPrompt;
      if (!prompt) return false;
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      deferredPrompt = null;
      notify();
      return outcome === "accepted";
    },
    dismiss: () => {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
      setDismissed(true);
    },
  };
}
