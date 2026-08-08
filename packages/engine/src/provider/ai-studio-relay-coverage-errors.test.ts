import { describe, expect, it } from 'vitest';

import type { RelaySocket } from './ai-studio-relay';

import { AIStudioRelay } from './ai-studio-relay';

describe('AIStudioRelay upstream failures', () => {
  it('should refuse a request for a channel that is not connected', async () => {
    const relay = relayWithIds();

    await expect(relay.request('  AIStudio-Absent  ', request())).rejects.toThrow(
      'wsrelay: provider aistudio-absent not connected',
    );
  });

  it('should carry the upstream message and status into the failure', async () => {
    const relay = relayWithIds();

    relay.attach(socketStub(), 'aistudio-build');
    const answer = relay.request('aistudio-build', request());

    relay.receive(
      'aistudio-build',
      errorFrame('request-1', { error: 'quota exhausted', status: 429 }),
    );

    await expect(answer).rejects.toThrow('quota exhausted (status=429)');
  });

  it('should describe an upstream failure that arrives without detail', async () => {
    const relay = relayWithIds();

    relay.attach(socketStub(), 'aistudio-build');
    const answer = relay.request('aistudio-build', request());

    relay.receive('aistudio-build', errorFrame('request-1', {}));

    await expect(answer).rejects.toThrow('wsrelay: upstream error');
  });

  it('should break the open stream when the upstream fails mid answer', async () => {
    const relay = relayWithIds();

    relay.attach(socketStub(), 'aistudio-build');
    const answer = relay.request('aistudio-build', request());

    relay.receive('aistudio-build', streamFrame('request-1', 'stream_start', { status: 200 }));

    const reading = (await answer).text();

    relay.receive('aistudio-build', errorFrame('request-1', { error: 'upstream reset' }));

    await expect(reading).rejects.toThrow('upstream reset');
  });

  it('should leave a request that already ended untouched by a later failure', async () => {
    const relay = relayWithIds();

    relay.attach(socketStub(), 'aistudio-build');
    const answer = relay.request('aistudio-build', request());

    relay.receive('aistudio-build', responseFrame('request-1', 'ok'));
    relay.receive('aistudio-build', errorFrame('request-1', { error: 'too late' }));

    await expect(answer.then(async (response) => response.text())).resolves.toBe('ok');
  });
});

describe('AIStudioRelay caller cancellation', () => {
  it('should refuse the request when the caller aborts it', async () => {
    const relay = relayWithIds();
    const cancellation = new AbortController();

    relay.attach(socketStub(), 'aistudio-build');
    const answer = relay.request('aistudio-build', request(), cancellation.signal);

    cancellation.abort();

    await expect(answer).rejects.toThrow('wsrelay: request aborted');
  });

  it('should stay quiet when the caller aborts after the channel already closed', async () => {
    const relay = relayWithIds();
    const cancellation = new AbortController();

    relay.attach(socketStub(), 'aistudio-build');
    const answer = relay.request('aistudio-build', request(), cancellation.signal);

    relay.detach('aistudio-build', new Error('provider went away'));

    await expect(answer).rejects.toThrow('provider went away');
    expect(() => {
      cancellation.abort();
    }).not.toThrow();
  });

  it('should ignore a disconnect for a channel that was never attached', () => {
    const relay = relayWithIds();

    expect(() => {
      relay.detach('aistudio-absent');
    }).not.toThrow();
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

function errorFrame(id: string, payload: Record<string, unknown>): string {
  return JSON.stringify({ id, type: 'error', payload });
}

function responseFrame(id: string, body: string): string {
  return JSON.stringify({ id, type: 'http_response', payload: { status: 200, body } });
}

function streamFrame(id: string, type: string, payload: Record<string, unknown>): string {
  return JSON.stringify({ id, type, payload });
}

function socketStub(): RelaySocket {
  return { send: () => undefined, close: () => undefined };
}
