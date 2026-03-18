import { normalizeCode, normalizeText } from "@main/utils/normalization";
import { describe, expect, it } from "vitest";

describe("normalizeCode", () => {
  it("normalizes empty, separated, and repeated-separator code inputs", () => {
    const cases = [
      { input: null, expected: "" },
      { input: undefined, expected: "" },
      { input: "", expected: "" },
      { input: "abc-123", expected: "ABC123" },
      { input: "  abc_def  ", expected: "ABCDEF" },
      { input: "ABC 123", expected: "ABC123" },
      { input: "a--b__c  d", expected: "ABCD" },
    ];

    for (const { input, expected } of cases) {
      expect(normalizeCode(input)).toBe(expected);
    }
  });
});

describe("normalizeText", () => {
  it("returns empty for missing values and collapses whitespace for text", () => {
    const cases = [
      { input: null, expected: "" },
      { input: undefined, expected: "" },
      { input: "  hello   world  ", expected: "hello world" },
      { input: "a\t\nb", expected: "a b" },
    ];

    for (const { input, expected } of cases) {
      expect(normalizeText(input)).toBe(expected);
    }
  });
});
