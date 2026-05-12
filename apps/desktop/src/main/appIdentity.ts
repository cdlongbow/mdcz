import { app } from "electron";

export const DESKTOP_APP_NAME = "mdcz";

let identityApplied = false;

export const applyDesktopAppIdentity = (): void => {
  if (identityApplied) {
    return;
  }

  (app as { setName?: (name: string) => void }).setName?.(DESKTOP_APP_NAME);
  identityApplied = true;
};

export const getDesktopUserDataPath = (): string => {
  applyDesktopAppIdentity();
  return app.getPath("userData");
};
