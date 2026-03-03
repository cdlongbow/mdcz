import { arch } from "node:os";
import { IpcChannel } from "@shared/IpcChannel";
import type { IpcRouterContract } from "@shared/ipcContract";
import { app, shell } from "electron";
import { t } from "../shared";

export const createAppHandlers = (): Pick<
  IpcRouterContract,
  typeof IpcChannel.App_Info | typeof IpcChannel.App_OpenExternal
> => ({
  [IpcChannel.App_Info]: t.procedure.action(async () => ({
    version: app.getVersion(),
    arch: arch(),
    platform: process.platform,
    isPackaged: app.isPackaged,
  })),
  [IpcChannel.App_OpenExternal]: t.procedure.input<{ url: string }>().action(async ({ input }) => {
    await shell.openExternal(input.url);
    return { success: true as const };
  }),
});
