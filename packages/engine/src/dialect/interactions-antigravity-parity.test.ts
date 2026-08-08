import { describe, expect, it } from 'vitest';

import { isJsonObject, parsedJson } from '../gateway-wire';
import { jsonObjectsFrom } from '../stream-wire';
import { antigravityProviderRequest } from '../subscription/antigravity-request';
import { unwrapAntigravityResponse } from '../subscription/antigravity-response';
import { translateRequestToGemini } from './gemini-bridge';
import { translateResponseFromGemini, translateStreamFromGemini } from './gemini-bridge';
import { isGeminiResponse } from './gemini-bridge';

const credential = {
  accessToken: 'google-access',
  refreshToken: 'google-refresh',
  projectId: 'cloud-project',
};

function antigravityBody(request: Parameters<typeof translateRequestToGemini<'interactions'>>[1]) {
  const translated = translateRequestToGemini('interactions', request);

  if ('refusal' in translated) throw new Error('expected translated request');

  const provider = antigravityProviderRequest(
    'https://daily-cloudcode-pa.googleapis.com',
    { ...translated.value, model: 'gemini-3.5-flash' },
    credential,
    { requestId: 'request-1', sessionId: 'session-1' },
    1_700_000_000_000,
  );
  const body = parsedJson(provider.body);

  if (!isJsonObject(body)) throw new Error('expected Antigravity envelope');

  return body;
}

describe('Interactions requests crossing Antigravity', () => {
  it('should carry messages, tools, and private Gemini schema names', () => {
    const body = antigravityBody({
      system_instruction: 'be brief',
      input: [
        { type: 'user_input', content: [{ type: 'text', text: 'hi' }] },
        { type: 'function_call', name: 'lookup', call_id: 'call_1', arguments: { q: 'x' } },
        {
          type: 'function_result',
          name: 'lookup',
          call_id: 'call_1',
          result: { ok: true },
        },
      ],
      tools: [
        {
          type: 'function',
          name: 'lookup',
          parameters: { type: 'object', properties: { q: { type: 'string' } } },
        },
      ],
    });

    expect(body).toHaveProperty('request.systemInstruction.parts.0.text', 'be brief');
    expect(body).toHaveProperty('request.contents.1.parts.0.functionCall.name', 'lookup');
    expect(body).toHaveProperty('request.contents.2.parts.0.functionResponse.name', 'lookup');
    expect(body).toHaveProperty(
      'request.tools.0.functionDeclarations.0.parametersJsonSchema.properties.q.type',
      'string',
    );
    expect(body).not.toHaveProperty('request.tools.0.functionDeclarations.0.parameters');
  });
});

describe('Interactions file data crossing Antigravity', () => {
  it('should normalize nested OpenAI file data into inline data', () => {
    const body = antigravityBody({
      input: [
        {
          type: 'user_input',
          content: [
            {
              type: 'file',
              file: {
                filename: 'test.pdf',
                file_data: 'data:application/pdf;base64,JVBERi0xLjQK',
              },
            },
          ],
        },
      ],
    });

    expect(body).toHaveProperty('request.contents.0.parts.0.inlineData', {
      mimeType: 'application/pdf',
      data: 'JVBERi0xLjQK',
    });
  });
});

describe('Interactions generation controls crossing Antigravity translation', () => {
  it('should preserve sampling, thinking, summaries, and tool choice before executor policy', () => {
    const translated = translateRequestToGemini('interactions', {
      input: 'hi',
      generation_config: {
        max_output_tokens: 16,
        top_p: 0.8,
        tool_choice: 'auto',
        thinking_level: 'high',
        thinking_summaries: 'auto',
      },
    });

    expect(translated).toHaveProperty('value.generationConfig.maxOutputTokens', 16);
    expect(translated).toHaveProperty('value.generationConfig.topP', 0.8);
    expect(translated).toHaveProperty(
      'value.generationConfig.thinkingConfig.thinkingLevel',
      'high',
    );
    expect(translated).toHaveProperty(
      'value.generationConfig.thinkingConfig.includeThoughts',
      true,
    );
    expect(translated).toHaveProperty('value.toolConfig.functionCallingConfig.mode', 'AUTO');
  });

  it.each([
    { summary: undefined, expected: undefined },
    { summary: 'auto', expected: true },
    { summary: 'none', expected: false },
  ])('should keep summary $summary independent from effort', ({ summary, expected }) => {
    const translated = translateRequestToGemini('interactions', {
      input: 'hi',
      reasoning: { effort: 'high', ...(summary === undefined ? {} : { summary }) },
    });

    expect(translated).toHaveProperty(
      'value.generationConfig.thinkingConfig.thinkingLevel',
      'high',
    );

    if (expected === undefined) {
      expect(translated).not.toHaveProperty(
        'value.generationConfig.thinkingConfig.includeThoughts',
      );
    } else {
      expect(translated).toHaveProperty(
        'value.generationConfig.thinkingConfig.includeThoughts',
        expected,
      );
    }
  });
});

describe('Antigravity response envelopes crossing Interactions', () => {
  it('should unwrap and translate a non-stream answer', async () => {
    const unwrapped = await unwrapAntigravityResponse(
      Response.json({
        response: {
          responseId: 'resp_1',
          candidates: [
            {
              content: {
                role: 'model',
                parts: [
                  { text: 'ok' },
                  { functionCall: { name: 'lookup', id: 'call_1', args: { q: 'x' } } },
                ],
              },
              finishReason: 'STOP',
            },
          ],
          usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2, totalTokenCount: 5 },
        },
      }),
    );
    const body: unknown = await unwrapped.json();

    if (!isJsonObject(body) || !isGeminiResponse(body)) throw new Error('expected Gemini answer');

    const translated = translateResponseFromGemini('interactions', body);

    expect(translated).toHaveProperty('value.steps.0.content.0.text', 'ok');
    expect(translated).toHaveProperty('value.steps.1.call_id', 'call_1');
    expect(translated).toHaveProperty('value.usage.total_tokens', 5);
  });
});

describe('Antigravity stream envelopes crossing Interactions', () => {
  it('should unwrap streamed text and function-call identity', async () => {
    const source = new Response(
      'data: {"response":{"candidates":[{"content":{"role":"model","parts":[{"text":"ok"},{"functionCall":{"name":"lookup","id":"call_1","args":{"q":"x"}}}]}}]}}\n\n',
      { headers: { 'content-type': 'text/event-stream' } },
    );
    const unwrapped = await unwrapAntigravityResponse(source);

    if (unwrapped.body === null) throw new Error('expected stream body');

    const events = [];

    for await (const event of translateStreamFromGemini(
      'interactions',
      geminiResponses(unwrapped.body),
    )) {
      events.push(event);
    }

    const text = events.find((event) => event.event_type === 'step.delta');
    const call = events.find(
      (event) =>
        event.event_type === 'step.start' &&
        JSON.stringify(event).includes('"type":"function_call"'),
    );

    expect(text).toHaveProperty('delta', { type: 'text', text: 'ok' });
    expect(call).toHaveProperty('step.call_id', 'call_1');
  });
});

async function* geminiResponses(body: ReadableStream<Uint8Array>) {
  for await (const value of jsonObjectsFrom(body)) {
    if (isGeminiResponse(value)) yield value;
  }
}
