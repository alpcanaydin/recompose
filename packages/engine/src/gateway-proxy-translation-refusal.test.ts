import { describe, expect, test, vi } from 'vitest';

import type { TranslationRefusal } from './refusals';

import { createGatewayApp } from './gateway-app';
import { aCredentialedGrant, aGatewayHolding, aVirtualModel } from './gateway-app.testkit';

vi.mock('./dialect/dispatcher', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./dialect/dispatcher')>();

  return {
    ...actual,
    translateResponse: (): { refusal: TranslationRefusal } => ({
      refusal: { reason: 'unmappable-stop-reason', stopReason: 'paused' },
    }),
  };
});

describe('an answer whose crossing back refuses', () => {
  test('renders the refusal in the arriving dialect rather than leaking the raw body', async () => {
    const app = createGatewayApp(
      aGatewayHolding(aVirtualModel()),
      async () => Promise.resolve(aCredentialedGrant()),
      async () =>
        Promise.resolve(
          Response.json({
            choices: [
              {
                index: 0,
                message: { role: 'assistant', content: 'Sunny.' },
                finish_reason: 'stop',
              },
            ],
          }),
        ),
    );

    const refusal = await app.request('http://127.0.0.1:8397/v1/messages', {
      method: 'POST',
      body: JSON.stringify({
        model: 'fast',
        messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
      }),
    });

    expect(refusal.status).toBe(422);
    expect(await refusal.json()).toEqual({
      type: 'error',
      error: {
        type: 'invalid_request_error',
        message: 'The stop reason "paused" has no counterpart in this dialect.',
      },
    });
  });
});
