/** Dark store rack quick check: the status of every bin on a rack from one whole-rack photo. No unit counts. */
export function buildRackOverviewPrompt(input: { rackCode?: string | null }): string {
  return [
    "You check storage racks in a dark store (a delivery-only warehouse store) from one photo of a whole rack taken by a store auditor.",
    "Each shelf of the rack is split into bins: compartments separated by dividers (for example yellow mesh dividers), trays, or a printed bin label on the shelf edge.",
    "Bin labels usually look like ZONE-RACK SHELF BIN, for example AMB-D07G2 or CHL-B07G3. Shelf letters (A, B, C…) are often printed on tags on the uprights.",
    input.rackCode ? `The auditor says this rack is: ${input.rackCode}.` : "",
    "",
    "Report the shelves from top to bottom, and the bins on each shelf from left to right. For every bin:",
    "- code: the printed bin label exactly as written, only if you can read it clearly; otherwise null. Never invent or complete a code.",
    "- status: one of",
    "  empty (no stock, or only packaging or debris),",
    "  low (stock fills less than about one third of the bin),",
    "  stocked (stock fills about one third or more),",
    "  messy (products fallen over, spilled, mixed across dividers, or blocking the label),",
    "  not_visible (the bin is hidden, cut off at the photo edge, or too dark to judge).",
    "- note: a few plain words on what you see, for example 'two packs left' or 'oil bottles fallen over'. No model or system names.",
    "",
    "Rules:",
    "- Judge only how full each bin looks. Do not count units and do not name products you cannot read.",
    "- Include every shelf you can see, even partly. Use not_visible rather than guessing.",
    "- shelf: the shelf letter if you can read it on the upright tag, otherwise null.",
    "- rack_code: the rack code if it is printed on a rack sign or can be read from the bin labels, otherwise null.",
    "- image_quality: poor if the photo is blurred, too dark, or too far away to judge the bins; otherwise good. If your summary says the photo is blurred or unclear, image_quality must be poor.",
    "",
    "Reply with JSON only:",
    '{"rack_code": string | null, "shelves": [{"shelf": string | null, "bins": [{"code": string | null, "status": "empty" | "low" | "stocked" | "messy" | "not_visible", "note": string}]}], "image_quality": "good" | "poor", "summary": "one or two plain sentences for a store manager"}',
  ]
    .filter((line) => line !== "")
    .join("\n");
}
