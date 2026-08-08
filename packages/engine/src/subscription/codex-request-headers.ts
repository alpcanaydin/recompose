import type { ParsedSubscriptionCredential } from './credentials';

export const CODEX_USER_AGENT =
  'codex-tui/0.146.0 (Mac OS 26.5.0; arm64) iTerm.app/3.6.10 (codex-tui; 0.146.0)';
export const CODEX_ORIGINATOR = 'codex-tui';

export function codexRequestHeaders(
  credential: ParsedSubscriptionCredential,
  sessionId: string,
  compact: boolean,
): [string, string][] {
  const headers: [string, string][] = [
    ['Content-Type', 'application/json'],
    ['Authorization', `Bearer ${credential.accessToken}`],
    ['User-Agent', CODEX_USER_AGENT],
    ['Session_id', sessionId],
    ['Accept', compact ? 'application/json' : 'text/event-stream'],
    ['Connection', 'Keep-Alive'],
    ['Originator', CODEX_ORIGINATOR],
  ];

  if (credential.accountId !== undefined) {
    headers.push(['Chatgpt-Account-Id', credential.accountId]);
  }

  return headers;
}
