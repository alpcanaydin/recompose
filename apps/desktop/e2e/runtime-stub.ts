import type { IncomingMessage, Server, ServerResponse } from 'node:http';

import { createServer } from 'node:http';

import { bindToAFreePort } from './loopback-ports';

const VERSION_PATH = '/api/version';

const ACCEPTED = 200;

const NOTHING_THERE = 404;

const LOOPBACK_HOST = '127.0.0.1';

/** The version a runtime reports where the scenario cares only that one answered at all. */
const VERSION_A_RUNNING_RUNTIME_REPORTS = '0.6.2';

/** What a server that is not a model runtime answers with: an HTTP answer carrying no version. */
const STRANGER_BODY = { service: 'not-a-model-runtime' };

/** How the stub meets the next look while it is listening, which a scenario scripts beforehand. */
type ListeningFace = { met: 'the-runtime'; version: string } | { met: 'a-stranger' };

/** Stands in for a local runtime's own server, so a scenario decides what a look finds. */
export type RuntimeStub = {
  /** The loopback origin the engine child looks at in place of the documented port. */
  origin: string;
  answers: () => Promise<void>;
  answersWithVersion: (version: string) => Promise<void>;
  answersAsAStranger: () => Promise<void>;
  fallsSilent: () => Promise<void>;
  dispose: () => Promise<void>;
};

function answerAsked(
  face: ListeningFace,
  request: IncomingMessage,
  response: ServerResponse,
): void {
  if (request.url !== VERSION_PATH) {
    response.writeHead(NOTHING_THERE).end();

    return;
  }

  response.writeHead(ACCEPTED, { 'content-type': 'application/json' });
  response.end(
    JSON.stringify(face.met === 'the-runtime' ? { version: face.version } : STRANGER_BODY),
  );
}

async function listenAgain(server: Server, port: number): Promise<void> {
  if (server.listening) {
    return;
  }

  return new Promise<void>((settle, refuse) => {
    server.once('error', refuse);
    server.listen({ host: LOOPBACK_HOST, port }, () => {
      settle();
    });
  });
}

async function stopListening(server: Server): Promise<void> {
  if (!server.listening) {
    return;
  }

  server.closeAllConnections();

  return new Promise<void>((settle) => {
    server.close(() => {
      settle();
    });
  });
}

/**
 * A stand-in for a local runtime's `/api/version`, bound on loopback so the engine child uses it.
 *
 * @summary The child honors a runtime origin only when it names a loopback host, so the stub binds
 * `127.0.0.1` and hands that origin over beside the probe and keychain overrides. The app under
 * test therefore never aims at the documented port, and a runtime a developer happens to be
 * running on this machine can never answer a scenario. Silence is the listener letting the port go
 * rather than a refusal at the socket, because a stopped server is what a scenario means by it.
 */
export async function fakeLocalRuntime(): Promise<RuntimeStub> {
  let face: ListeningFace = { met: 'the-runtime', version: VERSION_A_RUNNING_RUNTIME_REPORTS };
  const server = createServer((request, response) => {
    answerAsked(face, request, response);
  });
  const port = await bindToAFreePort(server, LOOPBACK_HOST);

  const wears = async (next: ListeningFace): Promise<void> => {
    face = next;

    return listenAgain(server, port);
  };

  return {
    origin: `http://${LOOPBACK_HOST}:${String(port)}`,
    answers: async () => wears({ met: 'the-runtime', version: VERSION_A_RUNNING_RUNTIME_REPORTS }),
    answersWithVersion: async (version) => wears({ met: 'the-runtime', version }),
    answersAsAStranger: async () => wears({ met: 'a-stranger' }),
    fallsSilent: async () => stopListening(server),
    dispose: async () => stopListening(server),
  };
}
