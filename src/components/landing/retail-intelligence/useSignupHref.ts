import { useEffect, useState } from "react";
import { signupWithUtm } from "@/lib/utm";

/**
 * Resolves the /signup href after hydration so SSR markup and client markup
 * match (UTM params only exist in the browser URL).
 */
export function useSignupHref(path = "/signup"): string {
  const [href, setHref] = useState(path);
  useEffect(() => {
    setHref(signupWithUtm(path));
  }, [path]);
  return href;
}
