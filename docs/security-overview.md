# Aislix security overview

Status as of 3 October 2026. This document describes the controls that are live on aislix.com and the
Aislix analysis API, what has been verified, and the known residual risks. It is an internal hardening
review, not a third-party penetration test or a compliance certification (SOC 2 / ISO 27001).

## 1. Architecture at a glance

| Layer | Technology | Hosting |
|---|---|---|
| Web app and server functions | TanStack Start (React) | Lovable / Cloudflare |
| Database, auth, file storage | Supabase (Postgres with row-level security) | Supabase cloud |
| Shelf analysis API | FastAPI (Python) | Railway |

All traffic is HTTPS. Browsers are told to use HTTPS only (HSTS, one year, including subdomains).

## 2. Identity and access

- **Sign-in** uses Supabase Auth (email + password, email verification). Passwords are never stored or
  seen by Aislix code; Supabase stores salted hashes.
- **Sessions** are short-lived JWTs refreshed by Supabase. "Sign out" ends the session on the device;
  Settings → Security can sign out all other devices.
- **Workspaces (organisations)** isolate customers. Every business table carries an `org_id`.
- **Roles**: owner / admin / manager / member. Managers see manager-only pages (Team, Exception Queue,
  Analytics, Master Data, Settings); members see only their own work.
- **Store scope**: members can be limited to specific stores. Store-scoped data (audits, findings,
  corrective actions, expiry inspections, evidence images, Ask Aislix answers) is filtered by
  `my_readable_store_ids()` inside the database, so a member cannot read another store's data even by
  calling the API directly.

## 3. Data isolation (database)

- Row-level security (RLS) is enabled on customer tables. Policies check workspace membership and,
  where relevant, store scope.
- Privileged database functions (`SECURITY DEFINER`) were reviewed. Functions that could leak data
  across workspaces were either revoked from end users or wrapped with an explicit membership check
  (`get_org_usage_summary`, store-hierarchy resolvers, expiry metrics).
- Verified by impersonating a real user inside a rolled-back transaction:
  - own workspace usage → returned;
  - another workspace's usage → "Access denied";
  - another workspace's store list → empty;
  - another workspace's expiry metrics → zeros (no data).
- Development-only seed functions (for example the expiry demo seeder) are not callable by customers.

## 4. Analysis API (Railway)

- Every scan request carries the signed-in user's token. The API verifies the token with Supabase and
  then checks scan access **as that user**, so the same RLS rules decide whether the scan is visible.
- Auth mode is `enforce` in production (visible on `/health`).
- The old unauthenticated `/api/scan` proxy has been removed.

## 5. Public surfaces

| Surface | Protection |
|---|---|
| Free demo scan | Per-IP limit (10/hour) and global limit (300/day), 11 MB upload cap, field size caps, no files stored |
| Demo share links | Only server-stored results can be shared; random 128-bit tokens; 30 share requests/hour per IP |
| Planogram CSV helpers | 2 MB cap, 120/hour per IP, 3,000/hour global |
| Onboarding email | 20/hour per IP, 3/hour per email, 500/day global |
| Report emails (signed-in) | Max 20 recipients, 50/day per user, 300/day per workspace |

Rate limits are stored in the database (they survive restarts and apply across server instances).

## 6. Files and uploads

- Storage buckets enforce size and type limits: shelf images / documents 100 MB (images, PDF, CSV,
  video), avatars and logos 5 MB (images only), catalogue data 20 MB.
- Evidence images are served through short-lived signed URLs (1 hour), never public bucket links.

## 7. Browser hardening

Server-rendered pages and APIs send:

- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Content-Security-Policy: frame-ancestors 'self' …; base-uri 'self'; object-src 'none'` (clickjacking)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (camera/microphone/geolocation only for Aislix itself)
- `Cross-Origin-Opener-Policy: same-origin-allow-popups`

The statically cached marketing homepage receives HSTS, nosniff and referrer policy from the edge.

## 8. Secrets

- Service-role database keys and AI provider keys exist only in server environments (Lovable server
  functions, Railway). They are never sent to the browser.
- The browser uses only the Supabase publishable (anon) key, which is safe to expose because RLS
  enforces access.
- Error messages returned to users are generic; provider keys are redacted from logs.

## 9. Known residual risks (honest list)

1. **No external penetration test yet.** Planned before enterprise contracts.
2. **Recurring audit schedules are processed when users open certain pages**, not by a dedicated
   scheduler. The processing function runs for all workspaces. It creates assignments only from each
   workspace's own schedules, but it should move to a server-side cron job.
3. **Demo rate limit uses the first forwarded IP**, which a determined attacker can spoof. The global
   daily cap and Cloudflare edge limits bound the cost.
4. **Background document-reading jobs** track their owner in API memory; a restart loses in-flight jobs
   (no data exposure, only a retry).
5. **Demo lead capture on the analysis API** is inactive (the frontend stores demo sessions instead).
6. **Dark mode is disabled**; not a security issue, noted for completeness.
7. **No formal certifications** (SOC 2, ISO 27001, GDPR DPA templates) yet.

## 10. What we can say to customers and investors

- Customer data is isolated per workspace and per store inside the database, not only in the UI.
- All traffic is encrypted; passwords are handled by Supabase Auth.
- Public endpoints are rate-limited and size-limited.
- Evidence images are private and served through expiring links.

What we should **not** claim yet: "100% secure", "penetration tested", "SOC 2 / ISO certified" or
"bank-grade". No software can honestly promise 100%; the list in section 9 is what remains.
