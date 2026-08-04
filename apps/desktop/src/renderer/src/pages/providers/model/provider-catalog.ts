import type {
  CredentialedAccount,
  CredentialedAccountKind,
  KeyProviderId,
  LocalRuntimeId,
  RecognizedKeyShape,
  SubscriptionProviderId,
} from '@recompose/contracts';

import {
  credentialedAccountKindSchema,
  keyProviderIdSchema,
  localRuntimeIdSchema,
  localRuntimes,
  recognizedKeyShapeSchema,
  subscriptionProviderIdSchema,
} from '@recompose/contracts';

import type { AccountKind } from '../../../entities/account';
import type { BrandMarkName, IconName } from '../../../shared/ui';

/** A way an account reaches a provider, which is every kind the registry holds one under. */
export type ConnectionWay = AccountKind;

/** A provider identity the catalog offers a way to connect, which is narrower than the marks. */
export type CatalogProviderId = 'anthropic' | 'openai' | 'openrouter' | 'ollama';

/**
 * What a row is drawn with: a vendor's own mark, or the glyph its category stands under.
 *
 * @summary A mark recompose can draw is not a provider recompose can connect, so the drawing is
 * stated per row rather than derived from the identity. A category and a product publishing no
 * mark both name a glyph here, which is the rule rather than a fallback.
 */
export type CatalogLead = { mark: BrandMarkName } | { glyph: IconName };

export type CatalogOffer = {
  way: ConnectionWay;
  /** What the row reads as under this way, which is the product rather than the vendor. */
  title: string;
  /** One line saying what connecting this way gives. */
  benefit: string;
};

export type CatalogEntry = {
  /** The provider the entry stands for. */
  id: CatalogProviderId;
  /** The name the provider goes by on screen. */
  name: string;
  /** The mark or glyph the entry's cards lead with. */
  lead: CatalogLead;
  /** Every way this provider can be connected, in the order they are offered. */
  offers: readonly CatalogOffer[];
};

/** The name each vendor recompose draws a mark for goes by on screen. */
export const providerNames = {
  anthropic: 'Anthropic',
  cerebras: 'Cerebras',
  deepinfra: 'DeepInfra',
  deepseek: 'DeepSeek',
  fireworks: 'Fireworks AI',
  gemini: 'Gemini',
  githubCopilot: 'GitHub Copilot',
  grok: 'Grok',
  groq: 'Groq',
  kimi: 'Kimi',
  lmstudio: 'LM Studio',
  minimax: 'MiniMax',
  mistral: 'Mistral',
  moonshot: 'Moonshot AI',
  ollama: localRuntimes.ollama.name,
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  qwen: 'Qwen',
  together: 'Together AI',
  vllm: 'vLLM',
  zhipu: 'Z.ai',
} as const satisfies Record<BrandMarkName, string>;

/**
 * The name a provider goes by on screen.
 *
 * @summary Reach for it where a provider is read without a catalog row beside it, so a stored
 * account and the catalog it came from never disagree about what the provider is called.
 */
export function providerName(id: BrandMarkName): string {
  return providerNames[id];
}

const keyHosts: Record<KeyProviderId, string> = {
  anthropic: 'api.anthropic.com',
  openai: 'api.openai.com',
};

const runtimeHosts: Record<LocalRuntimeId, string> = {
  ollama: new URL(localRuntimes.ollama.address).host,
};

/**
 * Every provider the catalog offers, with the ways each one connects.
 *
 * @summary Reach for it from the catalog. A provider that both sells a plan and sells a key
 * stands under both ways, because the two yield different things and a person chooses between
 * them rather than being handed one. Each way carries its own title, because a plan reads as the
 * product a person pays for and a key reads as the endpoint it is spent against.
 */
export const catalogEntries: readonly CatalogEntry[] = [
  {
    id: 'anthropic',
    name: providerNames.anthropic,
    lead: { mark: 'anthropic' },
    offers: [
      { way: 'subscription', title: 'Claude', benefit: 'Sign in with your Pro or Max plan' },
      { way: 'api-key', title: 'Anthropic API', benefit: `${keyHosts.anthropic} with your key` },
    ],
  },
  {
    id: 'openai',
    name: providerNames.openai,
    lead: { mark: 'openai' },
    offers: [
      { way: 'subscription', title: 'Codex', benefit: 'Sign in with your ChatGPT plan' },
      { way: 'api-key', title: 'OpenAI API', benefit: `${keyHosts.openai} with your key` },
    ],
  },
  {
    id: 'openrouter',
    name: providerNames.openrouter,
    lead: { mark: 'openrouter' },
    offers: [{ way: 'aggregator', title: 'OpenRouter', benefit: 'One key, 300+ models' }],
  },
  {
    id: 'ollama',
    name: providerNames.ollama,
    lead: { mark: 'ollama' },
    offers: [
      {
        way: 'local',
        title: providerNames.ollama,
        benefit: `${runtimeHosts.ollama}, models on this machine`,
      },
    ],
  },
];

/** The copy an entry's row reads as under one way, or nothing when the way is not offered. */
export function offerFor(entry: CatalogEntry, way: ConnectionWay): CatalogOffer | undefined {
  return entry.offers.find((offer) => offer.way === way);
}

/**
 * The offer that hands over a secret, or nothing where the entry never asks for one.
 *
 * @summary Signing in and serving this machine both reach a provider without a stored secret, so
 * the ways that do are named here once instead of being guessed at by each caller.
 */
function keyOfferIn(entry: CatalogEntry): CatalogOffer | undefined {
  return entry.offers.find((offer) => offer.way !== 'subscription' && offer.way !== 'local');
}

/**
 * The plan product a stored subscription reads as, which is what its catalog card read as.
 *
 * @summary A person connected "Claude", so the row that lists the account keeps that word
 * rather than trading it for the vendor behind it.
 */
export function subscriptionTitleFor(id: CatalogProviderId): string {
  const entry = catalogEntries.find((candidate) => candidate.id === id);
  const title = entry === undefined ? undefined : offerFor(entry, 'subscription')?.title;

  return title ?? providerName(id);
}

/**
 * The endpoint product a stored key reads as, which is what its catalog entry was picked as.
 *
 * @summary A person picked "Anthropic API", so the row that lists the key keeps that word. A key
 * stored under a provider the catalog never offered keeps the provider it was stored under, so a
 * row that predates the catalog still says whose key it holds rather than standing nameless.
 */
export function keyTitleFor(provider: string): string {
  const entry = catalogEntries.find((candidate) => candidate.id === provider);
  const offer = entry === undefined ? undefined : keyOfferIn(entry);

  return offer?.title ?? provider;
}

const keyShapeHints: Record<RecognizedKeyShape, string> = {
  anthropic: 'sk-ant-…',
  openai: 'sk-proj-…',
  openrouter: 'sk-or-v1-…',
};

/**
 * The shape a provider's keys are handed out in, or nothing where no shape is documented.
 *
 * @summary Reach for it where an empty key field wants a hint. The hint echoes the one documented
 * prefix family per vendor, so a person pasting recognizes at a glance which key belongs here.
 */
export function keyShapeHintFor(provider: string): string | undefined {
  const known = recognizedKeyShapeSchema.safeParse(provider);

  return known.success ? keyShapeHints[known.data] : undefined;
}

/**
 * The host a provider's key is spent against, or nothing where its one key reaches many.
 *
 * @summary Reach for it where a person is about to hand over a key, so the surface says which
 * host will hold it before it is stored. An aggregator reaches many hosts through one key, so it
 * names none of them rather than naming the wrong one.
 */
export function keyHostFor(provider: string): string | undefined {
  const known = keyProviderIdSchema.safeParse(provider);

  return known.success ? keyHosts[known.data] : undefined;
}

/** The mark a stored provider is drawn with, or nothing where the catalog draws a glyph. */
export function markFor(provider: string): BrandMarkName | undefined {
  const lead = catalogEntries.find((entry) => entry.id === provider)?.lead;

  return lead !== undefined && 'mark' in lead ? lead.mark : undefined;
}

/**
 * Whether a check can answer anything about a stored key.
 *
 * @summary The probe speaks two vendors' dialects, so a row under any other provider has nobody
 * to ask and offers no check rather than offering one that can only fail.
 */
export function checkableKey(account: CredentialedAccount): boolean {
  return account.kind === 'api-key' && keyProviderIdSchema.safeParse(account.provider).success;
}

/** The entries that offer one way, in catalog order, which is what a kind-locked list holds. */
export function offeredUnder(
  entries: readonly CatalogEntry[],
  way: ConnectionWay,
): readonly CatalogEntry[] {
  return entries.filter((entry) => offerFor(entry, way) !== undefined);
}

/**
 * The provider identity an entry would sign in under, or nothing when it never signs in.
 *
 * @summary An entry offering the subscription way is a claim that its identity is one the
 * subscription contract knows, so the claim is checked here rather than trusted downstream.
 */
export function signInProviderOf(entry: CatalogEntry): SubscriptionProviderId | undefined {
  return offerFor(entry, 'subscription') === undefined
    ? undefined
    : subscriptionProviderIdSchema.parse(entry.id);
}

/**
 * The runtime an entry would be detected and stored as, or nothing when it reaches off the machine.
 *
 * @summary An entry offering the local way is a claim that its identity is one the local-runtimes
 * contract knows an address for, so the claim is checked here rather than trusted downstream.
 */
export function localRuntimeOf(entry: CatalogEntry): LocalRuntimeId | undefined {
  return offerFor(entry, 'local') === undefined ? undefined : localRuntimeIdSchema.parse(entry.id);
}

/**
 * The kind an entry's key would be held under, or nothing when it hands over no secret.
 *
 * @summary The catalog's ways that hand over a secret are kept apart by kind in the registry, so
 * the claim is checked against the kinds that admit a secret rather than assumed.
 */
export function keyKindOf(entry: CatalogEntry): CredentialedAccountKind | undefined {
  const offer = keyOfferIn(entry);

  return offer === undefined ? undefined : credentialedAccountKindSchema.parse(offer.way);
}
