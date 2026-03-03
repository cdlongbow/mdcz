/**
 * Retry handler for HTTP requests with exponential backoff and Retry-After support
 */

import { getStatusCode, parseRetryAfterMs, readRetryAfterHeader } from "./http.js";

export interface RetryOptions {
  /**
   * Maximum number of retry attempts
   */
  maxRetries?: number;

  /**
   * Initial delay in milliseconds before first retry
   */
  initialDelayMs?: number;

  /**
   * Maximum delay in milliseconds between retries
   */
  maxDelayMs?: number;

  /**
   * Multiplier for exponential backoff
   */
  backoffMultiplier?: number;

  /**
   * Status codes that should trigger a retry
   */
  retryStatusCodes?: number[];

  /**
   * Maximum time to wait for Retry-After header (in milliseconds)
   */
  maxRetryAfterMs?: number;

  /**
   * Custom function to determine if an error should be retried
   */
  shouldRetry?: (error: unknown, attempt: number) => boolean;

  /**
   * Callback invoked before each retry
   */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, "shouldRetry" | "onRetry">> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryStatusCodes: [429, 500, 502, 503, 504],
  maxRetryAfterMs: 60000,
};

/**
 * Executes a function with retry logic, supporting exponential backoff and Retry-After headers
 */
export class RetryHandler {
  private options: Required<Omit<RetryOptions, "shouldRetry" | "onRetry">> &
    Pick<RetryOptions, "shouldRetry" | "onRetry">;

  constructor(options: RetryOptions = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };
  }

  /**
   * Executes a request with retry logic
   */
  async executeWithRetry<T>(request: () => Promise<T>, options?: Partial<RetryOptions>): Promise<T> {
    const opts = { ...this.options, ...options };
    let lastError: unknown;

    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
      try {
        return await request();
      } catch (error) {
        lastError = error;

        // Check if we should retry
        if (attempt >= opts.maxRetries) {
          break;
        }

        // Check custom retry condition
        if (opts.shouldRetry && !opts.shouldRetry(error, attempt)) {
          break;
        }

        // Check if error has a status code that should be retried
        const statusCode = this.extractStatusCode(error);
        if (statusCode !== null && !opts.retryStatusCodes.includes(statusCode)) {
          break;
        }

        // Calculate delay
        const delayMs = this.calculateDelay(error, attempt, opts);

        // Invoke retry callback
        if (opts.onRetry) {
          opts.onRetry(error, attempt + 1, delayMs);
        }

        // Wait before retrying
        await this.sleep(delayMs);
      }
    }

    throw lastError;
  }

  /**
   * Calculates the delay before the next retry attempt
   */
  private calculateDelay(
    error: unknown,
    attempt: number,
    options: Required<Omit<RetryOptions, "shouldRetry" | "onRetry">>,
  ): number {
    // Check for Retry-After header
    const retryAfterMs = this.extractRetryAfter(error);
    if (retryAfterMs !== null && retryAfterMs <= options.maxRetryAfterMs) {
      return retryAfterMs;
    }

    // Use exponential backoff
    const exponentialDelay = options.initialDelayMs * options.backoffMultiplier ** attempt;
    return Math.min(exponentialDelay, options.maxDelayMs);
  }

  /**
   * Extracts the status code from an error
   */
  private extractStatusCode(error: unknown): number | null {
    if (!error || typeof error !== "object") {
      return null;
    }

    const err = error as Record<string, unknown>;

    // Check response.status
    if ("response" in err) {
      const statusCode = getStatusCode(err.response);
      if (statusCode !== null) {
        return statusCode;
      }
    }

    // Check direct status/statusCode
    return getStatusCode(error);
  }

  /**
   * Extracts Retry-After delay from an error
   */
  private extractRetryAfter(error: unknown): number | null {
    if (!error || typeof error !== "object") {
      return null;
    }

    const err = error as Record<string, unknown>;

    // Check response.headers
    if ("response" in err && typeof err.response === "object" && err.response !== null) {
      const response = err.response as Record<string, unknown>;
      if ("headers" in response) {
        const retryAfterValue = readRetryAfterHeader(response.headers);
        return parseRetryAfterMs(retryAfterValue);
      }
    }

    // Check direct headers
    if ("headers" in err) {
      const retryAfterValue = readRetryAfterHeader(err.headers);
      return parseRetryAfterMs(retryAfterValue);
    }

    return null;
  }

  /**
   * Sleeps for the specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Creates a retry handler with default options
 */
export function createRetryHandler(options?: RetryOptions): RetryHandler {
  return new RetryHandler(options);
}

/**
 * Convenience function to execute a request with retry logic
 */
export async function withRetry<T>(request: () => Promise<T>, options?: RetryOptions): Promise<T> {
  const handler = new RetryHandler(options);
  return handler.executeWithRetry(request);
}
