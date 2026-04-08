const normalizeWhitespace = (value: string): string => value.replace(/\s+/gu, " ").trim();
const stripImpitPrefix = (value: string): string => value.replace(/^impit error:\s*/iu, "").trim();
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isMissingMessage = (value: string): boolean =>
  value.trim().length === 0 || value === "null" || value === "undefined";

const extractLastMatch = (value: string, pattern: RegExp): string | undefined => {
  const matches = Array.from(value.matchAll(pattern));
  return matches.at(-1)?.[1];
};

const summarizeImpitError = (message: string): string | null => {
  const flattened = normalizeWhitespace(message);
  const normalized = stripImpitPrefix(flattened);
  const nestedError = extractLastMatch(normalized, /\berror:\s*"([^"]+)"/giu);
  const osMessage = extractLastMatch(normalized, /\bmessage:\s*"([^"]+)"/giu);
  const detail = nestedError ?? osMessage;

  if (/^(?:ConnectError:\s*)?Failed to connect to the server\.?/iu.test(normalized)) {
    return detail ? `ConnectError: ${detail}` : "ConnectError: failed to connect to the server";
  }

  if (/^impit error:/iu.test(flattened)) {
    return normalized;
  }

  return null;
};

export function formatErrorMessage(message: string): string {
  const summarizedImpitError = summarizeImpitError(message);
  if (summarizedImpitError) {
    return summarizedImpitError;
  }

  return normalizeWhitespace(message);
}

export function toErrorMessage(error: unknown, fallbackMessage?: string): string {
  let message: string;

  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "string") {
    message = error;
  } else if (isRecord(error) && typeof error.message === "string") {
    message = error.message;
  } else {
    message = String(error);
  }

  const formatted = formatErrorMessage(message);
  return fallbackMessage && isMissingMessage(formatted) ? fallbackMessage : formatted;
}
