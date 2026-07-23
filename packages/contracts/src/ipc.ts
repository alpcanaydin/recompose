import { z } from 'zod';

import { accountKindSchema, accountsDocumentSchema } from './accounts';
import { gatewayConfigSchema } from './gateway-config';
import { nonBlankString } from './non-blank';
import { settingsSchema } from './settings';

export const ipcErrorSchema = z.strictObject({
  code: z.enum(['vault-unavailable', 'vault-newer-schema', 'validation-failed', 'storage-failed']),
  message: z.string().min(1),
});

export type IpcError = z.infer<typeof ipcErrorSchema>;

export function ipcResult<Value extends z.ZodType>(value: Value) {
  return z.union([
    z.strictObject({ ok: z.literal(true), value }),
    z.strictObject({ ok: z.literal(false), error: ipcErrorSchema }),
  ]);
}

export const connectAccountRequestSchema = z.strictObject({
  provider: nonBlankString,
  kind: accountKindSchema,
  label: z.string().trim().min(1),
  secret: nonBlankString,
});

export const ipcChannels = {
  'gateways:list': { request: z.void(), response: ipcResult(z.array(gatewayConfigSchema)) },
  'gateways:save': {
    request: gatewayConfigSchema,
    response: ipcResult(z.array(gatewayConfigSchema)),
  },
  'settings:get': { request: z.void(), response: ipcResult(settingsSchema) },
  'settings:save': { request: settingsSchema, response: ipcResult(settingsSchema) },
  'accounts:list': { request: z.void(), response: ipcResult(accountsDocumentSchema) },
  'accounts:connect': {
    request: connectAccountRequestSchema,
    response: ipcResult(accountsDocumentSchema),
  },
  'accounts:remove': {
    request: z.strictObject({ id: nonBlankString }),
    response: ipcResult(accountsDocumentSchema),
  },
} as const;

export type IpcChannel = keyof typeof ipcChannels;
export type IpcRequest<Channel extends IpcChannel> = z.infer<
  (typeof ipcChannels)[Channel]['request']
>;
export type IpcResponse<Channel extends IpcChannel> = z.infer<
  (typeof ipcChannels)[Channel]['response']
>;

export type RecomposeIpc = {
  [Channel in IpcChannel]: (request: IpcRequest<Channel>) => Promise<IpcResponse<Channel>>;
};
