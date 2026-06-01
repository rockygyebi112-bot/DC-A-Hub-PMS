import { describe, it, expect } from "vitest";
import { parseCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("parses a simple unquoted grid", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("keeps commas inside quoted fields together", () => {
    // The exact bug the old split(',') had: a comma inside a value must NOT
    // shift the remaining columns.
    expect(parseCsv('community,district\n"Tamale, Northern",North')).toEqual([
      ["community", "district"],
      ["Tamale, Northern", "North"],
    ]);
  });

  it("unescapes doubled quotes inside a quoted field", () => {
    expect(parseCsv('a\n"she said ""hi"""')).toEqual([
      ["a"],
      ['she said "hi"'],
    ]);
  });

  it("supports embedded newlines inside quoted fields", () => {
    expect(parseCsv('a,b\n"line1\nline2",x')).toEqual([
      ["a", "b"],
      ["line1\nline2", "x"],
    ]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("strips a leading UTF-8 BOM", () => {
    expect(parseCsv("﻿a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("drops fully-blank lines but preserves empty cells", () => {
    expect(parseCsv("a,b\n\n1,\n")).toEqual([
      ["a", "b"],
      ["1", ""],
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });
});
