import { describe, expect, it } from 'vitest';

import type { RelaySocket } from './ai-studio-relay';

import { AIStudioRelay } from './ai-studio-relay';

describe('AIStudioRelay request correlation', () => {
  it('should correlate an HTTP response with its request', async () => {
    const socket = socketStub();
    const relay = relayWithIds();

    relay.attach(socket, 'aistudio-build');

    const answer = relay.request('aistudio-build', request());

    relay.receive('aistudio-build', responseMessage('request-1', 'ok'));

    await expect(answer.then(async (response) => response.text())).resolves.toBe('ok');
    expect(JSON.parse(socket.sent[0] ?? '{}')).toMatchObject({
      id: 'request-1',
      type: 'http_request',
      payload: {
        method: 'POST',
        url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini:generateContent',
      },
    });
  });

  it('should expose streaming chunks before stream end', async () => {
    const socket = socketStub();
    const relay = relayWithIds();

    relay.attach(socket, 'aistudio-build');
    const answer = relay.request('aistudio-build', request());

    relay.receive('aistudio-build', streamMessage('request-1', 'stream_start', {}));
    const response = await answer;
    const reading = response.text();

    relay.receive('aistudio-build', streamMessage('request-1', 'stream_chunk', { data: 'one' }));
    relay.receive('aistudio-build', streamMessage('request-1', 'stream_chunk', { data: 'two' }));
    relay.receive('aistudio-build', streamMessage('request-1', 'stream_end', {}));

    await expect(reading).resolves.toBe('onetwo');
  });

  it('should reject pending work when a channel is replaced', async () => {
    const first = socketStub();
    const second = socketStub();
    const relay = relayWithIds();

    relay.attach(first, 'aistudio-build');
    const answer = relay.request('aistudio-build', request());

    relay.attach(second, 'aistudio-build');

    await expect(answer).rejects.toThrow('replaced by new connection');
    expect(first.closed).toEqual([{ code: 1012, reason: 'replaced by new connection' }]);
  });

  it('should reject pending work when the channel disconnects', async () => {
    const relay = relayWithIds();

    relay.attach(socketStub(), 'aistudio-build');
    const answer = relay.request('aistudio-build', request());

    relay.detach('aistudio-build');

    await expect(answer).rejects.toThrow('connection closed');
  });
});

describe('AIStudioRelay lifecycle messages', () => {
  it('should answer application pings', () => {
    const socket = socketStub();
    const relay = relayWithIds();

    relay.attach(socket, 'aistudio-build');

    relay.receive('aistudio-build', JSON.stringify({ id: 'ping-1', type: 'ping' }));

    expect(socket.sent).toContain(JSON.stringify({ id: 'ping-1', type: 'pong' }));
  });

  it('should measure TTFT from send until the first relay response', async () => {
    const measurements: number[] = [];
    const times = [10, 55];
    const relay = new AIStudioRelay({
      id: () => 'request-1',
      now: () => times.shift() ?? 55,
      onTTFT: ({ milliseconds }) => {
        measurements.push(milliseconds);
      },
    });

    relay.attach(socketStub(), 'aistudio-build');
    const answer = relay.request('aistudio-build', request());

    relay.receive('aistudio-build', responseMessage('request-1', 'ok'));

    await answer;
    expect(measurements).toEqual([45]);
  });
});

// Helpers

function relayWithIds(): AIStudioRelay {
  return new AIStudioRelay({ id: () => 'request-1' });
}

function request() {
  return {
    method: 'POST',
    url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini:generateContent',
    headers: { 'content-type': 'application/json' },
    body: '{"contents":[]}',
  };
}

function responseMessage(id: string, body: string): string {
  return JSON.stringify({
    id,
    type: 'http_response',
    payload: { status: 200, headers: { 'content-type': 'application/json' }, body },
  });
}

function streamMessage(id: string, type: string, payload: Record<string, unknown>): string {
  return JSON.stringify({ id, type, payload });
}

function socketStub(): RelaySocket & {
  sent: string[];
  closed: { code: number | undefined; reason: string | undefined }[];
} {
  const sent: string[] = [];
  const closed: { code: number | undefined; reason: string | undefined }[] = [];

  return {
    sent,
    closed,
    send: (data) => {
      sent.push(data);
    },
    close: (code, reason) => {
      closed.push({ code, reason });
    },
  };
}
