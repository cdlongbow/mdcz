import { loggerService } from "@main/services/LoggerService";
import { Website } from "@shared/enums";

import type { AdapterDependencies, CrawlerInput, CrawlerResponse, SiteAdapter } from "./base/types";
import type { FetchGateway } from "./FetchGateway";
import { getCrawlerConstructor, listRegisteredCrawlerSites } from "./registry";

export interface CrawlerProviderOptions {
  fetchGateway: FetchGateway;
}

interface SiteFailureState {
  count: number;
  lastFailedAt: number;
  openUntil: number | null;
  halfOpen: boolean;
}

const FAILURE_THRESHOLD = 5;
const CIRCUIT_OPEN_MS = 60_000;

export class CrawlerProvider {
  private readonly logger = loggerService.getLogger("CrawlerProvider");

  private readonly dependencies: AdapterDependencies;

  private readonly cache = new Map<Website, SiteAdapter>();

  private readonly failureCounter = new Map<Website, SiteFailureState>();

  constructor(options: CrawlerProviderOptions) {
    this.dependencies = {
      gateway: options.fetchGateway,
    };
  }

  getCrawler(site: Website): SiteAdapter | null {
    const cached = this.cache.get(site);
    if (cached) {
      return cached;
    }

    const crawlerConstructor = getCrawlerConstructor(site);
    if (!crawlerConstructor) {
      return null;
    }

    const crawler = new crawlerConstructor(this.dependencies);
    this.cache.set(site, crawler);
    return crawler;
  }

  async crawl(input: CrawlerInput): Promise<CrawlerResponse> {
    const startedAt = Date.now();

    if (!this.canAttempt(input.site)) {
      return {
        input,
        result: {
          success: false,
          error: `Crawler for site '${input.site}' is temporarily unavailable (site circuit open)`,
          failureReason: "unknown",
        },
        elapsedMs: Date.now() - startedAt,
      };
    }

    const crawler = this.getCrawler(input.site);
    if (!crawler) {
      return {
        input,
        result: {
          success: false,
          error: `Crawler for site '${input.site}' is not implemented in Node.js`,
          failureReason: "unknown",
        },
        elapsedMs: Date.now() - startedAt,
      };
    }

    try {
      const response = await crawler.crawl(input);

      if (response.result.success) {
        this.resetSiteFailure(input.site);
      } else if (response.result.failureReason !== "not_found") {
        this.recordSiteFailure(input.site);
      }

      return response;
    } catch (error) {
      this.recordSiteFailure(input.site);

      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Crawler threw for ${input.site}: ${message}`);

      return {
        input,
        result: {
          success: false,
          error: message,
          failureReason: "unknown",
          cause: error,
        },
        elapsedMs: Date.now() - startedAt,
      };
    }
  }

  getCircuitState(site: Website): "closed" | "open" | "half_open" {
    const state = this.failureCounter.get(site);
    if (!state) return "closed";
    if (state.halfOpen) return "half_open";
    if (state.openUntil && Date.now() < state.openUntil) return "open";
    return "closed";
  }

  listSites(): { site: Website; native: boolean }[] {
    const nativeSites = new Set(listRegisteredCrawlerSites());

    return (Object.values(Website) as Website[]).map((site) => ({
      site,
      native: nativeSites.has(site),
    }));
  }

  private canAttempt(site: Website): boolean {
    const state = this.failureCounter.get(site);
    if (!state || !state.openUntil) {
      return true;
    }

    const now = Date.now();
    if (now < state.openUntil) {
      return false;
    }

    state.openUntil = null;
    state.halfOpen = true;
    this.failureCounter.set(site, state);
    return true;
  }

  private recordSiteFailure(site: Website): void {
    const now = Date.now();
    const current = this.failureCounter.get(site) ?? {
      count: 0,
      lastFailedAt: now,
      openUntil: null,
      halfOpen: false,
    };

    current.lastFailedAt = now;

    if (current.halfOpen) {
      current.count = FAILURE_THRESHOLD;
      current.halfOpen = false;
    } else {
      current.count += 1;
    }

    if (current.count >= FAILURE_THRESHOLD) {
      current.openUntil = now + CIRCUIT_OPEN_MS;
      this.logger.warn(`Circuit opened for ${site} after ${current.count} failures`);
    }

    this.failureCounter.set(site, current);
  }

  private resetSiteFailure(site: Website): void {
    this.failureCounter.delete(site);
  }
}
