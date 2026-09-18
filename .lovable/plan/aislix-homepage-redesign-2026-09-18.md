# Aislix homepage redesign

## Direction
- Build the selected **Modern enterprise retail** direction.
- Use the locked darker-AI palette: deep navy `#102A43`, cool mist `#F2F6F9`, sky blue `#C1E4F8`, light pink `#FFEAF1`, plus white and restrained olive support from the attached theme.
- Use Space Grotesk for headings and DM Sans for body copy.
- Keep a product-first grid with the live shelf intelligence experience as the main first-screen visual.

## Implementation
1. Restyle the public navigation and homepage typography without changing destinations or authentication behavior.
2. Recompose the first screen into a focused value proposition, free-audit actions, trust signals, and a credible shelf-analysis preview using the existing sample image.
3. Refresh the audience, platform, workflow, history, lead, pricing, and closing sections with consistent modern SaaS spacing, borders, surfaces, and hierarchy.
4. Preserve the existing live demo, uploads, analytics, lead capture, pricing, lazy loading, and all route behavior.
5. Verify desktop and mobile layouts, key interactions, console health, and the preview build.

## Technical details
- Add semantic homepage styling through the existing design tokens; no hardcoded component colors.
- Load Space Grotesk and DM Sans from the document head.
- Reuse existing UI controls and assets, including the Aislix logo and sample shelf image.
- No API, database, authentication, audit logic, or data-contract changes.
