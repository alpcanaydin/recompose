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

async function parsedBodyOrNull(response: Response): Promise<unknown> {
  try {
    return await response.json();
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

  const version = versionOf(await parsedBodyOrNull(response));

  return version === null
    ? { verdict: 'unrecognized', status: response.status }
    : { verdict: 'answers', version };
}
