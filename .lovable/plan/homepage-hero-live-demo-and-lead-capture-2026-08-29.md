# Homepage hero, live demo, and lead capture

## Scope
- Add three isolated homepage components under `src/components/home/`.
- Keep existing homepage sections and route behavior intact, changing only their order around the current product preview.
- Reuse existing Aislix semantic tokens, buttons, form controls, analytics, and lead/signup helpers.

## Implementation
1. Build `HomeScanHero` with the requested two-column shelf analysis preview, smooth-scroll CTAs, and retail-team trust row.
2. Build an expandable `HomeLiveDemoDashboard` with static metrics, sample shelf image, executive summary, and inventory table; no API or login required.
3. Build `HomeLeadCapture` using the existing `/landing/lead` client, onboarding email endpoint, UTM/session-preserving signup URL, and success fallback CTA.
4. Update `/` to place the new hero/live demo immediately before the unchanged existing dashboard preview and the lead form immediately after it; leave all remaining sections and footer content unchanged.
5. Verify desktop/mobile layout, interactions, build health, and absence of cyan/teal/emerald utilities, then publish.

## Technical details
- The hero owns the expanded/collapsed live-demo state so its secondary CTA can reveal and scroll to `#live-demo-dashboard`.
- The sample image uses the existing anonymous shampoo endpoint.
- All visual styling uses semantic classes such as `bg-primary`, `text-primary`, `bg-card`, `border-border`, and existing shadow tokens.
