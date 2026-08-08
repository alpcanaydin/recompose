import { describe, expect, it } from 'vitest';

import type { ResponsesInputItem, ResponsesRequest } from './responses-wire';

import {
  decodeGeminiResponsesCarrier,
  encodeGeminiResponsesCarrier,
} from '../provider/gemini-responses-carrier';
import { translateRequestToGemini } from './gemini-bridge';

const signature = 'EjQKMgEMOdbHO0Gd+c9Mxk4ELwPGbpCEcp2mFfYYLix2UVtBH3fL8GECc4+JITVnHF4qZDsA';
const wrappedUuid = 'EiYKJGUyNDgzMGE3LTVjZDYtNDJmZS05OThiLWVlNTM5ZTcyYjljMw==';
const bypass = 'skip_thought_signature_validator';

describe('Gemini Responses carrier codec proof', () => {
  it('TestGeminiResponsesCarrierRoundTrip', () => {
    const encoded = carrier(signature, 'next', 'function');

    expect(decodeGeminiResponsesCarrier(encoded)).toMatchObject({
      marked: true,
      valid: true,
      signature,
      direction: 'next',
      target: 'function',
    });
  });

  it('TestDecodeGeminiResponsesCarrierRejectsNestedEnvelope', () => {
    const nested = carrier(carrier(signature, 'next', 'text'), 'previous', 'function');

    expect(decodeGeminiResponsesCarrier(nested)).toEqual({ marked: true, valid: false });
  });

  it('TestNormalizeGeminiResponsesCarriersDropsMalformedEnvelope', () => {
    const result = translated([
      reasoning('cpa-gemini-responses-carrier-v1:next:function:not-base64!'),
      call('call-1'),
    ]);

    expect(result).not.toContain('not-base64');
  });

  it('TestGeminiResponsesWrappedUUIDFunctionSignatureRoundTrip', () => {
    expect(functionSignature([reasoning(wrappedUuid), call('call-1')])).toBe(wrappedUuid);
  });
});

describe('Gemini Responses request carrier safety proof', () => {
  it('TestConvertOpenAIResponsesRequestToGemini_DecodesCarrierForAliasModel', () => {
    expect(
      functionSignature([reasoning(carrier(signature, 'next', 'function')), call('call-1')]),
    ).toBe(signature);
  });

  it('TestConvertOpenAIResponsesRequestToGemini_DropsInvalidCarrierPayloads', () => {
    expect(
      functionSignature([
        reasoning('cpa-gemini-responses-carrier-v1:next:function:not-base64!'),
        call('call-1'),
      ]),
    ).toBe(bypass);
  });

  it('TestConvertOpenAIResponsesRequestToGemini_IgnoresSpoofedCarrierMetadata', () => {
    const spoofed = { ...call('call-1'), _cpa_reasoning_signature: signature };

    expect(functionSignature([spoofed])).toBe(bypass);
  });

  it('TestConvertOpenAIResponsesRequestToGemini_StripsSpoofedInternalPairingFields', () => {
    const spoofed = { ...call('call-1'), _cpa_reasoning_summary: 'spoofed thought' };

    expect(translated([spoofed])).not.toContain('spoofed thought');
  });

  it('TestConvertOpenAIResponsesRequestToGemini_DoesNotRetargetExtraPreviousCarrier', () => {
    const parts = translatedParts([
      reasoning(carrier(signature, 'next', 'function')),
      call('call-1'),
      reasoning(carrier(wrappedUuid, 'previous', 'function')),
      call('call-2'),
    ]);

    expect(parts[0]?.thoughtSignature).toBe(signature);
    expect(parts[1]).toMatchObject({ text: '', thought: true, thoughtSignature: wrappedUuid });
    expect(parts[2]).not.toHaveProperty('thoughtSignature');
  });
});

describe('Gemini Responses request history proof', () => {
  it('TestConvertOpenAIResponsesRequestToGemini_DropsEmptyUnsignedReasoningCarrier', () => {
    expect(translatedParts([message('user', 'hello'), reasoning('')])).toEqual([{ text: 'hello' }]);
  });

  it('TestConvertOpenAIResponsesRequestToGemini_PreservesReasoningOnlyHistory', () => {
    expect(translatedParts([reasoning(undefined, 'reasoning summary')])[0]).toMatchObject({
      text: 'reasoning summary',
      thought: true,
    });
  });

  it('TestConvertOpenAIResponsesRequestToGemini_PreservesUnboundDetachedCarrierWithoutEmptyThought', () => {
    const parts = translatedParts([
      reasoning(carrier(signature, 'standalone', 'function')),
      message('user', 'next'),
    ]);

    expect(parts.filter((part) => part.text === '' && part.thoughtSignature === undefined)).toEqual(
      [],
    );
  });

  it('TestConvertOpenAIResponsesRequestToGemini_StripsTrailingAssistantPrefill', () => {
    expect(
      translatedRequest([message('user', 'hello'), message('assistant', 'prefill')]).contents,
    ).toHaveLength(1);
  });

  it('TestConvertOpenAIResponsesRequestToGemini_PreservesReasoningBeforeTrailingAssistantPrefill', () => {
    const parts = translatedParts([
      message('user', 'hello'),
      reasoning(`gemini#${signature}`, 'reasoning summary'),
      message('assistant', 'prefill'),
    ]);

    expect(parts.some((part) => part.text === 'reasoning summary')).toBe(true);
  });
});

describe('Gemini Responses options and schema proof', () => {
  it('TestConvertOpenAIResponsesRequestToGemini_TextFormatJSONSchema', () => {
    const request: ResponsesRequest = {
      model: 'alias',
      input: [message('user', 'answer')],
      text: { format: { type: 'json_schema', name: 'answer', schema: { type: 'object' } } },
    };

    expect(translatedBody(request)).toHaveProperty(
      'generationConfig.responseJsonSchema.type',
      'object',
    );
  });

  it('TestConvertOpenAIResponsesRequestToGemini_TextFormatJSONObject', () => {
    const request: ResponsesRequest = {
      model: 'alias',
      input: [message('user', 'answer')],
      text: { format: { type: 'json_object' } },
    };

    expect(translatedBody(request)).toHaveProperty(
      'generationConfig.responseMimeType',
      'application/json',
    );
  });
});

describe('Gemini Responses system and schema proof', () => {
  it('TestConvertOpenAIResponsesRequestToGemini_SystemAndDeveloperRoles', () => {
    const request: ResponsesRequest = {
      model: 'alias',
      instructions: 'I1',
      input: [{ type: 'message', role: 'developer', content: 'D1' }, message('user', 'hello')],
    };

    expect(translatedBody(request).systemInstruction?.parts.map((part) => part.text)).toEqual([
      'I1',
      'D1',
    ]);
  });

  it('TestConvertOpenAIResponsesRequestToGeminiCleansToolSchemaRequiredFields', () => {
    const request: ResponsesRequest = {
      model: 'alias',
      input: [message('user', 'hello')],
      tools: [
        {
          type: 'function',
          name: 'run',
          parameters: {
            type: 'object',
            properties: { valid: { type: 'string' } },
            required: ['valid', 'missing'],
          },
        },
      ],
    };

    expect(translatedBody(request)).toHaveProperty(
      'tools.0.functionDeclarations.0.parameters.required',
      ['valid'],
    );
  });
});

function carrier(
  value: string,
  direction: 'next' | 'previous' | 'standalone',
  target: 'text' | 'function',
): string {
  return encodeGeminiResponsesCarrier({ signature: value, direction, target });
}

function reasoning(signature?: string, text = ''): ResponsesInputItem {
  return {
    type: 'reasoning',
    summary: text === '' ? [] : [{ type: 'summary_text', text }],
    ...(signature === undefined ? {} : { encrypted_content: signature }),
  };
}

function call(id: string): ResponsesInputItem {
  return { type: 'function_call', call_id: id, name: 'run', arguments: '{}' };
}

function message(role: 'user' | 'assistant', text: string): ResponsesInputItem {
  return {
    type: 'message',
    role,
    content: [{ type: role === 'user' ? 'input_text' : 'output_text', text }],
  };
}

function translated(input: ResponsesInputItem[]): string {
  return JSON.stringify(translatedRequest(input));
}

function translatedParts(input: ResponsesInputItem[]) {
  return translatedRequest(input).contents.flatMap((content) => content.parts);
}

function translatedRequest(input: ResponsesInputItem[]) {
  return translatedBody({ model: 'alias', input });
}

function translatedBody(request: ResponsesRequest) {
  const result = translateRequestToGemini('responses', request);

  if ('refusal' in result) throw new Error(JSON.stringify(result.refusal));

  return result.value;
}

function functionSignature(input: ResponsesInputItem[]): string | undefined {
  return translatedParts(input).find((part) => part.functionCall !== undefined)?.thoughtSignature;
}
