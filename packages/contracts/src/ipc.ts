import { z } from 'zod';

import { accountKindSchema, accountsDocumentSchema } from './accounts';
import { engineStatesSchema, gatewayEngineStateSchema } from './engine-state';
import { gatewayConfigSchema, gatewayPortSchema, gatewaySlugSchema } from './gateway-config';
import { nonBlankString } from './non-blank';
import { settingsPatchSchema, settingsSchema } from './settings';

export const ipcErrorSchema = z.strictObject({
  code: z.enum([
    'vault-unavailable',
    'vault-newer-schema',
    'settings-newer-schema',
    'validation-failed',
    'storage-failed',
    'folder-open-failed',
    'token-missing',
    'name-conflict',
    'port-conflict',
  ]),
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

export const systemStateSchema = z.strictObject({
  fileBrowser: z.enum(['finder', 'explorer', 'file-manager']),
  loginItem: z.enum(['available', 'unpackaged', 'unsupported']),
  loginItemEnabled: z.boolean(),
  menuBarVisible: z.boolean(),
  configFolder: nonBlankString,
});

export type SystemState = z.infer<typeof systemStateSchema>;

export const gatewayTokenStatusSchema = z.strictObject({
  masked: z.string().min(1).nullable(),
  storage: z.enum(['available', 'plaintext-fallback', 'unavailable']),
});

export type GatewayTokenStatus = z.infer<typeof gatewayTokenStatusSchema>;

export const ipcChannels = {
  'gateways:list': { request: z.void(), response: ipcResult(z.array(gatewayConfigSchema)) },
  'gateways:save': {
    request: gatewayConfigSchema,
    response: ipcResult(z.array(gatewayConfigSchema)),
  },
  'settings:get': { request: z.void(), response: ipcResult(settingsSchema) },
  'settings:save': { request: settingsPatchSchema, response: ipcResult(settingsSchema) },
  'accounts:list': { request: z.void(), response: ipcResult(accountsDocumentSchema) },
  'accounts:connect': {
    request: connectAccountRequestSchema,
    response: ipcResult(accountsDocumentSchema),
  },
  'accounts:remove': {
    request: z.strictObject({ id: nonBlankString }),
    response: ipcResult(accountsDocumentSchema),
  },
  'system:get': { request: z.void(), response: ipcResult(systemStateSchema) },
  'system:open-config-folder': { request: z.void(), response: ipcResult(z.void()) },
  'gateway-token:status': { request: z.void(), response: ipcResult(gatewayTokenStatusSchema) },
  'gateway-token:mint': { request: z.void(), response: ipcResult(gatewayTokenStatusSchema) },
  'gateway-token:copy': { request: z.void(), response: ipcResult(z.void()) },
  'gateways:offer-port': { request: z.void(), response: ipcResult(gatewayPortSchema) },
  'gateways:move-port': {
    request: z.strictObject({ slug: gatewaySlugSchema }),
    response: ipcResult(z.array(gatewayConfigSchema)),
  },
  'engine:start': {
    request: z.strictObject({ slug: gatewaySlugSchema }),
    response: ipcResult(gatewayEngineStateSchema),
  },
  'engine:stop': {
    request: z.strictObject({ slug: gatewaySlugSchema }),
    response: ipcResult(gatewayEngineStateSchema),
  },
  'engine:states': { request: z.void(), response: ipcResult(engineStatesSchema) },
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

export const ipcEvents = {
  'engine:state': { payload: engineStatesSchema },
} as const;

export type IpcEvent = keyof typeof ipcEvents;
export type IpcEventPayload<Event extends IpcEvent> = z.infer<(typeof ipcEvents)[Event]['payload']>;

export type RecomposeIpcEvents = {
  [Event in IpcEvent]: (listener: (payload: IpcEventPayload<Event>) => void) => () => void;
};
