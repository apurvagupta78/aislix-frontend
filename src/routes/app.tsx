import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Smartphone } from "lucide-react";

import { MarketingPage } from "@/components/MarketingLayout";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/lib/pwa";

const APK_URL = "/downloads/aislix-android.apk";
const APP_VERSION = "1.0.0";
/** SHA-256 of the Aislix Android signing certificate, so people can check the download is ours. */
const SIGNING_SHA256 =
  "55:50:05:FB:20:8D:1C:9A:47:88:6B:80:14:CE:23:CC:BB:EF:23:F8:B3:86:19:10:F1:ED:D1:F0:4A:07:2B:99";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Get the Aislix app — Android and iPhone" },
      {
        name: "description",
        content: "Download the Aislix app for Android, or add Aislix to your iPhone home screen. Sign in with your Aislix account.",
      },
      { property: "og:url", content: "https://aislix.com/app" },
    ],
    links: [{ rel: "canonical", href: "https://aislix.com/app" }],
  }),
  component: AppDownloadPage,
});

function AppDownloadPage() {
  const { canInstall, install } = useInstallPrompt();

  return (
    <MarketingPage>
      <section className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="flex items-center gap-3">
          <img src="/icon-192.png" alt="" className="size-14 rounded-2xl border border-[#D9E2E8]" />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#04203F]">Get the Aislix app</h1>
            <p className="text-sm text-[#667085]">Sign in with your Aislix account. Updates arrive automatically.</p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-[#D9E2E8] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-[#04203F]">Android</h2>
            <p className="mt-1 text-sm text-[#667085]">Version {APP_VERSION} · pilot release, not yet on the Play Store.</p>
            <Button asChild variant="brand" className="mt-4 w-full rounded-xl">
              <a href={APK_URL} download="Aislix.apk">
                <Download className="size-4" /> Download for Android
              </a>
            </Button>
            <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-sm text-[#04203F]">
              <li>Tap Download for Android and open the downloaded file.</li>
              <li>
                If Android asks, allow <span className="font-medium">Install unknown apps</span> for your browser, then go back.
              </li>
              <li>Tap Install, open Aislix and sign in.</li>
            </ol>
            <p className="mt-3 text-xs text-[#667085]">
              Android warns about apps from outside the Play Store. This app is signed by Aislix; it opens
              aislix.com and nothing else.
            </p>
          </article>

          <article className="rounded-2xl border border-[#D9E2E8] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-[#04203F]">iPhone</h2>
            <p className="mt-1 text-sm text-[#667085]">Works from Safari, no download needed.</p>
            <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-sm text-[#04203F]">
              <li>Open aislix.com in Safari.</li>
              <li>Tap the Share button.</li>
              <li>Tap Add to Home Screen, then Add.</li>
            </ol>
            {canInstall ? (
              <Button variant="subtle" className="mt-4 w-full rounded-xl" onClick={() => void install()}>
                <Smartphone className="size-4" /> Install from this browser
              </Button>
            ) : null}
          </article>
        </div>

        <div className="mt-6 rounded-2xl border border-[#D9E2E8] bg-[#F4F7F9] p-5 text-sm text-[#667085]">
          <p className="font-medium text-[#04203F]">New to Aislix?</p>
          <p className="mt-1">
            Read the{" "}
            <Link to="/guide" className="underline">
              getting started guide
            </Link>{" "}
            for setup and a daily routine for your business.
          </p>
          <p className="mt-3 break-all text-xs">Signing certificate SHA-256: {SIGNING_SHA256}</p>
        </div>
      </section>
    </MarketingPage>
  );
}
