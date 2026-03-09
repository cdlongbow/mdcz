import { readFile } from "node:fs/promises";
import type { ActorSourceProvider } from "@main/services/actorSource";
import { logActorSourceWarnings } from "@main/services/actorSource/logging";
import type { Configuration } from "@main/services/config";
import { loggerService } from "@main/services/LoggerService";
import type { NetworkClient } from "@main/services/network";
import type { SignalService } from "@main/services/SignalService";
import { imageContentTypeFromPath, pathExists } from "@main/utils/file";

import { buildApiUrl, type EmbyBatchResult, type EmbyMode, fetchPersons, hasPrimaryImage } from "./common";

export interface EmbyActorPhotoDependencies {
  signalService: SignalService;
  networkClient: NetworkClient;
  actorSourceProvider: ActorSourceProvider;
}

export class EmbyActorPhoto {
  private readonly logger = loggerService.getLogger("EmbyActorPhoto");

  private readonly networkClient: NetworkClient;

  constructor(private readonly deps: EmbyActorPhotoDependencies) {
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

      if (mode === "missing" && hasPrimaryImage(person)) {
        continue;
      }

      const actorName = person.Name.trim();
      if (!actorName) {
        failedCount += 1;
        continue;
      }

      try {
        const actorSource = await this.deps.actorSourceProvider.lookup(configuration, actorName);
        logActorSourceWarnings(this.logger, actorName, actorSource.warnings);
        const photoUrl = actorSource.profile.photo_url?.trim();

        let content: Buffer;
        let contentType: string;

        if (photoUrl && (await pathExists(photoUrl))) {
          content = await readFile(photoUrl);
          contentType = imageContentTypeFromPath(photoUrl);
        } else if (photoUrl) {
          const bytes = await this.networkClient.getContent(photoUrl, {
            headers: {
              accept: "image/*",
            },
          });
          content = Buffer.from(bytes);
          contentType = imageContentTypeFromPath(photoUrl);
        } else {
          failedCount += 1;
          this.deps.signalService.showLogText(`No actor photo source found for ${actorName}`, "warn");
          continue;
        }

        const uploadUrl = buildApiUrl(configuration, `/Items/${encodeURIComponent(person.Id)}/Images/Primary`);
        await this.networkClient.postText(uploadUrl, content.toString("base64"), {
          headers: {
            "content-type": contentType,
          },
        });

        processedCount += 1;
        this.deps.signalService.showLogText(`Updated actor photo: ${actorName}`);
      } catch (error) {
        failedCount += 1;
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Failed to update actor photo for ${actorName}: ${message}`);
      }
    }

    this.deps.signalService.showLogText(
      `Actor photo sync completed. Success: ${processedCount}, Failed: ${failedCount}`,
    );

    return {
      processedCount,
      failedCount,
    };
  }
}
