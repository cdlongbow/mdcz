import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { loggerService } from "@main/services/LoggerService";
import { parseRetryAfterMs } from "@main/utils/http";
import { type Browser, Impit, type RequestInit as ImpitRequestInit } from "impit";
import { RateLimiter } from "./RateLimiter";

const RETRY_STATUS_CODE = 429;
const RETRY_AFTER_CAP_MS = 15_000;
const RETRYABLE_STATUS_CODES = new Set([408, 500, 502, 503, 504]);
type ImpitResponse = Awaited<ReturnType<Impit["fetch"]>>;

export interface NetworkClientOptions {
  timeoutMs?: number;
  browserImpersonation?: Browser;
  getProxyUrl?: () => string | undefined;
  getTimeoutMs?: () => number | undefined;
  getRetryCount?: () => number | undefined;
  rateLimiter?: RateLimiter;
}

export class NetworkClient {
  private readonly logger = loggerService.getLogger("NetworkClient");

  private readonly options: Required<Pick<NetworkClientOptions, "timeoutMs" | "browserImpersonation">> &
    Pick<NetworkClientOptions, "getProxyUrl" | "getTimeoutMs" | "getRetryCount">;

  private readonly rateLimiter: RateLimiter;

  constructor(options: NetworkClientOptions = {}) {
    this.options = {
      timeoutMs: options.timeoutMs ?? 30_000,
      browserImpersonation: options.browserImpersonation ?? "chrome142",
      getProxyUrl: options.getProxyUrl,
      getTimeoutMs: options.getTimeoutMs,
      getRetryCount: options.getRetryCount,
    };
    this.rateLimiter = options.rateLimiter ?? new RateLimiter(5);
  }

  setDomainInterval(domain: string, intervalMs: number, intervalCap = 1, concurrency = 1): void {
    this.rateLimiter.setDomainInterval(domain, intervalMs, intervalCap, concurrency);
  }

  setDomainLimit(domain: string, requestsPerSecond: number, concurrency = 1): void {
    this.rateLimiter.setDomainLimit(domain, requestsPerSecond, concurrency);
  }

  async getText(url: string, init: Omit<ImpitRequestInit, "method"> = {}): Promise<string> {
    const response = await this.request(url, {
      ...init,
      method: "GET",
    });

    return response.text();
  }

  async getJson<T>(url: string, init: Omit<ImpitRequestInit, "method"> = {}): Promise<T> {
    const response = await this.request(url, {
      ...init,
      method: "GET",
    });

    return response.json() as Promise<T>;
  }

  async getContent(url: string, init: Omit<ImpitRequestInit, "method"> = {}): Promise<Uint8Array> {
    const response = await this.request(url, {
      ...init,
      method: "GET",
    });

    return response.bytes();
  }

  async postText(url: string, body: string, init: Omit<ImpitRequestInit, "method" | "body"> = {}): Promise<string> {
    const response = await this.request(url, {
      ...init,
      method: "POST",
      body,
    });

    return response.text();
  }

  async postJson<TResponse>(
    url: string,
    payload: unknown,
    init: Omit<ImpitRequestInit, "method" | "body"> = {},
  ): Promise<TResponse> {
    const headers = new Headers(init.headers);
    headers.set("content-type", "application/json");

    const response = await this.request(url, {
      ...init,
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    return response.json() as Promise<TResponse>;
  }

  async download(url: string, outputPath: string, init: Omit<ImpitRequestInit, "method"> = {}): Promise<string> {
    const bytes = await this.getContent(url, init);

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, Buffer.from(bytes));

    return outputPath;
  }

  async head(url: string, init: Omit<ImpitRequestInit, "method"> = {}): Promise<{ status: number; ok: boolean }> {
    const response = await this.request(url, {
      ...init,
      method: "HEAD",
    });

    return {
      status: response.status,
      ok: response.ok,
    };
  }

  private async request(url: string, init: ImpitRequestInit) {
    return this.rateLimiter.schedule(url, async () => {
      const maxRetries = this.resolveRetryCount();
      let attempt = 0;

      while (true) {
        const response = await this.fetchOnce(url, init);
        if (response.ok) {
          return response;
        }

        if (!this.shouldRetryResponse(response) || attempt >= maxRetries) {
          throw this.toHttpError(url, response);
        }

        const delayMs = this.getRetryDelayMs(response, attempt);
        attempt += 1;
        this.logger.warn(
          `Retrying ${url} (${attempt}/${maxRetries}) after ${delayMs}ms due to HTTP ${response.status}`,
        );
        await sleep(delayMs);
      }
    });
  }

  private async fetchOnce(url: string, init: ImpitRequestInit): Promise<ImpitResponse> {
    const client = this.createImpitClient();
    const headers = new Headers(init.headers);
    this.applyReferer(url, headers);

    return client.fetch(url, {
      ...init,
      timeout: init.timeout ?? this.resolveTimeoutMs(),
      headers,
    });
  }

  private toHttpError(url: string, response: ImpitResponse): Error {
    return new Error(`HTTP ${response.status} ${response.statusText} for ${url}`);
  }

  private getRetryAfterDelayMs(response: ImpitResponse): number | null {
    if (response.status !== RETRY_STATUS_CODE) {
      return null;
    }

    const rawRetryAfter = response.headers.get("retry-after");
    const parsed = parseRetryAfterMs(rawRetryAfter);
    if (parsed === null) {
      return null;
    }

    return Math.min(parsed, RETRY_AFTER_CAP_MS);
  }

  private shouldRetryResponse(response: ImpitResponse): boolean {
    if (response.status === RETRY_STATUS_CODE) {
      return this.getRetryAfterDelayMs(response) !== null;
    }

    return RETRYABLE_STATUS_CODES.has(response.status);
  }

  private getRetryDelayMs(response: ImpitResponse, attempt: number): number {
    const retryAfterMs = this.getRetryAfterDelayMs(response);
    if (retryAfterMs !== null) {
      return retryAfterMs;
    }

    return Math.min(1000 * 2 ** attempt, RETRY_AFTER_CAP_MS);
  }

  private resolveTimeoutMs(): number {
    const value = this.options.getTimeoutMs?.() ?? this.options.timeoutMs;
    return Math.max(1, Math.trunc(value));
  }

  private resolveRetryCount(): number {
    const value = this.options.getRetryCount?.();
    if (value === undefined) {
      return 1;
    }

    return Math.max(0, Math.trunc(value));
  }

  private createImpitClient(): Impit {
    return new Impit({
      browser: this.options.browserImpersonation,
      timeout: this.resolveTimeoutMs(),
      proxyUrl: this.options.getProxyUrl?.(),
      followRedirects: true,
      vanillaFallback: true,
      http3: false,
    });
  }

  private applyReferer(url: string, headers: Headers): void {
    const hostname = new URL(url).hostname;

    if (headers.has("referer")) {
      return;
    }

    if (hostname.includes("javdb")) {
      headers.set("referer", "https://javdb.com/");
      return;
    }

    if (hostname.includes("javbus")) {
      headers.set("referer", "https://www.javbus.com/");
      return;
    }

    headers.set("referer", `${new URL(url).origin}/`);
  }
}
