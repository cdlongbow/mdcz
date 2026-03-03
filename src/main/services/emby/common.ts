import type { Configuration } from "@main/services/config";
import type { NetworkClient } from "@main/services/network";
import { isRecord, isString, toErrorMessage } from "@main/utils/common";

export type EmbyMode = "all" | "missing";

export interface EmbyBatchResult {
  processedCount: number;
  failedCount: number;
}

export interface EmbyPerson {
  Id: string;
  Name: string;
  ServerId?: string;
  ImageTags?: Record<string, string>;
}

interface EmbyPersonsResponse {
  Items?: unknown;
}

export class EmbyServiceError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const normalizeBaseUrl = (value: string): string => {
  return value.trim().replace(/\/+$/u, "");
};

export const parseMode = (value: unknown): EmbyMode | null => {
  if (value === "all" || value === "missing") {
    return value;
  }
  return null;
};

export const hasPrimaryImage = (person: EmbyPerson): boolean => {
  const primary = person.ImageTags?.Primary;
  return typeof primary === "string" && primary.trim().length > 0;
};

export const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
};

export const toStringRecord = (value: unknown): Record<string, string> => {
  if (!isRecord(value)) {
    return {};
  }

  const output: Record<string, string> = {};
  for (const [key, recordValue] of Object.entries(value)) {
    if (!isString(recordValue) || recordValue.trim().length === 0) {
      continue;
    }
    output[key] = recordValue;
  }

  return output;
};

export const buildApiUrl = (
  configuration: Configuration,
  path: string,
  query: Record<string, string | undefined> = {},
): string => {
  const baseUrl = normalizeBaseUrl(configuration.server.url);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${baseUrl}${normalizedPath}`);

  url.searchParams.set("api_key", configuration.server.apiKey);
  for (const [key, value] of Object.entries(query)) {
    if (!value || value.trim().length === 0) {
      continue;
    }
    url.searchParams.set(key, value);
  }

  return url.toString();
};

export const fetchPersons = async (
  networkClient: NetworkClient,
  configuration: Configuration,
): Promise<EmbyPerson[]> => {
  const url = buildApiUrl(configuration, "/Persons", {
    userid: configuration.server.userId,
  });

  try {
    const response = await networkClient.getJson<EmbyPersonsResponse>(url, {
      headers: {
        accept: "application/json",
      },
    });

    if (!Array.isArray(response.Items)) {
      return [];
    }

    return response.Items.flatMap((item): EmbyPerson[] => {
      if (!isRecord(item)) {
        return [];
      }

      const id = item.Id;
      const name = item.Name;
      if (!isString(id) || !isString(name)) {
        return [];
      }

      const imageTags = isRecord(item.ImageTags) ? toStringRecord(item.ImageTags) : undefined;

      return [
        {
          Id: id,
          Name: name,
          ServerId: isString(item.ServerId) ? item.ServerId : undefined,
          ImageTags: imageTags,
        },
      ];
    });
  } catch (error) {
    throw new EmbyServiceError("EMBY_UNREACHABLE", `Failed to fetch actor list from Emby: ${toErrorMessage(error)}`);
  }
};

export const checkConnection = async (networkClient: NetworkClient, configuration: Configuration): Promise<void> => {
  const url = buildApiUrl(configuration, "/Persons", {
    userid: configuration.server.userId,
    Limit: "1",
  });

  try {
    await networkClient.getJson<EmbyPersonsResponse>(url, {
      headers: {
        accept: "application/json",
      },
    });
  } catch (error) {
    throw new EmbyServiceError(
      "EMBY_UNREACHABLE",
      `Failed to connect to Emby/Jellyfin server: ${toErrorMessage(error)}`,
    );
  }
};

export const hasOverview = (value: unknown): boolean => {
  return typeof value === "string" && value.trim().length > 0;
};
