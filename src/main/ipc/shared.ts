import { tipc } from "@egoist/tipc/main";
import { type IpcError, isIpcError, toIpcError } from "./errors";

export const t = tipc.create();

export const asSerializableIpcError = (error: unknown): IpcError => {
  if (isIpcError(error)) {
    return error;
  }
  return toIpcError(error);
};
