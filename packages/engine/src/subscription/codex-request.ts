import type { ProviderRequest } from './claude-request';
import type { ParsedSubscriptionCredential } from './credentials';

type JsonObject = Record<string, unknown>;

const REMOVED_FIELDS = [
  'previous_response_id',
  'generate',
  'prompt_cache_retention',
  'safety_identifier',
  'stream_options',
] as const;

export function codexProviderRequest(
  providerOrigin: string,
  rawBody: JsonObject,
  credential: ParsedSubscriptionCredential,
  sessionId: string,
): ProviderRequest {
  const body: JsonObject = { ...rawBody, stream: true };

  for (const field of REMOVED_FIELDS) {
    delete body[field];
  }

  body['instructions'] ??= '';

  const headers: [string, string][] = [
    ['Content-Type', 'application/json'],
    ['Authorization', `Bearer ${credential.accessToken}`],
    [
      'User-Agent',
      'codex-tui/0.146.0 (Mac OS 26.5.0; arm64) iTerm.app/3.6.10 (codex-tui; 0.146.0)',
    ],
    ['Session_id', sessionId],
    ['Accept', 'text/event-stream'],
    ['Connection', 'Keep-Alive'],
    ['Originator', 'codex-tui'],
  ];

  if (credential.accountId !== undefined) {
    headers.push(['Chatgpt-Account-Id', credential.accountId]);
  }

  return {
    url: `${providerOrigin.replace(/\/+$/u, '')}/responses`,
    headers,
    body: JSON.stringify(body),
  };
}
