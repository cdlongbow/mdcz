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
  it("detects region-blocked pages", () => {
    const html = `<html><head><title>このページはお住まいの地域からご利用になれません。 - FANZA</title></head></html>`;

    expect(isDmmRegionBlockedHtml(html)).toBe(true);
    expect(
      classifyDmmDetailFailure({
        html,
        siteLabel: "DMM",
      }),
    ).toBe("DMM: region blocked");
  });

  it("detects login-wall pages", () => {
    const html = `<html><head><title>FANZA ログイン</title></head><body><form><input name="login_id" /><input type="password" name="password" /></form></body></html>`;

    expect(isDmmLoginWallHtml(html)).toBe(true);
    expect(
      classifyDmmDetailFailure({
        html,
        siteLabel: "DMM_TV",
      }),
    ).toBe("DMM_TV: login wall");
  });

  it("detects unrendered next shell pages", () => {
    const html = `<html><body><script>self.__next_f.push([1,"shell"])</script></body></html>`;

    expect(isDmmUnrenderedShellHtml(html)).toBe(true);
    expect(
      classifyDmmDetailFailure({
        html,
        siteLabel: "DMM_TV",
      }),
    ).toBe("DMM_TV: unrendered shell");
  });

  it("returns null for normal metadata pages", () => {
    const html = `<html><head><title>正常頁</title><script type="application/ld+json">{"name":"title"}</script></head><body><h1 id="title">Normal Title</h1></body></html>`;

    expect(
      classifyDmmDetailFailure({
        html,
        siteLabel: "DMM",
      }),
    ).toBeNull();
  });

  it("detects metadata and usable html signals", () => {
    const html = `<html><body><h1 id="title">Detail</h1><table><tr><th>出演者</th><td>Actor</td></tr></table></body></html>`;

    expect(hasDmmMetadataSignals(html)).toBe(true);
    expect(isDmmNotFoundHtml(html)).toBe(false);
    expect(isDmmUsableDetailHtml(html)).toBe(true);
  });

  it("marks 404-style html as not usable", () => {
    const html = `<html><head><title>404 Not Found</title></head><body>お探しの商品は見つかりません</body></html>`;

    expect(isDmmNotFoundHtml(html)).toBe(true);
    expect(isDmmUsableDetailHtml(html)).toBe(false);
  });
});
