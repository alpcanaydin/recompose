import { describe, expect, it } from 'vitest';

import { hubToolSchemaFrom, strictProviderToolSchema } from './tool-schema';

describe('strictProviderToolSchema', () => {
  it('should preserve an already canonical Codex schema without copying it', () => {
    const schema = {
      type: 'object' as const,
      properties: { value: { type: 'string' } },
      additionalProperties: false,
    };

    const cleaned = strictProviderToolSchema(schema);

    expect(cleaned).toBe(schema);
  });

  it('should remove the schema declaration and close additional properties', () => {
    const cleaned = strictProviderToolSchema({
      type: 'object',
      properties: {},
      $schema: 'http://json-schema.org/draft-07/schema#',
      additionalProperties: true,
      $defs: { value: { enum: ['a', 'b'] } },
    });

    expect(cleaned).toEqual({
      type: 'object',
      properties: {},
      additionalProperties: false,
      $defs: { value: { enum: ['a', 'b'] } },
    });
  });
});

describe('hubToolSchemaFrom', () => {
  it('should preserve canonical JSON Schema metadata and nested unions', () => {
    const schema = hubToolSchemaFrom({
      type: 'object',
      properties: { value: { oneOf: [{ type: 'string' }, { type: 'number' }] } },
      required: ['value'],
      additionalProperties: false,
      $defs: { identifier: { type: 'string', enum: ['primary', 'secondary'] } },
    });

    expect(schema).toEqual({
      type: 'object',
      properties: { value: { oneOf: [{ type: 'string' }, { type: 'number' }] } },
      required: ['value'],
      additionalProperties: false,
      $defs: { identifier: { type: 'string', enum: ['primary', 'secondary'] } },
    });
  });

  it('should normalize invalid core fields without dropping other metadata', () => {
    const schema = hubToolSchemaFrom({
      type: 'STRING',
      properties: null,
      required: ['valid', 3],
      description: 'arguments',
    });

    expect(schema).toEqual({
      type: 'object',
      properties: {},
      required: ['valid'],
      description: 'arguments',
    });
  });
});
