import { describe, expect, it } from 'vitest';

import { encodeRequest as encodeAnthropic } from './anthropic-request-encode';
import { decodeRequest, decodeRequestWithCompat } from './responses-request';
import { aResponsesRequest, aResponsesUserMessage, expectTranslation } from './responses.testkit';

describe('Responses reasoning content crossing Claude', () => {
  it('should use reasoning content when summary is absent and prefer summary when present', () => {
    const contentOnly = expectTranslation(
      decodeRequest(
        aResponsesRequest({
          input: [
            {
              type: 'reasoning',
              encrypted_content: 'anthropic:sig_1',
              summary: [],
              content: [{ type: 'reasoning_text', text: 'from content' }],
            },
          ],
        }),
      ),
    );
    const summary = expectTranslation(
      decodeRequest(
        aResponsesRequest({
          input: [
            {
              type: 'reasoning',
              encrypted_content: 'anthropic:sig_1',
              summary: [{ type: 'summary_text', text: 'from summary' }],
              content: [{ type: 'reasoning_text', text: 'from content' }],
            },
          ],
        }),
      ),
    );

    expect(encodeAnthropic(contentOnly.value).value.messages).toHaveProperty(
      '0.content.0.thinking',
      'from content',
    );
    expect(encodeAnthropic(summary.value).value.messages).toHaveProperty(
      '0.content.0.thinking',
      'from summary',
    );
  });
});

describe('Responses redacted reasoning crossing Claude', () => {
  it('should restore and strip a Claude redacted-thinking marker', () => {
    const decoded = expectTranslation(
      decodeRequest(
        aResponsesRequest({
          input: [
            {
              type: 'reasoning',
              encrypted_content: 'claude-redacted-thinking:EroBCkYIBRgCKkA',
              summary: [],
            },
            aResponsesUserMessage('continue'),
          ],
        }),
      ),
    );

    expect(encodeAnthropic(decoded.value).value.messages).toHaveProperty('0.content.0', {
      type: 'redacted_thinking',
      data: 'EroBCkYIBRgCKkA',
    });
  });
});

describe('Responses empty and opaque reasoning crossing Claude compat', () => {
  it('should drop empty encrypted reasoning by default and preserve it in compat mode', () => {
    const request = aResponsesRequest({
      input: [
        {
          type: 'reasoning',
          summary: [{ type: 'summary_text', text: 'reason' }],
          encrypted_content: '',
        },
        aResponsesUserMessage('continue'),
      ],
    });
    const normal = expectTranslation(decodeRequest(request));
    const compat = expectTranslation(decodeRequestWithCompat(request));

    expect(normal.value.messages).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'continue' }] },
    ]);
    expect(encodeAnthropic(compat.value).value.messages).toHaveProperty('0.content.0', {
      type: 'thinking',
      thinking: 'reason',
      signature: '',
    });
  });

  it('should preserve an opaque signature only in compat mode', () => {
    const request = aResponsesRequest({
      input: [
        {
          type: 'reasoning',
          summary: [{ type: 'summary_text', text: 'reason' }],
          encrypted_content: 'opaque-deepseek-id',
        },
      ],
    });
    const compat = expectTranslation(decodeRequestWithCompat(request));

    expect(encodeAnthropic(compat.value).value.messages).toHaveProperty('0.content.0', {
      type: 'thinking',
      thinking: 'reason',
      signature: 'opaque-deepseek-id',
    });
  });
});
