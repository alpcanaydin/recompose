import { z } from 'zod';

import { nonBlankString } from './non-blank';

export const localRuntimeIdSchema = z.enum(['ollama']);

export type LocalRuntimeId = z.infer<typeof localRuntimeIdSchema>;

export const localRuntimeAddresses = {
  ollama: 'http://127.0.0.1:11434',
} as const satisfies Record<LocalRuntimeId, string>;

const loopbackHost = '127.0.0.1';

const probeableProtocols = ['http:', 'https:'];

function addressOrNothing(address: string): URL | undefined {
  try {
    return new URL(address);
  } catch {
    return undefined;
  }
}

function isItsOwnLoopbackOrigin(address: string): boolean {
  const parsed = addressOrNothing(address);

  return (
    parsed !== undefined &&
    probeableProtocols.includes(parsed.protocol) &&
    parsed.hostname === loopbackHost &&
    parsed.origin === address
  );
}

export const loopbackAddressSchema = z
  .string()
  .refine(isItsOwnLoopbackOrigin, 'the address must be a loopback origin');

export const runtimeReachabilitySchema = z.discriminatedUnion('verdict', [
  z.strictObject({ verdict: z.literal('answers'), version: nonBlankString }),
  z.strictObject({ verdict: z.literal('unrecognized'), status: z.number().int() }),
  z.strictObject({ verdict: z.literal('unreachable') }),
]);

export type RuntimeReachability = z.infer<typeof runtimeReachabilitySchema>;
