import { describe, expect, it } from 'vitest';

import { decodeRequest } from './chat-completions-request';
import { aChatRequest, aChatTool } from './chat-completions.testkit';

function fatesOf(request: Parameters<typeof decodeRequest>[0]) {
  const result = decodeRequest(request);

  if ('refusal' in result) {
    throw new Error(`expected a translation, met a refusal: ${JSON.stringify(result.refusal)}`);
  }

  return result;
}

describe('decodeRequest records the exact fate for every field it routes', () => {
  it('names each sampling and envelope field with its precise destination', () => {
    const { fates } = fatesOf(
      aChatRequest({
        max_tokens: 512,
        temperature: 1.7,
        top_p: 0.9,
        stop: ['a'],
        seed: 3,
        tool_choice: 'auto',
        tools: [aChatTool()],
      }),
    );

    expect(fates).toContainEqual({ field: 'model', disposition: 'carried' });
    expect(fates).toContainEqual({ field: 'messages', disposition: 'mapped', to: 'messages' });
    expect(fates).toContainEqual({ field: 'tools', disposition: 'carried' });
    expect(fates).toContainEqual({ field: 'tool_choice', disposition: 'mapped', to: 'toolChoice' });
    expect(fates).toContainEqual({
      field: 'max_tokens',
      disposition: 'mapped',
      to: 'sampling.maxOutputTokens',
    });
    expect(fates).toContainEqual({
      field: 'temperature',
      disposition: 'mapped',
      to: 'sampling.temperature (clamped)',
    });
    expect(fates).toContainEqual({ field: 'top_p', disposition: 'mapped', to: 'sampling.topP' });
    expect(fates).toContainEqual({ field: 'stop', disposition: 'mapped', to: 'sampling.stop' });
  });

  it('names the injected default, the unclamped temperature, and the completion ceiling exactly', () => {
    expect(fatesOf(aChatRequest()).fates).toContainEqual({
      field: 'max_tokens',
      disposition: 'mapped',
      to: 'sampling.maxOutputTokens (default)',
    });
    expect(fatesOf(aChatRequest({ temperature: 0.4 })).fates).toContainEqual({
      field: 'temperature',
      disposition: 'mapped',
      to: 'sampling.temperature',
    });

    const completion = fatesOf(aChatRequest({ max_completion_tokens: 200 }));

    expect(completion.value.sampling?.maxOutputTokens).toBe(200);
    expect(completion.fates).toContainEqual({
      field: 'max_completion_tokens',
      disposition: 'mapped',
      to: 'sampling.maxOutputTokens',
    });
  });
});

describe('decodeRequest flags each vendor drop by its cost', () => {
  it('flags a cost-bearing vendor drop as cost-bearing and a plain one as free', () => {
    expect(fatesOf(aChatRequest({ audio: { voice: 'x' } })).fates).toContainEqual({
      field: 'audio',
      disposition: 'mapped',
      to: 'absent',
      costBearing: true,
    });
    expect(fatesOf(aChatRequest({ seed: 1 })).fates).toContainEqual({
      field: 'seed',
      disposition: 'mapped',
      to: 'absent',
    });
  });
});
