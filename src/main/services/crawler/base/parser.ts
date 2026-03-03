import { normalizeText } from "@main/utils/normalization";
import type { CheerioAPI } from "cheerio";

const toPaddedDate = (year: string, month: string, day: string): string => {
  const paddedMonth = month.padStart(2, "0");
  const paddedDay = day.padStart(2, "0");
  return `${year}-${paddedMonth}-${paddedDay}`;
};

export const extractText = (root: CheerioAPI, selector: string): string | undefined => {
  const el = root(selector).first().clone();
  el.find("script, style, noscript").remove();
  const value = normalizeText(el.text());
  return value.length > 0 ? value : undefined;
};

export const extractAttr = (root: CheerioAPI, selector: string, attribute: string): string | undefined => {
  const value = root(selector).first().attr(attribute);
  if (!value) {
    return undefined;
  }

  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : undefined;
};

export const extractList = (root: CheerioAPI, selector: string): string[] => {
  const values = root(selector)
    .map((_, element) => normalizeText(root(element).text()))
    .get()
    .filter((value) => value.length > 0);

  return Array.from(new Set(values));
};

export const parseDate = (value: string | null | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }

  const normalized = value
    .replace(/[年./]/gu, "-")
    .replace(/[月]/gu, "-")
    .replace(/[日号]/gu, "")
    .replace(/\s+/gu, "")
    .trim();

  if (normalized.length === 0) {
    return undefined;
  }

  const ymdWithSeparator = normalized.match(/(\d{4})-(\d{1,2})-(\d{1,2})/u);
  if (ymdWithSeparator) {
    return toPaddedDate(ymdWithSeparator[1], ymdWithSeparator[2], ymdWithSeparator[3]);
  }

  const ymdCompact = normalized.match(/(\d{4})(\d{2})(\d{2})/u);
  if (ymdCompact) {
    return toPaddedDate(ymdCompact[1], ymdCompact[2], ymdCompact[3]);
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  const year = String(parsed.getUTCFullYear());
  const month = String(parsed.getUTCMonth() + 1);
  const day = String(parsed.getUTCDate());
  return toPaddedDate(year, month, day);
};

export const parseRuntime = (value: string | null | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) {
    return undefined;
  }

  const hhmmssMatch = normalized.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/u);
  if (hhmmssMatch) {
    const hours = hhmmssMatch[3] ? Number(hhmmssMatch[1]) : 0;
    const minutes = hhmmssMatch[3] ? Number(hhmmssMatch[2]) : Number(hhmmssMatch[1]);
    const seconds = hhmmssMatch[3] ? Number(hhmmssMatch[3]) : Number(hhmmssMatch[2]);
    return Math.max(0, Math.round(hours * 60 + minutes + seconds / 60));
  }

  const hourMinuteMatch = normalized.match(/(\d+(?:\.\d+)?)\s*h(?:our|ours)?\s*(\d+(?:\.\d+)?)?\s*m?/u);
  if (hourMinuteMatch) {
    const hours = Number(hourMinuteMatch[1]);
    const minutes = Number(hourMinuteMatch[2] ?? "0");
    return Math.max(0, Math.round(hours * 60 + minutes));
  }

  const minuteMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:min|mins|minute|minutes|m|分|分钟)/u);
  if (minuteMatch) {
    return Math.max(0, Math.round(Number(minuteMatch[1])));
  }

  const numericMatch = normalized.match(/\d+(?:\.\d+)?/u);
  if (numericMatch) {
    return Math.max(0, Math.round(Number(numericMatch[0])));
  }

  return undefined;
};
