export function devServerOrigin(): string | undefined {
  const { ELECTRON_RENDERER_URL: rendererUrl } = process.env;

  return rendererUrl === undefined || rendererUrl === '' ? undefined : new URL(rendererUrl).origin;
}
