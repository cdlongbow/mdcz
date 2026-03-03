import {
  extractNumber,
  normalizeCode,
  normalizeComparableText,
  normalizeKeyword,
  normalizeNumber,
  normalizeText,
  normalizeUrl,
} from "@main/utils/normalization";
import { describe, expect, it } from "vitest";

describe("normalizeCode", () => {
  it("returns empty string for null/undefined/empty", () => {
    expect(normalizeCode(null)).toBe("");
    expect(normalizeCode(undefined)).toBe("");
    expect(normalizeCode("")).toBe("");
  });

  it("removes separators and uppercases", () => {
    expect(normalizeCode("abc-123")).toBe("ABC123");
    expect(normalizeCode("  abc_def  ")).toBe("ABCDEF");
    expect(normalizeCode("ABC 123")).toBe("ABC123");
  });

  it("handles multiple consecutive separators", () => {
    expect(normalizeCode("a--b__c  d")).toBe("ABCD");
  });
});

describe("normalizeNumber", () => {
  it("returns empty string for null/undefined", () => {
    expect(normalizeNumber(null)).toBe("");
    expect(normalizeNumber(undefined)).toBe("");
  });

  it("removes separators but preserves case", () => {
    expect(normalizeNumber("abc-123")).toBe("abc123");
    expect(normalizeNumber("ABC_DEF")).toBe("ABCDEF");
  });
});

describe("normalizeText", () => {
  it("returns empty string for null/undefined", () => {
    expect(normalizeText(null)).toBe("");
    expect(normalizeText(undefined)).toBe("");
  });

  it("collapses whitespace and trims", () => {
    expect(normalizeText("  hello   world  ")).toBe("hello world");
    expect(normalizeText("a\t\nb")).toBe("a b");
  });
});

describe("normalizeKeyword", () => {
  it("lowercases and removes all whitespace", () => {
    expect(normalizeKeyword("Hello World")).toBe("helloworld");
    expect(normalizeKeyword("  A B  C  ")).toBe("abc");
  });

  it("returns empty for null/undefined", () => {
    expect(normalizeKeyword(null)).toBe("");
  });
});

describe("normalizeComparableText", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizeComparableText("Hello   World")).toBe("hello world");
  });

  it("returns empty for null/undefined", () => {
    expect(normalizeComparableText(undefined)).toBe("");
  });
});

describe("extractNumber", () => {
  it("extracts first numeric sequence", () => {
    expect(extractNumber("123 min")).toBe("123");
    expect(extractNumber("runtime: 45 minutes")).toBe("45");
  });

  it("returns empty for non-numeric strings", () => {
    expect(extractNumber("no numbers here")).toBe("");
    expect(extractNumber(null)).toBe("");
  });
});

describe("normalizeUrl", () => {
  it("returns empty for null/undefined/empty", () => {
    expect(normalizeUrl(null)).toBe("");
    expect(normalizeUrl("")).toBe("");
    expect(normalizeUrl("   ")).toBe("");
  });

  it("adds https:// when missing", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com");
  });

  it("preserves existing protocol", () => {
    expect(normalizeUrl("http://example.com")).toBe("http://example.com");
    expect(normalizeUrl("https://example.com")).toBe("https://example.com");
  });

  it("trims whitespace", () => {
    expect(normalizeUrl("  https://example.com  ")).toBe("https://example.com");
  });
});
