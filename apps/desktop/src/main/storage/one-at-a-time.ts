export type OneAtATime = <Answer>(work: () => Promise<Answer>) => Promise<Answer>;

/**
 * Runs work in the order it arrives, never two at once.
 *
 * @summary Reach for it around a read that decides whether a write may happen. Two gateway saves
 * arriving together would each list the stored gateways, each find no conflict, and each write,
 * handing one port to two gateways. One lane makes the second save read what the first wrote.
 */
export function oneAtATime(): OneAtATime {
  let lane: Promise<unknown> = Promise.resolve();

  return async (work) => {
    const answered = lane.then(work, work);

    lane = answered.then(
      () => undefined,
      () => undefined,
    );

    return answered;
  };
}
