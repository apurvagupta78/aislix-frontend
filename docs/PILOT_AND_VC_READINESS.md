# Pilot and VC readiness

Status on 7 Oct 2026. Covers the Android app, the 5-minute VC demo, measured accuracy and the phone test before launch.

## 1. Android app (shareable, not on the Play Store yet)

- Download page: https://aislix.com/app (Android APK + iPhone "Add to Home Screen" steps).
- Package `com.aislix.app`, version 1.0.0, Android 5.0 and newer. The app opens aislix.com full screen.
- Google confirms the app-to-site link (`/.well-known/assetlinks.json`, `"linked": true`), so there is no browser address bar inside the app.
- Website changes reach the app immediately. A new APK is only needed to change the app name, icon, start page or permissions.

### Signing key (keep safe)

- Keystore: `C:\Users\Apaar\AislixAndroid\aislix-release.keystore`, alias `aislix`.
- Passwords: `C:\Users\Apaar\AislixAndroid\SIGNING-KEY-SECRETS.txt` (never commit, never share).
- Certificate SHA-256: `55:50:05:FB:20:8D:1C:9A:47:88:6B:80:14:CE:23:CC:BB:EF:23:F8:B3:86:19:10:F1:ED:D1:F0:4A:07:2B:99`.
- Back the whole `AislixAndroid` folder up to two places. Losing the key means people must uninstall and reinstall, and the Play Store listing cannot reuse this app.

### Play Store later

- Upload `C:\Users\Apaar\AislixAndroid\twa\app-release-bundle.aab`.
- In Play Console, enrol in Play App Signing using this key as the upload key.
- Add the "App signing key certificate" SHA-256 that Play Console shows to `public/.well-known/assetlinks.json` (keep the current one too), then publish the site.

### Building a new version

1. In `C:\Users\Apaar\AislixAndroid\twa\twa-manifest.json`, raise `appVersionCode` by 1 and set `appVersionName`.
2. With `JAVA_HOME` and `ANDROID_HOME` pointing at `AislixAndroid\tools\jdk\...` and `AislixAndroid\sdk`, and `BUBBLEWRAP_KEYSTORE_PASSWORD` / `BUBBLEWRAP_KEY_PASSWORD` set from the secrets file, run `bubblewrap update --skipVersionUpgrade` then `bubblewrap build --skipPwaValidation` in the `twa` folder (Bubblewrap lives in `AislixAndroid\bw`).
3. Copy `app-release-signed.apk` to `public/downloads/aislix-android.apk`, update `APP_VERSION` in `src/routes/app.tsx`, commit and publish.

## 2. Five-minute VC demo

Before the meeting:
- Sign in as the demo workspace owner (apurv@aislix.com) on laptop and phone. Demo Data on.
- Aislix app installed on the phone, location on, one real shelf nearby or a printed shelf photo.
- Open these tabs: Dashboard, Rack Check, Corrective Actions, Reports.

| Time | Screen | What to show and say |
|---|---|---|
| 0:00 | Phone, Aislix app, New Audit | Take a shelf photo. "Results in about a minute." Leave it running. |
| 0:30 | Dashboard, Customer type switch | Click Supermarket, Dark store, FMCG brand, Distributor, Local store. One sentence each: same photos, a different daily answer per business. |
| 1:30 | Rack Check | A dark-store rack: every bin marked empty, low, stocked or messy, read from the bin labels. Empty bins become refill fixes. |
| 2:15 | Display Check | A brand display: found, brand read, condition and placement. A missing display opens a fix for the field rep. |
| 2:45 | Corrective Actions | Every fix has an owner, a due date and is closed with an after photo. |
| 3:15 | Reports | Restock list, then WhatsApp share and PDF. Claim proof pack for FMCG display payments. |
| 4:00 | Phone | The audit from 0:00 is ready: what is empty, what to refill. |
| 4:30 | Close | Accuracy numbers below, the 5-segment pilot, the ask. |

If the network fails, everything except the live phone audit is already in the demo workspace.

Questions to expect:
- "How accurate is it?" Use section 3 and say the pilot measures it per customer every week.
- "Which AI do you use?" "Our own pipeline on top of leading vision AI; we can swap providers." Never name models.
- "Why not barcode scanners or planogram tools?" One photo per shelf or rack; no hardware, no setup per SKU.

## 3. Measured accuracy

### Method

1. Pick real photos that were not used to tune the prompts.
2. Before running the AI, label each bin or display by eye: empty, low, stocked, messy; display present or missing, brand, condition.
3. Run the live product (Rack Check or Display Check on aislix.com) and compare bin by bin.
4. Count precision (of what the AI flagged, how much was right) and recall (of what was really there, how much the AI found). Fixes are only raised for empty and messy bins and for missing or damaged displays, so those are the numbers that matter.

### Results, 7 Oct 2026 (4 rack photos, 66 bins judged; 3 display photos)

| Check | Result |
|---|---|
| Empty bins flagged by AI | 8, of which 7 truly empty (precision 88%) |
| Clearly empty bins found | 7 of 7 (recall 100%) |
| False refills on fully stocked racks | 0 on 2 racks |
| Messy bins | 2 flagged on the rack with spilled packets, both correct |
| Rack code read from bin labels | 2 of 2 after the label fix (B05, C10) |
| Cut-off rows | Marked "not visible", never guessed |
| Display present (Eravat poster) | Found, correct brand, condition and placement |
| Display missing (Pringles on shelf, no display) | Correctly reported "expected display missing" and opened a fix |

Weak spots:
- One wrapped bundle was called an empty bin (the one false positive).
- One borderline near-empty bin was called low, not empty.
- "Low" versus "stocked" is a judgement call; the AI leans towards "low". "Low" does not raise fixes.
- Display Check listed the promotional poster but not the rice-bag floor stack under it.

The sample is small and labelled by one person. Repeat during the pilot with at least 20 photos per segment: each week the store manager marks 5 results right or wrong, and the false-fix rate is tracked per customer.

## 4. Phone test before launch

On two Android phones (one older, one recent):
1. Open aislix.com/app, tap Download for Android, install, open. Expect the Aislix splash, no address bar, sign-in works.
2. Close the app fully and reopen: still signed in.
3. New Audit: the camera opens, the photo uploads, the result arrives.
4. Allow location when asked. The audit shows up with GPS in Reports, Field team coverage.
5. Rack Check and Display Check with a real photo each.
6. Reports: PDF opens the print screen (Save as PDF), Excel downloads, WhatsApp opens WhatsApp with the report link.
7. Long-press the app icon: the New audit and Reports shortcuts work.

On one iPhone: Safari, Share, Add to Home Screen, open it, sign in, run one audit.

In the demo workspace (signed in as apurv@aislix.com):
- Run 2 Rack Checks and 2 Display Checks with real photos so the demo has fresh examples.
- Take 3 to 4 audits with location on so the Field team coverage report shows GPS visits.

## 5. Known limits during the pilot

- Scheduled report emails are off until the report timer has its database key on Railway; reports are sent by hand (PDF, Excel, link, WhatsApp, email).
- Value at risk shows N/A until a customer shares a price list.
- The app is installed from aislix.com/app, not the Play Store; Android shows an "unknown apps" prompt once.
