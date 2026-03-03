import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

import type { Configuration } from "@main/services/config";
import { loggerService } from "@main/services/LoggerService";
import type { NetworkClient } from "@main/services/network";
import type { SignalService } from "@main/services/SignalService";

import {
  buildApiUrl,
  type EmbyBatchResult,
  type EmbyMode,
  EmbyServiceError,
  fetchPersons,
  hasPrimaryImage,
} from "./common";

interface GfriendsResponse {
  Content?: Record<string, Record<string, string>>;
}

export interface EmbyActorPhotoDependencies {
  signalService: SignalService;
  networkClient: NetworkClient;
  actorMapUrl?: string;
}

const DEFAULT_GFRIENDS_FILETREE_URL = "https://raw.githubusercontent.com/gfriends/gfriends/master/Filetree.json";

const hasFile = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const contentTypeFromPath = (path: string): string => {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) {
    return "image/png";
  }
  return "image/jpeg";
};

export class EmbyActorPhoto {
  private readonly logger = loggerService.getLogger("EmbyActorPhoto");

  private readonly networkClient: NetworkClient;

  private readonly actorMapUrl: string;

  constructor(private readonly deps: EmbyActorPhotoDependencies) {
    this.networkClient = deps.networkClient;
    this.actorMapUrl = deps.actorMapUrl ?? DEFAULT_GFRIENDS_FILETREE_URL;
  }

  async run(configuration: Configuration, mode: EmbyMode): Promise<EmbyBatchResult> {
    const persons = await fetchPersons(this.networkClient, configuration);
    const actorMap = await this.loadActorMap();
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
        const localPhotoPath = await this.resolveLocalPhotoPath(configuration, actorName);
        const remotePhotoUrl = actorMap.get(actorName) ?? actorMap.get(actorName.replaceAll(" ", ""));

        let content: Buffer;
        let contentType: string;

        if (localPhotoPath) {
          content = await readFile(localPhotoPath);
          contentType = contentTypeFromPath(localPhotoPath);
        } else if (remotePhotoUrl) {
          const bytes = await this.networkClient.getContent(remotePhotoUrl, {
            headers: {
              accept: "image/*",
            },
          });
          content = Buffer.from(bytes);
          contentType = contentTypeFromPath(remotePhotoUrl);
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

  private async loadActorMap(): Promise<Map<string, string>> {
    const rawBase = this.actorMapUrl.replace(/\/Filetree\.json$/u, "").replace(/\/+$/u, "");

    try {
      const payload = await this.networkClient.getJson<GfriendsResponse>(this.actorMapUrl);
      const map = new Map<string, string>();

      if (!payload.Content) {
        return map;
      }

      for (const [folder, files] of Object.entries(payload.Content)) {
        for (const [actorName, fileName] of Object.entries(files)) {
          if (!actorName || !fileName || map.has(actorName)) {
            continue;
          }
          map.set(actorName, `${rawBase}/Content/${folder}/${fileName}`);
        }
      }

      return map;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new EmbyServiceError("EMBY_UNREACHABLE", `Failed to load actor photo index: ${message}`);
    }
  }

  private async resolveLocalPhotoPath(configuration: Configuration, actorName: string): Promise<string | null> {
    const photoFolder = configuration.server.actorPhotoFolder.trim();
    if (!photoFolder) {
      return null;
    }

    const candidates = [
      `${actorName}.jpg`,
      `${actorName}.jpeg`,
      `${actorName}.png`,
      `${actorName.replaceAll(" ", "")}.jpg`,
      `${actorName.replaceAll(" ", "")}.jpeg`,
      `${actorName.replaceAll(" ", "")}.png`,
    ];

    for (const fileName of candidates) {
      const filePath = join(photoFolder, fileName);
      if (await hasFile(filePath)) {
        return filePath;
      }
    }

    return null;
  }
}
