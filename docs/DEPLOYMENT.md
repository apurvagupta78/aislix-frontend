# Aislix Frontend — Deployment Guide

Production today: **Lovable** (`https://aislix.com`).  
Target preview: **Vercel** (free Hobby tier).  
Backend: **Railway** (`https://aislix-backend-production.up.railway.app`).  
Supabase: `vythviniybatyrdyrmhg`.

---

## 1. Local development

### Prerequisites

- Node.js **20+** — [install with nvm](https://github.com/nvm-sh/nvm) or [nodejs.org](https://nodejs.org/)
- Git

### Setup

```sh
git clone https://github.com/apurvagupta78/aislix-frontend.git
cd aislix-frontend
cp .env.example .env
# Fill in values (copy from Lovable Cloud secrets or Supabase dashboard)
npm install
npm run dev
```

Open http://localhost:8080 (Lovable sandbox port) or the port Vite prints.

### Verify build

```sh
npm run build
```

On Vercel builds, output goes to `.vercel/output/`. Locally (non-Vercel), Nitro uses the Cloudflare default — that is expected.

---

## 2. Vercel preview deploy (your steps)

### A. Import project

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import **apurvagupta78/aislix-frontend**
3. Framework: **Other** (auto-detected if `@lovable.dev/vite-tanstack-config` ≥ 2.6.2)
4. Build command: `npm run build`
5. Do **not** set a custom output directory — Nitro writes `.vercel/output` automatically when `VERCEL=1`

### B. Environment variables

Add these in **Vercel → Project → Settings → Environment Variables** for **Preview** and **Production**:

| Variable | Required | Notes |
|----------|----------|-------|
| `VITE_APP_ENV` | Yes | `production` for prod, `development` for preview |
| `VITE_APP_URL` | Yes | Preview: `https://your-project.vercel.app` |
| `APP_URL` | Yes | Same as `VITE_APP_URL` |
| `VITE_SUPABASE_URL` | Yes | From Supabase dashboard |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Publishable key (`sb_publishable_...`) |
| `SUPABASE_URL` | Yes | Same URL as above |
| `SUPABASE_PUBLISHABLE_KEY` | Yes | Same publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | **Secret** — server only |
| `VITE_API_BASE_URL` | Yes | `https://aislix-backend-production.up.railway.app` |
| `VITE_AISLIX_API_URL` | Yes | Same Railway URL (landing demo) |
| `AISLIX_AI_API_URL` | Yes | Same Railway URL (server scan proxy) |
| `LOVABLE_API_KEY` | Yes | From Lovable Cloud → Secrets (all outbound email) |
| `LOVABLE_SEND_URL` | Optional | From Lovable Cloud if set |
| `VITE_GA_MEASUREMENT_ID` | Optional | `G-G6Q8XHGPG1` (only fires on aislix.com today) |

Copy values from **Lovable Cloud → Secrets** for anything missing.

### C. Supabase auth redirects

In [Supabase Dashboard](https://supabase.com/dashboard/project/vythviniybatyrdyrmhg/auth/url-configuration):

1. **Site URL** — keep `https://aislix.com` until cutover
2. **Redirect URLs** — add your Vercel preview URL:
   - `https://your-project.vercel.app/**`
   - `https://your-project.vercel.app/auth/callback`

### D. Deploy

Push to `main` (or click Deploy in Vercel). Vercel sets `VERCEL=1` which switches Nitro to the `vercel` preset.

---

## 3. Preview QA checklist

Run on the Vercel preview URL before touching DNS:

- [ ] Homepage loads
- [ ] Landing demo scan completes (anonymous scan → Railway)
- [ ] Lead capture email after demo (`/api/send-landing-onboarding`)
- [ ] Sign up → verification email received
- [ ] Login / logout
- [ ] Authenticated scan upload
- [ ] Team invite sends email
- [ ] Pricing / billing pages load
- [ ] Contact form submits (check Supabase `contact_submissions` table)

Auth emails use Supabase Auth Hook → `/lovable/email/auth/webhook`. Until you update the hook URL in Supabase, auth emails may still route through Lovable production. Transactional emails (invites, scan share, landing onboarding) work on preview as long as `LOVABLE_API_KEY` is set.

---

## 4. Production cutover (later)

Only after 48h stable preview:

1. Point `aislix.com` DNS to Vercel
2. Set `VITE_APP_URL` and `APP_URL` to `https://aislix.com`
3. Update Supabase **Site URL** and keep redirect URLs for both domains during transition
4. Update Supabase Auth Hook → Send Email to `https://aislix.com/lovable/email/auth/webhook`
5. Run full QA (see backend repo `docs/PRE_LAUNCH_QA.md`)
6. Disconnect Lovable GitHub sync only after production is stable

**Do not** disconnect Lovable or change DNS until preview QA passes.

---

## 5. Email architecture

| Email | Path |
|-------|------|
| Signup, reset, magic link | Supabase hook → `/lovable/email/auth/webhook` → Lovable Email API |
| Team invite | Server fn → `team-invite` template → Lovable Email API |
| Scan report share | Server fn → `scan-report` template → Lovable Email API |
| Landing onboarding | `POST /api/send-landing-onboarding` → Lovable Email API |
| Contact form | **No email** — saved to Supabase `contact_submissions` only |

Sender: `Aislix <noreply@aislix.com>` via subdomain `notify.aislix.com` (Lovable-managed DNS today).

Future: migrate `send-email.ts` to Resend and move DNS from Lovable to Resend.

---

## 6. Troubleshooting

| Problem | Fix |
|---------|-----|
| Vercel 404 on all routes | Ensure `vite.config.ts` has `nitro: isVercel ? { preset: "vercel" } : true` and redeploy |
| `Missing Supabase environment variable` | Add both `VITE_*` and non-prefixed Supabase vars in Vercel |
| Scans fail | Check `AISLIX_AI_API_URL` and Railway backend health |
| Emails not sending | Check `LOVABLE_API_KEY` in Vercel env |
| Auth redirect error | Add preview URL to Supabase redirect allow-list |
