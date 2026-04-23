import { createOverviewInvalidationTracker } from "@renderer/hooks/useIpcSync";
import { formatBytes } from "@renderer/utils/format";
import { describe, expect, it } from "vitest";

describe("overview UI contract", () => {
  it("formats output summary byte counts for compact numeric cards", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(10 * 1024, { trimTrailingZeros: true })).toBe("10 KB");
    expect(formatBytes(1536, { fractionDigits: 2 })).toBe("1.50 KB");
  });

  it("refreshes overview data when a scrape button-status cycle returns to idle", () => {
    const shouldInvalidate = createOverviewInvalidationTracker();

    expect(shouldInvalidate(false)).toBe(false);
    expect(shouldInvalidate(true)).toBe(false);
    expect(shouldInvalidate(true)).toBe(false);
    expect(shouldInvalidate(false)).toBe(true);
    expect(shouldInvalidate(false)).toBe(false);
  });
});
