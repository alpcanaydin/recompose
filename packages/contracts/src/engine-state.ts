import { z } from 'zod';

import { gatewayPortSchema, gatewaySlugSchema } from './gateway-config';

export const gatewayEngineStateSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('running') }),
  z.strictObject({
    status: z.literal('stopped'),
    failure: z.strictObject({ port: gatewayPortSchema }).optional(),
  }),
]);

export type GatewayEngineState = z.infer<typeof gatewayEngineStateSchema>;

export const engineStatesSchema = z.record(gatewaySlugSchema, gatewayEngineStateSchema);

export type EngineStates = z.infer<typeof engineStatesSchema>;
