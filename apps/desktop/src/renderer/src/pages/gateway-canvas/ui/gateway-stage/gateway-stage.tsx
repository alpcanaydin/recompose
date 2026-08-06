import type { GatewayConfig } from '@recompose/contracts';

import { Icon } from '../../../../shared/ui';
import { servesTally } from '../../model/served-models';

type GatewayStageProps = {
  /** The gateway the stage holds, which is the one the route selected. */
  gateway: GatewayConfig;
  /** Whether the node stands selected, which is what puts the inspector on screen. */
  selected: boolean;
  /** Receives the ask to select the node, or to let it go. */
  onToggleSelected: () => void;
};

/**
 * The surface a gateway will be composed on, holding the gateway itself and nothing else yet.
 *
 * @summary The dotted field says nodes belong here, and the one node standing on it says which
 * gateway this is and opens its inspector. The node and the hint sit in one row rather than both
 * claiming the centre, so neither can ever cover the other however narrow the window gets, and the
 * hint takes no pointer of its own, so every click in that space reaches the node it was meant for.
 */
export function GatewayStage({ gateway, selected, onToggleSelected }: GatewayStageProps) {
  return (
    <section className="relative flex min-w-0 flex-1 items-center gap-6 overflow-hidden p-6 dot-grid">
      <button
        aria-pressed={selected}
        className="relative z-10 shrink-0 node-card px-2.75 py-2 text-start focus-ring"
        onClick={onToggleSelected}
        type="button"
      >
        <span className="flex items-center gap-1.5 text-footnote font-bold tracking-wider text-ink uppercase">
          <Icon className="size-3 text-accent-ink" name="network" />
          Gateway
        </span>
        <span className="mt-1 block text-control font-semibold text-ink">
          {gateway.displayName}
        </span>
        <span className="block font-mono text-mono-value text-ink-secondary">
          :{gateway.port} · {servesTally(gateway.virtualModels.length)}
        </span>
      </button>
      <div className="pointer-events-none relative z-0 mx-auto max-w-80 min-w-0 text-center text-ink-secondary">
        <Icon className="mx-auto size-6 text-ink-tertiary" name="spark" />
        <p className="mt-2 text-detail font-semibold text-ink-secondary">
          Virtual models serve from the drawer
        </p>
        <p className="mt-0.5 text-detail">
          The canvas arrives with routing. Until then, define virtual models on the right and point
          a client at the base URL.
        </p>
      </div>
    </section>
  );
}
