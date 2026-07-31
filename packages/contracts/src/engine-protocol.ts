import { z } from 'zod';

import { gatewayEngineStateSchema } from './engine-state';
import { gatewayPortSchema, gatewaySlugSchema } from './gateway-config';

export const engineGatewaySchema = z.strictObject({
  slug: gatewaySlugSchema,
  displayName: z.string().trim().min(1),
  port: gatewayPortSchema,
});

export type EngineGateway = z.infer<typeof engineGatewaySchema>;

export const directiveIdSchema = z.string().trim().min(1);

export const engineDirectiveSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('start'),
    id: directiveIdSchema,
    gateway: engineGatewaySchema,
  }),
  z.strictObject({ kind: z.literal('stop'), id: directiveIdSchema, slug: gatewaySlugSchema }),
]);

export type EngineDirective = z.infer<typeof engineDirectiveSchema>;

export const engineReportSchema = z.strictObject({
  kind: z.literal('state'),
  answers: directiveIdSchema,
  slug: gatewaySlugSchema,
  state: gatewayEngineStateSchema,
});

export type EngineReport = z.infer<typeof engineReportSchema>;
