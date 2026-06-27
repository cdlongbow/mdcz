import { describe, expect, it } from "vitest";

import { DEFAULT_SERVER_HOST, DEFAULT_SERVER_PORT, parseHost, parsePort } from "./config";

describe("parsePort", () => {
  it("uses the default server port when no value is provided", () => {
    expect(parsePort(undefined)).toBe(DEFAULT_SERVER_PORT);
  });

  it("parses a valid configured port", () => {
    expect(parsePort("4000")).toBe(4000);
  });

  it("rejects invalid configured ports", () => {
    expect(() => parsePort("0")).toThrow("Invalid PORT value: 0");
    expect(() => parsePort("65536")).toThrow("Invalid PORT value: 65536");
    expect(() => parsePort("4000abc")).toThrow("Invalid PORT value: 4000abc");
    expect(() => parsePort("not-a-port")).toThrow("Invalid PORT value: not-a-port");
  });
});

describe("parseHost", () => {
  it("uses the default server host when no value is provided", () => {
    expect(parseHost(undefined)).toBe(DEFAULT_SERVER_HOST);
    expect(parseHost("")).toBe(DEFAULT_SERVER_HOST);
  });

  it("accepts IPv4, IPv6 and hostname forms", () => {
    expect(parseHost("0.0.0.0")).toBe("0.0.0.0");
    expect(parseHost("127.0.0.1")).toBe("127.0.0.1");
    expect(parseHost("::1")).toBe("::1");
    expect(parseHost("localhost")).toBe("localhost");
    expect(parseHost("my-server.example.com")).toBe("my-server.example.com");
    expect(parseHost("  0.0.0.0  ")).toBe("0.0.0.0");
  });

  it("rejects malformed hosts", () => {
    expect(() => parseHost("bad host")).toThrow("Invalid MDCZ_HOST value: bad host");
    expect(() => parseHost("http://example.com")).toThrow("Invalid MDCZ_HOST value: http://example.com");
    expect(() => parseHost("[::1]")).toThrow("Invalid MDCZ_HOST value: [::1]");
    expect(() => parseHost(`${"a".repeat(254)}`)).toThrow(/Invalid MDCZ_HOST value/);
  });
});
