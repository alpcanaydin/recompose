import {
  GATEWAY_PORT_RANGE,
  gatewayPortSchema,
  gatewaySlugSchema,
  slugFromName,
} from '@recompose/contracts';

import { IpcResultError, refusalSentence } from '../../../../shared/api';

const RESERVED_NAME_REFUSAL = 'Windows reserves this name.';
const MISSING_NAME_REFUSAL = 'Give the gateway a name.';
const MALFORMED_DRAFT_REFUSAL = 'recompose cannot store this gateway as it stands.';
const PORT_RANGE_REFUSAL = `Accepts ${String(GATEWAY_PORT_RANGE.min)} through ${String(GATEWAY_PORT_RANGE.max)}.`;

/**
 * What the name field says back when the name is one the app can't store a gateway under.
 *
 * @summary The derivation lowercases, trims, and falls back, so format and length never reach a
 * person. Two things survive that: a name with nothing in it, which the fallback slug would hide
 * behind a gateway nobody named, and a device name Windows reserves, which only a rename fixes.
 */
export function nameRefusal(displayName: string): string | undefined {
  if (displayName.trim() === '') {
    return MISSING_NAME_REFUSAL;
  }

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

/** Where each refusal the draft can draw stands: under a field, or under the sheet itself. */
export type DraftRefusals = {
  name?: string | undefined;
  port?: string | undefined;
  sheet?: string | undefined;
};

/** What the draft refuses on its own, before it asks the main process to store anything. */
export function refusalsBeforeSaving(displayName: string, port: string): DraftRefusals {
  return { name: nameRefusal(displayName), port: portRefusal(port) };
}

/**
 * Where a refusal the main process sent belongs on the sheet.
 *
 * @summary A conflict names the field a person can fix and travels in the words main wrote,
 * which name the gateway already holding it. Everything else belongs to the sheet rather than
 * to a field, and a schema refusal trades its own words for a sentence, because the schema
 * writes for a developer.
 */
export function refusalFromMain(failure: unknown): DraftRefusals {
  if (failure instanceof IpcResultError) {
    if (failure.code === 'name-conflict') {
      return { name: failure.message };
    }

    if (failure.code === 'port-conflict') {
      return { port: failure.message };
    }

    if (failure.code === 'validation-failed') {
      return { sheet: MALFORMED_DRAFT_REFUSAL };
    }
  }

  return { sheet: refusalSentence(failure) };
}
