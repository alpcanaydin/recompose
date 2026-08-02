import type { ReactNode } from 'react';

function meter(children: ReactNode): ReactNode {
  return <span className="font-mono text-mono-value text-ink-secondary">{children}</span>;
}

function reading(children: ReactNode): ReactNode {
  return <b className="font-medium text-ink">{children}</b>;
}

/**
 * The band under the canvas, reading what the gateways on this machine are carrying.
 *
 * @summary Reach for it at the foot of the shell. Every reading is zero and stays zero until
 * something routes a request, so it reports the quiet rather than inventing traffic.
 */
export function StatusBar() {
  return (
    <footer className="flex h-status-bar shrink-0 items-center gap-3.5 border-t border-line-subtle bg-surface-toolbar px-3.5">
      {meter(<>{reading('0')} req/min</>)}
      {meter(<>p95 {reading('0ms')}</>)}
      {meter(<>{reading('0')} clients</>)}
      <span aria-hidden className="h-3.5 w-px bg-line-subtle" />
      {meter(
        <>
          {reading('0')} tok/min · {reading('$0.00')} today
        </>,
      )}
      <span className="flex-1" />
      {meter(
        <>
          {reading('0')} nodes · {reading('0')} wires
        </>,
      )}
    </footer>
  );
}
