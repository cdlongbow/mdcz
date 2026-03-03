import { vi } from "vitest";

vi.mock("electron", () => {
  const app = {
    isReady: () => false,
    isPackaged: true,
    getPath: () => "/tmp",
    commandLine: {
      appendSwitch: () => {},
    },
    setAppUserModelId: () => {},
  };

  return {
    app,
  };
});
