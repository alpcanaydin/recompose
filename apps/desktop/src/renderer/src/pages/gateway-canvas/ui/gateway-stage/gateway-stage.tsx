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
 * gateway this is and opens its inspector. The node keeps the leading edge rather than the centre,
 * because the field fills with nodes from that edge once routing arrives. Pressing the field itself
 * lets the node go, which is how a person puts the inspector away by looking elsewhere rather than
 * by finding the control that opened it. Only a press that lands on the field counts, so the node
 * keeps its own toggle and nothing fires twice.
 */
export function GatewayStage({ gateway, selected, onToggleSelected }: GatewayStageProps) {
  return (
    <section className="relative flex min-w-0 flex-1 items-center gap-6 overflow-hidden p-6 dot-grid">
      <button
        data-panel-control=""
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
    </section>
  );
}
