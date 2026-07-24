const DEV_SERVER_SCHEMES = new Set(['http:', 'https:']);

function networkOrigin(candidate: string): string | undefined {
  if (!URL.canParse(candidate)) {
    return undefined;
  }

  const url = new URL(candidate);

  return DEV_SERVER_SCHEMES.has(url.protocol) ? url.origin : undefined;
}

export function devServerOrigin(isDev: boolean): string | undefined {
  if (!isDev) {
    return undefined;
  }

  const { ELECTRON_RENDERER_URL: rendererUrl } = process.env;

  return rendererUrl === undefined || rendererUrl === '' ? undefined : networkOrigin(rendererUrl);
}
