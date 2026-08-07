import type { Context } from 'hono';

export function requestHeaderMap(c: Context): Record<string, string[]> {
  const headers: Record<string, string[]> = {};

  c.req.raw.headers.forEach((value, name) => {
    headers[name] = [...(headers[name] ?? []), value];
  });

  return headers;
}

export function requestQueryMap(c: Context): Record<string, string[]> {
  const query: Record<string, string[]> = {};

  new URL(c.req.url).searchParams.forEach((value, name) => {
    query[name] = [...(query[name] ?? []), value];
  });

  return query;
}
