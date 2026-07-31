export type GetStartedStep = {
  /** What the step asks the person to do. */
  title: string;
  /** Whether the session finished the step, stands on it, or cannot reach it yet. */
  state: 'current' | 'done' | 'pending';
  /** What an unreachable step waits for, absent on a step the session can act on. */
  reason?: string;
};

export type GetStartedProgress = {
  /** Whether the app holds at least one gateway document. */
  gatewayExists: boolean;
  /** Whether the app holds at least one connected account. */
  providerConnected: boolean;
};

function stateOf(done: boolean, reachedIt: boolean): GetStartedStep['state'] {
  if (done) {
    return 'done';
  }

  return reachedIt ? 'current' : 'pending';
}

function actionableSteps(progress: GetStartedProgress): readonly GetStartedStep[] {
  return [
    {
      title: 'Create a gateway',
      state: stateOf(progress.gatewayExists, true),
    },
    {
      title: 'Connect a provider',
      state: stateOf(progress.providerConnected, progress.gatewayExists),
    },
  ];
}

/**
 * The four steps of a first session, each carrying where the session stands on it.
 *
 * @summary The two steps this build can finish read their state from stored documents rather
 * than from a record of their own, so the checklist can never disagree with what the app holds.
 */
export function getStartedSteps(progress: GetStartedProgress): readonly GetStartedStep[] {
  return [
    ...actionableSteps(progress),
    { title: 'Compose a virtual model', state: 'pending', reason: 'Waits on the canvas.' },
    { title: 'Send the first request', state: 'pending', reason: 'Waits on a virtual model.' },
  ];
}
