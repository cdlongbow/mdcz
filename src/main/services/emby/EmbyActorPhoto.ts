import type { ActorSourceProvider } from "@main/services/actorSource";
import { logActorSourceWarnings } from "@main/services/actorSource/logging";
import {
  createEmptyPersonSyncResult,
  formatPersonSyncError,
  loadPrimaryImageFromSource,
  runPersonSyncBatch,
} from "@main/services/common/personSync";
import type { Configuration } from "@main/services/config";
import { assertLocalActorImageSourceReady } from "@main/services/config/actorPhotoPath";
import { loggerService } from "@main/services/LoggerService";
import type { NetworkClient } from "@main/services/network";
import type { SignalService } from "@main/services/SignalService";
import {
  buildEmbyHeaders,
  buildEmbyUrl,
  type EmbyBatchResult,
  type EmbyMode,
  fetchActorPersons,
  getHttpStatus,
  hasPrimaryImage,
  refreshPerson,
  resolveEmbyUserId,
  toEmbyServiceError,
} from "./common";

export interface EmbyActorPhotoDependencies {
  signalService: SignalService;
  networkClient: NetworkClient;
  actorSourceProvider: ActorSourceProvider;
}

const uploadPrimaryImage = async (
  networkClient: NetworkClient,
  configuration: Configuration,
  personId: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> => {
  const primaryPath = `/Items/${encodeURIComponent(personId)}/Images/Primary`;
  const body = Buffer.from(bytes).toString("base64");
  const headers = buildEmbyHeaders(configuration, {
    "content-type": contentType,
  });
  const uploadError = {
    code: "EMBY_WRITE_FAILED",
    message: "上传 Emby 人物头像失败",
  };
  const uploadStatusMappings = {
    400: { code: "EMBY_BAD_REQUEST", message: "Emby 拒绝了人物头像上传请求" },
    401: { code: "EMBY_AUTH_FAILED", message: "Emby API Key 无效，无法上传人物头像" },
    403: { code: "EMBY_ADMIN_KEY_REQUIRED", message: "Emby 人物头像上传需要管理员 API Key" },
    415: { code: "EMBY_UNSUPPORTED_MEDIA", message: "Emby 不接受当前头像文件类型" },
  };

  try {
    await networkClient.postText(buildEmbyUrl(configuration, primaryPath), body, { headers });
    return;
  } catch (error) {
    const status = getHttpStatus(error);
    if (status !== 400 && status !== 404 && status !== 405) {
      throw toEmbyServiceError(error, uploadStatusMappings, uploadError);
    }
  }

  try {
    await networkClient.postText(buildEmbyUrl(configuration, primaryPath, { Index: "0" }), body, { headers });
  } catch (error) {
    throw toEmbyServiceError(
      error,
      {
        ...uploadStatusMappings,
        404: { code: "EMBY_NOT_FOUND", message: "Emby 无法找到需要写入头像的人物" },
      },
      uploadError,
    );
  }
};

export class EmbyActorPhotoService {
  private readonly logger = loggerService.getLogger("EmbyActorPhoto");

  private readonly networkClient: NetworkClient;

  constructor(private readonly deps: EmbyActorPhotoDependencies) {
    this.networkClient = deps.networkClient;
  }

  async run(configuration: Configuration, mode: EmbyMode): Promise<EmbyBatchResult> {
    assertLocalActorImageSourceReady(configuration);

    const resolvedUserId = await resolveEmbyUserId(this.networkClient, configuration);
    const persons = await fetchActorPersons(this.networkClient, configuration, {
      userId: resolvedUserId,
    });
    if (persons.length === 0) {
      return createEmptyPersonSyncResult();
    }

    const result = await runPersonSyncBatch({
      items: persons,
      signalService: this.deps.signalService,
      processItem: async (person) => {
        const actorName = person.Name.trim();
        if (mode === "missing" && hasPrimaryImage(person)) {
          return "skipped";
        }

        if (!actorName) {
          return "skipped";
        }

        const actorSource = await this.deps.actorSourceProvider.lookup(configuration, {
          name: actorName,
          requiredField: "photo_url",
        });
        logActorSourceWarnings(this.logger, actorName, actorSource.warnings);
        const image = await loadPrimaryImageFromSource(this.networkClient, actorSource.profile.photo_url);

        if (!image) {
          this.deps.signalService.showLogText(`No Emby actor photo source found for ${actorName}`, "warn");
          return "skipped";
        }

        await uploadPrimaryImage(this.networkClient, configuration, person.Id, image.content, image.contentType);
        if (configuration.emby.refreshPersonAfterSync) {
          try {
            await refreshPerson(this.networkClient, configuration, person.Id);
          } catch (error) {
            this.logger.warn(
              `Failed to refresh Emby actor ${person.Name} after photo sync: ${formatPersonSyncError(error)}`,
            );
          }
        }

        this.deps.signalService.showLogText(`Updated Emby actor photo: ${actorName}`);
        return "processed";
      },
      onError: (person, error) => {
        const actorName = person.Name.trim() || person.Name;
        this.logger.warn(`Failed to update Emby actor photo for ${actorName}: ${formatPersonSyncError(error)}`);
      },
    });

    this.deps.signalService.showLogText(
      `Emby actor photo sync completed. Total: ${persons.length}, Success: ${result.processedCount}, Failed: ${result.failedCount}, Skipped: ${result.skippedCount}`,
    );

    return result;
  }
}
