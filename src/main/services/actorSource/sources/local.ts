import { readFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, join } from "node:path";
import type { Configuration } from "@main/services/config";
import { normalizeActorName } from "@main/utils/actor";
import { ACTOR_PROFILE_METADATA_FIELDS, hasActorProfileFieldValue } from "@main/utils/actorProfile";
import { CachedAsyncResolver } from "@main/utils/CachedAsyncResolver";
import { listFiles, pathExists } from "@main/utils/file";
import { parseNfo } from "@main/utils/nfo";
import type { ActorProfile } from "@shared/types";
import { mergeActorSourceHints } from "../sourceHints";
import type { ActorLookupQuery, ActorSourceHint, ActorSourceResult, BaseActorSource } from "../types";

const INDEX_CACHE_TTL_MS = 5 * 60 * 1000;
const PHOTO_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

type IndexedActorProfile = ActorProfile & {
  aliases: string[];
};

interface IndexedActorRecord {
  profile: IndexedActorProfile;
  sourceHints: ActorSourceHint[];
}

const isRemoteUrl = (value: string): boolean => /^https?:\/\//iu.test(value);

const mergeProfiles = (
  existing: IndexedActorProfile | undefined,
  incoming: IndexedActorProfile,
): IndexedActorProfile => {
  const aliases = Array.from(new Set([...(existing?.aliases ?? []), ...incoming.aliases]));
  const existingPhoto = existing?.photo_url;
  const incomingPhoto = incoming.photo_url;

  const nextPhoto = (() => {
    if (!existingPhoto) {
      return incomingPhoto;
    }
    if (!incomingPhoto) {
      return existingPhoto;
    }
    if (isRemoteUrl(existingPhoto) && !isRemoteUrl(incomingPhoto)) {
      return incomingPhoto;
    }
    return existingPhoto;
  })();

  const merged: IndexedActorProfile = {
    name: existing?.name ?? incoming.name,
    aliases,
    photo_url: nextPhoto,
  };

  for (const field of ACTOR_PROFILE_METADATA_FIELDS) {
    if (field === "photo_url") {
      continue;
    }

    const nextValue = existing?.[field] ?? incoming[field];
    if (!hasActorProfileFieldValue(nextValue)) {
      continue;
    }

    Object.assign(merged, { [field]: nextValue });
  }

  return merged;
};

const mergeRecords = (existing: IndexedActorRecord | undefined, incoming: IndexedActorRecord): IndexedActorRecord => {
  return {
    profile: mergeProfiles(existing?.profile, incoming.profile),
    sourceHints: mergeActorSourceHints(existing?.sourceHints, incoming.sourceHints),
  };
};

const createSourceHints = (parsed: ReturnType<typeof parseNfo>): ActorSourceHint[] => {
  return mergeActorSourceHints([
    {
      website: parsed.website,
      studio: parsed.studio,
      publisher: parsed.publisher,
    },
  ]);
};

const resolveActorPhotoUrl = async (nfoPath: string, profile: ActorProfile): Promise<string | undefined> => {
  if (!profile.photo_url) {
    return undefined;
  }
  if (isRemoteUrl(profile.photo_url)) {
    return profile.photo_url;
  }

  const absolutePath = isAbsolute(profile.photo_url) ? profile.photo_url : join(dirname(nfoPath), profile.photo_url);
  return (await pathExists(absolutePath)) ? absolutePath : undefined;
};

const resolveLocalPhotoPath = async (
  configuration: Configuration,
  actorNames: string[],
): Promise<string | undefined> => {
  const photoFolder = configuration.server.actorPhotoFolder.trim();
  if (!photoFolder) {
    return undefined;
  }

  const candidates = Array.from(
    new Set(
      actorNames
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
        .flatMap((actorName) =>
          PHOTO_EXTENSIONS.flatMap((extension) => [
            `${actorName}${extension}`,
            `${actorName.replaceAll(" ", "")}${extension}`,
          ]),
        ),
    ),
  );

  for (const fileName of candidates) {
    const filePath = join(photoFolder, fileName);
    if (await pathExists(filePath)) {
      return filePath;
    }
  }

  return undefined;
};

const buildLocalActorRecordIndex = async (configuration: Configuration): Promise<Map<string, IndexedActorRecord>> => {
  const mediaPath = configuration.paths.mediaPath.trim();
  if (!mediaPath) {
    return new Map<string, IndexedActorRecord>();
  }

  let files: string[];
  try {
    files = await listFiles(mediaPath, true);
  } catch {
    return new Map<string, IndexedActorRecord>();
  }

  const nfoFiles = files.filter((filePath) => extname(filePath).toLowerCase() === ".nfo");
  const index = new Map<string, IndexedActorRecord>();

  for (const nfoPath of nfoFiles) {
    try {
      const xml = await readFile(nfoPath, "utf8");
      const parsed = parseNfo(xml);
      const sourceHints = createSourceHints(parsed);
      const profilesByName = new Map<string, IndexedActorProfile>();

      for (const actorName of parsed.actors) {
        const name = actorName.trim();
        if (!name) {
          continue;
        }

        profilesByName.set(normalizeActorName(name), {
          name,
          aliases: [],
          description: undefined,
          photo_url: undefined,
        });
      }

      for (const profile of parsed.actor_profiles ?? []) {
        const name = profile.name.trim();
        if (!name) {
          continue;
        }

        const key = normalizeActorName(name);
        const nextProfile = mergeProfiles(profilesByName.get(key), {
          name,
          aliases: profile.aliases ?? [],
          birth_date: profile.birth_date,
          birth_place: profile.birth_place,
          blood_type: profile.blood_type,
          description: profile.description,
          height_cm: profile.height_cm,
          bust_cm: profile.bust_cm,
          waist_cm: profile.waist_cm,
          hip_cm: profile.hip_cm,
          cup_size: profile.cup_size,
          photo_url: await resolveActorPhotoUrl(nfoPath, profile),
        });
        profilesByName.set(key, nextProfile);
      }

      for (const nextProfile of profilesByName.values()) {
        const merged = mergeRecords(index.get(normalizeActorName(nextProfile.name)), {
          profile: nextProfile,
          sourceHints,
        });

        for (const variant of [merged.profile.name, ...merged.profile.aliases]) {
          const normalized = normalizeActorName(variant);
          if (normalized) {
            index.set(normalized, merged);
          }
        }
      }
    } catch {
      // Ignore unrelated or invalid NFO files when building local actor sources.
    }
  }

  return index;
};

export const buildLocalActorIndex = async (configuration: Configuration): Promise<Map<string, IndexedActorProfile>> => {
  const recordIndex = await buildLocalActorRecordIndex(configuration);
  return new Map(Array.from(recordIndex.entries(), ([key, value]) => [key, value.profile]));
};

export class LocalActorSource implements BaseActorSource {
  readonly name = "local" as const;

  private readonly indexResolver = new CachedAsyncResolver<string, Map<string, IndexedActorRecord>>();

  private indexBucket = "";

  async lookup(configuration: Configuration, query: ActorLookupQuery): Promise<ActorSourceResult> {
    try {
      const index = await this.loadIndex(configuration);
      const indexed = index.get(normalizeActorName(query.name));
      const profile = indexed?.profile;
      const aliases = profile?.aliases ?? [];
      const localPhotoPath = await resolveLocalPhotoPath(configuration, [
        query.name,
        ...(query.aliases ?? []),
        ...aliases,
      ]);

      return {
        source: this.name,
        success: true,
        profile: {
          name: profile?.name ?? query.name.trim(),
          aliases: aliases.length > 0 ? aliases : undefined,
          birth_date: profile?.birth_date,
          birth_place: profile?.birth_place,
          blood_type: profile?.blood_type,
          description: profile?.description,
          height_cm: profile?.height_cm,
          bust_cm: profile?.bust_cm,
          waist_cm: profile?.waist_cm,
          hip_cm: profile?.hip_cm,
          cup_size: profile?.cup_size,
          photo_url: localPhotoPath ?? profile?.photo_url,
        },
        warnings: [],
        sourceHints: indexed?.sourceHints ?? [],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        source: this.name,
        success: false,
        warnings: [`Failed to load local actor data: ${message}`],
      };
    }
  }

  private async loadIndex(configuration: Configuration): Promise<Map<string, IndexedActorRecord>> {
    const bucket = String(Math.floor(Date.now() / INDEX_CACHE_TTL_MS));
    if (bucket !== this.indexBucket) {
      this.indexResolver.clear();
      this.indexBucket = bucket;
    }

    const cacheKey = JSON.stringify({
      mediaPath: configuration.paths.mediaPath.trim(),
      actorPhotoFolder: configuration.server.actorPhotoFolder.trim(),
    });

    return this.indexResolver.resolve(cacheKey, async () => buildLocalActorRecordIndex(configuration));
  }
}
