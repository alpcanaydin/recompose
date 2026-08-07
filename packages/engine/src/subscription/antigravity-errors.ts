import { isJsonObject, parsedJson } from '../gateway-wire';

const INSTANT_RETRY_THRESHOLD_MS = 3_000;
const SOFT_RETRY_DELAY_MS = 500;
const INSTANT_RETRY_PADDING_MS = 800;
const QUOTA_EXHAUSTED = /quota_exhausted|quota exhausted/u;
const HUMAN_DELAY = /reset after\s+((?:\d+(?:\.\d+)?(?:ms|h|m|s))+)/u;
const DURATION_PART = /(\d+(?:\.\d+)?)(ms|h|m|s)/gu;

function durationUnit(unit: string): number {
  if (unit === 'h') return 60 * 60 * 1000;
  if (unit === 'm') return 60 * 1000;
  if (unit === 's') return 1000;

  return 1;
}

function durationMilliseconds(value: string): number | null {
  const compact = value.trim().toLowerCase().replaceAll(/\s+/gu, '');
  const parts = [...compact.matchAll(DURATION_PART)];
  const consumed = parts.map((part) => part[0]).join('');

  if (parts.length === 0 || consumed !== compact) return null;

  return parts.reduce((total, part) => {
    const amount = Number(part[1]);

    return total + amount * durationUnit(part[2] ?? '');
  }, 0);
}

function recordAt(value: unknown, key: string): Record<string, unknown> {
  return isJsonObject(value) && isJsonObject(value[key]) ? value[key] : {};
}

function stringAt(value: unknown, key: string): string {
  if (!isJsonObject(value)) return '';

  const found = value[key];

  return typeof found === 'string' ? found.trim() : '';
}

function detailsOf(value: unknown): Record<string, unknown>[] {
  const details = recordAt(value, 'error')['details'];

  return Array.isArray(details) ? details.filter(isJsonObject) : [];
}

function retryDelayCandidates(value: unknown): string[] {
  const details = detailsOf(value);
  const detailValues = details.flatMap((detail) => [
    stringAt(detail, 'retryDelay'),
    stringAt(recordAt(detail, 'metadata'), 'quotaResetDelay'),
  ]);
  const message = stringAt(recordAt(value, 'error'), 'message');
  const human = HUMAN_DELAY.exec(message.toLowerCase())?.[1] ?? '';

  return [...detailValues, human].filter((candidate) => candidate !== '');
}

export function antigravityRetryDelayMilliseconds(body: string): number | null {
  const parsed = parsedJson(body);

  return (
    retryDelayCandidates(parsed)
      .map(durationMilliseconds)
      .find((delay): delay is number => delay !== null) ?? null
  );
}

function errorReason(value: unknown): string {
  const info = detailsOf(value).find(
    (detail) => stringAt(detail, '@type') === 'type.googleapis.com/google.rpc.ErrorInfo',
  );

  return stringAt(info, 'reason').toUpperCase();
}

function retryForRateLimit(delay: number | null): number | null {
  if (delay === null) return SOFT_RETRY_DELAY_MS;
  if (delay <= 0) return 0;
  if (delay < INSTANT_RETRY_THRESHOLD_MS) return delay + INSTANT_RETRY_PADDING_MS;

  return null;
}

export async function antigravitySameTargetRetryDelay(response: Response): Promise<number | null> {
  if (response.status !== 429) return null;

  const body = await response.clone().text();
  const value = parsedJson(body);
  const reason = errorReason(value);

  if (reason === 'QUOTA_EXHAUSTED' || QUOTA_EXHAUSTED.test(body.toLowerCase())) return null;

  if (reason === 'RATE_LIMIT_EXCEEDED') {
    return retryForRateLimit(antigravityRetryDelayMilliseconds(body));
  }

  return SOFT_RETRY_DELAY_MS;
}

export async function normalizeAntigravityError(response: Response): Promise<Response> {
  if (response.status !== 429 || response.headers.has('retry-after')) return response;

  const body = new Uint8Array(await response.arrayBuffer());
  const delay = antigravityRetryDelayMilliseconds(new TextDecoder().decode(body));
  const headers = new Headers(response.headers);

  if (delay !== null && delay > 0) headers.set('retry-after', String(Math.ceil(delay / 1000)));

  return new Response(body, { status: response.status, headers });
}
