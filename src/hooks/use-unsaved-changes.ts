import { useEffect, useState } from "react";

export function useUnsavedChanges(dirty: boolean) {
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const confirmLeave = (href: string) => {
    if (!dirty) return true;
    setPendingHref(href);
    setLeaveOpen(true);
    return false;
  };

  return { leaveOpen, setLeaveOpen, pendingHref, setPendingHref, confirmLeave };
}
