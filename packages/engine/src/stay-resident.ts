const A_DAY = 24 * 60 * 60 * 1000;

/**
 * Holds the engine child open between directives.
 *
 * @summary The child is a resident service: the host forks it once and keeps it across every
 * start and stop. Between directives it may hold no listener at all, and a process holding
 * nothing has nothing to wait on, so it leaves. This gives it something, and the host's kill is
 * what ends it.
 */
export function stayResident(): { release: () => void } {
  const holder = setInterval(() => undefined, A_DAY);

  return {
    release: () => {
      clearInterval(holder);
    },
  };
}
