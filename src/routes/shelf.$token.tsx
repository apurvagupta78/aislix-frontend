/**
 * Public shelf-space page opened from a printed QR label. Anyone holding the label's token sees
 * what belongs in that space; no session and no audit or compliance data.
 */

import { createFileRoute } from "@tanstack/react-router";
import { MapPin } from "lucide-react";

import { Logo } from "@/components/Logo";
import { getPublicShelfSpace, type PublicShelfSpace } from "@/lib/planogram-generator/planogram-generator.functions";

export const Route = createFileRoute("/shelf/$token")({
  loader: async ({ params }): Promise<{ space: PublicShelfSpace | null }> => {
    try {
      return { space: await getPublicShelfSpace({ data: { token: params.token } }) };
    } catch {
      return { space: null };
    }
  },
  head: () => ({
    meta: [
      { title: "Shelf space — Aislix" },
      { name: "description", content: "What belongs on this shelf space, from the store's approved planogram." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ShelfSpacePage,
});

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function ShelfSpacePage() {
  const { space } = Route.useLoaderData();

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-[#D9E2E8]">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-4 px-4 py-3">
          <Logo />
          <span className="rounded-full border border-[#D9E2E8] px-2.5 py-0.5 text-xs text-[#667085]">Shelf label</span>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 py-6">
        {!space ? (
          <Notice title="Label not found" body="This QR code is not a valid Aislix shelf label. Ask your store manager for a new label." />
        ) : space.status === "replaced" ? (
          <Notice
            title={`${space.location_code} has a newer plan`}
            body="This label was replaced when the store approved a newer planogram. Ask your store manager for the new label."
          />
        ) : (
          <article className="rounded-xl border border-[#D9E2E8] bg-white p-4 sm:p-5">
            <p className="flex items-center gap-1.5 text-sm text-[#667085]">
              <MapPin className="size-4" aria-hidden />
              {space.store_name}
              {space.store_city ? ` · ${space.store_city}` : ""}
            </p>
            <h1 className="mt-2 break-all text-2xl font-semibold text-[#04203F]">{space.location_code}</h1>
            <p className="mt-1 text-sm text-[#667085]">{space.physical_position}</p>

            <h2 className="mt-5 text-sm font-semibold text-[#04203F]">What belongs here</h2>
            {space.products.length ? (
              <ul className="mt-2 divide-y divide-[#EEF1F4] rounded-lg border border-[#D9E2E8]">
                {space.products.map((p, i) => (
                  <li key={`${p.name}-${i}`} className="flex items-start justify-between gap-3 px-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block text-sm text-[#04203F]">{p.name}</span>
                      {p.brand || p.sku ? (
                        <span className="block text-xs text-[#667085]">
                          {[p.brand, p.sku ? `SKU ${p.sku}` : ""].filter(Boolean).join(" · ")}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-right text-xs text-[#667085]">
                      {p.facings ? (
                        <span className="block text-sm font-semibold text-[#04203F]">
                          {p.facings} {p.facings === 1 ? "facing" : "facings"}
                        </span>
                      ) : null}
                      {p.quantity ? <span className="block">{p.quantity} units</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 rounded-lg border border-[#D9E2E8] px-3 py-3 text-sm text-[#667085]">
                Keep this space free.
              </p>
            )}

            {space.instructions ? (
              <>
                <h2 className="mt-5 text-sm font-semibold text-[#04203F]">How to place</h2>
                <p className="mt-1 text-sm text-[#04203F]">{space.instructions}</p>
              </>
            ) : null}

            <p className="mt-5 border-t border-[#EEF1F4] pt-3 text-xs text-[#667085]">
              From the store's approved planogram · {formatDate(space.approved_at)}
            </p>
          </article>
        )}
      </main>
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-[#D9E2E8] bg-white px-4 py-6">
      <h1 className="text-base font-semibold text-[#04203F]">{title}</h1>
      <p className="mt-1 text-sm text-[#667085]">{body}</p>
    </div>
  );
}
