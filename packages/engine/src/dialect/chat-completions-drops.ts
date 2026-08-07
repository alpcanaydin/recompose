export type VendorDrop = {
  readonly field: string;
  readonly costBearing: boolean;
};

export const chatCompletionsDrops = [
  { field: 'logprobs', costBearing: false },
  { field: 'top_logprobs', costBearing: false },
  { field: 'metadata', costBearing: false },
  { field: 'prediction', costBearing: false },
  { field: 'presence_penalty', costBearing: false },
  { field: 'frequency_penalty', costBearing: false },
  { field: 'seed', costBearing: false },
  { field: 'logit_bias', costBearing: false },
  { field: 'store', costBearing: false },
  { field: 'user', costBearing: false },
  { field: 'audio', costBearing: true },
] as const satisfies readonly VendorDrop[];

export type ChatDropField = (typeof chatCompletionsDrops)[number]['field'];
