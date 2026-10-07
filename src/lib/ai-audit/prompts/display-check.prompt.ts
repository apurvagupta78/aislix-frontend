/** Display / POSM check: which in-store displays are present, whose they are, their condition and placement. */
export function buildDisplayCheckPrompt(input: { expectedBrand?: string | null; expectedDisplay?: string | null }): string {
  return [
    "You check point-of-sale materials (POSM) and brand displays in a photo taken by a retail store auditor.",
    "POSM includes: shelf strips, shelf talkers, wobblers, danglers, posters, banners, standees, floor displays, end-cap or gondola displays, branded chillers or racks, gondola headers and counter displays.",
    "Ignore the products themselves unless they are part of a branded display unit. Do not count products.",
    input.expectedBrand ? `The auditor expects a display for this brand: ${input.expectedBrand}.` : "",
    input.expectedDisplay ? `The expected display type is: ${input.expectedDisplay}.` : "",
    "",
    "For every display item you can see, report:",
    "- type: one of shelf_strip, shelf_talker, wobbler, dangler, poster, banner, standee, floor_display, end_cap, chiller, rack, gondola_header, counter_display, other.",
    "- brand: the brand printed on the display, exactly as written. null if you cannot read it. Never guess a brand from colours alone.",
    "- condition: good (clean, intact, readable), damaged (torn, bent, faded, dirty, broken, partly fallen), or missing (the holder, frame, clip or stand is there but the material is gone or empty).",
    "- placement: eye_level, above_eye_level, below_eye_level, floor, entrance, checkout, end_cap, aisle or unknown.",
    "- visible: true if the display is easy to see from the aisle, false if it is blocked by stock, other displays or fixtures.",
    "- notes: one short sentence describing what you see. Plain language, no model or system names.",
    "- confidence: number between 0 and 1.",
    "",
    "Rules:",
    "- Report only what is actually in the photo. If nothing is a display, return an empty items list.",
    "- One entry per physical display item. Do not merge two brands into one entry.",
    input.expectedBrand
      ? "- expected_brand_present: true only if at least one display clearly shows the expected brand; false if it is clearly absent; null if the photo is too unclear to tell."
      : "- expected_brand_present: null (no brand was expected).",
    "- image_quality: poor if the photo is blurred, too dark, or too far away to judge displays or read their brands; otherwise good. If your summary says the photo is blurred or unclear, image_quality must be poor.",
    "- Branded fixtures count as displays: a chiller, cooler or rack with a brand logo on it is a display even when it is full of stock.",
    "",
    "Reply with JSON only:",
    '{"items": [{"type": string, "brand": string | null, "condition": "good" | "damaged" | "missing", "placement": string, "visible": boolean, "notes": string, "confidence": number}], "expected_brand_present": boolean | null, "image_quality": "good" | "poor", "summary": "one or two plain sentences for a store manager"}',
  ]
    .filter((line) => line !== "")
    .join("\n");
}
