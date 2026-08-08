import { Hono } from 'hono';
import { describe, expect, test } from 'vitest';

import { createGatewayApp } from '../gateway-app';
import { aCredentialedGrant, aGatewayHolding, aVirtualModel } from '../gateway-app.testkit';
import { readImageBody } from '../gateway-images-body';
import {
  applyOpenAICompatPayloadOverride,
  ensureColonSpacedJSON,
  normalizeKimiToolMessageLinksRaw,
  openAICompatPromptCacheKey,
  rewriteOpenAICompatMultipart,
} from './openai-compat-payload';

describe('OpenAI-compatible payload fidelity parity', () => {
  test('TestEnsureColonSpacedJSONLeavesInvalidPayloadUnchanged', () => {
    const input = new TextEncoder().encode('{"text":"unterminated}');

    expect(ensureColonSpacedJSON(input)).toBe(input);
  });

  test('TestNormalizeKimiToolMessageLinksPreservesLargeArguments', () => {
    const input =
      '{"messages":[{"role":"assistant","content":"lookup","tool_calls":[{"function":{"arguments":{"id":9007199254740993}}}]},{"role":"tool","call_id":"call_1"}]}';
    const output = normalizeKimiToolMessageLinksRaw(input);

    expect(output).toContain('9007199254740993');
    expect(output).toContain('"tool_call_id":"call_1"');
    expect(output).toContain('"reasoning_content":"lookup"');
  });

  test('TestOpenAICompatExecutorPayloadOverrideWinsOverThinkingSuffix', () => {
    expect(
      applyOpenAICompatPayloadOverride({
        model: 'model(high)',
        thinking: { level: 'high' },
        provider_payload_override: { model: 'override-model', thinking: { level: 'low' } },
      }),
    ).toEqual({ model: 'override-model', thinking: { level: 'low' } });
  });
});

describe('OpenAI-compatible prompt cache parity', () => {
  test('TestOpenAICompatExecutorApplyPromptCacheKey', () => {
    expect(
      openAICompatPromptCacheKey({}, { sessionId: 'session', model: 'm1', protocol: 'responses' }),
    ).toBe('responses:m1:session');
  });

  test('TestOpenAICompatExecutorPromptCacheKeyCallerValueWinsPayloadOverride', () => {
    expect(
      openAICompatPromptCacheKey(
        { prompt_cache_key: 'caller' },
        { sessionId: 'session', model: 'm1', protocol: 'responses' },
      ),
    ).toBe('caller');
  });

  test('TestOpenAICompatExecutorPromptCacheKeyIsModelAndProtocolScoped', () => {
    const key = (model: string, protocol: 'responses' | 'chat-completions') =>
      openAICompatPromptCacheKey({}, { sessionId: 'same', model, protocol });

    expect(key('m1', 'responses')).not.toBe(key('m2', 'responses'));
    expect(key('m1', 'responses')).not.toBe(key('m1', 'chat-completions'));
  });
});

describe('OpenAI-compatible compact and multipart parity', () => {
  test('TestOpenAICompatExecutorCompactPassthrough', async () => {
    const sent: { url: string; body?: RequestInit['body'] }[] = [];
    const fetchLike: typeof fetch = async (input, init) => {
      await Promise.resolve();
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

      sent.push({ url, body: init?.body });

      return Response.json({ object: 'response.compaction', output: [] });
    };
    const app = createGatewayApp(
      aGatewayHolding(aVirtualModel()),
      async () => Promise.resolve(aCredentialedGrant('https://openrouter.ai/api', 'openrouter')),
      fetchLike,
    );
    const answer = await app.request('http://127.0.0.1:8397/v1/responses/compact', {
      method: 'POST',
      body: JSON.stringify({ model: 'fast', input: [] }),
    });

    expect(answer.status).toBe(200);
    expect(sent[0]?.url).toBe('https://openrouter.ai/api/responses/compact');
    expect(typeof sent[0]?.body === 'string' ? sent[0].body : '').toContain('"model":"gpt-5-mini"');
  });

  test('TestCodexMultipartImageEditAppendsExistingImages', async () => {
    const app = new Hono();

    app.post('/', async (c) => c.json(await readImageBody(c)));
    const form = new FormData();

    form.append('images', 'existing-1');
    form.append('images', 'existing-2');
    form.append('image[]', new File(['png'], 'source.png'));
    const value = await (await app.request('http://local/', { method: 'POST', body: form })).json();

    expect(value).toHaveProperty('body.images.0', 'existing-1');
    expect(value).toHaveProperty('body.images.1', 'existing-2');
    expect(value).toHaveProperty('body.images.2.image_url');
  });

  test('TestRewriteOpenAICompatImagesMultipartPayloadPreservesStreamAndFileContentType', () => {
    const form = new FormData();

    form.set('stream', 'true');
    form.set('image', new File(['png'], 'source.png', { type: 'image/png' }));
    const rewritten = rewriteOpenAICompatMultipart(form, 'target-model');
    const file = rewritten.get('image');

    expect(rewritten.get('stream')).toBe('true');
    expect(rewritten.get('model')).toBe('target-model');
    expect(file).toBeInstanceOf(File);
    expect(file instanceof File ? file.type : '').toBe('image/png');
  });
});
