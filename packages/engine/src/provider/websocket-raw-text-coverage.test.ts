import { describe, expect, test } from 'vitest';

import { websocketRawText } from './websocket-raw-text';

describe('reading the text a websocket frame carries', () => {
  test('a fragmented frame joins its buffers in arrival order', () => {
    expect(websocketRawText([Buffer.from('{"role":'), Buffer.from('"user"}')])).toBe(
      '{"role":"user"}',
    );
  });

  test('a frame delivered as a raw ArrayBuffer reads as its text', () => {
    const source = new TextEncoder().encode('ping');

    expect(websocketRawText(source.buffer.slice(0))).toBe('ping');
  });

  test('a frame delivered as a single buffer reads as its text', () => {
    expect(websocketRawText(Buffer.from('pong'))).toBe('pong');
  });
});
