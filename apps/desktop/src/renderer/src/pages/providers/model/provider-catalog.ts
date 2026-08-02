import type { CredentialedAccountKind, SubscriptionProviderId } from '@recompose/contracts';

import { credentialedAccountKindSchema, subscriptionProviderIdSchema } from '@recompose/contracts';

import type { AccountKind } from '../../../entities/account';
import type { BrandMarkName } from '../../../shared/ui';

import { accountKindTitle } from '../../../entities/account';

/** A way an account reaches a provider, which is every kind but the one nothing connects as. */
export type ConnectionWay = Exclude<AccountKind, 'local'>;

export type CatalogEntry = {
  /** The provider the entry stands for, which is also the mark it is drawn with. */
  id: BrandMarkName;
  /** The name the provider goes by on screen. */
  name: string;
  /** Every way this provider can be connected, in the order they are offered. */
  ways: readonly ConnectionWay[];
};

export type CatalogGroup = {
  way: ConnectionWay;
  title: string;
  entries: readonly CatalogEntry[];
};

export type CatalogNarrowing = {
  search: string;
  way?: ConnectionWay | undefined;
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

/**
 * Every provider the catalog offers, with the ways each one connects.
 *
 * @summary Reach for it from the catalog drawer. A provider that both sells a plan and sells a
 * key stands under both ways, because the two yield different things and a person chooses
 * between them rather than being handed one.
 */
export const catalogEntries: readonly CatalogEntry[] = [
  { id: 'anthropic', name: providerNames.anthropic, ways: ['subscription', 'api-key'] },
  { id: 'openai', name: providerNames.openai, ways: ['subscription', 'api-key'] },
  { id: 'openrouter', name: providerNames.openrouter, ways: ['aggregator'] },
];

const groupOrder: readonly ConnectionWay[] = ['subscription', 'api-key', 'aggregator'];

/**
 * The provider identity an entry would sign in under, or nothing when it never signs in.
 *
 * @summary An entry offering the subscription way is a claim that its identity is one the
 * subscription contract knows, so the claim is checked here rather than trusted downstream.
 */
export function signInProviderOf(entry: CatalogEntry): SubscriptionProviderId | undefined {
  return entry.ways.includes('subscription')
    ? subscriptionProviderIdSchema.parse(entry.id)
    : undefined;
}

/**
 * The kind an entry's key would be held under, or nothing when it only ever signs in.
 *
 * @summary The catalog's other ways all hand over a secret, and the registry keeps them apart by
 * kind, so the claim is checked against the kinds that admit a secret rather than assumed.
 */
export function keyKindOf(entry: CatalogEntry): CredentialedAccountKind | undefined {
  const way = entry.ways.find((candidate) => candidate !== 'subscription');

  return way === undefined ? undefined : credentialedAccountKindSchema.parse(way);
}

/** The entries left after a search and a chip, which is always a subset of what was handed in. */
export function narrowedCatalog(
  entries: readonly CatalogEntry[],
  { search, way }: CatalogNarrowing,
): readonly CatalogEntry[] {
  const wanted = search.trim().toLowerCase();

  return entries.filter(
    (entry) =>
      entry.name.toLowerCase().includes(wanted) && (way === undefined || entry.ways.includes(way)),
  );
}

function leadingWay(entry: CatalogEntry, asked?: ConnectionWay): ConnectionWay | undefined {
  return groupOrder.find(
    (way) => entry.ways.includes(way) && (asked === undefined || way === asked),
  );
}

/**
 * The entries gathered under one way each, with the ways nothing stands under dropped.
 *
 * @summary A provider that connects two ways stands once, under the first way it offers, because
 * a second row for the same provider would read as a second provider and both rows would open the
 * same fork anyway. Asking for a way gathers everyone who offers it under that one heading.
 */
export function catalogGroups(
  entries: readonly CatalogEntry[],
  asked?: ConnectionWay,
): readonly CatalogGroup[] {
  return groupOrder
    .map((way) => ({
      way,
      title: accountKindTitle(way),
      entries: entries.filter((entry) => leadingWay(entry, asked) === way),
    }))
    .filter((group) => group.entries.length > 0);
}
