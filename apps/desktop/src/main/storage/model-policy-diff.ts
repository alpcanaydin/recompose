import type {
  AccountsDocument,
  ModelListing,
  ProviderModelAlias,
  ProviderModelPolicies,
  ProviderModelPolicy,
} from '@recompose/contracts';

import { normalizeExcludedModels, normalizeProviderKey } from '@recompose/contracts';
import { createHash } from 'node:crypto';

export type ModelPolicySummary = { hash: string; count: number };
export type ModelPolicyDiff = { changes: string[]; affectedProviders: string[] };

function hash(values: readonly string[]): string {
  if (values.length === 0) return '';

  return createHash('sha256').update(JSON.stringify(values)).digest('hex');
}

export function summarizeExcludedModels(models: readonly string[]): ModelPolicySummary {
  const normalized = normalizeExcludedModels(models);

  return { hash: hash(normalized), count: normalized.length };
}

function providerSummaries<Value>(
  entries: Readonly<Record<string, readonly Value[]>>,
  summarize: (values: readonly Value[]) => ModelPolicySummary,
): Record<string, ModelPolicySummary> {
  const summaries = new Map<string, ModelPolicySummary>();

  for (const [provider, values] of Object.entries(entries)) {
    const key = normalizeProviderKey(provider);

    if (key !== '') summaries.set(key, summarize(values));
  }

  return Object.fromEntries(summaries);
}

export function summarizeProviderExcludedModels(
  entries: Readonly<Record<string, readonly string[]>>,
): Record<string, ModelPolicySummary> {
  return providerSummaries(entries, summarizeExcludedModels);
}

function changedProviders(
  oldSummary: Readonly<Record<string, ModelPolicySummary>>,
  newSummary: Readonly<Record<string, ModelPolicySummary>>,
  label: string,
): ModelPolicyDiff {
  const providers = [...new Set([...Object.keys(oldSummary), ...Object.keys(newSummary)])].sort();
  const changes: string[] = [];
  const affectedProviders: string[] = [];

  for (const provider of providers) {
    const previous = oldSummary[provider];
    const next = newSummary[provider];
    const change = providerChange(label, provider, previous, next);

    if (change !== undefined) {
      changes.push(change);
      affectedProviders.push(provider);
    }
  }

  return { changes, affectedProviders };
}

function providerChange(
  label: string,
  provider: string,
  previous: ModelPolicySummary | undefined,
  next: ModelPolicySummary | undefined,
): string | undefined {
  if (previous === undefined) {
    return next === undefined
      ? undefined
      : `${label}[${provider}]: added (${String(next.count)} entries)`;
  }

  if (next === undefined) return `${label}[${provider}]: removed`;
  if (previous.hash === next.hash) return undefined;

  return `${label}[${provider}]: updated (${String(previous.count)} -> ${String(next.count)} entries)`;
}

export function diffProviderExcludedModels(
  oldEntries: Readonly<Record<string, readonly string[]>>,
  newEntries: Readonly<Record<string, readonly string[]>>,
): ModelPolicyDiff {
  return changedProviders(
    summarizeProviderExcludedModels(oldEntries),
    summarizeProviderExcludedModels(newEntries),
    'oauth-excluded-models',
  );
}

function aliasValue(alias: ProviderModelAlias): string {
  const displayName = alias.displayName === undefined ? '' : `|display-name=${alias.displayName}`;

  return `${alias.name.trim().toLowerCase()}->${alias.alias.trim().toLowerCase()}${displayName}`;
}

function summarizeAliases(aliases: readonly ProviderModelAlias[]): ModelPolicySummary {
  const normalized = [...new Set(aliases.map(aliasValue))].sort();

  return { hash: hash(normalized), count: normalized.length };
}

export function diffProviderModelAliases(
  oldEntries: Readonly<Record<string, readonly ProviderModelAlias[]>>,
  newEntries: Readonly<Record<string, readonly ProviderModelAlias[]>>,
): ModelPolicyDiff {
  return changedProviders(
    providerSummaries(oldEntries, summarizeAliases),
    providerSummaries(newEntries, summarizeAliases),
    'oauth-model-alias',
  );
}

function meaningfulPolicies(policies: ProviderModelPolicies | undefined): ProviderModelPolicies {
  if (policies === undefined) return {};

  return Object.fromEntries(
    Object.entries(policies).filter(([, policy]) => policyHasValues(policy)),
  );
}

function policyHasValues(policy: ProviderModelPolicy): boolean {
  return listHasValues(policy.excludedModels) || listHasValues(policy.aliases);
}

function listHasValues(values: readonly unknown[] | undefined): boolean {
  return values !== undefined && values.length > 0;
}

export function accountsDocumentSemanticHash(document: AccountsDocument): string {
  const policies = meaningfulPolicies(document.modelPolicies);
  const semantic = {
    schemaVersion: document.schemaVersion,
    accounts: document.accounts,
    ...(Object.keys(policies).length === 0 ? {} : { modelPolicies: policies }),
  };

  return createHash('sha256').update(JSON.stringify(semantic)).digest('hex');
}

export function applyModelPolicy(
  listing: ModelListing,
  policy: ProviderModelPolicy | undefined,
): ModelListing {
  if (listing.standing === 'unlisted' || policy?.excludedModels === undefined) return listing;

  const excluded = new Set(normalizeExcludedModels(policy.excludedModels));

  return {
    standing: 'listed',
    modelIds: listing.modelIds.filter((model) => !excluded.has(model.trim().toLowerCase())),
  };
}
