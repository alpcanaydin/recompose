import { describe, expect, it } from 'vitest';

import { codexSse, codexSubscriptionApp } from './gateway-proxy-codex-subscription.testkit';

describe('Codex Chat model identity crossing the gateway', () => {
  it('TestConvertCodexResponseToOpenAI_FirstChunkUsesRequestModelName', async () => {
    const { app } = codexSubscriptionApp(() =>
      codexSse([{ type: 'response.output_text.delta', output_index: 0, delta: 'hello' }]),
    );
    const answer = await app.request('http://127.0.0.1:8397/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        model: 'fast',
        stream: true,
        messages: [{ role: 'user', content: 'hello' }],
      }),
    });
    const text = await answer.text();

    expect(text).toContain('"model":"fast"');
  });
});
