import { describe, expect, test } from 'vitest';

import type { AntigravityReplayItem } from './antigravity-replay-items';

import { mergedReplayItems, scanReplayParts } from './antigravity-replay-items';

const BYPASS = 'skip_thought_signature_validator';

function call(name: string, id = '', args: Record<string, unknown> = {}) {
  return { functionCall: { ...(id === '' ? {} : { id }), name, args } };
}

function item(fields: Partial<AntigravityReplayItem>): AntigravityReplayItem {
  return { id: '', name: 'Bash', args: {}, ...fields };
}

describe('scanning Antigravity parts collects the calls that must replay', () => {
  test('a part that is not an object contributes nothing', () => {
    expect(scanReplayParts(['text', 7, null]).items).toEqual([]);
  });

  test('a part without a function call contributes nothing', () => {
    expect(scanReplayParts([{ text: 'hello' }]).items).toEqual([]);
  });

  test('a call is collected with its identity and arguments', () => {
    const scan = scanReplayParts([call('Bash', 'call-1', { command: 'true' })]);

    expect(scan.items).toEqual([{ id: 'call-1', name: 'Bash', args: { command: 'true' } }]);
  });

  test('a call whose arguments are not an object is collected with none', () => {
    const scan = scanReplayParts([{ functionCall: { name: 'Bash', args: 'true' } }]);

    expect(scan.items[0]).toHaveProperty('args', {});
  });

  test('an unidentified call records which repeat it is', () => {
    const scan = scanReplayParts([call('Bash'), call('Bash'), call('Read')]);

    expect(scan.items.map((collected) => collected.occurrence)).toEqual([0, 1, 0]);
  });

  test('an identified call records no repeat number', () => {
    const scan = scanReplayParts([call('Bash', 'call-1')]);

    expect(scan.items[0]).not.toHaveProperty('occurrence');
  });
});

describe('a detached Antigravity signature attaches to the call it belongs to', () => {
  test('a signature after a call attaches to that call', () => {
    const scan = scanReplayParts([call('Bash', 'call-1'), { thoughtSignature: BYPASS }]);

    expect(scan.items[0]).toHaveProperty('signature', BYPASS);
    expect(scan.pendingSignature).toBeUndefined();
  });

  test('a signature under the snake-case spelling attaches too', () => {
    const scan = scanReplayParts([call('Bash', 'call-1'), { thought_signature: BYPASS }]);

    expect(scan.items[0]).toHaveProperty('signature', BYPASS);
  });

  test('a signature before any call is held for the next scan', () => {
    const scan = scanReplayParts([{ thoughtSignature: BYPASS }]);

    expect(scan.items).toEqual([]);
    expect(scan.pendingSignature).toBe(BYPASS);
  });

  test('a held signature from an earlier scan lands on the first call', () => {
    const scan = scanReplayParts([call('Bash', 'call-1')], BYPASS);

    expect(scan.items[0]).toHaveProperty('signature', BYPASS);
    expect(scan.pendingSignature).toBeUndefined();
  });

  test('a second signature is held when the last call already carries one', () => {
    const parts = [
      call('Bash', 'call-1'),
      { thoughtSignature: BYPASS },
      { thought_signature: BYPASS },
    ];
    const scan = scanReplayParts(parts);

    expect(scan.pendingSignature).toBe(BYPASS);
  });

  test('a signature carried on the call itself is collected', () => {
    const scan = scanReplayParts([
      { functionCall: { name: 'Bash', args: {}, thoughtSignature: BYPASS } },
    ]);

    expect(scan.items[0]).toHaveProperty('signature', BYPASS);
  });

  test('a signature the envelope cannot read is ignored', () => {
    const scan = scanReplayParts([call('Bash', 'call-1'), { thoughtSignature: 'not-a-signature' }]);

    expect(scan.items[0]).not.toHaveProperty('signature');
  });
});

describe('merging Antigravity replay items keeps one entry per identity', () => {
  test('a new identity is appended', () => {
    const merged = mergedReplayItems([item({ id: 'call-1' })], [item({ id: 'call-2' })]);

    expect(merged).toHaveLength(2);
  });

  test('a repeated identity is folded into the entry already held', () => {
    const merged = mergedReplayItems(
      [item({ id: 'call-1' })],
      [item({ id: 'call-1', signature: BYPASS })],
    );

    expect(merged).toEqual([{ id: 'call-1', name: 'Bash', args: {}, signature: BYPASS }]);
  });

  test('two unidentified calls of the same shape and repeat are one identity', () => {
    const merged = mergedReplayItems(
      [item({ occurrence: 0 })],
      [item({ occurrence: 0, signature: BYPASS })],
    );

    expect(merged).toHaveLength(1);
  });

  test('two unidentified calls of different repeats stay apart', () => {
    const merged = mergedReplayItems([item({ occurrence: 0 })], [item({ occurrence: 1 })]);

    expect(merged).toHaveLength(2);
  });

  test('text entries match on text, thought standing and repeat', () => {
    const spoken = item({ text: 'hello', thought: false, occurrence: 0 });
    const merged = mergedReplayItems([spoken], [{ ...spoken, signature: BYPASS }]);

    expect(merged).toHaveLength(1);
  });

  test('a text entry never folds into a call entry', () => {
    const merged = mergedReplayItems([item({ text: 'hello' })], [item({ id: 'call-1' })]);

    expect(merged).toHaveLength(2);
  });
});
