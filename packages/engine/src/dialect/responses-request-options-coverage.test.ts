import { describe, expect, it } from 'vitest';

import type { HubReasoning, HubRequest } from './hub';
import type { ResponsesRequest } from './responses-wire';

import { decodeRequest, encodeRequest } from './responses-codec';

function hubFrom(reasoning: ResponsesRequest['reasoning']): HubRequest {
  const decoded = decodeRequest({
    input: [{ type: 'message', role: 'user', content: 'hello' }],
    ...(reasoning === undefined ? {} : { reasoning }),
  });

  if ('refusal' in decoded) throw new Error('the Responses request was refused');

  return decoded.value;
}

function wireFrom(reasoning: HubReasoning): ResponsesRequest {
  const hub: HubRequest = {
    messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
    reasoning,
  };

  return encodeRequest(hub).value;
}

describe('a Responses request asking to reason with only part of the settings', () => {
  it('carries a summary that names no effort', () => {
    expect(hubFrom({ summary: 'auto' }).reasoning).toEqual({ summary: 'auto' });
  });

  it('carries an effort that names no summary', () => {
    expect(hubFrom({ effort: 'high' }).reasoning).toEqual({ effort: 'high' });
  });

  it('drops a reasoning block that names nothing at all', () => {
    expect(hubFrom({}).reasoning).toBeUndefined();
  });
});

describe('a hub request that reasons with only part of the settings', () => {
  it('writes a summary without an effort onto the wire', () => {
    expect(wireFrom({ summary: 'auto' }).reasoning).toEqual({ summary: 'auto' });
  });

  it('writes an effort without a summary onto the wire', () => {
    expect(wireFrom({ effort: 'high' }).reasoning).toEqual({ effort: 'high' });
  });
});
