import { z } from 'zod';

const policyText = z.string().trim().min(1);

export function normalizeProviderKey(provider: string): string {
  return provider.trim().toLowerCase();
}

export function normalizeExcludedModels(models: readonly string[]): string[] {
  const normalized: string[] = [];

  for (const model of models) {
    const value = model.trim().toLowerCase();

    if (value !== '') normalized.push(value);
  }

  return [...new Set(normalized)].sort();
}

const providerModelAliasInputSchema = z.strictObject({
  name: policyText,
  alias: policyText,
  displayName: policyText.optional(),
});

type ProviderModelAliasValue = {
  alias: string;
  displayName?: string | undefined;
  name: string;
};

function aliasKey(alias: ProviderModelAlias): string {
  return `${alias.name}\0${alias.alias}\0${alias.displayName ?? ''}`;
}

function normalizedAlias(alias: ProviderModelAliasValue): ProviderModelAliasValue {
  return {
    name: alias.name.toLowerCase(),
    alias: alias.alias.toLowerCase(),
    ...(alias.displayName === undefined ? {} : { displayName: alias.displayName }),
  };
}

function normalizeAliases(aliases: readonly ProviderModelAlias[]): ProviderModelAlias[] {
  const normalized = aliases.map(normalizedAlias);
  const unique = new Map(normalized.map((alias) => [aliasKey(alias), alias]));

  return [...unique.values()].sort((left, right) => aliasKey(left).localeCompare(aliasKey(right)));
}

export const providerModelAliasSchema = providerModelAliasInputSchema.transform(normalizedAlias);

export type ProviderModelAlias = ProviderModelAliasValue;

const providerModelPolicySchema = z
  .strictObject({
    excludedModels: z.array(z.string()).transform(normalizeExcludedModels).optional(),
    aliases: z.array(providerModelAliasSchema).transform(normalizeAliases).optional(),
  })
  .transform((policy) => ({
    ...(policy.excludedModels === undefined ? {} : { excludedModels: policy.excludedModels }),
    ...(policy.aliases === undefined ? {} : { aliases: policy.aliases }),
  }));

export type ProviderModelPolicy = z.infer<typeof providerModelPolicySchema>;

function normalizedPolicies(
  policies: Record<string, ProviderModelPolicy>,
): Record<string, ProviderModelPolicy> {
  const normalized = new Map<string, ProviderModelPolicy>();

  for (const [provider, policy] of Object.entries(policies)) {
    const key = normalizeProviderKey(provider);

    if (key !== '') normalized.set(key, policy);
  }

  return Object.fromEntries(
    [...normalized.entries()].sort(([left], [right]) => left.localeCompare(right)),
  );
}

export const providerModelPoliciesSchema = z
  .record(z.string(), providerModelPolicySchema)
  .transform(normalizedPolicies);

export type ProviderModelPolicies = z.infer<typeof providerModelPoliciesSchema>;
