# Campaign scan capture and homepage alignment

## Goal
Make anonymous campaign scans observable and reliable, while bringing the homepage sections into one consistent centered visual system.

## Changes
1. Add a public landing-scan server route that:
   - accepts the existing sample or uploaded-image request;
   - creates a unique campaign scan record before processing;
   - forwards the request to the existing AI service;
   - updates the record with completed results or failure details;
   - returns the current response shape so the UI behavior remains compatible.
2. Route the landing scan client through this server endpoint instead of calling the AI service directly. Preserve landing session IDs, UTM attribution, uploads, sample scans, CSV data, and annotated images.
3. Avoid blocking new incognito visitors based on browser storage. Keep the current AI-service error visible if upstream capacity itself is unavailable, while ensuring the attempt is still captured for analysis.
4. Update the homepage presentation:
   - style “Built for modern retail teams” with the same light-weight, large-display hierarchy as the hero rather than a bold subsection label;
   - make the image/results divider span the full demo panel height at desktop widths;
   - center homepage section headings, supporting copy, controls, and shared content widths consistently with the hero;
   - preserve responsive stacking on mobile.

## Technical details
- Use a TanStack public server route under `/api/public/landing/scan`; validate multipart fields and file type/size before forwarding.
- Use server-only privileged database access only after validation, and never expose backend credentials.
- Store both successful and failed scan attempts in `landing_demo_sessions`, including session token, UTMs, sample/upload metadata, status, error, and returned audit payload.
- No changes to authenticated scan flows, auth, payments, LinkedIn analytics, or the homepage’s business content.

## Verification
- Run the focused typecheck/test harness and confirm the preview build is healthy.
- Exercise sample and upload requests and confirm records appear in the database.
- Check desktop and mobile homepage screenshots for centered alignment, matching typography, and a continuous full-height divider.
