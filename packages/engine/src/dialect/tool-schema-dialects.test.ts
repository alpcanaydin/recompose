import { describe, expect, it } from 'vitest';

import type { TranslateResult } from './fates';
import type { HubRequest } from './hub';

import {
  decodeRequest as decodeAnthropic,
  encodeRequest as encodeAnthropic,
} from './anthropic-codec';
import { decodeRequest as decodeChat, encodeRequest as encodeChat } from './chat-completions-codec';
import { encodeRequest as encodeGemini } from './gemini-request';
import { aHubRequest, aHubTool } from './hub.testkit';
import {
  decodeRequest as decodeInteractions,
  encodeRequest as encodeInteractions,
} from './interactions-codec';
import {
  decodeRequest as decodeResponses,
  encodeRequest as encodeResponses,
} from './responses-codec';

function valueOf<T>(result: TranslateResult<T, unknown>): T {
  if ('refusal' in result) throw new Error(`request refused: ${JSON.stringify(result.refusal)}`);

  return result.value;
}

function canonicalSchema() {
  return {
    type: 'object' as const,
    properties: { value: { $ref: '#/$defs/value' } },
    additionalProperties: false,
    $defs: { value: { oneOf: [{ type: 'string' }, { type: 'number' }] } },
  };
}

function uncleanSchema() {
  return {
    ...canonicalSchema(),
    $schema: 'http://json-schema.org/draft-07/schema#',
    additionalProperties: true,
  };
}

function hubWith(schema: ReturnType<typeof canonicalSchema>): HubRequest {
  return aHubRequest({ tools: [aHubTool({ inputSchema: schema })] });
}

describe('Anthropic tool schemas', () => {
  it('should preserve extended fields while decoding', () => {
    const value = valueOf(
      decodeAnthropic({
        max_tokens: 64,
        messages: [{ role: 'user', content: 'hi' }],
        tools: [{ name: 'lookup', input_schema: canonicalSchema() }],
      }),
    );

    expect(value.tools?.[0]?.inputSchema).toMatchObject(canonicalSchema());
  });

  it('should preserve extended fields while encoding', () => {
    const value = valueOf(encodeAnthropic(hubWith(canonicalSchema())));

    expect(value.tools?.[0]?.input_schema).toMatchObject(canonicalSchema());
  });
});

describe('Chat Completions tool schemas', () => {
  it('should preserve extended fields while decoding', () => {
    const value = valueOf(
      decodeChat({
        messages: [{ role: 'user', content: 'hi' }],
        tools: [{ type: 'function', function: { name: 'lookup', parameters: canonicalSchema() } }],
      }),
    );

    expect(value.tools?.[0]?.inputSchema).toMatchObject(canonicalSchema());
  });

  it('should preserve extended fields while encoding', () => {
    const value = valueOf(encodeChat(hubWith(canonicalSchema())));

    const tool = value.tools?.find((candidate) => candidate.type === 'function');

    expect(tool?.function.parameters).toMatchObject(canonicalSchema());
  });
});

describe('Responses tool schemas', () => {
  it('should preserve canonical fields while decoding', () => {
    const value = valueOf(
      decodeResponses({
        input: [{ type: 'message', role: 'user', content: 'hi' }],
        tools: [{ type: 'function', name: 'lookup', parameters: canonicalSchema() }],
      }),
    );

    expect(value.tools?.[0]?.inputSchema).toMatchObject(canonicalSchema());
  });

  it('should clean strict fields without dropping definitions while encoding', () => {
    const value = valueOf(encodeResponses(hubWith(uncleanSchema())));

    expect(value.tools?.[0]).toHaveProperty('parameters.additionalProperties', false);
    expect(value.tools?.[0]).toHaveProperty('parameters.$defs', canonicalSchema().$defs);
    expect(value.tools?.[0]).not.toHaveProperty('parameters.$schema');
  });
});

describe('Interactions tool schemas', () => {
  it('should preserve canonical fields while decoding', () => {
    const value = decodeInteractions({
      input: 'hi',
      tools: [{ type: 'function', name: 'lookup', parameters: canonicalSchema() }],
    }).value;

    expect(value.tools?.[0]?.inputSchema).toMatchObject(canonicalSchema());
  });

  it('should clean strict fields without dropping definitions while encoding', () => {
    const value = encodeInteractions(hubWith(uncleanSchema())).value;

    expect(value.tools?.[0]).toHaveProperty('parameters.additionalProperties', false);
    expect(value.tools?.[0]).toHaveProperty('parameters.$defs', canonicalSchema().$defs);
    expect(value.tools?.[0]).not.toHaveProperty('parameters.$schema');
  });
});

describe('Gemini tool schemas', () => {
  it('should clean strict fields without dropping definitions while encoding', () => {
    const value = encodeGemini(hubWith(uncleanSchema())).value;
    const declaration = value.tools?.[0]?.functionDeclarations[0];

    expect(declaration).toHaveProperty('parameters.additionalProperties', false);
    expect(declaration).toHaveProperty('parameters.$defs', canonicalSchema().$defs);
    expect(declaration).not.toHaveProperty('parameters.$schema');
  });
});
