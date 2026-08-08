import { describe, expect, it } from 'vitest';

import type { RelaySocket } from './ai-studio-relay';

import { AIStudioRelay, aiStudioRelayRuntime } from './ai-studio-relay';

describe('AIStudioRelay frame admission', () => {
  it('should ignore a frame whose body is not a JSON object', () => {
    const socket = socketStub();
    const relay = relayWithIds();

    relay.attach(socket, 'aistudio-build');

    relay.receive('aistudio-build', '[]');
    relay.receive('aistudio-build', 'not json at all');

    expect(socket.sent).toEqual([]);
  });

  it('should ignore a frame whose identifier is not text', () => {
    const socket = socketStub();
    const relay = relayWithIds();

    relay.attach(socket, 'aistudio-build');

    relay.receive('aistudio-build', JSON.stringify({ id: 7, type: 'ping' }));

    expect(socket.sent).toEqual([]);
  });

  it('should ignore a frame addressed to a channel that never connected', () => {
    const socket = socketStub();
    const relay = relayWithIds();

    relay.attach(socket, 'aistudio-build');

    relay.receive('aistudio-other', JSON.stringify({ id: 'ping-1', type: 'ping' }));

    expect(socket.sent).toEqual([]);
  });

  it('should name a channel for the connection when the caller supplies none', () => {
    const relay = new AIStudioRelay();

    const channelId = relay.attach(socketStub());

    expect(channelId).toMatch(/^aistudio-[\da-f]{16}$/u);
  });

  it('should treat a padded upper-case channel name as the same channel', async () => {
    const socket = socketStub();
    const relay = relayWithIds();

    const channelId = relay.attach(socket, '  AIStudio-Build  ');
    const answer = relay.request('AISTUDIO-BUILD', request());

    relay.receive('aistudio-build', responseFrame('request-1', { body: 'ok' }));

    expect(channelId).toBe('aistudio-build');
    await expect(answer.then(async (response) => response.text())).resolves.toBe('ok');
  });

  it('should share one relay across the whole engine process', () => {
    const relay = aiStudioRelayRuntime();

    expect(relay).toBe(aiStudioRelayRuntime());
  });
});

describe('AIStudioRelay response headers', () => {
  it('should repeat a header the provider sent more than once', async () => {
    const relay = relayWithIds();

    relay.attach(socketStub(), 'aistudio-build');
    const answer = relay.request('aistudio-build', request());

    relay.receive(
      'aistudio-build',
      responseFrame('request-1', {
        status: 201,
        headers: { 'x-trace': ['one', 'two'], 'x-count': [7], 'x-flag': 5, 'x-name': 'plain' },
        body: 'ok',
      }),
    );

    const response = await answer;

    expect(response.status).toBe(201);
    expect(response.headers.get('x-trace')).toBe('one, two');
    expect(response.headers.get('x-name')).toBe('plain');
    expect(response.headers.get('x-count')).toBeNull();
    expect(response.headers.get('x-flag')).toBeNull();
  });

  it('should answer with an empty body when the provider omits one', async () => {
    const relay = relayWithIds();

    relay.attach(socketStub(), 'aistudio-build');
    const answer = relay.request('aistudio-build', request());

    relay.receive('aistudio-build', responseFrame('request-1', { status: 200.5, body: 42 }));

    const response = await answer;

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe('');
  });
});

describe('AIStudioRelay stream assembly', () => {
  it('should open a stream when the first chunk arrives without an opening frame', async () => {
    const relay = relayWithIds();

    relay.attach(socketStub(), 'aistudio-build');
    const answer = relay.request('aistudio-build', request());

    relay.receive('aistudio-build', streamFrame('request-1', 'stream_chunk', { data: 'hello' }));

    const reading = (await answer).text();

    relay.receive('aistudio-build', streamFrame('request-1', 'stream_chunk', { data: 7 }));
    relay.receive('aistudio-build', streamFrame('request-1', 'stream_end', {}));

    await expect(reading).resolves.toBe('hello');
  });

  it('should close an empty stream when the provider ends one it never opened', async () => {
    const relay = relayWithIds();

    relay.attach(socketStub(), 'aistudio-build');
    const answer = relay.request('aistudio-build', request());

    relay.receive('aistudio-build', streamFrame('request-1', 'stream_end', {}));

    await expect(answer.then(async (response) => response.text())).resolves.toBe('');
  });

  it('should keep the first stream status when the provider opens the stream twice', async () => {
    const relay = relayWithIds();

    relay.attach(socketStub(), 'aistudio-build');
    const answer = relay.request('aistudio-build', request());

    relay.receive('aistudio-build', streamFrame('request-1', 'stream_start', { status: 206 }));

    const response = await answer;

    relay.receive('aistudio-build', streamFrame('request-1', 'stream_start', { status: 500 }));
    relay.receive('aistudio-build', streamFrame('request-1', 'stream_end', {}));

    expect(response.status).toBe(206);
  });

  it('should hold the streamed answer when a whole-response frame arrives late', async () => {
    const relay = relayWithIds();

    relay.attach(socketStub(), 'aistudio-build');
    const answer = relay.request('aistudio-build', request());

    relay.receive('aistudio-build', streamFrame('request-1', 'stream_start', { status: 200 }));

    const response = await answer;
    const reading = response.text();

    relay.receive('aistudio-build', responseFrame('request-1', { status: 500, body: 'late' }));
    relay.receive('aistudio-build', streamFrame('request-1', 'stream_end', {}));

    expect(response.status).toBe(200);
    await expect(reading).resolves.toBe('');
  });

  it('should ignore an unrecognised lifecycle frame for a live request', async () => {
    const relay = relayWithIds();

    relay.attach(socketStub(), 'aistudio-build');
    const answer = relay.request('aistudio-build', request());

    relay.receive('aistudio-build', streamFrame('request-1', 'heartbeat', {}));
    relay.receive('aistudio-build', responseFrame('request-1', { body: 'ok' }));

    await expect(answer.then(async (response) => response.text())).resolves.toBe('ok');
  });
});

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

function responseFrame(id: string, payload: Record<string, unknown>): string {
  return JSON.stringify({ id, type: 'http_response', payload });
}

function streamFrame(id: string, type: string, payload: Record<string, unknown>): string {
  return JSON.stringify({ id, type, payload });
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
