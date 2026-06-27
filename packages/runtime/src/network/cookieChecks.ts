import type { Configuration } from "@mdcz/shared/config";
import { toErrorMessage } from "../shared";

interface CookieCheckNetworkClient {
  getText(url: string, init?: { headers?: Record<string, string> }): Promise<string>;
}

export interface CookieCheckResult {
  site: string;
  valid: boolean;
  message: string;
}

const checkJavdbCookie = async (
  cookie: string,
  networkClient: CookieCheckNetworkClient,
): Promise<CookieCheckResult> => {
  if (!cookie) {
    return { site: "JavDB", valid: false, message: "未配置 Cookie" };
  }

  try {
    const html = await networkClient.getText("https://javdb.com/users/profile", {
      headers: { cookie },
    });
    const valid = !html.includes('href="/login"') && !html.includes("sign_in");
    return { site: "JavDB", valid, message: valid ? "Cookie 有效" : "Cookie 无效或已过期" };
  } catch (error) {
    return { site: "JavDB", valid: false, message: `请求失败: ${toErrorMessage(error)}` };
  }
};

const checkJavbusCookie = async (
  cookie: string,
  networkClient: CookieCheckNetworkClient,
): Promise<CookieCheckResult> => {
  if (!cookie) {
    return { site: "JavBus", valid: false, message: "未配置 Cookie" };
  }

  try {
    const html = await networkClient.getText("https://www.javbus.com/forum/", {
      headers: { cookie },
    });
    const valid = !html.includes('login"') || html.includes("logout");
    return { site: "JavBus", valid, message: valid ? "Cookie 有效" : "Cookie 无效或已过期" };
  } catch (error) {
    return { site: "JavBus", valid: false, message: `请求失败: ${toErrorMessage(error)}` };
  }
};

export const checkConfiguredSiteCookies = async (
  configuration: Configuration,
  networkClient: CookieCheckNetworkClient,
): Promise<{ results: CookieCheckResult[] }> => {
  const [javdb, javbus] = await Promise.all([
    checkJavdbCookie(configuration.network.javdbCookie.trim(), networkClient),
    checkJavbusCookie(configuration.network.javbusCookie.trim(), networkClient),
  ]);

  return { results: [javdb, javbus] };
};
