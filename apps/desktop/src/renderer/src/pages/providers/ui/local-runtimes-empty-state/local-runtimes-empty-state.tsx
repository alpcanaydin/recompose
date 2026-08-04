import { KindEmptyState } from '../kind-empty-state/kind-empty-state';

/**
 * What stands where the runtime rows would be before any runtime connects.
 *
 * @summary Reach for it from the local runtimes surface with an empty registry. The sentence says
 * what the destination holds, an address with no credential behind it, so the first connect is
 * never a guess and the one act stays in the window strip.
 */
export function LocalRuntimesEmptyState() {
  return (
    <KindEmptyState
      explanation="A local runtime serves models from this machine, and its account holds only the address it answers at, with no credential to store. Each row reads whether its server answers as of the last look."
      title="Nothing connected yet"
    />
  );
}
