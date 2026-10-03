import { describe, expect, it } from "vitest";

import { emptyReferenceMeta, type ReferenceDocumentState } from "@/lib/ai-audit/reference-document";
import {
  applyColumnHint,
  buildPipelineState,
  headerKey,
  readPipelinePages,
  tablesNeedingColumnHelp,
  type PipelineResult,
} from "./document-pipeline";

const HEADERS = ["S.No", "Item Description", "Qty", "Rate", "Amount"];

function at<T>(items: T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`missing item ${index}`);
  return item;
}

function result(pages: PipelineResult["pages"], document: PipelineResult["document"] = {}): PipelineResult {
  return { provider: "none", pages_total: pages.length, scanned_pages: 0, document, pages };
}

describe("readPipelinePages", () => {
  it("maps text-layer tables, drops total lines and passes clean pages", () => {
    const page = at(
      readPipelinePages(
        result([
          {
            page: 1,
            source: "text",
            text_chars: 400,
            tables: [
              {
                headers: HEADERS,
                rows: [
                  ["1", "Amul Butter 500g", "24", "275.00", "6,600.00"],
                  ["2", "Tata Salt 1kg", "40", "28.00", "1,120.00"],
                  ["", "Grand Total", "", "", "7,720.00"],
                  ["", "CGST 9%", "", "", "694.80"],
                ],
                confidence: null,
              },
            ],
          },
        ]),
      ),
      0,
    );
    expect(page.flag).toBeNull();
    expect(page.rows.map((r) => [r.product, r.qty, r.price])).toEqual([
      ["Amul Butter 500g", 24, 275],
      ["Tata Salt 1kg", 40, 28],
    ]);
    expect(at(page.rows, 0).extra).toMatchObject({ "S.No": "1", Amount: "6,600.00" });
    expect(page.printedTotals).toEqual([7720]);
  });

  it("flags unread pages and pages where qty x rate does not match the amount", () => {
    const pages = readPipelinePages(
      result([
        { page: 1, source: "none", text_chars: 0, tables: [] },
        {
          page: 2,
          source: "azure",
          text_chars: 0,
          tables: [
            {
              headers: ["Description", "Quantity", "Unit price", "Amount"],
              rows: [
                ["Soap", "2", "50", "100"],
                ["Shampoo", "3", "120", "999"],
              ],
              confidence: [0.95, 0.9],
            },
          ],
        },
      ]),
    );
    expect(at(pages, 0).flag).toBe("unread");
    const second = at(pages, 1);
    expect(second.flag).toBe("math");
    expect(at(second.rows, 1).check_fields).toEqual(expect.arrayContaining(["qty", "price"]));
    expect(at(second.rows, 0).confidence).toBe(0.95);
  });

  it("flags low-confidence OCR pages", () => {
    const pages = readPipelinePages(
      result([
        {
          page: 1,
          source: "azure",
          text_chars: 0,
          tables: [{ headers: ["Description", "Quantity"], rows: [["Soap", "2"]], confidence: [0.4] }],
        },
      ]),
    );
    expect(at(pages, 0).flag).toBe("low_confidence");
  });

  it("asks for column help only for unmapped layouts and applies the hint", () => {
    const res = result([
      {
        page: 1,
        source: "text",
        text_chars: 300,
        tables: [
          { headers: ["Column 1", "Column 2", "Column 3"], rows: [["Soap", "2", "50"]], confidence: null },
          { headers: HEADERS, rows: [["1", "Salt", "1", "20", "20"]], confidence: null },
        ],
      },
    ]);
    const help = tablesNeedingColumnHelp(res);
    expect(help.map((h) => h.headers)).toEqual([["Column 1", "Column 2", "Column 3"]]);
    const hint = { product: "Column 1", qty: "Column 2", price: "Column 3" };
    expect(applyColumnHint(["Column 1", "Column 2", "Column 3"], hint)).toEqual(["Product", "Qty", "Price"]);
    const pages = readPipelinePages(res, { [headerKey(at(help, 0).headers)]: hint });
    expect(at(pages, 0).rows.map((r) => [r.product, r.qty, r.price])).toEqual([
      ["Soap", 2, 50],
      ["Salt", 1, 20],
    ]);
  });
});

describe("buildPipelineState", () => {
  it("replaces re-read pages with Luna rows, renumbers lines and checks the total", () => {
    const res = result(
      [
        {
          page: 1,
          source: "text",
          text_chars: 300,
          tables: [{ headers: HEADERS, rows: [["1", "Soap", "2", "50", "100"]], confidence: null }],
        },
        { page: 2, source: "none", text_chars: 0, tables: [] },
        { page: 3, source: "none", text_chars: 0, tables: [] },
      ],
      { supplier_name: "Acme Traders", total_amount: 500 },
    );
    const pages = readPipelinePages(res);
    const luna: ReferenceDocumentState = {
      meta: { ...emptyReferenceMeta("document", "invoice.pdf (page 2)"), warnings: ["This looks like a partial table."] },
      rows: [{ ...at(at(pages, 0).rows, 0), id: "luna-1", product: "Shampoo", extra: { Amount: "150" } }],
    };
    const state = buildPipelineState({
      result: res,
      pages,
      lunaPages: new Map([[2, luna]]),
      unreadPages: [3],
      filename: "invoice.pdf",
    });
    expect(state.rows.map((r) => [r.line_no, r.product])).toEqual([
      [1, "Soap"],
      [2, "Shampoo"],
    ]);
    expect(state.meta.supplier_name).toBe("Acme Traders");
    expect(state.meta.reading_quality).toBe("POOR");
    expect(state.meta.warnings.join(" ")).toContain("Page 3 could not be read");
    expect(state.meta.warnings.join(" ")).toContain("add up to 250.00 but the document total is 500.00");
    expect(state.meta.warnings.join(" ")).not.toContain("partial table");
  });

  it("marks reading quality limited when line amounts do not match the document total", () => {
    const res = result(
      [
        {
          page: 1,
          source: "text",
          text_chars: 300,
          tables: [{ headers: HEADERS, rows: [["1", "Soap", "2", "50", "100"]], confidence: null }],
        },
      ],
      { total_amount: 900 },
    );
    const pages = readPipelinePages(res);
    const state = buildPipelineState({ result: res, pages, lunaPages: new Map(), unreadPages: [], filename: "a.pdf" });
    expect(state.meta.reading_quality).toBe("LIMITED");
  });
});
