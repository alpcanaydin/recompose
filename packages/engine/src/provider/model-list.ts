import {
  modelListBoundMs,
  nonBlankString,
  type LookCustody,
  type ModelListing,
} from '@recompose/contracts';

import { authHeadersFor } from './key-probe';

const modelsPath = '/v1/models';

const nothingListed: ModelListing = { standing: 'unlisted' };

function headersFor(custody: LookCustody): Record<string, string> {
  if (custody.custody === 'open') {
    return {};
  }

  return custody.custody === 'provider-key'
    ? authHeadersFor(custody.provider, custody.credential)
    : { Authorization: `Bearer ${custody.credential}` };
}

async function answerOrSilence(
  fetchLike: typeof fetch,
  origin: string,
  custody: LookCustody,
): Promise<Response | null> {
  try {
    return await fetchLike(`${origin}${modelsPath}`, {
      method: 'GET',
      headers: headersFor(custody),
      redirect: 'error',
      signal: AbortSignal.timeout(modelListBoundMs),
    });
  } catch {
    console.error(`The model-list look could not reach ${origin}, so no ids stand.`);

    return null;
  }
}

async function bodyOrNothing(response: Response): Promise<unknown> {
  return response.json().catch(() => undefined);
}

function idOf(entry: unknown): string | null {
  if (typeof entry !== 'object' || entry === null || !('id' in entry)) {
    return null;
  }

  const id = nonBlankString.safeParse(entry.id);

  return id.success ? id.data : null;
}

function catalogEntriesIn(body: unknown): unknown[] | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }

  const entries = 'data' in body ? body.data : null;

  return Array.isArray(entries) ? entries : null;
}

function listedIdsIn(body: unknown): string[] | null {
  const entries = catalogEntriesIn(body);

  if (entries === null) {
    return null;
  }

  const ids = entries.map(idOf);

  return ids.every((id): id is string => id !== null) ? ids : null;
}

/**
 * The model ids one account serves, read from the vendor's OpenAI-compatible catalog.
 *
 * @summary Every way of learning nothing folds to one standing: an origin that answered nothing, a
 * vendor that turned the credential away, a body that is not the catalog it claimed to be. The
 * screen owns the sentence a person reads, so nothing here invents words for silence. A partial
 * catalog folds too, because a list quietly missing a model would let a person bind nothing to it.
 */
export async function listProviderModels(
  fetchLike: typeof fetch,
  origin: string,
  custody: LookCustody,
): Promise<ModelListing> {
  const response = await answerOrSilence(fetchLike, origin, custody);

  if (response === null || !response.ok) {
    return nothingListed;
  }

  const modelIds = listedIdsIn(await bodyOrNothing(response));

  return modelIds === null ? nothingListed : { standing: 'listed', modelIds };
}
