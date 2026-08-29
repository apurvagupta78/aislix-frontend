/** Tiny in-page bus so nav/hero/mobile CTAs can drive the #demo section. */
const FOCUS_EVENT = "aislix:landing-focus-upload";

export function scrollToDemo(focusUpload = true) {
  if (typeof window === "undefined") return;
  document.getElementById("demo")?.scrollIntoView({ behavior: "smooth", block: "start" });
  if (focusUpload) {
    window.setTimeout(() => window.dispatchEvent(new Event(FOCUS_EVENT)), 450);
  }
}

export function onFocusUpload(handler: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(FOCUS_EVENT, handler);
  return () => window.removeEventListener(FOCUS_EVENT, handler);
}

export function scrollToLeadGate() {
  if (typeof window === "undefined") return;
  document.getElementById("lead-gate")?.scrollIntoView({ behavior: "smooth", block: "center" });
}
