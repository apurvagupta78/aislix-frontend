import { describe, expect, it } from "vitest";

import { buildAttachmentContentParts } from "./ask-aislix.attachments";

describe("buildAttachmentContentParts", () => {
  it("maps images to input_image parts", () => {
    const parts = buildAttachmentContentParts([
      {
        name: "shelf.png",
        mimeType: "image/png",
        dataBase64: "abc123",
        size: 6,
      },
    ]);

    expect(parts).toEqual([
      {
        type: "input_image",
        detail: "auto",
        image_url: "data:image/png;base64,abc123",
      },
    ]);
  });

  it("maps text files to input_text parts", () => {
    const text = Buffer.from("sku,count\n123,4", "utf8").toString("base64");
    const parts = buildAttachmentContentParts([
      {
        name: "report.csv",
        mimeType: "text/csv",
        dataBase64: text,
        size: 14,
      },
    ]);

    expect(parts[0]).toMatchObject({
      type: "input_text",
      text: expect.stringContaining("Attached file \"report.csv\""),
    });
  });

  it("maps other files to input_file parts", () => {
    const parts = buildAttachmentContentParts([
      {
        name: "brief.pdf",
        mimeType: "application/pdf",
        dataBase64: "pdfdata",
        size: 7,
      },
    ]);

    expect(parts).toEqual([
      {
        type: "input_file",
        filename: "brief.pdf",
        file_data: "pdfdata",
      },
    ]);
  });
});
