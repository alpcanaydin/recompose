import type { ReactNode } from 'react';

function Meter({ children }: { children: ReactNode }) {
  return <span className="font-mono text-mono-value text-ink-secondary">{children}</span>;
}

function Reading({ children }: { children: ReactNode }) {
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
      <Meter>
        <Reading>0</Reading> req/min
      </Meter>
      <Meter>
        p95 <Reading>—</Reading>
      </Meter>
      <Meter>
        <Reading>0</Reading> clients
      </Meter>
      <span aria-hidden className="h-3.5 w-px bg-line-subtle" />
      <Meter>
        <Reading>0</Reading> tok/min · <Reading>$0.00</Reading> today
      </Meter>
      <span className="flex-1" />
      <Meter>
        <Reading>0</Reading> nodes · <Reading>0</Reading> wires
      </Meter>
    </footer>
  );
}
