import type { ActorSourceProvider } from "@main/services/actorSource";
import { logActorSourceWarnings } from "@main/services/actorSource/logging";
import {
  createEmptyPersonSyncResult,
  formatPersonSyncError,
  runPersonSyncBatch,
} from "@main/services/common/personSync";
import type { Configuration } from "@main/services/config";
import { loggerService } from "@main/services/LoggerService";
import type { NetworkClient } from "@main/services/network";
import {
  normalizeExistingPersonSyncState,
  type PlannedPersonSyncState,
  planPersonSync,
} from "@main/services/personSync/planner";
import type { SignalService } from "@main/services/SignalService";
import {
  buildEmbyHeaders,
  buildEmbyUrl,
  type EmbyBatchResult,
  type EmbyMode,
  type EmbyPerson,
  fetchActorPersons,
  fetchPersonDetail,
  type ItemDetail,
  refreshPerson,
  resolveEmbyUserId,
  toEmbyServiceError,
  toStringArray,
  toStringRecord,
  toStringValue,
} from "./common";

export interface EmbyActorInfoDependencies {
  signalService: SignalService;
  networkClient: NetworkClient;
  actorSourceProvider: ActorSourceProvider;
}

export class EmbyActorInfoService {
  private readonly logger = loggerService.getLogger("EmbyActorInfo");

  private readonly networkClient: NetworkClient;

  constructor(private readonly deps: EmbyActorInfoDependencies) {
    this.networkClient = deps.networkClient;
  }

  async run(configuration: Configuration, mode: EmbyMode): Promise<EmbyBatchResult> {
    const resolvedUserId = await resolveEmbyUserId(this.networkClient, configuration);
    const persons = await fetchActorPersons(this.networkClient, configuration, {
      fields: ["Overview"],
      userId: resolvedUserId,
    });
    if (persons.length === 0) {
      return createEmptyPersonSyncResult();
    }

    const result = await runPersonSyncBatch({
      items: persons,
      signalService: this.deps.signalService,
      processItem: async (person) => {
        const detail = await fetchPersonDetail(this.networkClient, configuration, person, resolvedUserId);
        const existing = normalizeExistingPersonSyncState({
          overview: toStringValue(detail.Overview) ?? person.Overview,
          tags: toStringArray(detail.Tags),
          taglines: toStringArray(detail.Taglines),
          premiereDate: toStringValue(detail.PremiereDate),
          productionYear: typeof detail.ProductionYear === "number" ? detail.ProductionYear : undefined,
          productionLocations: toStringArray(detail.ProductionLocations),
        });

        const actorSource = await this.deps.actorSourceProvider.lookup(configuration, person.Name);
        logActorSourceWarnings(this.logger, person.Name, actorSource.warnings);
        const synced = planPersonSync(actorSource.profile, existing, mode);
        if (!synced.shouldUpdate) {
          return "skipped";
        }

        await this.updatePersonInfo(configuration, person, detail, synced);
        if (configuration.emby.refreshPersonAfterSync) {
          try {
            await refreshPerson(this.networkClient, configuration, person.Id);
          } catch (error) {
            this.logger.warn(
              `Failed to refresh Emby actor ${person.Name} after info sync: ${formatPersonSyncError(error)}`,
            );
          }
        }

        this.deps.signalService.showLogText(`Updated Emby actor info: ${person.Name}`);
        return "processed";
      },
      onError: (person, error) => {
        this.logger.warn(`Failed to update Emby actor info for ${person.Name}: ${formatPersonSyncError(error)}`);
      },
    });

    this.deps.signalService.showLogText(
      `Emby actor info sync completed. Total: ${persons.length}, Success: ${result.processedCount}, Failed: ${result.failedCount}, Skipped: ${result.skippedCount}`,
    );

    return result;
  }

  private buildUpdatePayload(
    person: EmbyPerson,
    detail: ItemDetail,
    synced: PlannedPersonSyncState,
  ): Record<string, unknown> {
    const hasOwn = (key: string): boolean => Object.hasOwn(detail, key);
    const payload: Record<string, unknown> = {
      Id: person.Id,
      Name: toStringValue(detail.Name) ?? person.Name,
      Overview: synced.overview ?? toStringValue(detail.Overview) ?? "",
      Tags: synced.tags,
      Taglines: synced.taglines,
    };

    if (hasOwn("ProviderIds")) {
      payload.ProviderIds = toStringRecord(detail.ProviderIds);
    }
    if (hasOwn("LockedFields")) {
      payload.LockedFields = toStringArray(detail.LockedFields);
    }
    if (typeof detail.LockData === "boolean") {
      payload.LockData = detail.LockData;
    }

    const serverId = toStringValue(detail.ServerId) ?? person.ServerId;
    if (serverId) {
      payload.ServerId = serverId;
    }

    const genres = toStringArray(detail.Genres);
    if (genres.length > 0) {
      payload.Genres = genres;
    }

    const type = toStringValue(detail.Type);
    if (type) {
      payload.Type = type;
    }

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

  private async updatePersonInfo(
    configuration: Configuration,
    person: EmbyPerson,
    detail: ItemDetail,
    synced: PlannedPersonSyncState,
  ): Promise<void> {
    const payload = this.buildUpdatePayload(person, detail, synced);
    const updateUrl = buildEmbyUrl(configuration, `/Items/${encodeURIComponent(person.Id)}`);

    try {
      await this.networkClient.postText(updateUrl, JSON.stringify(payload), {
        headers: buildEmbyHeaders(configuration, {
          "content-type": "application/json",
        }),
      });
    } catch (error) {
      throw toEmbyServiceError(
        error,
        {
          400: { code: "EMBY_BAD_REQUEST", message: `Emby 拒绝更新人物信息：${person.Name}` },
          401: { code: "EMBY_AUTH_FAILED", message: "Emby 凭据无效，无法写入人物信息" },
          403: { code: "EMBY_PERMISSION_DENIED", message: "当前 Emby 凭据没有人物写入权限" },
          404: { code: "EMBY_NOT_FOUND", message: `Emby 中不存在人物 ${person.Name}` },
        },
        {
          code: "EMBY_WRITE_FAILED",
          message: `写入 Emby 人物信息失败：${person.Name}`,
        },
      );
    }
  }
}
