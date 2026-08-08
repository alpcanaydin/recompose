import type { VendorDrop } from './chat-completions-drops';

export const anthropicDrops = [
  { field: 'top_k', costBearing: false },
  { field: 'metadata', costBearing: false },
  { field: 'inference_geo', costBearing: false },
  { field: 'container', costBearing: false },
  { field: 'output_config', costBearing: true },
  { field: 'cache_control', costBearing: true },
] as const satisfies readonly VendorDrop[];

export type AnthropicDropField = (typeof anthropicDrops)[number]['field'];
