import type { GatewayEngineState } from '@recompose/contracts';

import { CopyButton, Icon, stateMark, stateWord } from '../../../../../shared/ui';

type AddressPillProps = {
  /** The origin a person pastes into a client, which the copy control hands over whole. */
  address: string;
  port: number;
  status: GatewayEngineState['status'];
};

/** The address the gateway answers on, filling the strip the way the reference draws it. */
export function AddressPill({ address, port, status }: AddressPillProps) {
  return (
    <span className="relative flex h-7.5 min-w-0 flex-1 items-center justify-center gap-2.25 overflow-hidden rounded-control border border-line-subtle bg-surface-raised px-8 font-mono text-mono-value whitespace-nowrap">
      <Icon
        className="absolute inset-s-2.5 top-1/2 size-3.5 -translate-y-1/2 text-accent-ink"
        name="network"
      />
      <span className={`size-1.75 shrink-0 rounded-pill ${stateMark[status]}`} />
      <span>
        <span className="text-ink-secondary">http://</span>
        <span className="text-ink">{`localhost:${String(port)}`}</span>
      </span>
      <span className="text-ink-secondary">·</span>
      <span className="text-ink-secondary">{stateWord[status]}</span>
      <span className="absolute inset-e-1.5 top-1/2 flex -translate-y-1/2">
        <CopyButton label="Copy address" value={address} />
      </span>
    </span>
  );
}
