import type { Configuration } from "@mdcz/shared/config";
import { queryOptions, type UseQueryOptions, useQuery } from "@tanstack/react-query";
import { api } from "../client";
import { queryKeys } from "../lib/queryKeys";

export interface ConfigProfilesOutput {
  profiles: string[];
  active: string;
}

export const CURRENT_CONFIG_QUERY_KEY = queryKeys.config.current;
export const DEFAULT_CONFIG_QUERY_KEY = queryKeys.config.defaults;
export const CONFIG_PROFILES_QUERY_KEY = queryKeys.config.profiles;

export const currentConfigQueryOptions = () =>
  queryOptions({
    queryKey: CURRENT_CONFIG_QUERY_KEY,
    staleTime: 30_000,
    queryFn: async (): Promise<Configuration> => await api.config.read(),
  });

export const defaultConfigQueryOptions = () =>
  queryOptions({
    queryKey: DEFAULT_CONFIG_QUERY_KEY,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    queryFn: async (): Promise<Configuration> => await api.config.defaults(),
  });

export const configProfilesQueryOptions = () =>
  queryOptions({
    queryKey: CONFIG_PROFILES_QUERY_KEY,
    staleTime: 30_000,
    queryFn: async (): Promise<ConfigProfilesOutput> => await api.config.profiles.list(),
  });

type CurrentConfigQueryOptions = Omit<
  UseQueryOptions<Configuration, Error, Configuration, typeof CURRENT_CONFIG_QUERY_KEY>,
  "queryKey" | "queryFn"
>;

type DefaultConfigQueryOptions = Omit<
  UseQueryOptions<Configuration, Error, Configuration, typeof DEFAULT_CONFIG_QUERY_KEY>,
  "queryKey" | "queryFn"
>;

type ConfigProfilesQueryOptions = Omit<
  UseQueryOptions<ConfigProfilesOutput, Error, ConfigProfilesOutput, typeof CONFIG_PROFILES_QUERY_KEY>,
  "queryKey" | "queryFn"
>;

export const useCurrentConfig = (options?: CurrentConfigQueryOptions) =>
  useQuery({
    ...currentConfigQueryOptions(),
    ...options,
  });

export const useDefaultConfig = (options?: DefaultConfigQueryOptions) =>
  useQuery({
    ...defaultConfigQueryOptions(),
    ...options,
  });

export const useConfigProfiles = (options?: ConfigProfilesQueryOptions) =>
  useQuery({
    ...configProfilesQueryOptions(),
    ...options,
  });
