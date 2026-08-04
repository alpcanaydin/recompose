import { z } from 'zod';

import { nonBlankString } from './non-blank';

export const localRuntimeIdSchema = z.enum(['ollama']);

export type LocalRuntimeId = z.infer<typeof localRuntimeIdSchema>;

export const localRuntimes = {
  ollama: { name: 'Ollama', address: 'http://127.0.0.1:11434' },
} as const satisfies Record<LocalRuntimeId, { name: string; address: string }>;

/**
 * How long a look at a runtime waits for the loopback answer before it counts as silence.
 *
 * @summary Both processes read it: the engine child bounds its fetch by it, and the host's own wait
 * has to outlast it, so a look folds on the child's verdict rather than on the host giving up. The
 * two sides sit behind a wall that lets neither import the other, so the bound stands here.
 */
export const runtimeLookBoundMs = 3_000;

export const RUNTIME_PORT_RANGE = { min: 1, max: 65535 } as const;

export const runtimePortSchema = z.int().min(RUNTIME_PORT_RANGE.min).max(RUNTIME_PORT_RANGE.max);

export function documentedRuntimePort(runtime: LocalRuntimeId): number {
  return Number(new URL(localRuntimes[runtime].address).port);
}

export function runtimeAddressFor(runtime: LocalRuntimeId, port?: number): string {
  if (port === undefined) {
    return localRuntimes[runtime].address;
  }

  const moved = new URL(localRuntimes[runtime].address);

  moved.port = String(port);

  return moved.origin;
}

const loopbackHost = '127.0.0.1';

const probeableProtocols = ['http:', 'https:'];

function isItsOwnLoopbackOrigin(address: string): boolean {
  const parsed = URL.parse(address);

  return (
    parsed !== null &&
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
