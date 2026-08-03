import type { KeyCheckReport, KeyCheckVerdict, KeyProviderId } from '@recompose/contracts';

const probeFetchBoundMs = 10_000;

export const firstPartyProbeOrigins: Readonly<Record<KeyProviderId, string>> = {
  anthropic: 'https://api.anthropic.com',
  openai: 'https://api.openai.com',
};

const modelsPath = '/v1/models';

const anthropicVersion = '2023-06-01';

function authHeadersFor(provider: KeyProviderId, key: string): Record<string, string> {
  switch (provider) {
    case 'anthropic':
      return { 'x-api-key': key, 'anthropic-version': anthropicVersion };
    case 'openai':
      return { Authorization: `Bearer ${key}` };

    default: {
      const unknownProvider: never = provider;

      throw new Error(`no probe speaks to the provider: ${String(unknownProvider)}`);
    }
  }
}

function verdictFor(status: number): KeyCheckVerdict {
  if (Math.floor(status / 100) === 2) {
    return 'authenticates';
  }

  if (status === 401 || status === 403) {
    return 'not-accepted';
  }

  return 'could-not-check';
}

export async function probeKey(
  fetchLike: typeof fetch,
  provider: KeyProviderId,
  key: string,
  origin: string = firstPartyProbeOrigins[provider],
): Promise<KeyCheckReport> {
  try {
    const response = await fetchLike(`${origin}${modelsPath}`, {
      method: 'GET',
      headers: authHeadersFor(provider, key),
      redirect: 'error',
      signal: AbortSignal.timeout(probeFetchBoundMs),
    });

    return { verdict: verdictFor(response.status), status: response.status };
  } catch {
    console.error(`The ${provider} probe could not reach ${origin}, so the check did not run.`);

    return { verdict: 'could-not-check' };
  }
}
