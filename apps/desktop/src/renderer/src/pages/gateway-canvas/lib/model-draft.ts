import type { GatewayConfig, VirtualModel } from '@recompose/contracts';

import { gatewaySlugSchema, slugFromName } from '@recompose/contracts';

import type { ProviderModelList } from '../../../shared/api';

import { IpcResultError, refusalSentence } from '../../../shared/api';

const MISSING_NAME_REFUSAL = 'Give the virtual model a name.';
const UNSERVABLE_NAME_REFUSAL = 'recompose cannot serve a virtual model under this name.';
const MALFORMED_DEFINITION_REFUSAL = 'recompose cannot store this virtual model as it stands.';
const SKIPPED_ID_HINT = 'Claude Code lists only ids starting with claude or anthropic.';
const DISCOVERED_PREFIXES = ['claude', 'anthropic'];

/**
 * What the name field says back when no definition can stand under the name as typed.
 *
 * @summary The id is derived rather than typed, so format and length never reach a person. Three
 * things survive that: a name with nothing in it, which the fallback id would hide behind a model
 * nobody named; a name landing on an id the stored shape refuses; and a name this gateway already
 * serves, which would leave two definitions answering to one id.
 */
export function nameRefusal(
  displayName: string,
  held: readonly VirtualModel[],
): string | undefined {
  if (displayName.trim() === '') {
    return MISSING_NAME_REFUSAL;
  }

  const id = slugFromName(displayName);

  if (!gatewaySlugSchema.safeParse(id).success) {
    return UNSERVABLE_NAME_REFUSAL;
  }

  return held.some((model) => model.id === id)
    ? `This gateway already serves a virtual model named "${id}".`
    : undefined;
}

/** The id a client would ask this model for, or nothing while the name says nothing. */
export function previewWireId(displayName: string): string | undefined {
  return displayName.trim() === '' ? undefined : slugFromName(displayName);
}

/**
 * The quiet word about which ids a caller's own picker will surface, where one applies.
 *
 * @summary Claude Code lists only the prefixes it recognizes, so an id outside them serves every
 * client that asks for it by name and appears in that one picker for nobody. The name stays free,
 * because the hint belongs beside the derived id rather than as a rule about what a person may type.
 */
export function discoveryHint(wireId: string): string | undefined {
  return DISCOVERED_PREFIXES.some((prefix) => wireId.startsWith(prefix))
    ? undefined
    : SKIPPED_ID_HINT;
}

export type SettledDefinition = {
  /** The name a person gave the model, which the id is derived from. */
  displayName: string;
  /** The account the model reaches. */
  accountId: string;
  /** The real model that account serves. */
  providerModel: string;
};

/** The gateway as it stands once it carries this definition too, ready for storage. */
export function gatewayDefining(gateway: GatewayConfig, settled: SettledDefinition): GatewayConfig {
  return {
    ...gateway,
    virtualModels: [
      ...gateway.virtualModels,
      {
        id: slugFromName(settled.displayName),
        displayName: settled.displayName,
        target: { accountId: settled.accountId, providerModel: settled.providerModel },
      },
    ],
  };
}

export type DraftBinding = {
  /** The name a person typed, which the previewed id derives from. */
  displayName: string;
  /** What the picked target reads as, or nothing while none is picked. */
  target: string | undefined;
  /** The real model picked, which is empty while none is. */
  providerModel: string;
};

/**
 * The whole binding a settled draft would serve, as one line a person can check.
 *
 * @summary The line reads in the direction a request travels: the id a client asks for, then the
 * account and the real model that answer it. A draft missing any of the three previews nothing,
 * because half a binding invites a person to believe the rest was already decided.
 */
export function servesPreview({
  displayName,
  target,
  providerModel,
}: DraftBinding): string | undefined {
  const wireId = previewWireId(displayName);

  if (wireId === undefined || target === undefined || providerModel === '') {
    return undefined;
  }

  return `serves as ${wireId} → ${target} · ${providerModel}`;
}

/** What the Model field offers, and the sentence standing where a look answered nothing. */
export type ModelListReading = { offered: readonly string[]; refusal: string | undefined };

/**
 * What the sheet reads out of one look at a target's model list.
 *
 * @summary A look still out and a look that reached nothing both offer no id, and only the second
 * says why, so the field stays quiet while a person waits and speaks once there is something to
 * say. Nothing here falls back to a free-text model, because a binding must never name a model the
 * account cannot serve.
 */
export function modelListReading(answer: ProviderModelList | undefined): ModelListReading {
  if (answer === undefined) {
    return { offered: [], refusal: undefined };
  }

  return answer.standing === 'listed'
    ? { offered: answer.modelIds, refusal: undefined }
    : { offered: [], refusal: answer.refusal };
}

/** Where each refusal the draft can draw stands: under the name, or under the sheet itself. */
export type ModelDraftRefusals = { name?: string | undefined; sheet?: string | undefined };

/**
 * Where a refusal the main process sent belongs on the sheet.
 *
 * @summary A refusal about a name travels in main's own words and lands under the name, which is
 * the one thing a person can retype. A schema refusal trades its words for a sentence, because the
 * schema writes for a developer. Everything else belongs to the sheet rather than to a field.
 */
export function refusalFromMain(failure: unknown): ModelDraftRefusals {
  if (!(failure instanceof IpcResultError)) {
    return { sheet: refusalSentence(failure) };
  }

  if (failure.code === 'validation-failed') {
    return { sheet: MALFORMED_DEFINITION_REFUSAL };
  }

  return failure.code === 'name-conflict' ? { name: failure.message } : { sheet: failure.message };
}
