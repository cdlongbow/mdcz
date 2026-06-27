import { describe, expect, it } from "vitest";
import { hasWorkbenchOutput } from "./overview";

describe("web overview output state", () => {
  it("treats recent acquisitions as completed output evidence", () => {
    expect(hasWorkbenchOutput({ configured: false, output: null, recentCount: 1 })).toBe(true);
  });

  it("does not mark an empty unconfigured overview as output-ready", () => {
    expect(
      hasWorkbenchOutput({
        configured: false,
        output: { fileCount: 0, totalBytes: 0, rootPath: null },
        recentCount: 0,
      }),
    ).toBe(false);
  });
});
