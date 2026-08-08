import { describe, expect, it } from 'vitest';

import {
  addAntigravityPlaceholder,
  removeGeminiPlaceholders,
} from './antigravity-schema-placeholders';

const DESCRIPTION = 'Brief explanation of why you are calling this tool';

describe('removing the placeholders Antigravity added to a tool schema', () => {
  it('should keep the other required names when the underscore leaves', () => {
    const schema = {
      type: 'object',
      properties: { _: { type: 'boolean' }, command: { type: 'string' } },
      required: ['_', 'command'],
    };

    removeGeminiPlaceholders(schema);

    expect(schema).toEqual({
      type: 'object',
      properties: { command: { type: 'string' } },
      required: ['command'],
    });
  });

  it('should remove the underscore from a schema that requires nothing', () => {
    const schema = { type: 'object', properties: { _: { type: 'boolean' } } };

    removeGeminiPlaceholders(schema);

    expect(schema).toEqual({ type: 'object', properties: {} });
  });

  it('should remove a lone placeholder reason together with its requirement', () => {
    const schema = {
      type: 'object',
      properties: { reason: { type: 'string', description: DESCRIPTION } },
      required: ['reason'],
    };

    removeGeminiPlaceholders(schema);

    expect(schema).toEqual({ type: 'object', properties: {} });
  });
});

describe('adding the placeholder Antigravity needs on a nested schema', () => {
  it('should leave a nested schema that already requires a field', () => {
    const schema = {
      type: 'object',
      properties: { command: { type: 'string' } },
      required: ['command'],
    };

    addAntigravityPlaceholder(schema, false);

    expect(schema).toEqual({
      type: 'object',
      properties: { command: { type: 'string' } },
      required: ['command'],
    });
  });

  it('should require an underscore on a nested schema that requires nothing', () => {
    const schema = { type: 'object', properties: { command: { type: 'string' } } };

    addAntigravityPlaceholder(schema, false);

    expect(schema).toEqual({
      type: 'object',
      properties: { command: { type: 'string' }, _: { type: 'boolean' } },
      required: ['_'],
    });
  });
});
