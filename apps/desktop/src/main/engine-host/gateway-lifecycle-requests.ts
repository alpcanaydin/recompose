import type { EngineGateway } from '@recompose/contracts';

import type { EngineHost } from './engine-host';

import { storedEngineGateway } from './stored-gateway';

export type EngineAccess = {
  host: () => EngineHost | null;
  gatewaysDir: () => string;
  onCorrupt: (quarantinedPath: string) => void;
};

export type GatewayLifecycleRequests = {
  start: (slug: string) => void;
  stop: (slug: string) => void;
  restart: (slug: string) => void;
};

/**
 * Lifecycle requests from a surface that knows a slug and nothing else.
 *
 * @summary The menu bar carries no port and no display name, so every start and restart reads
 * the stored document first. Nothing here answers a caller, so every failure has to be logged.
 */
export function createGatewayLifecycleRequests(access: EngineAccess): GatewayLifecycleRequests {
  function ask(act: string, slug: string, work: (host: EngineHost) => Promise<unknown>): void {
    const host = access.host();

    if (host === null) {
      console.error(`recompose could not ${act} the gateway "${slug}" before the engine was ready`);

      return;
    }

    work(host).catch((error: unknown) => {
      console.error(`recompose could not ${act} the gateway "${slug}"`, error);
    });
  }

  function askToServe(
    act: string,
    slug: string,
    serve: (host: EngineHost, gateway: EngineGateway) => Promise<unknown>,
  ): void {
    ask(act, slug, async (host) => {
      const gateway = await storedEngineGateway(access.gatewaysDir(), access.onCorrupt, slug);

      if (gateway === undefined) {
        throw new Error(`recompose stores no gateway under that slug.`);
      }

      return serve(host, gateway);
    });
  }

  return {
    start: (slug) => {
      askToServe('start', slug, async (host, gateway) => host.start(gateway));
    },
    stop: (slug) => {
      ask('stop', slug, async (host) => host.stop(slug));
    },
    restart: (slug) => {
      askToServe('restart', slug, async (host, gateway) => host.restart(gateway));
    },
  };
}
