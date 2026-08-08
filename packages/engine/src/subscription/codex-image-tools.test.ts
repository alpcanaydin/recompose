import { describe, expect, test } from 'vitest';

import type { JsonObject } from '../gateway-wire';

import { isJsonObject, parsedJson } from '../gateway-wire';
import { codexProviderRequest } from './codex-request';

function prepared(body: JsonObject, planType?: string): JsonObject {
  const request = codexProviderRequest(
    'https://chatgpt.com/backend-api/codex',
    body,
    { accessToken: 'access-token', ...(planType === undefined ? {} : { planType }) },
    'session-1',
  );
  const value = parsedJson(request.body);

  return isJsonObject(value) ? value : {};
}

function toolsOf(body: JsonObject): unknown[] | undefined {
  const tools = body['tools'];

  return Array.isArray(tools) ? tools : undefined;
}

describe('Codex built-in image generation', () => {
  test.each([
    [{ model: 'gpt-5.4', input: 'draw a cat' }, ['image_generation']],
    [
      { model: 'gpt-5.4', tools: [{ type: 'function', name: 'weather' }] },
      ['function', 'image_generation'],
    ],
    [{ model: 'gpt-5.4', tools: [] }, ['image_generation']],
    [
      { model: 'gpt-5.4', tools: [{ type: 'web_search_preview' }] },
      ['web_search', 'image_generation'],
    ],
    [
      {
        model: 'gpt-5.4',
        tools: [{ type: 'namespace', name: 'image_tools', tools: [] }],
      },
      ['namespace', 'image_generation'],
    ],
  ] as const)('injects the PNG tool when available', (body, types) => {
    const tools = toolsOf(prepared(body));

    expect(tools?.map((tool) => (isJsonObject(tool) ? tool['type'] : undefined))).toEqual(types);
    expect(tools?.at(-1)).toMatchObject({ type: 'image_generation', output_format: 'png' });
  });

  test.each([
    {
      model: 'gpt-5.4',
      tools: [{ type: 'image_generation', output_format: 'webp' }],
    },
    {
      model: 'gpt-5.4',
      tools: [{ type: 'function', name: 'image_gen.imagegen' }],
    },
    {
      model: 'gpt-5.4',
      tools: [
        {
          type: 'namespace',
          name: 'image_gen',
          tools: [{ type: 'function', name: 'imagegen' }],
        },
      ],
    },
  ])('does not duplicate an existing image capability', (body) => {
    expect(toolsOf(prepared(body))).toHaveLength(1);
  });
});

describe('Codex image generation exclusions', () => {
  test.each([
    [
      'responses-lite string metadata',
      {
        model: 'gpt-5.6-sol',
        client_metadata: {
          ws_request_header_x_openai_internal_codex_responses_lite: ' true ',
        },
      },
      undefined,
    ],
    [
      'responses-lite boolean metadata',
      {
        model: 'gpt-5.6-sol',
        client_metadata: { ws_request_header_x_openai_internal_codex_responses_lite: true },
      },
      undefined,
    ],
    ['Spark model', { model: 'gpt-5.3-codex-spark' }, undefined],
    ['free plan', { model: 'gpt-5.4' }, ' FREE '],
  ] as const)('does not inject for %s', (_name, body, planType) => {
    expect(toolsOf(prepared(body, planType))).toBeUndefined();
  });

  test.each([true, ' true '])('Responses Lite marker %j disables parallel tools', (marker) => {
    const body = prepared({
      model: 'gpt-5.6-sol',
      client_metadata: { ws_request_header_x_openai_internal_codex_responses_lite: marker },
    });

    expect(body['parallel_tool_calls']).toBe(false);
  });

  test('a false responses-lite marker still injects the tool', () => {
    const body = prepared({
      model: 'gpt-5.6-sol',
      client_metadata: { ws_request_header_x_openai_internal_codex_responses_lite: 'false' },
    });

    expect(toolsOf(body)).toEqual([{ type: 'image_generation', output_format: 'png' }]);
  });
});
