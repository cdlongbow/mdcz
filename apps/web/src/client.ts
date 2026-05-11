import type { ServerApiContract, ServerApiProcedure, TaskRealtimeEventDto, WebTaskUpdateDto } from "@mdcz/shared";

const DEFAULT_API_BASE = "http://127.0.0.1:3838";
const API_BASE_KEY = "mdcz-web-api-base";
const TOKEN_KEY = "mdcz-admin-token";

export const getApiBase = (): string => localStorage.getItem(API_BASE_KEY) ?? DEFAULT_API_BASE;

export const setApiBase = (baseUrl: string): void => {
  const trimmed = baseUrl.trim().replace(/\/+$/u, "");
  if (!trimmed) {
    localStorage.removeItem(API_BASE_KEY);
    return;
  }
  localStorage.setItem(API_BASE_KEY, trimmed);
};

export const getAdminToken = (): string | null => localStorage.getItem(TOKEN_KEY);

export const setAdminToken = (token: string | undefined): void => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    return;
  }
  localStorage.removeItem(TOKEN_KEY);
};

const isRemoteImageUrl = (value: string): boolean => /^https?:\/\//iu.test(value.trim());

const encodePathSegments = (value: string): string =>
  value
    .split(/[\\/]+/u)
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

export const getLibraryAssetSrc = (input: { rootId?: string | null; path: string | null | undefined }): string => {
  const assetPath = input.path?.trim();
  if (!assetPath) {
    return "";
  }
  if (isRemoteImageUrl(assetPath)) {
    return assetPath;
  }
  const rootId = input.rootId?.trim();
  if (!rootId) {
    return "";
  }
  const url = new URL(
    `/api/library/assets/${encodeURIComponent(rootId)}/${encodePathSegments(assetPath)}`,
    getApiBase(),
  );
  const token = getAdminToken();
  if (token) {
    url.searchParams.set("token", token);
  }
  return url.toString();
};

const procedurePath = (procedure: ServerApiProcedure): string => procedure.replace(".", ".");

const request = async <T>(procedure: ServerApiProcedure, input?: unknown): Promise<T> => {
  const token = getAdminToken();
  const response = await fetch(`${getApiBase()}/trpc/${procedurePath(procedure)}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(input ?? null),
  });
  const payload = (await response.json().catch(() => ({}))) as { result?: { data?: T }; error?: { message?: string } };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Request failed: ${response.status}`);
  }
  return payload.result?.data as T;
};

export const api: ServerApiContract = {
  auth: {
    setup: () => request("auth.setup"),
    login: async (input) => {
      const session = await request<Awaited<ReturnType<ServerApiContract["auth"]["login"]>>>("auth.login", input);
      setAdminToken(session.token);
      return session;
    },
    logout: async () => {
      const session = await request<Awaited<ReturnType<ServerApiContract["auth"]["logout"]>>>("auth.logout");
      setAdminToken(undefined);
      return session;
    },
    status: () => request("auth.status"),
  },
  app: {
    ensureWatermarkDirectory: () => request("app.ensureWatermarkDirectory"),
  },
  browser: {
    list: (input) => request("browser.list", input),
  },
  crawler: {
    listSites: () => request("crawler.listSites"),
    probeSiteConnectivity: (input) => request("crawler.probeSiteConnectivity", input),
  },
  network: {
    checkCookies: () => request("network.checkCookies"),
  },
  translate: {
    testLlm: (input) => request("translate.testLlm", input),
  },
  serverPaths: {
    suggest: (input) => request("serverPaths.suggest", input),
  },
  config: {
    defaults: () => request("config.defaults"),
    export: () => request("config.export"),
    import: (input) => request("config.import", input),
    read: () => request("config.read", {}),
    previewNaming: (input) => request("config.previewNaming", input),
    reset: (input) => request("config.reset", input ?? {}),
    update: (input) => request("config.update", input),
    save: (input) => request("config.save", input),
    profiles: {
      list: () => request("config.profiles.list"),
      create: (input) => request("config.profiles.create", input),
      switch: (input) => request("config.profiles.switch", input),
      delete: (input) => request("config.profiles.delete", input),
      export: (input) => request("config.profiles.export", input),
      import: (input) => request("config.profiles.import", input),
    },
  },
  health: {
    read: () => request("health.read"),
  },
  system: {
    about: () => request("system.about"),
  },
  logs: {
    list: (input) => request("logs.list", input),
    clearRuntime: () => request("logs.clearRuntime"),
  },
  maintenance: {
    scanSelectedFiles: (input) => request("maintenance.scanSelectedFiles", input),
    apply: (input) => request("maintenance.execute", input),
    pause: (input) => request("maintenance.pause", input),
    preview: (input) => request("maintenance.preview", input),
    recover: () => request("maintenance.recover"),
    resume: (input) => request("maintenance.resume", input),
    start: (input) => request("maintenance.start", input),
    stop: (input) => request("maintenance.stop", input),
  },
  library: {
    list: (input) => request("library.list", input),
    search: (input) => request("library.search", input),
    detail: (input) => request("library.detail", input),
    refresh: (input) => request("library.refresh", input),
    rescan: (input) => request("library.rescan", input),
    relink: (input) => request("library.relink", input),
  },
  overview: {
    summary: () => request("overview.summary"),
  },
  mediaRoots: {
    list: () => request("mediaRoots.list"),
  },
  persistence: {
    status: () => request("persistence.status"),
  },
  tools: {
    catalog: () => request("tools.catalog"),
    execute: (input) => request("tools.execute", input),
  },
  scans: {
    candidates: (input) => request("scans.candidates", input),
    detail: (input) => request("scans.detail", input),
    events: (input) => request("scans.events", input),
    list: () => request("scans.list"),
    retry: (input) => request("scans.retry", input),
    start: (input) => request("scans.start", input),
  },
  scrape: {
    startSelectedFiles: (input) => request("scrape.startSelectedFiles", input),
    deleteFile: (input) => request("scrape.deleteFile", input),
    listResults: (input) => request("scrape.listResults", input),
    getRecoverableSession: () => request("scrape.getRecoverableSession"),
    nfoRead: (input) => request("scrape.nfoRead", input),
    nfoWrite: (input) => request("scrape.nfoWrite", input),
    pause: (input) => request("scrape.pause", input),
    result: (input) => request("scrape.result", input),
    resume: (input) => request("scrape.resume", input),
    retry: (input) => request("scrape.retry", input),
    confirmUncensored: (input) => request("scrape.confirmUncensored", input),
    resolveRecoverableSession: (input) => request("scrape.resolveRecoverableSession", input),
    start: (input) => request("scrape.start", input),
    stop: (input) => request("scrape.stop", input),
  },
  tasks: {
    detail: (input) => request("tasks.detail", input),
    events: (input) => request("tasks.events", input),
    list: () => request("tasks.list"),
    retry: (input) => request("tasks.retry", input),
  },
  setup: {
    complete: async (input) => {
      const session = await request<Awaited<ReturnType<ServerApiContract["setup"]["complete"]>>>(
        "setup.complete",
        input,
      );
      setAdminToken(session.token);
      return session;
    },
    status: () => request("setup.status"),
  },
};

export const subscribeTaskUpdates = (onUpdate: (payload: WebTaskUpdateDto) => void): (() => void) => {
  const token = getAdminToken();
  const eventSource = new EventSource(
    `${getApiBase()}/events/tasks${token ? `?token=${encodeURIComponent(token)}` : ""}`,
  );
  eventSource.addEventListener("task-update", (event) => {
    onUpdate(JSON.parse(event.data) as WebTaskUpdateDto);
  });
  return () => eventSource.close();
};

export const subscribeTaskEvents = (onEvent: (payload: TaskRealtimeEventDto) => void): (() => void) => {
  const token = getAdminToken();
  const eventSource = new EventSource(
    `${getApiBase()}/events/tasks${token ? `?token=${encodeURIComponent(token)}` : ""}`,
  );
  eventSource.addEventListener("task-event", (event) => {
    onEvent(JSON.parse(event.data) as TaskRealtimeEventDto);
  });
  return () => eventSource.close();
};

export const subscribeTaskRealtime = (handlers: {
  onEvent?: (payload: TaskRealtimeEventDto) => void;
  onUpdate?: (payload: WebTaskUpdateDto) => void;
}): (() => void) => {
  const token = getAdminToken();
  const eventSource = new EventSource(
    `${getApiBase()}/events/tasks${token ? `?token=${encodeURIComponent(token)}` : ""}`,
  );
  eventSource.addEventListener("task-update", (event) => {
    handlers.onUpdate?.(JSON.parse(event.data) as WebTaskUpdateDto);
  });
  eventSource.addEventListener("task-event", (event) => {
    handlers.onEvent?.(JSON.parse(event.data) as TaskRealtimeEventDto);
  });
  return () => eventSource.close();
};
