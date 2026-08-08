export function sumDefinedTokens(values: readonly (number | undefined)[]): number | undefined {
  const present = values.filter((value): value is number => value !== undefined);

  return present.length === 0 ? undefined : present.reduce((total, value) => total + value, 0);
}
