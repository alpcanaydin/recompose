import { describe, expect, test } from 'vitest';

import type { AntigravityReplayItem } from './antigravity-replay-items';

import {
  functionCallObjectKey,
  itemPart,
  matchesCall,
  matchesResponse,
  replayItemKey,
  textReplayKey,
} from './antigravity-replay-items';

const BYPASS = 'skip_thought_signature_validator';

function item(fields: Partial<AntigravityReplayItem>): AntigravityReplayItem {
  return { id: '', name: 'Bash', args: {}, ...fields };
}

describe('a cached call matches the client response that answers it', () => {
  test('a text entry never answers a function response', () => {
    expect(matchesResponse(item({ text: 'hello' }), { id: 'call-1', name: 'Bash' })).toBe(false);
  });

  test('two identified sides match on the identifier alone', () => {
    expect(matchesResponse(item({ id: 'call-1', name: 'Read' }), { id: 'call-1' })).toBe(true);
  });

  test('two identified sides that disagree do not match', () => {
    expect(matchesResponse(item({ id: 'call-1' }), { id: 'call-2' })).toBe(false);
  });

  test('an unidentified response falls back to the tool name', () => {
    expect(matchesResponse(item({ name: 'Bash' }), { name: 'Bash' })).toBe(true);
  });

  test('a response named unknown never matches', () => {
    expect(matchesResponse(item({ name: 'unknown' }), { name: 'unknown' })).toBe(false);
  });

  test('a response with neither identifier nor name never matches', () => {
    expect(matchesResponse(item({ name: 'Bash' }), {})).toBe(false);
  });
});

describe('a cached call matches the client call it replays', () => {
  test('a text entry never matches a function call', () => {
    expect(matchesCall(item({ text: 'hello' }), { name: 'Bash' })).toBe(false);
  });

  test('the same name and arguments match', () => {
    const call = { name: 'Bash', args: { command: 'true' } };
    const cached = item({ args: { command: 'true' }, occurrence: 0 });

    expect(matchesCall(cached, call)).toBe(true);
  });

  test('an unidentified entry that recorded no repeat never matches', () => {
    const call = { name: 'Bash', args: { command: 'true' } };

    expect(matchesCall(item({ args: { command: 'true' } }), call)).toBe(false);
  });

  test('different arguments do not match', () => {
    const call = { name: 'Bash', args: { command: 'false' } };

    expect(matchesCall(item({ args: { command: 'true' } }), call)).toBe(false);
  });

  test('a different name does not match', () => {
    expect(matchesCall(item({ name: 'Bash' }), { name: 'Read', args: {} })).toBe(false);
  });

  test('identifiers that disagree rule the match out', () => {
    const call = { id: 'call-2', name: 'Bash', args: {} };

    expect(matchesCall(item({ id: 'call-1' }), call)).toBe(false);
  });

  test('an unidentified call must be the same repeat', () => {
    expect(matchesCall(item({ occurrence: 1 }), { name: 'Bash', args: {} }, 0)).toBe(false);
  });

  test('an unidentified call of the right repeat matches', () => {
    expect(matchesCall(item({ occurrence: 1 }), { name: 'Bash', args: {} }, 1)).toBe(true);
  });

  test('arguments that are not an object read as none', () => {
    const cached = item({ args: {}, occurrence: 0 });

    expect(matchesCall(cached, { name: 'Bash', args: 'true' })).toBe(true);
  });
});

describe('a replay entry is keyed by what identifies it', () => {
  test('a call is keyed by its name and arguments', () => {
    expect(replayItemKey(item({ args: { command: 'true' } }))).toContain('call\0Bash');
  });

  test('a spoken text is keyed as visible', () => {
    expect(replayItemKey(item({ text: 'hello' }))).toBe(textReplayKey('hello', false));
  });

  test('a thought is keyed apart from the same visible text', () => {
    expect(replayItemKey(item({ text: 'hello', thought: true }))).toBe(
      textReplayKey('hello', true),
    );
  });

  test('a call object keys the same as the entry it produced', () => {
    const key = functionCallObjectKey({ name: 'Bash', args: { command: 'true' } });

    expect(replayItemKey(item({ args: { command: 'true' } }))).toBe(`call\0${key}`);
  });

  test('a call object without readable arguments keys as none', () => {
    expect(functionCallObjectKey({ name: 'Bash', args: 7 })).toBe(
      functionCallObjectKey({ name: 'Bash', args: {} }),
    );
  });
});

describe('a replay entry becomes the part the provider expects', () => {
  test('a spoken text becomes a plain text part', () => {
    expect(itemPart(item({ text: 'hello' }), false)).toEqual({ text: 'hello' });
  });

  test('a thought is marked as one', () => {
    expect(itemPart(item({ text: 'hello', thought: true }), false)).toEqual({
      text: 'hello',
      thought: true,
    });
  });

  test('a signed text carries its signature', () => {
    expect(itemPart(item({ text: 'hello', signature: BYPASS }), false)).toEqual({
      text: 'hello',
      thoughtSignature: BYPASS,
    });
  });

  test('an identified call carries its identifier', () => {
    expect(itemPart(item({ id: 'call-1', signature: BYPASS }), false)).toEqual({
      functionCall: { id: 'call-1', name: 'Bash', args: {} },
      thoughtSignature: BYPASS,
    });
  });

  test('an unidentified call leaves the identifier out', () => {
    expect(itemPart(item({ signature: BYPASS }), false)).toEqual({
      functionCall: { name: 'Bash', args: {} },
      thoughtSignature: BYPASS,
    });
  });

  test('an unsigned call after the first carries no signature', () => {
    expect(itemPart(item({}), false)).toEqual({ functionCall: { name: 'Bash', args: {} } });
  });

  test('an unsigned first call carries the validator bypass', () => {
    expect(itemPart(item({}), true)).toEqual({
      functionCall: { name: 'Bash', args: {} },
      thoughtSignature: BYPASS,
    });
  });
});
