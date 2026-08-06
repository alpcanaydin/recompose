import { describe, expect, test } from 'vitest';

import {
  cleanAntigravityResponseSchema,
  cleanAntigravityToolSchema,
  cleanGeminiToolSchema,
} from './antigravity-schema';

describe('cleaning Antigravity tool schemas', () => {
  test('const becomes a string enum with an allowed-values hint', () => {
    expect(cleanAntigravityToolSchema({ type: 'number', const: 7 })).toMatchObject({
      type: 'string',
      enum: ['7'],
    });
  });

  test('nullable type arrays become optional scalar properties', () => {
    const cleaned = cleanAntigravityToolSchema({
      type: 'object',
      properties: { query: { type: ['string', 'null'] } },
      required: ['query'],
    });

    expect(cleaned).toMatchObject({
      properties: { query: { type: 'string', description: '(nullable)' } },
    });
    expect(cleaned).not.toHaveProperty('required');
  });

  test('unsupported constraints move to description before removal', () => {
    const cleaned = cleanAntigravityToolSchema({
      type: 'string',
      minLength: 3,
      format: 'email',
      default: 'a@example.com',
    });

    expect(cleaned).not.toHaveProperty('minLength');
    expect(cleaned).not.toHaveProperty('format');
    expect(cleaned).not.toHaveProperty('default');
    expect(cleaned['description']).toContain('minLength: 3');
    expect(cleaned['description']).toContain('format: email');
  });
});

describe('flattening Antigravity schema composition', () => {
  test('unions select the richest shape and retain alternative hints', () => {
    const cleaned = cleanAntigravityToolSchema({
      description: 'choice',
      anyOf: [
        { type: 'string' },
        { type: 'object', properties: { value: { type: 'string' } }, required: ['value'] },
      ],
    });

    expect(cleaned).toMatchObject({
      type: 'object',
      properties: { value: { type: 'string' } },
      required: ['value'],
    });
    expect(cleaned['description']).toContain('Accepts: string | object');
  });

  test('allOf merges properties and required fields', () => {
    expect(
      cleanAntigravityToolSchema({
        type: 'object',
        allOf: [
          { properties: { left: { type: 'string' } }, required: ['left'] },
          { properties: { right: { type: 'number' } }, required: ['right'] },
        ],
      }),
    ).toMatchObject({
      properties: { left: { type: 'string' }, right: { type: 'number' } },
      required: ['left', 'right'],
    });
  });
});

describe('repairing Antigravity schema references and requirements', () => {
  test('$ref becomes a lazy description hint', () => {
    expect(
      cleanAntigravityToolSchema({ $ref: '#/$defs/Address', description: 'destination' }),
    ).toEqual({
      type: 'object',
      description: 'destination (See: Address)',
      properties: {
        reason: {
          type: 'string',
          description: 'Brief explanation of why you are calling this tool',
        },
      },
      required: ['reason'],
    });
  });

  test('required names without properties are removed', () => {
    const cleaned = cleanAntigravityToolSchema({
      type: 'object',
      properties: { kept: { type: 'string' } },
      required: ['kept', 'missing'],
    });

    expect(cleaned['required']).toEqual(['kept']);
  });
});

describe('preserving property names while removing unsupported metadata', () => {
  test('property names matching schema keywords stay intact', () => {
    const cleaned = cleanAntigravityToolSchema({
      type: 'object',
      properties: {
        default: { type: 'string', format: 'date-time' },
        properties: { type: 'object', propertyNames: { pattern: '^x' } },
        'x-user-field': { type: 'boolean' },
      },
      required: ['default', 'properties', 'x-user-field'],
    });

    expect(cleaned).toHaveProperty('properties.default');
    expect(cleaned).toHaveProperty('properties.properties');
    expect(cleaned).toHaveProperty('properties.x-user-field');
    expect(cleaned).not.toHaveProperty('properties.properties.propertyNames');
  });

  test('extension fields disappear only when they are schema metadata', () => {
    const cleaned = cleanAntigravityToolSchema({
      type: 'object',
      'x-google-enum-descriptions': ['one'],
      properties: { value: { type: 'string', 'x-extra': true } },
    });

    expect(cleaned).not.toHaveProperty('x-google-enum-descriptions');
    expect(cleaned).not.toHaveProperty('properties.value.x-extra');
  });

  test('empty objects get the VALIDATED-mode reason placeholder', () => {
    expect(cleanAntigravityToolSchema({ type: 'object' })).toMatchObject({
      properties: { reason: { type: 'string' } },
      required: ['reason'],
    });
  });
});

describe('provider-specific schema modes', () => {
  test('response schemas preserve unions and numeric enum type', () => {
    const cleaned = cleanAntigravityResponseSchema({
      type: 'number',
      enum: [1, 2],
      anyOf: [{ type: 'number' }, { type: 'string' }],
    });

    expect(cleaned).toMatchObject({ type: 'number', enum: ['1', '2'] });
    expect(Array.isArray(cleaned['anyOf'])).toBe(true);
    expect(cleaned).not.toHaveProperty('properties.reason');
  });

  test('public Gemini tool schemas remove title and nullable metadata', () => {
    expect(cleanGeminiToolSchema({ type: 'string', title: 'Query', nullable: true })).toEqual({
      type: 'string',
    });
  });

  test('public Gemini schemas remove executor placeholders', () => {
    expect(
      cleanGeminiToolSchema({
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: 'Brief explanation of why you are calling this tool',
          },
        },
        required: ['reason'],
      }),
    ).toEqual({ type: 'object', properties: {} });
  });

  test('response union branches are cleaned without flattening the union', () => {
    const cleaned = cleanAntigravityResponseSchema({
      anyOf: [
        { type: 'string', format: 'email' },
        { type: 'number', default: 3 },
      ],
    });

    expect(cleaned).toHaveProperty('anyOf.0.description', 'format: email');
    expect(cleaned).not.toHaveProperty('anyOf.0.format');
    expect(cleaned).not.toHaveProperty('anyOf.1.default');
  });
});
