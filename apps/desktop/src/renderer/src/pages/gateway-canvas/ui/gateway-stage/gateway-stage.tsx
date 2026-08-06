import type { GatewayConfig } from '@recompose/contracts';

import { Icon } from '../../../../shared/ui';
import { servesTally } from '../../model/served-models';

type GatewayStageProps = {
  /** The gateway the stage holds, which is the one the route selected. */
  gateway: GatewayConfig;
};

/**
 * The surface a gateway will be composed on, holding the gateway itself and nothing else yet.
 *
 * @summary The dotted field says nodes belong here, and the one node standing on it says which
 * gateway this is. The hint sends a person to the drawer rather than leaving them hunting for a
 * control the canvas has not grown yet, because a surface that offers nothing reads as broken.
 */
export function GatewayStage({ gateway }: GatewayStageProps) {
  return (
    <section className="relative min-w-0 flex-1 overflow-hidden dot-grid">
      <div className="absolute inset-s-6 top-1/2 -translate-y-1/2 rounded-card border border-accent bg-surface-card px-2.75 py-2 shadow-raised">
        <p className="flex items-center gap-1.5 text-footnote font-bold tracking-wider text-accent-ink uppercase">
          <Icon className="size-3" name="network" />
          Gateway
        </p>
        <p className="mt-1 text-control font-semibold text-ink">{gateway.displayName}</p>
        <p className="font-mono text-mono-value text-ink-secondary">
          :{gateway.port} · {servesTally(gateway.virtualModels.length)}
        </p>
      </div>
      <div className="absolute inset-s-0 top-1/2 w-full -translate-y-1/2 px-6 text-center">
        <div className="mx-auto max-w-80 text-ink-secondary">
          <Icon className="mx-auto size-6 text-ink-tertiary" name="spark" />
          <p className="mt-2 text-detail font-semibold text-ink-secondary">
            Virtual models serve from the drawer
          </p>
          <p className="mt-0.5 text-detail">
            The canvas arrives with routing. Until then, define virtual models on the right and
            point a client at the base URL.
          </p>
        </div>
      </div>
    </section>
  );
}
