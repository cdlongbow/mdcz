import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMock, sleepMock } = vi.hoisted(() => {
  const fetchMock = vi.fn();
  const sleepMock = vi.fn().mockResolvedValue(undefined);
  return { fetchMock, sleepMock };
});

vi.mock("impit", () => {
  return {
    Impit: class {
      fetch = fetchMock;
    },
  };
});

vi.mock("node:timers/promises", () => {
  return {
    setTimeout: sleepMock,
  };
});

import { NetworkClient } from "@main/services/network/NetworkClient";

describe("NetworkClient retry policy", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    sleepMock.mockClear();
  });

  it("does not retry non-429 responses", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("blocked", {
        status: 403,
        statusText: "Forbidden",
      }),
    );

    const client = new NetworkClient();
    await expect(client.getText("https://example.com/blocked")).rejects.toThrow("HTTP 403");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sleepMock).not.toHaveBeenCalled();
  });

  it("retries once for 429 when Retry-After exists and caps wait at 15s", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response("rate-limited", {
          status: 429,
          statusText: "Too Many Requests",
          headers: {
            "Retry-After": "60",
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response("ok", {
          status: 200,
        }),
      );

    const client = new NetworkClient();
    await expect(client.getText("https://example.com/rate-limited")).resolves.toBe("ok");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleepMock).toHaveBeenCalledTimes(1);
    expect(sleepMock).toHaveBeenCalledWith(15_000);
  });

  it("does not retry 429 without Retry-After", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("rate-limited", {
        status: 429,
        statusText: "Too Many Requests",
      }),
    );

    const client = new NetworkClient();
    await expect(client.getText("https://example.com/rate-limited")).rejects.toThrow("HTTP 429");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sleepMock).not.toHaveBeenCalled();
  });

  it("does not retry thrown request errors", async () => {
    fetchMock.mockRejectedValueOnce(new Error("socket hang up"));

    const client = new NetworkClient();
    await expect(client.getText("https://example.com/unreachable")).rejects.toThrow("socket hang up");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sleepMock).not.toHaveBeenCalled();
  });

  it("retries retryable 5xx responses based on configured retry count", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response("temporary-down-1", {
          status: 503,
          statusText: "Service Unavailable",
        }),
      )
      .mockResolvedValueOnce(
        new Response("temporary-down-2", {
          status: 503,
          statusText: "Service Unavailable",
        }),
      )
      .mockResolvedValueOnce(
        new Response("ok", {
          status: 200,
        }),
      );

    const client = new NetworkClient({
      getRetryCount: () => 2,
    });
    await expect(client.getText("https://example.com/transient-503")).resolves.toBe("ok");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sleepMock).toHaveBeenCalledTimes(2);
    expect(sleepMock).toHaveBeenNthCalledWith(1, 1000);
    expect(sleepMock).toHaveBeenNthCalledWith(2, 2000);
  });
});
