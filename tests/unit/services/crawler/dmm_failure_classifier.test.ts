import {
  classifyDmmDetailFailure,
  hasDmmMetadataSignals,
  isDmmLoginWallHtml,
  isDmmNotFoundHtml,
  isDmmRegionBlockedHtml,
  isDmmUnrenderedShellHtml,
  isDmmUsableDetailHtml,
} from "@main/services/crawler/sites/dmm/failureClassifier";
import { describe, expect, it } from "vitest";

describe("DMM failure classifier", () => {
  it("classifies known failure pages", () => {
    const cases = [
      {
        html: `<html><head><title>このページはお住まいの地域からご利用になれません。 - FANZA</title></head></html>`,
        detector: isDmmRegionBlockedHtml,
        expected: "DMM: region blocked",
        siteLabel: "DMM" as const,
      },
      {
        html: `<html><head><title>FANZA ログイン</title></head><body><form><input name="login_id" /><input type="password" name="password" /></form></body></html>`,
        detector: isDmmLoginWallHtml,
        expected: "DMM_TV: login wall",
        siteLabel: "DMM_TV" as const,
      },
      {
        html: `<html><body><script>self.__next_f.push([1,"shell"])</script></body></html>`,
        detector: isDmmUnrenderedShellHtml,
        expected: "DMM_TV: unrendered shell",
        siteLabel: "DMM_TV" as const,
      },
    ];

    for (const { html, detector, expected, siteLabel } of cases) {
      expect(detector(html)).toBe(true);
      expect(
        classifyDmmDetailFailure({
          html,
          siteLabel,
        }),
      ).toBe(expected);
    }
  });

  it("recognizes usable metadata pages and rejects 404-style detail html", () => {
    const usableHtml = `<html><head><title>正常頁</title><script type="application/ld+json">{"name":"title"}</script></head><body><h1 id="title">Normal Title</h1><table><tr><th>出演者</th><td>Actor</td></tr></table></body></html>`;
    const notFoundHtml = `<html><head><title>404 Not Found</title></head><body>お探しの商品は見つかりません</body></html>`;

    expect(classifyDmmDetailFailure({ html: usableHtml, siteLabel: "DMM" })).toBeNull();
    expect(hasDmmMetadataSignals(usableHtml)).toBe(true);
    expect(isDmmUsableDetailHtml(usableHtml)).toBe(true);

    expect(isDmmNotFoundHtml(notFoundHtml)).toBe(true);
    expect(isDmmUsableDetailHtml(notFoundHtml)).toBe(false);
  });
});
