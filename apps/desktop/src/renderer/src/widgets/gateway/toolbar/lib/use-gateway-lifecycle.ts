import { useState } from 'react';

import { useMoveGatewayPort, useStartGateway, useStopGateway } from '../../../../shared/api';

export type GatewayLifecycle = {
  /** Counts attempts, so a line repeating a sentence announces itself again. */
  attempt: number;
  moveToFreePort: () => void;
  /** The sentence the last attempt left behind, if it left one. */
  refusal: string | undefined;
  start: () => void;
  stop: () => void;
};

/**
 * The three acts that run one gateway, and the single line they answer through.
 *
 * @summary Reach for it from the toolbar. Each act clears what the last one left, so the line
 * never reads back a sentence belonging to an action the person has already moved on from.
 */
export function useGatewayLifecycle(slug: string): GatewayLifecycle {
  const startGateway = useStartGateway();
  const stopGateway = useStopGateway();
  const moveGatewayPort = useMoveGatewayPort();
  const [attempt, setAttempt] = useState(0);

  function afresh(act: () => void): void {
    startGateway.reset();
    stopGateway.reset();
    moveGatewayPort.reset();
    act();
  }

  return {
    attempt,
    moveToFreePort: () => {
      afresh(() => {
        moveGatewayPort.mutate({ slug });
      });
    },
    refusal: startGateway.refusal ?? stopGateway.refusal ?? moveGatewayPort.refusal,
    start: () => {
      afresh(() => {
        setAttempt((made) => made + 1);
        startGateway.mutate({ slug });
      });
    },
    stop: () => {
      afresh(() => {
        stopGateway.mutate({ slug });
      });
    },
  };
}
