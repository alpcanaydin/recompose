import {
  ipcChannels,
  type IpcChannel,
  type IpcRequest,
  type IpcResponse,
} from '@recompose/contracts';

import { assertTrustedSender, type AllowedOrigins, type TrustedSender } from './sender-trust';

export type IpcHandlers = {
  [Channel in IpcChannel]: (request: IpcRequest<Channel>) => Promise<IpcResponse<Channel>>;
};

export const ipcChannelNames: readonly IpcChannel[] = [
  'gateways:list',
  'gateways:save',
  'settings:get',
  'settings:save',
  'accounts:list',
  'accounts:connect',
  'accounts:remove',
];

async function callHandler<Channel extends IpcChannel>(
  handlers: IpcHandlers,
  channel: Channel,
  request: IpcRequest<Channel>,
): Promise<IpcResponse<Channel>> {
  return handlers[channel](request);
}

export async function dispatchIpc(
  handlers: IpcHandlers,
  channel: IpcChannel,
  rawPayload: unknown,
  sender: TrustedSender,
  allowedOrigins: AllowedOrigins,
): Promise<unknown> {
  assertTrustedSender(sender, allowedOrigins);

  const contract = ipcChannels[channel];
  const parsed = contract.request.safeParse(rawPayload);

  if (!parsed.success) {
    return contract.response.parse({
      ok: false,
      error: { code: 'validation-failed', message: parsed.error.message },
    });
  }

  const result = await callHandler(handlers, channel, parsed.data);

  return contract.response.parse(result);
}
