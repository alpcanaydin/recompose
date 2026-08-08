import type { SpendGrant } from '@recompose/contracts';

import { describe, expect, it, vi } from 'vitest';

import type { RelaySocket } from './provider/ai-studio-relay';

import { createGatewayApp } from './gateway-app';
import { aGatewayHolding, aVirtualModel, neverFetches } from './gateway-app.testkit';
import { isJsonObject, parsedJson } from './gateway-wire';
import { AIStudioRelay } from './provider/ai-studio-relay';

const grant: SpendGrant = {
  verdict: 'resolved',
  providerOrigin: 'https://generativelanguage.googleapis.com',
  spend: {
    custody: 'credentialed',
    provider: 'aistudio',
    credential: 'relay-owned',
    accountId: 'aistudio-build',
  },
};

describe('AI Studio inference serving', () => {
  it('should relay Gemini inference and translate the answer', async () => {
    const serving = relayServing();
    const answer = ask(serving.relay);

    await vi.waitFor(() => {
      expect(serving.socket.sent).toHaveLength(1);
    });
    const sent = sentEnvelope(serving.socket);

    serving.relay.receive(
      'aistudio-build',
      relayResponse(sent.id, {
        candidates: [
          { content: { role: 'model', parts: [{ text: 'selam' }] }, finishReason: 'STOP' },
        ],
        usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 1, totalTokenCount: 3 },
      }),
    );

    expect(sent.payload).toMatchObject({
      method: 'POST',
      url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
    });
    expect(JSON.parse(sent.payload.body)).toMatchObject({
      contents: [{ role: 'user', parts: [{ text: 'hello' }] }],
    });
    await expect(answer.then(async (response) => response.json())).resolves.toMatchObject({
      choices: [{ message: { content: 'selam' } }],
    });
  });

  it('should strip AI Studio-incompatible generation fields', async () => {
    const serving = relayServing();
    const answer = ask(serving.relay, { max_tokens: 64, response_format: { type: 'json_object' } });

    await vi.waitFor(() => {
      expect(serving.socket.sent).toHaveLength(1);
    });
    const sent = sentEnvelope(serving.socket);
    const body = sentBody(sent);

    serving.relay.receive('aistudio-build', relayResponse(sent.id, { candidates: [] }));

    expect(body).not.toHaveProperty('generationConfig.maxOutputTokens');
    expect(body).not.toHaveProperty('generationConfig.responseMimeType');
    await answer;
  });
});

describe('AI Studio token counting', () => {
  it('should relay native countTokens without inference-only fields', async () => {
    const serving = relayServing();
    const answer = count(serving.relay);

    await vi.waitFor(() => {
      expect(serving.socket.sent).toHaveLength(1);
    });
    const sent = sentEnvelope(serving.socket);
    const body = sentBody(sent);

    serving.relay.receive('aistudio-build', relayResponse(sent.id, { totalTokens: 17 }));

    expect(sent.payload.url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:countTokens',
    );
    expect(body).not.toHaveProperty('tools');
    expect(body).not.toHaveProperty('generationConfig');
    await expect(answer.then(async (response) => response.json())).resolves.toEqual({
      input_tokens: 17,
    });
  });
});

describe('AI Studio streaming serving', () => {
  it('should translate relay stream chunks as they arrive', async () => {
    const serving = relayServing();
    const answer = ask(serving.relay, { stream: true });

    await vi.waitFor(() => {
      expect(serving.socket.sent).toHaveLength(1);
    });
    const sent = sentEnvelope(serving.socket);

    serving.relay.receive(
      'aistudio-build',
      JSON.stringify({
        id: sent.id,
        type: 'stream_start',
        payload: { status: 200, headers: { 'content-type': 'text/event-stream' } },
      }),
    );
    const response = await answer;
    const reading = response.text();

    serving.relay.receive(
      'aistudio-build',
      streamChunk(sent.id, { candidates: [{ content: { parts: [{ text: 'selam' }] } }] }),
    );
    serving.relay.receive(
      'aistudio-build',
      JSON.stringify({ id: sent.id, type: 'stream_end', payload: {} }),
    );

    await expect(reading).resolves.toContain('selam');
    expect(sent.payload.url).toContain(':streamGenerateContent?alt=sse');
  });
});

// Helpers

function relayServing() {
  const socket = socketStub();
  const relay = new AIStudioRelay({ id: () => 'relay-request-1' });

  relay.attach(socket, 'aistudio-build');

  return { relay, socket };
}

async function ask(relay: AIStudioRelay, extra: Record<string, unknown> = {}): Promise<Response> {
  const app = appFor(relay);

  return app.request('http://127.0.0.1:8397/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model: 'fast',
      messages: [{ role: 'user', content: 'hello' }],
      ...extra,
    }),
  });
}

async function count(relay: AIStudioRelay): Promise<Response> {
  const app = appFor(relay);

  return app.request('http://127.0.0.1:8397/v1/messages/count_tokens', {
    method: 'POST',
    body: JSON.stringify({
      model: 'fast',
      max_tokens: 64,
      messages: [{ role: 'user', content: 'hello' }],
      tools: [{ name: 'lookup', input_schema: { type: 'object' } }],
    }),
  });
}

function appFor(relay: AIStudioRelay) {
  const model = aVirtualModel({
    target: { standing: 'bound', providerModel: 'gemini-3.6-flash' },
  });

  return createGatewayApp(
    aGatewayHolding(model),
    async () => Promise.resolve(grant),
    neverFetches,
    undefined,
    relay,
  );
}

function sentEnvelope(socket: ReturnType<typeof socketStub>) {
  const value: unknown = JSON.parse(socket.sent[0] ?? '{}');

  if (!isEnvelope(value)) throw new Error('relay carried no request envelope');

  return value;
}

function isEnvelope(
  value: unknown,
): value is { id: string; payload: { body: string; method: string; url: string } } {
  if (!isJsonObject(value)) return false;

  const payload = value['payload'];

  return typeof value['id'] === 'string' && isRelayPayload(payload);
}

function isRelayPayload(value: unknown): value is { body: string; method: string; url: string } {
  return (
    isJsonObject(value) &&
    typeof value['body'] === 'string' &&
    typeof value['method'] === 'string' &&
    typeof value['url'] === 'string'
  );
}

function sentBody(sent: ReturnType<typeof sentEnvelope>): Record<string, unknown> {
  const body = parsedJson(sent.payload.body);

  if (!isJsonObject(body)) throw new Error('relay request body is not an object');

  return body;
}

function relayResponse(id: string, body: Record<string, unknown>): string {
  return JSON.stringify({
    id,
    type: 'http_response',
    payload: {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
  });
}

function streamChunk(id: string, body: Record<string, unknown>): string {
  return JSON.stringify({
    id,
    type: 'stream_chunk',
    payload: { data: `data: ${JSON.stringify(body)}\n\n` },
  });
}

function socketStub(): RelaySocket & { sent: string[] } {
  const sent: string[] = [];

  return {
    sent,
    send: (data) => {
      sent.push(data);
    },
    close: () => undefined,
  };
}
