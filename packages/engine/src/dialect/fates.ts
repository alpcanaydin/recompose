export type Fate =
  | { field: string; disposition: 'carried' }
  | { field: string; disposition: 'mapped'; to: string; costBearing?: true }
  | { field: string; disposition: 'refused'; reason: string };

export type Translated<T> = { value: T; fates: readonly Fate[] };

export type TranslateResult<T, Refusal> = Translated<T> | { refusal: Refusal };

export function accountForEveryKey(sourceKeys: readonly string[], routed: readonly Fate[]): Fate[] {
  const routedFields = new Set(routed.map((fate) => fate.field));

  const leftovers: Fate[] = [];

  for (const field of sourceKeys) {
    if (!routedFields.has(field)) {
      leftovers.push({ field, disposition: 'mapped', to: 'absent' });
    }
  }

  return leftovers;
}
