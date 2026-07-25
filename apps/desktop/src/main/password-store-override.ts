export function resolvePasswordStoreOverride(
  env: Record<string, string | undefined>,
): string | null {
  const override = env['RECOMPOSE_PASSWORD_STORE'];

  return override === undefined || override === '' ? null : override;
}
