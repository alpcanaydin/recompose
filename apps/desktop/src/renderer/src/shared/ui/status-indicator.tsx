type StatusIndicatorProps = {
  /** Whether the thing this marks is currently serving. */
  status: 'running' | 'stopped';
};

import { stateMark, stateWord } from './gateway-state';

/**
 * Six pixel mark carrying a serving state as a filled dot, green when it serves and red when it
 * doesn't.
 *
 * @summary Reach for it beside the name of something that runs or doesn't, where the state word
 * belongs to the mark rather than to a separate line. The state word rides as the accessible
 * name, so a screen reader hears the row's name and then Running or Stopped.
 */
export function StatusIndicator({ status }: StatusIndicatorProps) {
  return (
    <span
      aria-label={stateWord[status]}
      className={`inline-block size-1.5 shrink-0 rounded-pill ${stateMark[status]}`}
      role="img"
    />
  );
}
