import type { IncomingMessage, Server, ServerResponse } from 'node:http';

import { createServer } from 'node:http';

const MODELS_PATH = '/v1/models';

const ACCEPTED = 200;

const TURNED_AWAY = 401;

const NOTHING_THERE = 404;

/** How the provider answers the next check, which a scenario scripts before it asks for one. */
type ProviderAnswer = 'accepts' | 'turns-away' | 'refuses-the-connection';

/** Stands in for the vendors' own hosts, so a scenario decides what a stored key hears back. */
export type KeyProbeStub = {
  /** The loopback origin the engine child probes in place of the vendors' first-party hosts. */
  origin: string;
  accepts: () => void;
  turnsAway: () => void;
  cannotBeReached: () => void;
  dispose: () => Promise<void>;
};

function answerAsked(
  answer: ProviderAnswer,
  request: IncomingMessage,
  response: ServerResponse,
): void {
  if (answer === 'refuses-the-connection') {
    request.socket.destroy();

    return;
  }

  if (request.url !== MODELS_PATH) {
    response.writeHead(NOTHING_THERE).end();

    return;
  }

  response.writeHead(answer === 'accepts' ? ACCEPTED : TURNED_AWAY, {
    'content-type': 'application/json',
  });
  response.end(JSON.stringify({ data: [] }));
}

async function boundPort(server: Server, host: string): Promise<number> {
  return new Promise<number>((settle, refuse) => {
    server.once('error', refuse);
    server.listen({ host, port: 0 }, () => {
      const bound = server.address();

      if (bound === null || typeof bound === 'string') {
        refuse(new Error('the key probe stub bound no port the scenario could read'));

        return;
      }

      settle(bound.port);
    });
  });
}

/**
 * A stand-in for both vendors' `/v1/models`, bound on loopback so the engine child will use it.
 *
 * @summary The child honors a probe origin only when it names a loopback host, so the stub binds
 * `127.0.0.1` and hands that origin over beside the launcher and keychain overrides. One server
 * answers both vendors, because the two differ by the header they send rather than by the path
 * they ask for, and the answer it gives is whatever the scenario last scripted.
 */
export async function fakeKeyProbe(): Promise<KeyProbeStub> {
  let answer: ProviderAnswer = 'accepts';
  const server = createServer((request, response) => {
    answerAsked(answer, request, response);
  });
  const port = await boundPort(server, '127.0.0.1');

  return {
    origin: `http://127.0.0.1:${String(port)}`,
    accepts: () => {
      answer = 'accepts';
    },
    turnsAway: () => {
      answer = 'turns-away';
    },
    cannotBeReached: () => {
      answer = 'refuses-the-connection';
    },
    dispose: async () =>
      new Promise<void>((settle) => {
        server.closeAllConnections();
        server.close(() => {
          settle();
        });
      }),
  };
}
