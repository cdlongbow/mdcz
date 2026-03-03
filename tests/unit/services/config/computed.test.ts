import { buildComputedConfiguration } from "@main/services/config/computed";
import { configurationSchema } from "@main/services/config/models";
import { ProxyType } from "@shared/enums";
import { describe, expect, it } from "vitest";

describe("buildComputedConfiguration", () => {
  it("builds proxy url from proxyType when protocol is omitted", () => {
    const configuration = configurationSchema.parse({
      network: {
        useProxy: true,
        proxyType: ProxyType.SOCKS5,
        proxy: "127.0.0.1:7890",
      },
    });

    const computed = buildComputedConfiguration(configuration);
    expect(computed.proxyUrl).toBe("socks5://127.0.0.1:7890");
  });

  it("preserves explicitly provided proxy protocol", () => {
    const configuration = configurationSchema.parse({
      network: {
        useProxy: true,
        proxyType: ProxyType.HTTP,
        proxy: "https://127.0.0.1:7890",
      },
    });

    const computed = buildComputedConfiguration(configuration);
    expect(computed.proxyUrl).toBe("https://127.0.0.1:7890");
  });

  it("disables proxy when proxyType is none", () => {
    const configuration = configurationSchema.parse({
      network: {
        useProxy: true,
        proxyType: ProxyType.NONE,
        proxy: "127.0.0.1:7890",
      },
    });

    const computed = buildComputedConfiguration(configuration);
    expect(computed.proxyUrl).toBeUndefined();
  });

  it("exports timeout and retry settings", () => {
    const configuration = configurationSchema.parse({
      network: {
        timeout: 25,
        retryCount: 4,
      },
    });

    const computed = buildComputedConfiguration(configuration);
    expect(computed.networkTimeoutMs).toBe(25_000);
    expect(computed.networkRetryCount).toBe(4);
  });
});
