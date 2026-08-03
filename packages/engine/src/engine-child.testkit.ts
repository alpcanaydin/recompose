import { expect, vi } from 'vitest';

import type { OpenListeners } from './engine-runtime';
import type { ParentPort } from './parent-port';

export type Parent = {
  reports: unknown[];
  send: (directive: unknown) => void;
  port: ParentPort;
};

export function aParent(): Parent {
  const reports: unknown[] = [];
  const handlers: ((messageEvent: { data: unknown }) => void)[] = [];

  return {
    reports,
    send: (directive) => {
      for (const handler of handlers) {
        handler({ data: directive });
      }
    },
    port: {
      postMessage: (message) => {
        reports.push(message);
      },
      on: (event: string, handler: (messageEvent: { data: unknown }) => void) => {
        if (event === 'message') {
          handlers.push(handler);
        }
      },
    },
  };
}

export function aLoopbackHolding(heldPorts: readonly number[]): OpenListeners {
  return async (_app, port) =>
    Promise.resolve(
      heldPorts.includes(port)
        ? { failed: { port } }
        : { opened: { close: async () => Promise.resolve() } },
    );
}

export async function reportsReach(parent: Parent, count: number): Promise<void> {
  await vi.waitFor(() => {
    expect(parent.reports).toHaveLength(count);
  });
}

function urlOf(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') {
    return input;
  }

  return input instanceof URL ? input.href : input.url;
}

export function fetchAnswering(status: number): { urls: string[]; fetchLike: typeof fetch } {
  const urls: string[] = [];

  const fetchLike: typeof fetch = async (input) => {
    urls.push(urlOf(input));

    return Promise.resolve(new Response(null, { status }));
  };

  return { urls, fetchLike };
}
