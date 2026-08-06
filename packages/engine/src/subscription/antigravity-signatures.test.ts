import { describe, expect, test } from 'vitest';

import { normalizeAntigravityFunctionHistory } from './antigravity-function-history';
import { sanitizeAntigravitySignatures } from './antigravity-signatures';

function nativeSignature(payload = Buffer.from([0x01, 0x0c, 0x39])): string {
  const inner = Buffer.concat([Buffer.from([0x0a, payload.length]), payload]);

  return Buffer.concat([Buffer.from([0x12, inner.length]), inner]).toString('base64');
}

function modelParts(...parts: Record<string, unknown>[]) {
  return { contents: [{ role: 'model', parts }] };
}

describe('sanitizing Antigravity Gemini thought signatures', () => {
  test('preserves a native field-two signature on the first function call', () => {
    const signature = nativeSignature();
    const request = modelParts({
      functionCall: { name: 'first', args: {} },
      thoughtSignature: signature,
    });

    sanitizeAntigravitySignatures(request, 'gemini-3.5-flash');

    expect(request).toHaveProperty('contents.0.parts.0.thoughtSignature', signature);
  });

  test('adds the bypass only to the first synthetic parallel function call', () => {
    const request = modelParts(
      { functionCall: { name: 'first', args: {} } },
      { functionCall: { name: 'second', args: {} } },
    );

    sanitizeAntigravitySignatures(request, 'gemini-3.5-flash');

    expect(request).toHaveProperty(
      'contents.0.parts.0.thoughtSignature',
      'skip_thought_signature_validator',
    );
    expect(request).not.toHaveProperty('contents.0.parts.1.thoughtSignature');
  });

  test('removes polluted bypass signatures from parallel siblings', () => {
    const signature = nativeSignature();
    const request = modelParts(
      { functionCall: { name: 'first', args: {} }, thoughtSignature: signature },
      {
        functionCall: { name: 'second', args: {} },
        thought_signature: 'google#skip_thought_signature_validator',
      },
    );

    sanitizeAntigravitySignatures(request, 'agent-model');

    expect(request).not.toHaveProperty('contents.0.parts.1.thoughtSignature');
    expect(request).not.toHaveProperty('contents.0.parts.1.thought_signature');
  });
});

describe('validating Antigravity Gemini thought signature envelopes', () => {
  test('replaces a bare base64 UUID signature with the bypass sentinel', () => {
    const uuid = Buffer.from('e24830a7-5cd6-42fe-998b-ee539e72b9c3').toString('base64');
    const request = modelParts({
      functionCall: { name: 'first', args: {}, thoughtSignature: uuid },
    });

    sanitizeAntigravitySignatures(request, 'gemini-3-pro');

    expect(request).toHaveProperty(
      'contents.0.parts.0.thoughtSignature',
      'skip_thought_signature_validator',
    );
    expect(request).not.toHaveProperty('contents.0.parts.0.functionCall.thoughtSignature');
  });

  test('preserves a field-two wrapped UUID signature', () => {
    const signature = nativeSignature(Buffer.from('e24830a7-5cd6-42fe-998b-ee539e72b9c3'));
    const request = modelParts({ functionCall: { name: 'first' }, thought_signature: signature });

    sanitizeAntigravitySignatures(request, 'flash-agent');

    expect(request).toHaveProperty('contents.0.parts.0.thoughtSignature', signature);
    expect(request).not.toHaveProperty('contents.0.parts.0.thought_signature');
  });

  test('leaves unsigned thought parts unsigned', () => {
    const request = modelParts({ text: 'hidden', thought: true });

    sanitizeAntigravitySignatures(request, 'gemini-3-pro');

    expect(request).toEqual(modelParts({ text: 'hidden', thought: true }));
  });

  test('removes top-level and nested signatures from function responses', () => {
    const request = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              thoughtSignature: 'bad',
              functionResponse: { name: 'first', response: {}, thought_signature: 'worse' },
            },
          ],
        },
      ],
    };

    sanitizeAntigravitySignatures(request, 'gemini-3-pro');

    expect(request).not.toHaveProperty('contents.0.parts.0.thoughtSignature');
    expect(request).not.toHaveProperty('contents.0.parts.0.functionResponse.thought_signature');
  });
});

describe('scoping Antigravity Gemini thought signature policy', () => {
  test('does not apply Gemini signature policy to Claude models', () => {
    const request = modelParts({ functionCall: { name: 'first' } });

    sanitizeAntigravitySignatures(request, 'claude-sonnet-thinking');

    expect(request).not.toHaveProperty('contents.0.parts.0.thoughtSignature');
  });
});

describe('normalizing Antigravity function response history', () => {
  test('repairs names, orders parallel responses, and changes their role to model', () => {
    const request = {
      contents: [
        {
          role: 'model',
          parts: [
            { functionCall: { id: 'one', name: 'first' } },
            { functionCall: { id: 'two', name: 'second' } },
          ],
        },
        {
          role: 'user',
          parts: [
            { functionResponse: { id: 'two', name: 'second', response: { value: 2 } } },
            { functionResponse: { id: 'one', name: 'unknown', response: { value: 1 } } },
          ],
        },
      ],
    };

    normalizeAntigravityFunctionHistory(request);

    expect(request).toHaveProperty('contents.1.role', 'model');
    expect(request).toHaveProperty('contents.1.parts.0.functionResponse.id', 'one');
    expect(request).toHaveProperty('contents.1.parts.0.functionResponse.name', 'first');
    expect(request).toHaveProperty('contents.1.parts.1.functionResponse.id', 'two');
  });
});

describe('preserving Antigravity function-response boundaries', () => {
  test('does not order responses across an empty content boundary', () => {
    const request = {
      contents: [
        { role: 'model', parts: [{ functionCall: { id: 'one', name: 'first' } }] },
        { role: 'user', parts: [] },
        {
          role: 'user',
          parts: [{ functionResponse: { id: 'one', name: 'first', response: {} } }],
        },
      ],
    };

    normalizeAntigravityFunctionHistory(request);

    expect(request).toHaveProperty('contents.2.role', 'model');
    expect(request).toHaveProperty('contents.2.parts.0.functionResponse.id', 'one');
  });

  test('leaves mixed response content ordering intact', () => {
    const request = {
      contents: [
        {
          role: 'user',
          parts: [
            { functionResponse: { id: 'one', name: 'first', response: {} } },
            { text: 'keep me' },
          ],
        },
      ],
    };

    normalizeAntigravityFunctionHistory(request);

    expect(request).toHaveProperty('contents.0.role', 'user');
    expect(request).toHaveProperty('contents.0.parts.1.text', 'keep me');
  });
});
