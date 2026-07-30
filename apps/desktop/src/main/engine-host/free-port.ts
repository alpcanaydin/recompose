const DEFAULT_ATTEMPTS = 16;

export async function offerFreePort(
  taken: ReadonlySet<number>,
  probe: () => Promise<number>,
  attempts: number = DEFAULT_ATTEMPTS,
): Promise<number> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const port = await probe();

    if (!taken.has(port)) {
      return port;
    }
  }

  throw new Error(
    `recompose asked the operating system for a free port ${String(attempts)} times and every answer was a port a stored gateway already holds.`,
  );
}
