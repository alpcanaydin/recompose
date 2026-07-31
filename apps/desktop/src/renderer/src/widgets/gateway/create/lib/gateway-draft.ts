import {
  GATEWAY_PORT_RANGE,
  gatewayPortSchema,
  gatewaySlugSchema,
  slugFromName,
} from '@recompose/contracts';

const RESERVED_NAME_REFUSAL = 'Windows reserves this name.';
const PORT_RANGE_REFUSAL = `Accepts ${String(GATEWAY_PORT_RANGE.min)} through ${String(GATEWAY_PORT_RANGE.max)}.`;

/**
 * What the name field says back when the slug the app derives from the name is one it can't store.
 *
 * @summary The derivation lowercases, trims, and falls back, so format and length never reach a
 * person. A device name Windows reserves is the one thing left that only a rename can fix.
 */
export function nameRefusal(displayName: string): string | undefined {
  return gatewaySlugSchema.safeParse(slugFromName(displayName)).success
    ? undefined
    : RESERVED_NAME_REFUSAL;
}

/** What the port field says back when the typed port falls outside what a gateway can bind. */
export function portRefusal(port: string): string | undefined {
  return gatewayPortSchema.safeParse(Number(port)).success ? undefined : PORT_RANGE_REFUSAL;
}

/** The address a gateway on this port would answer at, with no path, ready to paste. */
export function previewAddressFor(port: string): string {
  return port === '' ? 'http://localhost' : `http://localhost:${port}`;
}
