import { describe, expect, it } from 'vitest';

import { decodeRequest } from './responses-request';
import { encodeRequest } from './responses-request-encode';
import { aResponsesRequest, expectTranslation } from './responses.testkit';

describe('Responses request options crossing the hub', () => {
  it('should carry server-state and generation controls in both directions', () => {
    const decoded = expectTranslation(
      decodeRequest(
        aResponsesRequest({
          previous_response_id: 'resp_prior',
          reasoning: { effort: 'high', summary: 'auto' },
          modalities: ['text', 'image'],
          response_format: { type: 'json_schema' },
          service_tier: 'priority',
          parallel_tool_calls: false,
        }),
      ),
    );
    const encoded = encodeRequest(decoded.value).value;

    expect(decoded.value).toMatchObject({
      previousResponseId: 'resp_prior',
      reasoning: { effort: 'high', summary: 'auto' },
      responseModalities: ['text', 'image'],
      responseFormat: { type: 'json_schema' },
      serviceTier: 'priority',
      parallelToolCalls: false,
    });
    expect(encoded).toMatchObject({
      previous_response_id: 'resp_prior',
      reasoning: { effort: 'high', summary: 'auto' },
      modalities: ['text', 'image'],
      text: { format: { type: 'json_schema' } },
      service_tier: 'priority',
      parallel_tool_calls: false,
    });
  });
});
