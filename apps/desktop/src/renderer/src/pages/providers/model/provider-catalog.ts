import type {
  CredentialedAccount,
  CredentialedAccountKind,
  KeyProviderId,
  SubscriptionProviderId,
} from '@recompose/contracts';

import {
  credentialedAccountKindSchema,
  keyProviderIdSchema,
  subscriptionProviderIdSchema,
} from '@recompose/contracts';

import type { AccountKind } from '../../../entities/account';
import type { BrandMarkName, IconName } from '../../../shared/ui';

/** A way an account reaches a provider, which is every kind but the one nothing connects as. */
export type ConnectionWay = Exclude<AccountKind, 'local'>;

export type CatalogOffer = {
  way: ConnectionWay;
  /** What the row reads as under this way, which is the product rather than the vendor. */
  title: string;
  /** One line saying what connecting this way gives. */
  benefit: string;
};

export type CatalogEntry = {
  /** The provider the entry stands for, which is also the mark it is drawn with. */
  id: BrandMarkName;
  /** The name the provider goes by on screen. */
  name: string;
  /** Every way this provider can be connected, in the order they are offered. */
  offers: readonly CatalogOffer[];
};

export type AwaitedProvider = {
  /** The product the row stands for. */
  name: string;
  /** One line saying what connecting it will give, once it can be connected. */
  benefit: string;
  /** The glyph the row leads with until the product carries a licensed mark. */
  glyph: IconName;
};

const providerNames = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
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
    offers: [
      { way: 'subscription', title: 'Claude', benefit: 'Sign in with your Pro or Max plan' },
      { way: 'api-key', title: 'Anthropic API', benefit: `${keyHosts.anthropic} with your key` },
    ],
  },
  {
    id: 'openai',
    name: providerNames.openai,
    offers: [
      { way: 'subscription', title: 'Codex', benefit: 'Sign in with your ChatGPT plan' },
      { way: 'api-key', title: 'OpenAI API', benefit: `${keyHosts.openai} with your key` },
    ],
  },
  {
    id: 'openrouter',
    name: providerNames.openrouter,
    offers: [{ way: 'aggregator', title: 'OpenRouter', benefit: 'One key, 300+ models' }],
  },
];

const awaitedSubscriptions: readonly AwaitedProvider[] = [
  { name: 'GitHub Copilot', benefit: 'Sign in with your GitHub account', glyph: 'github' },
  { name: 'Kimi Code', benefit: 'Moonshot plan, K2 in your tools', glyph: 'moon' },
  { name: 'GLM Coding Plan', benefit: 'Z.ai plan, GLM models', glyph: 'person' },
  { name: 'Qwen Coding Plan', benefit: 'Alibaba Model Studio, multi-model', glyph: 'person' },
  { name: 'MiniMax Coding Plan', benefit: 'M2 on a flat monthly quota', glyph: 'person' },
];

const awaitedLocals: readonly AwaitedProvider[] = [
  { name: 'Ollama', benefit: 'localhost:11434, models on this machine', glyph: 'monitor' },
  { name: 'LM Studio', benefit: 'localhost:1234, local server', glyph: 'monitor' },
  { name: 'llama.cpp', benefit: 'llama-server on localhost:8080', glyph: 'monitor' },
  { name: 'vLLM', benefit: 'High-throughput GPU serving', glyph: 'monitor' },
];

const awaitsAUrlAndADialect = 'Waits on a base URL and a dialect';

const awaitedKeys: readonly AwaitedProvider[] = [
  { name: 'Gemini API', benefit: 'Waits on a base URL, a dialect, and a header', glyph: 'spark' },
  { name: 'Mistral', benefit: awaitsAUrlAndADialect, glyph: 'spark' },
  { name: 'xAI Grok', benefit: awaitsAUrlAndADialect, glyph: 'spark' },
  { name: 'DeepSeek', benefit: awaitsAUrlAndADialect, glyph: 'spark' },
  { name: 'Moonshot AI', benefit: awaitsAUrlAndADialect, glyph: 'moon' },
  { name: 'Qwen', benefit: awaitsAUrlAndADialect, glyph: 'person' },
  { name: 'Custom endpoint', benefit: awaitsAUrlAndADialect, glyph: 'network' },
];

const awaitedUnderKind: Record<AccountKind, readonly AwaitedProvider[]> = {
  subscription: awaitedSubscriptions,
  'api-key': awaitedKeys,
  aggregator: [],
  local: awaitedLocals,
};

/**
 * The providers recompose will connect to later, standing in the catalog before they can.
 *
 * @summary The first release ends at Claude, Codex, and the two first-party keys, and the rows
 * that follow say what the catalog grows toward rather than hiding it. A row here cannot be
 * picked, so it carries no provider identity yet, and its line names what it waits on.
 */
export function awaitedFor(kind: AccountKind): readonly AwaitedProvider[] {
  return awaitedUnderKind[kind];
}

/** The copy an entry's row reads as under one way, or nothing when the way is not offered. */
export function offerFor(entry: CatalogEntry, way: ConnectionWay): CatalogOffer | undefined {
  return entry.offers.find((offer) => offer.way === way);
}

/**
 * The plan product a stored subscription reads as, which is what its catalog card read as.
 *
 * @summary A person connected "Claude", so the row that lists the account keeps that word
 * rather than trading it for the vendor behind it.
 */
export function subscriptionTitleFor(id: BrandMarkName): string {
  const entry = catalogEntries.find((candidate) => candidate.id === id);
  const title = entry === undefined ? undefined : offerFor(entry, 'subscription')?.title;

  return title ?? providerName(id);
}

/**
 * The endpoint product a stored key reads as, which is what its catalog card read as.
 *
 * @summary A person picked "Anthropic API", so the row that lists the key keeps that word. A key
 * stored under a provider the catalog never offered keeps the provider it was stored under, so a
 * row that predates the catalog still says whose key it holds rather than standing nameless.
 */
export function keyTitleFor(provider: string): string {
  const entry = catalogEntries.find((candidate) => candidate.id === provider);
  const offer = entry?.offers.find((candidate) => candidate.way !== 'subscription');

  return offer?.title ?? provider;
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

/** The mark a stored provider is drawn with, or nothing when the catalog never offered it. */
export function markFor(provider: string): BrandMarkName | undefined {
  return catalogEntries.find((entry) => entry.id === provider)?.id;
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
 * The kind an entry's key would be held under, or nothing when it only ever signs in.
 *
 * @summary The catalog's other ways all hand over a secret, and the registry keeps them apart by
 * kind, so the claim is checked against the kinds that admit a secret rather than assumed.
 */
export function keyKindOf(entry: CatalogEntry): CredentialedAccountKind | undefined {
  const offer = entry.offers.find((candidate) => candidate.way !== 'subscription');

  return offer === undefined ? undefined : credentialedAccountKindSchema.parse(offer.way);
}
