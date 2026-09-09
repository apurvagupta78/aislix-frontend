# Cursor + Lovable workflow (recommended)

Aislix frontend is developed in **Cursor** and deployed automatically by **Lovable** when you push to GitHub.

## Architecture

```
Cursor (edit code) → GitHub main → Lovable auto-deploy → aislix.com
Backend scans      → Railway (unchanged)
Auth + database    → Supabase (unchanged)
Email              → Lovable Email API (for now)
```

Your desktop does **not** need to stay on. Lovable hosts the site 24/7.

## Daily workflow

1. Open `aislix-frontend` in Cursor (separate from backend repo).
2. Describe changes in chat — agent edits code.
3. Review diff, then push to `main`:
   ```sh
   git add -A
   git commit -m "describe change"
   git push origin main
   ```
4. Lovable picks up the commit and publishes to `https://aislix.com` (usually within a few minutes).

## When to open Lovable UI

- **Secrets:** `LOVABLE_API_KEY`, Supabase service role, etc. (Lovable Cloud → Secrets)
- **Email DNS:** `notify.aislix.com` sender domain
- **Deploy failed:** check Lovable build logs
- **Emergency only:** visual editor for quick hotfixes

Avoid editing the same files in Lovable and Cursor — pick Cursor as source of truth.

## Git rules

- Do **not** force-push or rewrite history on `main` while Lovable sync is connected.
- **Keep `.env` in git** for Lovable — it embeds `VITE_*` vars at build time. Only publishable keys belong there; never commit `SUPABASE_SERVICE_ROLE_KEY` or `LOVABLE_API_KEY`.

## Optional local dev

If Node.js is installed:

```sh
npm install
npm run dev
```

Not required for production — Lovable builds in the cloud.

## Vercel

Vercel config exists (`vercel.json`, Nitro preset) if you migrate off Lovable later. **Not needed** while Lovable hosts production.
