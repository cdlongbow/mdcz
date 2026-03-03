import { RetryHandler, withRetry } from "@main/utils/retry";
import { describe, expect, it } from "vitest";

describe("RetryHandler", () => {
  it("returns result on first success", async () => {
    const handler = new RetryHandler({ maxRetries: 3 });
    const result = await handler.executeWithRetry(async () => "ok");
    expect(result).toBe("ok");
  });

  it("retries and succeeds on transient failure", async () => {
    const handler = new RetryHandler({ maxRetries: 3, initialDelayMs: 10 });
    let attempt = 0;

    const result = await handler.executeWithRetry(async () => {
      attempt += 1;
      if (attempt < 3) {
        throw new Error("transient");
      }
      return "recovered";
    });

    expect(result).toBe("recovered");
    expect(attempt).toBe(3);
  });

  it("throws after exhausting retries", async () => {
    const handler = new RetryHandler({ maxRetries: 2, initialDelayMs: 10 });

    await expect(
      handler.executeWithRetry(async () => {
        throw new Error("always fails");
      }),
    ).rejects.toThrow("always fails");
  });

  it("respects shouldRetry callback", async () => {
    const handler = new RetryHandler({
      maxRetries: 5,
      initialDelayMs: 10,
      shouldRetry: (_error, attempt) => attempt < 1,
    });
    let attempt = 0;

    await expect(
      handler.executeWithRetry(async () => {
        attempt += 1;
        throw new Error("fail");
      }),
    ).rejects.toThrow("fail");

    // shouldRetry stops after attempt 1, so we get 2 total calls (attempt 0 + attempt 1)
    expect(attempt).toBe(2);
  });

  it("calls onRetry callback before each retry", async () => {
    const retryLog: number[] = [];
    const handler = new RetryHandler({
      maxRetries: 2,
      initialDelayMs: 10,
      onRetry: (_error, attempt) => {
        retryLog.push(attempt);
      },
    });
    let attempt = 0;

    await handler.executeWithRetry(async () => {
      attempt += 1;
      if (attempt <= 2) {
        throw new Error("retry me");
      }
      return "done";
    });

    expect(retryLog).toEqual([1, 2]);
  });
});

describe("withRetry convenience function", () => {
  it("works like RetryHandler.executeWithRetry", async () => {
    let attempt = 0;
    const result = await withRetry(
      async () => {
        attempt += 1;
        if (attempt < 2) {
          throw new Error("once");
        }
        return "ok";
      },
      { maxRetries: 3, initialDelayMs: 10 },
    );
    expect(result).toBe("ok");
  });
});
