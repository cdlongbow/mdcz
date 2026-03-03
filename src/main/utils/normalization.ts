/**
 * Shared normalization utilities for text processing
 */

/**
 * Normalizes a code/number string by removing common separators and converting to uppercase
 * Used for comparing video codes, product IDs, etc.
 */
export function normalizeCode(value: string | undefined | null): string {
  if (!value) {
    return "";
  }
  return value
    .trim()
    .replace(/[\s\-_]+/g, "")
    .toUpperCase();
}

/**
 * Normalizes a number string by removing separators
 */
export function normalizeNumber(value: string | undefined | null): string {
  if (!value) {
    return "";
  }
  return value.trim().replace(/[\s\-_]+/g, "");
}

/**
 * Normalizes text for general comparison by trimming and collapsing whitespace
 */
export function normalizeText(value: string | undefined | null): string {
  if (!value) {
    return "";
  }
  return value.trim().replace(/\s+/g, " ");
}

/**
 * Normalizes text for keyword comparison by removing all whitespace and converting to lowercase
 */
export function normalizeKeyword(value: string | undefined | null): string {
  if (!value) {
    return "";
  }
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

/**
 * Normalizes text for comparable matching (case-insensitive, whitespace-collapsed)
 */
export function normalizeComparableText(value: string | undefined | null): string {
  if (!value) {
    return "";
  }
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Extracts and normalizes a number from text (e.g., "123 min" -> "123")
 */
export function extractNumber(value: string | undefined | null): string {
  if (!value) {
    return "";
  }
  const match = value.match(/\d+/);
  return match ? match[0] : "";
}

/**
 * Normalizes a URL by trimming and ensuring it has a protocol
 */
export function normalizeUrl(value: string | undefined | null): string {
  if (!value) {
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}
