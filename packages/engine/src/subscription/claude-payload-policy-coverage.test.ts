import { describe, expect, it } from 'vitest';

import {
  applyClaudePayloadFinalPolicy,
  applyClaudePayloadOverrides,
  payloadSystemPolicy,
} from './claude-payload-policy';

describe('Claude payload policy over the system policy', () => {
  it('should leave the system policy alone when no payload policy is configured', () => {
    expect(payloadSystemPolicy({ validateCallerSystem: true }, undefined)).toEqual({
      validateCallerSystem: true,
    });
  });

  it('should leave the system policy alone when the payload policy is switched off', () => {
    const resolved = payloadSystemPolicy(
      { validateCallerSystem: true },
      {
        mode: 'never',
        strictMode: true,
      },
    );

    expect(resolved).toEqual({ validateCallerSystem: true });
  });

  it('should leave the system policy alone when the payload policy is not strict', () => {
    expect(payloadSystemPolicy(undefined, { mode: 'always' })).toBeUndefined();
  });

  it('should turn on strict mode when the payload policy demands it', () => {
    const resolved = payloadSystemPolicy({ validateCallerSystem: true }, { strictMode: true });

    expect(resolved).toEqual({ validateCallerSystem: true, strictMode: true });
  });
});

describe('Claude payload overrides', () => {
  it('should return the body untouched when no payload policy is configured', () => {
    const body = { model: 'claude-sonnet-4' };

    expect(applyClaudePayloadOverrides(body, undefined)).toBe(body);
  });

  it('should return the body untouched when the payload policy is switched off', () => {
    const body = { model: 'claude-sonnet-4' };

    expect(applyClaudePayloadOverrides(body, { mode: 'never', overrides: [] })).toBe(body);
  });

  it('should write a top-level value the override names', () => {
    const overridden = applyClaudePayloadOverrides(
      { model: 'claude-sonnet-4' },
      { overrides: [{ values: { temperature: 0 } }] },
    );

    expect(overridden).toEqual({ model: 'claude-sonnet-4', temperature: 0 });
  });

  it('should leave the caller body untouched while writing the override', () => {
    const body = { model: 'claude-sonnet-4' };

    applyClaudePayloadOverrides(body, { overrides: [{ values: { temperature: 0 } }] });

    expect(body).toEqual({ model: 'claude-sonnet-4' });
  });
});

describe('Claude payload override paths', () => {
  it('should build the missing branches of a nested override path', () => {
    const overridden = applyClaudePayloadOverrides(
      {},
      { overrides: [{ values: { 'metadata.user.id': 'u1' } }] },
    );

    expect(overridden).toEqual({ metadata: { user: { id: 'u1' } } });
  });

  it('should replace a scalar standing where the override path expects an object', () => {
    const overridden = applyClaudePayloadOverrides(
      { metadata: 'opaque' },
      { overrides: [{ values: { 'metadata.user': 'u1' } }] },
    );

    expect(overridden).toEqual({ metadata: { user: 'u1' } });
  });

  it('should keep the existing branch when the override path already leads to an object', () => {
    const overridden = applyClaudePayloadOverrides(
      { metadata: { keep: true } },
      { overrides: [{ values: { 'metadata.user': 'u1' } }] },
    );

    expect(overridden).toEqual({ metadata: { keep: true, user: 'u1' } });
  });

  it('should ignore an override whose path names nothing', () => {
    expect(applyClaudePayloadOverrides({}, { overrides: [{ values: { '': 1 } }] })).toEqual({});
  });
});

describe('Claude payload override model matching', () => {
  it('should apply an override whose model pattern matches the requested model', () => {
    const overridden = applyClaudePayloadOverrides(
      { model: 'claude-sonnet-4-20250514' },
      { overrides: [{ models: ['claude-sonnet-*'], values: { temperature: 0 } }] },
    );

    expect(overridden).toHaveProperty('temperature', 0);
  });

  it('should skip an override whose model pattern misses the requested model', () => {
    const overridden = applyClaudePayloadOverrides(
      { model: 'claude-opus-4' },
      { overrides: [{ models: ['claude-sonnet-*'], values: { temperature: 0 } }] },
    );

    expect(overridden).not.toHaveProperty('temperature');
  });

  it('should apply an override whose model list is empty to every model', () => {
    const overridden = applyClaudePayloadOverrides(
      { model: 'claude-opus-4' },
      { overrides: [{ models: [], values: { temperature: 0 } }] },
    );

    expect(overridden).toHaveProperty('temperature', 0);
  });

  it('should treat a body without a model name as unmatched by a model pattern', () => {
    const overridden = applyClaudePayloadOverrides(
      { model: 7 },
      { overrides: [{ models: ['claude-*'], values: { temperature: 0 } }] },
    );

    expect(overridden).not.toHaveProperty('temperature');
  });
});

describe('Claude payload filters', () => {
  it('should return the body untouched when no payload policy is configured', () => {
    const body = { metadata: { user_id: 'u1' } };

    expect(applyClaudePayloadFinalPolicy(body, undefined)).toBe(body);
  });

  it('should drop the nested path the filter names', () => {
    const filtered = applyClaudePayloadFinalPolicy(
      { model: 'claude-sonnet-4', metadata: { user_id: 'u1', keep: true } },
      { filters: [{ paths: ['metadata.user_id'] }] },
    );

    expect(filtered).toEqual({ model: 'claude-sonnet-4', metadata: { keep: true } });
  });

  it('should skip a filter whose model pattern misses the requested model', () => {
    const filtered = applyClaudePayloadFinalPolicy(
      { model: 'claude-opus-4', metadata: { user_id: 'u1' } },
      { filters: [{ models: ['claude-sonnet-4'], paths: ['metadata.user_id'] }] },
    );

    expect(filtered).toHaveProperty('metadata.user_id', 'u1');
  });

  it('should leave the body alone when the filter path runs through a scalar', () => {
    const filtered = applyClaudePayloadFinalPolicy(
      { metadata: 'opaque' },
      { filters: [{ paths: ['metadata.user.id'] }] },
    );

    expect(filtered).toEqual({ metadata: 'opaque' });
  });

  it('should ignore a filter whose path names nothing', () => {
    expect(applyClaudePayloadFinalPolicy({ keep: true }, { filters: [{ paths: [''] }] })).toEqual({
      keep: true,
    });
  });

  it('should leave the caller body untouched while filtering', () => {
    const body = { metadata: { user_id: 'u1' } };

    applyClaudePayloadFinalPolicy(body, { filters: [{ paths: ['metadata.user_id'] }] });

    expect(body).toEqual({ metadata: { user_id: 'u1' } });
  });
});
