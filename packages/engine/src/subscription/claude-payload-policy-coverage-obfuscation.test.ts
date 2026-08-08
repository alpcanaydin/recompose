import { describe, expect, it } from 'vitest';

import { applyClaudePayloadFinalPolicy } from './claude-payload-policy';

const zeroWidth = '​';

describe('Claude payload obfuscation of the system prompt', () => {
  it('should leave the body alone when the policy lists no sensitive words', () => {
    const obfuscated = applyClaudePayloadFinalPolicy({ system: 'Claude Code' }, { filters: [] });

    expect(obfuscated).toEqual({ system: 'Claude Code' });
  });

  it('should break up a sensitive word inside a whole-string system prompt', () => {
    const obfuscated = applyClaudePayloadFinalPolicy(
      { system: 'You are Claude Code' },
      { sensitiveWords: ['Claude'] },
    );

    expect(obfuscated).toEqual({ system: `You are C${zeroWidth}laude Code` });
  });

  it('should break up a sensitive word inside each system text block', () => {
    const obfuscated = applyClaudePayloadFinalPolicy(
      { system: [{ type: 'text', text: 'Claude speaking' }] },
      { sensitiveWords: ['Claude'] },
    );

    expect(obfuscated).toEqual({ system: [{ type: 'text', text: `C${zeroWidth}laude speaking` }] });
  });

  it('should leave a system prompt that is neither text nor blocks alone', () => {
    const obfuscated = applyClaudePayloadFinalPolicy(
      { system: 42 },
      { sensitiveWords: ['Claude'] },
    );

    expect(obfuscated).toEqual({ system: 42 });
  });

  it('should leave a non-text system block untouched', () => {
    const obfuscated = applyClaudePayloadFinalPolicy(
      { system: [{ type: 'image', text: 'Claude' }] },
      { sensitiveWords: ['Claude'] },
    );

    expect(obfuscated).toEqual({ system: [{ type: 'image', text: 'Claude' }] });
  });

  it('should leave a text block whose text is not a string untouched', () => {
    const obfuscated = applyClaudePayloadFinalPolicy(
      { system: [{ type: 'text', text: 7 }] },
      { sensitiveWords: ['Claude'] },
    );

    expect(obfuscated).toEqual({ system: [{ type: 'text', text: 7 }] });
  });

  it('should leave a block that is not an object untouched', () => {
    const obfuscated = applyClaudePayloadFinalPolicy(
      { system: ['Claude'] },
      { sensitiveWords: ['Claude'] },
    );

    expect(obfuscated).toEqual({ system: ['Claude'] });
  });
});

describe('Claude payload obfuscation of the messages', () => {
  it('should break up a sensitive word inside whole-string message content', () => {
    const obfuscated = applyClaudePayloadFinalPolicy(
      { messages: [{ role: 'user', content: 'ask Claude' }] },
      { sensitiveWords: ['Claude'] },
    );

    expect(obfuscated).toEqual({
      messages: [{ role: 'user', content: `ask C${zeroWidth}laude` }],
    });
  });

  it('should break up a sensitive word inside each message text block', () => {
    const obfuscated = applyClaudePayloadFinalPolicy(
      { messages: [{ role: 'user', content: [{ type: 'text', text: 'ask Claude' }] }] },
      { sensitiveWords: ['Claude'] },
    );

    expect(obfuscated).toEqual({
      messages: [{ role: 'user', content: [{ type: 'text', text: `ask C${zeroWidth}laude` }] }],
    });
  });

  it('should leave message content that is neither text nor blocks alone', () => {
    const obfuscated = applyClaudePayloadFinalPolicy(
      { messages: [{ role: 'user', content: 7 }] },
      { sensitiveWords: ['Claude'] },
    );

    expect(obfuscated).toEqual({ messages: [{ role: 'user', content: 7 }] });
  });

  it('should leave a message that is not an object alone', () => {
    const obfuscated = applyClaudePayloadFinalPolicy(
      { messages: ['Claude'] },
      { sensitiveWords: ['Claude'] },
    );

    expect(obfuscated).toEqual({ messages: ['Claude'] });
  });

  it('should leave messages that are not a list alone', () => {
    const obfuscated = applyClaudePayloadFinalPolicy(
      { messages: 'Claude' },
      { sensitiveWords: ['Claude'] },
    );

    expect(obfuscated).toEqual({ messages: 'Claude' });
  });
});

describe('Claude payload sensitive word matching', () => {
  it('should ignore a sensitive word shorter than two characters', () => {
    const obfuscated = applyClaudePayloadFinalPolicy(
      { system: 'Claude' },
      { sensitiveWords: ['C'] },
    );

    expect(obfuscated).toEqual({ system: 'Claude' });
  });

  it('should match a sensitive word regardless of case', () => {
    const obfuscated = applyClaudePayloadFinalPolicy(
      { system: 'claude and CLAUDE' },
      { sensitiveWords: ['Claude'] },
    );

    expect(obfuscated).toEqual({ system: `c${zeroWidth}laude and C${zeroWidth}LAUDE` });
  });

  it('should treat regular expression characters in a sensitive word literally', () => {
    const obfuscated = applyClaudePayloadFinalPolicy(
      { system: 'call a.b and axb' },
      { sensitiveWords: ['a.b'] },
    );

    expect(obfuscated).toEqual({ system: `call a${zeroWidth}.b and axb` });
  });

  it('should apply every listed sensitive word in turn', () => {
    const obfuscated = applyClaudePayloadFinalPolicy(
      { system: 'Claude Code' },
      { sensitiveWords: ['Claude', 'Code'] },
    );

    expect(obfuscated).toEqual({ system: `C${zeroWidth}laude C${zeroWidth}ode` });
  });
});
