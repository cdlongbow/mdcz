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
import { buildJellyfinHeaders, buildJellyfinUrl, type JellyfinMode } from "./auth";
import { getHttpStatus, toJellyfinServiceError } from "./errors";
import { fetchPersons, type JellyfinBatchResult, type JellyfinPerson, refreshPerson } from "./people";

export interface JellyfinActorPhotoDependencies {
  signalService: SignalService;
  networkClient: NetworkClient;
  actorSourceProvider: ActorSourceProvider;
}

const hasPrimaryImage = (person: JellyfinPerson): boolean => {
  const primary = person.ImageTags?.Primary;
  return typeof primary === "string" && primary.trim().length > 0;
};

const uploadPrimaryImage = async (
  networkClient: NetworkClient,
  configuration: Configuration,
  personId: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> => {
  const primaryPath = `/Items/${encodeURIComponent(personId)}/Images/Primary`;
  const body = Buffer.from(bytes).toString("base64");
  const headers = buildJellyfinHeaders(configuration, {
    "content-type": contentType,
  });
  const uploadError = {
    code: "JELLYFIN_WRITE_FAILED",
    message: "上传 Jellyfin 人物头像失败",
  };
  const uploadStatusMappings = {
    400: { code: "JELLYFIN_BAD_REQUEST", message: "Jellyfin 拒绝了人物头像上传请求" },
    401: { code: "JELLYFIN_AUTH_FAILED", message: "Jellyfin 凭据无效，无法上传人物头像" },
    403: { code: "JELLYFIN_PERMISSION_DENIED", message: "当前 Jellyfin 凭据没有人物头像写入权限" },
    415: { code: "JELLYFIN_UNSUPPORTED_MEDIA", message: "Jellyfin 不接受当前头像文件类型" },
  };

  try {
    await networkClient.postText(buildJellyfinUrl(configuration, primaryPath), body, { headers });
    return;
  } catch (error) {
    const status = getHttpStatus(error);
    if (status !== 404 && status !== 405) {
      throw toJellyfinServiceError(error, uploadStatusMappings, uploadError);
    }
  }

  try {
    await networkClient.postText(buildJellyfinUrl(configuration, `${primaryPath}/0`), body, { headers });
  } catch (error) {
    throw toJellyfinServiceError(error, uploadStatusMappings, uploadError);
  }
};

export class JellyfinActorPhotoService {
  private readonly logger = loggerService.getLogger("JellyfinActorPhoto");

  private readonly networkClient: NetworkClient;

  constructor(private readonly deps: JellyfinActorPhotoDependencies) {
    this.networkClient = deps.networkClient;
  }

  async run(configuration: Configuration, mode: JellyfinMode): Promise<JellyfinBatchResult> {
    assertLocalActorImageSourceReady(configuration);

    const persons = await fetchPersons(this.networkClient, configuration);
    if (persons.length === 0) {
      return createEmptyPersonSyncResult();
    }

    const result = await runPersonSyncBatch({
      items: persons,
      signalService: this.deps.signalService,
      processItem: async (person) => {
        const actorName = person.Name.trim();
        if (!actorName) {
          return "skipped";
        }

        if (mode === "missing" && hasPrimaryImage(person)) {
          return "skipped";
        }

        const actorSource = await this.deps.actorSourceProvider.lookup(configuration, {
          name: actorName,
          requiredField: "photo_url",
        });
        logActorSourceWarnings(this.logger, actorName, actorSource.warnings);
        const image = await loadPrimaryImageFromSource(this.networkClient, actorSource.profile.photo_url);

        if (!image) {
          this.deps.signalService.showLogText(`No Jellyfin actor photo source found for ${actorName}`, "warn");
          return "skipped";
        }

        await uploadPrimaryImage(this.networkClient, configuration, person.Id, image.content, image.contentType);
        if (configuration.jellyfin.refreshPersonAfterSync) {
          try {
            await refreshPerson(this.networkClient, configuration, person.Id);
          } catch (error) {
            this.logger.warn(
              `Failed to refresh Jellyfin actor ${person.Name} after photo sync: ${formatPersonSyncError(error)}`,
            );
          }
        }
        this.deps.signalService.showLogText(`Updated Jellyfin actor photo: ${actorName}`);
        return "processed";
      },
      onError: (person, error) => {
        const actorName = person.Name.trim() || person.Name;
        this.logger.warn(`Failed to update Jellyfin actor photo for ${actorName}: ${formatPersonSyncError(error)}`);
      },
    });

    this.deps.signalService.showLogText(
      `Jellyfin actor photo sync completed. Success: ${result.processedCount}, Failed: ${result.failedCount}, Skipped: ${result.skippedCount}`,
    );

    return result;
  }
}
