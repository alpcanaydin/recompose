import { describe, expect, it } from 'vitest';

import type { JsonObject } from '../gateway-wire';

import { normalizeAntigravityTools } from './antigravity-tools';

describe('Antigravity tool declarations', () => {
  it('should leave a request that declares no tools untouched', () => {
    const request: JsonObject = { model: 'gemini-3-pro', tools: 'none' };

    normalizeAntigravityTools(request);

    expect(request['tools']).toBe('none');
  });

  it('should drop a tool entry that is not a declaration object', () => {
    const request: JsonObject = { tools: ['loose text', 7, null] };

    normalizeAntigravityTools(request);

    expect(request['tools']).toEqual([]);
  });

  it('should pass a Google search tool through untouched', () => {
    const search = { googleSearch: {} };
    const request: JsonObject = { tools: [search] };

    normalizeAntigravityTools(request);

    expect(request['tools']).toEqual([search]);
  });

  it('should drop a function tool that declares nothing callable', () => {
    const request: JsonObject = {
      tools: [{ functionDeclarations: [] }, { retrieval: {} }, { functionDeclarations: 'later' }],
    };

    normalizeAntigravityTools(request);

    expect(request['tools']).toEqual([]);
  });
});

describe('Antigravity tool naming', () => {
  it('should keep the snake case spelling a caller uses for declarations', () => {
    const request: JsonObject = { tools: [{ function_declarations: [{ name: 'read_file' }] }] };

    normalizeAntigravityTools(request);

    expect(request['tools']).toEqual([{ function_declarations: [{ name: 'read_file' }] }]);
  });

  it('should drop a declaration that is not an object or names nothing', () => {
    const request: JsonObject = {
      tools: [{ functionDeclarations: ['read_file', { description: 'no name' }, 42] }],
    };

    normalizeAntigravityTools(request);

    expect(request['tools']).toEqual([]);
  });

  it('should keep only the first declaration of a repeated tool name', () => {
    const request: JsonObject = {
      tools: [
        { functionDeclarations: [{ name: 'read_file', description: 'first' }] },
        { functionDeclarations: [{ name: 'read_file', description: 'second' }] },
      ],
    };

    normalizeAntigravityTools(request);

    expect(request['tools']).toEqual([
      { functionDeclarations: [{ name: 'read_file', description: 'first' }] },
    ]);
  });
});

describe('Antigravity tool name spelling', () => {
  it('should spell a declaration name that arrives as a number or a flag', () => {
    const request: JsonObject = {
      tools: [{ functionDeclarations: [{ name: 7 }, { name: true }, { name: 9n }] }],
    };

    normalizeAntigravityTools(request);

    expect(request['tools']).toEqual([
      { functionDeclarations: [{ name: '7' }, { name: 'true' }, { name: '9' }] },
    ]);
  });

  it('should spell a structured declaration name as its own JSON text', () => {
    const request: JsonObject = {
      tools: [{ functionDeclarations: [{ name: { tool: 'read_file' } }, { name: ['a'] }] }],
    };

    normalizeAntigravityTools(request);

    expect(request['tools']).toEqual([
      { functionDeclarations: [{ name: '{"tool":"read_file"}' }, { name: '["a"]' }] },
    ]);
  });
});
