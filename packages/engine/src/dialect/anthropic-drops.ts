export const anthropicDrops = [
  'top_k',
  'metadata',
  'thinking',
  'service_tier',
  'container',
  'inference_geo',
  'output_config',
  'cache_control',
] as const;

export type AnthropicDropField = (typeof anthropicDrops)[number];
