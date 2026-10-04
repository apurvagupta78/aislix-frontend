import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Coordinates → a readable address (OpenStreetMap Nominatim). Null when the lookup fails. */
export const reverseGeocode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { lat: number; lng: number }) => {
    const lat = Number(input?.lat);
    const lng = Number(input?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      throw new Error("Invalid coordinates.");
    }
    return { lat, lng };
  })
  .handler(async ({ data, context }): Promise<{ address: string | null }> => {
    const { withinRateLimits } = await import("@/lib/rate-limit.server");
    if (!(await withinRateLimits([[`reverse-geocode:${context.userId}`, 120, 3600]]))) return { address: null };
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", data.lat.toFixed(6));
    url.searchParams.set("lon", data.lng.toFixed(6));
    url.searchParams.set("zoom", "18");
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Aislix/1.0 (hello@aislix.com)", "Accept-Language": "en" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return { address: null };
      const body = (await res.json()) as { display_name?: unknown };
      const address = typeof body.display_name === "string" ? body.display_name.trim().slice(0, 300) : "";
      return { address: address || null };
    } catch {
      return { address: null };
    }
  });
