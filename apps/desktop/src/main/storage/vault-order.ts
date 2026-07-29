let tail: Promise<unknown> = Promise.resolve();

/**
 * Runs vault work one turn at a time, in the order it arrived.
 *
 * @summary Reach for it around every read-modify-write of the vault, because two of them
 * interleaved lose whichever secret was written first.
 */
export async function inVaultOrder<Answer>(work: () => Promise<Answer>): Promise<Answer> {
  const answered = tail.then(work, work);

  tail = answered.then(
    () => undefined,
    () => undefined,
  );

  return answered;
}
