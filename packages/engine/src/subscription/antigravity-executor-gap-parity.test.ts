import { describe, expect, test } from 'vitest';

import type { JsonObject } from '../gateway-wire';
import type { ParsedSubscriptionCredential } from './credentials';

import {
  AntigravityCreditsState,
  antigravityCreditsRequest,
  injectAntigravityCreditTypes,
  parseAntigravityMetaFloat,
} from './antigravity-credits';
import { antigravitySameTargetRetryDelay } from './antigravity-errors';
import { antigravityProviderRequest } from './antigravity-request';
import { sanitizeAntigravitySignatures } from './antigravity-signatures';

const credential = { accessToken: 'token', projectId: 'project-1' };

function request(body: JsonObject, auth: ParsedSubscriptionCredential = credential) {
  return antigravityProviderRequest(
    'https://daily-cloudcode-pa.googleapis.com',
    body,
    auth,
    { sessionId: 'session', requestId: 'request' },
    1_700_000_000_000,
  );
}

function creditsResponse() {
  return {
    paidTier: {
      availableCredits: [
        {
          creditType: 'GOOGLE_ONE_AI',
          creditAmount: '25000',
          minimumCreditAmountForUsage: '50',
        },
      ],
    },
  };
}

describe('Antigravity project and retry parity', () => {
  test('TestAntigravityBuildRequest_RejectsMissingProjectID', () => {
    expect(() =>
      request({ model: 'gemini-3-flash', contents: [] }, { accessToken: 'token' }),
    ).toThrow('project ID');
  });

  test('TestAntigravityShouldRetryNoCapacity_Standard503', async () => {
    const response = Response.json(
      {
        error: {
          code: 503,
          message: 'No capacity available for model gemini-3.1-flash-image on the server',
          status: 'UNAVAILABLE',
          details: [{ reason: 'MODEL_CAPACITY_EXHAUSTED' }],
        },
      },
      { status: 503 },
    );

    await expect(antigravitySameTargetRetryDelay(response)).resolves.toBe(500);
  });
});

describe('Antigravity conductor credits parity', () => {
  test('TestInjectEnabledCreditTypes', () => {
    const value: JsonObject = {};

    injectAntigravityCreditTypes(value);
    expect(value).toEqual({ enabledCreditTypes: ['GOOGLE_ONE_AI'] });
  });

  test('TestAntigravityExecute_CreditsInjectedWhenConductorRequests', () => {
    const built = request({ model: 'claude-sonnet-4-6', conductorCredits: true, contents: [] });
    const body: unknown = JSON.parse(built.body);

    expect(body).toHaveProperty('request.enabledCreditTypes', ['GOOGLE_ONE_AI']);
    expect(body).not.toHaveProperty('request.conductorCredits');
  });

  test('TestAntigravityAuthHasCredits', () => {
    const state = new AntigravityCreditsState();

    state.update('account', creditsResponse());
    expect(state.hasCredits('account')).toBe(true);
  });

  test('TestEnsureAccessToken_WarmTokenLoadsCreditsHint', () => {
    const state = new AntigravityCreditsState();

    state.update('account', creditsResponse());
    expect(state.warmTokenHint('account')).toEqual({
      available: true,
      creditAmount: 25_000,
      minCreditAmount: 50,
    });
  });

  test('TestUpdateAntigravityCreditsBalance_LoadCodeAssistUserAgent', () => {
    expect(
      antigravityCreditsRequest(
        'antigravity/hub/1.23.2 windows/amd64 google-api-nodejs-client/10.3.0',
        'token',
      ),
    ).toMatchObject({
      url: 'https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist',
      headers: { 'User-Agent': 'antigravity/hub/1.23.2 windows/amd64' },
      body: '{"metadata":{"ideType":"ANTIGRAVITY"}}',
    });
  });

  test('TestParseMetaFloat', () => {
    expect(parseAntigravityMetaFloat({ key: '25000' }, 'key')).toBe(25_000);
    expect(parseAntigravityMetaFloat({ key: 100 }, 'key')).toBe(100);
    expect(parseAntigravityMetaFloat({ key: '' }, 'key')).toBeUndefined();
    expect(parseAntigravityMetaFloat({ key: 'abc' }, 'key')).toBeUndefined();
  });
});

function invalidSignatureRequest(): JsonObject {
  return {
    contents: [
      {
        role: 'model',
        parts: [{ functionCall: { name: 'search', args: {} }, thoughtSignature: 'invalid' }],
      },
    ],
  };
}

describe('Antigravity signature-precheck modes', () => {
  test('TestAntigravityExecutor_NonStrictBypassSkipsPrecheck', () => {
    const body = invalidSignatureRequest();

    sanitizeAntigravitySignatures(body, 'gemini-3-flash', undefined, { strict: false });
    expect(body).toHaveProperty('contents.0.parts.0.thoughtSignature', 'invalid');
  });

  test('TestAntigravityExecutor_CacheModeSkipsPrecheck', () => {
    const body = invalidSignatureRequest();

    sanitizeAntigravitySignatures(body, 'gemini-3-flash', undefined, { cacheMode: true });
    expect(body).toHaveProperty('contents.0.parts.0.thoughtSignature', 'invalid');
  });
});
