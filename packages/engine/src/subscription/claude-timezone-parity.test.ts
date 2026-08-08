import { describe, expect, it } from 'vitest';

import { parsedJson } from '../gateway-wire';
import { claudeProviderRequest } from './claude-request';
import { claudeLocalDate, resolvedClaudeTimezone } from './claude-timezone';
import { parseSubscriptionCredential } from './credentials';

describe('Claude Code native local date parity', () => {
  it('TestClaudeCodeLocalDateMatchesNativeLocalCalendarAlgorithm', () => {
    const instant = Date.UTC(2026, 6, 31, 15, 30);

    expect(claudeLocalDate(instant, 'Pacific/Kiritimati')).toBe('2026-08-01');
    expect(claudeLocalDate(instant, 'Etc/GMT+12')).toBe('2026-07-31');
    expect(currentDate(instant, 'Pacific/Kiritimati')).toContain("Today's date is 2026-08-01.");
  });
});

describe('Claude Code timezone precedence parity', () => {
  it('TestClaudeCodeTimezoneUsesCredentialThenConfiguredProfile', () => {
    const instant = Date.UTC(2026, 7, 2, 1, 30);

    expect(resolvedClaudeTimezone('Pacific/Honolulu', 'Asia/Tokyo')).toBe('Pacific/Honolulu');
    expect(claudeLocalDate(instant, resolvedClaudeTimezone('Pacific/Honolulu', 'Asia/Tokyo'))).toBe(
      '2026-08-01',
    );
    expect(resolvedClaudeTimezone('not/a-timezone', 'Asia/Tokyo')).toBe('Asia/Tokyo');
    expect(resolvedClaudeTimezone(undefined, 'not/a-timezone')).toBeUndefined();
  });

  it('should read credential timezone and apply it at the request seam', () => {
    const credential = parseSubscriptionCredential(
      'anthropic',
      JSON.stringify({
        timezone: 'Pacific/Honolulu',
        claudeAiOauth: { accessToken: 'token' },
      }),
    );

    expect(credential?.timezone).toBe('Pacific/Honolulu');
    expect(currentDate(Date.UTC(2026, 7, 2, 1, 30), credential?.timezone)).toContain(
      "Today's date is 2026-08-01.",
    );
  });
});

function currentDate(now: number, timezone: string | undefined): string {
  const request = claudeProviderRequest(
    'https://api.anthropic.com',
    { model: 'claude-opus-5', messages: [{ role: 'user', content: 'hello' }] },
    'token',
    { sessionId: 'session', requestId: 'request' },
    undefined,
    now,
    'messages',
    timezone,
  );

  return JSON.stringify(parsedJson(request.body));
}
