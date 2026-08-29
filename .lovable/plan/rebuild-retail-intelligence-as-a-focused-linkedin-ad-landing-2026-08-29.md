# Rebuild `/retail-intelligence` as a focused LinkedIn ad landing page

## Scope
- Change only `/retail-intelligence`, its isolated landing components, and `src/lib/landing-scan-api.ts`.
- Preserve the homepage, authentication flows, production scan pipeline, and global LinkedIn Insight Tag.
- Use the uploaded mockup and shelf photo as design references only; the live sample image will come from the public landing API.

## Build
1. Rework the landing header and hero into a dark navy, enterprise SaaS presentation with only the Aislix logo, Log in link, prescribed headline, trust points, and sample/upload actions.
2. Rebuild the live demo as the central white product surface:
   - initialize the Lay’s sample URL on mount so it is visible immediately;
   - keep the current image visible under an analyzing overlay;
   - support sample and validated JPEG/PNG upload scans through only `/landing/scan`;
   - render only API-provided metrics and inventory with Brand, Product, Qty, Conf., and Status;
   - replace the preview with the returned annotated image and retain CSV download.
3. Keep the lead section permanently visible below the demo with Email, Full name, and Company fields, lead submission, success state, UTM/session-preserving signup actions, and an in-results prompt that scrolls to it.
4. Keep the route limited to header, hero, demo, lead, and minimal footer, with responsive 55/45 desktop demo and stacked mobile layout.

## Technical details
- Export `DEFAULT_SAMPLE_ID`, `DEFAULT_SAMPLE_IMAGE`, `runLandingSample`, and `runLandingUpload` from the landing API helper while preserving lead capture, conversion, persistence, and signup URL behavior.
- Coordinate hero actions with the demo via landing-local browser events so buttons can trigger the scan or file picker without adding global state or touching auth routes.
- Reuse existing semantic design tokens and design-system buttons; add no global analytics changes.

## QA and release
- Verify desktop and mobile rendering, immediate sample visibility, section count, no forbidden compliance/planogram text, no console/runtime errors, and unchanged homepage source.
- Exercise the public sample scan far enough to confirm the preview remains during processing; validate returned API inventory and CSV availability when the response completes.
- Publish only after build and browser checks pass.
