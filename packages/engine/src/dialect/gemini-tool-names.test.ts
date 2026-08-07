import { describe, expect, it } from 'vitest';

import type { GeminiResponse } from './gemini-wire';

import {
  translateRequestToGemini,
  translateResponseFromGemini,
  translateStreamFromGemini,
} from './gemini-bridge';
import { geminiToolNameMap } from './gemini-tool-names';

const first = 'mcp__plugin_cloudflare_cloudflare-builds__workers_builds_get_build';
const second = 'mcp__plugin_cloudflare_cloudflare-builds__workers_builds_get_build_logs';

describe('Gemini function-name mapping', () => {
  it('should disambiguate colliding long names independently from declaration order', () => {
    const forward = geminiToolNameMap([first, first, second]);
    const reversed = geminiToolNameMap([second, first]);

    expect(forward.get(first)).toBe(reversed.get(first));
    expect(forward.get(second)).toBe(reversed.get(second));
    expect(forward.get(first)).not.toBe(forward.get(second));
    expect(forward.get(first)?.length).toBeLessThanOrEqual(64);
    expect(forward.get(second)?.length).toBeLessThanOrEqual(64);
  });

  it('should apply one mapping to declarations, calls, results, and tool choice', () => {
    const translated = translateRequestToGemini('interactions', {
      input: [
        { type: 'function_call', name: second, call_id: 'call_1', arguments: {} },
        { type: 'function_result', name: second, call_id: 'call_1', result: {} },
      ],
      tools: [
        { type: 'function', name: first },
        { type: 'function', name: second },
      ],
      generation_config: {
        tool_choice: { type: 'function', function: { name: second } },
      },
    });
    const mapped = geminiToolNameMap([first, second]).get(second);

    expect(translated).toHaveProperty('value.contents.0.parts.0.functionCall.name', mapped);
    expect(translated).toHaveProperty('value.contents.1.parts.0.functionResponse.name', mapped);
    expect(translated).toHaveProperty(
      'value.toolConfig.functionCallingConfig.allowedFunctionNames.0',
      mapped,
    );
    expect(translated).toHaveProperty('value.tools.0.functionDeclarations.1.name', mapped);
  });

  it('should normalize whitespace and invalid characters consistently', () => {
    const translated = translateRequestToGemini('interactions', {
      input: [{ type: 'function_call', name: ' read/file ', arguments: {} }],
      tools: [{ type: 'function', name: ' read/file ' }],
      generation_config: { tool_choice: { type: 'function', name: ' read/file ' } },
    });

    expect(translated).toHaveProperty('value.contents.0.parts.0.functionCall.name', '_read_file_');
    expect(translated).toHaveProperty('value.tools.0.functionDeclarations.0.name', '_read_file_');
    expect(translated).toHaveProperty(
      'value.toolConfig.functionCallingConfig.allowedFunctionNames.0',
      '_read_file_',
    );
  });
});

describe('Gemini function-name restoration', () => {
  it('should restore the original name in a non-stream Interactions response', () => {
    const reverse = capturedReverseNames();
    const mapped = geminiToolNameMap([first, second]).get(second);

    if (mapped === undefined) throw new Error('mapped tool name is missing');

    const translated = translateResponseFromGemini(
      'interactions',
      providerResponse(mapped),
      reverse,
    );

    expect(translated).toHaveProperty('value.steps.0.name', second);
  });

  it('should restore the original name on a streamed tool opening', async () => {
    const reverse = capturedReverseNames();
    const mapped = geminiToolNameMap([first, second]).get(second);

    if (mapped === undefined) throw new Error('mapped tool name is missing');

    const events = [];

    for await (const event of translateStreamFromGemini(
      'interactions',
      responseStream(providerResponse(mapped)),
      reverse,
    )) {
      events.push(event);
    }

    expect(events).toContainEqual({
      event_type: 'step.start',
      index: 0,
      step: {
        type: 'function_call',
        id: 'call_1',
        call_id: 'call_1',
        name: second,
        arguments: {},
      },
    });
  });
});

// Helpers

function capturedReverseNames(): Readonly<Record<string, string>> {
  let captured: Readonly<Record<string, string>> = {};

  translateRequestToGemini(
    'interactions',
    {
      input: 'hi',
      tools: [
        { type: 'function', name: first },
        { type: 'function', name: second },
      ],
    },
    (names) => {
      captured = names;
    },
  );

  return captured;
}

function providerResponse(name: string): GeminiResponse {
  return {
    candidates: [
      {
        content: {
          role: 'model',
          parts: [{ functionCall: { id: 'call_1', name, args: {} } }],
        },
        finishReason: 'STOP',
      },
    ],
  };
}

async function* responseStream(response: GeminiResponse): AsyncIterable<GeminiResponse> {
  await Promise.resolve();
  yield response;
}
