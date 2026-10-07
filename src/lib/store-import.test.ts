import { describe, expect, it } from "vitest";

import { parseCsvRows, parseStoreCsv, storeCsvTemplate, toCsv } from "@/lib/store-import";

describe("parseCsvRows", () => {
  it("keeps commas, quotes and line breaks inside quoted cells", () => {
    const rows = parseCsvRows('name,address\r\n"Gupta, General","Shop 2, ""Main"" Rd\nJaipur"\n');
    expect(rows).toEqual([
      ["name", "address"],
      ["Gupta, General", 'Shop 2, "Main" Rd\nJaipur'],
    ]);
  });
});

describe("parseStoreCsv", () => {
  it("accepts distributor-style headers and saves outlet GPS", () => {
    const { rows, issues } = parseStoreCsv(
      "Outlet Name,Outlet Code,Type,City,Lat,Lng,Mobile\nSharma Kirana,OUT-1,Kirana,Pune,18.52,73.85,98765\n",
    );
    expect(issues).toEqual([]);
    expect(rows[0]).toMatchObject({
      name: "Sharma Kirana",
      code: "OUT-1",
      store_type: "local_store",
      city: "Pune",
      latitude: 18.52,
      longitude: 73.85,
      contact_phone: "98765",
    });
  });

  it("reports rows without a name or with broken coordinates", () => {
    const { rows, issues } = parseStoreCsv("name,latitude,longitude\n,1,2\nA,91,10\nB,10,\nC,,\n");
    expect(rows.map((r) => r.name)).toEqual(["C"]);
    expect(issues.map((i) => i.line)).toEqual([2, 3, 4]);
  });

  it("round-trips the template", () => {
    const { rows, issues } = parseStoreCsv(storeCsvTemplate());
    expect(issues).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.store_type).toBe("local_store");
  });
});

describe("toCsv", () => {
  it("quotes cells that need it", () => {
    expect(toCsv(["a", "b"], [["x,y", null]])).toBe('a,b\n"x,y",');
  });
});
