export function nonBlankCredentialValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

export function firstNonBlankCredentialValue(...values: unknown[]): string | undefined {
  return values.map(nonBlankCredentialValue).find((value) => value !== undefined);
}
