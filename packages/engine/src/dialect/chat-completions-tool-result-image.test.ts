import { describe, expect, it } from 'vitest';

import type { HubMessage } from './hub';

import { encodeRequest } from './chat-completions-codec';
import { aHubImageBlock, aHubRequest, aHubTextBlock, aHubToolResultBlock } from './hub.testkit';

describe('encodeRequest records the image a Chat Completions tool message cannot carry', () => {
  it('keeps only the tool result text and names the dropped image with a cost-bearing fate', () => {
    const user: HubMessage = {
      role: 'user',
      content: [
        aHubToolResultBlock({
          toolUseId: 'call_chart',
          content: [aHubTextBlock({ text: 'the chart shows growth' }), aHubImageBlock()],
        }),
      ],
    };

    const { value, fates } = encodeRequest(aHubRequest({ messages: [user] }));

    const tool = value.messages.find((message) => message.role === 'tool');

    expect(tool?.content).toBe('the chart shows growth');
    expect(JSON.stringify(value)).not.toContain('aGVsbG8=');
    expect(fates).toContainEqual({
      field: 'tool_result_image',
      disposition: 'mapped',
      to: 'absent',
      costBearing: true,
    });
  });

  it('records no image drop when the tool result carries only text', () => {
    const user: HubMessage = {
      role: 'user',
      content: [aHubToolResultBlock({ content: [aHubTextBlock({ text: 'sunny, 21C' })] })],
    };

    const { fates } = encodeRequest(aHubRequest({ messages: [user] }));

    expect(fates).not.toContainEqual(expect.objectContaining({ field: 'tool_result_image' }));
  });
});
