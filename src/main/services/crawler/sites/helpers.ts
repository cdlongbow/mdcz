import type { CheerioAPI } from "cheerio";

import { extractList, extractText } from "../base/parser";

const buildLabelSelectors = (label: string): string[] => {
  return [
    `th:contains('${label}') + td`,
    `td:contains('${label}') + td`,
    `span:contains('${label}') + p`,
    `span:contains('${label}') + *`,
    `strong:contains('${label}') + a`,
    `strong:contains('${label}') + *`,
  ];
};

export const toAbsoluteUrl = (baseUrl: string, value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }

  if (value.startsWith("http")) {
    return value;
  }

  if (value.startsWith("//")) {
    return `https:${value}`;
  }

  return new URL(value, baseUrl).href;
};

export const normalizeFc2Number = (value: string): string => {
  return value
    .toUpperCase()
    .replaceAll("FC2PPV", "")
    .replaceAll("FC2-PPV-", "")
    .replaceAll("FC2-", "")
    .replaceAll("-", "")
    .trim();
};

/** @deprecated Use normalizeFc2Number instead — they are identical. */
export const normalizeFc2Digits = normalizeFc2Number;

export const extractByLabels = ($: CheerioAPI, labels: string[]): string | undefined => {
  for (const label of labels) {
    for (const selector of buildLabelSelectors(label)) {
      const value = extractText($, selector);
      if (value) {
        return value;
      }
    }
  }

  return undefined;
};

export const extractByLabel = ($: CheerioAPI, label: string): string | undefined => {
  return extractByLabels($, [label]);
};

export const extractLinksByLabels = ($: CheerioAPI, labels: string[]): string[] => {
  const result = new Set<string>();
  for (const label of labels) {
    for (const selector of buildLabelSelectors(label)) {
      const list = extractList($, `${selector} a`);
      list.forEach((item) => {
        result.add(item);
      });
    }
  }

  return Array.from(result);
};

export const normalizeCsv = (value: string | undefined): string[] => {
  if (!value) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  );
};

/**
 * 去重字符串数组。对每个元素 trim，过滤空字符串，然后 Set 去重。
 * 接受 string | undefined 元素（兼容 dmm/parsers.ts normalizeList 签名）。
 *
 * 行为决策：统一丢弃空字符串。原 airav.ts 的 unique() 理论上保留空字符串，
 * 但其调用处传入的数组均已预过滤，不存在空字符串元素，因此无行为差异。
 */
export const uniqueStrings = (values: Array<string | undefined>): string[] => {
  const cleaned = values.map((v) => v?.trim() ?? "").filter((v) => v.length > 0);
  return Array.from(new Set(cleaned));
};
