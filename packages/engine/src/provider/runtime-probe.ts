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

type BodyLook = { silenced: boolean; body: unknown };

function aBodyArrivedButWasNotJson(reason: unknown): boolean {
  return reason instanceof SyntaxError;
}

async function bodyOrSilence(response: Response): Promise<BodyLook> {
  try {
    return { silenced: false, body: await response.json() };
  } catch (reason) {
    return { silenced: !aBodyArrivedButWasNotJson(reason), body: null };
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

  const look = await bodyOrSilence(response);

  if (look.silenced) {
    return { verdict: 'unreachable' };
  }

  const version = versionOf(look.body);

  return version === null
    ? { verdict: 'unrecognized', status: response.status }
    : { verdict: 'answers', version };
}
