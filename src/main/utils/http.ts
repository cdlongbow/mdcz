/**
 * HTTP-related utility functions
 */

/**
 * Parses a Retry-After header value to milliseconds
 * Supports both delay-seconds (integer) and HTTP-date formats
 *
 * @param rawValue - The raw Retry-After header value
 * @returns Delay in milliseconds, or null if invalid/not present
 */
export function parseRetryAfterMs(rawValue: string | null | undefined): number | null {
  if (!rawValue) {
    return null;
  }

  const trimmed = rawValue.trim();
  if (!trimmed) {
    return null;
  }

  // Try parsing as delay-seconds (integer)
  const delaySeconds = parseInt(trimmed, 10);
  if (!Number.isNaN(delaySeconds) && delaySeconds > 0) {
    return delaySeconds * 1000;
  }

  // Try parsing as HTTP-date
  const date = new Date(trimmed);
  if (!Number.isNaN(date.getTime())) {
    const delayMs = date.getTime() - Date.now();
    return delayMs > 0 ? delayMs : null;
  }

  return null;
}

/**
 * Reads the Retry-After header from various header formats
 * Handles both plain objects and Headers instances
 *
 * @param headers - Headers object (plain object, Headers instance, or unknown)
 * @returns The Retry-After header value, or null if not found
 */
export function readRetryAfterHeader(headers: unknown): string | null {
  if (!headers) {
    return null;
  }

  // Handle Headers instance (fetch API)
  if (typeof headers === "object" && "get" in headers && typeof headers.get === "function") {
    const value = headers.get("retry-after");
    return typeof value === "string" ? value : null;
  }

  // Handle plain object
  if (typeof headers === "object" && headers !== null) {
    const headersObj = headers as Record<string, unknown>;

    // Try exact case
    if ("retry-after" in headersObj) {
      const value = headersObj["retry-after"];
      return typeof value === "string" ? value : null;
    }

    // Try case-insensitive search
    for (const [key, value] of Object.entries(headersObj)) {
      if (key.toLowerCase() === "retry-after" && typeof value === "string") {
        return value;
      }
    }
  }

  return null;
}

/**
 * Extracts status code from various response formats
 */
export function getStatusCode(response: unknown): number | null {
  if (!response || typeof response !== "object") {
    return null;
  }

  const resp = response as Record<string, unknown>;

  if ("status" in resp && typeof resp.status === "number") {
    return resp.status;
  }

  if ("statusCode" in resp && typeof resp.statusCode === "number") {
    return resp.statusCode;
  }

  return null;
}

/**
 * Checks if a status code indicates a rate limit error
 */
export function isRateLimitStatus(statusCode: number): boolean {
  return statusCode === 429;
}

/**
 * Checks if a status code indicates a server error
 */
export function isServerError(statusCode: number): boolean {
  return statusCode >= 500 && statusCode < 600;
}

/**
 * Checks if a status code indicates a client error
 */
export function isClientError(statusCode: number): boolean {
  return statusCode >= 400 && statusCode < 500;
}

/**
 * Checks if a status code indicates success
 */
export function isSuccessStatus(statusCode: number): boolean {
  return statusCode >= 200 && statusCode < 300;
}
