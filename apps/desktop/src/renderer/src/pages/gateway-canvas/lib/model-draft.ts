import type { GatewayConfig, VirtualModel } from '@recompose/contracts';

import { modelAliasFromName, modelAliasSchema } from '@recompose/contracts';

import type { ProviderModelList } from '../../../shared/api';

import { IpcResultError, refusalSentence } from '../../../shared/api';

const MISSING_NAME_REFUSAL = 'Give the virtual model a name.';
const UNSERVABLE_ID_REFUSAL = 'recompose cannot serve a virtual model under this id.';
const MALFORMED_DEFINITION_REFUSAL = 'recompose cannot store this virtual model as it stands.';
const SKIPPED_ID_HINT = 'Claude Code lists only ids starting with claude or anthropic.';
const DISCOVERED_PREFIXES = ['claude', 'anthropic'];

/** What the name field says back when a name with nothing in it can stand for no model. */
export function nameRefusal(displayName: string): string | undefined {
  return displayName.trim() === '' ? MISSING_NAME_REFUSAL : undefined;
}

/**
 * The id a name derives to, kept in step with the name until a person edits the id by hand.
 *
 * @summary The id follows the name while it still reads as the name's derived alias, and an empty
 * id counts as following, so clearing a hand-edit lets the name drive it again. Once the id says
 * something the name would not derive, it belongs to the person, and typing the name leaves it be.
 */
export function idFollowingName(previousName: string, nextName: string, currentId: string): string {
  const following = currentId === '' || currentId === modelAliasFromName(previousName);

  return following ? modelAliasFromName(nextName) : currentId;
}

/**
 * What the model id field says back when the id a client would send cannot stand as it is.
 *
 * @summary An id no client could send refuses first, then one this gateway already serves, because
 * a second definition under one id would leave two answers to a single request.
 */
export function idRefusal(id: string, held: readonly VirtualModel[]): string | undefined {
  if (!modelAliasSchema.safeParse(id).success) {
    return UNSERVABLE_ID_REFUSAL;
  }

  return held.some((model) => model.id === id)
    ? `This gateway already serves a virtual model named "${id}".`
    : undefined;
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
  /** The name a person gave the model, which the id derives from until a person edits it. */
  displayName: string;
  /** The id a client sends as its `model`, saved as a person saw it rather than derived again. */
  id: string;
  /** The account the model reaches. */
  accountId: string;
  /** The real model that account serves. */
  providerModel: string;
};

/** A definition nobody has said anything about yet, which is what a fresh draft opens on. */
export function emptyDefinition(): SettledDefinition {
  return { displayName: '', id: '', accountId: '', providerModel: '' };
}

/**
 * What to hold on to when the flow hands its draft back as it leaves the screen.
 *
 * @summary The flow hands its values over whenever it unmounts, and it cannot tell being closed
 * from being finished. So the answer reads the draft that stands: a person still mid-definition
 * keeps their words for the reopen, and one who cancelled or stored keeps nothing, which is what
 * stops a settled draft from walking back in.
 */
export function draftKept(
  held: SettledDefinition | undefined,
  handed: SettledDefinition,
): SettledDefinition | undefined {
  return held === undefined ? undefined : handed;
}

/** The gateway as it stands once it carries this definition too, ready for storage. */
export function gatewayDefining(gateway: GatewayConfig, settled: SettledDefinition): GatewayConfig {
  return {
    ...gateway,
    virtualModels: [
      ...gateway.virtualModels,
      {
        id: settled.id,
        displayName: settled.displayName,
        target: { accountId: settled.accountId, providerModel: settled.providerModel },
      },
    ],
  };
}

export type DraftBinding = {
  /** The id a client asks for, which the preview reads first. */
  id: string;
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
export function servesPreview({ id, target, providerModel }: DraftBinding): string | undefined {
  if (id === '' || target === undefined || providerModel === '') {
    return undefined;
  }

  return `serves as ${id} → ${target} · ${providerModel}`;
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

/**
 * The sentence a refused save reads as, in words about the virtual model a person was defining.
 *
 * @summary A schema refusal trades its words, because the schema writes for a developer and names
 * a path inside a document nobody typed. Everything else travels as main wrote it: a gateway the
 * rewrite could not find and a port the move lane owns are both already sentences a person can act
 * on, and rewriting them here would only put this module's guess in front of main's fact.
 */
export function refusalFromMain(failure: unknown): string {
  if (!(failure instanceof IpcResultError)) {
    return refusalSentence(failure);
  }

  return failure.code === 'validation-failed' ? MALFORMED_DEFINITION_REFUSAL : failure.message;
}
