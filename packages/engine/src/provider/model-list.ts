import {
  modelListBoundMs,
  nonBlankString,
  type LookCustody,
  type ModelListing,
} from '@recompose/contracts';

import { isJsonObject, parsedJson } from '../gateway-wire';
import { authHeadersFor } from './key-probe';

const modelsPath = '/v1/models';

const nothingListed: ModelListing = { standing: 'unlisted' };

const claudeSubscriptionModels = [
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-5-20250929',
  'claude-sonnet-4-6',
  'claude-opus-4-6',
  'claude-opus-4-7',
  'claude-opus-4-8',
  'claude-opus-5',
  'claude-sonnet-5',
  'claude-fable-5',
  'claude-opus-4-5-20251101',
  'claude-opus-4-1-20250805',
  'claude-opus-4-20250514',
  'claude-sonnet-4-20250514',
  'claude-3-7-sonnet-20250219',
  'claude-3-5-haiku-20241022',
] as const;

const codexFreeModels = [
  'gpt-5.4-mini',
  'gpt-5.5',
  'gpt-5.6-terra',
  'gpt-5.6-luna',
  'codex-auto-review',
] as const;

const codexPaidModels = [
  'gpt-5.3-codex-spark',
  'gpt-5.4',
  'gpt-5.4-mini',
  'gpt-5.5',
  'gpt-5.6-sol',
  'gpt-5.6-terra',
  'gpt-5.6-luna',
  'codex-auto-review',
] as const;

function codexPlanIn(blob: string): string | null {
  const document = parsedJson(blob);

  if (!isJsonObject(document) || !isJsonObject(document['tokens'])) {
    return null;
  }

  const token = document['tokens']['id_token'];

  return typeof token === 'string' ? planInToken(token) : null;
}

function planInToken(token: string): string | null {
  const encoded = token.split('.')[1];

  if (encoded === undefined) {
    return null;
  }

  const claims = parsedJson(Buffer.from(encoded, 'base64url').toString('utf8'));

  if (!isJsonObject(claims) || !isJsonObject(claims['https://api.openai.com/auth'])) {
    return null;
  }

  const plan = claims['https://api.openai.com/auth']['chatgpt_plan_type'];

  return typeof plan === 'string' ? plan : null;
}

function subscriptionListing(
  custody: Extract<LookCustody, { custody: 'subscription' }>,
): ModelListing {
  if (custody.provider === 'anthropic') {
    return { standing: 'listed', modelIds: [...claudeSubscriptionModels] };
  }

  const models = codexPlanIn(custody.credential) === 'free' ? codexFreeModels : codexPaidModels;

  return { standing: 'listed', modelIds: [...models] };
}

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
  if (custody.custody === 'subscription') {
    return subscriptionListing(custody);
  }

  const response = await answerOrSilence(fetchLike, origin, custody);

  if (response === null || !response.ok) {
    return nothingListed;
  }

  const modelIds = listedIdsIn(await bodyOrNothing(response));

  return modelIds === null ? nothingListed : { standing: 'listed', modelIds };
}
