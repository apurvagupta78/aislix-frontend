/** Sticky marketing header is h-[4.5rem]; keep a little extra clearance. */
const HEADER_OFFSET_PX = 80;

/**
 * Scroll a homepage section into view under the sticky header.
 * Retries briefly so late layout (images) does not leave the target mid-page.
 */
export function scrollHomeSectionIntoView(id: string, behavior: ScrollBehavior = "smooth") {
  if (typeof window === "undefined" || !id) return;

  const run = () => {
    const el = document.getElementById(id);
    if (!el) return false;
    const top = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET_PX;
    window.scrollTo({ top: Math.max(0, top), behavior });
    return true;
  };

  if (run()) {
    window.requestAnimationFrame(() => {
      run();
    });
    window.setTimeout(() => run(), 200);
    window.setTimeout(() => run(), 500);
  } else {
    window.setTimeout(() => {
      run();
    }, 100);
  }
}
