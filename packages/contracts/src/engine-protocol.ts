import { z } from 'zod';

import { gatewayEngineStateSchema } from './engine-state';
import { gatewayPortSchema, gatewaySlugSchema } from './gateway-config';

export const engineGatewaySchema = z.strictObject({
  slug: gatewaySlugSchema,
  displayName: z.string().trim().min(1),
  port: gatewayPortSchema,
});

export type EngineGateway = z.infer<typeof engineGatewaySchema>;

export const engineDirectiveSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('start'), gateway: engineGatewaySchema }),
  z.strictObject({ kind: z.literal('stop'), slug: gatewaySlugSchema }),
]);

export type EngineDirective = z.infer<typeof engineDirectiveSchema>;

export const engineReportSchema = z.strictObject({
  kind: z.literal('state'),
  slug: gatewaySlugSchema,
  state: gatewayEngineStateSchema,
});

export type EngineReport = z.infer<typeof engineReportSchema>;
