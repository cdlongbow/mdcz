import type { ActorSourceProvider } from "@main/services/actorSource";
import { logActorSourceWarnings } from "@main/services/actorSource/logging";
import type { Configuration } from "@main/services/config";
import { loggerService } from "@main/services/LoggerService";
import type { NetworkClient } from "@main/services/network";
import {
  hasMissingActorInfo,
  normalizeExistingPersonSyncState,
  type PlannedPersonSyncState,
  planPersonSync,
} from "@main/services/personSync/planner";
import type { SignalService } from "@main/services/SignalService";

import {
  buildApiUrl,
  type EmbyBatchResult,
  type EmbyMode,
  type EmbyPerson,
  EmbyServiceError,
  fetchPersons,
  toStringArray,
  toStringRecord,
} from "./common";

type ItemDetail = Record<string, unknown>;

export interface EmbyActorInfoDependencies {
  signalService: SignalService;
  networkClient: NetworkClient;
  actorSourceProvider: ActorSourceProvider;
}

const toStringValue = (value: unknown): string | undefined => {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
};

export class EmbyActorInfo {
  private readonly logger = loggerService.getLogger("EmbyActorInfo");

  private readonly networkClient: NetworkClient;

  constructor(private readonly deps: EmbyActorInfoDependencies) {
    this.networkClient = deps.networkClient;
  }

  async run(configuration: Configuration, mode: EmbyMode): Promise<EmbyBatchResult> {
    const persons = await fetchPersons(this.networkClient, configuration);
    const total = persons.length;

    if (total === 0) {
      return {
        processedCount: 0,
        failedCount: 0,
      };
    }

    let processedCount = 0;
    let failedCount = 0;
    let current = 0;

    for (const person of persons) {
      current += 1;
      this.deps.signalService.setProgress(Math.round((current / total) * 100), current, total);

      try {
        const detail = await this.fetchDetail(configuration, person);
        const existing = normalizeExistingPersonSyncState({
          overview: toStringValue(detail.Overview),
          tags: toStringArray(detail.Tags),
          taglines: toStringArray(detail.Taglines),
          premiereDate: toStringValue(detail.PremiereDate),
          productionYear: typeof detail.ProductionYear === "number" ? detail.ProductionYear : undefined,
          productionLocations: toStringArray(detail.ProductionLocations),
        });

        if (mode === "missing" && !hasMissingActorInfo(existing)) {
          continue;
        }

        const actorSource = await this.deps.actorSourceProvider.lookup(configuration, person.Name);
        logActorSourceWarnings(this.logger, person.Name, actorSource.warnings);
        const synced = planPersonSync(actorSource.profile, existing, mode);
        if (!synced.shouldUpdate) {
          continue;
        }

        const payload = this.buildUpdatePayload(person, detail, synced);
        const updateUrl = buildApiUrl(configuration, `/Items/${encodeURIComponent(person.Id)}`);

        await this.networkClient.postText(updateUrl, JSON.stringify(payload), {
          headers: {
            "content-type": "application/json",
          },
        });

        processedCount += 1;
        this.deps.signalService.showLogText(`Updated actor info: ${person.Name}`);
      } catch (error) {
        failedCount += 1;
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Failed to update actor info for ${person.Name}: ${message}`);
      }
    }

    this.deps.signalService.showLogText(
      `Actor info sync completed. Success: ${processedCount}, Failed: ${failedCount}`,
    );

    return {
      processedCount,
      failedCount,
    };
  }

  private async fetchDetail(configuration: Configuration, person: EmbyPerson): Promise<ItemDetail> {
    const detailUrl = buildApiUrl(configuration, `/Items/${encodeURIComponent(person.Id)}`);

    try {
      const detail = await this.networkClient.getJson<ItemDetail>(detailUrl, {
        headers: {
          accept: "application/json",
        },
      });

      return detail;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new EmbyServiceError("EMBY_UNREACHABLE", `Failed to fetch actor detail for ${person.Name}: ${message}`);
    }
  }

  private buildUpdatePayload(
    person: EmbyPerson,
    detail: ItemDetail,
    synced: PlannedPersonSyncState,
  ): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      Name: toStringValue(detail.Name) ?? person.Name,
      ServerId: toStringValue(detail.ServerId) ?? person.ServerId ?? "",
      Id: person.Id,
      Genres: toStringArray(detail.Genres),
      Tags: synced.tags,
      ProviderIds: toStringRecord(detail.ProviderIds),
      Overview: synced.overview ?? "",
      Taglines: synced.taglines,
    };

    if (synced.productionLocations && synced.productionLocations.length > 0) {
      payload.ProductionLocations = synced.productionLocations;
    }

    if (synced.premiereDate) {
      payload.PremiereDate = synced.premiereDate;
    }

    if (synced.productionYear !== undefined) {
      payload.ProductionYear = synced.productionYear;
    }

    return payload;
  }
}
