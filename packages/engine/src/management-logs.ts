import type { Context, Hono } from 'hono';

import type { LogRead, ProviderLogStore } from './provider/provider-log-store';

type LogOptions = { limit: number; after: number; cursor?: string };
type LogOptionsResult = { options: LogOptions } | { error: string };

function positiveInteger(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return 0;

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function nonNegativeInteger(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return 0;

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function logResponse(read: LogRead) {
  return {
    lines: read.lines,
    'line-count': read.lineCount,
    'latest-timestamp': read.latestTimestamp,
    'next-cursor': read.nextCursor,
    'cursor-reset': read.cursorReset,
  };
}

function logOptions(c: Context): LogOptionsResult {
  const limit = positiveInteger(c.req.query('limit'));
  const after = nonNegativeInteger(c.req.query('after'));
  const cursor = c.req.query('cursor');

  if (limit === null) return { error: 'invalid limit' };
  if (after === null) return { error: 'invalid after' };

  return { options: { limit, after, ...(cursor === undefined ? {} : { cursor }) } };
}

async function getLogs(c: Context, store: ProviderLogStore | null): Promise<Response> {
  if (store === null) return c.json({ error: 'logging to file disabled' }, 400);

  const parsed = logOptions(c);

  if ('error' in parsed) return c.json({ error: parsed.error }, 400);

  try {
    const read = await store.read(parsed.options);

    return c.json(logResponse(read));
  } catch (failure) {
    return c.json(
      { error: failure instanceof Error ? failure.message : 'failed to read logs' },
      500,
    );
  }
}

async function deleteLogs(c: Context, store: ProviderLogStore | null): Promise<Response> {
  if (store === null) return c.json({ error: 'logging to file disabled' }, 400);

  await store.clear();

  return c.json({ success: true });
}

export function registerManagementLogs(app: Hono, store: ProviderLogStore | null): void {
  app.get('/v0/management/logs', async (c) => getLogs(c, store));
  app.delete('/v0/management/logs', async (c) => deleteLogs(c, store));
}
