import { describe, expect, test } from 'vitest';

import {
  AntigravityCreditsState,
  antigravityCreditsRequest,
  injectAntigravityCreditTypes,
  parseAntigravityMetaFloat,
} from './antigravity-credits';

function paidTier(credits: unknown): Record<string, unknown> {
  return { paidTier: { availableCredits: credits } };
}

describe('Antigravity metadata numbers', () => {
  test('a finite number is read as it stands', () => {
    expect(parseAntigravityMetaFloat({ amount: 12.5 }, 'amount')).toBe(12.5);
  });

  test('a number that is not finite is unreadable', () => {
    expect(parseAntigravityMetaFloat({ amount: Number.NaN }, 'amount')).toBeUndefined();
    expect(
      parseAntigravityMetaFloat({ amount: Number.POSITIVE_INFINITY }, 'amount'),
    ).toBeUndefined();
  });

  test('a field that is neither number nor text is unreadable', () => {
    expect(parseAntigravityMetaFloat({ amount: true }, 'amount')).toBeUndefined();
    expect(parseAntigravityMetaFloat({}, 'amount')).toBeUndefined();
  });

  test('numeric text is read while blank or wordy text is unreadable', () => {
    expect(parseAntigravityMetaFloat({ amount: '3.5' }, 'amount')).toBe(3.5);
    expect(parseAntigravityMetaFloat({ amount: '   ' }, 'amount')).toBeUndefined();
    expect(parseAntigravityMetaFloat({ amount: 'plenty' }, 'amount')).toBeUndefined();
  });
});

describe('Antigravity credit balance', () => {
  test('a response without a paid tier leaves the balance unknown', () => {
    const state = new AntigravityCreditsState();

    expect(state.update('account-1', 'not-an-object')).toBeUndefined();
    expect(state.update('account-1', { paidTier: 'none' })).toBeUndefined();
    expect(state.hasCredits('account-1')).toBe(false);
  });

  test('a paid tier without a usable credit entry leaves the balance unknown', () => {
    const state = new AntigravityCreditsState();

    expect(state.update('account-1', paidTier('none'))).toBeUndefined();
    expect(state.update('account-1', paidTier([]))).toBeUndefined();
    expect(state.update('account-1', paidTier(['text-entry']))).toBeUndefined();
  });

  test('a credit entry missing either amount leaves the balance unknown', () => {
    const state = new AntigravityCreditsState();

    expect(state.update('account-1', paidTier([{ creditAmount: '5' }]))).toBeUndefined();
    expect(
      state.update('account-1', paidTier([{ minimumCreditAmountForUsage: '5' }])),
    ).toBeUndefined();
  });

  test('a funded account reports available credits and hands out a copy of the hint', () => {
    const state = new AntigravityCreditsState();
    const hint = state.update(
      'account-1',
      paidTier([{ creditAmount: '10', minimumCreditAmountForUsage: 5 }]),
    );

    expect(hint).toEqual({ available: true, creditAmount: 10, minCreditAmount: 5 });
    expect(state.hasCredits('account-1')).toBe(true);
    expect(state.warmTokenHint('account-1')).toEqual(hint);
    expect(state.warmTokenHint('account-1')).not.toBe(hint);
  });

  test('an account below the usage minimum has no credits available', () => {
    const state = new AntigravityCreditsState();

    state.update('account-1', paidTier([{ creditAmount: 1, minimumCreditAmountForUsage: 5 }]));

    expect(state.hasCredits('account-1')).toBe(false);
  });

  test('an account with no recorded balance has no warm hint', () => {
    const state = new AntigravityCreditsState();

    expect(state.warmTokenHint('unseen-account')).toBeUndefined();
    expect(state.hasCredits('unseen-account')).toBe(false);
  });
});

describe('Antigravity credits request', () => {
  test('the request opts the payload into Google One AI credits', () => {
    const request: Record<string, unknown> = { model: 'antigravity' };

    injectAntigravityCreditTypes(request);

    expect(request['enabledCreditTypes']).toEqual(['GOOGLE_ONE_AI']);
  });

  test('the request strips the Google API client suffix from the user agent', () => {
    const request = antigravityCreditsRequest(
      'antigravity/1.0 google-api-nodejs-client/9.15.1',
      'token-1',
    );

    expect(request.headers['User-Agent']).toBe('antigravity/1.0');
    expect(request.headers.Authorization).toBe('Bearer token-1');
    expect(request.url).toBe('https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist');
    expect(request.body).toBe('{"metadata":{"ideType":"ANTIGRAVITY"}}');
  });
});
