import type { HubRequest } from './hub';
import type { InteractionsRequest } from './interactions-wire';

const mappedFields = new Set([
  'max_output_tokens',
  'temperature',
  'top_p',
  'stop_sequences',
  'tool_choice',
  'thinking_level',
  'thinking_budget',
  'thinking_summaries',
]);

export function providerConfigFromInteractions(
  request: InteractionsRequest,
): Pick<HubRequest, 'geminiGenerationConfig'> | object {
  const config = request.generation_config;

  if (config === undefined) return {};

  const entries = Object.entries(config).filter(([key]) => !mappedFields.has(key));

  return entries.length === 0 ? {} : { geminiGenerationConfig: Object.fromEntries(entries) };
}

export function providerConfigIntoInteractions(value: InteractionsRequest, hub: HubRequest): void {
  if (hub.geminiGenerationConfig === undefined) return;

  value.generation_config = {
    ...hub.geminiGenerationConfig,
    ...value.generation_config,
  };
}
