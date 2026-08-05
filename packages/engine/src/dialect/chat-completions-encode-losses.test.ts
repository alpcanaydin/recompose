import { describe, expect, it } from 'vitest';

import type { HubMessage } from './hub';

import { encodeRequest } from './chat-completions-request';
import { aHubRequest, aHubTextBlock, aHubToolResultBlock } from './hub.testkit';

describe('encodeRequest keeps a user turn that mixes a tool result with text', () => {
  it('emits both a tool message and a user message, losing neither block', () => {
    const user: HubMessage = {
      role: 'user',
      content: [aHubToolResultBlock({ toolUseId: 'call_r' }), aHubTextBlock({ text: 'and retry' })],
    };

    const { value } = encodeRequest(aHubRequest({ messages: [user] }));

    expect(value.messages.find((message) => message.role === 'tool')).toMatchObject({
      tool_call_id: 'call_r',
    });
    expect(value.messages.find((message) => message.role === 'user')).toMatchObject({
      content: 'and retry',
    });
  });
});

describe('encodeRequest names a dropped system cache breakpoint', () => {
  it('records a cost-bearing fate when an earlier system text carried a breakpoint', () => {
    const hub = aHubRequest({
      system: [{ text: 'first', cacheBreakpoint: { type: 'ephemeral' } }, { text: 'second' }],
    });

    const { fates } = encodeRequest(hub);

    expect(fates).toContainEqual({
      field: 'system[cacheBreakpoint]',
      disposition: 'mapped',
      to: 'absent',
      costBearing: true,
    });
  });
});
