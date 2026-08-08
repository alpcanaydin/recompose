const FALLBACK_VERSION = '2.2.1';
const HUB_PLATFORM = 'darwin/arm64';
const NODE_API_CLIENT = 'google-api-nodejs-client/10.3.0';
const MAX_MANIFEST_BYTES = 4_096;

const ANTIGRAVITY_MANIFEST_URL =
  'https://antigravity-hub-auto-updater-974169037036.us-central1.run.app/manifest/latest-arm64-mac.yml';

export function antigravityLatestVersion(): string {
  return FALLBACK_VERSION;
}

export function antigravityUserAgent(version = antigravityLatestVersion()): string {
  return `antigravity/hub/${version} ${HUB_PLATFORM}`;
}

export function antigravityRequestUserAgent(configured: string): string {
  return antigravityBaseUserAgent(configured);
}

export function antigravityOnboardUserUserAgent(configured: string): string {
  const userAgent = configured.trim();

  if (userAgent === '') return `${antigravityUserAgent()} ${NODE_API_CLIENT}`;
  if (!isAntigravityFamily(userAgent)) return userAgent;
  if (userAgent.toLowerCase().includes('google-api-nodejs-client/')) return userAgent;

  return `${antigravityBaseUserAgent(userAgent)} ${NODE_API_CLIENT}`;
}

export function antigravityVersionFromUserAgent(userAgent: string): string {
  const base = antigravityBaseUserAgent(userAgent);
  const matched = /^antigravity\/(?:hub\/)?([^\s]+)/iu.exec(base);

  return nonEmpty(matched?.[1]?.trim(), antigravityLatestVersion());
}

export async function fetchAntigravityLatestVersion(
  fetchLike: typeof fetch,
  url = ANTIGRAVITY_MANIFEST_URL,
): Promise<string> {
  const response = await fetchLike(url, {
    headers: { 'User-Agent': 'electron-builder', 'Cache-Control': 'no-cache' },
  });

  if (!response.ok) throw new Error(`Antigravity Hub manifest returned ${response.status}`);

  const version = manifestVersion(await boundedResponseText(response, MAX_MANIFEST_BYTES));

  if (version === null) throw new Error('Antigravity Hub manifest returned no version');

  return version;
}

async function boundedResponseText(response: Response, maximumBytes: number): Promise<string> {
  if (response.body === null) return '';

  const reader: ReadableStreamDefaultReader<Uint8Array> = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let step = await reader.read();

  while (!step.done) {
    size += step.value.byteLength;

    if (size > maximumBytes) {
      await reader.cancel();

      throw new Error(`response exceeds maximum allowed size of ${maximumBytes} bytes`);
    }

    chunks.push(step.value);
    step = await reader.read();
  }

  return new TextDecoder().decode(joinedBytes(chunks, size));
}

function joinedBytes(chunks: readonly Uint8Array[], size: number): Uint8Array {
  const output = new Uint8Array(size);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return output;
}

function antigravityBaseUserAgent(configured: string): string {
  const userAgent = configured.trim();

  if (userAgent === '') return antigravityUserAgent();
  if (!isAntigravityFamily(userAgent)) return userAgent;

  return nonEmpty(
    userAgent.split(/\s+google-api-nodejs-client\//iu)[0]?.trim(),
    antigravityUserAgent(),
  );
}

function isAntigravityFamily(userAgent: string): boolean {
  return /^antigravity\/(?:hub\/)?/iu.test(userAgent);
}

function manifestVersion(manifest: string): string | null {
  const matched = /^version:\s*["']?([^\s"']+)["']?\s*$/imu.exec(manifest);

  return nonEmpty(matched?.[1]?.trim(), null);
}

function nonEmpty<T>(value: string | undefined, fallback: T): string | T {
  return value === undefined || value === '' ? fallback : value;
}
