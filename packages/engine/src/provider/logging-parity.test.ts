import { mkdir, stat, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from 'vitest';

import type { ProviderObservation } from './provider-observability';

import { isAIAPIPath, requestIdForAIPath } from '../gateway-ai-path';
import { CPA_TRACE_HEADER, CPATraceCommit, formatCPATraceID } from '../gateway-trace';
import { enforceProviderLogDirectoryLimit } from './provider-log-cleaner';
import { providerLogLine } from './provider-log-record';

test('TestEnforceLogDirSizeLimitDeletesOldest', async () => {
  const directory = await temporaryDirectory();
  const old = join(directory, 'old.log');
  const middle = join(directory, 'middle.log');
  const active = join(directory, 'main.log');

  await logFile(old, 60, 1);
  await logFile(middle, 60, 2);
  await logFile(active, 60, 3);

  expect(await enforceProviderLogDirectoryLimit(directory, 120, [active])).toBe(1);
  await expect(stat(old)).rejects.toHaveProperty('code', 'ENOENT');
  await expect(stat(middle)).resolves.toBeDefined();
  await expect(stat(active)).resolves.toBeDefined();
});

test('TestEnforceLogDirSizeLimitSkipsProtected', async () => {
  const directory = await temporaryDirectory();
  const protectedPath = join(directory, 'main.log');
  const other = join(directory, 'other.log');

  await logFile(protectedPath, 200, 1);
  await logFile(other, 50, 2);

  expect(await enforceProviderLogDirectoryLimit(directory, 100, [protectedPath])).toBe(1);
  await expect(stat(protectedPath)).resolves.toBeDefined();
  await expect(stat(other)).rejects.toHaveProperty('code', 'ENOENT');
});

test('TestFormatCPATraceID', () => {
  expect(formatCPATraceID(new Date('2026-07-17T21:58:49Z'), 'auth-index', 'request1')).toBe(
    '20260717215849-auth-index-request1',
  );
  expect(formatCPATraceID(new Date(Number.NaN), 'auth', 'request')).toBe('');
  expect(formatCPATraceID(new Date(), '', 'request')).toBe('');
});

test('TestCPATraceIDMiddlewareRequiresAuthIndexBeforeResponseCommit', () => {
  const selected = new CPATraceCommit('1234abcd');
  const headers = new Headers();

  selected.select('auth-index', new Date('2026-07-17T21:58:49Z'));
  selected.commit(headers);
  expect(headers.get(CPA_TRACE_HEADER)).toBe('20260717215849-auth-index-1234abcd');

  const committed = new CPATraceCommit('1234abcd');
  const committedHeaders = new Headers();

  committed.commit(committedHeaders);
  committed.select('auth-index');
  expect(committedHeaders.get(CPA_TRACE_HEADER)).toBeNull();
});

test('TestCPATraceIDConcurrentSelectionAndResponseCommit', async () => {
  const trace = new CPATraceCommit('request');
  const headers = new Headers();

  await Promise.all([
    Promise.resolve().then(() => {
      trace.select('auth', new Date('2026-07-17T21:58:49Z'));
    }),
    Promise.resolve().then(() => {
      trace.commit(headers);
    }),
  ]);
  trace.commit(headers);

  const value = headers.get(CPA_TRACE_HEADER);

  expect(value === null || value.endsWith('-auth-request')).toBe(true);
});

test('TestLogFormatterPrintsVersionField', () => {
  expect(providerLogLine(observation({ version: '2.1.0' }))).toContain('"version":"2.1.0"');
});

test('TestLogFormatterPrintsRequestIDHashesWithoutSensitiveRequestMaterial', () => {
  const line = providerLogLine(
    observation({
      requestIdHash: `sha256:${'1'.repeat(64)}`,
      upstreamRequestIdHash: `sha256:${'2'.repeat(64)}`,
    }),
  );

  expect(line).toContain(`"request_id_hash":"sha256:${'1'.repeat(64)}"`);
  expect(line).toContain(`"upstream_request_id_hash":"sha256:${'2'.repeat(64)}"`);
  expect(line).not.toContain('authorization');
  expect(line).not.toContain('body');
});

test('TestLogFormatterPrintsMediaForwardingFields', () => {
  const line = providerLogLine(
    observation({
      media: {
        connection: 'via socks5 proxy',
        proxyScheme: 'socks5',
        remoteTransport: 'tcp',
        sessionId: 'media-session-id',
        callId: 'call-id',
        peer: 'remote',
        state: 'connected',
      },
    }),
  );

  expect(line).toContain('"proxy_scheme":"socks5"');
  expect(line).toContain('"media_session_id":"media-session-id"');
  expect(line).not.toContain('credential');
  expect(line.split('\n')).toHaveLength(2);
});

test('TestLogFormatterOmitsGenericPathField', () => {
  const line = providerLogLine(observation({}));

  expect(line).not.toContain('"path"');
  expect(line).not.toContain('active_path');
  expect(line).not.toContain('retired_path');
});

test('TestIsAIAPIPathIncludesPublicAPIGroups', () => {
  expect(['/v1', '/v1/models', '/v1/alpha/search', '/v1beta/interactions']).toSatisfy(
    (paths: string[]) => paths.every(isAIAPIPath),
  );
  expect(isAIAPIPath('/v0/management/config')).toBe(false);
});

test('TestIsAIAPIPathIncludesImages', () => {
  expect(isAIAPIPath('/v1/images/generations')).toBe(true);
  expect(isAIAPIPath('/openai/v1/videos/video_123/content')).toBe(true);
});

test('TestIsAIAPIPathIncludesCodexBackend', () => {
  expect(isAIAPIPath('/backend-api/codex/responses')).toBe(true);
  expect(isAIAPIPath('/backend-api/codex-status')).toBe(false);
});

test('TestGinLogrusLoggerAddsRequestIDForCodexBackend', () => {
  const id = requestIdForAIPath('/backend-api/codex/responses');

  expect(id).toBeTruthy();
  expect(requestIdForAIPath('/backend-api/codex/responses', id)).toBe(id);
});

async function temporaryDirectory(): Promise<string> {
  const directory = join('/private/tmp', `recompose-log-${crypto.randomUUID()}`);

  await mkdir(directory, { recursive: true });

  return directory;
}

async function logFile(path: string, size: number, seconds: number): Promise<void> {
  await writeFile(path, Buffer.alloc(size));
  await utimes(path, seconds, seconds);
}

function observation(overrides: Partial<ProviderObservation>): ProviderObservation {
  return {
    provider: 'codex',
    model: 'gpt-5.4',
    dialect: 'responses',
    method: 'POST',
    startedAt: 0,
    durationMs: 1,
    ttftMs: 1,
    status: 200,
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
    },
    generate: true,
    ...overrides,
  };
}
