import { useEffect, useState } from "react";
import { SignupCta } from "./shared";

/** Mobile-only sticky conversion bar; hides once the footer sentinel is visible. */
export function MobileStickyCta({ hideWhenVisibleId }: { hideWhenVisibleId: string }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const target = document.getElementById(hideWhenVisibleId);
    if (!target || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => setHidden(entries[0]?.isIntersecting ?? false), {
      rootMargin: "0px 0px -20% 0px",
    });
    io.observe(target);
    return () => io.disconnect();
  }, [hideWhenVisibleId]);

  if (hidden) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-landing-border bg-background/95 p-3 backdrop-blur md:hidden">
      <SignupCta location="mobile_sticky" className="w-full" />
    </div>
  );
}
