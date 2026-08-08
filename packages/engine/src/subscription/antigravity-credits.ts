import { isJsonObject } from '../gateway-wire';

export type AntigravityCreditsHint = {
  available: boolean;
  creditAmount: number;
  minCreditAmount: number;
};

export function parseAntigravityMetaFloat(
  metadata: Readonly<Record<string, unknown>>,
  key: string,
): number | undefined {
  const value = metadata[key];

  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string') return undefined;

  return parsedStringNumber(value);
}

function parsedStringNumber(value: string): number | undefined {
  if (value.trim() === '') return undefined;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function firstCredit(value: unknown): Record<string, unknown> | undefined {
  if (!isJsonObject(value) || !isJsonObject(value['paidTier'])) return undefined;

  const credits = value['paidTier']['availableCredits'];

  return Array.isArray(credits) ? credits.find(isJsonObject) : undefined;
}

export function injectAntigravityCreditTypes(request: Record<string, unknown>): void {
  request['enabledCreditTypes'] = ['GOOGLE_ONE_AI'];
}

function balanceFrom(value: unknown): AntigravityCreditsHint | undefined {
  const first = firstCredit(value);

  if (first === undefined) return undefined;

  const creditAmount = parseAntigravityMetaFloat(first, 'creditAmount');
  const minCreditAmount = parseAntigravityMetaFloat(first, 'minimumCreditAmountForUsage');

  if (creditAmount === undefined || minCreditAmount === undefined) return undefined;

  return { available: creditAmount >= minCreditAmount, creditAmount, minCreditAmount };
}

export class AntigravityCreditsState {
  private readonly hints = new Map<string, AntigravityCreditsHint>();

  public update(accountId: string, response: unknown): AntigravityCreditsHint | undefined {
    const hint = balanceFrom(response);

    if (hint !== undefined) this.hints.set(accountId, hint);

    return hint;
  }

  public warmTokenHint(accountId: string): AntigravityCreditsHint | undefined {
    const hint = this.hints.get(accountId);

    return hint === undefined ? undefined : { ...hint };
  }

  public hasCredits(accountId: string): boolean {
    return this.hints.get(accountId)?.available === true;
  }
}

export function antigravityCreditsRequest(userAgent: string, accessToken: string) {
  return {
    url: 'https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'User-Agent': userAgent.replace(/\s+google-api-nodejs-client\/\S+$/u, ''),
    },
    body: JSON.stringify({ metadata: { ideType: 'ANTIGRAVITY' } }),
  };
}
