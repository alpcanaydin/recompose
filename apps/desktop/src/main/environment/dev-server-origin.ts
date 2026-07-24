export function devServerOrigin(isDev: boolean): string | undefined {
  if (!isDev) {
    return undefined;
  }

  const { ELECTRON_RENDERER_URL: rendererUrl } = process.env;

  return rendererUrl === undefined || rendererUrl === '' ? undefined : new URL(rendererUrl).origin;
}
