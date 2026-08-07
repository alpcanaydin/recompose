import { describe, expect, it } from 'vitest';

import { decodeRequest as decodeInteractions } from './interactions-request';
import { encodeRequest as encodeInteractions } from './interactions-request-encode';
import { decodeRequest as decodeResponses } from './responses-request';
import { encodeRequest as encodeResponses } from './responses-request-encode';
import { aResponsesRequest, expectTranslation } from './responses.testkit';

describe('Interactions request options crossing Responses', () => {
  it('should preserve previous interaction, reasoning, modalities, format, and service tier', () => {
    const decoded = decodeInteractions({
      model: 'gpt-test',
      input: 'hi',
      previous_interaction_id: 'interaction_123',
      generation_config: {
        thinking_level: 'high',
        thinking_summaries: 'auto',
      },
      response_modalities: ['text', 'image'],
      response_format: { type: 'json_schema' },
      service_tier: 'priority',
    });
    const encoded = encodeResponses(decoded.value).value;

    expect(encoded).toMatchObject({
      previous_response_id: 'interaction_123',
      reasoning: { effort: 'high', summary: 'auto' },
      modalities: ['text', 'image'],
      text: { format: { type: 'json_schema' } },
      service_tier: 'priority',
    });
  });
});

describe('Responses request options crossing Interactions', () => {
  it('should preserve Responses controls when crossing into Interactions', () => {
    const decoded = expectTranslation(
      decodeResponses(
        aResponsesRequest({
          previous_response_id: 'resp_123',
          reasoning: { effort: 'medium', summary: 'detailed' },
          modalities: ['text'],
          text: { format: { type: 'json_object' } },
          service_tier: 'priority',
        }),
      ),
    );
    const encoded = encodeInteractions(decoded.value).value;

    expect(encoded).toMatchObject({
      previous_interaction_id: 'resp_123',
      generation_config: { thinking_level: 'medium', thinking_summaries: 'detailed' },
      response_modalities: ['text'],
      response_format: { type: 'json_object' },
      service_tier: 'priority',
    });
  });
});

describe('Interactions-only request options', () => {
  it('should retain an Interactions thinking budget on an Interactions round trip', () => {
    const decoded = decodeInteractions({
      input: 'hi',
      generation_config: { thinking_budget: 1024 },
    });

    expect(encodeInteractions(decoded.value).value).toHaveProperty(
      'generation_config.thinking_budget',
      1024,
    );
  });
});
