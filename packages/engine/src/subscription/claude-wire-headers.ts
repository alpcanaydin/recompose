import type { ClaudeDeviceProfile } from './claude-device-profile';

export function claudeWireHeaders(
  accessToken: string,
  sessionId: string,
  requestId: string,
  beta: string,
  profile: ClaudeDeviceProfile,
): [string, string][] {
  return [
    ['Accept', 'application/json'],
    ['Authorization', `Bearer ${accessToken}`],
    ['Content-Type', 'application/json'],
    ['User-Agent', profile.userAgent],
    ['X-Claude-Code-Session-Id', sessionId],
    ['X-Stainless-Arch', profile.arch],
    ['X-Stainless-Lang', 'js'],
    ['X-Stainless-OS', profile.os],
    ['X-Stainless-Package-Version', profile.packageVersion],
    ['X-Stainless-Retry-Count', '0'],
    ['X-Stainless-Runtime', 'node'],
    ['X-Stainless-Runtime-Version', profile.runtimeVersion],
    ['X-Stainless-Timeout', profile.timeout],
    ['anthropic-beta', beta],
    ['anthropic-dangerous-direct-browser-access', 'true'],
    ['anthropic-version', '2023-06-01'],
    ['x-app', 'cli'],
    ['x-client-request-id', requestId],
    ['Connection', 'keep-alive'],
    ['Accept-Encoding', 'gzip, deflate, br, zstd'],
  ];
}
