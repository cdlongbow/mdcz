import type { ServiceContainer } from "@main/container";
import { configManager } from "@main/services/config";
import { checkConfiguredSiteCookies } from "@mdcz/runtime/network";
import { IpcChannel } from "@mdcz/shared/IpcChannel";
import type { IpcRouterContract } from "@mdcz/shared/ipcContract";
import { t } from "../shared";

export const createNetworkHandlers = (
  context: ServiceContainer,
): Pick<IpcRouterContract, typeof IpcChannel.Network_CheckCookies> => {
  const { networkClient } = context;

  return {
    [IpcChannel.Network_CheckCookies]: t.procedure.action(async () => {
      const configuration = await configManager.getValidated();
      return await checkConfiguredSiteCookies(configuration, networkClient);
    }),
  };
};
