import type { Configuration } from "@main/services/config";
import type { NetworkClient } from "@main/services/network";
import { normalizeActorName } from "@main/utils/actor";
import { CachedAsyncResolver } from "@main/utils/CachedAsyncResolver";
import type { ActorLookupQuery, ActorSourceResult, BaseActorSource } from "../types";

interface GfriendsResponse {
  Content?: Record<string, Record<string, string>>;
}

const DEFAULT_GFRIENDS_FILETREE_URL = "https://raw.githubusercontent.com/gfriends/gfriends/master/Filetree.json";
const MAP_CACHE_TTL_MS = 30 * 60 * 1000;

export interface GfriendsActorSourceDependencies {
  networkClient: NetworkClient;
  actorMapUrl?: string;
}

export class GfriendsActorSource implements BaseActorSource {
  readonly name = "gfriends" as const;

  private readonly actorMapUrl: string;

  private readonly mapResolver = new CachedAsyncResolver<string, Map<string, string>>();

  private mapBucket = "";

  constructor(private readonly deps: GfriendsActorSourceDependencies) {
    this.actorMapUrl = deps.actorMapUrl ?? DEFAULT_GFRIENDS_FILETREE_URL;
  }

  async lookup(_configuration: Configuration, query: ActorLookupQuery): Promise<ActorSourceResult> {
    try {
      const actorMap = await this.loadMap();
      const actorNames = [query.name, ...(query.aliases ?? [])];

      for (const actorName of actorNames) {
        const photoUrl = actorMap.get(normalizeActorName(actorName));
        if (!photoUrl) {
          continue;
        }

        return {
          source: this.name,
          success: true,
          profile: {
            name: query.name.trim(),
            photo_url: photoUrl,
          },
          warnings: [],
        };
      }

      return {
        source: this.name,
        success: true,
        warnings: [],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        source: this.name,
        success: false,
        warnings: [`Failed to load gfriends actor index: ${message}`],
      };
    }
  }

  private async loadMap(): Promise<Map<string, string>> {
    const bucket = String(Math.floor(Date.now() / MAP_CACHE_TTL_MS));
    if (bucket !== this.mapBucket) {
      this.mapResolver.clear();
      this.mapBucket = bucket;
    }

    return this.mapResolver.resolve(this.actorMapUrl, async () => {
      const rawBase = this.actorMapUrl.replace(/\/Filetree\.json$/u, "").replace(/\/+$/u, "");
      const payload = await this.deps.networkClient.getJson<GfriendsResponse>(this.actorMapUrl);
      const actorMap = new Map<string, string>();

      if (!payload.Content) {
        return actorMap;
      }

      for (const [folder, files] of Object.entries(payload.Content)) {
        for (const [actorName, fileName] of Object.entries(files)) {
          const normalized = normalizeActorName(actorName);
          if (!normalized || !fileName || actorMap.has(normalized)) {
            continue;
          }
          actorMap.set(normalized, `${rawBase}/Content/${folder}/${fileName}`);
        }
      }

      return actorMap;
    });
  }
}
