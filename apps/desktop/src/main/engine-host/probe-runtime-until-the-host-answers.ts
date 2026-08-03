import type { RuntimeReachability } from '@recompose/contracts';

/**
 * The reading the local channels get while no engine host can take a look.
 *
 * @summary Stands in for `EngineHost.probeRuntime` until the host grows one, and answers the fold
 * a dead child already answers, because a look nobody can take and a look nobody answered leave
 * the person the same remedy. Delete this module the moment the host answers, and the local
 * handlers take their reading from the child.
 */
export async function probeRuntimeUntilTheHostAnswers(
  _address: string,
): Promise<RuntimeReachability> {
  return Promise.resolve({ verdict: 'unreachable' });
}
