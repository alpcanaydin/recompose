import { describe, expect, it } from 'vitest';

import { decodedLogCursor, encodedLogCursor } from './provider-log-cursor';

function encoded(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

describe('decodedLogCursor: a cursor the caller did not get from the log reader', () => {
  it('rejects a cursor whose payload is not an object at all', () => {
    expect(decodedLogCursor(encoded(5))).toBeNull();
  });

  it('rejects a cursor whose payload is a list rather than a record', () => {
    expect(decodedLogCursor(encoded([1, 2]))).toBeNull();
  });

  it('rejects a cursor that names no offset', () => {
    expect(decodedLogCursor(encoded({ version: 1, file: 'main.log', fingerprint: 'abc' }))).toBe(
      null,
    );
  });
});

describe('decodedLogCursor: a cursor the log reader issued', () => {
  it('reads back every field the reader wrote', () => {
    const cursor = {
      version: 1,
      file: 'main.log',
      offset: 128,
      size: 512,
      fingerprint: 'abc',
      latestTimestamp: 17,
    } as const;

    expect(decodedLogCursor(encodedLogCursor(cursor))).toEqual(cursor);
  });
});
