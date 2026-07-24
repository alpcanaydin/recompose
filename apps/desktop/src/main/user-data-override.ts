export function resolveUserDataOverride(env: Record<string, string | undefined>): string | null {
  const override = env['RECOMPOSE_USER_DATA_DIR'];

  return override === undefined || override === '' ? null : override;
}
