import type { AccountKind } from '../../../entities/account';
import type { CatalogLead } from './provider-catalog';

import { providerNames } from './provider-catalog';

export type AwaitedProvider = {
  /** The product the row stands for. */
  name: string;
  /** One line saying what connecting it will give, once it can be connected. */
  benefit: string;
  /** The mark or glyph the row leads with. */
  lead: CatalogLead;
};

const awaitedSubscriptions: readonly AwaitedProvider[] = [
  {
    name: providerNames.githubCopilot,
    benefit: 'Sign in with your GitHub account',
    lead: { mark: 'githubCopilot' },
  },
  { name: 'Kimi Code', benefit: 'Moonshot plan, K2 in your tools', lead: { mark: 'kimi' } },
  { name: 'GLM Coding Plan', benefit: 'Z.ai plan, GLM models', lead: { mark: 'zhipu' } },
  {
    name: 'Qwen Coding Plan',
    benefit: 'Alibaba Model Studio, multi-model',
    lead: { mark: 'qwen' },
  },
  { name: 'MiniMax Coding Plan', benefit: 'M2 on a flat monthly quota', lead: { mark: 'minimax' } },
];

const awaitedLocals: readonly AwaitedProvider[] = [
  {
    name: providerNames.lmstudio,
    benefit: 'localhost:1234, local server',
    lead: { mark: 'lmstudio' },
  },
  { name: 'llama.cpp', benefit: 'llama-server on localhost:8080', lead: { glyph: 'monitor' } },
  { name: providerNames.vllm, benefit: 'High-throughput GPU serving', lead: { mark: 'vllm' } },
  {
    name: 'Custom local server',
    benefit: 'Anything serving models on a local port',
    lead: { glyph: 'network' },
  },
];

const awaitedAggregators: readonly AwaitedProvider[] = [
  { name: providerNames.together, benefit: 'Open-weights catalog', lead: { mark: 'together' } },
  {
    name: providerNames.fireworks,
    benefit: 'Fast open-model inference',
    lead: { mark: 'fireworks' },
  },
  {
    name: providerNames.groq,
    benefit: 'Lowest latency on its own silicon',
    lead: { mark: 'groq' },
  },
  {
    name: providerNames.deepinfra,
    benefit: 'Low-cost open-model catalog',
    lead: { mark: 'deepinfra' },
  },
  {
    name: providerNames.cerebras,
    benefit: 'Wafer-scale, fastest tokens per second',
    lead: { mark: 'cerebras' },
  },
  {
    name: 'Custom aggregator',
    benefit: 'Any hosted catalog behind one key',
    lead: { glyph: 'network' },
  },
];

const awaitsAUrlAndADialect = 'Waits on a base URL and a dialect';

const awaitedKeys: readonly AwaitedProvider[] = [
  {
    name: 'Gemini API',
    benefit: 'Waits on a base URL, a dialect, and a header',
    lead: { mark: 'gemini' },
  },
  { name: providerNames.mistral, benefit: awaitsAUrlAndADialect, lead: { mark: 'mistral' } },
  { name: 'xAI Grok', benefit: awaitsAUrlAndADialect, lead: { mark: 'grok' } },
  { name: providerNames.deepseek, benefit: awaitsAUrlAndADialect, lead: { mark: 'deepseek' } },
  { name: providerNames.moonshot, benefit: awaitsAUrlAndADialect, lead: { mark: 'moonshot' } },
  { name: providerNames.qwen, benefit: awaitsAUrlAndADialect, lead: { mark: 'qwen' } },
  { name: 'Custom endpoint', benefit: awaitsAUrlAndADialect, lead: { glyph: 'network' } },
];

const awaitedUnderKind: Record<AccountKind, readonly AwaitedProvider[]> = {
  subscription: awaitedSubscriptions,
  'api-key': awaitedKeys,
  aggregator: awaitedAggregators,
  local: awaitedLocals,
};

/**
 * The providers recompose will connect to later, standing in the catalog before they can.
 *
 * @summary Every destination ends somewhere short of the field, and the rows that follow say what
 * the catalog grows toward rather than hiding it. A row here cannot be picked, so it carries no
 * provider identity yet, and its line names what it offers or what it waits on.
 */
export function awaitedFor(kind: AccountKind): readonly AwaitedProvider[] {
  return awaitedUnderKind[kind];
}
