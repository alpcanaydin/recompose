import { describe, expect, it } from 'vitest';

import type { RequestOf } from './dispatcher';
import type { GeminiPart, GeminiRequest } from './gemini-wire';
import type { ResponsesReasoningItem } from './responses-wire';

import { sanitizeAntigravityClaudeSignatures } from '../subscription/antigravity-claude-signatures';
import { sanitizeAntigravitySignatures } from '../subscription/antigravity-signatures';
import { translateRequestToGemini } from './gemini-bridge';

describe('Responses Claude reasoning crossing Antigravity', () => {
  it.each([claudeSignature(), Buffer.from(claudeSignature()).toString('base64')])(
    'should normalize a Claude signature to Antigravity double-layer form',
    (signature) => {
      const request = translated(reasoningRequest(signature, 'internal reasoning'));

      expect(thoughtsOf(request)).toEqual([
        {
          text: 'internal reasoning',
          thought: true,
          thoughtSignature: Buffer.from(claudeSignature()).toString('base64'),
        },
      ]);
    },
  );

  it('should drop reasoning carrying an incompatible signature', () => {
    const request = translated({
      input: [
        reasoningItem('gAAAA-openai-signature', 'must not reach Claude'),
        { type: 'message', role: 'assistant', content: 'visible answer' },
        { type: 'message', role: 'user', content: 'continue' },
      ],
    });

    expect(thoughtsOf(request)).toEqual([]);
    expect(request.contents[0]?.parts[0]).toEqual({ text: 'visible answer' });
  });

  it('should drop signed reasoning with empty thinking text', () => {
    expect(thoughtsOf(translated(reasoningRequest(claudeSignature(), '')))).toEqual([]);
  });
});

describe('Responses Claude reasoning placement crossing Antigravity', () => {
  it('should keep the later signature after an empty reasoning boundary', () => {
    const request = translated({
      input: [
        reasoningItem(claudeSignature(), ''),
        { type: 'message', role: 'user', content: 'boundary' },
        reasoningItem(secondClaudeSignature(), 'second reasoning'),
        { type: 'message', role: 'user', content: 'continue' },
      ],
    });

    expect(thoughtsOf(request)).toEqual([
      expect.objectContaining({
        text: 'second reasoning',
        thoughtSignature: Buffer.from(secondClaudeSignature()).toString('base64'),
      }),
    ]);
  });

  it('should keep the later signature when an empty reasoning precedes a function', () => {
    const request = translated({
      input: [
        reasoningItem(claudeSignature(), ''),
        { type: 'function_call', call_id: 'call-1', name: 'run', arguments: '{}' },
        { type: 'function_call_output', call_id: 'call-1', output: 'ok' },
        reasoningItem(secondClaudeSignature(), 'second reasoning'),
        { type: 'message', role: 'user', content: 'continue' },
      ],
    });

    expect(thoughtsOf(request)).toEqual([expect.objectContaining({ text: 'second reasoning' })]);
  });
});

describe('Responses Gemini reasoning crossing Antigravity', () => {
  it('should place the native Gemini signature on the thought part', () => {
    const signature = 'EjQKMgEMOdbHO0Gd+c9Mxk4ELwPGbpCEcp2mFfYYLix2UVtBH3fL8GECc4+JITVnHF4qZDsA';
    const request = translated(
      reasoningRequest(`gemini#${signature}`, 'reasoning summary'),
      'gemini-3-flash-agent',
    );

    expect(thoughtsOf(request)).toEqual([
      { text: 'reasoning summary', thought: true, thoughtSignature: signature },
    ]);
  });
});

function reasoningRequest(signature: string, text: string): RequestOf['responses'] {
  return { input: [reasoningItem(signature, text)] };
}

function reasoningItem(signature: string, text: string): ResponsesReasoningItem {
  const summary: ResponsesReasoningItem['summary'] =
    text === '' ? [] : [{ type: 'summary_text', text }];

  return {
    type: 'reasoning',
    encrypted_content: signature,
    summary,
  };
}

function translated(
  body: RequestOf['responses'],
  model = 'claude-opus-4-6-thinking',
): GeminiRequest {
  const result = translateRequestToGemini('responses', body, undefined, {
    preserveIncompatibleReasoning: true,
  });

  if ('refusal' in result) throw new Error('expected translated request');

  const request = { ...result.value };

  sanitizeAntigravityClaudeSignatures(request, model);
  sanitizeAntigravitySignatures(request, model);

  return request;
}

function thoughtsOf(request: GeminiRequest): GeminiPart[] {
  return request.contents.flatMap((content) =>
    content.parts.filter((part) => part.thought === true),
  );
}

function claudeSignature(): string {
  return strictClaudeSignature(0x0c);
}

function secondClaudeSignature(): string {
  return strictClaudeSignature(0x0d);
}

function strictClaudeSignature(channel: number): string {
  const channelBlock = Buffer.from([0x08, channel, 0x10, 0x02]);
  const container = Buffer.concat([Buffer.from([0x0a, channelBlock.length]), channelBlock]);

  return Buffer.concat([Buffer.from([0x12, container.length]), container]).toString('base64');
}
