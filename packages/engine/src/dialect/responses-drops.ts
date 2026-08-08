export type ResponsesDrop = {
  field: string;
  costBearing: boolean;
};

export const responsesRequestDrops: readonly ResponsesDrop[] = [
  { field: 'store', costBearing: false },
  { field: 'metadata', costBearing: false },
  { field: 'top_logprobs', costBearing: false },
  { field: 'truncation', costBearing: false },
  { field: 'user', costBearing: false },
  { field: 'prompt_cache_key', costBearing: true },
];
