import { expect, test } from 'vitest';

import { isJsonObject, parsedJson } from '../gateway-wire';
import { claudeProviderRequest } from './claude-request';

const ids = { sessionId: 'session-1', requestId: 'request-1' };

function sentBody(origin: string) {
  const request = claudeProviderRequest(
    origin,
    { model: 'claude-opus-5', messages: [{ role: 'user', content: 'hello' }] },
    'access-token',
    ids,
  );
  const parsed = parsedJson(request.body);

  return isJsonObject(parsed) ? parsed : {};
}

test.each([
  'https://api.anthropic.com',
  'https://API.Anthropic.com',
  'https://api.anthropic.com:443',
])('keeps Anthropic context management on %s', (origin) => {
  expect(sentBody(origin)).toHaveProperty('context_management');
});

test.each([
  'https://api.anthropic.com:8443',
  'https://user@api.anthropic.com',
  'https://api.kimi.com',
  'http://api.anthropic.com',
  'https://api.anthropic.com.evil',
  'https://gateway.example.com',
  '',
])('never leaks Anthropic context management to %s', (origin) => {
  expect(sentBody(origin)).not.toHaveProperty('context_management');
});
