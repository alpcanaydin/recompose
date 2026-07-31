/** The word a gateway's state reads as, wherever the screen prints it. */
export const stateWord = {
  running: 'Running',
  stopped: 'Stopped',
} as const;

/** The fill a gateway's state paints, wherever the screen marks it. */
export const stateMark = {
  running: 'bg-running',
  stopped: 'bg-stopped',
} as const;
