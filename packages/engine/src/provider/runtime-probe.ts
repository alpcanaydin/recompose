import { nonBlankString, runtimeLookBoundMs, type RuntimeReachability } from '@recompose/contracts';

const versionPath = '/api/version';

async function answerOrSilence(fetchLike: typeof fetch, address: string): Promise<Response | null> {
  try {
    return await fetchLike(`${address}${versionPath}`, {
      method: 'GET',
      redirect: 'error',
      signal: AbortSignal.timeout(runtimeLookBoundMs),
    });
  } catch {
    return null;
  }
}

function versionOf(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || !('version' in body)) {
    return null;
  }

  const version = nonBlankString.safeParse(body.version);

  return version.success ? version.data : null;
}

type BodyLook = { silenced: boolean; version: string | null };

const silencingNames = new Set(['TimeoutError', 'AbortError']);

function boundCutItShort(reason: unknown): boolean {
  return reason instanceof Error && silencingNames.has(reason.name);
}

async function versionOrSilence(response: Response): Promise<BodyLook> {
  try {
    return { silenced: false, version: versionOf(await response.json()) };
  } catch (reason) {
    return { silenced: boundCutItShort(reason), version: null };
  }
}

export async function probeRuntime(
  fetchLike: typeof fetch,
  address: string,
): Promise<RuntimeReachability> {
  const response = await answerOrSilence(fetchLike, address);

  if (response === null) {
    return { verdict: 'unreachable' };
  }

  if (!response.ok) {
    return { verdict: 'unrecognized', status: response.status };
  }

  const look = await versionOrSilence(response);

  if (look.silenced) {
    return { verdict: 'unreachable' };
  }

  return look.version === null
    ? { verdict: 'unrecognized', status: response.status }
    : { verdict: 'answers', version: look.version };
}
