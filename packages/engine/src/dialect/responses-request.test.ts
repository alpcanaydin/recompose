import { describe, expect, it } from 'vitest';

import { accountForEveryKey } from './fates';
import { decodeRequest } from './responses-codec';
import {
  aCodexRequestWithTools,
  aResponsesFunctionCall,
  aResponsesFunctionCallOutput,
  aResponsesReasoningItem,
  aResponsesRequest,
  aResponsesTool,
  aResponsesUserMessage,
  expectRefusal,
  expectTranslation,
  fateFor,
  thinkingOf,
  toolResultsOf,
  toolUsesOf,
} from './responses.testkit';

describe('decodeRequest: a Codex request folds into the Anthropic hub', () => {
  it('keeps the instructions, the tools, and the input crossing to the hub', () => {
    const { value } = expectTranslation(decodeRequest(aCodexRequestWithTools()));

    expect(value.system).toEqual([{ text: 'You answer concisely.' }]);
    expect(value.tools?.[0]?.name).toBe('get_weather');
    expect(value.messages[0]?.role).toBe('user');
  });

  it('carries the tool choice into the hub tool-choice shape', () => {
    const request = aCodexRequestWithTools({
      tool_choice: { type: 'function', name: 'get_weather' },
    });

    const { value } = expectTranslation(decodeRequest(request));

    expect(value.toolChoice).toEqual({ type: 'tool', name: 'get_weather' });
  });

  it('carries temperature and the output-token ceiling into hub sampling', () => {
    const request = aCodexRequestWithTools({
      temperature: 0.4,
      max_output_tokens: 512,
      top_p: 0.9,
    });

    const { value } = expectTranslation(decodeRequest(request));

    expect(value.sampling).toEqual({ maxOutputTokens: 512, temperature: 0.4, topP: 0.9 });
  });

  it('leaves nothing the source carried without a named fate', () => {
    const request = aCodexRequestWithTools({ temperature: 0.4, max_output_tokens: 512 });

    const { fates } = expectTranslation(decodeRequest(request));

    expect(accountForEveryKey(Object.keys(request), fates)).toEqual([]);
  });

  it('traces a vendor-ignored field as a mapped-to-absent fate', () => {
    const request = aResponsesRequest({ prompt_cache_key: 'session-7' });

    const { fates } = expectTranslation(decodeRequest(request));

    expect(fateFor(fates, 'prompt_cache_key')).toEqual({
      field: 'prompt_cache_key',
      disposition: 'mapped',
      to: 'absent',
      costBearing: true,
    });
  });
});

describe('decodeRequest: an assistant turn crosses to a hub assistant message', () => {
  it('carries an assistant text message item into a hub assistant message', () => {
    const request = aResponsesRequest({
      input: [
        { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Sure.' }] },
      ],
    });

    const { value } = expectTranslation(decodeRequest(request));

    expect(value.messages[0]?.role).toBe('assistant');
    expect(value.messages[0]?.content[0]).toEqual({ type: 'text', text: 'Sure.' });
  });
});

describe('decodeRequest: the tool choice crosses each way', () => {
  it('carries an auto-none-required choice into the hub shape', () => {
    const none = expectTranslation(decodeRequest(aCodexRequestWithTools({ tool_choice: 'none' })));
    const required = expectTranslation(
      decodeRequest(aCodexRequestWithTools({ tool_choice: 'required' })),
    );

    expect(none.value.toolChoice).toEqual({ type: 'none' });
    expect(required.value.toolChoice).toEqual({ type: 'required' });
  });
});

describe('decodeRequest: message content crosses in every shape', () => {
  it('reads a bare string message content as a single text block', () => {
    const request = aResponsesRequest({
      input: [{ type: 'message', role: 'user', content: 'plain question' }],
    });

    const { value } = expectTranslation(decodeRequest(request));

    expect(value.messages[0]?.content[0]).toEqual({ type: 'text', text: 'plain question' });
  });

  it('reads an input image part as a hub image block sourced by url', () => {
    const request = aResponsesRequest({
      input: [
        {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_image', image_url: 'https://example.test/cat.png' }],
        },
      ],
    });

    const { value } = expectTranslation(decodeRequest(request));

    expect(value.messages[0]?.content[0]).toEqual({
      type: 'image',
      source: { type: 'url', url: 'https://example.test/cat.png' },
    });
  });
});

describe('decodeRequest: the tool schema normalizes for a strict target', () => {
  it('normalizes a bare object schema to an explicit empty properties object', () => {
    const bareTool = aResponsesTool({ parameters: { type: 'object' } });

    const { value } = expectTranslation(decodeRequest(aResponsesRequest({ tools: [bareTool] })));

    expect(value.tools?.[0]?.inputSchema).toEqual({ type: 'object', properties: {} });
  });
});

describe('decodeRequest: the server-state handle has no honest hub slot', () => {
  it('refuses typed when the request leans on a prior-response handle, naming the field', () => {
    const refusal = expectRefusal(
      decodeRequest(aResponsesRequest({ previous_response_id: 'resp_prior' })),
    );

    expect(refusal).toEqual({ reason: 'unsupported-field', field: 'previous_response_id' });
  });
});

describe('decodeRequest: a reasoning item passes through as a thinking block', () => {
  it('decodes a reasoning item into a thinking block without fabricating a signature', () => {
    const { value } = expectTranslation(
      decodeRequest(aResponsesRequest({ input: [aResponsesReasoningItem()] })),
    );

    const [thinking] = thinkingOf(value.messages);

    expect(thinking?.text).toBe('weigh the two routes before answering');
    expect(thinking?.signature).toBeUndefined();
  });

  it('traces an encrypted reasoning payload with a mapped fate rather than refusing it', () => {
    const request = aResponsesRequest({
      input: [aResponsesReasoningItem({ encrypted_content: 'ZW5jcnlwdGVk' })],
    });

    const { fates } = expectTranslation(decodeRequest(request));

    expect(fateFor(fates, 'encrypted_content')).toEqual({
      field: 'encrypted_content',
      disposition: 'mapped',
      to: 'absent',
    });
  });
});

describe('decodeRequest: a loose tool history reaches a strict target', () => {
  it('repairs a dangling tool call by dropping it and naming the repair as a fate', () => {
    const request = aResponsesRequest({
      input: [aResponsesUserMessage(), aResponsesFunctionCall({ call_id: 'call_dangling' })],
    });

    const { value, fates } = expectTranslation(decodeRequest(request));

    expect(toolUsesOf(value.messages)).toHaveLength(0);
    expect(fateFor(fates, 'call_dangling')).toEqual({
      field: 'call_dangling',
      disposition: 'mapped',
      to: 'absent',
    });
  });

  it('normalizes tool-call arguments that are not a json object to an empty input', () => {
    const request = aResponsesRequest({
      input: [
        aResponsesFunctionCall({ arguments: '["not","an","object"]' }),
        aResponsesFunctionCallOutput(),
      ],
    });

    const { value } = expectTranslation(decodeRequest(request));

    expect(toolUsesOf(value.messages)[0]?.input).toEqual({});
  });

  it('keeps a tool call that a tool result answers, pairing them across hub messages', () => {
    const request = aResponsesRequest({
      input: [aResponsesUserMessage(), aResponsesFunctionCall(), aResponsesFunctionCallOutput()],
    });

    const { value } = expectTranslation(decodeRequest(request));

    expect(toolUsesOf(value.messages)[0]?.id).toBe('call_weather');
    expect(toolResultsOf(value.messages)[0]?.toolUseId).toBe('call_weather');
  });

  it('refuses typed when a tool result answers a call that was never made', () => {
    const request = aResponsesRequest({
      input: [aResponsesFunctionCallOutput({ call_id: 'call_ghost' })],
    });

    const refusal = expectRefusal(decodeRequest(request));

    expect(refusal).toEqual({ reason: 'unrepairable-tool-call', unmatchedId: 'call_ghost' });
  });
});
