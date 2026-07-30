import { GATEWAY_PORT_RANGE, gatewayPortSchema, gatewaySlugSchema } from '@recompose/contracts';

const SLUG_FORMAT_REFUSAL = 'Accepts lowercase letters, digits, and single dashes.';
const RESERVED_NAME_REFUSAL = 'Windows reserves this name.';
const PORT_RANGE_REFUSAL = `Accepts ${String(GATEWAY_PORT_RANGE.min)} through ${String(GATEWAY_PORT_RANGE.max)}.`;

/** What the slug field says back when the gateway contract turns the slug down. */
export function slugRefusal(slug: string): string | undefined {
  const judged = gatewaySlugSchema.safeParse(slug);

  if (judged.success) {
    return undefined;
  }

  return judged.error.issues.some((issue) => issue.code === 'custom')
    ? RESERVED_NAME_REFUSAL
    : SLUG_FORMAT_REFUSAL;
}

/** What the port field says back when the typed port falls outside what a gateway can bind. */
export function portRefusal(port: string): string | undefined {
  return gatewayPortSchema.safeParse(Number(port)).success ? undefined : PORT_RANGE_REFUSAL;
}

/** The address a gateway on this port would answer at, with no path, ready to paste. */
export function previewAddressFor(port: string): string {
  return port === '' ? 'http://localhost' : `http://localhost:${port}`;
}
