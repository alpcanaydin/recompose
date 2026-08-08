import { brotliCompressSync, deflateSync, gzipSync, zstdCompressSync } from 'node:zlib';
import { describe, expect, test } from 'vitest';

import { decodeClaudeResponse } from './claude-compression';

const payload = 'event: message_stop\ndata: {"type":"message_stop"}\n\n';

function fragmentedResponse(bytes: Uint8Array, contentEncoding?: string): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const byte of bytes) {
        controller.enqueue(Uint8Array.of(byte));
      }

      controller.close();
    },
  });
  const headers = contentEncoding === undefined ? {} : { 'content-encoding': contentEncoding };

  return new Response(body, { headers });
}

describe('Claude response compression', () => {
  test.each([
    ['gzip', gzipSync(payload)],
    ['br', brotliCompressSync(payload)],
    ['zstd', zstdCompressSync(payload)],
  ])('decodes an advertised %s body', async (encoding, compressed) => {
    const response = await decodeClaudeResponse(fragmentedResponse(compressed, encoding));

    await expect(response.text()).resolves.toBe(payload);
    expect(response.headers.has('content-encoding')).toBe(false);
  });

  test('decodes stacked repeated encodings in reverse application order', async () => {
    const compressed = brotliCompressSync(gzipSync(payload));
    const response = await decodeClaudeResponse(fragmentedResponse(compressed, 'gzip, br'));

    await expect(response.text()).resolves.toBe(payload);
  });

  test.each([
    ['gzip', gzipSync(payload)],
    ['zstd', zstdCompressSync(payload)],
  ])('detects %s by magic bytes when the header is absent', async (_encoding, compressed) => {
    const response = await decodeClaudeResponse(fragmentedResponse(compressed));

    await expect(response.text()).resolves.toBe(payload);
  });

  test('passes plain unadvertised bytes through untouched', async () => {
    const response = await decodeClaudeResponse(new Response(payload));

    await expect(response.text()).resolves.toBe(payload);
  });

  test('surfaces an invalid advertised body as a decode failure', async () => {
    const response = await decodeClaudeResponse(
      fragmentedResponse(new TextEncoder().encode('bad'), 'gzip'),
    );

    await expect(response.text()).rejects.toThrow();
  });

  test('decodes an advertised deflate body', async () => {
    const response = await decodeClaudeResponse(
      fragmentedResponse(deflateSync(payload), 'deflate'),
    );

    await expect(response.text()).resolves.toBe(payload);
  });
});

describe('a Claude body the decoder cannot take on', () => {
  test('refuses an advertised encoding it does not speak', async () => {
    const encoded = new TextEncoder().encode(payload);

    await expect(decodeClaudeResponse(fragmentedResponse(encoded, 'snappy'))).rejects.toThrow(
      'unsupported Claude response content encoding: snappy',
    );
  });

  test('hands back an answer that carries no body at all', async () => {
    const response = new Response(null, { status: 204 });

    await expect(decodeClaudeResponse(response)).resolves.toBe(response);
  });

  test('canceling the decoded body cancels the upstream reader', async () => {
    const cancelled: unknown[] = [];
    const decoded = await decodeClaudeResponse(cancellableResponse(cancelled));

    await decoded.body?.cancel('gateway closed');

    expect(cancelled).toEqual(['gateway closed']);
  });
});

function cancellableResponse(cancelled: unknown[]): Response {
  const chunk = new TextEncoder().encode(payload);
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(chunk);
    },
    cancel(reason: unknown) {
      cancelled.push(reason);
    },
  });

  return new Response(body);
}
